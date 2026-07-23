import React, { useRef, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { CheckCircle2, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export default function VerifyEmail() {
  const BASE = import.meta.env.BASE_URL;
  const { refresh } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();

  // Read email from query string
  const params = new URLSearchParams(window.location.search);
  const email  = params.get('email') ?? '';

  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resent, setResent]   = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleChange(index: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const next   = [...otp];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    const focusIdx = Math.min(digits.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter all 6 digits.'); return; }

    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BASE}api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (res.ok) {
        await refresh();
        setSuccess(true);
        setTimeout(() => navigate('/'), 2000);
      } else {
        setError(data.error ?? 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setResent(false);
    try {
      await fetch(`${BASE}api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResent(true);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      setError('Failed to resend. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative">

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 p-2 rounded-full text-foreground-3 hover:text-foreground hover:bg-background-2 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm">

        {success ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <h2 className="font-serif font-bold text-2xl">Verified!</h2>
            <p className="text-foreground-4 text-sm">Your account is active. Redirecting…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              {/* Logo */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-xl mx-auto mb-6"
                style={{ background: '#111111', color: '#E4C980' }}>
                D
              </div>
              <h1 className="font-serif font-bold text-3xl tracking-tight mb-2">Enter your OTP</h1>
              <p className="text-foreground-4 text-sm leading-relaxed">
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-foreground">{email || 'your email'}</span>.
                <br />It expires in 10 minutes.
              </p>
            </div>

            {/* OTP form */}
            <form onSubmit={handleSubmit}>
              {/* 6 boxes */}
              <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className={[
                      'w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-background',
                      'focus:outline-none transition-colors',
                      error
                        ? 'border-danger text-danger'
                        : digit
                          ? 'border-primary text-foreground'
                          : 'border-border text-foreground',
                      'focus:border-primary',
                    ].join(' ')}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-bg/60 text-danger text-sm mb-4">
                  <XCircle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Resent notice */}
              {resent && !error && (
                <p className="text-center text-sm text-success mb-4">New code sent!</p>
              )}

              <Button type="submit" className="w-full h-11 text-base mb-4" disabled={loading || otp.join('').length < 6}>
                {loading ? 'Verifying…' : 'Verify'}
              </Button>
            </form>

            {/* Resend */}
            <p className="text-center text-sm text-foreground-4">
              Didn't receive it?{' '}
              {countdown > 0 ? (
                <span className="text-foreground-3">Resend in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-foreground font-semibold underline underline-offset-4 hover:opacity-70 transition-opacity inline-flex items-center gap-1"
                >
                  <RefreshCw size={13} /> Resend
                </button>
              )}
            </p>

            {/* Back */}
            <div className="text-center mt-6">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-foreground-4 hover:text-foreground transition-colors">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
