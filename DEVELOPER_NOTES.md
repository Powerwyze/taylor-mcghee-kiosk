# LegacyCon kiosk developer notes

DEMO-013 portrait booth for RPB Law Firm at LegacyCon: BPN Summit, Saturday October 3, 2026, Seminole Hard Rock Conventions Center, Hollywood, Florida. Production: https://rpb-legacycon-kiosk.vercel.app. Repo branch `legacycon-2026`.

## Looks

The three looks celebrate the Black Professionals Network and LegacyCon. They are dynamic, Black-positive portraits of excellence, ownership, entrepreneurship, and generational wealth. RPB Law Firm is a business, entertainment, and intellectual-property firm for founders. Each look may include a quiet cue of building and protecting a business: a briefcase, a signed agreement, or a contract. The AI must not draw logos and must not write legal advice. The cream logo band is added afterward.

Palette on every look: BPN navy `#02304A`, RPB/BPN maroon `#681710`, gold light `#F6B146`. Cream `#FDEED0` is the logo-band color.

### A. Agent of Legacy

Intent: a cinematic mission-poster hero. Confident stance, sharp tailoring, dusk skyline, navy, maroon, and gold light, with a closed briefcase at the side. This matches LegacyCon 2026’s theme, “The Mission is Possible,” which commissions attendees as Agents of Legacy.

References:

- Eventbrite listing for the summit and the Agents of Legacy briefing: https://www.eventbrite.com/e/2026-legacycon-bpn-summit-presented-by-hard-rock-tickets-1990819005236
- BPN event page: https://mybpn.org/event/2026-legacycon-presented-by-hard-rock/
- Summit site, “every legacy begins with a mission”: https://bpsummit.org/
- BPN on economic opportunity and legacy building: https://mybpn.org/event/certified-legends-ball-legacycon-2026/
- Annie Leibovitz power-portrait reference, confident people of achievement in real light: https://www.forbes.com/sites/neloliviawaga/2017/04/21/how-women-new-portraits-by-annie-leibovitz-underlines-ubs-global-wealth-management-strategy/

Prompt in `api/banana.js` under `agent`:

> Photorealistic photo of the same person or people. Preserve their exact face, skin tone, and do not lighten skin. Keep hair texture, age, and body. Do not beautify or change identity. A professional photographer made this, not a beauty filter and not an illustration. Tasteful and empowering. No stereotypes, no extra people, no logos. Leave the lower floor empty. Cinematic mission-poster hero for the Black Professionals Network at LegacyCon, an Agent of Legacy. Confident power stance, sharp tailoring, navy #02304A, maroon #681710, and gold light, with a city skyline at dusk. A closed leather briefcase rests at the side. No text.

### B. Legacy Builder

Intent: a Black-business-magazine cover. One coverline only: “Form it. Protect it. Scale it.” That line is RPB’s formation, protection, and growth idea for founders. No fake awards and no real magazine names, so the image does not pretend to be Essence, Black Enterprise, or Forbes.

References:

- Black Enterprise digital covers of Black founders and financial leaders: https://www.blackenterprise.com/black-enterprise-releases-its-second-ever-digital-cover/
- Black Enterprise on Issa Rae as a founder and CEO: https://www.prnewswire.com/news-releases/black-enterprise-reveals-issa-rae-for-the-may-digital-issue-cover-301835212.html
- Essence editorial portrait of executive Latriece Watkins: https://www.ironsidephotography.com/blog/essence-magazine-arkansas-editorial-portrait-photographer
- RPB Law Firm, business and brand protection for founders: https://rpblawfirm.com/about/ and https://rpblawfirm.com/

Prompt in `api/banana.js` under `builder`:

> Photorealistic photo of the same person or people. Preserve their exact face, skin tone, and do not lighten skin. Keep hair texture, age, and body. Do not beautify or change identity. A professional photographer made this, not a beauty filter and not an illustration. Tasteful and empowering. No stereotypes, no extra people, no logos. Leave the lower floor empty. Black-business-magazine cover celebrating Black excellence, ownership, entrepreneurship, and generational wealth. One coverline only, exactly: Form it. Protect it. Scale it. No awards, no real magazine names, no other text. A signed agreement sits at the edge and does not cover the face. Navy, maroon, and gold light. Leave the lower area empty.

### C. Owner's Office

Intent: the guest already owns the room. A corner office or boardroom at golden hour, skyline outside, and quiet legacy cues: family photos, books, a signed agreement, and a briefcase. Faces in the frames and words on the books and papers stay unreadable so the model does not invent other people or legal text.

References:

- Vanity Fair / Mark Seliger group portrait of Black women founders, personal style kept intact: https://www.vanityfair.com/news/2018/04/behind-the-scenes-women-entrepreneurs
- BPN LegacyCon assignment, ownership, investment, and what you build after you leave: https://bpsummit.org/
- RPB on protecting what a founder has built: https://www.linkedin.com/company/rpb-law

Prompt in `api/banana.js` under `office`:

> Photorealistic photo of the same person or people. Preserve their exact face, skin tone, and do not lighten skin. Keep hair texture, age, and body. Do not beautify or change identity. A professional photographer made this, not a beauty filter and not an illustration. Tasteful and empowering. No stereotypes, no extra people, no logos. Leave the lower floor empty. The same person owns a corner office and boardroom at golden hour. Warm gold light and a dusk skyline through tall windows. Subtle legacy cues: small framed family photos with unreadable faces, a shelf of books with unreadable spines, a signed business agreement, and a briefcase on the desk. No readable legal text.

