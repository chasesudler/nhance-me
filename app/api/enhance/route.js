import {
  getSessionFromRequest,
  unauthorized,
  checkRateLimit,
  rateLimitedResponse,
  uploadImageToBlob,
  uniqueImageName,
  safeMessage,
} from '@/lib/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_ENHANCE_MODEL = process.env.REPLICATE_ENHANCE_MODEL || 'nightmareai/real-esrgan';

// Poll budget kept under the 60s serverless cap (28 x 2s = 56s + request overhead).
const MAX_POLLS = 28;
const POLL_INTERVAL_MS = 2000;

function extractImageUrl(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const first = output.find(Boolean);
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
  }
  if (output.url) return output.url;
  if (output.image) return output.image;
  if (output.images?.[0]?.url) return output.images[0].url;
  return null;
}

function friendlyReplicateError(message = '') {
  const text = safeMessage(message, '').toLowerCase();
  if (text.includes('insufficient credit') || text.includes('purchase credit') || text.includes('billing')) {
    return 'AI enhancement credit is needed. Local preview was applied. Add Replicate billing credit, wait a few minutes, then run the batch again.';
  }
  if (text.includes('unauthorized') || text.includes('api token') || text.includes('authentication')) {
    return 'AI enhancement is not authorized yet. Check REPLICATE_API_TOKEN in Vercel Environment Variables, then redeploy.';
  }
  return 'AI enhancement is temporarily unavailable. Local preview was applied. Try again after checking the AI integration.';
}

async function callReplicate(path, options = {}) {
  const response = await fetch(`https://api.replicate.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.detail || data?.error || `Replicate request failed with ${response.status}`;
    throw new Error(friendlyReplicateError(message));
  }
  return data;
}

function buildReplicateInput(imageUrl, settings) {
  const model = REPLICATE_ENHANCE_MODEL.toLowerCase();
  // Luxury preset gets a 2x upscale; others get 1.5x.
  const scale = settings?.preset === 'luxury-dslr' ? 2 : 1.5;

  if (model.includes('real-esrgan')) {
    // NOTE: nightmareai/real-esrgan expects `scale`, not `outscale`.
    return { image: imageUrl, scale, face_enhance: false };
  }

  if (model.includes('topazlabs/image-upscale')) {
    return { image: imageUrl, scale, model: 'High Fidelity V2', output_format: 'jpg' };
  }

  return {
    image: imageUrl,
    scale,
    prompt:
      'Enhance this real estate listing photo. Keep architecture and room structure identical. Improve clarity, detail, and overall listing quality without adding or removing objects.',
  };
}

export async function POST(request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorized();
    if (!checkRateLimit(`enhance:${session.email}`, 60, 60 * 60 * 1000)) return rateLimitedResponse();

    const body = await request.json().catch(() => ({}));
    const { image, name, settings } = body || {};

    if (!image) {
      return Response.json({ error: 'No image was provided.' }, { status: 400 });
    }

    if (!REPLICATE_API_TOKEN) {
      return Response.json(
        {
          error:
            'Production AI enhancement is not connected yet. Add REPLICATE_API_TOKEN in Vercel Project Settings > Environment Variables and redeploy.',
          mode: 'browser-fallback',
        },
        { status: 503 }
      );
    }

    // Replicate file inputs need a public https:// URL, so the incoming
    // data URI is hosted on Vercel Blob first.
    let imageUrl;
    try {
      imageUrl = await uploadImageToBlob(image, uniqueImageName('nhance-enhance'));
    } catch (err) {
      return Response.json({ error: err.message || 'Could not prepare the image for AI enhancement.' }, { status: err.status || 400 });
    }

    const prediction = await callReplicate(`/models/${REPLICATE_ENHANCE_MODEL}/predictions`, {
      method: 'POST',
      body: JSON.stringify({ input: buildReplicateInput(imageUrl, settings) }),
    });

    let current = prediction;
    const predictionId = prediction.id;

    for (let i = 0; i < MAX_POLLS; i += 1) {
      if (['succeeded', 'failed', 'canceled'].includes(current.status)) break;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      current = await callReplicate(`/predictions/${predictionId}`);
    }

    if (current.status !== 'succeeded') {
      return Response.json(
        {
          error: friendlyReplicateError(safeMessage(current.error, `Enhancement did not complete. Current status: ${current.status}`)),
          status: current.status,
        },
        { status: 500 }
      );
    }

    const enhancedUrl = extractImageUrl(current.output);
    if (!enhancedUrl) {
      return Response.json({ error: 'The enhancement model completed but did not return an image URL.' }, { status: 500 });
    }

    return Response.json({
      mode: 'production-ai',
      provider: 'replicate',
      model: REPLICATE_ENHANCE_MODEL,
      enhancedUrl,
      name: typeof name === 'string' ? name : undefined,
      status: current.status,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'AI enhancement is temporarily unavailable. Local preview was applied.' }, { status: 500 });
  }
}
