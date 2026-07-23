import React from 'react';
import { ToolLayout } from '@/components/ToolLayout';
import { MonitorPlay, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Captioning() {
  return (
    <ToolLayout
      title="Captioning"
      description="Hard-code burned-in captions directly into your video for social media."
      type="captioning"
      ratePerMinute={12}
      icon={MonitorPlay}
      acceptFormats="MP4, MOV"
      renderResult={(job) => (
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-lg">Rendered Video</h3>
            <Button size="sm" className="gap-2">
              <Download size={14} /> Download MP4
            </Button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-lg aspect-video bg-black rounded-xl overflow-hidden relative shadow-lg flex items-center justify-center border border-border group">
              <div className="absolute inset-0 bg-background-4/10"></div>
              
              <MonitorPlay size={48} className="text-white/20" />
              
              {/* Fake player controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="w-full h-1 bg-white/30 rounded-full mb-3 overflow-hidden">
                  <div className="w-1/3 h-full bg-primary-foreground"></div>
                </div>
                <div className="flex items-center justify-between text-white/80 text-xs font-mono">
                  <span>00:00</span>
                  <span>{job.inputDurationMinutes}:00</span>
                </div>
              </div>

              {/* Fake caption */}
              <div className="absolute bottom-16 left-0 right-0 flex justify-center px-8">
                <span className="bg-black/70 text-white font-bold px-4 py-2 rounded text-center text-lg shadow-md leading-tight">
                  YOUR BURNED-IN CAPTIONS<br/>APPEAR HERE
                </span>
              </div>
            </div>
            
            <p className="mt-6 text-sm text-foreground-4 text-center max-w-sm">
              Your video has been rendered with embedded captions optimized for readability on mobile and desktop.
            </p>
          </div>
        </div>
      )}
    />
  );
}
