import type { AgentName, Status } from "../lib/types";
import { council } from "../lib/council";

interface SeatsSidebarProps {
  activeAgent: AgentName | null;
  statuses: Record<AgentName, Status>;
}

export default function SeatsSidebar({ activeAgent, statuses }: SeatsSidebarProps) {
  const statusDot = (status: Status) =>
    status === "Speaking"
      ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.85)]"
      : status === "Thinking"
        ? "bg-amber-300 animate-pulse"
        : "bg-zinc-700";

  return (
    <aside className="w-45 shrink-0 flex flex-col gap-2 overflow-y-auto pr-1 rounded-2xl border border-white/8 bg-white/[0.015] p-2 backdrop-blur-2xl">
      <div className="text-[9px] uppercase tracking-[0.24em] text-zinc-500 pb-1">Council Seats</div>
      {council.map((agent) => {
        const isActive = activeAgent === agent.name;
        const status = statuses[agent.name];
        return (
          <div
            key={agent.name}
            className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
              isActive ? "bg-cyan-400/5 border-cyan-400/35" : "bg-transparent border-white/4"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`grid h-6 w-6 place-items-center rounded bg-linear-to-br ${agent.tone} text-[#03050c] font-semibold text-xs`}>
                {agent.name[0]}
              </div>
              <div>
                <div className="text-[11px] font-medium text-white">{agent.name}</div>
                <div className="text-[8px] text-zinc-500 uppercase tracking-wider">{agent.role}</div>
              </div>
            </div>
            <div className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
          </div>
        );
      })}
    </aside>
  );
}
