import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ToolLayout } from '@/components/ToolLayout';
import { FileText } from 'lucide-react';
import { TranscriptEditor, type TranscriptBlock } from '@/components/editors/TranscriptEditor';

function TranscriptionResult({ job }: { job: any }) {
  const { data: blocks } = useQuery<TranscriptBlock[]>({
    queryKey: ['segments', job.id],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${job.id}/segments`);
      if (!res.ok) return [];
      const data = await res.json() as { type: string; blocks?: TranscriptBlock[] };
      return data.blocks ?? [];
    },
    enabled: job.status === 'completed',
    staleTime: Infinity,
  });

  return <TranscriptEditor job={job} initialBlocks={blocks} />;
}

export default function Transcription() {
  return (
    <ToolLayout
      title="Transcription"
      description="Convert your audio and video files into highly accurate text using our specialized AI models."
      type="transcription"
      ratePerMinute={5}
      icon={FileText}
      renderResult={(job) => <TranscriptionResult job={job} />}
    />
  );
}
