# SYVE schedule automation (Google Apps Script)

Apps Script bound to the [schedule workbook](https://docs.google.com/spreadsheets/d/1altDTf844gViy_36GhwhlPsTjh_pMVfMjq7Ua4fZi7Y/edit).

Three things it does:

1. **Registration notification (automatic).** When a member sets a row's `Status`
   to `Registered` on a schedule tab, an email goes to the organizers with the
   presenter, paper, authors, date/time and link.
2. **Schedule announcement (manual).** Pulls every member email from the members
   directory and mails them the upcoming sessions. Preview first, then send.
3. **Session reminder (automatic).** 30 minutes before a session starts, the
   membership gets a reminder with the paper details and the Zoom block. See
   [Session reminders](#session-reminders).

Every email is signed with the society's name and
[website](https://syve-econ.github.io/) and carries the no-reply footer; that
block lives in `footerHtml_()` / `footerText_()` in `Common.gs` so all three
kinds of mail stay identical.

## Files

| File | Purpose |
|------|---------|
| `Config.gs` | All settings. This is normally the only file you edit. |
| `Common.gs` | Header lookup, value formatting, time math, HTML helpers, footer. |
| `RegistrationNotifier.gs` | The `onEdit` handler and the notification email. |
| `Announcements.gs` | Member lookup and the broadcast, with preview + confirm. |
| `Reminders.gs` | The 30-minute-before scan and the reminder email. |
| `Setup.gs` | Custom menu, trigger installation, setup check. |

## Install

1. Open the schedule workbook → **Extensions → Apps Script**.
2. Create six script files with the names above and paste in the contents.
   (Apps Script names them `.gs`; the editor adds the extension for you.)
3. **Save**, then reload the spreadsheet. A **SYVE** menu appears.
4. **SYVE → Install / repair triggers**. Approve the authorization prompt — it
   asks for Gmail send and spreadsheet access. Approve as the account that
   should appear as the sender. This installs both triggers: the edit handler
   and the reminder scan.
5. **SYVE → Add Status dropdown to schedule tabs** (optional but recommended —
   it stops typos from silently failing to trigger anything).
6. **SYVE → Check setup** to confirm tabs, columns, trigger and quota.

## Why an installable trigger

A function literally named `onEdit` is a *simple* trigger. Simple triggers run
without authorization and **cannot send email** — the handler would run and fail
silently, which is the usual reason this pattern appears broken. So the handler
here is named `onEditInstallable` and is registered by `installTriggers()` as an
installable trigger, which runs with full authorization.

## Configuration notes

- `SCHEDULE_SHEETS` must match your tab names **exactly**. Update it if you
  rename a tab. Current tabs in the workbook:

  | gid | Tab | Used by the script |
  |-----|-----|--------------------|
  | 0 | `Innovation & growth` | yes |
  | 1897452861 | `Applied Micro` | yes |
  | 1094562378 | `Geoeconomics` | yes |
  | 768851018 | `WP seminars` | yes |

- The four schedule tabs do **not** have identical columns, and none of this
  matters to the script, which matches columns by header text and never by
  position:

  | Tab | Notable differences |
  |-----|---------------------|
  | `Innovation & growth` | the baseline shape |
  | `Applied Micro` | no `Authors`; the paper is `Paper`, not `Title`; adds `Methodology`, `Level`, `Topic` before it |
  | `Geoeconomics` | same as the baseline |
  | `WP seminars` | extra `Fields` column, which shifts everything after it |

- Required on every schedule tab: `Title` (or `Paper`), `Presenter`, `Status`,
  `Date`. Everything else is optional and simply omitted from emails when
  absent. `Authors` is optional precisely because Applied Micro has none.
- A field can accept several header spellings. `CONFIG.HEADERS` maps each
  logical field to a list of accepted names, first match wins - that is how
  `Paper` and `Title` both work. Add a spelling to the list rather than
  renaming a column in the sheet.

## Zoom details

The standing Zoom room is stored in **Script Properties**, not in this file,
because this repository is public and a join link plus passcode in public source
would let anyone into the meeting.

Set them once with **SYVE → Set Zoom details**. They then appear in a single
"Join" block in every announcement. Until they are set, the block is omitted.
- The Applied Microeconomics tab is deliberately excluded: it is a topic reading
  list (`Methodology / Level / Topic / Paper / Link`), not a session schedule, so
  it has no `Status`, `Presenter` or `Date` column to work from.
- Columns are resolved **by header name**, not by letter, so inserting or
  reordering columns will not break anything. Renaming a header will — update
  `CONFIG.HEADERS` to match.
- `NOTIFY_EMAIL` is the destination for registration notifications.
- `ZOOM_LINK` is empty by default; set it to include a Zoom row in announcements.

## Session reminders

30 minutes before a session starts, everyone in the members directory gets a
reminder: presenter, paper, authors, start time, links, and the standing Zoom
block. Nothing to press — it runs on a time-driven trigger.

**A row is only reminded about when it has both a `Date` and a `Time`.** A
session with `Time` blank is still announced (shown as `TBD`), but there is
nothing to count 30 minutes back from, so no reminder is possible.
**SYVE → Check setup** lists every upcoming session in that state, and it is
worth reading before the week starts. Times are read from real time cells and
from text like `20:00`, `20h`, `8pm` or `8:15 PM`.

### How it works

A trigger runs every 5 minutes, looks for sessions starting within the next 30,
and mails them. One reminder per session is enforced by a log in Script
Properties keyed by tab, row **and start time** — so moving a session to a new
slot earns it a fresh reminder, while re-saving the same row does not.

Per-session one-off triggers would be the obvious alternative, but a script may
hold only 20 triggers at once and every date edit would have to add or move one.

### Settings

All of it is `CONFIG.REMINDER` in `Config.gs`:

| Key | Meaning |
|-----|---------|
| `ENABLED` | Master switch. `false` stops reminders without deleting the trigger. |
| `LEAD_MINUTES` | How far ahead to send. Default 30. |
| `CHECK_EVERY_MINUTES` | Scan interval. Apps Script allows only 1, 5, 10, 15, 30. |
| `AUDIENCE` | `members` (default), `presenter` (organizers + the presenter, matched by name against the directory), or `organizers`. |
| `KEEP_RECORD_DAYS` | How long log entries survive before pruning. |

`AUDIENCE: 'organizers'` is the way to run it in test mode for a few weeks
before pointing it at the membership.

### Timezone

Start times are wall-clock times in `CONFIG.TIMEZONE`. The **spreadsheet**
timezone (File → Settings) and the **Apps Script project** timezone (Project
settings) must match it, or every reminder is off by the difference between
them. **Check setup** compares all three and says so if they diverge.

### Menu items

| Item | What it does |
|------|--------------|
| Send test reminder (selected row, to me only) | Sends you the real reminder for the selected row and reports how many people the live one would reach. Writes nothing to the log, so the real reminder still goes out on time. |
| Run reminder check now | Runs the scan immediately and reports what it found. Sends for real if something is genuinely due. |
| Clear reminder history | Forgets what has been sent. Anything still inside its 30-minute window will be reminded about again — for testing. |

## Sending limits

`MailApp` allows 100 recipients/day on a consumer Gmail account and 1,500/day on
Workspace. The membership is well under both. `sendAnnouncementToAllMembers()`
checks the remaining quota before sending and refuses rather than sending a
partial batch.

Announcements and reminders are sent one message per member, so nobody sees
anyone else's address. Both count against the same daily quota: a 40-member
list costs 40 messages per announcement and 40 per session reminded. The
reminder scan checks the remaining quota before it starts and skips the send
rather than mailing half the list — and because it did not record the send, the
next scan tries again a few minutes later.

## Testing without waiting for a real edit

Select any data row on a schedule tab and run
**SYVE → Send test registration email (selected row)**. It composes and sends the
same notification the trigger would.
