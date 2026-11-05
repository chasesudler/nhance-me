'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import Logo from '@/components/Logo';
import { exchangeIdTokenForSession, firebaseErrorMessage } from '@/lib/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Sign up is not set up yet. Please check back soon.');
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      await exchangeIdTokenForSession(cred.user);
      router.push('/dashboard');
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Create your Nhance Me account</h1>
        <p className="small">Sign up to enhance and stage your listing photos with Nhance Me.</p>
        {!isFirebaseConfigured && (
          <div className="notice error-notice">Sign up is not set up yet. Please check back soon.</div>
        )}
        {error && <div className="notice error-notice">{error}</div>}
        <div className="field">
          <label>Name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy || !isFirebaseConfigured}>
          {busy ? 'Creating account...' : 'Create account'}
        </button>
        <p className="small" style={{ textAlign: 'center' }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
        <p className="small">
          <Link href="/">← Back to home</Link>
        </p>
      </form>
    </div>
  );
}
