import React, { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ISSUE_TYPES = [
  'Billing & Credits',
  'Transcription Error',
  'Subtitling Bug',
  'Captioning Bug',
  'Dubbing Bug',
  'Other',
] as const;

type State = 'idle' | 'loading' | 'success' | 'error';

export function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [issueType, setIssueType] = useState('Other');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>('idle');
  const [feedback, setFeedback] = useState('');

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'loading') return;

    setState('loading');
    setFeedback('');

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/support/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_type: issueType, message }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      if (data.ok) {
        setState('success');
        setFeedback(data.message);
        setMessage('');
      } else {
        setState('error');
        setFeedback(data.message ?? 'Something went wrong.');
      }
    } catch {
      setState('error');
      setFeedback('Could not reach the server. Please try again.');
    }
  }

  function handleClose() {
    // Reset state on close so it's fresh next time
    setTimeout(() => {
      setState('idle');
      setFeedback('');
      setMessage('');
      setIssueType('Other');
    }, 300);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">Help & Support</h2>
            <p className="text-xs text-foreground-3 mt-0.5">Message goes directly to the founder.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full text-foreground-3 hover:bg-background-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {state === 'success' ? (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="font-medium text-foreground">{feedback}</p>
              <button
                onClick={handleClose}
                className="mt-2 px-5 py-2 rounded-lg bg-background-2 hover:bg-background-3 text-sm text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Issue type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground-3 uppercase tracking-wide">
                  Issue Type
                </label>
                <select
                  value={issueType}
                  onChange={e => setIssueType(e.target.value)}
                  disabled={state === 'loading'}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                >
                  {ISSUE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground-3 uppercase tracking-wide">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  placeholder="Describe your issue in as much detail as possible…"
                  disabled={state === 'loading'}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-foreground-4 disabled:opacity-60"
                />
                <p className="text-xs text-foreground-4 text-right">{message.length}/2000</p>
              </div>

              {/* Error feedback */}
              {state === 'error' && feedback && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {feedback}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={state === 'loading' || message.trim().length < 10}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all",
                  "bg-foreground text-background hover:opacity-90",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {state === 'loading' ? (
                  <>
                    <span className="w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send to Founder
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
