# RPB LegacyCon kiosk

DEMO-013 portrait kiosk for RPB Law Firm at LegacyCon: BPN Summit.

Flow: home, choose a look, 3-2-1 camera, required US mobile number with optional SMS consent, memory-match wait, then a result QR. The phone page at `/p/<id>` stays locked until the guest confirms that same number. No SMS is sent.

Leads are encrypted in the Vercel Blob store `rpb-legacycon`. Photo records store a phone hash only.
