import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { UploadCloud, CheckCircle2, AlertCircle, FileAudio, FileVideo, Download } from 'lucide-react';
import { useCreateJob, useGetJob, JobDomain, JobInputType } from '@workspace/api-client-react';

interface ToolLayoutProps {
  title: string;
  description: string;
  type: JobInputType;
  ratePerMinute: number;
  icon: React.ElementType;
  acceptFormats: string;
  extraConfig?: React.ReactNode;
  onExtraConfigChange?: (data: any) => void;
  renderResult: (job: any) => React.ReactNode;
}

export function ToolLayout({ 
  title, 
  description, 
  type, 
  ratePerMinute,
  icon: Icon,
  acceptFormats,
  extraConfig,
  renderResult
}: ToolLayoutProps) {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>(5); // Mock duration
  const [domain, setDomain] = useState<JobDomain>('general');
  const [targetLanguage, setTargetLanguage] = useState<string>('es');
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const createJob = useCreateJob();
  const { data: job, error } = useGetJob(activeJobId!, {
    query: {
      enabled: !!activeJobId,
      refetchInterval: (query) => {
        // Stop polling if completed or failed
        const status = query.state.data?.status;
        if (status === 'completed' || status === 'failed') return false;
        return 3000;
      }
    }
  });

  const cost = duration * ratePerMinute;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!file) return;
    createJob.mutate({
      data: {
        type,
        inputFilename: file.name,
        inputDurationMinutes: duration,
        domain,
        targetLanguage: type === 'dubbing' ? targetLanguage : undefined
      }
    }, {
      onSuccess: (newJob) => {
        setActiveJobId(newJob.id);
      }
    });
  };

  return (
    <div className="page-enter h-full flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-background-2 flex items-center justify-center text-foreground-2 border border-border">
            <Icon size={20} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{title}</h1>
        </div>
        <p className="text-foreground-3 max-w-2xl">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* Left Panel: Config */}
        <div className="flex flex-col gap-6">
          <Card className="flex-1 border-border shadow-sm">
            <CardContent className="p-6 flex flex-col gap-6 h-full">
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors flex flex-col items-center justify-center min-h-[200px]
                  ${file ? 'border-primary bg-background/50' : 'border-border hover:border-foreground-4 hover:bg-background-2/50'}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {!file ? (
                  <>
                    <div className="w-12 h-12 bg-background-2 rounded-full flex items-center justify-center text-foreground-3 mb-4">
                      <UploadCloud size={24} />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">Upload Media File</h3>
                    <p className="text-sm text-foreground-4 mb-4">Drag and drop or click to browse</p>
                    <p className="text-xs text-foreground-4 font-mono">{acceptFormats}</p>
                    <input 
                      type="file" 
                      className="hidden" 
                      id="file-upload" 
                      accept=".mp3,.mp4,.wav,.m4a,.mov,.mkv" 
                      onChange={handleFileChange}
                    />
                    <Button variant="outline" className="mt-4" onClick={() => document.getElementById('file-upload')?.click()}>
                      Select File
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                      {file.name.match(/\.(mp4|mov|mkv)$/i) ? <FileVideo size={24} /> : <FileAudio size={24} />}
                    </div>
                    <h3 className="font-medium text-foreground mb-1 truncate max-w-xs">{file.name}</h3>
                    <p className="text-sm text-foreground-4 mb-4">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Domain / Content Type</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as JobDomain)}
                  >
                    <option value="general">General</option>
                    <option value="legal">Legal</option>
                    <option value="medical">Medical</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label>Duration (Minutes)</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    value={duration} 
                    onChange={(e) => setDuration(parseInt(e.target.value) || 0)} 
                    placeholder="e.g. 15"
                  />
                  <p className="text-[10px] text-foreground-4">Simulated config since no real file processing</p>
                </div>
              </div>

              {type === 'dubbing' && (
                <div className="space-y-2">
                  <Label>Target Language</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                  >
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="hi">Hindi</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground-4">Estimated Cost</p>
                  <p className="text-lg font-semibold font-mono text-foreground">Rs. {cost}</p>
                </div>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!file || createJob.isPending || activeJobId !== null}
                  isLoading={createJob.isPending}
                  className="w-32"
                >
                  Start Job
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Result */}
        <div className="flex flex-col h-full">
          <Card className="flex-1 bg-background border-border shadow-sm overflow-hidden flex flex-col">
            {!activeJobId && !job ? (
              <div className="flex-1 flex flex-col items-center justify-center text-foreground-4 p-8 text-center bg-background-2/30">
                <div className="w-16 h-16 rounded-full bg-background-2 flex items-center justify-center mb-4 text-foreground-3">
                  <Icon size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-medium text-foreground-2 mb-2">Ready to process</h3>
                <p className="text-sm max-w-sm">Upload a file and configure the job to see results here.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-border bg-background-2/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">Job #{job?.id || activeJobId}</span>
                    <span className={`text-xs px-2 py-1 rounded-md capitalize tracking-wider font-semibold
                      ${job?.status === 'completed' ? 'bg-success-bg text-success' : 
                        job?.status === 'failed' ? 'bg-danger-bg text-danger' : 
                        'bg-info-bg text-info'}`}
                    >
                      {job?.status || 'Starting...'}
                    </span>
                  </div>
                  {job?.status === 'processing' && (
                    <div className="text-sm font-mono text-foreground-3">
                      {job.progressPercent || 0}%
                    </div>
                  )}
                </div>

                {job?.status === 'processing' || job?.status === 'pending' || !job ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                    <div className="relative w-20 h-20">
                      <svg className="animate-spin w-full h-full text-border" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-primary font-medium text-sm">
                        {job?.progressPercent || 0}%
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="font-medium text-foreground mb-1">Processing Media</h4>
                      <p className="text-sm text-foreground-3">Applying AI models to your content...</p>
                    </div>
                    
                    <div className="w-full max-w-sm h-2 bg-background-3 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-info transition-all duration-500 ease-out"
                        style={{ width: `${job?.progressPercent || 0}%` }}
                      />
                    </div>
                  </div>
                ) : job?.status === 'failed' ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-danger-bg flex items-center justify-center mb-4 text-danger">
                      <AlertCircle size={32} />
                    </div>
                    <h4 className="font-medium text-foreground text-lg mb-2">Processing Failed</h4>
                    <p className="text-sm text-danger max-w-sm">{job.errorMessage || 'An unknown error occurred during processing.'}</p>
                    <Button variant="outline" className="mt-6" onClick={() => setActiveJobId(null)}>Try Again</Button>
                  </div>
                ) : job?.status === 'completed' ? (
                  <div className="flex-1 overflow-auto bg-background p-0 relative">
                    {renderResult(job)}
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
