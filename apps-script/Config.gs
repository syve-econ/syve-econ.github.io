/**
 * SYVE schedule automation - configuration.
 *
 * Everything you are likely to change lives in this file. The other files
 * should not need editing for day-to-day use.
 */

const CONFIG = {
  /** Where registration notifications are sent. */
  NOTIFY_EMAIL: 'syve.info@gmail.com',

  /** Shown as the sender name on outgoing mail. */
  SENDER_NAME: 'SYVE Schedule Bot',

  /**
   * Tabs in THIS workbook that hold a session schedule.
   * Names must match the tab names exactly. The Applied Microeconomics tab is
   * intentionally absent: it is a topic reading list, not a session schedule,
   * so it has none of the columns below.
   */
  SCHEDULE_SHEETS: [
    'Innovation & growth',
    'Applied Micro',
    'Geoeconomics',
    'WP seminars',
  ],

  /**
   * Column headers used on the schedule tabs (row 1). Columns are looked up by
   * these names, so reordering or inserting columns in the sheet is safe, and
   * a column that exists on only some tabs is simply skipped.
   *
   * The three schedule tabs genuinely differ: "Fields" exists only on
   * WP seminars, and "Recordings" is not currently on any tab but is kept here
   * so it starts working automatically if it is added back.
   */
  HEADERS: {
    authors: ['Authors'],
    // Applied Micro calls the paper column "Paper"; the others use "Title".
    title: ['Title', 'Paper'],
    type: ['Type'],
    fields: ['Fields'],
    methodology: ['Methodology'],
    topic: ['Topic'],
    presenter: ['Presenter'],
    status: ['Status'],
    date: ['Date'],
    slides: ['Slides'],
    time: ['Time'],
    recordings: ['Recordings'],
    link: ['Link'],
  },

  /**
   * Columns every schedule tab must have. Anything in HEADERS but not here is
   * optional, and "Check setup" will not report it as a problem when absent.
   *
   * Authors is NOT required: Applied Micro has no such column.
   */
  REQUIRED_HEADERS: ['title', 'presenter', 'status', 'date'],

  /**
   * Editing the Status cell to one of these values sends the notification.
   * Compared case-insensitively. Run installStatusDropdown() to add these as a
   * dropdown on the Status column.
   */
  TRIGGER_STATUSES: ['Registered', 'Scheduled'],

  /**
   * Full set of values offered by the Status dropdown.
   * "Preparing" and "Presented" are already in use in the workbook and are
   * kept so existing rows stay valid.
   */
  ALL_STATUSES: ['Registered', 'Preparing', 'Scheduled', 'Presented', 'Cancelled'],

  /** Row 1 is the header row; data starts on row 2. */
  HEADER_ROW: 1,

  /** The members directory (a separate spreadsheet). */
  MEMBERS: {
    SPREADSHEET_ID: '1OBRQK9dQeH7yz9ulqSijQxGAXVVLyUz2jqAzBGsIkvs',
    SHEET_GID: 2142465311,
    NAME_HEADER: 'Full name',
    /** Exact match. The directory also has a separate "Email Address" column. */
    EMAIL_HEADER: 'Email',
  },

  /**
   * Zoom details for announcements.
   *
   * These are NOT stored in this file on purpose: this script is versioned in a
   * public GitHub repository, and a join link plus passcode in public source
   * lets anyone drop into the meeting. They live in Script Properties instead,
   * which are private to this Apps Script project.
   *
   * Set them once with: SYVE -> Set Zoom details.
   */
  ZOOM_KEYS: {
    link: 'ZOOM_LINK',
    meetingId: 'ZOOM_MEETING_ID',
    passcode: 'ZOOM_PASSCODE',
  },

  /** Timezone used to format dates in emails. */
  TIMEZONE: 'Asia/Ho_Chi_Minh',
};
