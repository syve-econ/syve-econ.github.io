/**
 * Shared helpers for the SYVE schedule automation.
 */

/**
 * Maps header name -> 1-based column index for a sheet's header row.
 * Header text is trimmed and compared case-insensitively.
 */
function getHeaderMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};

  const headers = sheet
    .getRange(CONFIG.HEADER_ROW, 1, 1, lastCol)
    .getValues()[0];

  const map = {};
  headers.forEach(function (header, i) {
    const key = String(header).trim().toLowerCase();
    // First occurrence wins, so a stray duplicate header later on is ignored.
    if (key && !(key in map)) map[key] = i + 1;
  });
  return map;
}

/**
 * Resolves a logical field to a 1-based column index.
 *
 * `names` is the list of accepted header spellings from CONFIG.HEADERS; the
 * first one present on the sheet wins. This is what lets Applied Micro call its
 * paper column "Paper" while the other tabs call it "Title".
 *
 * Returns 0 when the sheet has none of them.
 */
function resolveCol_(headerMap, names) {
  const candidates = Array.isArray(names) ? names : [names];
  for (let i = 0; i < candidates.length; i++) {
    const col = headerMap[String(candidates[i]).trim().toLowerCase()];
    if (col) return col;
  }
  return 0;
}

/**
 * Picks one field out of an already-read row of values.
 * `values` is 0-indexed; the header map is 1-indexed.
 */
function pickField_(headerMap, values, names) {
  const col = resolveCol_(headerMap, names);
  if (!col) return '';
  const value = values[col - 1];
  return value === undefined ? '' : value;
}

/**
 * Coerces a cell value to a Date, accepting both real date cells and text that
 * looks like a date. Returns null if it cannot be read as one.
 */
function toDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : value;
  }
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) return null;

  // Year first: 2026/09/12 or 2026-09-12.
  const iso = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) {
    return validDate_(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // Year last: read as DAY first, matching CONFIG.SHEET_DATE_FORMAT.
  // 05/06/2026 is 5 June, not 6 May.
  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirst) {
    return validDate_(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  }

  return null;
}

/**
 * Builds a Date from parts, rejecting values that JavaScript would silently
 * roll over (month 13, 31 February, and so on).
 */
function validDate_(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day);
  if (isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

/**
 * Formats a cell value for display in an email.
 * Handles the three shapes Sheets returns: Date, number, and string.
 */
function formatValue_(value, kind) {
  if (value === null || value === undefined || value === '') return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    const pattern =
      kind === 'time' ? CONFIG.TIME_FORMAT : CONFIG.DATE_FORMAT;
    return Utilities.formatDate(value, CONFIG.TIMEZONE, pattern);
  }

  return String(value).trim();
}

/** True if the sheet is one of the configured schedule tabs. */
function isScheduleSheet_(sheet) {
  return CONFIG.SCHEDULE_SHEETS.indexOf(sheet.getName()) !== -1;
}

/** Finds a sheet by its gid, in any spreadsheet. Returns null if absent. */
function getSheetByGid_(spreadsheet, gid) {
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  return null;
}

/** Escapes text for safe interpolation into an HTML email body. */
function escapeHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds a session object from a row of already-read cell values.
 * This is the single place the sheet's columns are mapped to field names.
 */
function rowFromValues_(sheetName, rowNumber, headerMap, values) {
  const h = CONFIG.HEADERS;
  const pick = function (headerName) {
    return pickField_(headerMap, values, headerName);
  };

  return {
    sheetName: sheetName,
    row: rowNumber,
    authors: formatValue_(pick(h.authors)),
    title: formatValue_(pick(h.title)),
    type: formatValue_(pick(h.type)),
    fields: formatValue_(pick(h.fields)),
    methodology: formatValue_(pick(h.methodology)),
    topic: formatValue_(pick(h.topic)),
    presenter: formatValue_(pick(h.presenter)),
    status: formatValue_(pick(h.status)),
    date: formatValue_(pick(h.date), 'date'),
    slides: formatValue_(pick(h.slides)),
    time: formatValue_(pick(h.time), 'time'),
    recordings: formatValue_(pick(h.recordings)),
    link: formatValue_(pick(h.link)),
    dateValue: toDate_(pick(h.date)),
  };
}

/**
 * Reads one row of a schedule sheet in a single call.
 * Used by the edit trigger, where only the edited row matters.
 */
function readScheduleRow_(sheet, row) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return rowFromValues_(sheet.getName(), row, {}, []);

  const headerMap = getHeaderMap_(sheet);
  const values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  return rowFromValues_(sheet.getName(), row, headerMap, values);
}

