export const runtime = 'nodejs';
export const maxDuration = 60;

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const RAW_REPLICATE_STAGE_MODEL = process.env.REPLICATE_STAGE_MODEL || 'black-forest-labs/flux-kontext-pro';
const REPLICATE_MODEL = RAW_REPLICATE_STAGE_MODEL === 'proplabs/virtual-staging'
  ? 'black-forest-labs/flux-kontext-pro'
  : RAW_REPLICATE_STAGE_MODEL;

function normalizeRoom(room = '') {
  const value = room.toLowerCase();
  if (value.includes('living')) return 'living room';
  if (value.includes('bed')) return 'bedroom';
  if (value.includes('dining')) return 'dining room';
  if (value.includes('office')) return 'office';
  if (value.includes('kitchen')) return 'kitchen';
  if (value.includes('patio')) return 'balcony';
  if (value.includes('basement')) return 'living room';
  return value || 'living room';
}

function normalizeStyle(style = '') {
  const value = style.toLowerCase();
  if (value.includes('luxury')) return 'luxury neutral';
  if (value.includes('urban')) return 'urban contemporary luxury';
  if (value.includes('minimal')) return 'modern organic minimalist luxury';
  if (value.includes('family')) return 'family friendly transitional luxury';
  return value || 'modern warm luxury neutral';
}

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
  const raw = String(message || '');
  const text = raw.toLowerCase();
  if (text.includes('requested resource could not be found') || text.includes('404') || text.includes('not found')) return `Staging model was not found: ${REPLICATE_MODEL}. Check REPLICATE_STAGE_MODEL in Vercel, then redeploy.`;
  if (text.includes('insufficient credit') || text.includes('purchase credit') || text.includes('billing')) return 'AI staging credit is needed. Add Replicate billing credit, wait a few minutes, then try staging again.';
  if (text.includes('unauthorized') || text.includes('api token') || text.includes('authentication')) return 'AI staging is not authorized yet. Check REPLICATE_API_TOKEN in Vercel Environment Variables, then redeploy.';
  if (text.includes('timeout') || text.includes('timed out')) return 'The staging model timed out. Try a smaller image or redeploy after enabling a longer function duration on your Vercel plan.';
  return raw || 'Virtual staging failed. Check the staging model and Replicate billing settings.';
}

async function callReplicate(path, options = {}) {
  const response = await fetch(`https://api.replicate.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.detail || data?.error || `Replicate request failed with ${response.status}`;
    throw new Error(friendlyReplicateError(typeof message === 'string' ? message : JSON.stringify(message)));
  }
  return data;
}

function buildPrompt({ room, style, density, notes }) {
  return [
    `Create a premium MLS-quality virtually staged ${normalizeRoom(room)} from this empty real estate photo.`,
    `Use ${normalizeStyle(style)} design: warm neutral palette, elevated modern furniture, soft textures, tasteful art, realistic lighting, and high-end listing presentation.`,
    `Furniture density: ${(density || 'balanced').toLowerCase()} but keep the space open and believable.`,
    'Match the exact camera angle, wall geometry, flooring, windows, doors, trim, stairs, outlets, ceiling lights, and room dimensions.',
    'Furniture must be realistically scaled, grounded to the floor, and aligned to the room perspective. Do not block important windows or doors.',
    'Preserve natural daylight through windows, clean white balance, controlled highlights, sharp details, and a polished DSLR real estate photography finish.',
    'Do not change architecture, wall layout, flooring, windows, doors, ceiling, stairs, exterior view, or permanent property features.',
    'Do not add people, text, watermarks, distorted furniture, impossible reflections, extra windows, fake doors, or structural changes.',
    notes ? `Client notes: ${notes}` : ''
  ].filter(Boolean).join(' ');
}

function buildModelInput(image, body) {
  const model = REPLICATE_MODEL.toLowerCase();
  const prompt = buildPrompt(body);
  if (model.includes('flux-kontext') || model.includes('flux-2')) {
    return { input_image: image, prompt, output_format: 'jpg', safety_tolerance: 2, prompt_upsampling: true };
  }
  return { image, input_image: image, room_type: normalizeRoom(body.room), design_style: normalizeStyle(body.style), style: normalizeStyle(body.style), prompt };
}

export async function POST(request) {
  try {
    if (!REPLICATE_API_TOKEN) return Response.json({ error: 'Virtual staging engine is not connected yet. Add REPLICATE_API_TOKEN in Vercel Project Settings > Environment Variables, then redeploy.' }, { status: 503 });
    const body = await request.json();
    const { image } = body;
    if (!image) return Response.json({ error: 'No room image was provided.' }, { status: 400 });
    const prediction = await callReplicate(`/models/${REPLICATE_MODEL}/predictions`, { method: 'POST', body: JSON.stringify({ input: buildModelInput(image, body) }) });
    let current = prediction;
    const predictionId = prediction.id;
    for (let i = 0; i < 28; i += 1) {
      if (['succeeded', 'failed', 'canceled'].includes(current.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      current = await callReplicate(`/predictions/${predictionId}`);
    }
    if (current.status !== 'succeeded') return Response.json({ error: friendlyReplicateError(current.error || `Virtual staging did not complete. Current status: ${current.status}`), status: current.status, model: REPLICATE_MODEL, configuredModel: RAW_REPLICATE_STAGE_MODEL }, { status: 500 });
    const stagedUrl = extractImageUrl(current.output);
    if (!stagedUrl) return Response.json({ error: 'The staging model completed but did not return an image URL.', model: REPLICATE_MODEL, configuredModel: RAW_REPLICATE_STAGE_MODEL }, { status: 500 });
    return Response.json({ stagedUrl, output: current.output, status: current.status, model: REPLICATE_MODEL, configuredModel: RAW_REPLICATE_STAGE_MODEL, qualityMode: 'Premium MLS Luxury' });
  } catch (error) {
    return Response.json({ error: friendlyReplicateError(error.message), model: REPLICATE_MODEL, configuredModel: RAW_REPLICATE_STAGE_MODEL }, { status: 500 });
  }
}
