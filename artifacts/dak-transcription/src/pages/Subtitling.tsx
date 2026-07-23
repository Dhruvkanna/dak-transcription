import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ToolLayout } from '@/components/ToolLayout';
import { Subtitles } from 'lucide-react';
import { SubtitleEditor, type SubtitleSegment } from '@/components/editors/SubtitleEditor';

function SubtitlingResult({ job }: { job: any }) {
  const { data: segments } = useQuery<SubtitleSegment[]>({
    queryKey: ['segments', job.id],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${job.id}/segments`);
      if (!res.ok) return [];
      const data = await res.json() as { type: string; segments?: SubtitleSegment[] };
      return data.segments ?? [];
    },
    enabled: job.status === 'completed',
    staleTime: Infinity,
  });

  return <SubtitleEditor job={job} initialSegments={segments} />;
}

export default function SubtitlingPage() {
  return (
    <ToolLayout
      title="Subtitling"
      description="Generate perfectly timed SRT or VTT subtitle files for your video content."
      type="subtitling"
      ratePerMinute={8}
      icon={Subtitles}
      renderResult={(job) => <SubtitlingResult job={job} />}
    />
  );
}
