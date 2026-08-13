/**
 * Automatic reminder shortly before a session starts.
 *
 * WHY A SCAN RATHER THAN ONE TRIGGER PER SESSION
 * Apps Script allows a one-off trigger scheduled at a specific time, which
 * looks like the obvious fit, but a project may hold only 20 triggers at once
 * and every schedule edit would have to add, move or delete one. A single
 * time-driven scan every few minutes has no such ceiling, needs nothing doing
 * when a date changes, and recovers by itself if a run is missed.
 *
 * The cost of a scan is that "send exactly once" has to be enforced in code:
 * the same session sits inside the 30-minute window for several consecutive
 * runs. That is what the log in Script Properties is for. Its key includes the
 * start time, so a session moved to a new slot is treated as a new session and
 * is reminded about again.
 */

/**
 * Entry point for the time-driven trigger. Installed by installTriggers().
 *
 * Never throws: a trigger that fails leaves no visible trace beyond the
 * execution log, so failures are logged and swallowed rather than left to
 * surface nowhere.
 */
function sendDueReminders() {
  try {
    const summary = runReminderScan_();
    if (summary.due || summary.failures.length) {
      console.log('Reminder scan: ' + JSON.stringify(summary));
    }
    return summary;
  } catch (err) {
    console.error('sendDueReminders failed: ' + err.stack);
    return null;
  }
}

/** CONFIG.REMINDER, with a clear message when Config.gs is out of date. */
function reminderSettings_() {
  if (!CONFIG.REMINDER) {
    throw new Error(
      'CONFIG.REMINDER is missing. Config.gs is out of date - re-paste it, ' +
        'then reload the spreadsheet.'
    );
  }
  return CONFIG.REMINDER;
}

/**
 * Finds sessions starting within the lead time and mails them once.
 * Returns a summary; the menu item renders it, the trigger logs it.
 */
function runReminderScan_() {
  const settings = reminderSettings_();
  const summary = {
    enabled: !!settings.ENABLED,
    scanned: 0,
    undatedOrUntimed: 0,
    due: 0,
    emails: 0,
    failures: [],
    notes: [],
  };

  if (!settings.ENABLED) {
    summary.notes.push('Reminders are switched off (CONFIG.REMINDER.ENABLED).');
    return summary;
  }

  // Scans overlap only if one runs long. Taking the lock rather than queuing
  // is deliberate: the next scan is minutes away, and a duplicate reminder is
  // worse than a slightly later one.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    summary.notes.push('Another scan is already running; this one did nothing.');
    return summary;
  }

  try {
    const now = nowWallMinutes_();
    const sessions = getUpcomingSessions_();
    const log = readReminderLog_();
    summary.scanned = sessions.length;

    sessions.forEach(function (session) {
      const start = sessionStartMinutes_(session);
      if (start === null) {
        // No date, or a Time cell nothing can be read as a time. Announcements
        // still carry the row as TBD; a reminder simply has no anchor.
        summary.undatedOrUntimed++;
        return;
      }

      const minutesUntil = start - now;
      if (minutesUntil <= 0) return; // already under way
      if (minutesUntil > settings.LEAD_MINUTES) return; // not yet

      const key = reminderKey_(session, start);
      if (log[key]) return; // already reminded for this slot

      summary.due++;
      const result = sendReminderForSession_(session, minutesUntil);
      summary.emails += result.sent;
      result.failures.forEach(function (f) {
        summary.failures.push(f);
      });

      if (!result.sent && result.recipients) {
        // Nothing got out at all - quota, most likely. Leave it out of the log
        // so the next scan retries while the reminder is still worth sending.
        summary.notes.push(
          'Retrying next scan: ' + session.sheetName + ' row ' + session.row
        );
        return;
      }

      log[key] = {
        start: start,
        at: new Date().toISOString(),
        sheet: session.sheetName,
        row: session.row,
        sent: result.sent,
      };
      // Written per session, not once at the end: if a later send throws, the
      // sessions already mailed stay marked and are not mailed twice.
      writeReminderLog_(pruneReminderLog_(log, now));
    });
  } finally {
    lock.releaseLock();
  }

  return summary;
}

