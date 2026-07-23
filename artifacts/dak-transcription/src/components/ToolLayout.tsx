import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  UploadCloud, AlertCircle, FileAudio, FileVideo,
  X, ChevronDown, ChevronRight, Check,
} from 'lucide-react';
import { useCreateJob, useGetJob, getGetJobQueryKey, JobInputType } from '@workspace/api-client-react';

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = ['.mpeg', '.mov', '.mpg', '.wav', '.mp4', '.mp3'];
const ACCEPTED_MIME = [
  'video/mpeg', 'video/quicktime', 'video/mp4', 'video/x-mpeg',
  'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4',
  'video/mpg',
].join(',');
const FORMAT_LABELS = ['MPEG', 'MOV', 'MPG', 'WAV', 'MP4', 'MP3'];
const MAX_SIZE_BYTES = 500 * 1024 * 1024;

const LANGUAGES = [
  'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Azerbaijani',
  'Basque', 'Belarusian', 'Bengali', 'Bosnian', 'Bulgarian',
  'Catalan', 'Chinese (Cantonese)', 'Chinese (Mandarin)', 'Croatian', 'Czech',
  'Danish', 'Dutch',
  'English', 'English (Indian)', 'English (UK)', 'English (US)', 'Estonian',
  'Filipino', 'Finnish', 'French',
  'Galician', 'Georgian', 'German', 'Greek', 'Gujarati',
  'Hausa', 'Hebrew', 'Hindi', 'Hungarian',
  'Icelandic', 'Indonesian', 'Irish', 'Italian',
  'Japanese', 'Javanese',
  'Kannada', 'Kazakh', 'Khmer', 'Korean',
  'Lao', 'Latvian', 'Lithuanian',
  'Macedonian', 'Malay', 'Malayalam', 'Maltese', 'Marathi', 'Mongolian',
  'Nepali', 'Norwegian',
  'Pashto', 'Persian', 'Polish', 'Portuguese', 'Punjabi',
  'Romanian', 'Russian',
  'Serbian', 'Sinhala', 'Slovak', 'Slovenian', 'Somali', 'Spanish', 'Swahili', 'Swedish',
  'Tamil', 'Telugu', 'Thai', 'Turkish',
  'Ukrainian', 'Urdu', 'Uzbek',
  'Vietnamese', 'Welsh', 'Xhosa', 'Yoruba', 'Zulu',
];

// ─── Step config ────────────────────────────────────────────────────────────────

type StepId = 'name' | 'source' | 'target' | 'upload';

