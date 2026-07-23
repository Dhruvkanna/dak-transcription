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
  CheckCircle2, ExternalLink, AlertTriangle, Gift, Zap,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PackConfig {
  label: string;
  priceInr: number;
  walletCredit: number;
  bonus: number;
  description: string;
  tag?: string;
}

interface RateConfig { [op: string]: number; }

const RATE_LABELS: Record<string, string> = {
  transcription: "Transcription",
  subtitling:    "Subtitling",
  captioning:    "Captioning",
  dubbing:       "AI Dubbing",
};

function fmtInr(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Billing() {
  const queryClient = useQueryClient();
  const { data: wallet, isLoading: walletLoading } = useGetWallet();
  const { data: transactions, isLoading: txLoading } = useListTransactions({ limit: 50 });

  const [packs, setPacks]       = useState<Record<string, PackConfig>>({});
  const [rates, setRates]       = useState<RateConfig>({});
  const [topupMin, setTopupMin] = useState(200);
  const [topupAmount, setTopupAmount] = useState('500');
  const [loading, setLoading]   = useState<string | null>(null);
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const BASE = import.meta.env.BASE_URL;

  useEffect(() => {
    fetch(`${BASE}api/payments/packs`)
      .then(r => r.json())
      .then(d => {
        setPacks(d.packs ?? {});
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

  // ── Buy a credit pack ────────────────────────────────────────────────────

  const buyPack = useCallback(async (packId: string) => {
    setLoading(`pack-${packId}`);
    try {
      const res = await fetch(`${BASE}api/payments/buy-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Failed to create payment link", "error"); return; }
      if (data.shortUrl) window.location.href = data.shortUrl;
      else showToast("No payment link returned — please try again.", "error");
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setLoading(null);
    }
  }, [BASE]);

  // ── Custom top-up ─────────────────────────────────────────────────────────

  const topUp = useCallback(async () => {
    const amount = parseInt(topupAmount, 10);
    if (!amount || amount < topupMin) {
      showToast(`Minimum top-up is ₹${topupMin}`, "error");
      return;
    }
    setLoading("topup");
    try {
      const res = await fetch(`${BASE}api/payments/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Failed to create payment link", "error"); return; }
      if (data.shortUrl) window.location.href = data.shortUrl;
      else showToast("No payment link returned — please try again.", "error");
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setLoading(null);
    }
  }, [BASE, topupAmount, topupMin]);

  const balance = Number(wallet?.balance ?? 0);

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
        <p className="text-foreground-3">Top up your wallet and run jobs. Pay only for what you use.</p>
      </div>

      {/* Wallet + transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left column: balance card + top-up */}
        <div className="space-y-4">

          {/* Balance card */}
          <Card className="border-none overflow-hidden relative" style={{ background: '#111111', color: '#F4F3EE' }}>
            <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full -mr-10 -mt-10" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <WalletIcon size={24} style={{ color: '#E4C980' }} />
                </div>
                {balance > 0 && (
                  <Badge className="text-[10px] font-bold uppercase tracking-widest border" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.25)' }}>
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: 'rgba(244,243,238,0.6)' }}>Wallet Balance</p>
              <h2 className="text-4xl font-serif font-bold font-mono tracking-tight mb-8" style={{ color: '#E4C980' }}>
                {walletLoading ? '…' : fmtInr(wallet?.balance)}
              </h2>
              <div className="grid grid-cols-2 gap-4 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'rgba(244,243,238,0.5)' }}>Total Spent</p>
                  <p className="font-mono font-medium">{fmtInr(wallet?.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'rgba(244,243,238,0.5)' }}>Jobs Run</p>
                  <p className="font-medium">{wallet?.totalJobsRun ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Low balance warning */}
          {!walletLoading && balance < 50 && (
            <Card className="border-danger/30 bg-danger-bg/40">
              <CardContent className="p-5 flex gap-3">
                <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold mb-1">Low balance</p>
                  <p className="text-xs text-foreground-4">Top up to keep running jobs without interruption.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Custom top-up */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Custom Top-Up</CardTitle>
              <CardDescription className="text-xs">Add any amount. Minimum ₹{topupMin}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
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
                <Label className="text-xs text-foreground-4 mb-1.5 block">Amount (₹)</Label>
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
                  <><ExternalLink size={14} className="mr-2" />Top Up ₹{parseInt(topupAmount || '0', 10).toLocaleString('en-IN')}</>
                )}
              </Button>
            </CardContent>
          </Card>
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
                        <TableCell className="text-foreground-4 text-xs whitespace-nowrap">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-full shrink-0 ${
                              isCredit ? 'bg-success-bg text-success' :
                              isRefund ? 'bg-primary/10 text-primary' :
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
                            {isCredit ? '+' : isRefund ? '↩ ' : '−'}{fmtInr(tx.amount)}
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

      {/* ── Credit packs ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-serif font-semibold tracking-tight mb-1">Credit Packs</h2>
          <p className="text-foreground-3 text-sm">
            Buy a pack and get instant wallet credit. Bigger packs come with bonus credits on top.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(packs).map(([packId, pack]) => {
            const isPopular   = pack.tag === "Most Popular";
            const isBestValue = pack.tag === "Best Value";
            const highlighted = isPopular || isBestValue;

            return (
              <Card key={packId} className={`relative flex flex-col transition-shadow hover:shadow-md
                ${highlighted ? 'border-primary shadow-sm ring-1 ring-primary/20' : ''}`}>

                {pack.tag && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest px-3 whitespace-nowrap">
                      {pack.tag}
                    </Badge>
                  </div>
                )}

                <CardContent className="p-7 flex flex-col flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5
                    ${highlighted ? 'bg-primary text-primary-foreground' : 'bg-background-3 text-foreground-3'}`}>
                    <Zap size={18} />
                  </div>

                  <h3 className="text-lg font-semibold mb-1">{pack.label}</h3>
                  <p className="text-sm text-foreground-4 mb-5">{pack.description}</p>

                  {/* Price */}
                  <div className="mb-2">
                    <span className="text-3xl font-bold font-mono">₹{pack.priceInr.toLocaleString('en-IN')}</span>
                    <span className="text-foreground-4 text-sm ml-1">one-time</span>
                  </div>

                  {/* What they get */}
                  <div className="mb-6 p-3 rounded-xl bg-background-2 border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground-3">Wallet credit</span>
                      <span className="font-mono font-semibold">₹{pack.walletCredit.toLocaleString('en-IN')}</span>
                    </div>
                    {pack.bonus > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-success flex items-center gap-1.5">
                          <Gift size={13} /> Bonus included
                        </span>
                        <span className="font-mono font-semibold text-success">+₹{pack.bonus.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>

                  <Button className="w-full mt-auto" variant={highlighted ? "default" : "outline"}
                    onClick={() => buyPack(packId)} disabled={!!loading}>
                    {loading === `pack-${packId}` ? "Redirecting…" : (
                      <><ExternalLink size={13} className="mr-2" />Buy for ₹{pack.priceInr.toLocaleString('en-IN')}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Rate card ─────────────────────────────────────────────────────── */}
      {Object.keys(rates).length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-serif font-semibold tracking-tight mb-1">Rate Card</h2>
            <p className="text-foreground-3 text-sm">Per-minute charges deducted from your wallet before each job.</p>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right text-foreground-4">Example (30 min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(rates).map(([op, rate]) => (
                  <TableRow key={op}>
                    <TableCell className="font-medium">{RATE_LABELS[op] ?? op}</TableCell>
                    <TableCell className="text-right font-mono">₹{rate}/min</TableCell>
                    <TableCell className="text-right font-mono text-foreground-4">
                      ₹{(rate * 30).toLocaleString('en-IN')}
                    </TableCell>
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
