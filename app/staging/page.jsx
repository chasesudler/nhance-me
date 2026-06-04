'use client';

import AppShell from '@/components/AppShell';
import { useRef, useState } from 'react';
import { Download, Sofa, UploadCloud, WandSparkles } from 'lucide-react';

function compressRoomPhoto(file, maxSize = 1400, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the selected image.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || 'The server returned an unreadable response.' };
  }
}

export default function Staging() {
  const [img, setImg] = useState(null);
  const [result, setResult] = useState(null);
  const [job, setJob] = useState({ room: 'Living Room', style: 'Modern Warm', density: 'Balanced', notes: '' });
  const [status, setStatus] = useState('Awaiting image');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatus('Optimizing room photo for staging...');
      setImg(await compressRoomPhoto(file));
      setResult(null);
      setError('');
      setStatus('Ready to stage');
    } catch (err) {
      setError(err.message || 'Image upload failed. Try a JPG under 10MB.');
      setStatus('Upload needs attention');
    }
  }

  async function generate() {
    if (!img || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    setStatus('Generating real virtual staging. This can take up to one minute...');

    try {
      const response = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img, ...job })
      });

      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || `Virtual staging failed with status ${response.status}.`);
      if (!data.stagedUrl) throw new Error('The staging engine completed but did not return an image.');

      setResult(data.stagedUrl);
      setStatus(`Staging complete${data.model ? ` (${data.model})` : ''}`);
    } catch (err) {
      const message = err.message === 'Load failed'
        ? 'The staging request failed before the server could respond. This usually means the photo was too large, the function timed out, or the staging model/billing needs attention. Try again with this optimized upload, then check Vercel Function logs if it repeats.'
        : err.message || 'Virtual staging failed.';
      setError(message);
      setStatus('Staging engine needs attention');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Virtual Staging</h1>
          <p className="small">Generate real staged room images through the production staging API. The app now optimizes mobile uploads before sending them to reduce timeout and payload failures.</p>
        </div>
      </div>

      <div className="grid-3" style={{ alignItems: 'start' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="upload-zone" onClick={() => input.current.click()}>
            <UploadCloud size={38} />
            <h2>Upload empty room photo</h2>
            <p className="small">Click to upload a room image for real virtual staging. Large phone photos are compressed before staging.</p>
            <input ref={input} hidden accept="image/*" type="file" onChange={pick} />
          </div>

          {img && (
            <div className="compare-grid" style={{ marginTop: 16 }}>
              <div className="image-preview" style={{ borderRadius: 18 }}>
                <span className="pill floating-pill">Before</span>
                <img src={img} alt="Original room preview" />
              </div>
              <div className="image-preview" style={{ borderRadius: 18 }}>
                <span className="pill floating-pill">After</span>
                {result ? <img src={result} alt="Virtually staged room" /> : <div className="placeholder-output">{loading ? 'Generating staged room...' : 'Generated staging will appear here.'}</div>}
              </div>
            </div>
          )}

          {error && <div className="notice error-notice">{error}</div>}
          <p className="small">Status: {status}</p>
        </div>

        <div className="card">
          <div className="icon"><Sofa /></div>
          <h2>Staging request</h2>

          <div className="field">
            <label>Room type</label>
            <select value={job.room} onChange={(e) => setJob({ ...job, room: e.target.value })}>
              {['Living Room', 'Bedroom', 'Dining Room', 'Home Office', 'Patio', 'Basement', 'Kitchen'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Style</label>
            <select value={job.style} onChange={(e) => setJob({ ...job, style: e.target.value })}>
              {['Modern Warm', 'Luxury Neutral', 'Urban Contemporary', 'Minimalist', 'Family Friendly'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Furniture density</label>
            <select value={job.density} onChange={(e) => setJob({ ...job, density: e.target.value })}>
              {['Light', 'Balanced', 'Full'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea rows="4" value={job.notes} onChange={(e) => setJob({ ...job, notes: e.target.value })} placeholder="Example: avoid blocking windows, keep flooring visible" />
          </div>

          <button disabled={!img || loading} onClick={generate} className="btn btn-primary" style={{ width: '100%' }}>
            <WandSparkles size={17} /> {loading ? 'Generating...' : 'Generate staging'}
          </button>

          {result && <a className="btn btn-secondary" href={result} download style={{ width: '100%', marginTop: 10 }}><Download size={17} /> Download staged photo</a>}
        </div>
      </div>
    </AppShell>
  );
}
