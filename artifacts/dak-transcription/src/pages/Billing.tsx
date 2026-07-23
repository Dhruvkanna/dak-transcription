import React, { useState, useEffect, useCallback } from 'react';
import { useGetWallet, useListTransactions } from '@workspace/api-client-react';
import { getGetWalletQueryKey, getListTransactionsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CreditCard, Wallet as WalletIcon, ArrowUpRight, ArrowDownRight,
  Zap, CheckCircle2, Crown, Building2, Sparkles, X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanConfig { label: string; priceInPaise: number; credits: number; description: string; }
interface PackConfig { label: string; priceInPaise: number; credits: number; }

const PLAN_FEATURES: Record<string, string[]> = {
  starter:  ["2,000 credits / month", "All 4 AI tools", "SRT, VTT, TXT export", "Email support"],
  pro:      ["6,000 credits / month", "All 4 AI tools", "All export formats incl. Word", "Priority processing", "Priority support"],
  business: ["18,000 credits / month", "All 4 AI tools", "All export formats", "Highest priority processing", "Dedicated support", "Team access"],
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter:  <Zap size={22} />,
  pro:      <Sparkles size={22} />,
  business: <Building2 size={22} />,
};

// ─── Razorpay loader ──────────────────────────────────────────────────────────

function loadRazorpay(): Promise<boolean> {
  return new Promise(resolve => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Billing() {
  const queryClient = useQueryClient();
  const { data: wallet, isLoading: walletLoading } = useGetWallet();
  const { data: transactions, isLoading: txLoading } = useListTransactions({ limit: 50 });

  const [plans, setPlans] = useState<Record<string, PlanConfig>>({});
  const [packs, setPacks] = useState<Record<string, PackConfig>>({});
  const [keyId, setKeyId] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const BASE = import.meta.env.BASE_URL;

  // Load config from API
  useEffect(() => {
    fetch(`${BASE}api/payments/plans`).then(r => r.json()).then(d => {
      setPlans(d.subscriptionPlans ?? {});
      setPacks(d.creditPacks ?? {});
    }).catch(() => {});
    fetch(`${BASE}api/payments/config`).then(r => r.json()).then(d => {
      setKeyId(d.keyId ?? '');
    }).catch(() => {});
  }, [BASE]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshWallet = () => {
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
  };

  // ── Credit pack purchase ─────────────────────────────────────────────────

  const buyPack = useCallback(async (packId: string) => {
    if (!keyId) { showToast("Payment system not configured", "error"); return; }
    setLoading(`pack-${packId}`);
    const loaded = await loadRazorpay();
    if (!loaded) { showToast("Failed to load payment gateway", "error"); setLoading(null); return; }

    try {
      const orderRes = await fetch(`${BASE}api/payments/create-order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error ?? "Order creation failed");

      const rzp = new (window as any).Razorpay({
        key: keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: "INR",
        name: "DAK Transcription",
        description: `${order.pack.label} — ${order.pack.credits} credits`,
        theme: { color: "#7C6B5A" },
        handler: async (response: any) => {
          const verifyRes = await fetch(`${BASE}api/payments/verify-payment`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, packId }),
          });
          const result = await verifyRes.json();
          if (verifyRes.ok) {
            showToast(`✓ ${order.pack.credits} credits added to your wallet!`, "success");
            refreshWallet();
          } else {
            showToast(result.error ?? "Payment verification failed", "error");
          }
        },
        modal: { ondismiss: () => setLoading(null) },
      });
      rzp.open();
    } catch (err: any) {
      showToast(err.message ?? "Something went wrong", "error");
    } finally {
      setLoading(null);
    }
  }, [keyId, BASE]);

  // ── Subscription purchase ────────────────────────────────────────────────

  const subscribeToPlan = useCallback(async (tier: string) => {
    if (!keyId) { showToast("Payment system not configured", "error"); return; }
    setLoading(`plan-${tier}`);
    const loaded = await loadRazorpay();
    if (!loaded) { showToast("Failed to load payment gateway", "error"); setLoading(null); return; }

    try {
      const subRes = await fetch(`${BASE}api/payments/create-subscription`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const sub = await subRes.json();
      if (!subRes.ok) throw new Error(sub.error ?? "Subscription creation failed");

      const plan = plans[tier];
      const rzp = new (window as any).Razorpay({
        key: keyId,
        subscription_id: sub.subscriptionId,
        name: "DAK Transcription",
        description: `${plan?.label ?? tier} Plan — ₹${(plan?.priceInPaise ?? 0) / 100}/month`,
        theme: { color: "#7C6B5A" },
        handler: async (response: any) => {
          const verifyRes = await fetch(`${BASE}api/payments/verify-subscription`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, tier }),
          });
          const result = await verifyRes.json();
          if (verifyRes.ok) {
            showToast(`✓ ${plan?.label} Plan activated! ${result.creditsAdded} credits added.`, "success");
            refreshWallet();
          } else {
            showToast(result.error ?? "Subscription verification failed", "error");
          }
        },
        modal: { ondismiss: () => setLoading(null) },
      });
      rzp.open();
    } catch (err: any) {
      showToast(err.message ?? "Something went wrong", "error");
    } finally {
      setLoading(null);
    }
  }, [keyId, BASE, plans]);

  // ── Cancel subscription ──────────────────────────────────────────────────

  const cancelSubscription = async () => {
    if (!confirm("Cancel your subscription? You keep your remaining credits.")) return;
    setLoading("cancel");
    const res = await fetch(`${BASE}api/payments/subscription`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) { showToast("Subscription cancelled.", "success"); refreshWallet(); }
    else showToast(data.error ?? "Failed to cancel", "error");
    setLoading(null);
  };

  const currentPlan = wallet?.planType ?? "free";
  const isSubscribed = currentPlan !== "free";

  return (
    <div className="page-enter space-y-10 pb-10 relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium transition-all
          ${toast.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">Billing & Credits</h1>
        <p className="text-foreground-3">Manage your plan, top up credits, and view transaction history.</p>
      </div>

      {/* Wallet balance card + transaction history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          {/* Balance card */}
          <Card className="bg-foreground text-background border-none overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-background/5 rounded-bl-full -mr-10 -mt-10" />
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="p-3 bg-background/10 rounded-xl">
                  <WalletIcon size={24} className="text-accent-light" />
                </div>
                <Badge className="bg-accent text-accent-foreground uppercase tracking-widest text-[10px] font-bold border-none flex items-center gap-1">
                  {currentPlan !== "free" && <Crown size={10} />}
                  {currentPlan.toUpperCase()} PLAN
                </Badge>
              </div>
              <p className="text-background/70 text-sm font-medium mb-1">Available Credits</p>
              <h2 className="text-4xl font-serif font-bold font-mono tracking-tight text-accent-light mb-8">
                {walletLoading ? '...' : formatCurrency(wallet?.balance || 0)}
              </h2>
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-background/10">
                <div>
                  <p className="text-xs text-background/60 mb-1">Total Spent</p>
                  <p className="font-mono font-medium">{formatCurrency(wallet?.totalSpent || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-background/60 mb-1">Minutes Processed</p>
                  <p className="font-medium">{wallet?.totalMinutesProcessed ?? 0} min</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cancel subscription (if active) */}
          {isSubscribed && (
            <Card className="border-danger/30 bg-danger-bg/30">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-foreground mb-1">Active: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan</p>
                <p className="text-xs text-foreground-4 mb-4">Your plan renews monthly. Cancelling stops future renewals but keeps existing credits.</p>
                <Button size="sm" variant="outline" className="w-full border-danger/40 text-danger hover:bg-danger hover:text-white text-xs"
                  onClick={cancelSubscription} disabled={loading === "cancel"}>
                  {loading === "cancel" ? "Cancelling…" : "Cancel Subscription"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Transaction history */}
        <Card className="lg:col-span-2 flex flex-col min-h-[420px]">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Credit top-ups and job deductions.</CardDescription>
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
                    <TableHead className="text-right">Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-foreground-4 text-xs whitespace-nowrap">{formatDate(tx.createdAt)}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-full ${tx.type === 'credit' ? 'bg-success-bg text-success' : 'bg-background-3 text-foreground-3'}`}>
                            {tx.type === 'credit' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          </div>
                          <span className="text-sm">{tx.description}</span>
                          {tx.jobId && <Badge variant="outline" className="text-[10px] font-mono py-0 ml-1">Job #{tx.jobId}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        <span className={tx.type === 'credit' ? 'text-success' : 'text-foreground'}>
                          {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-foreground-4">
                <CreditCard size={32} className="mb-4 text-border" />
                <p>No transactions yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Subscription Plans ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-serif font-semibold tracking-tight mb-1">Monthly Plans</h2>
          <p className="text-foreground-3 text-sm">Subscribe for a monthly credit allowance. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(plans).map(([tier, plan]) => {
            const isActive = currentPlan === tier;
            const isPro = tier === "pro";
            const features = PLAN_FEATURES[tier] ?? [];

            return (
              <Card key={tier} className={`relative flex flex-col transition-shadow hover:shadow-md
                ${isPro ? 'border-primary shadow-sm ring-1 ring-primary/20' : ''}
                ${isActive ? 'bg-primary/5 border-primary' : ''}`}>
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest px-3">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-7 flex flex-col flex-1">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5
                    ${isActive ? 'bg-primary text-primary-foreground' : 'bg-background-3 text-foreground-3'}`}>
                    {PLAN_ICONS[tier]}
                  </div>

                  <h3 className="text-lg font-semibold mb-1">{plan.label}</h3>
                  <p className="text-sm text-foreground-4 mb-4">{plan.description}</p>

                  <div className="mb-6">
                    <span className="text-3xl font-bold font-mono">₹{(plan.priceInPaise / 100).toLocaleString('en-IN')}</span>
                    <span className="text-foreground-4 text-sm">/month</span>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 size={15} className="text-success mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isActive ? (
                    <Button className="w-full" disabled variant="outline">
                      <CheckCircle2 size={15} className="mr-2 text-success" /> Current Plan
                    </Button>
                  ) : (
                    <Button className="w-full" variant={isPro ? "default" : "outline"}
                      onClick={() => subscribeToPlan(tier)}
                      disabled={!!loading || isSubscribed}>
                      {loading === `plan-${tier}` ? "Opening…" : isSubscribed ? "Change plan — cancel first" : `Subscribe to ${plan.label}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Credit Packs ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-serif font-semibold tracking-tight mb-1">Credit Packs</h2>
          <p className="text-foreground-3 text-sm">One-time top-ups. Buy credits whenever you need them, no commitment.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(packs).map(([packId, pack]) => {
            const rupees = pack.priceInPaise / 100;
            const rate = (pack.credits / rupees).toFixed(2);

            return (
              <Card key={packId} className="flex flex-col hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-sm font-semibold text-foreground-3 uppercase tracking-wider">{pack.label}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{rate} cr/₹</Badge>
                  </div>

                  <div className="mb-1">
                    <span className="text-2xl font-bold font-mono">{pack.credits.toLocaleString('en-IN')}</span>
                    <span className="text-foreground-4 text-sm ml-1">credits</span>
                  </div>
                  <p className="text-foreground-4 text-xs mb-6">₹{rupees.toLocaleString('en-IN')} one-time</p>

                  <Button size="sm" variant="outline" className="w-full mt-auto"
                    onClick={() => buyPack(packId)} disabled={!!loading}>
                    {loading === `pack-${packId}` ? "Opening…" : `Buy for ₹${rupees.toLocaleString('en-IN')}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

    </div>
  );
}