/** Sends one session's reminder to its audience. */
function sendReminderForSession_(session, minutesUntil) {
  const recipients = reminderRecipients_(session);
  const result = { recipients: recipients.length, sent: 0, failures: [] };
  if (!recipients.length) return result;

  const quota = MailApp.getRemainingDailyQuota();
  if (quota < recipients.length) {
    result.failures.push(
      'Not enough quota for ' + session.sheetName + ' row ' + session.row +
        ' (' + quota + ' left, ' + recipients.length + ' needed)'
    );
    return result;
  }

  const subject = reminderSubject_(session);
  const html = buildReminderHtml_(session, minutesUntil);
  const text = reminderPlainText_(session, minutesUntil) + footerText_();

  recipients.forEach(function (r) {
    try {
      MailApp.sendEmail({
        to: r.email,
        subject: subject,
        htmlBody: html,
        body: text,
        name: CONFIG.SENDER_NAME,
        replyTo: CONFIG.CONTACT_EMAIL,
      });
      result.sent++;
    } catch (err) {
      result.failures.push(r.email + ' (' + err.message + ')');
    }
  });

  return result;
}

/**
 * Who receives the reminder, per CONFIG.REMINDER.AUDIENCE.
 * Always returns [{name, email}] with no duplicates.
 */
function reminderRecipients_(session) {
  const mode = String(reminderSettings_().AUDIENCE || 'members')
    .trim()
    .toLowerCase();

  if (mode === 'members') return getMemberRecipients_();

  const organizers = notifyRecipients_()
    .split(',')
    .map(function (email) {
      return { name: '', email: email };
    });

  if (mode !== 'presenter') return organizers;

  const presenter = findMemberByName_(session.presenter);
  // No match is not an error: presenters are named in the schedule, and a name
  // that is spelled differently in the directory simply cannot be resolved.
  return presenter ? dedupeRecipients_(organizers.concat([presenter])) : organizers;
}

/** Looks a presenter up in the members directory by exact (case-less) name. */
function findMemberByName_(name) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle) return null;

  const members = getMemberRecipients_();
  for (let i = 0; i < members.length; i++) {
    if (String(members[i].name).trim().toLowerCase() === needle) {
      return members[i];
    }
  }
  return null;
}

/** Drops repeated addresses, keeping the first occurrence. */
function dedupeRecipients_(recipients) {
  const seen = {};
  const clean = [];
  recipients.forEach(function (r) {
    const key = String(r.email).trim().toLowerCase();
    if (!key || seen[key]) return;
    seen[key] = true;
    clean.push(r);
  });
  return clean;
}

/** Subject line: the start time first, since that is the point of the email. */
function reminderSubject_(session) {
  const at = session.time || CONFIG.TBD_LABEL;
  const who = session.presenter || 'Unknown presenter';
  const what = session.title || 'Untitled paper';
  return '[SYVE] Starting at ' + at + ': ' + who + ' - ' + what;
}

/** The reminder body. */
function buildReminderHtml_(session, minutesUntil) {
  const minutes = Math.max(1, Math.round(minutesUntil));

  return (
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;' +
    'color:#222;line-height:1.5;">' +
    '<p style="font-size:16px;margin:0 0 16px 0;">' +
    '<strong>Starting in about ' + minutes + ' minutes.</strong></p>' +
    '<table style="border-collapse:collapse;margin:0 0 16px 0;">' +
    detailRow_('Series', session.sheetName) +
    detailRow_('Presenter', session.presenter) +
    detailRow_('Paper', session.title) +
    detailRow_('Authors', session.authors) +
    detailRow_('Date & time', formatWhen_(session.date, session.time)) +
    detailRow_('Fields', session.fields) +
    detailRow_('Topic', session.topic) +
    detailRow_('Paper link', session.link, true) +
    detailRow_('Slides', session.slides, true) +
    '</table>' +
    buildZoomBlock_() +
    '<p>See you shortly,</p>' +
    footerHtml_() +
    '</div>'
  );
}

