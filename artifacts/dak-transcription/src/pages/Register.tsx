import React, { useState } from 'react';
import { Link } from 'wouter';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Mic, Subtitles, Captions, AudioLines, Sun, Moon } from 'lucide-react';

const FEATURES = [
  { icon: Mic,        label: 'AI Transcription',  desc: 'Speaker-labelled transcripts in minutes' },
  { icon: Subtitles,  label: 'Subtitling',         desc: 'Time-synced SRT / VTT with reading-speed checks' },
  { icon: Captions,   label: 'Captioning',         desc: 'Burned-in captions, export-ready MP4' },
  { icon: AudioLines, label: 'AI Dubbing',         desc: 'Voice-cloned re-recording in any language' },
];

export default function Register() {
  const BASE = import.meta.env.BASE_URL;
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Registration failed'); return; }
      setSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — branding ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#111111' }}
      >
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: '#92400E' }} />
        <div className="absolute top-1/2 -right-20 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: '#E4C980' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-serif font-bold text-xl"
            style={{ background: '#E4C980', color: '#111111' }}>
            D
          </div>
          <div>
            <div className="font-serif font-bold text-xl text-white tracking-tight leading-none">
              DAK Transcription
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Audio &amp; Video Intelligence, in INR
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(228,201,128,0.1)', border: '1px solid rgba(228,201,128,0.2)' }}>
                <Icon size={16} style={{ color: '#E4C980' }} />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} DAK Transcription · Made for Indian creators
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background relative">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-5 right-5 p-2 rounded-full text-foreground-3 hover:text-foreground hover:bg-background-2 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-9 h-9 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-serif font-bold text-lg">
            D
          </div>
          <span className="font-serif font-bold text-xl tracking-tight">DAK Transcription</span>
        </div>

        {success ? (
          /* ── Success state ── */
          <div className="w-full max-w-sm text-center space-y-5">
            <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-2xl mb-2">Check your email</h2>
              <p className="text-foreground-4 text-sm leading-relaxed">
                We sent a verification link to{' '}
                <span className="font-semibold text-foreground">{email}</span>.
                Click it to activate your account.
              </p>
            </div>
            <p className="text-sm text-foreground-4">
              Already verified?{' '}
              <Link href="/login" className="text-foreground font-semibold underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="font-serif font-bold text-3xl tracking-tight mb-1.5">Create account</h1>
              <p className="text-foreground-4 text-sm">Start with your email and a secure password.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-bg/60 text-danger text-sm">
                  <AlertTriangle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" type="email" required autoComplete="email"
                  placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">
                  Password{' '}
                  <span className="text-foreground-4 font-normal">(min 8 characters)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password" required autoComplete="new-password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-4 hover:text-foreground transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm" required autoComplete="new-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-sm text-foreground-4 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-foreground font-semibold underline underline-offset-4">
                Sign in →
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
