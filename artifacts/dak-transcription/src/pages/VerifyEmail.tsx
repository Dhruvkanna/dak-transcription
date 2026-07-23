import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

export default function VerifyEmail() {
  const BASE = import.meta.env.BASE_URL;
  const { refresh } = useAuth();
  const [, navigate] = useLocation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }

    fetch(`${BASE}api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then(async res => {
        const data = await res.json();
        if (res.ok) {
          await refresh();
          setStatus('success');
          setMessage(data.message ?? 'Email verified!');
          setTimeout(() => navigate('/'), 2500);
        } else {
          setStatus('error');
          setMessage(data.error ?? 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      });
  }, [BASE, refresh, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-5">

        {status === 'loading' && (
          <>
            <div className="w-16 h-16 bg-background-3 rounded-full flex items-center justify-center mx-auto">
              <Loader2 size={32} className="text-foreground-3 animate-spin" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-2xl mb-2">Verifying…</h2>
              <p className="text-foreground-4 text-sm">Just a moment.</p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-2xl mb-2">Email verified!</h2>
              <p className="text-foreground-4 text-sm">{message} Redirecting you now…</p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-danger-bg rounded-full flex items-center justify-center mx-auto">
              <XCircle size={32} className="text-danger" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-2xl mb-2">Verification failed</h2>
              <p className="text-foreground-4 text-sm mb-4">{message}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Register again</Link>
              </Button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
