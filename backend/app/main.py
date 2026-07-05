from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.services.system_srv import SystemService
from app.services.docker_srv import DockerService
import asyncio

app = FastAPI(title="DockPulse API", version="1.0.0")

# Enable CORS so our Next.js frontend can communicate flawlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

docker_service = DockerService()

@app.get("/api/containers")
def get_containers():
    return docker_service.list_containers()

@app.post("/api/containers/{container_id}/{action}")
def control_container(container_id: str, action: str):
    return docker_service.manage_container(container_id, action)

@app.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Broadcast live CPU/RAM metrics every 1 second
            metrics = await SystemService.get_live_metrics()
            await websocket.send_json(metrics)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Client disconnected from metrics WebSocket")