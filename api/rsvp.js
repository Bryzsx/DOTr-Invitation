/**
 * POST /api/rsvp
 *
 * Validates an RSVP submission and forwards it to the Google Apps Script
 * Web App that writes the row into the Google Sheet.
 *
 * Configure in Vercel: Settings -> Environment Variables
 *   RSVP_WEBHOOK_URL = https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
 *   (paste the "Web app URL" from the Apps Script deployment dialog)
 */

var LIMITS = { name: 120, office: 140, message: 1000 };

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  var endpoint = process.env.RSVP_WEBHOOK_URL;
  if (!endpoint) {
    console.error('RSVP_WEBHOOK_URL is not set');
    return res.status(503).json({ ok: false, error: 'not-configured' });
  }

  // Vercel usually gives us a parsed object, but be defensive.
  var raw = req.body;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (err) { raw = null; }
  }
  if (!raw || typeof raw !== 'object') {
    return res.status(400).json({ ok: false, error: 'bad-payload' });
  }

  var name = clean(raw.name, LIMITS.name);
  var office = clean(raw.office, LIMITS.office);
  var message = clean(raw.message, LIMITS.message);
  var status = raw.status === 'yes' ? 'yes' : raw.status === 'no' ? 'no' : '';
  var guests = parseInt(raw.guests, 10);
  if (!isFinite(guests)) guests = 0;
  guests = Math.max(0, Math.min(2, guests));

  if (name.length < 2) {
    return res.status(400).json({ ok: false, error: 'name-required' });
  }
  if (!status) {
    return res.status(400).json({ ok: false, error: 'status-required' });
  }

  var payload = {
    name: name,
    office: office,
    status: status,
    guests: guests,
    message: message,
    submittedAt: new Date().toISOString()
  };

  async function send(redirect) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
    try {
      return await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: redirect,
        signal: controller ? controller.signal : undefined
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Apps Script normally answers with a 302 to googleusercontent.com, so a 3xx
  // counts as accepted here. If following the redirect fails, retry with
  // redirect: 'manual' and treat the 3xx itself as success.
  var reply = null;
  try {
    reply = await send('follow');
  } catch (err) {
    console.error('RSVP webhook follow failed:', err && err.message);
  }

  if (!reply || reply.status >= 400) {
    try {
      reply = await send('manual');
    } catch (err) {
      console.error('RSVP webhook manual failed:', err && err.message);
      reply = null;
    }
  }

  var accepted = reply && reply.status >= 200 && reply.status < 400;
  if (!accepted) {
    console.error('RSVP webhook rejected:', reply && reply.status, reply && reply.statusText);
    return res.status(502).json({ ok: false, error: 'webhook-failed' });
  }

  return res.status(200).json({ ok: true });
};
