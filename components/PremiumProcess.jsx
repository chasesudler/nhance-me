'use client';
import { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { AlertCircle, Download, UploadCloud, WandSparkles, Trash2 } from 'lucide-react';

const MAX = 50;
const CONC = 2;
const clamp = (v, min = 0, max = 255) => Math.max(min, Math.min(max, v));

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    r.onload = () =>
      resolve({ id: newId(), file, name: file.name, url: r.result, status: 'Ready', enhanced: null, error: '', mode: null });
    r.readAsDataURL(file);
  });
}

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function rgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const f = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

// Reference-look grade (rebuilt 2026-11-06 against Chase's reference photo:
// bright, neutral, airy MLS quality). Every step is deterministic work on
// the original pixels — no generative model touches the Enhance path, so
// nothing can be invented or hallucinated:
// 1) Auto white balance from bright-but-not-blown, low-saturation pixels
//    (white trim and ceilings reveal the illuminant; windows are excluded).
// 2) Light-imbalance flattening: a median-cell luminance field divides out
//    broad lighting gradients, capped to about +-8%. Medians matter here:
//    a bright light or window barely moves a cell median, so the field
//    never digs a dark moat around bright objects (the classic halo).
//    There is deliberately NO local-contrast step anywhere in this grade —
//    local contrast is what draws halos around lights and window frames.
// 3) Adaptive exposure: a per-photo gain targets a bright median, applied
//    through a luminance-ratio filmic shoulder so window detail survives
//    instead of clipping to white.
// 4) Gentle contrast + natural saturation, with the whites kept clean.
// Stats are measured on a downscaled copy, then applied at full resolution.
function boxBlurField(f, w, h, radius, passes) {
  let cur = f;
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(cur);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0, n = 0;
      for (let xx = Math.max(0, x - radius); xx <= Math.min(w - 1, x + radius); xx++) { sum += cur[y * w + xx]; n++; }
      tmp[y * w + x] = sum / n;
    }
    const out = new Float32Array(tmp);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0, n = 0;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(h - 1, y + radius); yy++) { sum += tmp[yy * w + x]; n++; }
      out[y * w + x] = sum / n;
    }
    cur = out;
  }
  return cur;
}

