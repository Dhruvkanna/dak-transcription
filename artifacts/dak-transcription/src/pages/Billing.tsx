import React, { useState, useEffect, useCallback } from 'react';
import { useGetWallet, useListTransactions } from '@workspace/api-client-react';
import { getGetWalletQueryKey, getListTransactionsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import {
  Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, RotateCcw,
  CheckCircle2, Crown, Building2, Sparkles, Users, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanConfig { label: string; priceInr: number; description: string; }
interface RateConfig { standard: number; enterprise: number; }

const PLAN_FEATURES: Record<string, string[]> = {
  solo:        ["All 4 AI tools", "Standard rates", "SRT, VTT, TXT export", "Email support"],
  partnership: ["All 4 AI tools", "Standard rates", "All export formats incl. Word", "Priority processing", "Priority support"],
  enterprise:  ["All 4 AI tools", "Enterprise rates (20% off)", "All export formats", "Highest priority processing", "Dedicated support"],
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  solo:        <Users size={20} />,
  partnership: <Sparkles size={20} />,
  enterprise:  <Building2 size={20} />,
};

const RATE_LABELS: Record<string, string> = {
  transcription: "Transcription",
  subtitling:    "Subtitling",
  captioning:    "Captioning",
  dubbing:       "AI Dubbing",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtInr(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Billing() {
  const queryClient = useQueryClient();
  const { data: wallet, isLoading: walletLoading } = useGetWallet();
  const { data: transactions, isLoading: txLoading } = useListTransactions({ limit: 50 });

  const [plans, setPlans]       = useState<Record<string, PlanConfig>>({});
  const [rates, setRates]       = useState<Record<string, RateConfig>>({});
  const [topupMin, setTopupMin] = useState(200);
  const [topupAmount, setTopupAmount] = useState('500');
  const [loading, setLoading]   = useState<string | null>(null);
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const BASE = import.meta.env.BASE_URL;

  useEffect(() => {
    fetch(`${BASE}api/payments/plans`)
      .then(r => r.json())
      .then(d => {
        setPlans(d.subscriptionPlans ?? {});
        setRates(d.walletRates ?? {});
        setTopupMin(d.topupMin ?? 200);
      })
      .catch(() => {});
  }, [BASE]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const refreshWallet = () => {
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
  };

  // ── Subscribe to a plan → redirect to Razorpay short_url ────────────────

  const subscribeToPlan = useCallback(async (tier: string) => {
    setLoading(`plan-${tier}`);
    try {
      const res = await fetch(`${BASE}api/payments/create-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Failed to create subscription", "error"); return; }
      if (data.shortUrl) {
        window.location.href = data.shortUrl;
      } else {
        showToast("No checkout URL returned — please try again.", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setLoading(null);
    }
  }, [BASE]);

  // ── Cancel subscription ──────────────────────────────────────────────────

  const cancelSubscription = async () => {
    if (!confirm("Cancel your subscription? You keep your remaining balance.")) return;
    setLoading("cancel");
    try {
      const res = await fetch(`${BASE}api/payments/subscription`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) { showToast("Subscription cancelled. Plan set to Free.", "success"); refreshWallet(); }
      else showToast(data.error ?? "Failed to cancel", "error");
    } finally {
      setLoading(null);
    }
  };

  // ── Wallet top-up → redirect to Razorpay payment link ───────────────────

  const topUp = useCallback(async () => {
    const amount = parseInt(topupAmount, 10);
    if (!amount || amount < topupMin) {
      showToast(`Minimum top-up is ₹${topupMin}`, "error");
      return;
    }
    setLoading("topup");
    try {
      const res = await fetch(`${BASE}api/payments/create-payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Failed to create payment link", "error"); return; }
      if (data.shortUrl) {
        window.location.href = data.shortUrl;
      } else {
        showToast("No payment link returned — please try again.", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setLoading(null);
    }
  }, [BASE, topupAmount, topupMin]);

  const currentPlan  = wallet?.planType ?? "free";
  const isSubscribed = ["solo", "partnership", "enterprise"].includes(currentPlan);
  const balance      = Number(wallet?.balance ?? 0);

  return (
    <div className="page-enter space-y-10 pb-10 relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium
          ${toast.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">Billing & Wallet</h1>
        <p className="text-foreground-3">Manage your subscription, top up your wallet, and view transaction history.</p>
      </div>

      {/* Wallet + transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: wallet card + top-up + cancel */}
        <div className="space-y-4">
          <Card className="bg-foreground text-background border-none overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-background/5 rounded-bl-full -mr-10 -mt-10" />
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="p-3 bg-background/10 rounded-xl">
                  <WalletIcon size={24} className="text-accent-light" />
                </div>
                <Badge className="bg-accent text-accent-foreground uppercase tracking-widest text-[10px] font-bold border-none flex items-center gap-1">
                  {isSubscribed && <Crown size={10} />}
                  {currentPlan.toUpperCase()}
                </Badge>
              </div>
              <p className="text-background/70 text-sm font-medium mb-1">Wallet Balance</p>
              <h2 className="text-4xl font-serif font-bold font-mono tracking-tight text-accent-light mb-8">
                {walletLoading ? '…' : fmtInr(wallet?.balance)}
              </h2>
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-background/10">
                <div>
                  <p className="text-xs text-background/60 mb-1">Total Spent</p>
                  <p className="font-mono font-medium">{fmtInr(wallet?.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-xs text-background/60 mb-1">Jobs Run</p>
                  <p className="font-medium">{wallet?.totalJobsRun ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* No active plan warning */}
          {!isSubscribed && (
            <Card className="border-amber-300/50 bg-amber-50/50">
              <CardContent className="p-5">
                <div className="flex gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">No active plan</p>
                    <p className="text-xs text-amber-700">An active subscription is required to run transcription jobs. Choose a plan below.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top-up */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top Up Wallet</CardTitle>
              <CardDescription className="text-xs">Minimum ₹{topupMin}. You pay exactly what you add.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {[500, 1000, 2000].map(v => (
                  <button key={v}
                    onClick={() => setTopupAmount(String(v))}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                      ${topupAmount === String(v)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-foreground-3 hover:border-primary/50'}`}>
                    ₹{v.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-xs text-foreground-4 mb-1.5 block">Custom amount (₹)</Label>
                <Input
                  type="number"
                  min={topupMin}
                  value={topupAmount}
                  onChange={e => setTopupAmount(e.target.value)}
                  placeholder={`Min ₹${topupMin}`}
                  className="font-mono"
                />
              </div>
              <Button className="w-full" onClick={topUp} disabled={!!loading}>
                {loading === "topup" ? "Redirecting…" : (
                  <><ExternalLink size={14} className="mr-2" />Pay ₹{parseInt(topupAmount || '0', 10).toLocaleString('en-IN')} via Razorpay</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Cancel subscription */}
          {isSubscribed && (
            <Card className="border-danger/30">
              <CardContent className="p-5">
                <p className="text-sm font-medium mb-1">Active: {plans[currentPlan]?.label ?? currentPlan} Plan</p>
                <p className="text-xs text-foreground-4 mb-4">Cancelling stops future renewals. Your existing wallet balance is not affected.</p>
                <Button size="sm" variant="outline" className="w-full border-danger/40 text-danger hover:bg-danger hover:text-white text-xs"
                  onClick={cancelSubscription} disabled={loading === "cancel"}>
                  {loading === "cancel" ? "Cancelling…" : "Cancel Subscription"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: transaction history */}
        <Card className="lg:col-span-2 flex flex-col min-h-[420px]">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All wallet credits, deductions, and refunds.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-auto border-t border-border">
            {txLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <Table>
                <TableHeader className="bg-background/50 sticky top-0">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(tx => {
                    const isCredit = tx.type === 'credit';
                    const isRefund = tx.type === 'refund';
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-foreground-4 text-xs whitespace-nowrap">{formatDate(tx.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-full shrink-0 ${
                              isCredit ? 'bg-success-bg text-success' :
                              isRefund ? 'bg-blue-50 text-blue-500' :
                              'bg-background-3 text-foreground-3'}`}>
                              {isCredit ? <ArrowUpRight size={14} /> :
                               isRefund ? <RotateCcw size={14} /> :
                               <ArrowDownRight size={14} />}
                            </div>
                            <span className="text-sm">{tx.description}</span>
                            {tx.jobId && (
                              <Badge variant="outline" className="text-[10px] font-mono py-0 shrink-0">
                                Job #{tx.jobId}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium whitespace-nowrap">
                          <span className={isCredit ? 'text-success' : isRefund ? 'text-blue-500' : 'text-foreground'}>
                            {isCredit ? '+' : isRefund ? '↩' : '-'}{fmtInr(tx.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-foreground-4">
                <WalletIcon size={32} className="mb-4 text-border" />
                <p>No transactions yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Subscription Plans ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-serif font-semibold tracking-tight mb-1">Subscription Plans</h2>
          <p className="text-foreground-3 text-sm">
            Subscribe to unlock the AI tools. You'll be redirected to Razorpay to complete payment. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(plans).map(([tier, plan]) => {
            const isActive    = currentPlan === tier;
            const isPartner   = tier === "partnership";
            const features    = PLAN_FEATURES[tier] ?? [];

            return (
              <Card key={tier} className={`relative flex flex-col transition-shadow hover:shadow-md
                ${isPartner ? 'border-primary shadow-sm ring-1 ring-primary/20' : ''}
                ${isActive  ? 'bg-primary/5 border-primary' : ''}`}>
                {isPartner && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest px-3">Popular</Badge>
                  </div>
                )}
                <CardContent className="p-7 flex flex-col flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5
                    ${isActive ? 'bg-primary text-primary-foreground' : 'bg-background-3 text-foreground-3'}`}>
                    {PLAN_ICONS[tier]}
                  </div>

                  <h3 className="text-lg font-semibold mb-1">{plan.label}</h3>
                  <p className="text-sm text-foreground-4 mb-4">{plan.description}</p>

                  <div className="mb-6">
                    <span className="text-3xl font-bold font-mono">₹{(plan.priceInr ?? 0).toLocaleString('en-IN')}</span>
                    <span className="text-foreground-4 text-sm">/month</span>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isActive ? (
                    <Button className="w-full" disabled variant="outline">
                      <CheckCircle2 size={14} className="mr-2 text-success" /> Current Plan
                    </Button>
                  ) : (
                    <Button className="w-full" variant={isPartner ? "default" : "outline"}
                      onClick={() => subscribeToPlan(tier)}
                      disabled={!!loading || isSubscribed}>
                      {loading === `plan-${tier}` ? "Redirecting…" : (
                        isSubscribed
                          ? "Cancel current plan first"
                          : <><ExternalLink size={13} className="mr-2" />Subscribe — ₹{(plan.priceInr ?? 0).toLocaleString('en-IN')}/mo</>

                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Rate Card ─────────────────────────────────────────────────────── */}
      {Object.keys(rates).length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-serif font-semibold tracking-tight mb-1">Rate Card</h2>
            <p className="text-foreground-3 text-sm">Per-minute charges deducted from your wallet before each job runs.</p>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Solo / Partnership</TableHead>
                  <TableHead className="text-right">Enterprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(rates).map(([op, r]) => (
                  <TableRow key={op}>
                    <TableCell className="font-medium">{RATE_LABELS[op] ?? op}</TableCell>
                    <TableCell className="text-right font-mono">₹{r.standard}/min</TableCell>
                    <TableCell className="text-right font-mono text-success">₹{r.enterprise}/min</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}

    </div>
  );
}
