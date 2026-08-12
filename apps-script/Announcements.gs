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

/**
 * Collects upcoming sessions across all schedule tabs.
 *
 * A row counts as upcoming when it has a presenter, its status is not
 * Presented or Cancelled, and its date is either today or later, or not filled
 * in yet. Undated sessions are announced with their date shown as TBD rather
 * than being left out, so a registration is visible before a slot is agreed.
 */
function getUpcomingSessions_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessions = [];

  CONFIG.SCHEDULE_SHEETS.forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    readAllScheduleRows_(sheet).forEach(function (data) {
      // Somebody has to be presenting; the rest of the tab is a paper backlog.
      if (!data.presenter) return;
      // Already happened or called off.
      if (isFinishedStatus_(data.status)) return;
      // Dated in the past. A row with no date yet is still upcoming, and is
      // announced with its date shown as TBD.
      if (data.dateValue && data.dateValue < today) return;

      sessions.push(data);
    });
  });

  // Dated sessions first, in date order; undated ones last, since there is no
  // meaningful place to put them in the sequence.
  sessions.sort(function (a, b) {
    if (a.dateValue && b.dateValue) return a.dateValue - b.dateValue;
    if (a.dateValue) return -1;
    if (b.dateValue) return 1;
    return 0;
  });
  return sessions;
}

/** Builds the announcement HTML for a list of sessions. */
function buildAnnouncementHtml_(sessions) {
  if (!sessions.length) {
    return (
      '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;">' +
      '<p>There are no upcoming sessions on the schedule yet.</p>' +
      footerHtml_() +
      '</div>'
    );
  }

  const blocks = sessions
    .map(function (s) {
      const when = formatWhen_(s.date, s.time);
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
        detailRow_('Fields', s.fields) +
        detailRow_('Topic', s.topic) +
        detailRow_('Paper link', s.link, true) +
        detailRow_('Slides', s.slides, true) +
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
    buildZoomBlock_() +
    '<p>See you there,<br>The Society of Young Vietnamese Economists</p>' +
    '<p style="color:#888;font-size:12px;">' +
    'Full schedule and materials: <a href="' +
    escapeHtml_(SpreadsheetApp.getActiveSpreadsheet().getUrl()) +
    '">schedule workbook</a>.</p>' +
    footerHtml_() +
    '</div>'
  );
}

/**
 * The standing Zoom room, shown once per announcement because the same room is
 * used for every session. Renders nothing until the details are set via
 * SYVE -> Set Zoom details.
 */
function buildZoomBlock_() {
  const zoom = getZoomDetails_();
  if (!zoom.link && !zoom.meetingId) return '';

  return (
    '<div style="margin:0 0 24px 0;padding:12px;background:#f5f7fa;' +
    'border-radius:4px;">' +
    '<h3 style="margin:0 0 8px 0;font-size:15px;">Join</h3>' +
    '<table style="border-collapse:collapse;">' +
    detailRow_('Zoom', zoom.link, true) +
    detailRow_('Meeting ID', zoom.meetingId) +
    detailRow_('Passcode', zoom.passcode) +
    '</table>' +
    '<p style="margin:8px 0 0 0;color:#666;font-size:12px;">' +
    'The same room is used for every session.</p>' +
    '</div>'
  );
}

/**
 * Sends the announcement to the organizers only, so it can be checked before
 * it goes to the membership. Whoever runs it is included even if they are not
 * in CONFIG.NOTIFY_EMAILS, so the preview never lands somewhere they cannot see.
 */
function previewAnnouncement() {
  const ui = SpreadsheetApp.getUi();
  const sessions = getUpcomingSessions_();
  const recipients = getMemberRecipients_();
  const me = Session.getActiveUser().getEmail();
  const to = notifyRecipients_([me]);

  MailApp.sendEmail({
    to: to,
    subject: '[PREVIEW] SYVE upcoming schedule',
    htmlBody:
      '<p style="background:#fff3cd;padding:8px;border:1px solid #ffe08a;">' +
      'Preview only, sent to the organizers. If sent for real this would go to <strong>' +
      recipients.length +
      '</strong> members.</p>' +
      buildAnnouncementHtml_(sessions),
    name: CONFIG.SENDER_NAME,
    replyTo: CONFIG.CONTACT_EMAIL,
  });

  ui.alert(
    'Preview sent',
    'Sent to:\n' +
      to.split(',').join('\n') +
      '\n\nSessions included: ' +
      sessions.length +
      '\nMembers who would receive the real send: ' +
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
        replyTo: CONFIG.CONTACT_EMAIL,
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
