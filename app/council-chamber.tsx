'use client';

import { useMemo, useRef, useState, useEffect } from "react";
import type { ITranscriptLine, AgentName, Status } from "./lib/types";
import { council } from "./lib/council";
import { normalizeCouncilText, readSSE } from "./lib/sse";
import Header from "./components/Header";
import SeatsSidebar from "./components/SeatsSidebar";
import CenterStage from "./components/CenterStage";
import TranscriptSidebar from "./components/TranscriptSidebar";

export default function CouncilChamber() {
  const [topic, setTopic] = useState("Should AI agents manage customer support at scale?");
  const [followupText, setFollowupText] = useState("");
  const [activeAgent, setActiveAgent] = useState<AgentName | null>(null);
  const [statuses, setStatuses] = useState<Record<AgentName, Status>>(() =>
    Object.fromEntries(council.map((agent) => [agent.name, "Idle"])) as Record<AgentName, Status>,
  );
  const [transcript, setTranscript] = useState<ITranscriptLine[]>([]);
  const [verdict, setVerdict] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const activeMeta = useMemo(
    () => council.find((agent) => agent.name === activeAgent) ?? null,
    [activeAgent],
  );

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const startDebate = async (followupQuestion?: string) => {
    const cleanedTopic = topic.trim();
    if (!cleanedTopic || running) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setError("");

    const isFollowup = !!followupQuestion;
    if (!isFollowup) {
      setVerdict("");
      setTranscript([]);
    }

    setActiveAgent(null);
    setStatuses(Object.fromEntries(council.map((agent) => [agent.name, "Idle"])) as Record<AgentName, Status>);

    try {
      const payload: Record<string, unknown> = {
        topic: cleanedTopic,
      };

      if (isFollowup) {
        payload.question = followupQuestion.trim();
        payload.transcript = transcript.map((line) => ({
          agent: line.agent,
          content: line.content,
        }));
      }

      const response = await fetch(`/api/debate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error(`Backend error ${response.status}`);

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
          const content = normalizeCouncilText(String(data.content ?? ""));
          setActiveAgent(agent);
          setStatuses((prev) => ({ ...prev, [agent]: "Speaking" }));

          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.agent === agent) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                content,
              };
              return updated;
            }

            const updated = [...prev, { agent, content, role: String(data.role ?? "") }];
            return updated;
          });

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
          const finalVerdict = normalizeCouncilText(String(data.verdict ?? verdict));
          if (finalVerdict) setVerdict(finalVerdict);
          setStatuses(Object.fromEntries(council.map((agent) => [agent.name, "Idle"])) as Record<AgentName, Status>);
          setActiveAgent(null);
        }
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Debate failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-screen max-h-screen w-screen flex-col overflow-hidden bg-[#03050c] p-3 text-zinc-300 md:p-4 font-sans">
      <Header
        topic={topic}
        setTopic={setTopic}
        running={running}
        onStart={() => {
          void startDebate();
        }}
      />

      <div className="flex flex-1 overflow-hidden min-h-0 gap-3 pt-3">
        <SeatsSidebar activeAgent={activeAgent} statuses={statuses} />

        <CenterStage
          verdict={verdict}
          activeAgent={activeMeta?.name ?? null}
          running={running}
          followupText={followupText}
          setFollowupText={setFollowupText}
          onFollowup={(q) => {
            void startDebate(q);
          }}
        />

        <TranscriptSidebar transcript={transcript} feedEndRef={feedEndRef} />
      </div>

      {error ? (
        <div className="absolute bottom-4 right-4 z-50 rounded-lg border border-red-500/25 bg-red-950/45 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
