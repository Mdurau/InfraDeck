'use client';

import { useEffect, useState, useRef } from 'react';

interface NodeInfo {
  key: string;
  name: string;
  user: string;
  ip: string;
  is_remote: boolean;
}

interface Container {
  id: string;
  name: string;
  status: string;
  image: string;
  networks: string[];
  ports: string[];
  public_ports: string[];
  node_ip: string;
  metrics: { cpu_usage: number; mem_usage_mb: number; mem_percent: number };
}

interface TableProps {
  list: Container[];
  isRunningGroup: boolean;
  onAction: (id: string, action: 'start' | 'stop' | 'restart') => Promise<void>;
  onOpenLogs: (id: string, name: string) => void;
}

const ContainerTable = ({ list, isRunningGroup, onAction, onOpenLogs }: TableProps) => {
  // Track ongoing operations: e.g., { "container_id_1": "stop", "container_id_2": "start" }
  const [processing, setProcessing] = useState<Record<string, string>>({});

  const handleControlledAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    // 1. Mark this specific container as processing this specific action
    setProcessing(prev => ({ ...prev, [id]: action }));
    try {
      await onAction(id, action);
    } finally {
      // 2. Clear loading state once the backend call resolves
      setProcessing(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  return (
    <div className="overflow-x-auto mb-8 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
      <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-slate-300">
        <span className={`h-2 w-2 rounded-full ${isRunningGroup ? 'bg-emerald-500' : 'bg-slate-500'}`} />
        {isRunningGroup ? `Active Containers (${list.length})` : `Exited Containers (${list.length})`}
      </h3>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-sm">
            <th className="pb-3 font-semibold">Container Profile</th>
            <th className="pb-3 font-semibold">Network Ingress Links</th>
            <th className="pb-3 font-semibold">Live Micro-Telemetry</th>
            <th className="pb-3 font-semibold">Status</th>
            <th className="pb-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm">
          {list.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-center text-slate-500">No infrastructure assets running on this node.</td>
            </tr>
          ) : (
            list.map((container) => {
              const isCurrentProcessing = processing[container.id];

              return (
                <tr key={container.id} className="hover:bg-slate-850/40">
                  <td className="py-3">
                    <div className="font-medium text-slate-200">{container.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{container.image}</div>
                  </td>
                  <td className="py-3 font-mono text-xs">
                    <div className="flex flex-col gap-1">
                      {container.public_ports.length > 0 ? (
                        container.public_ports.map((port, idx) => (
                          <a 
                            key={idx}
                            href={`http://${container.node_ip}:${port}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                          >
                            🌐 Connect (Port {port})
                          </a>
                        ))
                      ) : (
                        <span className="text-slate-600 italic">No public port bindings mapped</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 w-[240px]">
                    {isRunningGroup ? (
                      <div className="space-y-2 pr-4">
                        <div>
                          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-0.5">
                            <span>CPU</span><span>{container.metrics?.cpu_usage ?? 0}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${container.metrics?.cpu_usage ?? 0}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-0.5">
                            <span>RAM</span><span>{container.metrics?.mem_usage_mb ?? 0} MB</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${container.metrics?.mem_percent ?? 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600 italic">Resources offline</span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${isRunningGroup ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {container.status}
                    </span>
                  </td>
                  <td className="py-3 text-right space-x-2">
                    <button 
                      onClick={() => onOpenLogs(container.id, container.name)} 
                      disabled={!!isCurrentProcessing}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition disabled:opacity-50"
                    >
                      Logs
                    </button>
                    
                    {isRunningGroup ? (
                      <button 
                        onClick={() => handleControlledAction(container.id, 'stop')} 
                        disabled={!!isCurrentProcessing}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-600/90 hover:bg-rose-500 rounded text-xs text-white transition disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {isCurrentProcessing === 'stop' ? (
                          <>
                            {/* Tailwind Loading Circle Spinner */}
                            <svg className="animate-spin h-3 w-3 text-rose-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Stopping...
                          </>
                        ) : "Stop"}
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleControlledAction(container.id, 'start')} 
                        disabled={!!isCurrentProcessing}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/90 hover:bg-emerald-500 rounded text-xs text-white transition disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {isCurrentProcessing === 'start' ? (
                          <>
                            <svg className="animate-spin h-3 w-3 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Starting...
                          </>
                        ) : "Start"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default function Dashboard() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('local');
  const [containers, setContainers] = useState<Container[]>([]);
  const [isSubmittingNode, setIsSubmittingNode] = useState(false);
  
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [editingNodeKey, setEditingNodeKey] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formIp, setFormIp] = useState('');
  const [formUser, setFormUser] = useState('');
  const [dashboardPublicKey, setDashboardPublicKey] = useState('');

  const [activeLogContainer, setActiveLogContainer] = useState<{ id: string; name: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const logWsRef = useRef<WebSocket | null>(null);

  const fetchNodes = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/nodes');
      const data = await res.json();
      setNodes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchContainers = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/containers?node=${selectedNode}`);
      const data = await res.json();
      setContainers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showNodeModal) {
      fetch('http://localhost:8000/api/system/public-key')
        .then(res => res.json())
        .then(data => setDashboardPublicKey(data.public_key))
        .catch(err => console.error(err));
    }
  }, [showNodeModal]);

  useEffect(() => {
    fetchNodes();
  }, []);

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 4000);
    return () => clearInterval(interval);
  }, [selectedNode]);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    await fetch(`http://localhost:8000/api/containers/${id}/${action}?node=${selectedNode}`, { method: 'POST' });
    fetchContainers();
  };

  const openLogsModal = (id: string, name: string) => {
    setLogs([]);
    setActiveLogContainer({ id, name });
    if (logWsRef.current) logWsRef.current.close();
    const ws = new WebSocket(`ws://localhost:8000/ws/containers/${id}/logs?node=${selectedNode}`);
    logWsRef.current = ws;
    ws.onmessage = (e) => setLogs((prev) => [...prev, e.data]);
  };

  // FIXED: Synchronized query and path parameters mapping perfectly with the FastAPI specification
  const submitNewNode = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmittingNode(true); // 👈 Lock form input immediately
  try {
    const queryParams = `?name=${encodeURIComponent(formName)}&ip=${encodeURIComponent(formIp)}&user=${encodeURIComponent(formUser)}`;
    const endpoint = editingNodeKey 
      ? `http://localhost:8000/api/nodes/${editingNodeKey}${queryParams}`
      : `http://localhost:8000/api/nodes${queryParams}`;
    
    const method = editingNodeKey ? 'PUT' : 'POST';
    const res = await fetch(endpoint, { method });
    
    if (res.ok) {
      setFormName(''); setFormIp(''); setFormUser('root');
      setEditingNodeKey(null);
      setShowNodeModal(false);
      fetchNodes();
    } else {
      const data = await res.json();
      alert(`Error: ${data.detail || 'Failed to process node action'}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    setIsSubmittingNode(false); // 👈 Release form control lock
  }
};

  const handleEditTrigger = (node: NodeInfo) => {
    setEditingNodeKey(node.key);
    setFormName(node.name);
    setFormIp(node.ip);
    setFormUser(node.user); // Placeholder, as the actual username might not be retrievable
    setShowNodeModal(true);
  };

  const handleDeleteNode = async (nodeKey: string) => {
    if (confirm("Are you sure you want to delete this remote node?")) {
      const res = await fetch(`http://localhost:8000/api/nodes/${nodeKey}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedNode === nodeKey) setSelectedNode('local');
        fetchNodes();
      }
    }
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8 relative">
      
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-indigo-400">DockPulse</h1>
            <p className="text-sm text-slate-400">Multi-Node Hybrid Orchestrator</p>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
            <label className="text-xs font-mono text-slate-500 uppercase">Target Engine:</label>
            <select 
              value={selectedNode} 
              onChange={(e) => setSelectedNode(e.target.value)}
              className="bg-transparent font-semibold text-slate-200 focus:outline-none text-sm cursor-pointer border-none"
            >
              {nodes.map((node) => (
                <option key={node.key} value={node.key} className="bg-slate-900 text-slate-200">
                  {node.name} ({node.ip})
                </option>
              ))}
            </select>
            <button 
              onClick={() => setShowManagerModal(true)} 
              className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 font-mono px-2 py-0.5 rounded transition ml-1"
            >
              ⚙️ Cluster Manager
            </button>
          </div>
        </div>
                
        <button 
          onClick={() => { setEditingNodeKey(null); setFormName(''); setFormIp(''); setFormUser(''); setShowNodeModal(true); }} 
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20"
        >
          ➕ Register Remote VM (SSH)
        </button>
      </header>

      <section>
        <ContainerTable list={containers.filter(c => c.status.toLowerCase().includes('running') || c.status.toLowerCase().includes('up'))} isRunningGroup={true} onAction={handleAction} onOpenLogs={openLogsModal} />
        <ContainerTable list={containers.filter(c => !c.status.toLowerCase().includes('running') && !c.status.toLowerCase().includes('up'))} isRunningGroup={false} onAction={handleAction} onOpenLogs={openLogsModal} />
      </section>

      {/* Cluster Manager Modal */}
      {showManagerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-200">Infrastructure Cluster Management</h3>
              <button onClick={() => setShowManagerModal(false)} className="text-slate-400 hover:text-slate-200 text-xs font-mono bg-slate-800 px-2.5 py-1 rounded">Close</button>
            </div>
            
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {nodes.map(node => (
                <div key={node.key} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-850">
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">{node.name}</h4>
                    <p className="text-xs font-mono text-slate-500">Address: {node.ip} | ID: {node.key}</p>
                  </div>
                  <div className="space-x-2">
                    {node.key !== 'local' ? (
                      <>
                        <button 
                          onClick={() => { setShowManagerModal(false); handleEditTrigger(node); }}
                          className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-400 rounded text-xs font-semibold transition"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteNode(node.key)}
                          className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-400 rounded text-xs font-semibold transition"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-600 font-mono italic pr-3">System Protected</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showNodeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={submitNewNode} className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-xl p-6 shadow-2xl space-y-4 text-left">
            <h3 className="text-lg font-bold text-slate-200">{editingNodeKey ? "Modify Remote Node Assets" : "Link Remote Virtual Machine"}</h3>
            
            {!editingNodeKey && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <label className="block text-[11px] text-indigo-400 font-mono font-semibold mb-1 uppercase">Dashboard Authorization Key (RSA):</label>
                <textarea 
                  readOnly 
                  value={dashboardPublicKey || "Requesting cryptographic pair from system daemon..."} 
                  onClick={() => { navigator.clipboard.writeText(dashboardPublicKey); alert("Key copied!"); }} 
                  className="w-full bg-slate-900 border border-slate-850 rounded p-2 text-[10px] font-mono text-slate-400 h-16 cursor-pointer resize-none focus:outline-none" 
                />
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1">Machine Label Name</label>
                <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Proxmox-Production-Node" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 font-mono mb-1">IPv4 Address</label>
                  <input type="text" required value={formIp} onChange={e => setFormIp(e.target.value)} placeholder="e.g. 192.168.5.11" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-mono mb-1">SSH Username</label>
                  <input type="text" required value={formUser} onChange={e => setFormUser(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none font-mono" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => { setShowNodeModal(false); setEditingNodeKey(null); }} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold">{editingNodeKey ? "Save Changes" : "Authorize Connection"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Logs Window Terminal Overlay */}
      {activeLogContainer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[600px] text-left">
            <div className="bg-slate-850 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-200">Terminal Output: {activeLogContainer.name}</h3>
                <p className="text-xs text-slate-500 font-mono">Node Context: {selectedNode} | ID: {activeLogContainer.id}</p>
              </div>
              <button onClick={() => { logWsRef.current?.close(); setActiveLogContainer(null); }} className="text-slate-400 hover:text-slate-200 text-sm font-semibold bg-slate-800 px-3 py-1 rounded">Close</button>
            </div>
            <div className="p-4 bg-slate-950 flex-1 overflow-y-auto font-mono text-xs text-emerald-400 space-y-1 whitespace-pre-wrap">
              {logs.length === 0 ? <div className="text-slate-600 italic">Listening for machine daemon signals...</div> : logs.map((log, i) => <div key={i}>{log}</div>)}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

    </main>
  );
}