import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, AlertCircle, FileAudio, FileVideo, X, ChevronDown } from 'lucide-react';
import { useCreateJob, useGetJob, JobInputType } from '@workspace/api-client-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = ['.mpeg', '.mov', '.mpg', '.wav', '.mp4', '.mp3'];
const ACCEPTED_MIME = [
  'video/mpeg', 'video/quicktime', 'video/mp4', 'video/x-mpeg',
  'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4',
  'video/mpg',
].join(',');
const FORMAT_LABELS = ['MPEG', 'MOV', 'MPG', 'WAV', 'MP4', 'MP3'];
const MAX_SIZE_MB = 500;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Comprehensive language list — "auto" is handled separately as the first option
const LANGUAGES = [
  'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Azerbaijani',
  'Basque', 'Belarusian', 'Bengali', 'Bosnian', 'Bulgarian',
  'Catalan', 'Cebuano', 'Chinese (Mandarin)', 'Chinese (Cantonese)', 'Croatian', 'Czech',
  'Danish', 'Dutch',
  'English', 'English (UK)', 'English (US)', 'English (Indian)', 'Estonian',
  'Filipino', 'Finnish', 'French',
  'Galician', 'Georgian', 'German', 'Greek', 'Gujarati',
  'Hausa', 'Hebrew', 'Hindi', 'Hungarian',
  'Icelandic', 'Igbo', 'Indonesian', 'Irish', 'Italian',
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
  'Vietnamese',
  'Welsh',
  'Xhosa',
  'Yoruba',
  'Zulu',
];

// ─── Small helpers ─────────────────────────────────────────────────────────────

