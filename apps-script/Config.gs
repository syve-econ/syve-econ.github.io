/**
 * SYVE schedule automation - configuration.
 *
 * Everything you are likely to change lives in this file. The other files
 * should not need editing for day-to-day use.
 */

const CONFIG = {
  /**
   * Bumped whenever these files change. "Check setup" prints it, so you can
   * confirm the Apps Script project is running the version you think it is
   * after re-pasting.
   */
  VERSION: '2026-08-13a',

  /**
   * Organizers who receive registration notifications and announcement
   * previews. Add or remove addresses here; everything else follows.
   */
  NOTIFY_EMAILS: [
    'syve.info@gmail.com',
    'quangthanhtran.econ@gmail.com',
    'manhduc.doan03@gmail.com',
  ],

  /**
   * Shown as the sender name on outgoing mail, and used as the signature in
   * the footer of every email. One name, one place to change it.
   */
  SENDER_NAME: 'The Society of Young Vietnamese Economists',

  /** Public site, shown under the signature. Leave blank to omit the line. */
  WEBSITE_URL: 'https://syve-econ.github.io/',

  /**
   * Where to direct questions. Used in the no-reply footer and set as the
   * Reply-To header, so a reply still reaches the society rather than the
   * personal account that authorized the script.
   */
  CONTACT_EMAIL: 'syve.info@gmail.com',

  /**
   * Tabs in THIS workbook that hold a session schedule.
   * Names must match the tab names exactly.
   *
   * These four do not share one column layout, which is fine: columns are
   * matched by header text, never by position. See HEADERS below.
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
  TRIGGER_STATUSES: ['Registered'],

  /**
   * Full set of values offered by the Status dropdown.
   * "Preparing" and "Presented" are already in use in the workbook and are
   * kept so existing rows stay valid.
   */
  ALL_STATUSES: ['Registered', 'Preparing', 'Presented', 'Cancelled'],

  /**
   * Statuses that mean a session is over or called off, so it is left out of
   * announcements no matter what its date says. Everything else with a
   * presenter counts as upcoming.
   */
  FINISHED_STATUSES: ['Presented', 'Cancelled'],

  /** Shown wherever a date or time has not been filled in yet. */
  TBD_LABEL: 'TBD',

  /**
   * Automatic reminder sent shortly before a session starts.
   *
   * A time-driven trigger runs every CHECK_EVERY_MINUTES, looks for sessions
   * starting within the next LEAD_MINUTES, and mails them once. "Once" is
   * enforced by a log kept in Script Properties, keyed by row AND start time,
   * so moving a session to a new slot earns it a fresh reminder.
   *
   * A row is only ever reminded when it has BOTH a date and a readable time.
   * A session with Time blank cannot be reminded about - there is nothing to
   * count back from. "Check setup" lists any upcoming session in that state.
   */
  REMINDER: {
    /** Master switch. Set false to stop reminders without deleting anything. */
    ENABLED: true,

    /** How long before the start time the reminder goes out. */
    LEAD_MINUTES: 30,

    /**
     * How often the scan runs. Apps Script only accepts 1, 5, 10, 15 or 30
     * here. Five means a reminder lands 25-30 minutes ahead, never late.
     */
    CHECK_EVERY_MINUTES: 5,

    /**
     * Who gets it:
     *   'members'    - everyone in the members directory (same as announcements)
     *   'presenter'  - the organizers plus the presenter, matched by name
     *                  against the members directory
     *   'organizers' - the organizers only; useful for a few weeks of
     *                  test running before pointing it at the membership
     */
    AUDIENCE: 'members',

    /** Script Property holding the "already reminded" log. */
    SENT_KEY: 'REMINDERS_SENT',

    /** How long a log entry is kept after its session, before pruning. */
    KEEP_RECORD_DAYS: 3,
  },

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

  /** How dates are written in emails. Java-style pattern, as Utilities wants. */
  DATE_FORMAT: 'dd/MM/yyyy',

  /** How the Date column is displayed in the sheet. Sheets-style pattern. */
  SHEET_DATE_FORMAT: 'dd/mm/yyyy',

  /** How times are written in emails. */
  TIME_FORMAT: 'HH:mm',
};
