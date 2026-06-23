'use client';

import { Brain, Loader2, Send } from "lucide-react";

interface HeaderProps {
  topic: string;
  setTopic: (v: string) => void;
  running: boolean;
  onStart: () => void;
}

export default function Header({ topic, setTopic, running, onStart }: HeaderProps) {
  return (
    <header className="flex h-15 shrink-0 items-center justify-between border-b border-white/4 pb-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xs font-semibold tracking-[0.24em] text-zinc-100 uppercase leading-none">Council Chamber</h1>
          <p className="mt-1 text-[8px] tracking-widest text-zinc-500 uppercase leading-none">{running ? "Running" : "Idle"}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
        className="flex flex-1 max-w-xl mx-6 items-center gap-2 rounded-xl border border-white/5 bg-white/2 px-3 py-1.5"
      >
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Type debate topic"
          className="flex-1 bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={running}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-200 border border-cyan-400/20 hover:bg-cyan-400/15 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Convene
        </button>
      </form>
    </header>
  );
}
