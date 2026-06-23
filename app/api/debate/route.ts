import { NextRequest } from "next/server";
import { buildCouncilPrompt, council } from "../../lib/council";
import { OmniRouteProvider } from "../../lib/provider";
import type { ITranscriptLine } from "../../lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sse(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const { topic, transcript, question } = await req.json();

  const customUrl = req.headers.get("x-provider-url") || undefined;
  const customKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "") || undefined;
  const customModel = req.headers.get("x-model-name") || undefined;

  const provider = new OmniRouteProvider(customUrl, customModel, customKey);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            sse("session_started", {
              topic,
              question,
              council: council.map((agent) => agent.name),
            })
          )
        );

        const history: ITranscriptLine[] = Array.isArray(transcript) ? [...transcript] : [];
        let verdictText = "";

        for (const agent of council) {
          controller.enqueue(encoder.encode(sse("agent_start", { agent: agent.name, status: "Thinking" })));

          const historyText =
            history.map((entry) => `${entry.agent}: ${entry.content}`).join("\n") || "No prior council remarks yet.";

          const prompt = buildCouncilPrompt(agent, topic, historyText, question);
          let fullContent = "";

          controller.enqueue(
            encoder.encode(
              sse("agent_message", {
                agent: agent.name,
                role: agent.role,
                content: "",
                status: "Speaking",
              })
            )
          );

          await provider.streamChat(
            [
              {
                role: "system",
                content: `Role: ${agent.role}. Goal: ${agent.goal}. Backstory: ${agent.backstory}`,
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            agent.temperature,
            (token) => {
              fullContent += token;
              controller.enqueue(
                encoder.encode(
                  sse("agent_message", {
                    agent: agent.name,
                    role: agent.role,
                    content: fullContent,
                    status: "Speaking",
                  })
                )
              );
            }
          );

          controller.enqueue(encoder.encode(sse("agent_done", { agent: agent.name, status: "Idle" })));
          history.push({ agent: agent.name, content: fullContent });

          if (agent.name === "Judge") {
            verdictText = fullContent;
          }
        }

        controller.enqueue(
          encoder.encode(
            sse("completed", {
              topic,
              question,
              verdict: verdictText,
              transcript: history,
            })
          )
        );
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
