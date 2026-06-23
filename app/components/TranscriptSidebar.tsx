'use client';

import { Terminal } from "lucide-react";
import type { ITranscriptLine } from "../lib/types";

interface TranscriptSidebarProps {
  transcript: ITranscriptLine[];
  feedEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function TranscriptSidebar({ transcript, feedEndRef }: TranscriptSidebarProps) {
  return (
    <section className="w-70 shrink-0 flex flex-col border border-white/4 bg-[#0c0f1d]/20 rounded-xl p-3 min-h-0">
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.24em] text-zinc-500 pb-2 border-b border-white/4 mb-2">
        <Terminal className="h-3.5 w-3.5" /> Live Transcript
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-[11px] font-mono scroll-smooth">
        {transcript.length === 0 ? (
          <div className="text-zinc-600 italic">Feed empty.</div>
        ) : (
          transcript.map((line, index) => (
            <div key={`${line.agent}-${index}`} className="border-b border-white/2 pb-2 last:border-0">
              <div className="flex items-center gap-2 text-[9px] font-semibold text-zinc-400 mb-1">
                <span className="uppercase text-cyan-300">{line.agent}</span>
                <span className="text-[8px] text-zinc-600">[{line.role || "Council"}]</span>
              </div>
              <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{line.content}</p>
            </div>
          ))
        )}
        <div ref={feedEndRef} />
      </div>
    </section>
  );
}
