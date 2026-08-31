# taylor-mcghee-kiosk

Portrait **1080×1920** kiosk for **RPB Law Firm / Taylor McGhee** at **Urban Golf Weekend**.

**DEMO-006 · INTERNAL playable.** Do **not** email Taylor McGhee or `info@rpblawfirm.com`. No client email.

Mode: photo booth + golf-ball print preview + business-assessment lead capture.

Closest pattern: [turespana-imex-kiosk](https://github.com/Powerwyze/turespana-imex-kiosk) (portrait photo + lead + optional SMTP). This kiosk does **not** use Gemini.

## Guest flow (~60–90s)

1. **Attract** (first screen — the kiosk, not a landing page): Urban Golf Weekend · RPB Law Firm · Eden Roc · Sep 5 2026. Tap to start.
2. **Photo booth**: camera capture with graceful fallback if no camera. Optional clubhouse/golf frame + typographic **RPB LAW FIRM** lockup. OpenAI polish is optional; if `OPENAI_API_KEY` is missing the captured or placeholder photo still shows.
3. **Golf ball print**: CSS/canvas preview with RPB lockup on the ball. Guest enters a 12-character print line. **Print ball** confirms a **simulated** print job (no hardware) and shows a queue id.
4. **Business assessment** (required): name, company, email, role, what they need help with (IP / corporate / litigation / other + free text), consent.
5. **Thank you / reset**. Optional photo email if WYZER SMTP env is present; otherwise skip send and keep the lead.

Language: English.

## Known intake facts (do not invent beyond these)

- Contact: Taylor McGhee, Client intake associate, RPB Law Firm. **Do not email.**
- Website listed on intake: **Proclaim.com** (do not invent a different firm site).
- Event: Urban Golf Weekend, Saturday **Sep 5 2026**.
- Venue: **Eden Roc Miami Beach** (intake typed “edon roc”; form also said Miami Beach golf course). No street address on file.
- Type: Corporate Activation. Expected attendance ~4500.
- Rent 1 indoor branded kiosk, 1 day, 8 hours. Booth size N/A. Branding yes. Wifi + regular outlet: yes.
- Logos uploaded on the form (filenames only; files are **not** in this repo): `Rpb Law Firm Oxblood.png`, `Rpb Law Firm Cream.png`. Brand colors from those names: oxblood + cream. Public UI uses a typographic lockup **RPB LAW FIRM** in oxblood on cream — no invented mark.
- Delivery / load-in: “Will update when they tell us” — left blank.
- Phone on the intake form must **not** appear on the public kiosk screen.
- Thread: `1a053b09160f7685`.

## Gaps (shipped playable anyway)

- Official event URL
- Licensed vector logo
- Exact golf-course name
- Load-in / delivery window
- Printer hardware model
- CRM destination for captured leads

## Repo shape

```
public/index.html
public/app.js
public/styles.css
public/assets/           lockup.svg (typographic), OSK
api/lead.js              POST /api/lead
api/health.js            GET /api/health (env NAME presence only)
api/banana.js            optional OpenAI polish (no Gemini)
api/send-photo.js        optional guest photo email
package.json
vercel.json
```

## APIs

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/health` | `{ ok: true }` + which env **names** are present (booleans, never values). Also `openai` / `smtp` booleans. |
| `POST` | `/api/lead` | Capture assessment. Succeeds without Supabase or SMTP. |
| `POST` | `/api/banana` | Optional OpenAI polish. If the key is missing, `{ skipped: true }` — kiosk keeps the capture. |
| `POST` | `/api/send-photo` | Optional guest photo email. Skips cleanly if SMTP env is missing. Never emails staff. |

Lead JSON: `{ name, company, email, role, needHelp, needHelpOther, consent: true, printLine, printQueueId }`.

`needHelp` is one of `ip` | `corporate` | `litigation` | `other`.

## Environment variables

Copy **by name** from the closest Vercel project (`turespana-imex-kiosk` or `elevate-photobooth-2`). Never commit values. Do **not** require `GEMINI_API_KEY`. Then set `FROM_NAME` to `RPB Law Firm` (not a secret).

| Name | Role on this kiosk |
| --- | --- |
| `OPENAI_API_KEY` | Optional photo polish |
| `OPENAI_IMAGE_MODEL` / `OPENAI_IMAGE_SIZE` / `OPENAI_IMAGE_QUALITY` | OpenAI image defaults |
| `WYZER_GMAIL_USER` / `WYZER_APP_PASSWORD` | Preferred SMTP for optional guest photo email |
| `GMAIL_USER` / `GOOGLE_APP_PASSWORD` | SMTP fallback names |
| `FROM_NAME` | Email from-name |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_BUCKET` | Optional durable lead store (`rpb_leads`) |

`GET /api/health` reports which of those **names** are present (booleans only).

### Optional Supabase table

```sql
create table if not exists rpb_leads (
  id text primary key,
  email text,
  name text,
  company text,
  role text,
  need_help text,
  need_help_other text,
  print_line text,
  print_queue_id text,
  consent boolean,
  source text,
  event text,
  demo text,
  created_at timestamptz default now()
);
```

If the table is missing, lead capture still returns `{ ok: true }`.

## Design

Portrait-first 1080×1920 touch UI. Cream field, oxblood type. Typographic lockup only.

## Deploy

Vercel project: `taylor-mcghee-kiosk` · team `powerwyzes-projects`.

Existing GitHub repo: https://github.com/Powerwyze/taylor-mcghee-kiosk (do not create a new repo).

## Local

```bash
npm install
npx vercel dev
```

## Contacts (do not email from this agent)

- Taylor McGhee, Client intake associate, RPB Law Firm
- Do not email Taylor or info@rpblawfirm.com
- Thread id: `1a053b09160f7685`
