'use client';

import { useMemo, useRef, useState } from "react";
import {
  Brain,
  Crown,
  Cpu,
  Gavel,
  Landmark,
  Loader2,
  Mic,
  Send,
  ShieldAlert,
  Sparkles,
  Smile,
  Scale,
  MessagesSquare,
  Compass,
  CircleDot,
} from "lucide-react";

type AgentName =
  | "Moderator"
  | "Optimist"
  | "Skeptic"
  | "Ethicist"
  | "Financier"
  | "Tech Expert"
  | "Strategist"
  | "Judge";

type Status = "Idle" | "Thinking" | "Speaking";

type CouncilAgent = {
  name: AgentName;
  role: string;
  description: string;
  icon: typeof Crown;
  accent: string;
};

type TranscriptLine = {
  agent: AgentName;
  content: string;
  role?: string;
};

const council: CouncilAgent[] = [
  {
    name: "Moderator",
    role: "Council Moderator",
    description: "Keeps debate focused, balanced, and moving.",
    icon: Gavel,
    accent: "from-sky-400 to-cyan-500",
  },
  {
    name: "Optimist",
    role: "Opportunity Optimist",
    description: "Finds upside, momentum, and win paths.",
    icon: Smile,
    accent: "from-emerald-400 to-lime-500",
  },
  {
    name: "Skeptic",
    role: "Risk Skeptic",
    description: "Exposes assumptions, gaps, and failure modes.",
    icon: ShieldAlert,
    accent: "from-rose-400 to-red-500",
  },
  {
    name: "Ethicist",
    role: "Ethics Advocate",
    description: "Checks fairness, harm, and trust impact.",
    icon: Scale,
    accent: "from-violet-400 to-fuchsia-500",
  },
  {
    name: "Financier",
    role: "Financial Analyst",
    description: "Evaluates cost, return, and sustainability.",
    icon: Landmark,
    accent: "from-amber-400 to-orange-500",
  },
  {
    name: "Tech Expert",
    role: "Technical Expert",
    description: "Judges feasibility, architecture, and debt.",
    icon: Cpu,
    accent: "from-indigo-400 to-blue-500",
  },
  {
    name: "Strategist",
    role: "Strategic Planner",
    description: "Weighs timing, leverage, and positioning.",
    icon: Compass,
    accent: "from-teal-400 to-emerald-500",
  },
  {
    name: "Judge",
    role: "Final Judge",
    description: "Delivers verdict and picks winning case.",
    icon: Crown,
    accent: "from-yellow-300 to-amber-500",
  },
];

const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async function readSSE(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary === -1) break;

      const packet = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = "message";
      const dataLines: string[] = [];

      for (const line of packet.split("\n")) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length) {
        const raw = dataLines.join("\n");
        try {
          onEvent(event, JSON.parse(raw));
        } catch {
          onEvent(event, raw);
        }
      }
    }
  }
}