/** Plain-text body for clients that do not render HTML. */
function reminderPlainText_(session, minutesUntil) {
  const minutes = Math.max(1, Math.round(minutesUntil));
  const zoom = getZoomDetails_();

  const lines = [
    'Starting in about ' + minutes + ' minutes.',
    '',
    'Series:      ' + session.sheetName,
    'Presenter:   ' + (session.presenter || '-'),
    'Paper:       ' + (session.title || '-'),
    'Authors:     ' + (session.authors || '-'),
    'Date & time: ' + formatWhen_(session.date, session.time),
    'Paper link:  ' + (session.link || '-'),
  ];

  if (zoom.link || zoom.meetingId) {
    lines.push('');
    lines.push('Join');
    if (zoom.link) lines.push('  Zoom:       ' + zoom.link);
    if (zoom.meetingId) lines.push('  Meeting ID: ' + zoom.meetingId);
    if (zoom.passcode) lines.push('  Passcode:   ' + zoom.passcode);
  }

  return lines.join('\n');
}

/**
 * Identifies one reminder. The start time is part of the key on purpose: move
 * a session and it becomes a different slot, which should be reminded about
 * again rather than treated as already handled.
 */
function reminderKey_(session, startMinutes) {
  return session.sheetName + '|' + session.row + '|' + startMinutes;
}

/** Reads the "already reminded" log. A corrupt value resets rather than throws. */
function readReminderLog_() {
  const raw = PropertiesService.getScriptProperties().getProperty(
    reminderSettings_().SENT_KEY
  );
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('Reminder log was unreadable and has been reset: ' + err.message);
    return {};
  }
}

/** Writes the log back. */
function writeReminderLog_(log) {
  PropertiesService.getScriptProperties().setProperty(
    reminderSettings_().SENT_KEY,
    JSON.stringify(log)
  );
}

/**
 * Drops entries for sessions that are well past, so the property does not grow
 * without limit. Anything whose shape is not recognised is dropped too.
 */
function pruneReminderLog_(log, nowMinutes) {
  const keepFor = reminderSettings_().KEEP_RECORD_DAYS * 24 * 60;
  const kept = {};

  Object.keys(log).forEach(function (key) {
    const entry = log[key];
    if (!entry || typeof entry.start !== 'number') return;
    if (nowMinutes - entry.start > keepFor) return;
    kept[key] = entry;
  });

  return kept;
}

/**
 * The REMINDERS section of "Check setup".
 *
 * Two things here are worth the space. First, the timezone comparison: every
 * start time is computed as wall-clock time in CONFIG.TIMEZONE, so a workbook
 * or script set to a different zone would shift every reminder by the offset
 * between them, silently. Second, the list of upcoming sessions with no usable
 * time - those get announced but can never be reminded about, and the only way
 * to notice is to be told.
 */
function reminderStatusLines_() {
  const lines = [];

  let settings;
  try {
    settings = reminderSettings_();
  } catch (err) {
    return ['  ERROR: ' + err.message];
  }

  lines.push('  Enabled:  ' + (settings.ENABLED ? 'yes' : 'NO'));
  lines.push('  Lead:     ' + settings.LEAD_MINUTES + ' minutes before start');
  lines.push('  Scan:     every ' + reminderScanInterval_() + ' minutes');
  lines.push('  Audience: ' + settings.AUDIENCE);

  const scriptTz = Session.getScriptTimeZone();
  const sheetTz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  if (scriptTz === CONFIG.TIMEZONE && sheetTz === CONFIG.TIMEZONE) {
    lines.push('  Timezone: OK (' + CONFIG.TIMEZONE + ')');
  } else {
    lines.push(
      '  Timezone: MISMATCH - reminders would be sent at the wrong time.' +
        '\n              CONFIG.TIMEZONE: ' + CONFIG.TIMEZONE +
        '\n              spreadsheet:     ' + sheetTz +
        '\n              script project:  ' + scriptTz +
        '\n            Set all three the same (File > Project settings for the' +
        '\n            script, File > Settings for the spreadsheet).'
    );
  }

  const unusable = getUpcomingSessions_().filter(function (session) {
    return sessionStartMinutes_(session) === null;
  });
  if (!unusable.length) {
    lines.push('  Every upcoming session has a usable date and time.');
  } else {
    lines.push(
      '  NO REMINDER POSSIBLE for ' + unusable.length +
        ' upcoming session(s) - they need both a Date and a readable Time:'
    );
    unusable.slice(0, 8).forEach(function (session) {
      lines.push(
        '    ' + session.sheetName + ' row ' + session.row + ': ' +
          (session.presenter || '(no presenter)') + ' - ' +
          formatWhen_(session.date, session.time)
      );
    });
    if (unusable.length > 8) {
      lines.push('    ... and ' + (unusable.length - 8) + ' more');
    }
  }

  const log = readReminderLog_();
  lines.push('  Reminders recorded as sent: ' + Object.keys(log).length);

  return lines;
}

