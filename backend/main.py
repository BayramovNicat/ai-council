from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any, AsyncIterator

try:
    from crewai import Agent, Crew, Process, Task
except Exception:
    @dataclass
    class Agent:
        role: str
        goal: str
        backstory: str
        llm: Any
        verbose: bool = False
        allow_delegation: bool = False

    @dataclass
    class Task:
        description: str
        expected_output: str
        agent: Any

    class Process:
        sequential = "sequential"

    class Crew:
        def __init__(self, agents: list[Any], tasks: list[Any], process: Any, verbose: bool = False) -> None:
            self.agents = agents
            self.tasks = tasks
            self.process = process
            self.verbose = verbose

        def kickoff(self, inputs: dict[str, Any]) -> str:
            task = self.tasks[0]
            agent = task.agent
            prompt = task.description.format(**inputs) if "{" in task.description else task.description
            if hasattr(agent.llm, "invoke"):
                return str(agent.llm.invoke(prompt).content)
            return prompt

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

app = FastAPI(title="AI Agent Council", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DebateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=500)


@dataclass(frozen=True)
class CouncilSeat:
    name: str
    role: str
    goal: str
    backstory: str
    temperature: float = 0.6


SEATS: list[CouncilSeat] = [
    CouncilSeat(
        name="Moderator",
        role="Council Moderator",
        goal="Keep debate balanced, concise, and moving toward a useful verdict.",
        backstory="A calm host who opens the discussion, highlights tensions, and keeps each voice focused.",
        temperature=0.3,
    ),
    CouncilSeat(
        name="Optimist",
        role="Opportunity Optimist",
        goal="Find upside, momentum, and the best possible outcome for the topic.",
        backstory="Looks for growth, wins, and the hidden path to success.",
        temperature=0.8,
    ),
    CouncilSeat(
        name="Skeptic",
        role="Risk Skeptic",
        goal="Expose weak assumptions, failure modes, and overconfidence.",
        backstory="Sharp, pragmatic, and relentless about validating claims before trust.",
        temperature=0.4,
    ),
    CouncilSeat(
        name="Ethicist",
        role="Ethics Advocate",
        goal="Evaluate fairness, harm, consent, and broader human impact.",
        backstory="Measures decisions against values, justice, and long-term social trust.",
        temperature=0.5,
    ),
    CouncilSeat(
        name="Financier",
        role="Financial Analyst",
        goal="Assess cost, return on investment, resource allocation, and sustainability.",
        backstory="Balances ambition against budgets, runway, and economic reality.",
        temperature=0.4,
    ),
    CouncilSeat(
        name="Tech Expert",
        role="Technical Expert",
        goal="Judge feasibility, architecture, implementation risk, and technical tradeoffs.",
        backstory="Understands systems deeply and spots complexity before it becomes debt.",
        temperature=0.3,
    ),
    CouncilSeat(
        name="Strategist",
        role="Strategic Planner",
        goal="Align the debate with market timing, leverage, and execution sequencing.",
        backstory="Sees competition, positioning, and second-order effects.",
        temperature=0.6,
    ),
    CouncilSeat(
        name="Judge",
        role="Final Judge",
        goal="Weigh all arguments and issue a clear final verdict with winning rationale.",
        backstory="Fair, decisive, and focused on the strongest overall case.",
        temperature=0.2,
    ),
]


def build_llm(temperature: float) -> ChatOpenAI:
    return ChatOpenAI(
        base_url=os.getenv("OMNIROUTE_BASE_URL", "http://localhost:20128/v1"),
        model=os.getenv("OMNIROUTE_MODEL", "free-forever"),
        temperature=temperature,
        api_key=os.getenv("OMNIROUTE_API_KEY", "omniroute"),
    )


def build_agent(seat: CouncilSeat) -> Agent:
    return Agent(
        role=seat.role,
        goal=seat.goal,
        backstory=seat.backstory,
        llm=build_llm(seat.temperature),
        verbose=False,
        allow_delegation=False,
    )


def sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def run_single_agent(seat: CouncilSeat, topic: str, transcript: list[dict[str, str]]) -> str:
    agent = build_agent(seat)
    history = "\n".join(
        f"{entry['agent']}: {entry['content']}" for entry in transcript
    ) or "No prior council remarks yet."

    if seat.name == "Moderator":
        prompt = (
            f"Topic: {topic}\n\n"
            f"Council transcript so far:\n{history}\n\n"
            "Open the debate with a crisp framing, name the core tension, and give one guiding question. "
            "Keep output to 3 short paragraphs max."
        )
    elif seat.name == "Judge":
        prompt = (
            f"Topic: {topic}\n\n"
            f"Council transcript:\n{history}\n\n"
            "Issue final verdict. Name strongest side, why it wins, which arguments matter most, and any caveats. "
            "End with a one-sentence decision. Keep output decisive and polished."
        )
    else:
        prompt = (
            f"Topic: {topic}\n\n"
            f"Council transcript so far:\n{history}\n\n"
            f"Speak as {seat.name}. Contribute one original point, one challenge or support point, and one practical takeaway. "
            "Keep output under 140 words."
        )

    task = Task(
        description=prompt,
        expected_output="A concise council statement that advances the debate.",
        agent=agent,
    )
    crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False)
    result = crew.kickoff(inputs={"topic": topic})
    return str(result).strip()


async def debate_stream(topic: str) -> AsyncIterator[str]:
    yield sse("session_started", {"topic": topic, "council": [seat.name for seat in SEATS]})

    transcript: list[dict[str, str]] = []
    verdict_text = ""

    for seat in SEATS:
        yield sse("agent_start", {"agent": seat.name, "status": "Thinking"})
        content = await asyncio.to_thread(run_single_agent, seat, topic, transcript)
        transcript.append({"agent": seat.name, "content": content})
        yield sse(
            "agent_message",
            {
                "agent": seat.name,
                "role": seat.role,
                "content": content,
                "status": "Speaking",
            },
        )
        await asyncio.sleep(0)
        yield sse("agent_done", {"agent": seat.name, "status": "Idle"})
        if seat.name == "Judge":
            verdict_text = content

    yield sse(
        "completed",
        {
            "topic": topic,
            "verdict": verdict_text,
            "transcript": transcript,
        },
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/debate")
async def debate(payload: DebateRequest) -> StreamingResponse:
    response = StreamingResponse(
        debate_stream(payload.topic),
        media_type="text/event-stream",
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Connection"] = "keep-alive"
    response.headers["X-Accel-Buffering"] = "no"
    return response