function sampleField(field, x, y, W, H) {
  const fx = Math.min(field.w - 1.001, Math.max(0, (x / W) * field.w - 0.5));
  const fy = Math.min(field.h - 1.001, Math.max(0, (y / H) * field.h - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const d = field.data, w = field.w;
  const a = d[y0 * w + x0], b = d[y0 * w + x0 + 1], c = d[(y0 + 1) * w + x0], e = d[(y0 + 1) * w + x0 + 1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + e) * tx * ty;
}

function gradeStats(img) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 900 / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const total = d.length / 4;
  const sw = canvas.width, sh = canvas.height;
  const lumArr = new Float32Array(total);

  const lumHist = new Float64Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const y = lum(d[i], d[i + 1], d[i + 2]);
    lumArr[p] = y;
    lumHist[Math.round(y)] += 1;
  }
  const pct = (p) => {
    const target = (p / 100) * total;
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += lumHist[v]; if (acc >= target) return v; }
    return 255;
  };
  const med = pct(50), lo = pct(55), hi = pct(97);

  const chanHist = [new Float64Array(256), new Float64Array(256), new Float64Array(256)];
  let masked = 0, sumR = 0, sumG = 0, sumB = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    sumR += r; sumG += g; sumB += b;
    const y = lum(r, g, b);
    if (y < lo || y > hi) continue;
    const mx = Math.max(r, g, b);
    const sat = mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0;
    if (sat >= 0.2) continue;
    chanHist[0][Math.round(r)] += 1;
    chanHist[1][Math.round(g)] += 1;
    chanHist[2][Math.round(b)] += 1;
    masked += 1;
  }
  let est;
  if (masked > 200) {
    const histMedian = (hist) => {
      const target = masked / 2;
      let acc = 0;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v; }
      return 255;
    };
    est = [histMedian(chanHist[0]), histMedian(chanHist[1]), histMedian(chanHist[2])];
  } else {
    est = [sumR / total, sumG / total, sumB / total];
  }
  const gray = (est[0] + est[1] + est[2]) / 3;
  let gains = est.map((e) => Math.min(1.3, Math.max(0.78, gray / Math.max(e, 1))));
  gains = gains.map((g) => 1 + (g - 1) * 0.9);
  const anchor = gains[1] || 1;
  gains = gains.map((g) => g / anchor);

  // Illumination field (light imbalance): per-cell MEDIAN luminance on a
  // 64-wide grid, blurred, stored as a correction ratio toward the field
  // median and capped to about +-8%. Because each cell is a median, small
  // bright sources (ceiling lights, windows) cannot pull the field up and
  // leave a dark halo moat around themselves.
  const iw = 128, ih = Math.max(6, Math.round((128 * sh) / sw));
  const cellField = new Float32Array(iw * ih);
  for (let cy = 0; cy < ih; cy++) {
    const y0 = Math.floor((cy * sh) / ih), y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * sh) / ih));
    for (let cx = 0; cx < iw; cx++) {
      const x0 = Math.floor((cx * sw) / iw), x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * sw) / iw));
      const vals = [];
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) vals.push(lumArr[yy * sw + xx]);
      vals.sort((a, b) => a - b);
      cellField[cy * iw + cx] = vals[Math.floor(vals.length / 2)] || 0;
    }
  }
  const illumRaw = boxBlurField(cellField, iw, ih, 3, 3);
  const sorted = [...illumRaw].sort((a, b) => a - b);
  const fieldMed = sorted[Math.floor(sorted.length / 2)] || 1;
  const illumData = new Float32Array(illumRaw.length);
  for (let i = 0; i < illumRaw.length; i++) {
    illumData[i] = Math.min(1.10, Math.max(0.90, fieldMed / Math.max(illumRaw[i], 8)));
  }

  return { gains, med, illum: { data: illumData, w: iw, h: ih } };
}

const PRESET_TARGETS = { 'luxury-dslr': 183, 'bright-interior': 194, 'listing-standard': 172 };

function grade(imageData, settings, stats) {
  const d = imageData.data;
  const W = imageData.width, H = imageData.height;
  const integrity = settings.integrity !== false;
  // Integrity OFF = "creative boost": stronger contrast/saturation/sharpening.
  const boost = integrity ? 1 : 1.6;
  const [gr, gg, gb] = stats.gains;

  // Adaptive exposure: solve the gain so the shoulder maps the median
  // luminance to the preset target (183 = the bright MLS level measured
  // from Chase's reference photo).
  const TARGET = PRESET_TARGETS[settings.preset] || 183;
  const tNeed = 150 - 105 * Math.log(1 - (TARGET - 150) / 105);
  let gAuto = tNeed / Math.max(stats.med, 1);
  gAuto = Math.min(2.6, Math.max(1, gAuto));
  const gain = gAuto * (1 + ((settings.exposure - 10) / 160) * boost);
  // A photo that is already bright gets a high, gentle knee so the grade
  // polishes it instead of darkening it.
  const KNEE = gain <= 1.01 ? 200 : 150;
  const SPAN = gain <= 1.01 ? 55 : 105;

  const contrast = 1 + 0.06 * boost + ((settings.clarity - 20) / 280) * boost;
  const satBase = settings.preset === 'bright-interior' ? 1.04 : 1.02;
  const sat = satBase + ((settings.color - 16) / 190) * boost;

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const px = p % W, py = (p / W) | 0;

    // White balance, then light-imbalance flattening. Every step here is
    // either per-pixel or driven by an ultra-smooth field, so nothing in
    // the chain can draw an edge or a halo.
    let r = d[i] * gr, g = d[i + 1] * gg, b = d[i + 2] * gb;
    const ill = sampleField(stats.illum, px, py, W, H);
    r *= ill; g *= ill; b *= ill;

    const y = lum(r, g, b);
    const yg = y * gain;
    const yNew = yg <= KNEE ? yg : KNEE + SPAN * (1 - Math.exp(-(yg - KNEE) / SPAN));
    const ratio = Math.min(3.2, Math.max(0, y > 0.5 ? yNew / Math.max(y, 1e-6) : gain));
    r *= ratio; g *= ratio; b *= ratio;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    let [hh, ss, ll] = hsl(clamp(r), clamp(g), clamp(b));
    ss = Math.min(0.86, ss * sat * (ll > 0.85 ? 0.92 : 1));
    [r, g, b] = rgb(hh, ss, ll);

    d[i] = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }
  return imageData;
}

