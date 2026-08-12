# SYVE schedule automation (Google Apps Script)

Apps Script bound to the [schedule workbook](https://docs.google.com/spreadsheets/d/1altDTf844gViy_36GhwhlPsTjh_pMVfMjq7Ua4fZi7Y/edit).

Two things it does:

1. **Registration notification (automatic).** When a member sets a row's `Status`
   to `Registered` or `Scheduled` on a schedule tab, an email goes to
   `syve.info@gmail.com` with the presenter, paper, authors, date/time and link.
2. **Schedule announcement (manual).** Pulls every member email from the members
   directory and mails them the upcoming sessions. Preview first, then send.

## Files

| File | Purpose |
|------|---------|
| `Config.gs` | All settings. This is normally the only file you edit. |
| `Common.gs` | Header lookup, value formatting, HTML helpers. |
| `RegistrationNotifier.gs` | The `onEdit` handler and the notification email. |
| `Announcements.gs` | Member lookup and the broadcast, with preview + confirm. |
| `Setup.gs` | Custom menu, trigger installation, setup check. |

## Install

1. Open the schedule workbook → **Extensions → Apps Script**.
2. Create five script files with the names above and paste in the contents.
   (Apps Script names them `.gs`; the editor adds the extension for you.)
3. **Save**, then reload the spreadsheet. A **SYVE** menu appears.
4. **SYVE → Install / repair triggers**. Approve the authorization prompt — it
   asks for Gmail send and spreadsheet access. Approve as the account that
   should appear as the sender.
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
  | 1897452861 | `Applied Micro` | no - reading list, not a schedule |
  | 1094562378 | `Geoeconomics` | yes |
  | 768851018 | `WP seminars` | yes |

- The three schedule tabs do **not** have identical columns. `WP seminars` has
  an extra `Fields` column, which shifts everything after it. This is fine:
  columns are matched by header text, never by position.
- Required on every schedule tab: `Authors`, `Title`, `Presenter`, `Status`,
  `Date`. Everything else (`Type`, `Fields`, `Time`, `Slides`, `Link`,
  `Recordings`) is optional and simply omitted from emails when absent.

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

## Sending limits

`MailApp` allows 100 recipients/day on a consumer Gmail account and 1,500/day on
Workspace. The membership is well under both. `sendAnnouncementToAllMembers()`
checks the remaining quota before sending and refuses rather than sending a
partial batch.

Announcements are sent one message per member, so nobody sees anyone else's
address.

## Testing without waiting for a real edit

Select any data row on a schedule tab and run
**SYVE → Send test registration email (selected row)**. It composes and sends the
same notification the trigger would.
