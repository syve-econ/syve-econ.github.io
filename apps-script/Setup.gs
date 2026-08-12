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
    .addItem('Set Zoom details', 'setZoomDetails')
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
    'Registration notifications will now be sent to:\n' +
      CONFIG.NOTIFY_EMAILS.join('\n'),
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
    const statusCol = resolveCol_(headerMap, CONFIG.HEADERS.status);
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

/**
 * Stores the standing Zoom details in Script Properties.
 *
 * Kept out of source on purpose: this script is versioned in a public
 * repository, and a join link plus passcode there would let anyone into the
 * meeting. Script Properties are private to this Apps Script project.
 */
function setZoomDetails() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const keys = CONFIG.ZOOM_KEYS;
  const current = getZoomDetails_();

  const prompts = [
    { key: keys.link, label: 'Zoom join link', now: current.link },
    { key: keys.meetingId, label: 'Meeting ID', now: current.meetingId },
    { key: keys.passcode, label: 'Passcode', now: current.passcode },
  ];

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    const response = ui.prompt(
      'Set Zoom details (' + (i + 1) + ' of ' + prompts.length + ')',
      p.label + (p.now ? '\n\nCurrent: ' + p.now : '') + '\n\nLeave blank to keep the current value.',
      ui.ButtonSet.OK_CANCEL
    );
    if (response.getSelectedButton() !== ui.Button.OK) return;

    const value = response.getResponseText().trim();
    if (value) props.setProperty(p.key, value);
  }

  const saved = getZoomDetails_();
  ui.alert(
    'Zoom details saved',
    'Link:       ' + (saved.link || '(not set)') +
      '\nMeeting ID: ' + (saved.meetingId || '(not set)') +
      '\nPasscode:   ' + (saved.passcode || '(not set)') +
      '\n\nThese appear in announcement emails only.',
    ui.ButtonSet.OK
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
    const missing = CONFIG.REQUIRED_HEADERS.filter(function (key) {
      return !resolveCol_(headerMap, CONFIG.HEADERS[key]);
    });
    lines.push(
      missing.length
        ? '  PROBLEM: "' + name + '" is missing required columns: ' + missing.join(', ')
        : '  OK: "' + name + '"'
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
