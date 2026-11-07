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
// AI Cleanup uses the same image editing model family as virtual staging.
// It REPAINTS pixels (generative) by design: it exists to remove light
// halos, glare, bloom and ghosting that are baked into the original photo
// and cannot be removed by the deterministic pixel-true Enhance grade.
const REPLICATE_MODEL = process.env.REPLICATE_CLEANUP_MODEL || process.env.REPLICATE_STAGE_MODEL || 'black-forest-labs/flux-kontext-pro';

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
  const raw = safeMessage(message, '');
  const text = raw.toLowerCase();
  if (text.includes('requested resource could not be found') || text.includes('404') || text.includes('not found'))
    return `Cleanup model was not found: ${REPLICATE_MODEL}. Check REPLICATE_CLEANUP_MODEL in Vercel, then redeploy.`;
  if (text.includes('insufficient credit') || text.includes('purchase credit') || text.includes('billing'))
    return 'AI cleanup credit is needed. Add Replicate billing credit, wait a few minutes, then try again.';
  if (text.includes('unauthorized') || text.includes('api token') || text.includes('authentication'))
    return 'AI cleanup is not authorized yet. Check REPLICATE_API_TOKEN in Vercel Environment Variables, then redeploy.';
  if (text.includes('timeout') || text.includes('timed out'))
    return 'The cleanup model timed out. Try a smaller image or redeploy after enabling a longer function duration on your Vercel plan.';
  return raw || 'AI cleanup failed. Check the cleanup model and Replicate billing settings.';
}

async function callReplicate(path, options = {}) {
  const response = await fetch(`https://api.replicate.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.detail || data?.error || `Replicate request failed with ${response.status}`;
    throw new Error(friendlyReplicateError(message));
  }
  return data;
}

function buildPrompt() {
  return [
    'This is a real estate interior photo. Remove only light artifacts: bright diagonal beams or streaks of light across the ceiling, halos, glare, bloom and ghosting around light fixtures and windows.',
    'Keep every light fixture exactly as it is in the original photo. Recessed ceiling lights, ceiling fan lights, chandeliers, pendant lights, wall sconces and lamps are real fixtures, not defects. Do not remove, move, dim, cover or add any light fixture. The number and position of every light in the ceiling must stay the same.',
    'Only clean the light artifact itself, the streak or glow on the ceiling surface between fixtures. Do not repaint the whole ceiling flat. Keep the ceiling texture, tile seams and fixtures unchanged.',
    'Keep everything else in the image the same: identical room layout, architecture, furniture, objects, materials, colors, camera angle and framing.',
    'Do not add, remove, move or restyle any object. Do not change the flooring, walls, windows, doors or trim.',
    'Do not add people, text or watermarks.',
    'Photorealistic result that looks like one clean professional DSLR listing photo.',
  ].join(' ');
}

function buildModelInput(imageUrl) {
  const model = REPLICATE_MODEL.toLowerCase();
  const prompt = buildPrompt();
  if (model.includes('flux-kontext') || model.includes('flux-2')) {
    // prompt_upsampling ON: the Nov 6 build left it off so the model would
    // change as little as possible, and it returned a near copy of the input
    // with the ceiling beam still in place. Cleanup must be allowed to
    // repaint the ceiling, so let the model expand the instruction.
    return { input_image: imageUrl, prompt, output_format: 'jpg', safety_tolerance: 2, prompt_upsampling: true };
  }
  return { image: imageUrl, input_image: imageUrl, prompt };
}

export async function POST(request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorized();
    if (!checkRateLimit(`cleanup:${session.email}`, 20, 60 * 60 * 1000)) return rateLimitedResponse();

    if (!REPLICATE_API_TOKEN)
      return Response.json(
        { error: 'AI cleanup engine is not connected yet. Add REPLICATE_API_TOKEN in Vercel Project Settings > Environment Variables, then redeploy.' },
        { status: 503 }
      );

    const body = await request.json().catch(() => ({}));
    const { image } = body || {};
    if (!image) return Response.json({ error: 'No image was provided.' }, { status: 400 });

    // Replicate file inputs need a fetchable https:// URL, so the incoming
    // data URI is hosted on Vercel Blob first (private upload + presigned URL).
    let imageUrl;
    try {
      imageUrl = await uploadImageToBlob(image, uniqueImageName('nhance-cleanup'));
    } catch (err) {
      return Response.json({ error: err.message || 'Could not prepare the image for cleanup.' }, { status: err.status || 400 });
    }

    const prediction = await callReplicate(`/models/${REPLICATE_MODEL}/predictions`, {
      method: 'POST',
      body: JSON.stringify({ input: buildModelInput(imageUrl) }),
    });

    let current = prediction;
    const predictionId = prediction.id;
    for (let i = 0; i < MAX_POLLS; i += 1) {
      if (['succeeded', 'failed', 'canceled'].includes(current.status)) break;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      current = await callReplicate(`/predictions/${predictionId}`);
    }

    if (current.status !== 'succeeded')
      return Response.json(
        { error: friendlyReplicateError(safeMessage(current.error, `AI cleanup did not complete. Current status: ${current.status}`)), status: current.status, model: REPLICATE_MODEL },
        { status: 500 }
      );

    const cleanedUrl = extractImageUrl(current.output);
    if (!cleanedUrl)
      return Response.json({ error: 'The cleanup model completed but did not return an image URL.', model: REPLICATE_MODEL }, { status: 500 });

    return Response.json({ cleanedUrl, status: current.status, model: REPLICATE_MODEL, qualityMode: 'AI Cleanup (repaint)' });
  } catch (error) {
    return Response.json({ error: friendlyReplicateError(error.message), model: REPLICATE_MODEL }, { status: 500 });
  }
}
