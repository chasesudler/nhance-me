# Nhance Me

A Vercel-ready Next.js + PWA foundation for real estate photo enhancement, 50-image batch workflows, image integrity controls, and virtual staging — plus native iOS/Android packaging via Capacitor.

## What it does

- **Enhance Batch** (`/process`) — upload up to 50 listing photos, apply the Premium MLS luxury grade (auto-levels, white balance, shadow lift, highlight recovery, color depth, DSLR sharpening) entirely in the browser, optionally AI-upscale via Replicate, and download a ZIP.
- **Virtual Staging** (`/staging`) — upload an empty-room photo, pick room/style/density, generate a staged image via Replicate.
- **Integrity mode** — a real toggle: ON keeps edits faithful (no invented details, highlights protected); OFF applies a stronger creative boost.

## Environment variables

Set these in **Vercel > Project Settings > Environment Variables** (and redeploy):

```
REPLICATE_API_TOKEN=            # required for AI enhancement + staging
REPLICATE_ENHANCE_MODEL=nightmareai/real-esrgan
REPLICATE_STAGE_MODEL=black-forest-labs/flux-kontext-pro
BLOB_READ_WRITE_TOKEN=          # Vercel Blob — hosts uploads so Replicate gets public URLs
NHANCE_API_SECRET=              # long random string; signs login sessions (required in production)
```

Without `REPLICATE_API_TOKEN`, the AI steps return a clear 503 and the app falls back to the local MLS grade instead of pretending.

## How the AI pipeline works

1. The browser applies the local Premium MLS grade first (instant preview, works offline).
2. `/api/enhance` uploads that image to Vercel Blob, then calls Replicate (`nightmareai/real-esrgan`, `scale` 2x for the luxury preset) and polls for completion (capped under the 60s serverless limit).
3. `/api/stage` uploads the compressed room photo to Vercel Blob, then calls the configured staging model (`black-forest-labs/flux-kontext-pro` by default — the exact model you configure is the one that runs) and polls for completion.

Auth: `/api/auth/login` issues an httpOnly signed session cookie; `/api/enhance` and `/api/stage` reject unauthenticated requests (401) and are rate-limited per session. Demo login accepts any valid email — swap in Firebase Auth / Clerk / Supabase before a paid launch.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

Push to GitHub and import as a Next.js project. The web build (`npm run build`) keeps the API routes server-side.

## Mobile apps (Capacitor)

The app ships as native iOS/Android shells wrapping a static export of the web app. The local enhancement pipeline works fully offline on-device; AI features call your deployed Vercel backend.

```bash
# 1. Build the static export pointed at your deployed backend
NEXT_PUBLIC_API_BASE=https://your-app.vercel.app npm run build:mobile

# 2. Open the native projects and build signed binaries
npx cap open android   # needs Android Studio
npx cap open ios       # needs Xcode on macOS
```

- `npm run build:mobile` = `MOBILE_BUILD=1 next build && npx cap sync` (static `output: 'export'` → `out/`, then synced into `android/` + `ios/`).
- App ID: `app.nhanceme.mobile`. Icons/splash: replace the defaults under `android/app/src/main/res` and `ios/App/App/Assets.xcassets`.
- Store submission (App Store / Google Play) needs your Apple Developer / Google Play developer accounts — build the signed `.ipa`/`.aab` from Xcode/Android Studio and submit; the web backend stays on Vercel.

## PWA

`public/manifest.json` + `public/sw.js` are included: installable, offline shell caching, old-cache cleanup on updates. Start URL is `/` so the installed app opens on the marketing page and routes to login.

## Selected brand direction

Logo direction selected: triangle house inside the Morgan Blue rounded square with Morgan Orange accent window/arc.

Included brand files:

- `/public/nhance-me-logo.svg`
- PWA icons in `/public/icons/`
