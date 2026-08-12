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

  // Accept yyyy/mm/dd and yyyy-mm-dd, the formats used in this workbook.
  const m = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return null;

  const parsed = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a cell value for display in an email.
 * Handles the three shapes Sheets returns: Date, number, and string.
 */
function formatValue_(value, kind) {
  if (value === null || value === undefined || value === '') return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    const pattern = kind === 'time' ? 'HH:mm' : 'yyyy/MM/dd';
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