/**
 * Reads every data row of a schedule sheet in ONE call.
 *
 * Used by the announcement builder. Reading cell by cell there meant roughly a
 * dozen round-trips per row, which across 50+ rows on three tabs was slow
 * enough to risk the execution time limit.
 */
function readAllScheduleRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= CONFIG.HEADER_ROW || lastCol < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  const headerMap = {};
  values[CONFIG.HEADER_ROW - 1].forEach(function (header, i) {
    const key = String(header).trim().toLowerCase();
    if (key && !(key in headerMap)) headerMap[key] = i + 1;
  });

  const rows = [];
  for (let i = CONFIG.HEADER_ROW; i < values.length; i++) {
    rows.push(rowFromValues_(sheet.getName(), i + 1, headerMap, values[i]));
  }
  return rows;
}

/**
 * Renders a date and time for display, falling back to TBD for whichever part
 * has not been filled in yet.
 *
 *   both        -> "2026/09/12 at 20:00"
 *   date only   -> "2026/09/12 at TBD"
 *   time only   -> "TBD at 20:00"
 *   neither     -> "TBD"
 */
function formatWhen_(date, time) {
  if (!date && !time) return CONFIG.TBD_LABEL;
  return (
    (date || CONFIG.TBD_LABEL) + ' at ' + (time || CONFIG.TBD_LABEL)
  );
}

/**
 * Reads a time-of-day cell into {hours, minutes}, or null when it cannot be
 * read as a time.
 *
 * A Time cell that Sheets stores as a real time has already been rendered to
 * "HH:mm" by formatValue_ before it gets here. The looser spellings below are
 * for tabs where the column is plain text: "20:00", "20h", "20h00", "8:00 PM",
 * "8pm", "2000".
 */
