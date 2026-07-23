import React from 'react';
import { useGetDashboardStats, useGetRecentActivity } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, MonitorPlay, Subtitles, Mic2, Activity, Wallet, Clock, CheckCircle2 } from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({ limit: 5 });

  if (statsLoading || activityLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'transcription': return <FileText size={16} />;
      case 'subtitling': return <Subtitles size={16} />;
      case 'captioning': return <MonitorPlay size={16} />;
      case 'dubbing': return <Mic2 size={16} />;
      default: return <Activity size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'failed': return <Badge variant="danger">Failed</Badge>;
      case 'processing': return <Badge variant="info">Processing</Badge>;
      default: return <Badge variant="default">Pending</Badge>;
    }
  };

  return (
    <div className="page-enter space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">Overview</h1>
        <p className="text-foreground-3">Here's what's happening in your studio today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-foreground-3 border border-border">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground-4 mb-1">Total Jobs Run</p>
            <h3 className="text-3xl font-bold font-serif">{stats?.totalJobs || 0}</h3>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-info-bg flex items-center justify-center text-info border border-info/20">
                <Clock size={20} />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground-4 mb-1">Minutes Processed</p>
            <h3 className="text-3xl font-bold font-serif">{stats?.totalMinutesProcessed || 0}</h3>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center text-success border border-success/20">
                <Wallet size={20} />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground-4 mb-1">Credits Remaining</p>
            <h3 className="text-3xl font-bold font-serif font-mono tracking-tight">{formatCurrency(stats?.creditBalance || 0)}</h3>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-warning-bg flex items-center justify-center text-warning border border-warning/20">
                <Activity size={20} />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground-4 mb-1">Credits Spent</p>
            <h3 className="text-3xl font-bold font-serif font-mono tracking-tight">{formatCurrency(stats?.totalCreditsSpent || 0)}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity && activity.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map(job => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium max-w-[200px] truncate text-foreground" title={job.inputFilename}>
                        {job.inputFilename}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-foreground-3 capitalize">
                          {getTypeIcon(job.type)}
                          <span className="text-xs">{job.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="text-right text-foreground-4 text-xs whitespace-nowrap">
                        {formatDate(job.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-foreground-4 text-sm">
                No recent activity. Try running a job.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { type: 'transcription', count: stats?.jobsByType?.transcription || 0, icon: FileText, color: 'bg-info' },
                { type: 'subtitling', count: stats?.jobsByType?.subtitling || 0, icon: Subtitles, color: 'bg-success' },
                { type: 'captioning', count: stats?.jobsByType?.captioning || 0, icon: MonitorPlay, color: 'bg-warning' },
                { type: 'dubbing', count: stats?.jobsByType?.dubbing || 0, icon: Mic2, color: 'bg-danger' }
              ].map(item => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-background-2 flex items-center justify-center text-foreground-3">
                      <item.icon size={16} />
                    </div>
                    <span className="capitalize text-sm font-medium">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
