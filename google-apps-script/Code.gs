/**
 * DOTr Year End Assessment & Gawad Parangal — RSVP backend
 * --------------------------------------------------------
 * Writes RSVP submissions from the invitation site into a Google Sheet.
 *
 * SETUP (about 3 minutes)
 *  1. Create a new Google Sheet (this is where the RSVPs will be saved).
 *  2. In the Sheet: Extensions -> Apps Script.
 *  3. Delete whatever is in Code.gs and paste this whole file in.
 *  4. Deploy -> New deployment -> type: Web app
 *       - Description:        DOTr RSVP
 *       - Execute as:         Me
 *       - Who has access:      Anyone
 *     Press Deploy, authorize on first run, then COPY the "Web app URL".
 *  5. In Vercel: Project -> Settings -> Environment Variables
 *       - Name:  RSVP_WEBHOOK_URL
 *       - Value: <the Web app URL you copied>  (ends in /exec)
 *     Redeploy / redeploy with the latest commit.
 *
 * Test it:
 *   curl -X POST "<your web app URL>" -H "Content-Type: application/json" \
 *        -d '{"name":"Juan Dela Cruz","office":"Planning","status":"yes","guests":1,"message":"See you!"}'
 *   -> {"ok":true} and a new row in the Sheet.
 */

var SHEET_NAME = 'RSVPs';
var HEADERS = ['Timestamp', 'Name', 'Office / Unit', 'Attendance', 'Guests', 'Message'];

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad-json' });
  }

  var name = clean_(payload.name, 120);
  var office = clean_(payload.office, 140);
  var message = clean_(payload.message, 1000);
  var status = payload.status === 'yes' ? 'yes' : payload.status === 'no' ? 'no' : '';
  var guests = parseInt(payload.guests, 10);
  if (isNaN(guests)) guests = 0;
  guests = Math.max(0, Math.min(2, guests));

  if (name.length < 2) return json_({ ok: false, error: 'name-required' });
  if (!status) return json_({ ok: false, error: 'status-required' });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

    sheet.appendRow([
      payload.submittedAt || new Date().toISOString(),
      name,
      office,
      status === 'yes' ? 'Joyfully accepts' : 'Regretfully declines',
      guests,
      message
    ]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'write-failed' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: 'dotr-rsvp' });
}

function clean_(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
