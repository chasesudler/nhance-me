export const runtime = 'nodejs';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_MODEL = process.env.REPLICATE_STAGE_MODEL || 'proplabs/virtual-staging';

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
  if (value.includes('luxury')) return 'transitional luxury';
  if (value.includes('urban')) return 'urban industrial';
  if (value.includes('minimal')) return 'modern organic';
  if (value.includes('family')) return 'transitional';
  return value || 'modern';
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
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data;
}

export async function POST(request) {
  try {
    if (!REPLICATE_API_TOKEN) {
      return Response.json(
        {
          error: 'Virtual staging engine is not connected yet. Add REPLICATE_API_TOKEN in Vercel Project Settings > Environment Variables, then redeploy.'
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { image, room, style, density, notes } = body;

    if (!image) {
      return Response.json({ error: 'No room image was provided.' }, { status: 400 });
    }

    const prompt = [
      `Virtually stage this empty ${normalizeRoom(room)} for a real estate listing.`,
      `Interior style: ${normalizeStyle(style)}.`,
      `Furniture density: ${(density || 'balanced').toLowerCase()}.`,
      'Keep the original walls, windows, doors, flooring, ceiling, room layout, perspective, fixed features, lighting direction, and architectural structure intact.',
      'Add realistic listing-quality furniture and decor only. Do not alter permanent property features.',
      notes ? `Client notes: ${notes}` : ''
    ].filter(Boolean).join(' ');

    const prediction = await callReplicate(`/models/${REPLICATE_MODEL}/predictions`, {
      method: 'POST',
      body: JSON.stringify({
        input: {
          image,
          room_type: normalizeRoom(room),
          design_style: normalizeStyle(style),
          style: normalizeStyle(style),
          prompt
        }
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
          error: current.error || `Virtual staging did not complete. Current status: ${current.status}`,
          status: current.status
        },
        { status: 500 }
      );
    }

    const stagedUrl = extractImageUrl(current.output);
    if (!stagedUrl) {
      return Response.json({ error: 'The staging model completed but did not return an image URL.' }, { status: 500 });
    }

    return Response.json({ stagedUrl, output: current.output, status: current.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Virtual staging failed.' }, { status: 500 });
  }
}
