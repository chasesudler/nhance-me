# Nhance Me

Nhance Me is a Vercel-ready Next.js + PWA starter for a real-estate AI image enhancement platform. It includes email/password dashboard access, drag-and-drop uploads, 50-image batch processing UI, downloadable enhanced outputs, virtual staging workflow screens, logo options, and API-ready enhancement/staging endpoints.

## Important MVP note
This zip includes a deployable product shell and browser-side enhancement preview engine. True Autoenhance-level HDR merge, window pulls, object-safe AI editing, and production virtual staging require a dedicated image AI provider or proprietary model pipeline. The included `/app/api/enhance` and `/app/api/stage` routes are structured for that integration.

## Deploy to Vercel
1. Upload this folder/zip to GitHub or import directly in Vercel.
2. Run `npm install`.
3. Run `npm run build`.
4. Deploy.

## Optional production environment variables
```
AI_ENHANCE_API_URL=
AI_ENHANCE_API_KEY=
AI_STAGING_API_URL=
AI_STAGING_API_KEY=
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Included features
- Landing page with premium real-estate SaaS positioning
- Email/password login and create-account flow using local demo auth
- Protected dashboard routes
- Drag/drop and upload button image upload
- Up to 50 images per batch
- Client-side enhancement preview engine for speed and low latency
- Batch ZIP download
- Enhancement controls: Exposure, color, clarity, vertical correction, sky-safe mode, window pull mode, no-hallucination integrity mode
- Virtual staging UI for room type/style/furniture density
- PWA manifest and service worker
- Two logo options in SVG and PNG

## Production recommendations
For a commercial launch, replace demo local auth with Firebase Auth, Supabase Auth, Clerk, or Auth.js. Replace browser-side enhancement with a queue-based image pipeline using Cloudflare R2/Vercel Blob/S3 + Replicate/Stability/RunPod/custom models + webhooks.
