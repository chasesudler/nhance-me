'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { requireUser } from '@/lib/auth';

function useAndroidBackButton() {
  useEffect(() => {
    let listener;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        if (cancelled) return;
        listener = await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });
      } catch {
        // Not running inside Capacitor (web/PWA) — nothing to do.
      }
    })();
    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, []);
}

export default function AppShell({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useAndroidBackButton();
  useEffect(() => {
    if (requireUser(router)) setReady(true);
  }, [router]);
  if (!ready) return <div className="auth-page"><div className="auth-card">Checking your dashboard access...</div></div>;
  return <div className="app-shell"><Sidebar /><main className="main">{children}<footer className="app-footer"><span>Nhance Me is a Chasen Tech product.</span><span>© 2026 Chasen Tech</span></footer></main></div>;
}
