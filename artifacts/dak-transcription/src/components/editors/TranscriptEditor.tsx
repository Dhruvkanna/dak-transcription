import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Download, ChevronsUpDown, UserCircle2, Copy, Check } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TranscriptBlock {
  id: string;
  timestamp: string; // "HH:MM:SS"
  speaker: string;
  text: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface TranscriptEditorProps {
  job: any;
  initialBlocks?: TranscriptBlock[];
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

const SPEAKERS = ['Speaker 1', 'Speaker 2', 'Speaker 3', 'Speaker 4', 'Narrator', 'Interviewer', 'Interviewee'];

const MOCK_BLOCKS: { speaker: string; text: string }[] = [
  { speaker: 'Speaker 1', text: 'Welcome. Today we will be discussing the key findings from our quarterly review and what they mean for the coming months.' },
  { speaker: 'Speaker 2', text: 'Thank you. The numbers are quite encouraging overall, though there are a few areas that require our attention.' },
  { speaker: 'Speaker 1', text: 'Could you walk us through the main highlights? Starting with the revenue figures.' },
  { speaker: 'Speaker 2', text: 'Of course. Revenue came in at roughly twelve percent above our projections, driven primarily by strong performance in the enterprise segment.' },
  { speaker: 'Speaker 1', text: 'That is excellent. What about the challenges you mentioned? The market headwinds in Q2 specifically.' },
  { speaker: 'Speaker 2', text: 'Right. We did see some compression in margins, about two and a half points, largely due to increased input costs. We are actively working to address that through renegotiated supplier contracts.' },
  { speaker: 'Speaker 1', text: 'And the timeline for that resolution?' },
  { speaker: 'Speaker 2', text: 'We expect to see the benefit in Q4. Our procurement team is confident the new terms will be finalised within six weeks.' },
];

function secsToHms(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function generateMockBlocks(jobId: number): TranscriptBlock[] {
  let cursor = 0;
  return MOCK_BLOCKS.map((b, i) => {
    const ts = secsToHms(cursor);
    const dur = 8 + ((jobId * 3 + i * 7) % 12);
    cursor += dur;
    return { id: `${jobId}-${i}`, timestamp: ts, speaker: b.speaker, text: b.text };
  });
}

function downloadText(content: string, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function toPlainText(blocks: TranscriptBlock[]): string {
  return blocks.map(b => `[${b.timestamp}] ${b.speaker}\n${b.text}`).join('\n\n');
}

function toVttTranscript(blocks: TranscriptBlock[]): string {
  let out = 'WEBVTT\n\n';
  blocks.forEach((b, i) => {
    out += `${i + 1}\n${b.timestamp}.000 --> ${b.timestamp}.000\n<v ${b.speaker}>${b.text}\n\n`;
  });
  return out;
}

// ─── Speaker badge ─────────────────────────────────────────────────────────────

const SPEAKER_COLORS: Record<string, string> = {
  'Speaker 1':   'bg-[#e8f4f8] text-[#2d7d99] border-[#b8dde8]',
  'Speaker 2':   'bg-[#f0f8e8] text-[#4a8a2d] border-[#c8e8b0]',
  'Speaker 3':   'bg-[#f8f0e8] text-[#996b2d] border-[#e8d0b0]',
  'Speaker 4':   'bg-[#f0e8f8] text-[#7a4aaa] border-[#d0b8e8]',
  'Narrator':    'bg-[#f8e8e8] text-[#aa4a4a] border-[#e8b8b8]',
  'Interviewer': 'bg-[#e8f8f0] text-[#2d9a6b] border-[#b0e8d0]',
  'Interviewee': 'bg-[#f8f8e8] text-[#8a8a2d] border-[#e0e0b0]',
};

function speakerStyle(speaker: string): string {
  return SPEAKER_COLORS[speaker] ?? 'bg-background-3 text-foreground-3 border-border';
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function TranscriptEditor({ job, initialBlocks }: TranscriptEditorProps) {
  const [blocks, setBlocks] = useState<TranscriptBlock[]>(
    () => initialBlocks && initialBlocks.length > 0 ? initialBlocks : generateMockBlocks(job.id)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTs, setEditingTs] = useState<string | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const autoGrowRef = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const addAfter = useCallback((id: string | null) => {
    const idx = id ? blocks.findIndex(b => b.id === id) : blocks.length - 1;
    const ref = blocks[idx];
    setBlocks(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, {
        id: `new-${Date.now()}`,
        timestamp: ref?.timestamp ?? '00:00:00',
        speaker: ref?.speaker ?? 'Speaker 1',
        text: '',
      });
      return next;
    });
    setTimeout(() => {
      const newId = `new-${Date.now() - 1}`;
      const keys = Object.keys(autoGrowRef.current);
      autoGrowRef.current[keys[idx + 1]]?.focus();
    }, 50);
  }, [blocks]);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(null);
  }, []);

  const updateField = (id: string, field: keyof TranscriptBlock, value: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const copyAll = () => {
    navigator.clipboard.writeText(toPlainText(blocks)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const wordCount = blocks.reduce((acc, b) => acc + b.text.split(/\s+/).filter(Boolean).length, 0);

  // ── Block row ────────────────────────────────────────────────────────────────

  const BlockRow = ({ block, index }: { block: TranscriptBlock; index: number }) => {
    const isSelected = block.id === selectedId;
    const textRef = (el: HTMLTextAreaElement | null) => { autoGrowRef.current[block.id] = el; };

    return (
      <div
        className={`group flex gap-0 border-b border-border transition-colors
          ${isSelected ? 'bg-primary/5' : 'hover:bg-background-2/40'}`}
        onClick={() => setSelectedId(block.id)}
      >
        {/* Left gutter: timestamp + speaker */}
        <div className="w-44 shrink-0 flex flex-col gap-2 px-4 py-4 border-r border-border">

          {/* Timestamp */}
          {editingTs === block.id ? (
            <input
              autoFocus
              className="font-mono text-xs bg-background border border-primary rounded px-1.5 py-0.5 w-24 focus:outline-none"
              value={block.timestamp}
              onChange={e => updateField(block.id, 'timestamp', e.target.value)}
              onBlur={() => setEditingTs(null)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTs(null); }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <button
              className="font-mono text-xs text-foreground-4 text-left hover:text-foreground transition-colors w-fit"
              title="Click to edit timestamp"
              onClick={e => { e.stopPropagation(); setEditingTs(block.id); }}
            >
              {block.timestamp}
            </button>
          )}

          {/* Speaker */}
          {editingSpeaker === block.id ? (
            <select
              autoFocus
              className="text-xs rounded border border-primary bg-background px-1.5 py-1 focus:outline-none w-full"
              value={block.speaker}
              onChange={e => { updateField(block.id, 'speaker', e.target.value); setEditingSpeaker(null); }}
              onBlur={() => setEditingSpeaker(null)}
              onClick={e => e.stopPropagation()}
            >
              {SPEAKERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <button
              className={`text-xs px-2 py-1 rounded border w-full text-left font-medium transition-colors ${speakerStyle(block.speaker)}`}
              title="Click to change speaker"
              onClick={e => { e.stopPropagation(); setEditingSpeaker(block.id); }}
            >
              <UserCircle2 size={11} className="inline mr-1 opacity-70" />
              {block.speaker}
            </button>
          )}
        </div>

        {/* Right: editable text */}
        <div className="flex-1 flex px-4 py-4 relative">
          <textarea
            ref={textRef}
            className="w-full resize-none bg-transparent text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1"
            value={block.text}
            rows={Math.max(2, Math.ceil(block.text.length / 80))}
            onChange={e => updateField(block.id, 'text', e.target.value)}
            onClick={e => e.stopPropagation()}
            onFocus={() => setSelectedId(block.id)}
            placeholder="Type transcript text…"
            spellCheck
          />

          {/* Per-block actions (show on hover/select) */}
          <div className={`absolute right-2 top-2 flex gap-1 transition-opacity
            ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              title="Add block below"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-background-3 text-foreground-4 hover:text-foreground transition-colors"
              onClick={e => { e.stopPropagation(); addAfter(block.id); }}
            >
              <Plus size={13} />
            </button>
            <button
              title="Delete block"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-danger-bg text-foreground-4 hover:text-danger transition-colors"
              onClick={e => { e.stopPropagation(); deleteBlock(block.id); }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" onClick={() => setExportOpen(false)}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background-2/40 shrink-0 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => addAfter(selectedId)}>
          <Plus size={13} /> Add Block
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={copyAll}>
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy All'}
        </Button>

        <div className="ml-auto relative" onClick={e => e.stopPropagation()}>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setExportOpen(v => !v)}>
            <Download size={13} /> Export <ChevronsUpDown size={11} />
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-20 min-w-[140px] overflow-hidden">
              {[
                { label: 'Plain Text (.txt)', fn: () => downloadText(toPlainText(blocks), `${job.jobName ?? 'transcript'}.txt`) },
                { label: 'WebVTT (.vtt)',     fn: () => downloadText(toVttTranscript(blocks), `${job.jobName ?? 'transcript'}.vtt`) },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-background-2 transition-colors"
                  onClick={() => { fn(); setExportOpen(false); }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Column labels */}
      <div className="flex border-b border-border bg-background-2/60 text-[10px] font-semibold uppercase tracking-wider text-foreground-4 shrink-0">
        <div className="w-44 px-4 py-2 border-r border-border">Timecode · Speaker</div>
        <div className="flex-1 px-4 py-2">Transcript</div>
      </div>

      {/* Blocks */}
      <div className="flex-1 overflow-y-auto">
        {blocks.map((block, i) => (
          <BlockRow key={block.id} block={block} index={i} />
        ))}
        <div className="p-4 flex justify-center">
          <button
            className="text-xs text-foreground-4 hover:text-foreground transition-colors flex items-center gap-1.5"
            onClick={() => addAfter(blocks[blocks.length - 1]?.id ?? null)}
          >
            <Plus size={12} /> Add block at end
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-background-2/40 text-[10px] text-foreground-4 shrink-0">
        <span>{blocks.length} blocks · {wordCount} words</span>
        <span>Click timestamp or speaker label to edit · Hover a block for actions</span>
      </div>
    </div>
  );
}
