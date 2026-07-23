import React from 'react';
import { ToolLayout } from '@/components/ToolLayout';
import { Subtitles } from 'lucide-react';
import { SubtitleEditor } from '@/components/editors/SubtitleEditor';

export default function SubtitlingPage() {
  return (
    <ToolLayout
      title="Subtitling"
      description="Generate perfectly timed SRT or VTT subtitle files for your video content."
      type="subtitling"
      ratePerMinute={8}
      icon={Subtitles}
      renderResult={(job) => <SubtitleEditor job={job} />}
    />
  );
}