function sharpen(imageData, amount = 0.06) {
  const { data, width, height } = imageData;
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[idx + c] * 4;
        const near = copy[idx - 4 + c] + copy[idx + 4 + c] + copy[idx - width * 4 + c] + copy[idx + width * 4 + c];
        data[idx + c] = clamp(copy[idx + c] + (center - near) * amount);
      }
    }
  }
  return imageData;
}

// Spatial correction is MANUAL by design (added 2026-11-06): automatic
// tilt detection was tested against real interiors and could not reliably
// tell camera roll from ordinary perspective — it rotated photos that were
// already straight. So the user straightens with sliders and sees the exact
// result; the app never warps a room on a guess. Both transforms are plain
// resampling of the original pixels.
function applySpatial(src, settings) {
  const straighten = settings.straighten || 0;
  const verticals = settings.verticals || 0;
  if (!straighten && !verticals) return src;
  let cur = src;
  if (verticals) {
    // Keystone: horizontal strips drawn with a width scale that varies
    // linearly from top to bottom (widens one end, narrows the other).
    const k = (verticals / 100) * 0.16;
    const W = cur.width, H = cur.height, N = 40;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (let j = 0; j < N; j++) {
      const t0 = j / N, tc = (j + 0.5) / N;
      const s = 1 + k * (0.5 - tc) * 2;
      const sh = H / N + 1;
      ctx.drawImage(cur, 0, t0 * H, W, sh, (W - W * s) / 2, t0 * H, W * s, sh);
    }
    cur = out;
  }
  if (straighten) {
    // Rotate, then crop to the inscribed rectangle so no wedge edges show.
    const rad = (straighten * Math.PI) / 180;
    const th = Math.abs(rad);
    const W = cur.width, H = cur.height;
    const cw = Math.round(W * Math.cos(th) - H * Math.sin(th));
    const ch = Math.round(H * Math.cos(th) - W * Math.sin(th));
    if (cw >= W * 0.85 && ch >= H * 0.85) {
      const out = document.createElement('canvas');
      out.width = cw; out.height = ch;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rad);
      ctx.drawImage(cur, -W / 2, -H / 2);
      cur = out;
    }
  }
  return cur;
}

function crop43(src) {
  const W = src.width, H = src.height;
  const target = W >= H ? 4 / 3 : 3 / 4;
  if (Math.abs(W / H - target) < 0.01) return src;
  let cw = W, ch = H;
  if (W / H > target) cw = Math.round(H * target);
  else ch = Math.round(W / target);
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  const ctx = out.getContext('2d');
  ctx.drawImage(src, (W - cw) / 2, (H - ch) / 2, cw, ch, 0, 0, cw, ch);
  return out;
}

function enhanceLocal(item, settings) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error(`Could not decode ${item.name}. The file may be corrupt.`));
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 2600 / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const work = applySpatial(canvas, settings);
        const stats = gradeStats(work);
        const wctx = work.getContext('2d', { willReadFrequently: true });
        let data = wctx.getImageData(0, 0, work.width, work.height);
        data = grade(data, settings, stats);
        const boost = settings.integrity !== false ? 1 : 1.6;
        data = sharpen(data, Math.max(0.018, (settings.clarity / 760) * boost));
        wctx.putImageData(data, 0, 0);
        resolve(crop43(work).toDataURL('image/jpeg', 0.94));
      } catch (err) {
        reject(new Error(`Could not process ${item.name}.`));
      }
    };
    img.src = item.url;
  });
}

