'use client';

import { useEffect, useState } from 'react';

interface SystemMetrics {
  cpu_usage_percent: number;
  cpu_cores: number;
  memory: { total_gb: number; used_gb: number; percent: number };
  disk: { total_gb: number; used_gb: number; percent: number };
}

interface Container {
  id: string;
  name: string;
  status: string; // e.g., "running", "exited"
  image: string;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');

  // Fetch metrics via WebSocket
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/metrics');
    ws.onopen = () => setWsStatus('open');
    ws.onmessage = (event) => setMetrics(JSON.parse(event.data));
    ws.onclose = () => setWsStatus('closed');
    return () => ws.close();
  }, []);

  // Fetch containers list from FastAPI engine
  const fetchContainers = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/containers');
      const data = await res.json();
      setContainers(data);
    } catch (err) {
      console.error('Failed to fetch containers', err);
    }
  };

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 4000); // Poll status every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    try {
      await fetch(`http://localhost:8000/api/containers/${id}/${action}`, { method: 'POST' });
      fetchContainers(); // Refresh lists immediately after action execution
    } catch (err) {
      console.error(err);
    }
  };

  // Split containers into active and exited arrays cleanly
  const runningContainers = containers.filter(c => c.status.toLowerCase().includes('running') || c.status.toLowerCase().includes('up'));
  const exitedContainers = containers.filter(c => !c.status.toLowerCase().includes('running') && !c.status.toLowerCase().includes('up'));

  // Reusable component layout for the table view to keep code dry
  const ContainerTable = ({ list, isRunningGroup }: { list: Container[], isRunningGroup: boolean }) => (
    <div className="overflow-x-auto mb-8 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
      <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-slate-300">
        <span className={`h-2 w-2 rounded-full ${isRunningGroup ? 'bg-emerald-500' : 'bg-slate-500'}`} />
        {isRunningGroup ? `Active Containers (${list.length})` : `Exited Containers (${list.length})`}
      </h3>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-sm">
            <th className="pb-3 font-semibold">ID</th>
            <th className="pb-3 font-semibold">Name</th>
            <th className="pb-3 font-semibold">Image</th>
            <th className="pb-3 font-semibold">Status</th>
            <th className="pb-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm">
          {list.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-center text-slate-500">No containers in this group.</td>
            </tr>
          ) : (
            list.map((container) => (
              <tr key={container.id} className="hover:bg-slate-850/40">
                <td className="py-3 font-mono text-xs text-slate-500">{container.id}</td>
                <td className="py-3 font-medium text-slate-200">{container.name}</td>
                <td className="py-3 text-xs text-slate-400 max-w-[200px] truncate">{container.image}</td>
                <td className="py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${isRunningGroup ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {isRunningGroup ? 'Running' : 'Exited'}
                  </span>
                </td>
                <td className="py-3 text-right space-x-2">
                  {isRunningGroup ? (
                    <>
                      <button onClick={() => handleAction(container.id, 'stop')} className="px-3 py-1 bg-rose-600/90 hover:bg-rose-500 rounded text-xs font-medium text-white transition">
                        Stop
                      </button>
                      <button onClick={() => handleAction(container.id, 'restart')} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium text-slate-300 transition">
                        Restart
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleAction(container.id, 'start')} className="px-3 py-1 bg-emerald-600/90 hover:bg-emerald-500 rounded text-xs font-medium text-white transition">
                      Start
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      {/* Top Status Bar */}
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-indigo-400">DockPulse</h1>
          <p className="text-sm text-slate-400">Infrastructure Management Dashboard</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <span className={`h-2 w-2 rounded-full ${wsStatus === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-xs uppercase font-mono tracking-wider text-slate-300">Engine Stream: {wsStatus}</span>
        </div>
      </header>

      {/* Real-time Hardware Metrics View */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">CPU Capacity</h2>
          <p className="text-4xl font-bold mt-2 text-indigo-400">{metrics?.cpu_usage_percent ?? 0}%</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
    {metrics?.cpu_cores ?? 0} <span className="text-slate-500">Available Cores</span>
  </p>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
            <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${metrics?.cpu_usage_percent ?? 0}%` }} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">RAM Allocation</h2>
          <p className="text-4xl font-bold mt-2 text-sky-400">{metrics?.memory.percent ?? 0}%</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
      {metrics?.memory.used_gb ?? 0} GB <span className="text-slate-600">/</span> {metrics?.memory.total_gb ?? 0} GB
    </p>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
            <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${metrics?.memory.percent ?? 0}%` }} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Storage Filesystem</h2>
          <p className="text-4xl font-bold mt-2 text-emerald-400">{metrics?.disk.percent ?? 0}%</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
      {metrics?.disk.used_gb ?? 0} GB <span className="text-slate-600">/</span> {metrics?.disk.total_gb ?? 0} GB
    </p>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${metrics?.disk.percent ?? 0}%` }} />
          </div>
        </div>
      </section>

      {/* Divided Architectural Tables */}
      <section>
        <ContainerTable list={runningContainers} isRunningGroup={true} />
        <ContainerTable list={exitedContainers} isRunningGroup={false} />
      </section>
    </main>
  );
}