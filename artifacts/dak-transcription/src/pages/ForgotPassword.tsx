import React, { useRef, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, RefreshCw, ArrowLeft, Sun, Moon, XCircle } from 'lucide-react';

export default function ForgotPassword() {
  const BASE = import.meta.env.BASE_URL;
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();

  // Step 1: enter email → Step 2: enter OTP + new password
  const [step, setStep]           = useState<'email' | 'otp'>('email');
  const [email, setEmail]         = useState('');
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to send code'); return; }
      setStep('otp');
      setCountdown(60);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    try {
      await fetch(`${BASE}api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch { /* silent */ }
  }

  function handleOtpChange(index: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKey(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const next   = [...otp];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 6) { setError('Enter all 6 digits.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${BASE}api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Reset failed. Try again.'); return; }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative">
      <button onClick={toggleTheme}
        className="absolute top-5 right-5 p-2 rounded-full text-foreground-3 hover:text-foreground hover:bg-background-2 transition-colors"
        aria-label="Toggle theme">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm">
        {success ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <h2 className="font-serif font-bold text-2xl">Password reset!</h2>
            <p className="text-foreground-4 text-sm">Redirecting you to sign in…</p>
          </div>
        ) : step === 'email' ? (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-xl mx-auto mb-6"
                style={{ background: '#111111', color: '#E4C980' }}>D</div>
              <h1 className="font-serif font-bold text-3xl tracking-tight mb-2">Forgot password?</h1>
              <p className="text-foreground-4 text-sm">Enter your email and we'll send a reset code.</p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-bg/60 text-danger text-sm">
                  <AlertTriangle size={15} className="shrink-0" />{error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} autoFocus />
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset code'}
              </Button>
            </form>

            <div className="text-center mt-6">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-foreground-4 hover:text-foreground transition-colors">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-xl mx-auto mb-6"
                style={{ background: '#111111', color: '#E4C980' }}>D</div>
              <h1 className="font-serif font-bold text-3xl tracking-tight mb-2">Reset password</h1>
              <p className="text-foreground-4 text-sm leading-relaxed">
                Enter the code sent to <span className="font-semibold text-foreground">{email}</span> and choose a new password.
              </p>
            </div>

            <form onSubmit={handleReset} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-bg/60 text-danger text-sm">
                  <XCircle size={15} className="shrink-0" />{error}
                </div>
              )}

              {/* OTP boxes */}
              <div className="flex gap-3 justify-center" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input key={i} ref={el => { inputRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    className={[
                      'w-11 h-13 text-center text-xl font-bold rounded-xl border-2 bg-background focus:outline-none transition-colors',
                      error ? 'border-danger' : digit ? 'border-primary' : 'border-border',
                      'focus:border-primary',
                    ].join(' ')}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">New password <span className="text-foreground-4 font-normal">(min 8 characters)</span></Label>
                <div className="relative">
                  <Input id="password" required type={showPass ? 'text' : 'password'}
                    placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pr-10" />
                  <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-4 hover:text-foreground transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" required type={showPass ? 'text' : 'password'}
                  placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={loading || otp.join('').length < 6}>
                {loading ? 'Resetting…' : 'Reset password'}
              </Button>
            </form>

            <p className="text-center text-sm text-foreground-4 mt-4">
              Didn't receive it?{' '}
              {countdown > 0 ? (
                <span className="text-foreground-3">Resend in {countdown}s</span>
              ) : (
                <button type="button" onClick={handleResend}
                  className="text-foreground font-semibold underline underline-offset-4 inline-flex items-center gap-1">
                  <RefreshCw size={13} /> Resend
                </button>
              )}
            </p>

            <div className="text-center mt-4">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-foreground-4 hover:text-foreground transition-colors">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
