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
Original oxblood leather book with gold lettering, page edges and ribbon: a business blueprint/legacy motif for RPB. Not claimed as an official mascot or employee. Blender asset generated in GitHub Actions with editable .blend. Gold/oxblood book SVG fallback. Audio drives jawOpen/mouthRound; not phoneme-perfect lip sync.
Voice: exact gpt-live-1, marin, WebRTC /v1/live/sessions; separate gpt-5.6-luna delegation backend. Short warm welcome, explicit readiness, interruptible generation conversation, captions from outgoing transcripts. No legal advice or invented giveaway terms. Touch remains functional with no microphone. Voice teardown does not reset photo/contact work.
Optional camera welcome uses local MediaPipe person detection and a single recent frame for a greeting. Operator enables once. Manual reset/Stop/page hide stop it; idle reset can rearm only when still enabled. Guest-only inactivity: 30 seconds live voice; 150 seconds touch, paused while work is pending.

## Provider and storage configuration
Existing project primary OPENAI_API_KEY preserved. Authorized shared OPENAI_BACKUP linked Production/Preview. One backup retry only for confirmed quota/credit errors; original payload and deadline preserved. OPENAI_IMAGE_MODEL defaults gpt-image-1; OPENAI_VISION_MODEL defaults gpt-4.1-mini. No secrets in browser/source/logs.
BLOB_READ_WRITE_TOKEN stores branded photo, encrypted contact records and metadata. Pending photos have no phoneHash and cannot unlock until a 256-bit claim capability plus explicit touch confirmations binds the number. Claim retries use deterministic lead ID and do not authorize different numbers. Existing QR and phone-unlock routes retained for older photos.
QR delivery only; no photo emails, no SMS messages or marketing campaigns. Email is merely an optional contact field. Client terms/SMS program configuration must be resolved before marketing opt-in is offered again.

## Validation
Remote Node tests cover backup boundaries, headshot prompts and claim validation. Remote Playwright covers card success/skip/failure, concurrent generation/contact, review before QR, errors/retries, reset, voice failure recovery and portrait/mobile layouts. Mocked tests do not prove live providers. Separate remote smoke tests record actual voice, card OCR, image check and QR storage results without printing contacts or secrets.
