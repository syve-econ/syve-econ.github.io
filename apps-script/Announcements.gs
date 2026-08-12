/**
 * Announcement broadcast to the SYVE membership.
 *
 * Deliberately manual. Nothing in this file runs on a trigger: sending mail to
 * the whole directory is not something that should ever fire off an edit.
 * The intended flow is Preview -> read the draft in your own inbox -> Send.
 */

/** Reads the members directory. Returns [{name, email}] with valid emails only. */
function getMemberRecipients_() {
  const ss = SpreadsheetApp.openById(CONFIG.MEMBERS.SPREADSHEET_ID);
  const sheet = getSheetByGid_(ss, CONFIG.MEMBERS.SHEET_GID);
  if (!sheet) {
    throw new Error(
      'Members sheet with gid ' + CONFIG.MEMBERS.SHEET_GID + ' was not found.'
    );
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  const nameCol = headers.indexOf(CONFIG.MEMBERS.NAME_HEADER.toLowerCase());
  const emailCol = headers.indexOf(CONFIG.MEMBERS.EMAIL_HEADER.toLowerCase());

  if (emailCol === -1) {
    throw new Error(
      'Column "' + CONFIG.MEMBERS.EMAIL_HEADER + '" was not found in the members sheet.'
    );
  }

  const seen = {};
  const recipients = [];

  for (let i = 1; i < values.length; i++) {
    const email = String(values[i][emailCol]).trim();
    if (!isValidEmail_(email)) continue;

    const key = email.toLowerCase();
    if (seen[key]) continue; // one mail per person even if listed twice
    seen[key] = true;

    recipients.push({
      name: nameCol === -1 ? '' : String(values[i][nameCol]).trim(),
      email: email,
    });
  }

  return recipients;
}

function isValidEmail_(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim());
}

/**
 * Collects upcoming sessions across all schedule tabs.
 * "Upcoming" means the Date cell is today or later.
 */
function getUpcomingSessions_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessions = [];

  CONFIG.SCHEDULE_SHEETS.forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const headerMap = getHeaderMap_(sheet);
    const dateCol = headerMap[CONFIG.HEADERS.date.trim().toLowerCase()];
    if (!dateCol) return;

    const lastRow = sheet.getLastRow();
    for (let row = CONFIG.HEADER_ROW + 1; row <= lastRow; row++) {
      const raw = sheet.getRange(row, dateCol).getValue();
      if (!(Object.prototype.toString.call(raw) === '[object Date]')) continue;
      if (raw < today) continue;

      const data = readScheduleRow_(sheet, row);
      data.sortKey = raw.getTime();
      sessions.push(data);
    }
  });

  sessions.sort(function (a, b) {
    return a.sortKey - b.sortKey;
  });
  return sessions;
}

/** Builds the announcement HTML for a list of sessions. */
function buildAnnouncementHtml_(sessions) {
  if (!sessions.length) {
    return (
      '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;">' +
      '<p>There are no upcoming sessions with a date on the schedule yet.</p>' +
      '</div>'
    );
  }

  const blocks = sessions
    .map(function (s) {
      const when = [s.date, s.time].filter(Boolean).join(' at ') || 'TBD';
      return (
        '<div style="margin:0 0 24px 0;padding:0 0 16px 0;' +
        'border-bottom:1px solid #eee;">' +
        '<h3 style="margin:0 0 8px 0;font-size:15px;">' +
        escapeHtml_(s.sheetName) +
        '</h3>' +
        '<table style="border-collapse:collapse;">' +
        detailRow_('Presenter', s.presenter) +
        detailRow_('Paper', s.title) +
        detailRow_('Authors', s.authors) +
        detailRow_('Date & time', when) +
        detailRow_('Paper link', s.link, true) +
        detailRow_('Slides', s.slides, true) +
        (CONFIG.ZOOM_LINK ? detailRow_('Zoom', CONFIG.ZOOM_LINK, true) : '') +
        '</table>' +
        '</div>'
      );
    })
    .join('');

  return (
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;' +
    'color:#222;line-height:1.5;">' +
    '<p>Dear all,</p>' +
    '<p>Here is the upcoming SYVE schedule.</p>' +
    blocks +
    '<p>See you there,<br>SYVE</p>' +
    '<p style="color:#888;font-size:12px;">' +
    'Full schedule and materials: <a href="' +
    escapeHtml_(SpreadsheetApp.getActiveSpreadsheet().getUrl()) +
    '">schedule workbook</a>.</p>' +
    '</div>'
  );
}

/** Sends the announcement to yourself only, so you can check it before sending. */
function previewAnnouncement() {
  const ui = SpreadsheetApp.getUi();
  const sessions = getUpcomingSessions_();
  const recipients = getMemberRecipients_();
  const me = Session.getActiveUser().getEmail();

  MailApp.sendEmail({
    to: me,
    subject: '[PREVIEW] SYVE upcoming schedule',
    htmlBody:
      '<p style="background:#fff3cd;padding:8px;border:1px solid #ffe08a;">' +
      'Preview only. If sent for real this would go to <strong>' +
      recipients.length +
      '</strong> members.</p>' +
      buildAnnouncementHtml_(sessions),
    name: CONFIG.SENDER_NAME,
  });

  ui.alert(
    'Preview sent',
    'A preview went to ' +
      me +
      '.\n\nSessions included: ' +
      sessions.length +
      '\nMembers who would receive it: ' +
      recipients.length,
    ui.ButtonSet.OK
  );
}

/** Sends the announcement to every member, after an explicit confirmation. */
function sendAnnouncementToAllMembers() {
  const ui = SpreadsheetApp.getUi();
  const sessions = getUpcomingSessions_();
  const recipients = getMemberRecipients_();

  if (!recipients.length) {
    ui.alert('No valid member email addresses were found.');
    return;
  }

  const quota = MailApp.getRemainingDailyQuota();
  if (quota < recipients.length) {
    ui.alert(
      'Not enough email quota',
      'Remaining quota today: ' +
        quota +
        '\nRecipients: ' +
        recipients.length +
        '\n\nTry again tomorrow or send in batches.',
      ui.ButtonSet.OK
    );
    return;
  }

  const answer = ui.alert(
    'Send to all members?',
    'This sends the upcoming schedule (' +
      sessions.length +
      ' session(s)) to ' +
      recipients.length +
      ' members.\n\nThis cannot be undone. Did you run Preview first?',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  const html = buildAnnouncementHtml_(sessions);
  let sent = 0;
  const failed = [];

  recipients.forEach(function (r) {
    try {
      MailApp.sendEmail({
        to: r.email,
        subject: 'SYVE upcoming schedule',
        htmlBody: html,
        name: CONFIG.SENDER_NAME,
      });
      sent++;
    } catch (err) {
      failed.push(r.email + ' (' + err.message + ')');
    }
  });

  ui.alert(
    'Done',
    'Sent: ' +
      sent +
      '\nFailed: ' +
      failed.length +
      (failed.length ? '\n\n' + failed.join('\n') : ''),
    ui.ButtonSet.OK
  );
}
