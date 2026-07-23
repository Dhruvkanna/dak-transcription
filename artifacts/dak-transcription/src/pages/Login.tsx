import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Eye, EyeOff, Mic, Subtitles, Captions, AudioLines, Sun, Moon } from 'lucide-react';

const FEATURES = [
  { icon: Mic,        label: 'AI Transcription',  desc: 'Speaker-labelled transcripts in minutes' },
  { icon: Subtitles,  label: 'Subtitling',         desc: 'Time-synced SRT / VTT with reading-speed checks' },
  { icon: Captions,   label: 'Captioning',         desc: 'Burned-in captions, export-ready MP4' },
  { icon: AudioLines, label: 'AI Dubbing',         desc: 'Voice-cloned re-recording in any language' },
];

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [error, setError]             = useState('');
  const [unverified, setUnverified]   = useState(false);
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true);
      } else {
        setError(err.message ?? 'Something went wrong');
      }
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
        {/* Subtle warm glow */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: '#92400E' }} />
        <div className="absolute top-1/2 -right-20 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: '#E4C980' }} />

        {/* Logo */}
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

        {/* Feature list */}
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

        {/* Footer */}
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

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-serif font-bold text-3xl tracking-tight mb-1.5">Sign in</h1>
            <p className="text-foreground-4 text-sm">Enter your credentials to access the platform.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {unverified && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Email not verified</p>
                <p className="text-foreground-4 mb-2">Check your inbox for the OTP we sent, or request a new one.</p>
                <Link
                  href={`/verify-email?email=${encodeURIComponent(email.trim())}`}
                  className="font-semibold text-foreground underline underline-offset-4"
                >
                  Enter / resend verification code →
                </Link>
              </div>
            )}

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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-foreground-4 hover:text-foreground underline underline-offset-4 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password" required autoComplete="current-password"
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

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-foreground-4 mt-6">
            New here?{' '}
            <Link href="/register" className="text-foreground font-semibold underline underline-offset-4">
              Register →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
