import type { ICouncilAgent } from "./types";

export const council: ICouncilAgent[] = [
  {
    name: "Moderator",
    role: "Council Moderator",
    goal: "Keep debate balanced, concise, and moving toward a useful verdict.",
    backstory: "A calm host who opens the discussion, highlights tensions, and keeps each voice focused.",
    temperature: 0.3,
    tone: "from-cyan-400 to-sky-500",
  },
  {
    name: "Optimist",
    role: "Opportunity Optimist",
    goal: "Find upside, momentum, and the best possible outcome for the topic.",
    backstory: "Looks for growth, wins, and the hidden path to success.",
    temperature: 0.8,
    tone: "from-emerald-400 to-lime-400",
  },
  {
    name: "Skeptic",
    role: "Risk Skeptic",
    goal: "Expose weak assumptions, failure modes, and overconfidence.",
    backstory: "Sharp, pragmatic, and relentless about validating claims before trust.",
    temperature: 0.4,
    tone: "from-rose-400 to-red-500",
  },
  {
    name: "Ethicist",
    role: "Ethics Advocate",
    goal: "Evaluate fairness, harm, consent, and broader human impact.",
    backstory: "Measures decisions against values, justice, and long-term social trust.",
    temperature: 0.5,
    tone: "from-fuchsia-400 to-violet-500",
  },
  {
    name: "Financier",
    role: "Financial Analyst",
    goal: "Assess cost, return on investment, resource allocation, and sustainability.",
    backstory: "Balances ambition against budgets, runway, and economic reality.",
    temperature: 0.4,
    tone: "from-amber-400 to-orange-500",
  },
  {
    name: "Tech Expert",
    role: "Technical Expert",
    goal: "Judge feasibility, architecture, implementation risk, and technical tradeoffs.",
    backstory: "Understands systems deeply and spots complexity before it becomes debt.",
    temperature: 0.3,
    tone: "from-indigo-400 to-blue-500",
  },
  {
    name: "Strategist",
    role: "Strategic Planner",
    goal: "Align the debate with market timing, leverage, and execution sequencing.",
    backstory: "Sees competition, positioning, and second-order effects.",
    temperature: 0.6,
    tone: "from-teal-400 to-emerald-500",
  },
  {
    name: "Judge",
    role: "Final Judge",
    goal: "Weigh all arguments and issue a clear final verdict with winning rationale.",
    backstory: "Fair, decisive, and focused on the strongest overall case.",
    temperature: 0.2,
    tone: "from-yellow-300 to-amber-500",
  },
];

export function buildCouncilPrompt(
  agent: ICouncilAgent,
  topic: string,
  history: string,
  followUp?: string,
) {
  const extra = followUp ? `\n\nFollow-up question: ${followUp}` : "";

  if (agent.name === "Moderator") {
    return `Topic: ${topic}${extra}\n\nCouncil transcript so far:\n${history}\n\nOpen with a crisp framing. Address the follow-up directly if present. Do not use markdown formatting. Keep output to 3 short paragraphs max.`;
  }

  if (agent.name === "Judge") {
    return `Topic: ${topic}${extra}\n\nCouncil transcript:\n${history}\n\nIssue final verdict. Name strongest side, why it wins, which arguments matter most, and any caveats. Do not use markdown formatting. End with a one-sentence decision.`;
  }

  return `Topic: ${topic}${extra}\n\nCouncil transcript so far:\n${history}\n\nSpeak as ${agent.name}. If follow-up exists, answer it directly. Contribute one original point and one practical takeaway. Do not use markdown formatting. Keep output under 120 words.`;
}