function parseTimeOfDay_(value) {
  const text = String(value === undefined || value === null ? '' : value)
    .trim()
    .toLowerCase();
  if (!text) return null;

  const match = text.match(/^(\d{1,2})\s*[:h.]?\s*(\d{2})?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  const suffix = match[3];

  if (suffix === 'pm' && hours < 12) hours += 12;
  if (suffix === 'am' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  return { hours: hours, minutes: minutes };
}

/**
 * Converts wall-clock parts into a comparable number of minutes.
 *
 * Date.UTC is used deliberately, and NOT because these are UTC times: it is
 * simply an arithmetic that ignores whatever timezone the script happens to
 * run in. Subtracting two of these gives the true gap in minutes as long as
 * both were built from the same timezone's wall clock, which is what the
 * reminder needs. Vietnam has no DST, so there is no discontinuity to handle.
 */
function wallMinutes_(year, month, day, hours, minutes) {
  return Date.UTC(year, month - 1, day, hours, minutes) / 60000;
}

/** Now, as wall-clock minutes in CONFIG.TIMEZONE. */
function nowWallMinutes_() {
  const parts = Utilities.formatDate(
    new Date(),
    CONFIG.TIMEZONE,
    'yyyy-MM-dd-HH-mm'
  ).split('-');

  return wallMinutes_(
    Number(parts[0]),
    Number(parts[1]),
    Number(parts[2]),
    Number(parts[3]),
    Number(parts[4])
  );
}

/**
 * When a session starts, as wall-clock minutes in CONFIG.TIMEZONE.
 * Returns null when the row has no date, or no time that can be read as one -
 * in which case there is nothing to count 30 minutes back from.
 */
function sessionStartMinutes_(data) {
  if (!data.dateValue) return null;

  const timeOfDay = parseTimeOfDay_(data.time);
  if (!timeOfDay) return null;

  const ymd = Utilities.formatDate(
    data.dateValue,
    CONFIG.TIMEZONE,
    'yyyy-MM-dd'
  ).split('-');

  return wallMinutes_(
    Number(ymd[0]),
    Number(ymd[1]),
    Number(ymd[2]),
    timeOfDay.hours,
    timeOfDay.minutes
  );
}

/** True if the status means the session is over or called off. */
function isFinishedStatus_(status) {
  const needle = String(status || '').trim().toLowerCase();
  if (!needle) return false;
  return CONFIG.FINISHED_STATUSES.some(function (s) {
    return s.toLowerCase() === needle;
  });
}

/**
 * The signature and no-reply footer, defined once so every outgoing email
 * carries the same wording: who sent it, where to read more, and why replying
 * to it is pointless.
 */
function footerHtml_() {
  const contact = escapeHtml_(CONFIG.CONTACT_EMAIL);
  const site = String(CONFIG.WEBSITE_URL || '').trim();
  const siteLine = site
    ? '<br><a href="' + escapeHtml_(site) + '">' + escapeHtml_(site) + '</a>'
    : '';

  return (
    '<p style="color:#555;font-size:12px;margin-top:24px;' +
    'border-top:1px solid #eee;padding-top:12px;">' +
    '<strong>' + escapeHtml_(CONFIG.SENDER_NAME) + '</strong>' +
    siteLine +
    '</p>' +
    '<p style="color:#888;font-size:12px;margin-top:8px;">' +
    'This email was sent automatically. Please do not reply.<br>' +
    'If you have any inquiry, please contact ' +
    '<a href="mailto:' + contact + '">' + contact + '</a>.' +
    '</p>'
  );
}

/** Plain-text version of the signature and no-reply footer. */
function footerText_() {
  const site = String(CONFIG.WEBSITE_URL || '').trim();
  return (
    '\n\n--\n' +
    CONFIG.SENDER_NAME + '\n' +
    (site ? site + '\n' : '') +
    '\n' +
    'This email was sent automatically. Please do not reply.\n' +
    'If you have any inquiry, please contact ' + CONFIG.CONTACT_EMAIL + '.'
  );
}

/** Basic shape check, enough to keep malformed cells out of a recipient list. */
function isValidEmail_(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim());
}

/**
 * The organizer addresses, as the comma-separated string MailApp expects.
 * Blank and duplicate entries are dropped so a stray edit to CONFIG cannot
 * produce an invalid recipient list.
 */
function notifyRecipients_(extraEmails) {
  // A stale Config.gs is the usual cause: NOTIFY_EMAIL (singular) was replaced
  // by NOTIFY_EMAILS (a list). Say so, rather than failing on undefined.
  if (!Array.isArray(CONFIG.NOTIFY_EMAILS)) {
    throw new Error(
      'CONFIG.NOTIFY_EMAILS is missing or is not a list. Config.gs is out of ' +
        'date - re-paste it, then reload the spreadsheet.'
    );
  }

  const all = CONFIG.NOTIFY_EMAILS.concat(extraEmails || []);
  const seen = {};
  const clean = [];

  all.forEach(function (email) {
    const trimmed = String(email || '').trim();
    if (!isValidEmail_(trimmed)) return;

    const key = trimmed.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    clean.push(trimmed);
  });

  if (!clean.length) {
    throw new Error('No valid address in CONFIG.NOTIFY_EMAILS.');
  }

  return clean.join(',');
}

/**
 * Reads the Zoom details from Script Properties.
 * Returns {link, meetingId, passcode}; any unset value comes back as ''.
 */
function getZoomDetails_() {
  const props = PropertiesService.getScriptProperties();
  const keys = CONFIG.ZOOM_KEYS;
  return {
    link: props.getProperty(keys.link) || '',
    meetingId: props.getProperty(keys.meetingId) || '',
    passcode: props.getProperty(keys.passcode) || '',
  };
}

/** Renders a label/value pair as an HTML table row, skipping empty values. */
function detailRow_(label, value, asLink) {
  if (!value) return '';
  const shown = asLink && /^https?:\/\//i.test(value)
    ? '<a href="' + escapeHtml_(value) + '">' + escapeHtml_(value) + '</a>'
    : escapeHtml_(value);

  return (
    '<tr>' +
    '<td style="padding:4px 12px 4px 0;vertical-align:top;color:#555;">' +
    escapeHtml_(label) +
    '</td>' +
    '<td style="padding:4px 0;vertical-align:top;"><strong>' +
    shown +
    '</strong></td>' +
    '</tr>'
  );
}
