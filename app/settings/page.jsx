import AppShell from '@/components/AppShell';

export default function Settings() {
  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <p className="small">Configure production integrations before launch.</p>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <h2>Authentication</h2>
          <p className="small">Current: demo local email/password. Recommended: Firebase Auth, Clerk, Supabase, or Auth.js.</p>
        </div>
        <div className="card">
          <h2>Storage</h2>
          <p className="small">Recommended: Vercel Blob, S3, Cloudflare R2, or Supabase Storage with signed URLs.</p>
        </div>
        <div className="card">
          <h2>AI processing</h2>
          <p className="small">The app now supports a production enhancement route and a production staging route. Keep faithful enhancement and staging pipelines separate.</p>
        </div>
      </div>

      <section className="section">
        <div className="card">
          <h2>Environment variables</h2>
          <pre style={{whiteSpace:'pre-wrap',background:'#071326',color:'#dbeafe',padding:18,borderRadius:16}}>{`REPLICATE_API_TOKEN=
REPLICATE_ENHANCE_MODEL=nightmareai/real-esrgan
REPLICATE_STAGE_MODEL=black-forest-labs/flux-kontext-pro
BLOB_READ_WRITE_TOKEN=
NHANCE_API_SECRET=`}</pre>
          <p className="small" style={{marginTop:12}}>
            <code>BLOB_READ_WRITE_TOKEN</code> (Vercel Blob) hosts uploads so the AI models receive public image URLs.{' '}
            <code>NHANCE_API_SECRET</code> signs login sessions — set a long random value in production. Mobile builds also use{' '}
            <code>NEXT_PUBLIC_API_BASE</code> to point the app at this deployment.
          </p>
          <p className="small" style={{marginTop:12}}>
            Optional: swap <code>REPLICATE_ENHANCE_MODEL</code> to another supported enhancement model later if you want a different quality/cost tradeoff.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
