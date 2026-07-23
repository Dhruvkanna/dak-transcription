import React, { useState } from 'react';
import { useGetWallet, useListTransactions, useTopUpWallet } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CreditCard, Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetWalletQueryKey, getListTransactionsQueryKey } from '@workspace/api-client-react';

export default function Billing() {
  const queryClient = useQueryClient();
  const { data: wallet, isLoading: walletLoading } = useGetWallet();
  const { data: transactions, isLoading: txLoading } = useListTransactions({ limit: 50 });
  const topUpMutation = useTopUpWallet();

  const [topUpAmount, setTopUpAmount] = useState<string>('1000');

  const handleTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(topUpAmount);
    if (!amount || amount <= 0) return;

    topUpMutation.mutate({ data: { amount } }, {
      onSuccess: () => {
        setTopUpAmount('1000');
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      }
    });
  };

  return (
    <div className="page-enter space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">Billing & Credits</h1>
        <p className="text-foreground-3">Manage your wallet balance and view transaction history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          <Card className="bg-foreground text-background border-none overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-background/5 rounded-bl-full -mr-10 -mt-10"></div>
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="p-3 bg-background/10 rounded-xl">
                  <WalletIcon size={24} className="text-accent-light" />
                </div>
                <Badge className="bg-accent text-accent-foreground uppercase tracking-widest text-[10px] font-bold border-none">
                  {wallet?.planType || 'FREE'} PLAN
                </Badge>
              </div>
              <p className="text-background/70 text-sm font-medium mb-1">Available Balance</p>
              <h2 className="text-4xl font-serif font-bold font-mono tracking-tight text-accent-light mb-8">
                {walletLoading ? '...' : formatCurrency(wallet?.balance || 0)}
              </h2>
              
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-background/10">
                <div>
                  <p className="text-xs text-background/60 mb-1">Total Spent</p>
                  <p className="font-mono font-medium">{formatCurrency(wallet?.totalSpent || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-background/60 mb-1">Total Processed</p>
                  <p className="font-medium">{wallet?.totalMinutesProcessed || 0} mins</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap size={18} className="text-warning" />
                Top Up Credits
              </CardTitle>
              <CardDescription>Add credits to process more media.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTopUp} className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount (Rs.)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-4">₹</span>
                    <Input 
                      type="number" 
                      min="100" 
                      className="pl-8" 
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="Amount to add"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[500, 1000, 5000].map(amt => (
                    <Button 
                      key={amt} 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setTopUpAmount(amt.toString())}
                      className={parseInt(topUpAmount) === amt ? "border-primary bg-primary/5 text-primary" : ""}
                    >
                      +{amt}
                    </Button>
                  ))}
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={topUpMutation.isPending || !topUpAmount || parseInt(topUpAmount) < 100}
                  isLoading={topUpMutation.isPending}
                >
                  Confirm Payment
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <Card className="lg:col-span-2 flex flex-col h-full min-h-[500px]">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>A log of your top-ups and job deductions.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-auto border-t border-border">
            {txLoading ? (
               <div className="flex items-center justify-center p-12">
                 <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
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
                  {transactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-foreground-4 text-xs whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-full ${tx.type === 'credit' ? 'bg-success-bg text-success' : 'bg-background-3 text-foreground-3'}`}>
                            {tx.type === 'credit' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          </div>
                          <span>{tx.description}</span>
                          {tx.jobId && (
                            <Badge variant="outline" className="text-[10px] font-mono py-0 ml-2">Job #{tx.jobId}</Badge>
                          )}
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
    </div>
  );
}
