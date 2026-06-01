'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { requireUser } from '@/lib/auth';
export default function AppShell({children}){const router=useRouter();const [ready,setReady]=useState(false);useEffect(()=>{if(requireUser(router))setReady(true)},[router]); if(!ready)return <div className="auth-page"><div className="auth-card">Checking your dashboard access...</div></div>; return <div className="app-shell"><Sidebar/><main className="main">{children}</main></div>}