async function asBlob(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error('Failed to fetch image for download.');
  return res.blob();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); // required for Safari
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const safeName = (name) => name.replace(/\.[^.]+$/, '');

export default function PremiumProcess() {
  const [items, setItems] = useState([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');
  const inputRef = useRef(null);
  const [settings, setSettings] = useState({
    preset: 'luxury-dslr',
    exposure: 10,
    color: 16,
    clarity: 20,
    straighten: 0,
    verticals: 0,
    integrity: true,
  });

  const completed = useMemo(() => items.filter((i) => i.enhanced).length, [items]);
  const localCount = useMemo(() => items.filter((i) => i.mode === 'local').length, [items]);
  const errored = useMemo(() => items.filter((i) => i.error).length, [items]);

  async function addFiles(files) {
    const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, MAX - items.length);
    if (!picked.length) return;
    const results = await Promise.allSettled(picked.map(readFile));
    const loaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const failedCount = results.length - loaded.length;
    if (loaded.length) setItems((prev) => [...prev, ...loaded]);
    setBanner(failedCount ? `${failedCount} file(s) could not be read and were skipped.` : '');
  }

  function resetInput(el) {
    if (el) el.value = '';
  }

  async function processOne(item) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'Applying Premium MLS studio grade', error: '' } : i)));
    try {
      const localBase = await enhanceLocal(item, settings);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                enhanced: localBase,
                mode: 'local',
                status: 'Complete - Premium MLS studio grade',
                error: '',
              }
            : i
        )
      );
      return { mode: 'local' };
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'Failed', error: err.message || 'Could not process this image.' } : i))
      );
      return { mode: 'failed' };
    }
  }

  async function runBatch() {
    setBusy(true);
    setBanner('');
    try {
      const queue = items.filter((i) => !i.enhanced || i.error);
      let index = 0;
      let done = 0;
      let failed = 0;
      async function worker() {
        while (index < queue.length) {
          const result = await processOne(queue[index++]);
          if (result?.mode === 'local') done++;
          else if (result?.mode === 'failed') failed++;
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONC, queue.length || 1) }, worker));
      if (done) setBanner(`Batch finished. ${done} image(s) enhanced with the deterministic studio grade — original pixels only, nothing invented.${failed ? ` ${failed} could not be processed.` : ''}`);
      else if (failed) setBanner(`${failed} image(s) could not be processed.`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadAll() {
    try {
      const zip = new JSZip();
      const list = items.filter((i) => i.enhanced);
      for (let idx = 0; idx < list.length; idx++) {
        const item = list[idx];
        const blob = await asBlob(item.enhanced);
        zip.file(`nhance-me-enhanced-${idx + 1}-${safeName(item.name)}.jpg`, await blob.arrayBuffer());
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, 'nhance-me-enhanced-batch.zip');
    } catch {
      setBanner('Some downloads failed (the AI-hosted image may have expired). Try downloading images individually.');
    }
  }

  async function downloadOne(item) {
    try {
      const blob = await asBlob(item.enhanced);
      triggerDownload(blob, `nhance-me-enhanced-${safeName(item.name)}.jpg`);
    } catch {
      setBanner(`Could not download ${item.name}. The hosted image may have expired — re-run the batch.`);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Enhance Batch</h1>
          <p className="small">Upload up to 50 images. Premium MLS mode protects highlights, preserves clean whites, and adds natural DSLR polish.</p>
        </div>
        <button disabled={!completed} onClick={downloadAll} className="btn btn-orange">
          <Download size={17} /> Download ZIP
        </button>
      </div>

      <div className="card">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          className={`upload-zone ${drag ? 'drag' : ''}`}
        >
          <UploadCloud size={42} />
          <h2>Drop listing photos here</h2>
          <p className="small">
            Or use the upload button. Current batch: {items.length}/{MAX}. Complete: {completed}. Studio grade: {localCount}
            {errored ? `. Failed: ${errored}` : ''}.
          </p>
          <input
            ref={inputRef}
            hidden
            multiple
            accept="image/*"
            type="file"
            onChange={(e) => { addFiles(e.target.files); resetInput(e.target); }}
          />
          <button className="btn btn-primary" onClick={() => inputRef.current.click()}>
            Upload images
          </button>
        </div>

        <div className="toolbar">
          <button disabled={!items.length || busy} onClick={runBatch} className="btn btn-primary">
            <WandSparkles size={17} /> {busy ? 'Processing...' : 'Enhance batch'}
          </button>
          <button disabled={!items.length || busy} onClick={() => { setItems([]); setBanner(''); }} className="btn btn-ghost">
            <Trash2 size={17} /> Clear
          </button>
          <span className="pill">Premium MLS grade</span>
          <span className="pill">Highlight protected</span>
          <span className="pill">No AI — original pixels only</span>
          <span className="pill">4:3 output</span>
        </div>

        <div className="range-grid">
          <div className="field">
            <label>Enhancement preset</label>
            <select value={settings.preset} onChange={(e) => setSettings({ ...settings, preset: e.target.value })}>
              <option value="luxury-dslr">Premium MLS Luxury</option>
              <option value="bright-interior">Bright Interior</option>
              <option value="listing-standard">Balanced Listing</option>
            </select>
          </div>
          <div className="field">
            <label>Lighting lift</label>
            <input type="range" min="0" max="35" value={settings.exposure} onChange={(e) => setSettings({ ...settings, exposure: +e.target.value })} />
          </div>
          <div className="field">
            <label>Color depth</label>
            <input type="range" min="0" max="35" value={settings.color} onChange={(e) => setSettings({ ...settings, color: +e.target.value })} />
          </div>
          <div className="field">
            <label>DSLR clarity</label>
            <input type="range" min="0" max="35" value={settings.clarity} onChange={(e) => setSettings({ ...settings, clarity: +e.target.value })} />
          </div>
          <div className="field">
            <label>Straighten (tilt) {settings.straighten ? `${settings.straighten}°` : ''}</label>
            <input type="range" min="-5" max="5" step="0.1" value={settings.straighten} onChange={(e) => setSettings({ ...settings, straighten: +e.target.value })} />
          </div>
          <div className="field">
            <label>Verticals (keystone) {settings.verticals ? `${settings.verticals}` : ''}</label>
            <input type="range" min="-100" max="100" step="1" value={settings.verticals} onChange={(e) => setSettings({ ...settings, verticals: +e.target.value })} />
          </div>
        </div>

        <div className="switch-row" style={{ marginTop: 14 }}>
          <div>
            <b>Integrity mode</b>
            <p className="small" style={{ margin: '4px 0 0' }}>
              {settings.integrity
                ? 'ON — faithful edits only: no invented details, highlights protected.'
                : 'OFF — creative boost: stronger contrast, color, and sharpening.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.integrity}
            onClick={() => setSettings({ ...settings, integrity: !settings.integrity })}
            className="btn btn-ghost"
            style={{ minWidth: 90 }}
          >
            {settings.integrity ? 'ON' : 'OFF'}
          </button>
        </div>

        {banner && (
          <div className="notice" style={{ marginTop: 16 }}>
            <AlertCircle size={17} />
            <span>{banner}</span>
          </div>
        )}
        <p className="small">
          <b>Batch consistency:</b> every image receives the same Premium MLS recipe — white balance, even lighting, protected highlights — and comes out at 4:3. Spatial fixes stay in your hands: set Straighten or Verticals when a shot needs it, and the app never warps a room on a guess.
        </p>
      </div>

      <section className="section">
        <div className="image-grid">
          {items.map((i) => (
            <div className="image-item" key={i.id}>
              <div className="image-preview">
                <img src={i.enhanced || i.url} alt={i.name} />
              </div>
              <div className="image-body">
                <b>{i.name}</b>
                <p className="small">{i.status}</p>
                {i.error && <p className="small" style={{ color: '#b45309' }}>{i.error}</p>}
                {i.enhanced && (
                  <button onClick={() => downloadOne(i)} className="btn btn-ghost" style={{ width: '100%' }}>
                    Download JPG
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
