from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from orchestrator import SimulatorOrchestrator

app = FastAPI(title="Cortex Universal Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

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
                
                # Stream the parsed steps back to the UI
                async for step in orchestrator.simulate(code):
                    await websocket.send_json({
                        "type": "sim_step",
                        "data": step.model_dump()
                    })
                    
                await websocket.send_json({"type": "info", "data": "Simulation finished."})
                
    except WebSocketDisconnect:
        print("[ws] Client disconnected")
    except Exception as e:
        print(f"[ws] Runtime error: {e}")
        try:
            await websocket.send_json({"type": "error", "data": str(e)})
        except:
            pass
