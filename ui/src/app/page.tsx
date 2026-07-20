"use client";

import { useEffect, useState } from "react";

interface HealthStatus {
  status: string;
  version: string;
  name: string;
}

interface Agent {
  name: string;
  active?: boolean;
}

export default function Dashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const [healthRes, agentRes, toolRes] = await Promise.all([
          fetch("/api/v1/health"),
          fetch("/api/v1/agents"),
          fetch("/api/v1/tools"),
        ]);
        const healthData = await healthRes.json();
        const agentData = await agentRes.json();
        const toolData = await toolRes.json();
        setHealth(healthData);
        setAgents(agentData.agents || []);
        setTools(toolData.tools || []);
      } catch (e) {
        setError("Could not connect to ZoraOS API. Make sure the server is running on port 8000.");
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zora-400">ZoraOS</h1>
        <p className="text-gray-400 mt-1">Local-first AI operating system</p>
      </header>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatusCard title="System" value={health?.status || "..."} subtitle={`v${health?.version || "?"}`} />
        <StatusCard title="Agents" value={String(agents.length)} subtitle="registered" />
        <StatusCard title="Tools" value={String(tools.length)} subtitle="available" />
        <StatusCard title="Status" value={health ? "Online" : "Offline"} subtitle={health?.name || ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4 text-zora-300">Agents</h2>
          {agents.length === 0 ? (
            <p className="text-gray-500">No agents registered</p>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.name} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                  <span className="text-gray-200">{agent.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${agent.active ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}`}>
                    {agent.active ? "Active" : "Registered"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4 text-zora-300">Tools</h2>
          {tools.length === 0 ? (
            <p className="text-gray-500">No tools registered</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tools.map((tool) => (
                <span key={tool} className="bg-gray-800 text-gray-300 px-3 py-1 rounded text-sm border border-gray-700">
                  {tool}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-semibold mb-4 text-zora-300">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionButton label="Research" description="Search papers" />
          <ActionButton label="Code" description="Write software" />
          <ActionButton label="Write" description="Draft documents" />
          <ActionButton label="Memory" description="Query knowledge" />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="text-gray-400 text-sm">{title}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      <div className="text-gray-500 text-xs mt-1">{subtitle}</div>
    </div>
  );
}

function ActionButton({ label, description }: { label: string; description: string }) {
  return (
    <button className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-3 text-left transition-colors">
      <div className="text-zora-300 font-medium">{label}</div>
      <div className="text-gray-500 text-xs mt-1">{description}</div>
    </button>
  );
}
