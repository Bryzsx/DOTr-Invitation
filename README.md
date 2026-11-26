# DOTr — Year End Assessment & Gawad Parangal Invitation

A single-page, mobile-friendly digital invitation with an animated cover, live
countdown, and an RSVP form that writes responses straight into a Google Sheet.

Built as static HTML + one Vercel serverless function — no build step.

---

## 1. Set up the Google Sheet (one time, ~3 minutes)

1. Create a **new Google Sheet** — this is where all RSVPs are saved.
2. In the sheet, open **Extensions → Apps Script**.
3. Delete the contents of `Code.gs` and paste in
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. **Deploy → New deployment → Web app**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Press **Deploy**, authorize on the first run, then **copy the Web app URL**
     (it ends in `/exec`).
5. Optional test:
   ```bash
   curl -X POST "<web app URL>" -H "Content-Type: application/json" \
     -d '{"name":"Juan Dela Cruz","office":"Planning","status":"yes","guests":1,"message":"See you!"}'
   ```
   You should get `{"ok":true}` and a new row in the sheet.

> If you redeploy the Apps Script later, use **Manage deployments → edit →
> Version: New version** and update `RSVP_WEBHOOK_URL` with the new URL.

---

## 2. Deploy on Vercel

1. Push this repo to GitHub (already done: `Bryzsx/DOTr-Invitation`).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
   - Framework Preset: **Other**
   - Build command and output directory: leave **empty**
3. Before deploying, add the environment variable
   (**Settings → Environment Variables**):
   | Name | Value |
   | --- | --- |
   | `RSVP_WEBHOOK_URL` | the Apps Script Web app URL from step 1.4 |
4. Deploy.

Without that variable the site still renders, but the RSVP form will refuse to
pretend it succeeded — it returns `503 not-configured` and shows an error.

---

## 3. Repo layout

```
index.html                     # the whole invitation (CSS + JS inline)
assets/dotr-seal.svg           # official seal
api/rsvp.js                    # Vercel serverless function -> forwards to the sheet
google-apps-script/Code.gs     # sheet-side backend (paste into Apps Script)
```

### Share deep links

| Link | Behaviour |
| --- | --- |
| `/#open` | skips the cover animation |
| `/#rsvp` | opens the cover and jumps straight to the RSVP form |
| `/#countdown`, `/#details`, `/#message` | opens the cover and scrolls to that section |

### Behaviour notes

- Countdown targets **December 7, 2026, 5:30 PM** local time (`index.html`, `var target`).
- Validation runs in the browser *and* again in `api/rsvp.js` *and* again in the
  Apps Script — all three must pass before a row is written.
- The sheet URL never ships to the browser; only the Vercel function knows it.
- Respects `prefers-reduced-motion`; works with JavaScript disabled (read-only).
