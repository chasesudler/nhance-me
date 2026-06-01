import Link from 'next/link';
import { CheckCircle2, Gauge, Images, ShieldCheck, WandSparkles, Sofa, CloudLightning } from 'lucide-react';
import Logo from '@/components/Logo';

const features = [
  ['50-image batch consistency', Images, 'Upload up to 50 property photos at once and process them with shared presets for continuity across a full listing.'],
  ['Integrity-first enhancement', ShieldCheck, 'Controls are designed around faithful edits: exposure, verticals, color, window pull and sky-safe adjustments without inventing property details.'],
  ['Low-latency workflow', Gauge, 'Client-side previewing keeps the interface fast while production API routes are ready for async cloud processing.'],
  ['Virtual staging flow', Sofa, 'Select room type, design style, furniture density and staging goals before sending images to a production staging model.'],
  ['Real-estate enhancement suite', WandSparkles, 'HDR-style polish, perspective correction, clarity, white balance, color correction, and listing-ready exports.'],
  ['API-ready architecture', CloudLightning, 'Next.js API routes are structured so you can connect Replicate, RunPod, Stability, Cloudinary, or a custom model pipeline.']
];

export default function Home(){return <>
  <nav className="nav"><div className="container nav-inner"><Logo/><div className="nav-links"><a href="#features">Features</a><Link className="btn btn-primary" href="/login">Launch Dashboard</Link></div></div></nav>
  <header className="hero"><div className="container hero-grid"><div><span className="eyebrow"><CheckCircle2 size={16}/> Built for real estate photo pros</span><h1 className="h1">Enhance listings faster with <span className="gradient">Nhance Me.</span></h1><p className="lead">A premium web and mobile PWA foundation for batch real estate photo enhancement, consistent listing edits, image integrity controls, and virtual staging workflows.</p><div className="hero-actions"><Link className="btn btn-primary" href="/login">Start enhancing</Link><a className="btn btn-orange" href="#features">View platform</a></div></div><div className="panel"><div className="mock-window"><div className="mock-top"><i className="dot"/><i className="dot"/><i className="dot"/></div><div className="before-after"><div className="photo-card"><span className="tag">Before</span><h3>Flat exposure</h3></div><div className="photo-card after"><span className="tag">After</span><h3>Listing-ready</h3></div></div></div><div className="stats"><div className="stat"><b>50</b><p>image batch</p></div><div className="stat"><b>PWA</b><p>mobile-ready</p></div><div className="stat"><b>API</b><p>AI-ready</p></div></div></div></div></header>
  <section className="section" id="features"><div className="container"><h2 className="section-title">Core platform features</h2><p className="lead">The app is designed as a serious SaaS foundation: polished UI, fast uploads, dashboard access, and production-ready integration points.</p><div className="grid-3">{features.map(([title,Icon,copy])=><div className="feature" key={title}><div className="icon"><Icon size={23}/></div><h3>{title}</h3><p>{copy}</p></div>)}</div></div></section>
  <footer className="footer"><div className="container">© 2026 Nhance Me. Real estate photo enhancement and virtual staging.</div></footer>
</>}
