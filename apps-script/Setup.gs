/**
 * Menu and one-time setup for the SYVE schedule automation.
 */

/** Simple trigger: builds the custom menu when the spreadsheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SYVE')
    .addItem('Send test registration email (selected row)', 'testRegistrationEmailForSelectedRow')
    .addSeparator()
    .addItem('Preview announcement (to me only)', 'previewAnnouncement')
    .addItem('Send announcement to all members', 'sendAnnouncementToAllMembers')
    .addSeparator()
    .addItem('Install / repair triggers', 'installTriggers')
    .addItem('Add Status dropdown to schedule tabs', 'installStatusDropdown')
    .addItem('Check setup', 'checkSetup')
    .addToUi();
}

/**
 * Creates the installable onEdit trigger. Safe to run repeatedly: existing
 * triggers for the same handler are removed first, so it never doubles up.
 */
function installTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'onEditInstallable') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    'Trigger installed',
    'Registration notifications will now be sent to ' + CONFIG.NOTIFY_EMAIL + '.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** Adds a Status dropdown to the Status column of every schedule tab. */
function installStatusDropdown() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.ALL_STATUSES, true)
    .setAllowInvalid(false)
    .build();

  const done = [];

  CONFIG.SCHEDULE_SHEETS.forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;

    const headerMap = getHeaderMap_(sheet);
    const statusCol = headerMap[CONFIG.HEADERS.status.trim().toLowerCase()];
    if (!statusCol) return;

    const numRows = Math.max(sheet.getMaxRows() - CONFIG.HEADER_ROW, 1);
    sheet
      .getRange(CONFIG.HEADER_ROW + 1, statusCol, numRows, 1)
      .setDataValidation(rule);
    done.push(name);
  });

  SpreadsheetApp.getUi().alert(
    'Status dropdown added',
    done.length ? 'Updated: ' + done.join(', ') : 'No matching tabs were found.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** Reports whether the configuration matches the actual sheets. */
function checkSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lines = [];

  lines.push('SCHEDULE TABS');
  CONFIG.SCHEDULE_SHEETS.forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) {
      lines.push('  MISSING: "' + name + '"');
      return;
    }
    const headerMap = getHeaderMap_(sheet);
    const missing = Object.keys(CONFIG.HEADERS).filter(function (key) {
      return !headerMap[CONFIG.HEADERS[key].trim().toLowerCase()];
    });
    lines.push(
      '  OK: "' + name + '"' +
        (missing.length ? ' - missing columns: ' + missing.join(', ') : '')
    );
  });

  lines.push('');
  lines.push('TRIGGER');
  const installed = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'onEditInstallable';
  });
  lines.push(
    installed.length
      ? '  OK: ' + installed.length + ' installable onEdit trigger(s)'
      : '  MISSING: run "Install / repair triggers"'
  );

  lines.push('');
  lines.push('MEMBERS DIRECTORY');
  try {
    lines.push('  OK: ' + getMemberRecipients_().length + ' valid email addresses');
  } catch (err) {
    lines.push('  ERROR: ' + err.message);
  }

  lines.push('');
  lines.push('EMAIL QUOTA');
  lines.push('  ' + MailApp.getRemainingDailyQuota() + ' messages left today');

  SpreadsheetApp.getUi().alert('SYVE setup check', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}
