export const runtime = 'nodejs';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_ENHANCE_MODEL = process.env.REPLICATE_ENHANCE_MODEL || 'nightmareai/real-esrgan';

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
  const text = String(message || '').toLowerCase();
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
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.detail || data?.error || `Replicate request failed with ${response.status}`;
    throw new Error(friendlyReplicateError(typeof message === 'string' ? message : JSON.stringify(message)));
  }
  return data;
}

function buildReplicateInput(image, settings) {
  const model = REPLICATE_ENHANCE_MODEL.toLowerCase();
  const upscale = settings?.preset === 'luxury-dslr' ? 2 : 1.5;

  if (model.includes('real-esrgan')) {
    return {
      image,
      outscale: upscale,
      face_enhance: false
    };
  }

  if (model.includes('topazlabs/image-upscale')) {
    return {
      image,
      scale: upscale,
      model: 'High Fidelity V2',
      output_format: 'jpg'
    };
  }

  return {
    image,
    scale: upscale,
    prompt: 'Enhance this real estate listing photo. Keep architecture and room structure identical. Improve clarity, detail, and overall listing quality without adding or removing objects.'
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { image, settings } = body || {};

    if (!image) {
      return Response.json({ error: 'No image was provided.' }, { status: 400 });
    }

    if (!REPLICATE_API_TOKEN) {
      return Response.json(
        {
          error: 'Production AI enhancement is not connected yet. Add REPLICATE_API_TOKEN in Vercel Project Settings > Environment Variables and redeploy.',
          mode: 'browser-fallback'
        },
        { status: 503 }
      );
    }

    const prediction = await callReplicate(`/models/${REPLICATE_ENHANCE_MODEL}/predictions`, {
      method: 'POST',
      body: JSON.stringify({
        input: buildReplicateInput(image, settings)
      })
    });

    let current = prediction;
    const predictionId = prediction.id;

    for (let i = 0; i < 70; i += 1) {
      if (['succeeded', 'failed', 'canceled'].includes(current.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      current = await callReplicate(`/predictions/${predictionId}`);
    }

    if (current.status !== 'succeeded') {
      return Response.json(
        {
          error: friendlyReplicateError(current.error || `Enhancement did not complete. Current status: ${current.status}`),
          status: current.status
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
      output: current.output,
      status: current.status
    });
  } catch (error) {
    return Response.json({ error: error.message || 'AI enhancement is temporarily unavailable. Local preview was applied.' }, { status: 500 });
  }
}
