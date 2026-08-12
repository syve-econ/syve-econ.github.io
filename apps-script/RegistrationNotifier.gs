/**
 * Sends a notification to the SYVE inbox when a member registers to present.
 *
 * IMPORTANT: this must run from an INSTALLABLE onEdit trigger, not from a
 * function literally named onEdit. Simple triggers run without authorization
 * and are not allowed to send email, so a simple onEdit would fail silently.
 * Run installTriggers() once to wire this up.
 */
function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;

    const sheet = e.range.getSheet();
    if (!isScheduleSheet_(sheet)) return;

    const row = e.range.getRow();
    if (row <= CONFIG.HEADER_ROW) return;

    // Only react to the Status column.
    const headerMap = getHeaderMap_(sheet);
    const statusCol = resolveCol_(headerMap, CONFIG.HEADERS.status);
    if (!statusCol) return;
    if (e.range.getColumn() !== statusCol) return;

    // Multi-cell paste: e.value is undefined, so read the cell back.
    const newStatus = String(
      e.value !== undefined ? e.value : e.range.getValue()
    ).trim();
    if (!isTriggerStatus_(newStatus)) return;

    // Ignore a "change" that did not actually change the status.
    const oldStatus = String(e.oldValue === undefined ? '' : e.oldValue).trim();
    if (oldStatus.toLowerCase() === newStatus.toLowerCase()) return;

    const data = readScheduleRow_(sheet, row);
    const editor = e.user && e.user.getEmail ? e.user.getEmail() : '';

    sendRegistrationEmail_(data, editor);
  } catch (err) {
    // Never let an error surface as a broken edit; log it for review instead.
    console.error('onEditInstallable failed: ' + err.stack);
  }
}

/** True if the status value should trigger a notification. */
function isTriggerStatus_(status) {
  const needle = String(status).trim().toLowerCase();
  return CONFIG.TRIGGER_STATUSES.some(function (s) {
    return s.toLowerCase() === needle;
  });
}

/** Composes and sends the registration notification. */
function sendRegistrationEmail_(data, editorEmail) {
  const who = data.presenter || 'Unknown presenter';
  const what = data.title || 'Untitled paper';

  const subject =
    '[SYVE] ' + data.sheetName + ': ' + who + ' registered - ' + what;

  const when = [data.date, data.time].filter(Boolean).join(' at ') || 'TBD';

  const html =
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;' +
    'color:#222;line-height:1.5;">' +
    '<p>A new presentation slot was registered on the SYVE schedule.</p>' +
    '<table style="border-collapse:collapse;margin:16px 0;">' +
    detailRow_('Series', data.sheetName) +
    detailRow_('Presenter', who) +
    detailRow_('Paper', what) +
    detailRow_('Authors', data.authors) +
    detailRow_('Date & time', when) +
    detailRow_('Type', data.type) +
    detailRow_('Fields', data.fields) +
    detailRow_('Methodology', data.methodology) +
    detailRow_('Topic', data.topic) +
    detailRow_('Status', data.status) +
    detailRow_('Paper link', data.link, true) +
    detailRow_('Registered by', editorEmail) +
    '</table>' +
    '<p><a href="' +
    escapeHtml_(scheduleRowUrl_(data)) +
    '">Open this row in the schedule</a></p>' +
    '<p style="color:#888;font-size:12px;">Sent automatically by ' +
    escapeHtml_(CONFIG.SENDER_NAME) +
    '.</p>' +
    '</div>';

  MailApp.sendEmail({
    to: notifyRecipients_(),
    subject: subject,
    htmlBody: html,
    body: plainTextFallback_(data, when, editorEmail),
    name: CONFIG.SENDER_NAME,
  });
}

/** Deep link to the edited row. */
function scheduleRowUrl_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(data.sheetName);
  const gid = sheet ? sheet.getSheetId() : 0;
  return ss.getUrl() + '#gid=' + gid + '&range=A' + data.row;
}

/** Plain-text body for clients that do not render HTML. */
function plainTextFallback_(data, when, editorEmail) {
  return [
    'A new presentation slot was registered on the SYVE schedule.',
    '',
    'Series:      ' + data.sheetName,
    'Presenter:   ' + (data.presenter || '-'),
    'Paper:       ' + (data.title || '-'),
    'Authors:     ' + (data.authors || '-'),
    'Date & time: ' + when,
    'Type:        ' + (data.type || '-'),
    'Fields:      ' + (data.fields || '-'),
    'Methodology: ' + (data.methodology || '-'),
    'Topic:       ' + (data.topic || '-'),
    'Status:      ' + (data.status || '-'),
    'Paper link:  ' + (data.link || '-'),
    'Registered by: ' + (editorEmail || '-'),
  ].join('\n');
}

/**
 * Manual test: pretends the currently selected row was just registered and
 * sends the notification. Select any data row on a schedule tab, then run this.
 */
function testRegistrationEmailForSelectedRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = SpreadsheetApp.getActiveRange().getRow();
  const ui = SpreadsheetApp.getUi();

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

  sendRegistrationEmail_(readScheduleRow_(sheet, row), Session.getActiveUser().getEmail());
  ui.alert(
    'Test notification sent',
    'Sent to:\n' + CONFIG.NOTIFY_EMAILS.join('\n'),
    ui.ButtonSet.OK
  );
}
