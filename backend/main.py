"""
main.py — Unified FastAPI server for CortexOS.

Endpoints:
  WS  /ws/simulator    — VM execution simulator
  WS  /ws/scheduler    — CPU/network scheduler simulator
  POST /shell           — CortexShell natural language interface
  GET  /system/state    — Unified system state
  GET  /system/metrics  — System metrics
  GET  /system/alerts   — Sentinel alerts
  GET  /health          — Health check

Port: 8000
"""

from __future__ import annotations

import asyncio
import json
import sys
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure backend root is on path for subpackage imports
sys.path.insert(0, os.path.dirname(__file__))

from vm.orchestrator import SimulatorOrchestrator
from scheduler.models import AgentMode, NarrationEvent, SchedulerEvent
from scheduler.orchestrator import SchedulerOrchestrator
from scheduler.scheduler_agent import SchedulerAgent
from scheduler.scheduler_sim import SchedulerSim
from shell.shell_handler import handle_shell_command
from sentinel.sentinel import analyze_system
from shared.state import system_state


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="CortexOS Unified API",
    description="AI-native OS simulation — VM + Scheduler + Shell + Sentinel",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket — /ws/simulator (VM)
# ---------------------------------------------------------------------------

@app.websocket("/ws/simulator")
async def websocket_simulator_endpoint(websocket: WebSocket):
    await websocket.accept()
    orchestrator = SimulatorOrchestrator()

    try:
        while True:
            data = await websocket.receive_json()
            command_type = data.get("type", "")

            if command_type == "simulate":
                code = data.get("code", "")
                if not code:
                    await websocket.send_json({"type": "error", "data": "No code provided."})
                    continue

                await websocket.send_json({"type": "info", "data": "Simulation started."})

                steps_collected = []
                async for step in orchestrator.simulate(code):
                    step_data = step.model_dump()
                    steps_collected.append(step_data)
                    await websocket.send_json({
                        "type": "sim_step",
                        "data": step_data,
                    })

                # Store for shell/sentinel access
                system_state.set_vm_steps(steps_collected)
                await websocket.send_json({"type": "info", "data": "Simulation finished."})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "data": str(e)})
        except:
            pass


# ---------------------------------------------------------------------------
# WebSocket — /ws/scheduler
# ---------------------------------------------------------------------------

@app.websocket("/ws/scheduler")
async def ws_scheduler(websocket: WebSocket) -> None:
    await websocket.accept()

    agent = SchedulerAgent()

    async def send_event(event: SchedulerEvent) -> None:
        try:
            await websocket.send_json({
                "type": "tick",
                "data": event.model_dump(mode="json"),
            })
            asyncio.create_task(orchestrator.ingest(event))

            # Run sentinel checks and store alerts
            snapshot = event.model_dump(mode="json")
            alerts = analyze_system(snapshot)
            for a in alerts:
                system_state.add_alert(a.model_dump())
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

    sim = SchedulerSim(agent, send_event)
    orchestrator = SchedulerOrchestrator(send_narration)

    # Register sim in global state for shell/sentinel access
    system_state.set_scheduler_sim(sim)

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
        except:
            pass
    finally:
        await sim.reset()
        system_state.set_scheduler_sim(None)


# ---------------------------------------------------------------------------
# REST — /shell (CortexShell)
# ---------------------------------------------------------------------------

class ShellRequest(BaseModel):
    command: str


@app.post("/shell")
async def shell_endpoint(req: ShellRequest):
    scheduler_state = system_state.get_scheduler_snapshot()
    vm_steps = system_state.get_vm_steps()
    result = await handle_shell_command(req.command, scheduler_state, vm_steps)
    return result


# ---------------------------------------------------------------------------
# REST — /system/*
# ---------------------------------------------------------------------------

@app.get("/system/state")
async def system_state_endpoint():
    return {
        "scheduler": system_state.get_scheduler_snapshot(),
        "vm_steps_count": len(system_state.get_vm_steps()),
        "alerts_count": len(system_state.get_alerts()),
    }


@app.get("/system/metrics")
async def system_metrics():
    return system_state.get_system_metrics()


@app.get("/system/alerts")
async def system_alerts():
    return {"alerts": system_state.get_alerts()}


# ---------------------------------------------------------------------------
# REST — /health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "cortex-os"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
