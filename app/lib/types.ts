export type Status = "Idle" | "Thinking" | "Speaking";

export type AgentName =
  | "Moderator"
  | "Optimist"
  | "Skeptic"
  | "Ethicist"
  | "Financier"
  | "Tech Expert"
  | "Strategist"
  | "Judge";

export interface ICouncilAgent {
  name: AgentName;
  role: string;
  goal: string;
  backstory: string;
  temperature: number;
  tone: string;
}

export interface ITranscriptLine {
  agent: AgentName;
  content: string;
  role?: string;
}

export interface ILLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ILLMProvider {
  streamChat(
    messages: ILLMMessage[],
    temperature: number,
    onChunk: (token: string) => void
  ): Promise<void>;
}
