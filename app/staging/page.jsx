'use client';

import AppShell from '@/components/AppShell';
import { useRef, useState } from 'react';
import { Download, Sofa, UploadCloud, WandSparkles } from 'lucide-react';

function read(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
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
    if (file) {
      setImg(await read(file));
      setResult(null);
      setError('');
      setStatus('Ready to stage');
    }
  }

  async function generate() {
    if (!img || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    setStatus('Generating real virtual staging...');

    try {
      const response = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img, ...job })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Virtual staging failed.');

      setResult(data.stagedUrl);
      setStatus('Staging complete');
    } catch (err) {
      setError(err.message || 'Virtual staging failed.');
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
          <p className="small">Generate real staged room images through the production staging API. Enhancement stays separate from staging so users know when a photo is being materially transformed.</p>
        </div>
      </div>

      <div className="grid-3" style={{ alignItems: 'start' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="upload-zone" onClick={() => input.current.click()}>
            <UploadCloud size={38} />
            <h2>Upload empty room photo</h2>
            <p className="small">Click to upload a room image for real virtual staging.</p>
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
