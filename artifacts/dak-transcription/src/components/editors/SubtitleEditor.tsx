import React, { useState, useRef, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronsUpDown, Download, AlertTriangle, Merge, SplitSquareVertical } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SubtitleSegment {
  id: string;
  start: number; // ms
  end: number;   // ms
  text: string;
}

// ─── Time utilities ────────────────────────────────────────────────────────────

function msToSrt(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const f = ms % 1_000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(f).padStart(3,'0')}`;
}

function srtToMs(srt: string): number {
  const [time, ms = '0'] = srt.split(',');
  const [h = '0', m = '0', s = '0'] = time.split(':');
  return (parseInt(h)*3600 + parseInt(m)*60 + parseInt(s))*1000 + parseInt(ms.padEnd(3,'0'));
}

function durSec(seg: SubtitleSegment): number {
  return Math.max(0, (seg.end - seg.start) / 1000);
}

function readingSpeed(seg: SubtitleSegment): number {
  const dur = durSec(seg);
  return dur > 0 ? seg.text.replace(/\n/g, '').length / dur : 0;
}

function maxLineLen(text: string): number {
  return Math.max(...text.split('\n').map(l => l.length));
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface SubtitleEditorProps {
  job: any;
  initialSegments?: SubtitleSegment[];
}

// ─── Seeded mock data ──────────────────────────────────────────────────────────

const MOCK_LINES = [
  "This is an automatically generated subtitle for your video.",
  "The AI model has transcribed the spoken audio with high accuracy.",
  "Each segment is timed precisely to match the speaker's words.",
  "You can edit any timecode or text directly within this editor.",
  "Click a cell to modify it, then press Tab to move to the next field.",
  "Use the toolbar above to add or remove segments as needed.",
  "The reading speed indicator shows characters per second.",
  "Broadcast standard recommends no more than seventeen characters per second.",
  "You can merge adjacent segments or split a selected segment.",
  "Export as SRT, VTT, or plain TXT when you are satisfied.",
];

function generateMockSegments(jobId: number): SubtitleSegment[] {
  let cursor = 500;
  return MOCK_LINES.map((text, i) => {
    const dur = 2500 + (((jobId * 7 + i * 13) % 5) * 500);
    const seg: SubtitleSegment = { id: `${jobId}-${i}`, start: cursor, end: cursor + dur, text };
    cursor += dur + 200;
    return seg;
  });
}

// ─── Export helpers ────────────────────────────────────────────────────────────

function downloadText(content: string, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function toSrt(segs: SubtitleSegment[]): string {
  return segs.map((s, i) =>
    `${i + 1}\r\n${msToSrt(s.start)} --> ${msToSrt(s.end)}\r\n${s.text}\r\n`
  ).join('\r\n');
}

function toVtt(segs: SubtitleSegment[]): string {
  const body = segs.map((s, i) =>
    `${i + 1}\n${msToSrt(s.start).replace(',', '.')} --> ${msToSrt(s.end).replace(',', '.')}\n${s.text}\n`
  ).join('\n');
  return `WEBVTT\n\n${body}`;
}

function toTxt(segs: SubtitleSegment[]): string {
  return segs.map(s => s.text).join('\n');
}

function toWord(segs: SubtitleSegment[], title: string): string {
  const rows = segs.map((s, i) =>
    `<tr><td style="padding:4px 8px;border:1px solid #ccc;font-family:monospace;font-size:12px;white-space:nowrap">${i + 1}</td>` +
    `<td style="padding:4px 8px;border:1px solid #ccc;font-family:monospace;font-size:12px;white-space:nowrap">${msToSrt(s.start)}</td>` +
    `<td style="padding:4px 8px;border:1px solid #ccc;font-family:monospace;font-size:12px;white-space:nowrap">${msToSrt(s.end)}</td>` +
    `<td style="padding:4px 8px;border:1px solid #ccc;font-size:13px">${s.text.replace(/\n/g, '<br/>')}</td></tr>`
  ).join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:Calibri,sans-serif">
<h2 style="margin-bottom:12px">${title}</h2>
<table style="border-collapse:collapse;width:100%">
<thead><tr style="background:#f0f0f0">
<th style="padding:4px 8px;border:1px solid #ccc;text-align:left">#</th>
<th style="padding:4px 8px;border:1px solid #ccc;text-align:left">In</th>
<th style="padding:4px 8px;border:1px solid #ccc;text-align:left">Out</th>
<th style="padding:4px 8px;border:1px solid #ccc;text-align:left">Text</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;
}

// ─── Timecode input ────────────────────────────────────────────────────────────

function TimecodeInput({
  value,
  onChange,
  onBlur,
}: {
  value: number;
  onChange: (ms: number) => void;
  onBlur: () => void;
}) {
  const [raw, setRaw] = useState(msToSrt(value));

  const handleBlur = () => {
    const parsed = srtToMs(raw);
    if (!isNaN(parsed)) onChange(parsed);
    else setRaw(msToSrt(value)); // revert
    onBlur();
  };

  return (
    <input
      autoFocus
      className="w-[112px] font-mono text-xs bg-background border border-primary rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleBlur(); } }}
      spellCheck={false}
    />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SubtitleEditor({ job, initialSegments }: SubtitleEditorProps) {
  const uid = useId();
  const [segments, setSegments] = useState<SubtitleSegment[]>(
    () => initialSegments && initialSegments.length > 0 ? initialSegments : generateMockSegments(job.id)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState<{ id: string; field: 'start' | 'end' } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const selected = segments.find(s => s.id === selectedId);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const addAfter = useCallback((id: string | null) => {
    setSegments(prev => {
      const idx = id ? prev.findIndex(s => s.id === id) : prev.length - 1;
      const ref = prev[idx];
      const newStart = ref ? ref.end + 200 : 0;
      const newSeg: SubtitleSegment = {
        id: `new-${Date.now()}`,
        start: newStart,
        end: newStart + 3000,
        text: 'New subtitle text',
      };
      const next = [...prev];
      next.splice(idx + 1, 0, newSeg);
      return next;
    });
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setSegments(prev => {
      const idx = prev.findIndex(s => s.id === selectedId);
      const next = prev.filter(s => s.id !== selectedId);
      setSelectedId(next[Math.max(0, idx - 1)]?.id ?? null);
      return next;
    });
  }, [selectedId]);

  const mergeWithNext = useCallback(() => {
    if (!selectedId) return;
    setSegments(prev => {
      const idx = prev.findIndex(s => s.id === selectedId);
      if (idx >= prev.length - 1) return prev;
      const cur = prev[idx], nxt = prev[idx + 1];
      const merged: SubtitleSegment = { ...cur, end: nxt.end, text: `${cur.text}\n${nxt.text}` };
      return [...prev.slice(0, idx), merged, ...prev.slice(idx + 2)];
    });
  }, [selectedId]);

  const splitSegment = useCallback(() => {
    if (!selectedId) return;
    setSegments(prev => {
      const idx = prev.findIndex(s => s.id === selectedId);
      const seg = prev[idx];
      const mid = Math.round((seg.start + seg.end) / 2);
      const words = seg.text.split(' ');
      const half = Math.ceil(words.length / 2);
      const a: SubtitleSegment = { ...seg, end: mid, text: words.slice(0, half).join(' ') };
      const b: SubtitleSegment = { id: `split-${Date.now()}`, start: mid + 100, end: seg.end, text: words.slice(half).join(' ') };
      return [...prev.slice(0, idx), a, b, ...prev.slice(idx + 1)];
    });
  }, [selectedId]);

  const updateTime = (id: string, field: 'start' | 'end', ms: number) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: ms } : s));
  };

  const updateText = (id: string, text: string) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  // ── Segment row ────────────────────────────────────────────────────────────

  const SegmentRow = ({ seg, index }: { seg: SubtitleSegment; index: number }) => {
    const dur = durSec(seg);
    const speed = readingSpeed(seg);
    const maxLen = maxLineLen(seg.text);
    const lineCount = seg.text.split('\n').length;
    const isSelected = seg.id === selectedId;

    const speedColor =
      speed < 15  ? 'text-success' :
      speed < 20  ? 'text-warning' :
                    'text-danger';

    const charColor =
      maxLen <= 42 ? 'text-foreground-4' :
      maxLen <= 52 ? 'text-warning'       :
                     'text-danger';

    return (
      <div
        className={`grid items-start gap-0 border-b border-border transition-colors cursor-pointer
          ${isSelected ? 'bg-primary/5' : 'hover:bg-background-2/60'}`}
        style={{ gridTemplateColumns: '36px 116px 116px 52px 1fr 80px' }}
        onClick={() => setSelectedId(seg.id)}
      >
        {/* Index */}
        <div className="flex items-center justify-center h-full py-3 text-xs font-mono text-foreground-4 border-r border-border select-none">
          {index + 1}
        </div>

        {/* Start */}
        <div
          className="flex items-center px-2 py-3 border-r border-border"
          onDoubleClick={e => { e.stopPropagation(); setEditingTime({ id: seg.id, field: 'start' }); }}
        >
          {editingTime?.id === seg.id && editingTime.field === 'start' ? (
            <TimecodeInput
              value={seg.start}
              onChange={ms => updateTime(seg.id, 'start', ms)}
              onBlur={() => setEditingTime(null)}
            />
          ) : (
            <span className="font-mono text-xs text-foreground-2 select-none" title="Double-click to edit">
              {msToSrt(seg.start)}
            </span>
          )}
        </div>

        {/* End */}
        <div
          className="flex items-center px-2 py-3 border-r border-border"
          onDoubleClick={e => { e.stopPropagation(); setEditingTime({ id: seg.id, field: 'end' }); }}
        >
          {editingTime?.id === seg.id && editingTime.field === 'end' ? (
            <TimecodeInput
              value={seg.end}
              onChange={ms => updateTime(seg.id, 'end', ms)}
              onBlur={() => setEditingTime(null)}
            />
          ) : (
            <span className="font-mono text-xs text-foreground-2 select-none" title="Double-click to edit">
              {msToSrt(seg.end)}
            </span>
          )}
        </div>

        {/* Duration */}
        <div className="flex items-center justify-center px-2 py-3 border-r border-border">
          <span className="font-mono text-xs text-foreground-4">{dur.toFixed(1)}s</span>
        </div>

        {/* Text */}
        <div className="px-2 py-2 border-r border-border">
          <textarea
            ref={el => { textareaRefs.current[seg.id] = el; }}
            rows={Math.max(lineCount, 1)}
            className="w-full resize-none bg-transparent text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 py-0.5"
            value={seg.text}
            onChange={e => updateText(seg.id, e.target.value)}
            onClick={e => e.stopPropagation()}
            onFocus={() => setSelectedId(seg.id)}
            spellCheck
          />
        </div>

        {/* Stats */}
        <div className="flex flex-col items-end justify-start gap-1 px-2 py-3 text-xs select-none">
          <span className={charColor} title="Max characters per line">
            {maxLen} ch {maxLen > 42 && <AlertTriangle size={10} className="inline" />}
          </span>
          <span className={speedColor} title="Reading speed (chars/sec)">
            {speed.toFixed(1)} c/s
          </span>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background-2/40 shrink-0 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => addAfter(selectedId)}>
          <Plus size={13} /> Add Segment
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={deleteSelected} disabled={!selectedId}>
          <Trash2 size={13} /> Delete
        </Button>
        <div className="w-px h-5 bg-border mx-0.5" />
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={mergeWithNext} disabled={!selectedId}>
          <Merge size={13} /> Merge ↓
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={splitSegment} disabled={!selectedId}>
          <SplitSquareVertical size={13} /> Split
        </Button>

        <div className="ml-auto relative">
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setExportOpen(v => !v)}>
            <Download size={13} /> Export <ChevronsUpDown size={11} />
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-20 min-w-[120px] overflow-hidden">
              {[
                { label: 'SRT', fn: () => downloadText(toSrt(segments), `${job.jobName ?? 'subtitles'}.srt`) },
                { label: 'VTT', fn: () => downloadText(toVtt(segments), `${job.jobName ?? 'subtitles'}.vtt`) },
                { label: 'TXT', fn: () => downloadText(toTxt(segments), `${job.jobName ?? 'subtitles'}.txt`) },
                { label: 'Word (.doc)', fn: () => downloadText(toWord(segments, job.jobName ?? 'subtitles'), `${job.jobName ?? 'subtitles'}.doc`) },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-background-2 transition-colors"
                  onClick={() => { fn(); setExportOpen(false); }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div
        className="grid text-[10px] font-semibold uppercase tracking-wider text-foreground-4 border-b border-border bg-background-2/60 shrink-0"
        style={{ gridTemplateColumns: '36px 116px 116px 52px 1fr 80px' }}
      >
        <div className="px-2 py-2 text-center border-r border-border">#</div>
        <div className="px-2 py-2 border-r border-border">In</div>
        <div className="px-2 py-2 border-r border-border">Out</div>
        <div className="px-2 py-2 text-center border-r border-border">Dur</div>
        <div className="px-2 py-2 border-r border-border">Text</div>
        <div className="px-2 py-2 text-right">Stats</div>
      </div>

      {/* Segments */}
      <div className="flex-1 overflow-y-auto" onClick={() => setExportOpen(false)}>
        {segments.map((seg, i) => (
          <SegmentRow key={seg.id} seg={seg} index={i} />
        ))}
        <div className="p-3 flex justify-center">
          <button
            className="text-xs text-foreground-4 hover:text-foreground transition-colors flex items-center gap-1.5"
            onClick={() => addAfter(segments[segments.length - 1]?.id ?? null)}
          >
            <Plus size={12} /> Add segment at end
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-background-2/40 text-[10px] text-foreground-4 shrink-0">
        <span>{segments.length} segments · {(segments.reduce((a, s) => a + durSec(s), 0) / 60).toFixed(1)} min total</span>
        <span>Double-click a timecode to edit · Tab to advance fields</span>
      </div>
    </div>
  );
}
