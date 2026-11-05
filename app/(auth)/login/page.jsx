'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import Logo from '@/components/Logo';
import { exchangeIdTokenForSession, firebaseErrorMessage } from '@/lib/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();

  async function finishSignIn(firebaseUser) {
    await exchangeIdTokenForSession(firebaseUser);
    router.push('/dashboard');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Sign in is not set up yet. Please check back soon.');
      return;
    }
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishSignIn(cred.user);
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError('');
    setNotice('');
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Sign in is not set up yet. Please check back soon.');
      return;
    }
    setBusy(true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await finishSignIn(cred.user);
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError('');
    setNotice('');
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Sign in is not set up yet. Please check back soon.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email above first, then tap Forgot password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('Password reset email sent. Check your inbox for the link.');
    } catch (err) {
      setError(firebaseErrorMessage(err));
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Welcome back</h1>
        <p className="small">Log in to your Nhance Me account to enhance and stage your listing photos.</p>
        {!isFirebaseConfigured && (
          <div className="notice error-notice">Sign in is not set up yet. Please check back soon.</div>
        )}
        {error && <div className="notice error-notice">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy || !isFirebaseConfigured}>
          {busy ? 'Signing in...' : 'Log in'}
        </button>
        <button
          type="button"
          className="btn"
          style={{ width: '100%' }}
          onClick={googleSignIn}
          disabled={busy || !isFirebaseConfigured}
        >
          Continue with Google
        </button>
        <p className="small" style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={forgotPassword}
            style={{ border: 0, background: 'transparent', color: '#7C3AED', fontWeight: 900 }}
          >
            Forgot password?
          </button>
        </p>
        <p className="small" style={{ textAlign: 'center' }}>
          Need an account? <Link href="/signup">Create one</Link>
        </p>
        <p className="small">
          <Link href="/">← Back to home</Link>
        </p>
      </form>
    </div>
  );
}
