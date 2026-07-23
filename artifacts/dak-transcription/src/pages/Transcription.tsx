import React from 'react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileText } from 'lucide-react';

export default function Transcription() {
  return (
    <ToolLayout
      title="Transcription"
      description="Convert your audio and video files into highly accurate text using our specialized AI models."
      type="transcription"
      ratePerMinute={5}
      icon={FileText}
      renderResult={(job) => (
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-lg">Transcript</h3>
            <div className="flex gap-2">
              <button className="text-sm text-info hover:underline">Copy to clipboard</button>
              <button className="text-sm text-info hover:underline">Download .txt</button>
            </div>
          </div>
          <div className="bg-background-2/50 rounded-lg p-6 flex-1 overflow-auto text-foreground-2 leading-relaxed whitespace-pre-wrap border border-border shadow-inner font-sans text-[15px]">
            {job.outputUrl ? `Output available at: ${job.outputUrl}` : (
              <p>
                [00:00:00] Speaker 1: This is a generated transcript for the file {job.inputFilename}.
                {"\n\n"}
                [00:00:05] Speaker 2: Since we are in a simulated environment, we don't have the actual content, but this is how the resulting text would appear.
                {"\n\n"}
                [00:00:12] Speaker 1: The model processes the audio with high precision, correcting punctuation and removing filler words.
                {"\n\n"}
                [00:00:20] Speaker 2: This panel would support editing and reviewing the transcript with timestamps before final export.
              </p>
            )}
          </div>
        </div>
      )}
    />
  );
}
