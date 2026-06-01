import AppShell from '@/components/AppShell';
export default function Settings(){return <AppShell><div className="topbar"><div><h1>Settings</h1><p className="small">Configure production integrations before launch.</p></div></div><div className="grid-3"><div className="card"><h2>Authentication</h2><p className="small">Current: demo local email/password. Recommended: Firebase Auth, Clerk, Supabase, or Auth.js.</p></div><div className="card"><h2>Storage</h2><p className="small">Recommended: Vercel Blob, S3, Cloudflare R2, or Supabase Storage with signed URLs.</p></div><div className="card"><h2>AI processing</h2><p className="small">Recommended: queue API jobs with webhooks. Keep faithful enhancement and staging pipelines separate.</p></div></div><section className="section"><div className="card"><h2>Environment variables</h2><pre style={{whiteSpace:'pre-wrap',background:'#071326',color:'#dbeafe',padding:18,borderRadius:16}}>AI_ENHANCE_API_URL=
AI_ENHANCE_API_KEY=
AI_STAGING_API_URL=
AI_STAGING_API_KEY=
NEXT_PUBLIC_APP_URL=</pre></div></section></AppShell>}
