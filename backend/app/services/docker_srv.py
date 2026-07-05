import docker
from typing import List, Dict, Any

class DockerService:
    def __init__(self):
        # Connects to local docker socket automatically
        try:
            self.client = docker.from_env()
        except Exception:
            self.client = None

    def list_containers(self) -> List[Dict[str, Any]]:
        if not self.client:
            return [{"error": "Docker daemon unavailable or permissions missing"}]
        
        containers = self.client.containers.list(all=True)
        return [
            {
                "id": c.short_id,
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else "unknown",
                "created": c.attrs.get("Created", "")
            }
            for c in containers
        ]

    def manage_container(self, container_id: str, action: str) -> Dict[str, str]:
        if not self.client:
            return {"error": "Docker daemon unavailable"}
            
        try:
            container = self.client.containers.get(container_id)
            if action == "start":
                container.start()
            elif action == "stop":
                container.stop()
            elif action == "restart":
                container.restart()
            else:
                return {"error": f"Invalid action: {action}"}
            return {"status": "success", "message": f"Container {container_id} {action}ed successfully"}
        except Exception as e:
            return {"status": "error", "message": str(e)}