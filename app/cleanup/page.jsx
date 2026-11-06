'use client';

import AppShell from '@/components/AppShell';
import { useRef, useState } from 'react';
import { Download, Sparkles, UploadCloud } from 'lucide-react';
import { API_BASE } from '@/lib/apiBase';

function compressPhoto(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the selected image.'));
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          reject(new Error('Could not process the selected image.'));
        }
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

function isNetworkError(message = '') {
  return /failed to fetch|load failed|networkerror|network error/i.test(message);
}

export default function Cleanup() {
  const [img, setImg] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('Awaiting image');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    try {
      setStatus('Optimizing photo for cleanup...');
      setImg(await compressPhoto(file));
      setResult(null);
      setError('');
      setStatus('Ready to clean up');
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
    setStatus('Running AI cleanup. This can take up to one minute...');

    try {
      const response = await fetch(`${API_BASE}/api/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img }),
      });

      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || `AI cleanup failed with status ${response.status}.`);
      if (!data.cleanedUrl) throw new Error('The cleanup engine completed but did not return an image.');

      setResult(data.cleanedUrl);
      setStatus(`Cleanup complete${data.model ? ` (${data.model})` : ''}. Check the details closely before using this version.`);
    } catch (err) {
      const message = isNetworkError(err.message)
        ? 'The cleanup request failed before the server could respond. This usually means the photo was too large, the function timed out, or the cleanup model/billing needs attention. Try again with this optimized upload, then check Vercel Function logs if it repeats.'
        : err.message || 'AI cleanup failed.';
      setError(message);
      setStatus('Cleanup engine needs attention');
    } finally {
      setLoading(false);
    }
  }

  async function downloadCleaned() {
    if (!result) return;
    try {
      const res = await fetch(result);
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nhance-me-ai-cleanup.jpg';
      document.body.appendChild(a); // required for Safari
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      // The `download` attribute is ignored cross-origin, so if the direct
      // fetch fails, open the image where the user can save it manually.
      window.open(result, '_blank', 'noopener');
    }
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>AI Cleanup</h1>
          <p className="small">Removes light halos, glare, bloom and ghosting that are baked into the original photo.</p>
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 16 }}>
        Honest label: AI Cleanup <strong>repaints your photo with AI</strong>. It can remove light artifacts that the pixel true Enhance grade cannot, but it regenerates pixels to do it, so fine details can shift. Check the result closely before using it anywhere accuracy matters, like an MLS listing. Enhance stays pixel true. This tool does not.
      </div>

      <div className="grid-3" style={{ alignItems: 'start' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="upload-zone" onClick={() => input.current.click()}>
            <UploadCloud size={38} />
            <h2>Upload photo with light halos</h2>
            <p className="small">Click to upload a photo. Large phone photos are compressed before cleanup.</p>
            <input ref={input} hidden accept="image/*" type="file" onChange={pick} />
          </div>

          {img && (
            <div className="compare-grid" style={{ marginTop: 16 }}>
              <div className="image-preview" style={{ borderRadius: 18 }}>
                <span className="pill floating-pill">Before</span>
                <img src={img} alt="Original photo preview" />
              </div>
              <div className="image-preview" style={{ borderRadius: 18 }}>
                <span className="pill floating-pill">After (AI repaint)</span>
                {result ? <img src={result} alt="AI cleaned photo" /> : <div className="placeholder-output">{loading ? 'Cleaning up light artifacts...' : 'The cleaned photo will appear here.'}</div>}
              </div>
            </div>
          )}

          {error && <div className="notice error-notice">{error}</div>}
          <p className="small">Status: {status}</p>
        </div>

        <div className="card">
          <div className="icon"><Sparkles /></div>
          <h2>Cleanup request</h2>
          <p className="small">One tap. The cleanup targets light halos, glare, bloom and ghosting around windows and light fixtures and leaves everything else in the scene as it is.</p>

          <button disabled={!img || loading} onClick={generate} className="btn btn-primary" style={{ width: '100%' }}>
            <Sparkles size={17} /> {loading ? 'Cleaning...' : 'Run AI Cleanup'}
          </button>

          {result && <button onClick={downloadCleaned} className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }}><Download size={17} /> Download cleaned photo</button>}
        </div>
      </div>
    </AppShell>
  );
}
