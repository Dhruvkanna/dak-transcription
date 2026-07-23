import React from 'react';
import { ToolLayout } from '@/components/ToolLayout';
import { Subtitles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function SubtitlingPage() {
  return (
    <ToolLayout
      title="Subtitling"
      description="Generate perfectly timed SRT or VTT subtitle files for your video content."
      type="subtitling"
      ratePerMinute={8}
      icon={Subtitles}
      acceptFormats="MP4, MOV, MKV"
      renderResult={(job) => (
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-lg">Generated Subtitles</h3>
            <Button size="sm" className="gap-2">
              <Download size={14} /> Download SRT
            </Button>
          </div>
          <div className="bg-[#1e1e1e] rounded-lg p-6 flex-1 overflow-auto text-[#d4d4d4] border border-[#333] font-mono text-sm leading-relaxed shadow-inner">
            {`1
00:00:00,000 --> 00:00:04,500
This is a demonstration of the subtitling tool for ${job.inputFilename}.

2
00:00:04,500 --> 00:00:08,200
It generates precise timing blocks formatted as standard SRT.

3
00:00:08,200 --> 00:00:12,800
The text is perfectly synced with the original video's audio track.

4
00:00:12,800 --> 00:00:17,000
Domain selected: ${job.domain.toUpperCase()}

5
00:00:17,000 --> 00:00:22,000
You can download this file and import it directly into your video editor or player.`}
          </div>
        </div>
      )}
    />
  );
}