function getSteps(type: JobInputType): { id: StepId; label: string }[] {
  const targetLabel = type === 'dubbing' ? 'Target Language' : 'Output Language';
  return [
    { id: 'name',   label: 'Project Name' },
    { id: 'source', label: 'Source Language' },
    { id: 'target', label: targetLabel },
    { id: 'upload', label: 'Upload File' },
  ];
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  current,
}: {
  steps: { id: StepId; label: string }[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${done    ? 'bg-primary text-primary-foreground'
                  : active  ? 'bg-foreground text-background'
                  :           'bg-background-3 text-foreground-4'}`}
              >
                {done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap transition-colors
                ${active ? 'text-foreground' : done ? 'text-primary' : 'text-foreground-4'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-1 mb-4 transition-colors ${i < current ? 'bg-primary' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function LanguageSelect({
  label,
  value,
  onChange,
  includeAuto = false,
  includeNone = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  includeAuto?: boolean;
  includeNone?: boolean;
}) {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-foreground-3">{label}</label>}
      <div className="relative">
        <select
          className="flex h-11 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {includeAuto && <option value="auto">Auto-detect</option>}
          {includeNone && <option value="">No translation</option>}
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-4" />
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

interface ToolLayoutProps {
  title: string;
  description: string;
  type: JobInputType;
  ratePerMinute: number;
  icon: React.ElementType;
  renderResult: (job: any) => React.ReactNode;
}

export function ToolLayout({ title, description, type, icon: Icon, renderResult }: ToolLayoutProps) {
  const steps = getSteps(type);

  // Wizard state
  const [step, setStep] = useState(0);
  const [jobName, setJobName] = useState('');
  const [jobNameError, setJobNameError] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState(type === 'dubbing' ? 'Hindi' : '');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Job state
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const createJob = useCreateJob();
  const { data: job } = useGetJob(activeJobId!, {
    query: {
      queryKey: getGetJobQueryKey(activeJobId!),
      enabled: !!activeJobId,
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return s === 'completed' || s === 'failed' ? false : 3000;
      },
    },
  });

  // ── Validation per step ────────────────────────────────────────────────────

  const canAdvance = () => {
    if (step === 0) return jobName.trim().length > 0;
    if (step === 1) return true; // source language always has a value
    if (step === 2) return type === 'dubbing' ? !!targetLanguage : true;
    return false;
  };

  const handleNext = () => {
    if (step === 0 && !jobName.trim()) {
      setJobNameError('Please enter a project name.');
      return;
    }
    setJobNameError('');
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  // ── File handling ──────────────────────────────────────────────────────────

  const validateAndSetFile = (f: File) => {
    setFileError(null);
    const ext = '.' + (f.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFileError(`Unsupported format. Please upload: ${FORMAT_LABELS.join(', ')}`);
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setFileError(`File is ${(f.size / (1024 * 1024)).toFixed(0)} MB — limit is 500 MB.`);
      return;
    }
    setFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };
  const handleRemoveFile = () => {
    setFile(null); setFileError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!file) return;
    createJob.mutate({
      data: {
        type,
        jobName: jobName.trim(),
        inputFilename: file.name,
        inputDurationMinutes: 0,
        domain: 'general',
        sourceLanguage,
        targetLanguage: type === 'dubbing' ? targetLanguage : undefined,
        translateTo: type !== 'dubbing' && targetLanguage ? targetLanguage : undefined,
      },
    }, {
      onSuccess: (newJob) => setActiveJobId(newJob.id),
    });
  };

  const isVideoFile = file?.name.match(/\.(mp4|mov|mpeg|mpg)$/i);
  const isUploadStep = step === 3;

  // ── Step content ───────────────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (step) {
      case 0: return (
        <div className="flex-1 flex flex-col justify-center py-4">
          <h2 className="text-lg font-semibold text-foreground mb-1">What are you working on?</h2>
          <p className="text-sm text-foreground-4 mb-6">Give this job a name so you can find it later in History.</p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground-3">Project / Document Name</label>
            <input
              type="text"
              autoFocus
              className={`flex h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors
                ${jobNameError ? 'border-danger' : 'border-input'}`}
              placeholder="e.g. Client Meeting — July 2026"
              value={jobName}
              onChange={(e) => { setJobName(e.target.value); setJobNameError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && canAdvance() && handleNext()}
            />
            {jobNameError && (
              <p className="text-xs text-danger flex items-center gap-1.5">
                <AlertCircle size={12} /> {jobNameError}
              </p>
            )}
          </div>
        </div>
      );

      case 1: return (
        <div className="flex-1 flex flex-col justify-center py-4">
          <h2 className="text-lg font-semibold text-foreground mb-1">What language is the media in?</h2>
          <p className="text-sm text-foreground-4 mb-6">
            Selecting the correct source language improves accuracy. Use <strong>Auto-detect</strong> if you're unsure.
          </p>
          <LanguageSelect value={sourceLanguage} onChange={setSourceLanguage} includeAuto />
        </div>
      );

      case 2: return (
        <div className="flex-1 flex flex-col justify-center py-4">
          {type === 'dubbing' ? (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-1">Which language should the dub be in?</h2>
              <p className="text-sm text-foreground-4 mb-6">The voice will be cloned and re-recorded in this language.</p>
              <LanguageSelect value={targetLanguage} onChange={setTargetLanguage} />
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-1">Translate the output?</h2>
              <p className="text-sm text-foreground-4 mb-6">
                Optionally translate your {type === 'transcription' ? 'transcript' : 'subtitles'} into another language. Leave as <strong>No translation</strong> to keep the original language.
              </p>
              <LanguageSelect value={targetLanguage} onChange={setTargetLanguage} includeNone />
            </>
          )}
        </div>
      );

      case 3: return (
        <div className="flex-1 flex flex-col justify-center py-2">
          <h2 className="text-lg font-semibold text-foreground mb-1">Upload your file</h2>
          <p className="text-sm text-foreground-4 mb-4">Max 500 MB · {FORMAT_LABELS.join(', ')}</p>

          {/* Summary pill */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="px-3 py-1 rounded-full text-xs bg-background-2 border border-border text-foreground-3 font-medium">{jobName}</span>
            <span className="px-3 py-1 rounded-full text-xs bg-background-2 border border-border text-foreground-3 font-medium">
              {sourceLanguage === 'auto' ? 'Auto-detect' : sourceLanguage}
            </span>
            {targetLanguage && (
              <span className="px-3 py-1 rounded-full text-xs bg-background-2 border border-border text-foreground-3 font-medium">
                → {targetLanguage}
              </span>
            )}
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all flex flex-col items-center justify-center cursor-pointer select-none
              ${file
                ? 'border-primary/50 bg-background/50'
                : isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : fileError
                ? 'border-danger/40 bg-danger-bg/20'
                : 'border-border hover:border-foreground-4 hover:bg-background-2/40'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && inputRef.current?.click()}
          >
            {!file ? (
              <>
                <div className="w-10 h-10 bg-background-2 rounded-full flex items-center justify-center text-foreground-3 mb-3">
                  <UploadCloud size={20} />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {isDragging ? 'Drop to upload' : 'Drag & drop or click to browse'}
                </p>
                {fileError && (
                  <p className="text-xs text-danger mt-2 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {fileError}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
                  {isVideoFile ? <FileVideo size={20} /> : <FileAudio size={20} />}
                </div>
                <p className="text-sm font-medium text-foreground truncate max-w-[240px] mb-1" title={file.name}>{file.name}</p>
                <p className="text-xs text-foreground-4 mb-2">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                  className="flex items-center gap-1 text-xs text-foreground-3 hover:text-danger transition-colors"
                >
                  <X size={12} /> Remove
                </button>
              </>
            )}
            <input ref={inputRef} type="file" className="hidden" accept={ACCEPTED_MIME} onChange={handleFileChange} />
          </div>
        </div>
      );
      default: return null;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="page-enter h-full flex flex-col">
      {/* Page header */}
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

        {/* ── Left: Wizard ── */}
        <div className="flex flex-col">
          <Card className="flex-1 border-border shadow-sm">
            <CardContent className="p-6 flex flex-col h-full">
              <StepIndicator steps={steps} current={step} />

              {/* Step body */}
              <div className="flex-1 flex flex-col">
                {renderStepContent()}
              </div>

              {/* Navigation */}
              <div className="pt-5 border-t border-border flex items-center justify-between mt-4">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={step === 0}
                  className="text-foreground-3"
                >
                  Back
                </Button>

                {!isUploadStep ? (
                  <Button onClick={handleNext} disabled={!canAdvance()} className="gap-1.5">
                    Continue <ChevronRight size={15} />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!file || !!fileError || createJob.isPending || activeJobId !== null}
                    isLoading={createJob.isPending}
                    className="w-32"
                  >
                    Start Job
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Result ── */}
        <div className="flex flex-col h-full">
          <Card className="flex-1 bg-background border-border shadow-sm overflow-hidden flex flex-col">
            {!activeJobId && !job ? (
              <div className="flex-1 flex flex-col items-center justify-center text-foreground-4 p-8 text-center bg-background-2/30">
                <div className="w-16 h-16 rounded-full bg-background-2 flex items-center justify-center mb-4 text-foreground-3">
                  <Icon size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-medium text-foreground-2 mb-2">Ready to process</h3>
                <p className="text-sm max-w-sm">Complete the steps on the left, then upload your file to begin.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Status bar */}
                <div className="p-4 border-b border-border bg-background-2/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-medium text-sm">{job?.jobName ?? `Job #${job?.id ?? activeJobId}`}</span>
                      {job?.jobName && <span className="text-xs text-foreground-4 ml-2">#{job?.id ?? activeJobId}</span>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-md capitalize tracking-wider font-semibold
                      ${job?.status === 'completed' ? 'bg-success-bg text-success'
                        : job?.status === 'failed'  ? 'bg-danger-bg text-danger'
                        :                             'bg-info-bg text-info'}`}>
                      {job?.status ?? 'Starting…'}
                    </span>
                  </div>
                  {(job?.status === 'processing' || job?.status === 'pending') && (
                    <span className="text-sm font-mono text-foreground-3">{job?.progressPercent ?? 0}%</span>
                  )}
                </div>

                {/* Processing spinner */}
                {(!job || job.status === 'processing' || job.status === 'pending') ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                    <div className="relative w-20 h-20">
                      <svg className="animate-spin w-full h-full text-border" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-primary font-medium text-sm">
                        {job?.progressPercent ?? 0}%
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="font-medium text-foreground mb-1">Processing Media</h4>
                      <p className="text-sm text-foreground-3">Applying AI models to your content…</p>
                    </div>
                    <div className="w-full max-w-sm h-2 bg-background-3 rounded-full overflow-hidden">
                      <div className="h-full bg-info transition-all duration-500 ease-out" style={{ width: `${job?.progressPercent ?? 0}%` }} />
                    </div>
                  </div>
                ) : job.status === 'failed' ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-danger-bg flex items-center justify-center mb-4 text-danger">
                      <AlertCircle size={32} />
                    </div>
                    <h4 className="font-medium text-foreground text-lg mb-2">Processing Failed</h4>
                    <p className="text-sm text-danger max-w-sm">{job.errorMessage ?? 'An unknown error occurred.'}</p>
                    <Button variant="outline" className="mt-6" onClick={() => { setActiveJobId(null); setStep(0); handleRemoveFile(); }}>
                      Try Again
                    </Button>
                  </div>
                ) : job.status === 'completed' ? (
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