On-screen cards live in `LOOKS` inside `public/app.js`.

## Identity preservation

This rule outranks the styling.

- Same face, same skin tone, never lightened.
- Same hair texture, age, and body.
- One to three people already in the capture are acceptable. Do not add people.
- No beauty filter, no face swap, no illustration look.
- Tasteful and empowering. No stereotypes.
- The model must not draw the RPB, BPN, or PowerWyze logos. Those are composited later.

## Logo band

`lib/logo-band.js` appends a cream `#FDEED0` strip under the portrait, about 10 percent of the image height and at least 140 pixels. It does not cover the person. Left to right: RPB Law Firm, BPN, PowerWyze. Source files are `lib/logos/rpb.png`, `bpn.png`, and `powerwyze.png`, also copied to `public/assets/logos/` for the home screen. The home screen uses the same three marks on a cream band.

## Fallback

`api/banana.js` calls OpenAI image edits first (`gpt-image-1`, quality medium, 1024x1536) with a 90 second limit. If that call fails for any reason, including HTTP 429 or 5xx, a timeout, a network error, or no key, the server builds a plain portrait with sharp:

- Rotate, then a cover crop to 1024x1536 biased toward the subject (`position: attention`).
- A light brightness, saturation, and contrast polish, plus a little sharpen.
- The same cream logo band.

That file is stored and returned like an AI portrait. The guest gets the result screen and the QR, with the line “Your Legacy Portrait,” and no error. The function log records `path` as `ai` or `fallback`. The response header `X-RPB-Path` says the same. A retry is shown only when the fallback itself fails, or when the photo cannot be saved.

A test can send form field `forceFallback=1` to skip OpenAI and take the plain-photo path. The kiosk UI does not send that field.

## Phone gate

Flow: home, choose a look, 3-2-1 countdown, photo, then a required 10-digit US mobile number. Formatting such as `(555) 201-0199` is accepted. The area code and exchange cannot start with 0 or 1. SMS consent is on that same screen, unchecked and optional. The consent text version is `rpb-legacycon-sms-v1` in `lib/consent.js`. Name and email are optional and do not block generation. No SMS is sent.

The QR opens `/p/<id>`. The id is 9 random bytes, base64url, 12 characters. The portrait stays hidden until the guest types the same number. `POST /api/unlock` compares a hash of the normalized digits with the hash on the photo record. Only a match returns the image bytes. A mismatch returns: “That number doesn't match. Try the number you entered at the booth.” Five failed tries lock the link. The photo remains after the kiosk resets.

## Where leads are stored

Vercel Blob store `rpb-legacycon` (region iad1).

- Portrait JPEG: `i/{random}.jpg`. The photo record at `m/{id}.json` stores a phone hash, not the raw number, and an encrypted copy of the image URL.
- Lead: encrypted JSON at `leads/{id}.json`. The lead payload may include the normalized phone number, optional name and email, `sms_consent`, the consent timestamp, and the consent text version.
- A one-line function log records the lead id and consent flag and omits the phone number.

## Environment variable names

Set on the Vercel project. Do not commit values.

- `OPENAI_API_KEY` (also accepted: `OPENAI_API_KIOSK_KEY`, `OPEN_API_KEY`)
- `OPENAI_IMAGE_MODEL` (default `gpt-image-1`)
- `OPENAI_IMAGE_QUALITY` (default `medium`)
- `OPENAI_IMAGE_SIZE` (default `1024x1536`)
- `BLOB_READ_WRITE_TOKEN`
- `PUBLIC_BASE_URL`
- `FROM_NAME`
- `RESEND_API_KEY`
- `RESEND_FROM` or `RESEND_FROM_EMAIL` or `EMAIL_FROM` or `FROM_EMAIL`
- `RESEND_REPLY_TO`
- `GMAIL_USER` or `WYZER_GMAIL_USER`
- `GOOGLE_APP_PASSWORD` or `WYZER_APP_PASSWORD`
- `VERCEL_OIDC_TOKEN` is injected by Vercel when OIDC is enabled. It is only a backup image path.

`GET /api/health` reports whether those names are present. It does not return values.

## Known gaps

- Image generation depends on OpenAI credit. A 429 `credit_balance_exhausted` takes the plain-photo fallback. The guest still leaves with a QR.
- Optional email is not configured on this project (`email: none` on `/api/health`). It never blocks delivery.
- No SMS is sent. Delivery is the QR plus phone confirmation.
- Blob files are stored with public access. The image pathname is unguessable, and the meta file stores that URL encrypted. The confirmation page does not receive the blob URL unless the phone number matches, and then it receives image bytes rather than the blob address.

## Change a look quickly

1. Edit the string in `PROMPTS` in `api/banana.js`. Keep the identity sentence first. Keep “no logos” and “leave the lower floor empty” so the band stays clear.
2. If the card text should change, edit `LOOKS` in `public/app.js`.
3. Commit to `legacycon-2026` and deploy production on project `rpb-legacycon-kiosk`.
4. `GET /api/health` should still show `openai: true` and `storage: blob:rpb-legacycon`.