export default function Home() {
  const [topic, setTopic] = useState("Should AI agents manage customer support at scale?");
  const [activeAgent, setActiveAgent] = useState<AgentName | null>(null);
  const [statuses, setStatuses] = useState<Record<AgentName, Status>>(() =>
    Object.fromEntries(council.map((agent) => [agent.name, "Idle"])) as Record<AgentName, Status>,
  );
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [verdict, setVerdict] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const activeMeta = useMemo(
    () => council.find((agent) => agent.name === activeAgent) ?? null,
    [activeAgent],
  );

  const startDebate = async () => {
    const cleaned = topic.trim();
    if (!cleaned || running) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setError("");
    setVerdict("");
    setTranscript([]);
    setActiveAgent(null);
    setStatuses(Object.fromEntries(council.map((agent) => [agent.name, "Idle"])) as Record<AgentName, Status>);

    try {
      const response = await fetch(`${apiBase}/api/debate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: cleaned }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Backend error ${response.status}`);
      }

      await readSSE(response.body, (event, rawData) => {
        if (event === "session_started") return;

        const data = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};

        if (event === "agent_start") {
          const agent = data.agent as AgentName;
          setActiveAgent(agent);
          setStatuses((prev) => ({ ...prev, [agent]: "Thinking" }));
          return;
        }

        if (event === "agent_message") {
          const agent = data.agent as AgentName;
          const content = String(data.content ?? "").trim();
          setStatuses((prev) => ({ ...prev, [agent]: "Speaking" }));
          setActiveAgent(agent);
          setTranscript((prev) => [...prev, { agent, content, role: String(data.role ?? "") }]);
          if (agent === "Judge") setVerdict(content);
          return;
        }

        if (event === "agent_done") {
          const agent = data.agent as AgentName;
          setStatuses((prev) => ({ ...prev, [agent]: "Idle" }));
          setActiveAgent((current) => (current === agent ? null : current));
          return;
        }

        if (event === "completed") {
          const finalVerdict = String(data.verdict ?? verdict).trim();
          if (finalVerdict) setVerdict(finalVerdict);
          setStatuses(Object.fromEntries(council.map((agent) => [agent.name, "Idle"])) as Record<AgentName, Status>);
          setActiveAgent(null);
        }
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Debate failed";
      setError(message);
    } finally {
      setRunning(false);
    }
  };

  const statusColor = (status: Status) =>
    status === "Speaking"
      ? "bg-emerald-400 shadow-[0_0_24px_rgba(74,222,128,0.65)]"
      : status === "Thinking"
        ? "bg-amber-400 animate-pulse"
        : "bg-slate-500";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.20),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_38%,_#111827_100%)] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 lg:py-10">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" /> AI Agent Council
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                  8 agents debate, Judge decides.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Enter topic, convene council, watch live transcript, get verdict from final Judge.
                </p>
              </div>
            </div>

            <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:flex-row">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Debate Topic
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Type debate topic"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-white/8"
                />
              </div>
              <button
                onClick={startDebate}
                disabled={running}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Convene Council
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="relative rounded-3xl border border-white/10 bg-slate-950/40 p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Council Chamber</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Live seating</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {running ? "Debate in progress" : "Council idle"}
                </div>
              </div>

              <div className="relative flex min-h-[560px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(148,163,184,0.10),_transparent_50%)] p-4">
                <div className="absolute left-1/2 top-1/2 h-52 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/15 bg-gradient-to-b from-cyan-400/10 to-indigo-500/5 blur-2xl" />
                <div className="relative grid w-full max-w-5xl grid-cols-2 gap-3 md:grid-cols-4">
                  {council.map((agent) => {
                    const Icon = agent.icon;
                    const status = statuses[agent.name];
                    const isActive = activeAgent === agent.name;
                    return (
                      <div
                        key={agent.name}
                        className={`relative rounded-3xl border bg-slate-950/70 p-4 shadow-xl transition ${
                          isActive
                            ? "border-emerald-400/70 ring-2 ring-emerald-400/30 shadow-emerald-500/20"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${agent.accent} text-slate-950 shadow-lg`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className={`h-3 w-3 rounded-full ${statusColor(status)}`} />
                        </div>
                        <div className="mt-4 space-y-1">
                          <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{agent.role}</p>
                          <p className="text-sm leading-6 text-slate-300">{agent.description}</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                          <span>{status}</span>
                          {isActive ? <span className="text-emerald-300">Live</span> : <span>Standing by</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 shadow-xl">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                  <Mic className="h-4 w-4 text-cyan-300" /> Live Transcript
                </div>
                <div className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
                  {transcript.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                      Transcript waits for first speaker.
                    </div>
                  ) : (
                    transcript.map((line, index) => (
                      <div key={`${line.agent}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">{line.agent}</span>
                          <span className="text-xs text-slate-500">{line.role ?? "Council voice"}</span>
                        </div>
                        <p className="text-sm leading-6 text-slate-300">{line.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/10 via-amber-400/10 to-orange-500/10 p-5 shadow-xl shadow-amber-950/20">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-amber-200/80">
                  <Crown className="h-4 w-4" /> Final Verdict
                </div>
                <div className="mt-4 min-h-36 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-200">
                  {verdict ? verdict : "Judge verdict appears here after council finish."}
                </div>
              </div>
            </div>
          </div>

          {activeMeta ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              <span className="font-semibold">{activeMeta.name}</span> speaking now — {activeMeta.description}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Stat label="Council seats" value="8" icon={MessagesSquare} />
          <Stat label="Live status" value={running ? "Debating" : "Idle"} icon={CircleDot} />
          <Stat label="Backend" value="FastAPI + CrewAI" icon={Brain} />
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Brain;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-200">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
