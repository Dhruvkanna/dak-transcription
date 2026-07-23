import React from 'react';
import { useLocation } from 'wouter';
import { FileText, Subtitles, MonitorPlay, Mic2, X } from 'lucide-react';

interface Option {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
  color: string;
  bg: string;
}

const options: Option[] = [
  {
    icon: FileText,
    title: 'Get a text document',
    description: 'A clean readable transcript you can copy, edit, and share — perfect for meetings, interviews, or lectures.',
    path: '/transcription',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    icon: Subtitles,
    title: 'Create a subtitle file',
    description: 'An .SRT or .VTT file ready to upload to YouTube, Premiere, DaVinci Resolve, or any video player.',
    path: '/subtitling',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    icon: MonitorPlay,
    title: 'Burn captions into video',
    description: 'Text baked permanently into the video — viewers see it without any separate subtitle file.',
    path: '/captioning',
    color: 'text-violet-700 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
  },
  {
    icon: Mic2,
    title: 'Translate & dub the voice',
    description: 'Replace the original voice with a new language, preserving the speaker\'s tone and rhythm.',
    path: '/dubbing',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
];

export function NewJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();

  if (!open) return null;

  function choose(path: string) {
    onClose();
    navigate(path);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative bg-background rounded-2xl shadow-2xl w-full max-w-2xl p-8 z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-foreground-3 hover:bg-background-2 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mb-7">
          <h2 className="font-serif text-2xl font-bold text-foreground mb-1">
            What do you need from this file?
          </h2>
          <p className="text-sm text-foreground-3">
            Choose an output and we'll walk you through the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.path}
                onClick={() => choose(opt.path)}
                className="group text-left rounded-xl border border-border p-5 hover:border-foreground-3 hover:shadow-md transition-all duration-150 bg-background hover:bg-background-2"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4 ${opt.bg}`}>
                  <Icon size={20} className={opt.color} />
                </div>
                <p className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {opt.title}
                </p>
                <p className="text-sm text-foreground-3 leading-relaxed">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
