'use client';
import AppShell from '@/components/AppShell';
import { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { AlertCircle, Download, UploadCloud, WandSparkles, Trash2 } from 'lucide-react';

const MAX_FILES = 50;
const CONCURRENCY = 2;
const clamp = (v, min = 0, max = 255) => Math.max(min, Math.min(max, v));

function readFile(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = () => resolve({ id: crypto.randomUUID(), file, name: file.name, url: r.result, status: 'Ready', enhanced: null, error: '' });
    r.readAsDataURL(file);
  });
}

function percentileFromHistogram(hist, total, pct) {
  const target = total * pct;
  let running = 0;
  for (let i = 0; i < 256; i++) {
    running += hist[i];
    if (running >= target) return i;
  }
  return 255;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

function applyLuxuryDslrGrade(imageData, settings) {
  const d = imageData.data;
  const total = d.length / 4;
  const hr = new Array(256).fill(0), hg = new Array(256).fill(0), hb = new Array(256).fill(0);
  let avgR = 0, avgG = 0, avgB = 0;

  for (let i = 0; i < d.length; i += 4) {
    hr[d[i]]++; hg[d[i + 1]]++; hb[d[i + 2]]++;
    avgR += d[i]; avgG += d[i + 1]; avgB += d[i + 2];
  }

  avgR /= total; avgG /= total; avgB /= total;
  const avg = (avgR + avgG + avgB) / 3;
  const wr = avg / Math.max(1, avgR), wg = avg / Math.max(1, avgG), wb = avg / Math.max(1, avgB);

  const lowR = percentileFromHistogram(hr, total, 0.006), highR = percentileFromHistogram(hr, total, 0.992);
  const lowG = percentileFromHistogram(hg, total, 0.006), highG = percentileFromHistogram(hg, total, 0.992);
  const lowB = percentileFromHistogram(hb, total, 0.006), highB = percentileFromHistogram(hb, total, 0.992);

  const exposure = 1 + settings.exposure / 110;
  const contrast = 1 + settings.clarity / 130;
  const saturationBoost = 1 + settings.color / 105;
  const shadowLift = 18 + settings.exposure * 0.45;
  const warmLuxury = settings.preset === 'luxury-dslr' ? 1.035 : 1.015;
  const coolShadow = settings.preset === 'luxury-dslr' ? 1.018 : 1.006;

  for (let i = 0; i < d.length; i += 4) {
    let r = ((d[i] * wr - lowR) / Math.max(1, highR - lowR)) * 255;
    let g = ((d[i + 1] * wg - lowG) / Math.max(1, highG - lowG)) * 255;
    let b = ((d[i + 2] * wb - lowB) / Math.max(1, highB - lowB)) * 255;

    r = clamp(r * exposure);
    g = clamp(g * exposure);
    b = clamp(b * exposure);

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const shadowMask = Math.max(0, 1 - luma / 155);
    const highlightMask = Math.max(0, (luma - 178) / 77);

    r += shadowLift * shadowMask;
    g += shadowLift * shadowMask;
    b += shadowLift * shadowMask;

    r -= 16 * highlightMask;
    g -= 16 * highlightMask;
    b -= 16 * highlightMask;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    r *= warmLuxury;
    b *= 1 + coolShadow * shadowMask * 0.03;

    let [h, s, l] = rgbToHsl(clamp(r), clamp(g), clamp(b));
    const vibrance = 1 + (settings.color / 75) * (1 - s);
    s = Math.min(0.96, s * saturationBoost * vibrance);
    l = Math.min(0.96, Math.pow(l, 0.92));
    [r, g, b] = hslToRgb(h, s, l);

    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
  return imageData;
}

function sharpenImageData(imageData, amount = 0.22) {
  const { data, width, height } = imageData;
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[idx + c] * 5;
        const neighbors = copy[idx - 4 + c] + copy[idx + 4 + c] + copy[idx - width * 4 + c] + copy[idx + width * 4 + c];
        data[idx + c] = clamp(copy[idx + c] + (center - neighbors) * amount);
      }
    }
  }
  return imageData;
}

