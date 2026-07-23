import React from 'react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileText } from 'lucide-react';
import { TranscriptEditor } from '@/components/editors/TranscriptEditor';

export default function Transcription() {
  return (
    <ToolLayout
      title="Transcription"
      description="Convert your audio and video files into highly accurate text using our specialized AI models."
      type="transcription"
      ratePerMinute={5}
      icon={FileText}
      renderResult={(job) => <TranscriptEditor job={job} />}
    />
  );
}
