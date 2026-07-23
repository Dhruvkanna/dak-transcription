import React from 'react';
import { ToolLayout } from '@/components/ToolLayout';
import { Mic2, Download, Play, Pause, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dubbing() {
  return (
    <ToolLayout
      title="AI Dubbing"
      description="Clone voices and generate natural-sounding localized dubs in multiple languages."
      type="dubbing"
      ratePerMinute={50}
      icon={Mic2}
      renderResult={(job) => (
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-medium text-lg">Dubbed Media</h3>
            <Button size="sm" className="gap-2">
              <Download size={14} /> Download Output
            </Button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
            
            <div className="w-full bg-background-2 rounded-2xl p-6 border border-border shadow-sm mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                  <Mic2 size={24} />
                </div>
                <div>
                  <h4 className="font-medium text-foreground truncate max-w-[200px]" title={job.inputFilename}>
                    {job.inputFilename}
                  </h4>
                  <p className="text-sm text-foreground-3 uppercase tracking-wider font-semibold mt-1">
                    Dubbed → {job.targetLanguage || 'Target'}
                  </p>
                </div>
              </div>

              <div className="bg-background rounded-xl p-4 border border-border shadow-inner">
                {/* Audio visualizer fake */}
                <div className="flex items-center justify-center gap-1 h-12 mb-4 px-2">
                  {[...Array(30)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-accent/40 rounded-full"
                      style={{ 
                        height: `${Math.max(20, Math.random() * 100)}%`,
                        opacity: i % 2 === 0 ? 0.8 : 0.4
                      }}
                    ></div>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <button className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform shrink-0">
                    <Play size={16} className="ml-1" />
                  </button>
                  <div className="w-full h-2 bg-background-3 rounded-full overflow-hidden">
                    <div className="w-0 h-full bg-primary"></div>
                  </div>
                  <Volume2 size={16} className="text-foreground-4 shrink-0" />
                </div>
              </div>
            </div>

            <div className="text-center bg-info-bg/50 p-4 rounded-lg border border-info/10 text-sm text-foreground-2">
              <p><strong>Voice Match:</strong> High fidelity preserved</p>
              <p><strong>Translation:</strong> Contextually adapted for natural speech</p>
            </div>
            
          </div>
        </div>
      )}
    />
  );
}
