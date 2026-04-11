"""
main.py — FastAPI + WebSocket server for CortexScheduler.

Endpoints:
  WS  ws://localhost:8001/ws/scheduler   ← main live stream
  GET /scheduler/status                  ← current state snapshot
  GET /health                            ← health check

Port: 8001 (scheduler-backend)

WebSocket protocol (Client → Server):
  { "type": "start",  "mode": "heuristic" | "ppo" }
  { "type": "pause"  }
  { "type": "resume" }
  { "type": "reset"  }
  { "type": "speed",  "tps": <float> }

WebSocket protocol (Server → Client):
  { "type": "tick",      "data": <SchedulerEvent>  }
  { "type": "narration", "data": <NarrationEvent>  }
  { "type": "error",     "data": { "message": str } }
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from models import AgentMode, ClientCommand, NarrationEvent, SchedulerEvent
from orchestrator import SchedulerOrchestrator
from scheduler_agent import SchedulerAgent
from scheduler_sim import SchedulerSim


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Nothing to pre-initialise at startup — each WS connection creates its own sim
    yield

app = FastAPI(
    title       = "CortexScheduler API",
    description = "CPU + network resource scheduler simulator with AI narration",
    version     = "1.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)


# ---------------------------------------------------------------------------
# WebSocket — /ws/scheduler
# ---------------------------------------------------------------------------

@app.websocket("/ws/scheduler")
async def ws_scheduler(websocket: WebSocket) -> None:
    await websocket.accept()

    # Per-connection simulator + orchestrator
    agent = SchedulerAgent()

    # ----------------------------------------------------------------
    # Callbacks: called by sim/orchestrator, push data to WebSocket
    # ----------------------------------------------------------------

    async def send_event(event: SchedulerEvent) -> None:
        try:
            await websocket.send_json({
                "type": "tick",
                "data": event.model_dump(mode="json"),
            })
            # Also feed to orchestrator (non-blocking)
            asyncio.create_task(orchestrator.ingest(event))
        except Exception:
            pass

    async def send_narration(narration: NarrationEvent) -> None:
        try:
            await websocket.send_json({
                "type": "narration",
                "data": narration.model_dump(mode="json"),
            })
        except Exception:
            pass

    sim          = SchedulerSim(agent, send_event)
    orchestrator = SchedulerOrchestrator(send_narration)

    # ----------------------------------------------------------------
    # Message dispatch loop
    # ----------------------------------------------------------------
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": "Invalid JSON"},
                })
                continue

            cmd_type = msg.get("type", "")

            if cmd_type == "start":
                mode_str = msg.get("mode", "heuristic")
                try:
                    mode = AgentMode(mode_str)
                except ValueError:
                    mode = AgentMode.HEURISTIC
                tps = float(msg.get("tps", 2.0))
                orchestrator.reset()
                await sim.start(mode=mode, tps=tps)

            elif cmd_type == "pause":
                sim.pause()

            elif cmd_type == "resume":
                sim.resume()

            elif cmd_type == "reset":
                await sim.reset()
                orchestrator.reset()

            elif cmd_type == "speed":
                tps = msg.get("tps", 2.0)
                sim.set_tps(float(tps))

            else:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": f"Unknown command type: {cmd_type}"},
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "data": {"message": str(e)},
            })
        except Exception:
            pass
    finally:
        await sim.reset()


# ---------------------------------------------------------------------------
# REST — /scheduler/status
# ---------------------------------------------------------------------------

@app.get("/scheduler/status")
async def scheduler_status():
    """
    Returns a brief status snapshot.
    In production you'd read from a shared sim reference;
    here we return a static placeholder since each WS connection owns its sim.
    """
    return {
        "status":  "ready",
        "message": "Connect via WebSocket at ws://localhost:8001/ws/scheduler",
    }


# ---------------------------------------------------------------------------
# REST — /health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "cortex-scheduler"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