/* -------------------------------------------------------------------------
 * Menu items
 * ---------------------------------------------------------------------- */

/** Runs the scan by hand and reports what it did. */
function runReminderCheckNow() {
  const ui = SpreadsheetApp.getUi();
  const summary = runReminderScan_();

  ui.alert(
    'Reminder check',
    'Enabled: ' + (summary.enabled ? 'yes' : 'NO') +
      '\nUpcoming sessions scanned: ' + summary.scanned +
      '\nWithout a usable date + time: ' + summary.undatedOrUntimed +
      '\nDue within ' + reminderSettings_().LEAD_MINUTES + ' minutes: ' + summary.due +
      '\nEmails sent: ' + summary.emails +
      (summary.failures.length ? '\n\nFailures:\n  ' + summary.failures.join('\n  ') : '') +
      (summary.notes.length ? '\n\nNotes:\n  ' + summary.notes.join('\n  ') : ''),
    ui.ButtonSet.OK
  );
}

/**
 * Sends the reminder for the selected row to whoever runs it, and reports how
 * many people the real one would reach. Nothing is written to the log, so the
 * real reminder still goes out at its proper time.
 */
function testReminderForSelectedRow() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = SpreadsheetApp.getActiveRange().getRow();

  if (!isScheduleSheet_(sheet)) {
    ui.alert(
      'Not a schedule tab',
      'Select a row on one of: ' + CONFIG.SCHEDULE_SHEETS.join(', '),
      ui.ButtonSet.OK
    );
    return;
  }
  if (row <= CONFIG.HEADER_ROW) {
    ui.alert('Select a data row, not the header row.');
    return;
  }

  const session = readScheduleRow_(sheet, row);
  const start = sessionStartMinutes_(session);
  const settings = reminderSettings_();
  const me = Session.getActiveUser().getEmail();
  const audience = reminderRecipients_(session);

  MailApp.sendEmail({
    to: me,
    subject: '[TEST] ' + reminderSubject_(session),
    htmlBody:
      '<p style="background:#fff3cd;padding:8px;border:1px solid #ffe08a;">' +
      'Test only, sent to you. The real reminder would go to <strong>' +
      audience.length +
      '</strong> recipient(s) ' +
      settings.LEAD_MINUTES +
      ' minutes before the start time.</p>' +
      buildReminderHtml_(session, settings.LEAD_MINUTES),
    body: reminderPlainText_(session, settings.LEAD_MINUTES) + footerText_(),
    name: CONFIG.SENDER_NAME,
    replyTo: CONFIG.CONTACT_EMAIL,
  });

  ui.alert(
    'Test reminder sent',
    'Sent to: ' + me +
      '\n\nAudience setting: ' + settings.AUDIENCE +
      '\nReal recipients: ' + audience.length +
      '\n\nThis row\'s start time: ' +
      (start === null
        ? 'NOT USABLE - it needs both a Date and a readable Time, so no ' +
          'automatic reminder will be sent for it.'
        : formatWhen_(session.date, session.time)),
    ui.ButtonSet.OK
  );
}

/**
 * Forgets which reminders have been sent. Useful when testing; it means any
 * session still inside its window will be reminded about again.
 */
function clearReminderHistory() {
  const ui = SpreadsheetApp.getUi();
  const count = Object.keys(readReminderLog_()).length;

  const answer = ui.alert(
    'Clear reminder history?',
    'This forgets ' + count + ' recorded reminder(s).\n\n' +
      'Any session starting within the next ' +
      reminderSettings_().LEAD_MINUTES +
      ' minutes will then be reminded about a second time.',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  PropertiesService.getScriptProperties().deleteProperty(
    reminderSettings_().SENT_KEY
  );
  ui.alert('Reminder history cleared.');
}
