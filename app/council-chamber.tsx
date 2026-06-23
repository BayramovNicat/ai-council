'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import type { AgentName, ITranscriptLine, Status } from "./lib/types";
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providerUrl, setProviderUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");

  const [tempUrl, setTempUrl] = useState("");
  const [tempKey, setTempKey] = useState("");
  const [tempModel, setTempModel] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const activeMeta = useMemo(
    () => council.find((agent) => agent.name === activeAgent) ?? null,
    [activeAgent],
  );

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const savedUrl = localStorage.getItem("council_provider_url") || "";
      const savedModel = localStorage.getItem("council_model_name") || "";
      const savedKey = localStorage.getItem("council_api_key") || "";

      setProviderUrl(savedUrl);
      setModelName(savedModel);
      setApiKey(savedKey);

      if (!savedUrl || !savedKey || !savedModel) {
        setTempUrl(savedUrl);
        setTempModel(savedModel);
        setTempKey(savedKey);
        setSettingsOpen(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const openSettings = () => {
    setTempUrl(providerUrl);
    setTempKey(apiKey);
    setTempModel(modelName);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    setProviderUrl(tempUrl);
    setApiKey(tempKey);
    setModelName(tempModel);

    localStorage.setItem("council_provider_url", tempUrl);
    localStorage.setItem("council_model_name", tempModel);
    localStorage.setItem("council_api_key", tempKey);

    setSettingsOpen(false);
  };

  const startDebate = async (followupQuestion?: string) => {
    const cleanedTopic = topic.trim();
    if (!cleanedTopic || running) return;

    if (!providerUrl || !apiKey || !modelName) {
      setError("AI provider details are missing. Please save them in Settings.");
      setSettingsOpen(true);
      return;
    }

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

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      headers["x-provider-url"] = providerUrl;
      headers["x-api-key"] = apiKey;
      headers["x-model-name"] = modelName;

      const response = await fetch(`/api/debate`, {
        method: "POST",
        headers,
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

            return [...prev, { agent, content, role: String(data.role ?? "") }];
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
    <div className="relative flex h-screen max-h-screen w-screen flex-col overflow-hidden bg-[#03050c] p-3 text-zinc-300 md:p-4 font-sans">
      <Header
        topic={topic}
        setTopic={setTopic}
        running={running}
        onStart={() => {
          void startDebate();
        }}
      />

      <div className="flex flex-1 min-h-0 gap-3 overflow-hidden pt-3">
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

      <button
        type="button"
        onClick={openSettings}
        className="absolute bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-200 backdrop-blur-xl transition hover:bg-white/10"
      >
        <Settings className="h-4 w-4 text-zinc-300" />
        Settings
      </button>

      {settingsOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[24px] border border-white/5 bg-[#070a13] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-white">AI Provider</h2>
                <p className="mt-1 text-[8px] uppercase tracking-wider text-zinc-650">Setup connection keys</p>
              </div>
              {providerUrl && apiKey && modelName ? (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-full border border-white/5 bg-white/[0.02] px-2.5 py-1 text-[9px] uppercase tracking-wider text-zinc-400 hover:bg-white/5"
                >
                  Close
                </button>
              ) : null}
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveSettings();
              }}
            >
              <Field label="Provider URL" value={tempUrl} onChange={setTempUrl} placeholder="e.g. http://localhost:20128/v1" />
              <Field label="API Key" value={tempKey} onChange={setTempKey} placeholder="Enter API secret key" type="password" />
              <Field label="Model" value={tempModel} onChange={setTempModel} placeholder="e.g. gemini-cli/gemini-2.0-flash" />

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="max-w-[200px] text-[8px] leading-relaxed text-zinc-600 uppercase tracking-wider">
                  Credentials are saved locally in browser storage.
                </p>
                <button
                  type="submit"
                  disabled={!tempUrl.trim() || !tempKey.trim() || !tempModel.trim()}
                  className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-[#03050c] transition hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-400/20 disabled:opacity-30 disabled:pointer-events-none"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute bottom-4 right-4 z-50 rounded-lg border border-red-500/25 bg-red-950/45 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
};

function Field({ label, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-550">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/5 bg-white/[0.01] px-3.5 py-2.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-cyan-400/30 focus:bg-white/[0.02]"
      />
    </label>
  );
}
