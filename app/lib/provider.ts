import type { ILLMMessage, ILLMProvider } from "./types";

export class OmniRouteProvider implements ILLMProvider {
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(customUrl?: string, customModel?: string, customKey?: string) {
    this.baseUrl = customUrl || process.env.OMNIROUTE_BASE_URL || "http://localhost:20128/v1";
    const rawModel = customModel || process.env.OMNIROUTE_MODEL || "openai/free-forever";
    this.model = rawModel.includes("/") ? rawModel : `openai/${rawModel}`;
    this.apiKey = customKey || process.env.OMNIROUTE_API_KEY || "omniroute";
  }

  async streamChat(
    messages: ILLMMessage[],
    temperature: number,
    onChunk: (token: string) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OmniRoute API responded with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine || !cleanLine.startsWith("data:")) continue;

        const dataStr = cleanLine.slice(5).trim();
        if (dataStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(dataStr);
          const token = parsed.choices?.[0]?.delta?.content || "";
          if (token) {
            onChunk(token);
          }
        } catch {}
      }
    }
  }
}
