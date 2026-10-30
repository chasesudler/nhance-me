'use client';
import { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { AlertCircle, Download, UploadCloud, WandSparkles, Trash2 } from 'lucide-react';
import { API_BASE } from '@/lib/apiBase';

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

function grade(imageData, settings) {
  const d = imageData.data;
  const integrity = settings.integrity !== false;
  // Integrity OFF = "creative boost": stronger contrast/saturation/sharpening.
  const boost = integrity ? 1 : 1.6;
  const ex = (settings.exposure / 100) * boost;
  const sat = 1 + (settings.color / 190) * boost;
  const contrast = 1 + (settings.clarity / 280) * boost;
  const lift = 5 + settings.exposure * 0.12;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const y0 = lum(r, g, b);
    const sh = Math.max(0, 1 - y0 / 150);
    const mid = Math.max(0, 1 - Math.abs(y0 - 130) / 130);
    const hi = Math.max(0, (y0 - 178) / 77);

    r += lift * sh + ex * 18 * mid;
    g += lift * sh + ex * 18 * mid;
    b += lift * sh + ex * 18 * mid;

    const y = lum(r, g, b);
    const over = Math.max(0, y - 205);
    if (over) {
      const rec = over * 0.72;
      r -= rec; g -= rec; b -= rec;
    }

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    r *= 1 + 0.012 * (1 - hi);
    b *= 1 - 0.006 * (1 - hi);

    let [hh, ss, ll] = hsl(clamp(r), clamp(g), clamp(b));
    ss = Math.min(0.86, ss * sat);
    ll = Math.min(0.94, ll + 0.018 * sh + 0.008 * mid - 0.02 * hi);
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
        const center = copy[idx + c] * 5;
        const near = copy[idx - 4 + c] + copy[idx + 4 + c] + copy[idx - width * 4 + c] + copy[idx + width * 4 + c];
        data[idx + c] = clamp(copy[idx + c] + (center - near) * amount);
      }
    }
  }
  return imageData;
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
        let data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        data = grade(data, settings);
        const boost = settings.integrity !== false ? 1 : 1.6;
        data = sharpen(data, Math.max(0.025, (settings.clarity / 520) * boost));
        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.94));
      } catch (err) {
        reject(new Error(`Could not process ${item.name}.`));
      }
    };
    img.src = item.url;
  });
}

async function enhanceApi(item, settings) {
  const res = await fetch(`${API_BASE}/api/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: item.url, name: item.name, settings }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'AI enhancement failed.');
  return data;
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
    integrity: true,
  });

  const completed = useMemo(() => items.filter((i) => i.enhanced).length, [items]);
  const aiCount = useMemo(() => items.filter((i) => i.mode === 'ai').length, [items]);
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
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'Applying Premium MLS protected DSLR grade', error: '' } : i)));
    let localBase;
    try {
      localBase = await enhanceLocal(item, settings);
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'Failed', error: err.message || 'Could not process this image.' } : i))
      );
      return { mode: 'failed' };
    }

    try {
      const data = await enhanceApi({ ...item, url: localBase }, settings);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                enhanced: data.enhancedUrl || localBase,
                mode: data.enhancedUrl ? 'ai' : 'local',
                status: `Complete - AI enhanced${data.model ? ` (${data.model})` : ''}`,
                error: '',
              }
            : i
        )
      );
      return { mode: data.enhancedUrl ? 'ai' : 'local' };
    } catch {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                enhanced: localBase,
                mode: 'local',
                status: 'Complete - Premium MLS local grade',
                error: '',
              }
            : i
        )
      );
      return { mode: 'local-fallback' };
    }
  }

  async function runBatch() {
    setBusy(true);
    setBanner('');
    try {
      const queue = items.filter((i) => !i.enhanced || i.error);
      let index = 0;
      let ai = 0;
      let fb = 0;
      async function worker() {
        while (index < queue.length) {
          const result = await processOne(queue[index++]);
          if (result?.mode === 'local-fallback') fb++;
          else if (result?.mode === 'ai') ai++;
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONC, queue.length || 1) }, worker));
      if (fb && !ai) setBanner('AI enhancement did not respond, so the app used the protected Premium MLS local grade. Highlights are capped to prevent white-wall blowout.');
      else if (fb) setBanner(`Batch finished. ${ai} image(s) used AI and ${fb} used the protected local grade.`);
      else if (ai) setBanner(`Batch finished. ${ai} image(s) used the production AI pipeline.`);
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
            Or use the upload button. Current batch: {items.length}/{MAX}. Complete: {completed}. AI: {aiCount}. Local: {localCount}
            {errored ? `. Failed: ${errored}` : ''}.
          </p>
          <input
            ref={inputRef}
            hidden
            multiple
            accept="image/*"
            capture="environment"
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
          <b>Batch consistency:</b> every image receives the same Premium MLS recipe, but highlights are protected so white walls, ceilings, and windows stay natural.
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
