# 🚀 InfraDeck        

DockPulse is a self-hosted, lightweight **Internal Developer Platform (IDP)** and server control center. It combines a modern asynchronous backend with a responsive streaming interface to provide real-time hardware telemetry and container orchestration directly from a clean web UI.

Built to showcase clean execution across **Full-Stack Engineering, System Administration, and DevOps Lifecycle Automation**.

---

## 🛠️ System Architecture

The platform is designed as an isolated, decoupled monorepo orchestrated entirely via Docker:

* **Frontend:** Next.js 15+ (App Router) styled with Tailwind CSS v4. Communicates via persistent WebSockets for live telemetry and uses asynchronous REST calls for lifecycle actions.
* **Backend:** FastAPI (Python 3.11) utilizing `psutil` for native OS kernel monitoring and the official Docker SDK for runtime container access.
* **Reverse Proxy:** Nginx acts as the unified ingress point, routing web traffic, API endpoints, and handling WebSocket connection upgrades securely over a single port.

---

## ⚙️ Core Technical Features Exposed

1. **Host Socket Mapping:** Maps the host machine's `/var/run/docker.sock` safely into an isolated backend container container layer, enabling secure, direct administration of neighboring infrastructure workloads.
2. **Real-time Bi-directional Telemetry:** Replaced standard polling mechanisms with a lightweight persistent WebSocket stream to push server metrics (CPU, RAM Allocation, Filesystem Capacity) every second without backend bloat.
3. **Multi-Stage Production Builds:** Optimized deployment footprint. Frontend utilizes Next.js standalone execution logic to strip the container profile from ~1GB down to roughly 100MB.
4. **Automated CI/CD Assurance:** Integrated GitHub Actions workflow to execute rigorous syntax/lint validation steps and verify compilation paths on every single remote push to the development branch.

---

## 🚀 Quick Start (Local Development)

Boot up the full application ecosystem locally with a single command:

```bash
docker compose -f docker-compose.dev.yml up --build