function isAcceptedFile(file: File): boolean {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function LanguageSelect({
  label,
  value,
  onChange,
  includeAuto = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  includeAuto?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground-3">{label}</label>
      <div className="relative">
        <select
          className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {includeAuto && <option value="auto">Auto-detect</option>}
          {placeholder && !includeAuto && <option value="" disabled>{placeholder}</option>}
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-4" />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface ToolLayoutProps {
  title: string;
  description: string;
  type: JobInputType;
  ratePerMinute: number;
  icon: React.ElementType;
  renderResult: (job: any) => React.ReactNode;
}

export function ToolLayout({ title, description, type, icon: Icon, renderResult }: ToolLayoutProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Language state
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('Hindi');   // dubbing
  const [translateTo, setTranslateTo] = useState('');              // transcript translation (empty = none)
  const [showTranslateTo, setShowTranslateTo] = useState(false);

  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createJob = useCreateJob();
  const { data: job } = useGetJob(activeJobId!, {
    query: {
      enabled: !!activeJobId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === 'completed' || status === 'failed' ? false : 3000;
      },
    },
  });

  const validateAndSetFile = (f: File) => {
    setFileError(null);
    if (!isAcceptedFile(f)) {
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

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleRemove = () => {
    setFile(null); setFileError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = () => {
    if (!file) return;
    createJob.mutate({
      data: {
        type,
        inputFilename: file.name,
        inputDurationMinutes: 0,
        domain: 'general',
        sourceLanguage,
        targetLanguage: type === 'dubbing' ? targetLanguage : undefined,
        translateTo: showTranslateTo && translateTo ? translateTo : undefined,
      },
    }, {
      onSuccess: (newJob) => setActiveJobId(newJob.id),
    });
  };

  const canTranslate = type === 'transcription' || type === 'subtitling';
  const isVideoFile = file?.name.match(/\.(mp4|mov|mpeg|mpg)$/i);

  return (
    <div className="page-enter h-full flex flex-col">
      {/* Header */}
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
        {/* ── Left: Upload + Config ── */}
        <div className="flex flex-col gap-6">
          <Card className="flex-1 border-border shadow-sm">
            <CardContent className="p-6 flex flex-col gap-5 h-full">

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center min-h-[200px] cursor-pointer select-none
                  ${file
                    ? 'border-primary/50 bg-background/50'
                    : isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : fileError
                    ? 'border-danger/50 bg-danger-bg/30'
                    : 'border-border hover:border-foreground-4 hover:bg-background-2/40'
                  }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !file && inputRef.current?.click()}
              >
                {!file ? (
                  <>
                    <div className="w-12 h-12 bg-background-2 rounded-full flex items-center justify-center text-foreground-3 mb-4">
                      <UploadCloud size={24} />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">
                      {isDragging ? 'Drop to upload' : 'Upload Media File'}
                    </h3>
                    <p className="text-sm text-foreground-4 mb-5">Drag and drop or click to browse</p>
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                      {FORMAT_LABELS.map((fmt) => (
                        <span key={fmt} className="px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide bg-foreground text-background">
                          {fmt}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-foreground-4">Max file size: 500 MB</p>
                    {fileError && (
                      <p className="text-xs text-danger mt-3 flex items-center gap-1.5">
                        <AlertCircle size={12} /> {fileError}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                      {isVideoFile ? <FileVideo size={24} /> : <FileAudio size={24} />}
                    </div>
                    <h3 className="font-medium text-foreground mb-1 truncate max-w-xs" title={file.name}>{file.name}</h3>
                    <p className="text-sm text-foreground-4 mb-4">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                      className="flex items-center gap-1.5 text-sm text-foreground-3 hover:text-danger transition-colors"
                    >
                      <X size={14} /> Remove
                    </button>
                  </>
                )}
                <input ref={inputRef} type="file" className="hidden" accept={ACCEPTED_MIME} onChange={handleFileChange} />
              </div>

              {/* ── Language config ── */}
              <div className={`grid gap-4 ${type === 'dubbing' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <LanguageSelect
                  label="Source Language"
                  value={sourceLanguage}
                  onChange={setSourceLanguage}
                  includeAuto
                />
                {type === 'dubbing' && (
                  <LanguageSelect
                    label="Target Language"
                    value={targetLanguage}
                    onChange={setTargetLanguage}
                  />
                )}
              </div>

              {/* Translate output — transcription + subtitling only */}
              {canTranslate && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                    <div
                      onClick={() => setShowTranslateTo((v) => !v)}
                      className={`w-9 h-5 rounded-full transition-colors relative shrink-0
                        ${showTranslateTo ? 'bg-primary' : 'bg-border'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                        ${showTranslateTo ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground-3 group-hover:text-foreground transition-colors">
                      Translate output
                    </span>
                  </label>

                  {showTranslateTo && (
                    <LanguageSelect
                      label="Translate to"
                      value={translateTo}
                      onChange={setTranslateTo}
                      placeholder="Select a language…"
                    />
                  )}
                </div>
              )}

              {/* Submit footer */}
              <div className="mt-auto pt-5 border-t border-border flex items-center justify-between">
                <p className="text-xs text-foreground-4 leading-tight max-w-[180px]">
                  Credits calculated after processing completes.
                </p>
                <Button
                  onClick={handleSubmit}
                  disabled={!file || !!fileError || createJob.isPending || activeJobId !== null}
                  isLoading={createJob.isPending}
                  className="w-32"
                >
                  Start Job
                </Button>
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
                <p className="text-sm max-w-sm">Upload a file and start the job to see results here.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Status bar */}
                <div className="p-4 border-b border-border bg-background-2/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">Job #{job?.id ?? activeJobId}</span>
                    <span className={`text-xs px-2 py-1 rounded-md capitalize tracking-wider font-semibold
                      ${job?.status === 'completed' ? 'bg-success-bg text-success'
                        : job?.status === 'failed' ? 'bg-danger-bg text-danger'
                        : 'bg-info-bg text-info'}`}>
                      {job?.status ?? 'Starting…'}
                    </span>
                  </div>
                  {(job?.status === 'processing' || job?.status === 'pending') && (
                    <span className="text-sm font-mono text-foreground-3">{job?.progressPercent ?? 0}%</span>
                  )}
                </div>

                {/* Processing */}
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
                    <Button variant="outline" className="mt-6" onClick={() => { setActiveJobId(null); handleRemove(); }}>
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
