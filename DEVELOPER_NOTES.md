# LegacyCon headshot and Blueprint flow

User-directed replacement of the cinematic portrait flow, October 2, 2026.
Repository Powerwyze/taylor-mcghee-kiosk, branch legacycon-2026, project rpb-legacycon-kiosk.
Rollback: previously promoted deployment dpl_HkBUJN48SYwRBeqRLU59AP3X73Ww (verify ID before rollback).

## Guest flow
Optional business card scan -> explicit category -> solo camera readiness -> five-second local countdown -> generation immediately, concurrent contact review -> memory game only if still generating -> original/result comparison -> touch likeness approval -> confirmed phone binding -> QR -> existing phone confirmation/download.

Roles: Entrepreneur, Tech enthusiast, VC, Law firm, Blue collar, Executive, Community leader. A role changes backdrop and restrained light, not facial features, actual clothing or inferred occupation. Guest selects it explicitly; it is not inferred from appearance or card.

Business cards are uploaded to the server and sent to OpenAI only to transcribe visible name, company, email and phone. store:false. Card images are not retained in our storage. Extracted fields are untrusted, editable drafts. A number must be confirmed on screen. No contacts are sent to the voice host, no marketing enrollment, no SMS/email delivery.

## Likeness
High input fidelity, high-quality editing and a conservative head/shoulders prompt preserve source facial geometry, hair, glasses, age, skin tone and clothing. A separate source usability check rejects unclear/multiple faces. A separate result check conservatively rejects visible identity drift. If checking or editing is unavailable, the original camera photo receives only the logo band and is clearly labeled. There is no silent AI substitution or automatic paid regeneration. Guest still reviews source and result side by side before QR creation; visual checks cannot guarantee perfect likeness.

## Blueprint
Original mahogany gavel with gold collars, expressive eyes, speaking mouth and sounding block, selected by the user for RPB's legal-brand host. Not claimed as an official mascot, judge or employee. Blender asset generated in GitHub Actions with editable .blend and matching mahogany/gold gavel SVG fallback. Audio drives jawOpen/mouthRound; not phoneme-perfect lip sync.
Voice: exact gpt-live-1, marin, WebRTC /v1/live/sessions; separate gpt-5.6-luna delegation backend. Short warm welcome, explicit readiness, interruptible generation conversation, captions from outgoing transcripts. No legal advice or invented giveaway terms. Touch remains functional with no microphone. Voice teardown does not reset photo/contact work.
Optional camera welcome uses local MediaPipe person detection and a single recent frame for a greeting. Operator enables once. Manual reset/Stop/page hide stop it; idle reset can rearm only when still enabled. Guest-only inactivity: 30 seconds live voice; 150 seconds touch, paused while work is pending.

## Provider and storage configuration
Existing project primary OPENAI_API_KEY preserved. Authorized shared OPENAI_BACKUP linked Production/Preview. One backup retry only for confirmed quota/credit errors; original payload and deadline preserved. OPENAI_IMAGE_MODEL defaults gpt-image-1; OPENAI_VISION_MODEL defaults gpt-4.1-mini. No secrets in browser/source/logs.
BLOB_READ_WRITE_TOKEN stores branded photo, encrypted contact records and metadata. Pending photos have no phoneHash and cannot unlock until a 256-bit claim capability plus explicit touch confirmations binds the number. Claim retries use deterministic lead ID and do not authorize different numbers. Existing QR and phone-unlock routes retained for older photos.
QR delivery only; no photo emails, no SMS messages or marketing campaigns. Email is merely an optional contact field. Client terms/SMS program configuration must be resolved before marketing opt-in is offered again.

## Validation
Remote Node tests cover backup boundaries, headshot prompts and claim validation. Remote Playwright covers card success/skip/failure, concurrent generation/contact, review before QR, errors/retries, reset, voice failure recovery and portrait/mobile layouts. Mocked tests do not prove live providers. Separate remote smoke tests record actual voice, card OCR, image check and QR storage results without printing contacts or secrets.


## October 2, 2026 verification checkpoint
DEMO-013 updates the existing RPB LegacyCon kiosk into a solo headshot experience while preserving QR downloads and matching-phone confirmation. Production: https://rpb-legacycon-kiosk.vercel.app

Guests can scan a business card or skip it, choose Entrepreneur, Tech enthusiast, VC, Law firm, Blue collar, Executive or Community leader, and take a photo with a cancelable five-second countdown. Generation starts immediately while they review or enter their mobile number. The memory game fills remaining wait time. Cards are transient OCR inputs, editable contact drafts require touch confirmation, and no SMS or email is sent.

Blueprint is an original animated RPB gavel character with a matching fallback, GPT-Live 1 voice, speech captions, interruption support, optional camera welcome and independent touch controls. Voice may select a style or start an explicitly confirmed capture, but cannot confirm contacts, approve likeness or issue the QR.

Headshots use a conservative high-fidelity image edit that preserves facial features and clothing. Separate source and result checks reject unusable captures or appearance drift. Guests review source and result side by side before approving. Unavailable/rejected AI edits use a clearly labeled original-photo fallback. An unguessable claim capability binds the photo to the confirmed phone only after likeness approval; wrong-number unlocks remain denied.

Existing primary credentials are preserved. Shared OPENAI_BACKUP is linked for Production/Preview, with one same-payload retry only for confirmed credit/billing quota failures. Secrets never enter the browser or repository. Authoring, Blender generation, dependency installation and verification run remotely in GitHub Actions/Vercel.

Validation: automated Node tests and Chromium flow checks pass for countdown cancellation, concurrent contact collection, voice failure preserving work, contact/likeness gates, session reset and mobile/portrait layouts. The actual 3D avatar and fallback were visually inspected. Live provider verification details follow below.

Operator: refresh the kiosk, tap Talk with Blueprint and allow microphone/camera. Optionally enable camera welcome once. Guests can always use touch. QR delivery is not SMS, and matching a phone number is not proof of phone ownership. AI likeness is not guaranteed; the on-screen guest review is required.

Rollback: dpl_HkBUJN48SYwRBeqRLU59AP3X73Ww. Branch remains legacycon-2026; no changes to the excluded Urban Golf kiosk.

Final verification: remote regression run 37075969303 passed; live run 37075969337 passed. GPT-Live session startup, received audio packets/playback, outgoing captions and delegated skip/category actions passed without protocol errors. Real business-card OCR, real image generation, independent quality check, encrypted photo/lead persistence, contact and likeness approval gates, QR rendering and matching/wrong-number unlocks were exercised. All three paid image trials were rejected by the conservative likeness checker; original-photo fallback was verified. No accepted AI-edited likeness is claimed. User-specific likeness still requires a fresh camera photo and guest review.

A live retry test exposed stale Blob metadata returning an unbound phone after approval. Metadata updates now use immutable revision URLs, following Vercel Blob's caching guidance (https://vercel.com/docs/vercel-blob), and a regression test verifies that an old base record cannot undo confirmation. Final rapid wrong/correct-phone check returned 401 then 200.

Reviewed app source: ad050e361ae08513400f58105bb2f40261de8f0e; preview deployment dpl_Bv4f7XWyBEmuUBw8TZSmVvHsfHxb, promoted to production.

## Gavel revision
The user requested a gavel in place of the book on October 2. Blueprint keeps its name, GPT-Live 1 voice, jawOpen/mouthRound audio-driven morphs and all headshot/card/QR/phone behavior. Only character geometry, fallback artwork, accessible descriptions and host appearance instructions changed. Previous production rollback: dpl_Aqq3veR7qTiSywinX7Gfo8WctnjG.
