'use client';

import { Crown, Mic, Send, Sparkles } from "lucide-react";
import { council } from "../lib/council";
import type { AgentName } from "../lib/types";

interface CenterStageProps {
  verdict: string;
  activeAgent: AgentName | null;
  running: boolean;
  followupText: string;
  setFollowupText: (v: string) => void;
  onFollowup: (v: string) => void;
}

export default function CenterStage({
  verdict,
  activeAgent,
  running,
  followupText,
  setFollowupText,
  onFollowup,
}: CenterStageProps) {
  const activeMeta = council.find((agent) => agent.name === activeAgent) ?? null;

  return (
    <main className="flex-1 flex flex-col min-h-0 rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 relative overflow-hidden">
      {verdict ? (
        <div className="flex flex-col h-full justify-between">
          <div className="flex flex-col min-h-0 overflow-y-auto">
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.24em] text-cyan-200">
              <Crown className="h-4.5 w-4.5 text-cyan-300" /> Verdict Issued
            </div>
            <p className="mt-4 whitespace-pre-wrap text-xs leading-6 text-zinc-100 font-light overflow-y-auto pr-2">
              {verdict}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = followupText.trim();
              if (!q || running) return;
              onFollowup(q);
              setFollowupText("");
            }}
            className="mt-4 border-t border-white/[0.04] pt-3 shrink-0"
          >
            <div className="text-[8px] uppercase tracking-[0.22em] text-zinc-500 mb-2">Continue Conversation</div>
            <div className="flex gap-2">
              <input
                value={followupText}
                onChange={(e) => setFollowupText(e.target.value)}
                placeholder="Ask follow-up question..."
                className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-100 outline-none focus:border-cyan-400/30"
              />
              <button
                type="submit"
                disabled={running}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 border border-cyan-400/20 hover:bg-cyan-400/15 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Submit
              </button>
            </div>
          </form>
        </div>
      ) : activeMeta ? (
        <div className="flex flex-col h-full justify-center items-center text-center p-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-xl animate-pulse" />
            <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${activeMeta.tone} text-[#03050c] shadow-lg animate-bounce`}>
              <Mic className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-sm font-semibold tracking-widest text-white uppercase">{activeMeta.name}</h2>
          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mt-1">{activeMeta.role}</p>
          <div className="mt-6 flex max-w-lg items-center justify-center">
            <p className="text-xs leading-6 text-zinc-400 animate-pulse italic">
              Analyzing and speaking...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full justify-center items-center text-center">
          <Sparkles className="h-10 w-10 text-zinc-600 animate-pulse" />
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Idle State</h3>
          <p className="mt-2 max-w-xs text-[10px] text-zinc-500 uppercase tracking-wider">Configure debate topic and click Convene to start chamber.</p>
        </div>
      )}
    </main>
  );
}
