# Nhance Me

A Vercel-ready Next.js + PWA foundation for real estate photo enhancement, 50-image batch workflows, image integrity controls, and virtual staging.

## Selected brand direction

Logo direction selected: triangle house inside the Morgan Blue rounded square with Morgan Orange accent window/arc.

Included brand files:

- `/public/nhance-me-logo.svg`
- `/public/nhance-me-logo.png`
- `/public/nhance-me-icon.svg`
- `/public/nhance-me-icon-512.png`
- PWA icons in `/public/icons/`

## Deploy

Install dependencies and run locally:

```bash
npm install
npm run dev
```

Deploy to Vercel by pushing this repo to GitHub and importing it as a Next.js project.


## Production virtual staging

The Virtual Staging page now calls `/api/stage` instead of showing a mock overlay. To enable real staging on Vercel, add this environment variable in **Vercel > Project Settings > Environment Variables** and redeploy:

```
REPLICATE_API_TOKEN=your_replicate_token_here
```

Optional model override:

```
REPLICATE_STAGE_MODEL=proplabs/virtual-staging
```

Without `REPLICATE_API_TOKEN`, the UI will show a clear setup message instead of pretending a fake staged image was generated.


## Enhancement Quality Update
The batch enhancement tool now defaults to a stronger **Luxury DSLR Listing** grade. It performs in-browser auto-level correction, white balance, bright-interior shadow lift, highlight recovery, premium color depth, vibrance balancing, and DSLR-style sharpening while keeping integrity/no-hallucination mode enabled.

This MVP still avoids inventing objects or changing room structure. For true Autoenhance-level production quality, connect `/api/enhance` to a server-side image model/queue that supports HDR/window pulls, perspective correction, RAW processing, and room-aware relighting.


## Production AI enhancement

The batch enhancement page now uses a two-step pipeline:
1. a local luxury DSLR pre-grade for consistent lighting/color continuity
2. a production `/api/enhance` route that calls Replicate for AI enhancement/upscaling

### Required environment variables

```
REPLICATE_API_TOKEN=your_token_here
REPLICATE_ENHANCE_MODEL=nightmareai/real-esrgan
REPLICATE_STAGE_MODEL=proplabs/virtual-staging
```

If `REPLICATE_API_TOKEN` is missing, the app falls back to the local luxury grade and shows a banner explaining that the production AI engine is not connected.
