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

/** Reads one field from a row using the configured header name. */
function readField_(sheet, headerMap, row, headerName) {
  const col = headerMap[String(headerName).trim().toLowerCase()];
  if (!col) return '';
  return sheet.getRange(row, col).getValue();
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
 * Reads the whole row of a schedule sheet into a plain object keyed by the
 * logical field names in CONFIG.HEADERS.
 */
function readScheduleRow_(sheet, row) {
  const headerMap = getHeaderMap_(sheet);
  const h = CONFIG.HEADERS;

  return {
    sheetName: sheet.getName(),
    row: row,
    authors: formatValue_(readField_(sheet, headerMap, row, h.authors)),
    title: formatValue_(readField_(sheet, headerMap, row, h.title)),
    type: formatValue_(readField_(sheet, headerMap, row, h.type)),
    presenter: formatValue_(readField_(sheet, headerMap, row, h.presenter)),
    status: formatValue_(readField_(sheet, headerMap, row, h.status)),
    date: formatValue_(readField_(sheet, headerMap, row, h.date), 'date'),
    slides: formatValue_(readField_(sheet, headerMap, row, h.slides)),
    time: formatValue_(readField_(sheet, headerMap, row, h.time), 'time'),
    recordings: formatValue_(readField_(sheet, headerMap, row, h.recordings)),
    link: formatValue_(readField_(sheet, headerMap, row, h.link)),
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
