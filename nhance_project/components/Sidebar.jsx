'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ImagePlus, Sofa, Settings, LogOut } from 'lucide-react';
import Logo from './Logo';
import { signOut } from '@/lib/auth';
const links=[['/dashboard','Dashboard',LayoutDashboard],['/process','Enhance Batch',ImagePlus],['/staging','Virtual Staging',Sofa],['/settings','Settings',Settings]];
export default function Sidebar(){const path=usePathname();return <aside className="sidebar"><Logo light/><nav className="side-nav">{links.map(([href,label,Icon])=><Link key={href} className={path===href?'active':''} href={href}><Icon size={17}/> {label}</Link>)}<button className="btn btn-ghost" onClick={signOut}><LogOut size={17}/> Sign out</button></nav></aside>}
