'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { saveUser } from '@/lib/auth';
import { API_BASE } from '@/lib/apiBase';

export default function Login() {
  const [email, setEmail] = useState('demo@nhanceme.app');
  const [password, setPassword] = useState('password123');
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Login failed. Please try again.');
      saveUser(data.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your Nhance Me account'}</h1>
        <p className="small">Use the demo credentials or enter any email to access the deployable demo dashboard.</p>
        {error && <div className="notice error-notice">{error}</div>}
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <p className="small" style={{ textAlign: 'center' }}>
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{ border: 0, background: 'transparent', color: '#7C3AED', fontWeight: 900 }}
          >
            {mode === 'login' ? 'Create one' : 'Log in'}
          </button>
        </p>
        <p className="small">
          <Link href="/">← Back to home</Link>
        </p>
      </form>
    </div>
  );
}
