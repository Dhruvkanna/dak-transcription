import React, { useState } from 'react';
import { useListJobs, ListJobsType, ListJobsStatus } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Download, Search, FileText, Subtitles, MonitorPlay, Mic2 } from 'lucide-react';

export default function History() {
  const [typeFilter, setTypeFilter] = useState<ListJobsType | ''>('');
  const [statusFilter, setStatusFilter] = useState<ListJobsStatus | ''>('');
  
  const { data: jobs, isLoading } = useListJobs({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'transcription': return <FileText size={14} className="text-info" />;
      case 'subtitling': return <Subtitles size={14} className="text-success" />;
      case 'captioning': return <MonitorPlay size={14} className="text-warning" />;
      case 'dubbing': return <Mic2 size={14} className="text-danger" />;
      default: return null;
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
    <div className="page-enter space-y-6 pb-10 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">Job History</h1>
        <p className="text-foreground-3">Browse and download past processing jobs.</p>
      </div>

      <Card className="flex-1 flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center gap-4 bg-background-2/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-4" size={16} />
            <Input className="pl-9 bg-background" placeholder="Search filenames..." />
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <select 
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="">All Tools</option>
              <option value="transcription">Transcription</option>
              <option value="subtitling">Subtitling</option>
              <option value="captioning">Captioning</option>
              <option value="dubbing">Dubbing</option>
            </select>
            <select 
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        
        <CardContent className="p-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : jobs && jobs.length > 0 ? (
            <Table>
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[300px]">Filename</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[250px]" title={job.inputFilename}>{job.inputFilename}</span>
                        {job.domain && <span className="text-[10px] text-foreground-4 uppercase tracking-wider">{job.domain}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 capitalize">
                        {getTypeIcon(job.type)}
                        <span className="text-sm font-medium">{job.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground-3">{job.inputDurationMinutes}m</TableCell>
                    <TableCell className="font-mono text-sm">{job.creditsUsed ? formatCurrency(job.creditsUsed) : '-'}</TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-foreground-4 text-xs whitespace-nowrap">
                      {formatDate(job.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" disabled={job.status !== 'completed'}>
                        <Download size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-foreground-4">
              <div className="w-16 h-16 bg-background-2 rounded-full flex items-center justify-center mb-4 text-foreground-3">
                <Search size={24} />
              </div>
              <p>No jobs found matching your filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
