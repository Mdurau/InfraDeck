import asyncio
import json
import os
import subprocess
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import docker
import psutil
import loguru

loguru.logger.add("log/app.log", rotation="100 MB")

app = FastAPI(title="DockPulse Enterprise Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MULTI-NODE REGISTRY ---
# We track nodes dynamically. We initialize it with the local host socket.
NODES_CONFIG_PATH = "./app/log/nodes_config.json"
NODES = {
    "local": {
        "name": "Local Host (Daemon)",
        "user": "",
        "connection": "unix://var/run/docker.sock",
        "is_remote": False,
        "ip": "localhost"
    }
}

# Load saved remote nodes if they exist
if os.path.exists(NODES_CONFIG_PATH):
    try:
        with open(NODES_CONFIG_PATH, "r") as f:
            NODES.update(json.load(f))
    except Exception:
        pass

def get_client(node_key: str):
    if node_key not in NODES:
        raise HTTPException(status_code=404, detail="Target infrastructure node not registered.")
    try:
        # Connects natively via UNIX socket or SSH tunnel strings automatically
        return docker.DockerClient(base_url=NODES[node_key]["connection"], timeout=5)
    except Exception as e:
        loguru.logger.error(f"Failed to establish connection to node [{NODES[node_key]['name']}]: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to establish connection to node [{NODES[node_key]['name']}]: {e}")

# --- MANAGING NODES FROM FRONTEND ---
# --- MANAGING NODES FROM FRONTEND ---

@app.get("/api/nodes")
def list_nodes():
    return [{"key": k, "name": v["name"], "user": v["user"], "ip": v["ip"], "is_remote": v["is_remote"]} for k, v in NODES.items()]


@app.post("/api/nodes")
def add_node(name: str, ip: str, user: str):
    key = name.lower().strip().replace(" ", "_")
    if key in NODES:
        raise HTTPException(status_code=400, detail="A node with that name already exists.")
    
    # 1. Automated Keyscan & Handshake Synchronization Protocol
    try:
        ssh_dir = os.path.expanduser("~/.ssh")
        os.makedirs(ssh_dir, mode=0o700, exist_ok=True)
        known_hosts_path = os.path.join(ssh_dir, "known_hosts")

        # Force keyscan to extract all active cryptographic signatures
        cmd = f"ssh-keyscan -t rsa,ecdsa,ed25519 -T 5 {ip} >> {known_hosts_path}"
        subprocess.run(cmd, shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Enforce correct internal file layout permissions inside the container layer
        os.chmod(known_hosts_path, 0o600)
    except Exception as e:
        loguru.logger.warning(f"Handshake scan warning for {ip}: {e}")

    # Inject runtime environment flag overrides for relaxed validation fallbacks
    os.environ["SSH_OPTIONS"] = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

    # 2. Append directly to our tracking cluster dictionary state
    NODES[key] = {
        "name": name,
        "user": user,
        "connection": f"ssh://{user}@{ip}",
        "is_remote": True,
        "ip": ip
    }
    
    # 3. CRITICAL: Commit state permanently to the physical config file layout
    try:
        os.makedirs(os.path.dirname(NODES_CONFIG_PATH), exist_ok=True)
        # We strip the immutable 'local' key from the file dump record
        persist_nodes = {k: v for k, v in NODES.items() if k != "local"}
        with open(NODES_CONFIG_PATH, "w") as f:
            json.dump(persist_nodes, f, indent=4)
    except Exception as e:
        loguru.logger.error(f"Failed to write configuration map to disk asset: {e}")
        raise HTTPException(status_code=500, detail="Failed to save node registry map permanently.")
        
    return {"status": "success", "msg": f"Node {name} registered and committed to cluster storage."}


@app.put("/api/nodes/{node_key}")
def update_node(node_key: str, name: str, ip: str, user: str):
    clean_key = node_key.lower().strip()
    if clean_key not in NODES:
        raise HTTPException(status_code=404, detail="Target node not found.")
    if clean_key == "local":
        raise HTTPException(status_code=400, detail="The local daemon host core engine cannot be modified.")

    # 1. Update keyscan signatures for the modified network destination IP
    try:
        ssh_dir = os.path.expanduser("~/.ssh")
        known_hosts_path = os.path.join(ssh_dir, "known_hosts")
        cmd = f"ssh-keyscan -t rsa,ecdsa,ed25519 -T 5 {ip} >> {known_hosts_path}"
        subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # 2. Mutate state parameters
    NODES[clean_key]["name"] = name
    NODES[clean_key]["user"] = user
    NODES[clean_key]["ip"] = ip
    NODES[clean_key]["connection"] = f"ssh://{user}@{ip}"

    # 3. CRITICAL: Synchronize changes down to the tracking json database file
    try:
        persist_nodes = {k: v for k, v in NODES.items() if k != "local"}
        with open(NODES_CONFIG_PATH, "w") as f:
            json.dump(persist_nodes, f, indent=4)
    except Exception as e:
        loguru.logger.error(f"Failed to sync node update to storage: {e}")
        raise HTTPException(status_code=500, detail="Failed to write updating map configs to disk storage.")
        
    return {"status": "success", "msg": f"Node {name} modifications permanently updated."}

@app.delete("/api/nodes/{node_key}")
def delete_node(node_key: str):
    clean_key = node_key.lower().strip()
    if clean_key not in NODES:
        raise HTTPException(status_code=404, detail="Target node missing from configuration.")
    if clean_key == "local":
        raise HTTPException(status_code=400, detail="The local daemon host core engine cannot be deleted.")

    # 1. Drop node configuration mapping reference out of system memory
    del NODES[clean_key]

    # 2. CRITICAL: Persist file updates back down into the config json matrix file
    try:
        persist_nodes = {k: v for k, v in NODES.items() if k != "local"}
        with open(NODES_CONFIG_PATH, "w") as f:
            json.dump(persist_nodes, f, indent=4)
    except Exception as e:
        loguru.logger.error(f"Failed to clear node tracking string from registry file: {e}")
        raise HTTPException(status_code=500, detail="Failed to drop connection mapping record from target file block.")
        
    return {"status": "success", "msg": f"Node key '{clean_key}' detached cleanly from the dashboard cluster pool."}


# --- MULTI-NODE CONTAINER ENGINE ROUTES ---
@app.get("/api/containers")
def list_containers(node: str = "local"):
    client = get_client(node)
    target_ip = NODES[node]["ip"]
    try:
        container_list = []
        for c in client.containers.list(all=True):
            networks = list(c.attrs.get("NetworkSettings", {}).get("Networks", {}).keys())
            ports = c.attrs.get("NetworkSettings", {}).get("Ports", {})
            
            port_mappings = []
            public_ports = []
            for k, v in ports.items():
                if v:
                    host_port = v[0]['HostPort']
                    port_mappings.append(f"{k}->{host_port}")
                    # Grab public ports to construct clickable frontend hyperlinks
                    public_ports.append(host_port)

            cpu_usage, mem_usage_mb, mem_percent = 0.0, 0.0, 0.0

            if c.status.lower() == "running":
                try:
                    stats = c.stats(stream=False)
                    cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - stats["precpu_stats"]["cpu_usage"]["total_usage"]
                    system_delta = stats["cpu_stats"]["system_cpu_usage"] - stats["precpu_stats"]["system_cpu_usage"]
                    online_cpus = stats["cpu_stats"].get("online_cpus", 1)

                    if system_delta > 0 and cpu_delta > 0:
                        cpu_usage = round((cpu_delta / system_delta) * online_cpus * 100.0, 1)

                    mem_usage_bytes = stats["memory_stats"].get("usage", 0)
                    mem_limit_bytes = stats["memory_stats"].get("limit", 1)
                    mem_usage_mb = round(mem_usage_bytes / (1024 ** 2), 1)
                    mem_percent = round((mem_usage_bytes / mem_limit_bytes) * 100.0, 1)
                except Exception:
                    loguru.logger.warning(f"Failed to fetch stats for container {c.short_id} on node [{NODES[node]['name']}].")

            container_list.append({
                "id": c.short_id,
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else c.image.id[:19],
                "networks": networks,
                "ports": port_mappings,
                "public_ports": public_ports,
                "node_ip": target_ip,
                "metrics": {
                    "cpu_usage": cpu_usage,
                    "mem_usage_mb": mem_usage_mb,
                    "mem_percent": mem_percent
                }
            })
        return container_list
    except Exception as e:
        loguru.logger.error(f"Error occurred while fetching container list for node [{NODES[node]['name']}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/public-key")
def get_public_key():
    # Inside the container, root's home directory is /root
    ssh_dir = os.path.expanduser("~/.ssh")
    key_path = os.path.join(ssh_dir, "id_rsa")
    pub_key_path = f"{key_path}.pub"
    
    try:
        # Ensure the .ssh directory exists inside the container
        os.makedirs(ssh_dir, mode=0o700, exist_ok=True)
        
        # If the public key file doesn't exist, generate it programmatically
        if not os.path.exists(pub_key_path):
            print("No internal key found. Generating fresh deployment key pair...")
            # -N '' sets an empty passphrase so the Python SDK can use it non-interactively
            subprocess.run(
                f"ssh-keygen -t rsa -b 4096 -f {key_path} -N ''", 
                shell=True, 
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
        # Read and return the freshly generated key to the frontend box
        with open(pub_key_path, "r") as f:
            return {"public_key": f.read().strip()}
     
    except Exception as e:
        loguru.logger.error(f"Failed to generate or read SSH key pair: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate or read SSH key pair: {e}")
    
@app.post("/api/containers/{container_id}/{action}")
def manage_container(container_id: str, action: str, node: str = "local"):
    client = get_client(node)
    try:
        container = client.containers.get(container_id)
        if action == "start": container.start()
        elif action == "stop": container.stop()
        elif action == "restart": container.restart()
        return {"status": "success"}
    except Exception as e:
        loguru.logger.error(f"Error occurred while managing container [{container_id}] on node [{NODES[node]['name']}]: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- HOST TELEMETRY CONFIGURATION (STAYS LOCAL TO CORE HOST) ---
@app.websocket("/ws/metrics")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            cpu_percent = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            await websocket.send_json({
                "cpu_usage_percent": cpu_percent,
                "cpu_cores": psutil.cpu_count(),
                "memory": {"total_gb": round(memory.total / (1024**3), 2), "used_gb": round(memory.used / (1024**3), 2), "percent": memory.percent},
                "disk": {"total_gb": round(disk.total / (1024**3), 2), "used_gb": round(disk.used / (1024**3), 2), "percent": disk.percent}
            })
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        loguru.logger.info("WebSocket disconnected: Host telemetry stream closed.")
        
@app.websocket("/ws/containers/{container_id}/logs")
async def container_logs_endpoint(websocket: WebSocket, container_id: str, node: str = "local"):
    await websocket.accept()
    try:
        # Resolve the specific Docker client (Local or Remote SSH Engine)
        client = get_client(node)
        container = client.containers.get(container_id)
        
        # Stream logs in chunks line-by-line using tail parameters
        log_generator = container.logs(stream=True, follow=True, tail=100)
        loop = asyncio.get_event_loop()
        
        def get_next_line(gen):
            try:
                return next(gen).decode('utf-8', errors='ignore')
            except StopIteration:
                return None

        while True:
            line = await loop.run_in_executor(None, get_next_line, log_generator)
            if line is None:
                break
            await websocket.send_text(line)
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        loguru.logger.info(f"Log stream disconnected for container {container_id} on node [{node}]")
    except Exception as e:
        loguru.logger.error(f"Error streaming logs for node [{node}]: {e}")
        await websocket.close(code=1011)