function addFinishingPass(ctx, canvas, settings) {
  if (settings.windowPull) {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, 'rgba(255,255,255,.10)');
    g.addColorStop(0.48, 'rgba(255,255,255,.025)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (settings.skySafe) {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.42);
    sky.addColorStop(0, 'rgba(74, 157, 231, .18)');
    sky.addColorStop(1, 'rgba(74, 157, 231, 0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.42);
  }

  if (settings.preset === 'luxury-dslr') {
    const v = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.25, canvas.width / 2, canvas.height / 2, canvas.width * 0.78);
    v.addColorStop(0, 'rgba(255,255,255,0)');
    v.addColorStop(1, 'rgba(10,24,46,.10)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function enhanceImageLocally(item, settings) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 3200;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      imageData = applyLuxuryDslrGrade(imageData, settings);
      imageData = sharpenImageData(imageData, settings.clarity / 175);
      ctx.putImageData(imageData, 0, 0);
      addFinishingPass(ctx, canvas, settings);

      resolve(canvas.toDataURL('image/jpeg', 0.96));
    };
    img.src = item.url;
  });
}

async function enhanceImageViaApi(item, settings) {
  const response = await fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: item.url, name: item.name, settings })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'AI enhancement failed.');
  return data;
}

async function fetchAsBlob(src) {
  if (src.startsWith('data:')) {
    const res = await fetch(src);
    return res.blob();
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error('Failed to fetch generated image.');
  return res.blob();
}

export default function Process() {
  const [items, setItems] = useState([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');
  const inputRef = useRef(null);
  const [settings, setSettings] = useState({
    preset: 'luxury-dslr',
    exposure: 24,
    color: 30,
    clarity: 34,
    verticals: 1,
    skySafe: true,
    windowPull: true,
    integrity: true
  });
  const completed = useMemo(() => items.filter(i => i.enhanced).length, [items]);
  const failed = useMemo(() => items.filter(i => i.error).length, [items]);

  async function addFiles(files) {
    const picked = [...files].filter(f => f.type.startsWith('image/')).slice(0, MAX_FILES - items.length);
    const loaded = await Promise.all(picked.map(readFile));
    setItems(prev => [...prev, ...loaded]);
    setBanner('');
  }

  async function processOne(item) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'Preparing luxury grade', error: '' } : i));
    const localBase = await enhanceImageLocally(item, settings);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'Sending to AI enhancement engine' } : i));

    try {
      const data = await enhanceImageViaApi({ ...item, url: localBase }, settings);
      setItems(prev => prev.map(i => i.id === item.id ? {
        ...i,
        enhanced: data.enhancedUrl || data.enhancedDataUrl || localBase,
        status: data.mode === 'browser-fallback'
          ? 'Complete - Browser fallback grade'
          : `Complete - AI enhanced${data.model ? ` (${data.model})` : ''}`,
        error: ''
      } : i));
      return data;
    } catch (err) {
      setItems(prev => prev.map(i => i.id === item.id ? {
        ...i,
        enhanced: localBase,
        status: 'Complete - Local luxury fallback',
        error: err.message || 'AI enhancement unavailable. Falling back to local grade.'
      } : i));
      return { mode: 'browser-fallback' };
    }
  }

  async function runBatch() {
    setBusy(true);
    setBanner('');
    const queue = items.filter(item => !item.enhanced || item.error);
    let index = 0;
    let aiCount = 0;
    let fallbackCount = 0;

    async function worker() {
      while (index < queue.length) {
        const current = queue[index++];
        const result = await processOne(current);
        if (result?.mode === 'browser-fallback') fallbackCount += 1;
        else aiCount += 1;
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
    setBusy(false);
    if (fallbackCount && !aiCount) {
      setBanner('AI enhancement is not connected yet, so the batch finished with the local luxury fallback. Add REPLICATE_API_TOKEN in Vercel to enable production AI enhancement.');
    } else if (fallbackCount && aiCount) {
      setBanner(`Batch finished. ${aiCount} image(s) used the production AI engine and ${fallbackCount} used the local luxury fallback.`);
    } else if (aiCount) {
      setBanner(`Batch finished. ${aiCount} image(s) were enhanced through the production AI pipeline.`);
    }
  }

  async function downloadAll() {
    const zip = new JSZip();
    const enhancedItems = items.filter(i => i.enhanced);
    for (let idx = 0; idx < enhancedItems.length; idx += 1) {
      const i = enhancedItems[idx];
      const blob = await fetchAsBlob(i.enhanced);
      const arrayBuffer = await blob.arrayBuffer();
      zip.file(`nhance-me-luxury-${idx + 1}-${i.name.replace(/\.[^.]+$/, '')}.jpg`, arrayBuffer);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nhance-me-luxury-enhanced-batch.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function downloadOne(i) {
    const blob = await fetchAsBlob(i.enhanced);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nhance-me-luxury-${i.name.replace(/\.[^.]+$/, '')}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return <AppShell>
    <div className="topbar">
      <div>
        <h1>Enhance Batch</h1>
        <p className="small">Upload up to 50 images. Each photo gets the luxury DSLR pre-grade first, then the production AI engine enhances crispness and output quality for a stronger premium listing finish.</p>
      </div>
      <button disabled={!completed} onClick={downloadAll} className="btn btn-orange"><Download size={17}/> Download ZIP</button>
    </div>

    <div className="card">
      <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }} className={`upload-zone ${drag ? 'drag' : ''}`}>
        <UploadCloud size={42}/>
        <h2>Drop listing photos here</h2>
        <p className="small">Or use the upload button. JPG, PNG and WEBP are supported. Current batch: {items.length}/{MAX_FILES}. Complete: {completed}. Failed/fallback: {failed}.</p>
        <input ref={inputRef} hidden multiple accept="image/*" type="file" onChange={e => addFiles(e.target.files)}/>
        <button className="btn btn-primary" onClick={() => inputRef.current.click()}>Upload images</button>
      </div>

      <div className="toolbar">
        <button disabled={!items.length || busy} onClick={runBatch} className="btn btn-primary"><WandSparkles size={17}/> {busy ? 'Processing...' : 'Enhance batch'}</button>
        <button disabled={!items.length || busy} onClick={() => { setItems([]); setBanner(''); }} className="btn btn-ghost"><Trash2 size={17}/> Clear</button>
        <span className="pill">Luxury DSLR pre-grade</span>
        <span className="pill">Production AI upscale</span>
        <span className="pill">Integrity mode {settings.integrity ? 'ON' : 'OFF'}</span>
      </div>

      <div className="range-grid">
        <div className="field"><label>Enhancement preset</label><select value={settings.preset} onChange={e => setSettings({ ...settings, preset: e.target.value })}><option value="luxury-dslr">Luxury DSLR Listing</option><option value="bright-interior">Bright Interior</option><option value="listing-standard">Balanced Listing</option></select></div>
        <div className="field"><label>Perfect-lighting lift</label><input type="range" min="0" max="55" value={settings.exposure} onChange={e => setSettings({ ...settings, exposure: +e.target.value })}/></div>
        <div className="field"><label>Luxury color depth</label><input type="range" min="0" max="55" value={settings.color} onChange={e => setSettings({ ...settings, color: +e.target.value })}/></div>
        <div className="field"><label>DSLR clarity/sharpness</label><input type="range" min="0" max="55" value={settings.clarity} onChange={e => setSettings({ ...settings, clarity: +e.target.value })}/></div>
      </div>

      <div className="range-grid">
        <label className="switch-row"><span>Window pull highlight recovery</span><input type="checkbox" checked={settings.windowPull} onChange={e => setSettings({ ...settings, windowPull: e.target.checked })}/></label>
        <label className="switch-row"><span>Sky-safe exterior polish</span><input type="checkbox" checked={settings.skySafe} onChange={e => setSettings({ ...settings, skySafe: e.target.checked })}/></label>
        <label className="switch-row"><span>No-hallucination integrity mode</span><input type="checkbox" checked={settings.integrity} onChange={e => setSettings({ ...settings, integrity: e.target.checked })}/></label>
      </div>

      {banner && <div className="notice" style={{ marginTop: 16 }}><AlertCircle size={17} /> <span>{banner}</span></div>}
      <p className="small"><b>Batch consistency:</b> every image in the batch receives the same preset and tone recipe so the final set feels like one polished listing shoot. The AI step sharpens/upscales after that grade for a more premium final look.</p>
    </div>

    <section className="section">
      <div className="image-grid">{items.map(i => <div className="image-item" key={i.id}>
        <div className="image-preview"><img src={i.enhanced || i.url} alt={i.name}/></div>
        <div className="image-body">
          <b>{i.name}</b>
          <p className="small">{i.status}</p>
          {i.error && <p className="small" style={{ color: '#b45309' }}>{i.error}</p>}
          {i.enhanced && <button onClick={() => downloadOne(i)} className="btn btn-ghost" style={{ width: '100%' }}>Download luxury JPG</button>}
        </div>
      </div>)}</div>
    </section>
  </AppShell>;
}
