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
    .addItem('Format dates as dd/mm/yyyy', 'formatDatesDayFirst')
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

/**
 * Displays the Date column of every schedule tab as dd/mm/yyyy.
 *
 * This changes presentation only; the underlying date values are untouched, so
 * nothing that already works can break.
 *
 * It also offers to switch the spreadsheet locale to United Kingdom. That
 * matters: the number format controls how a date is SHOWN, while the locale
 * controls how a typed date is READ. Change only the format and the sheet
 * displays 05/06/2026 day-first while still interpreting what you type
 * month-first, which is worse than either setting alone.
 */
function formatDatesDayFirst() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const done = [];
  const skipped = [];

  CONFIG.SCHEDULE_SHEETS.forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) {
      skipped.push(name + ' (tab not found)');
      return;
    }

    const dateCol = resolveCol_(getHeaderMap_(sheet), CONFIG.HEADERS.date);
    if (!dateCol) {
      skipped.push(name + ' (no Date column)');
      return;
    }

    const numRows = Math.max(sheet.getMaxRows() - CONFIG.HEADER_ROW, 1);
    sheet
      .getRange(CONFIG.HEADER_ROW + 1, dateCol, numRows, 1)
      .setNumberFormat(CONFIG.SHEET_DATE_FORMAT);
    done.push(name);
  });

  const locale = ss.getSpreadsheetLocale();
  let localeNote = 'Spreadsheet locale: ' + locale;

  if (locale !== 'en_GB') {
    const answer = ui.alert(
      'Also read typed dates day-first?',
      'The Date columns now DISPLAY as dd/mm/yyyy.\n\n' +
        'The spreadsheet locale is still ' + locale + ', so a date typed as\n' +
        '05/06/2026 may be read as 6 May rather than 5 June.\n\n' +
        'Switch the locale to United Kingdom so typing matches the display?\n' +
        '(This can affect number and currency formatting too.)',
      ui.ButtonSet.YES_NO
    );
    if (answer === ui.Button.YES) {
      ss.setSpreadsheetLocale('en_GB');
      localeNote = 'Spreadsheet locale changed to en_GB.';
    } else {
      localeNote =
        'Locale left as ' + locale + '. Type dates as dd/mm/yyyy with care, ' +
        'or enter them from the date picker.';
    }
  }

  ui.alert(
    'Date format updated',
    'Set to ' + CONFIG.SHEET_DATE_FORMAT + ' on:\n  ' +
      (done.length ? done.join('\n  ') : '(none)') +
      (skipped.length ? '\n\nSkipped:\n  ' + skipped.join('\n  ') : '') +
      '\n\n' + localeNote +
      '\n\nEmails use ' + CONFIG.DATE_FORMAT + ' to match.',
    ui.ButtonSet.OK
  );
}

/** Reports whether the configuration matches the actual sheets. */
function checkSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lines = [];

  lines.push('VERSION');
  lines.push('  Config.gs: ' + (CONFIG.VERSION || 'unknown - Config.gs is out of date'));
  lines.push('');

  lines.push('NOTIFICATIONS GO TO');
  try {
    lines.push('  ' + notifyRecipients_().split(',').join('\n  '));
  } catch (err) {
    lines.push('  ERROR: ' + err.message);
  }
  lines.push('');

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
