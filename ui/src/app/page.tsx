"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Atom,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleStop,
  Database,
  Eye,
  FileSearch,
  Fingerprint,
  Gauge,
  GitBranch,
  Network,
  Orbit,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Telescope,
  TriangleAlert,
  UserCheck,
} from "lucide-react";

interface Agent {
  name: string;
  description: string;
  active?: boolean;
}

interface SystemStatus {
  status: string;
  version: string;
  name: string;
  agents: Agent[];
  tools: string[];
  providers: string[];
  plans: number;
  tasks: number;
  audit_chain_valid: boolean;
}

type NodeKind = "question" | "evidence" | "challenge" | "synthesis" | "control";

interface ConstellationNode {
  id: string;
  label: string;
  eyebrow: string;
  detail: string;
  boundary: string;
  kind: NodeKind;
  x: number;
  y: number;
  icon: typeof Search;
}

const CONSTELLATION_NODES: ConstellationNode[] = [
  {
    id: "question",
    label: "Research question",
    eyebrow: "Origin",
    detail: "The exact claim or uncertainty the expedition is allowed to investigate.",
    boundary: "Changing this question changes the plan; it never starts a model call by itself.",
    kind: "question",
    x: 50,
    y: 50,
    icon: Telescope,
  },
  {
    id: "sources",
    label: "Public evidence",
    eyebrow: "Observe",
    detail: "Primary literature, datasets, and publication records with source-level provenance.",
    boundary: "External search stays approval-gated; no account action or publication is implied.",
    kind: "evidence",
    x: 15,
    y: 24,
    icon: FileSearch,
  },
  {
    id: "memory",
    label: "Local corpus",
    eyebrow: "Recall",
    detail: "The project’s indexed papers and notes, kept separate from independent evidence.",
    boundary: "Reading is allowed; writing to memory requires explicit task approval.",
    kind: "evidence",
    x: 15,
    y: 76,
    icon: Database,
  },
  {
    id: "skeptic",
    label: "Skeptical pass",
    eyebrow: "Challenge",
    detail: "A deliberate attempt to falsify the leading interpretation and surface rival explanations.",
    boundary: "Disagreement is preserved in the result instead of averaged away.",
    kind: "challenge",
    x: 85,
    y: 24,
    icon: Scale,
  },
  {
    id: "synthesis",
    label: "Evidence map",
    eyebrow: "Synthesize",
    detail: "A claim-by-claim brief separating observations, inferences, disputes, and unknowns.",
    boundary: "Draft output remains local until the operator explicitly chooses otherwise.",
    kind: "synthesis",
    x: 85,
    y: 76,
    icon: Network,
  },
  {
    id: "audit",
    label: "Audit trail",
    eyebrow: "Verify",
    detail: "A tamper-evident sequence of task, tool, budget, and completion events.",
    boundary: "The interface reports chain validity; it does not claim scientific validity.",
    kind: "control",
    x: 50,
    y: 10,
    icon: Fingerprint,
  },
  {
    id: "operator",
    label: "Operator review",
    eyebrow: "Decide",
    detail: "The human checkpoint where evidence is reviewed and any next action is chosen.",
    boundary: "No unattended continuation, external message, push, or publication follows.",
    kind: "control",
    x: 50,
    y: 90,
    icon: UserCheck,
  },
];

const CONNECTIONS = [
  ["question", "sources"],
  ["question", "memory"],
  ["question", "skeptic"],
  ["question", "synthesis"],
  ["audit", "sources"],
  ["audit", "skeptic"],
  ["memory", "operator"],
  ["synthesis", "operator"],
  ["sources", "synthesis"],
  ["memory", "skeptic"],
] as const;

const CAPABILITY_CLASSES: Record<string, "Read only" | "Approval gated" | "Disabled"> = {
  memory_read: "Read only",
  memory_search: "Read only",
  pdf_reader: "Read only",
  filesystem: "Approval gated",
  memory_write: "Approval gated",
  git: "Approval gated",
  python_exec: "Approval gated",
  web_search: "Approval gated",
  eq_send_keys: "Disabled",
  eq_read_screen: "Disabled",
  eq_wait: "Disabled",
};

const PLAN_STEPS = [
  { label: "Frame a falsifiable question", icon: Atom },
  { label: "Separate local corpus from independent sources", icon: Archive },
  { label: "Extract claims and supporting observations", icon: BookOpen },
  { label: "Run a contradiction-first review", icon: GitBranch },
  { label: "Build an uncertainty-aware synthesis", icon: BrainCircuit },
  { label: "Stop for operator review", icon: CircleStop },
];

function formatTime(date: Date | null) {
  if (!date) return "Waiting for API";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function Observatory() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [question, setQuestion] = useState(
    "Which claims in A Theory of Everything are independently testable?",
  );
  const [selectedNode, setSelectedNode] = useState("question");
  const [maxIterations, setMaxIterations] = useState(4);
  const [maxTokens, setMaxTokens] = useState(2400);
  const [prepared, setPrepared] = useState(false);

  const fetchStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/v1/system/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = (await response.json()) as SystemStatus;
      setStatus(data);
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError("The local API is unreachable. The observatory remains in planning-only mode.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = window.setInterval(() => void fetchStatus(), 15000);
    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  const selected =
    CONSTELLATION_NODES.find((node) => node.id === selectedNode) ?? CONSTELLATION_NODES[0];

  const capabilityCounts = useMemo(() => {
    const counts = { "Read only": 0, "Approval gated": 0, Disabled: 0, Unclassified: 0 };
    for (const tool of status?.tools ?? []) {
      const capability = CAPABILITY_CLASSES[tool] ?? "Unclassified";
      counts[capability] += 1;
    }
    return counts;
  }, [status?.tools]);

  const prepareExpedition = () => {
    if (!question.trim()) return;
    setPrepared(true);
    setSelectedNode("question");
  };

  const nodeState = (node: ConstellationNode) => {
    if (node.id === "audit") return status?.audit_chain_valid ? "Chain verified" : "Verify chain";
    if (node.id === "operator") return "Required stop";
    if (node.kind === "challenge") return prepared ? "Queued in plan" : "Standby";
    if (node.kind === "synthesis") return prepared ? "Queued in plan" : "Standby";
    if (node.kind === "evidence") return "Approval aware";
    return prepared ? "Plan composed" : "Awaiting question";
  };

  return (
    <main className="observatory-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Orbit size={22} />
          </div>
          <div>
            <p className="overline">ZoraOS</p>
            <p className="brand-name">Observatory</p>
          </div>
        </div>

        <div className="topbar-status">
          <div className="live-state" aria-live="polite">
            <span className={`status-dot ${status ? "is-online" : "is-offline"}`} />
            <span>{status ? "Local system online" : "Local system offline"}</span>
            <span className="status-separator" aria-hidden="true" />
            <span className="quiet">Updated {formatTime(lastUpdated)}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => void fetchStatus()}
            aria-label="Refresh system state"
          >
            <RefreshCw size={17} className={refreshing ? "is-spinning" : ""} />
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> Bounded research, made visible</p>
          <h1>Make the unknown inspectable.</h1>
          <p>
            Compose a research expedition, see its evidence paths before compute is spent,
            and keep every uncertainty, permission, and stopping point in view.
          </p>
        </div>

        <div className="safety-envelope" aria-label="Live safety envelope">
          <div className="envelope-heading">
            <ShieldCheck size={19} />
            <span>Live safety envelope</span>
          </div>
          <div className="envelope-grid">
            <div>
              <span className="metric-value">{status?.tasks ?? "—"}</span>
              <span className="metric-label">tasks in this process</span>
            </div>
            <div>
              <span className="metric-value">{maxIterations}</span>
              <span className="metric-label">iteration ceiling</span>
            </div>
            <div>
              <span className="metric-value">
                {status?.audit_chain_valid ? <Check size={21} /> : <TriangleAlert size={21} />}
              </span>
              <span className="metric-label">audit chain</span>
            </div>
          </div>
          <div className="boundary-line">
            <Eye size={15} /> Plan-only until an operator explicitly launches a task
          </div>
        </div>
      </section>

      {error && (
        <div className="notice" role="status">
          <TriangleAlert size={17} />
          <span>{error}</span>
        </div>
      )}

      <section className="workspace-grid">
        <div className="primary-column">
          <section className="question-panel" aria-labelledby="question-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">01 / Frame</p>
                <h2 id="question-title">Tonight&apos;s question</h2>
              </div>
              <span className="mode-badge"><Eye size={13} /> Planning only</span>
            </div>

            <label className="question-field">
              <span className="sr-only">Research question</span>
              <textarea
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  setPrepared(false);
                }}
                rows={2}
              />
            </label>

            <div className="composer-controls">
              <label className="budget-control">
                <span><Gauge size={14} /> Iterations <strong>{maxIterations}</strong></span>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={maxIterations}
                  onChange={(event) => setMaxIterations(Number(event.target.value))}
                />
              </label>
              <label className="budget-control">
                <span><Activity size={14} /> Token ceiling <strong>{maxTokens.toLocaleString()}</strong></span>
                <input
                  type="range"
                  min="800"
                  max="4800"
                  step="400"
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(Number(event.target.value))}
                />
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={prepareExpedition}
                disabled={!question.trim()}
              >
                <Sparkles size={16} />
                Compose expedition
              </button>
            </div>
            <p className="microcopy">Composing changes this view only. It does not call a model or execute a tool.</p>
          </section>

          <section className={`constellation-panel ${prepared ? "is-prepared" : ""}`} aria-labelledby="map-title">
            <div className="section-heading map-heading">
              <div>
                <p className="section-kicker">02 / Inspect</p>
                <h2 id="map-title">Expedition constellation</h2>
              </div>
              <div className="legend" aria-label="Node legend">
                <span><i className="legend-dot evidence" /> Evidence</span>
                <span><i className="legend-dot challenge" /> Challenge</span>
                <span><i className="legend-dot control" /> Control</span>
              </div>
            </div>

            <div className="constellation" aria-label="Selectable research expedition map">
              <svg className="connection-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {CONNECTIONS.map(([fromId, toId]) => {
                  const from = CONSTELLATION_NODES.find((node) => node.id === fromId)!;
                  const to = CONSTELLATION_NODES.find((node) => node.id === toId)!;
                  return (
                    <line
                      key={`${fromId}-${toId}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                    />
                  );
                })}
              </svg>

              {CONSTELLATION_NODES.map((node) => {
                const Icon = node.icon;
                const style = { "--node-x": `${node.x}%`, "--node-y": `${node.y}%` } as CSSProperties;
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`constellation-node node-${node.kind} ${selectedNode === node.id ? "is-selected" : ""}`}
                    style={style}
                    onClick={() => setSelectedNode(node.id)}
                    aria-pressed={selectedNode === node.id}
                  >
                    <span className="node-icon"><Icon size={17} /></span>
                    <span className="node-copy">
                      <small>{node.eyebrow}</small>
                      <strong>{node.label}</strong>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="selected-detail" aria-live="polite">
              <div className={`detail-symbol detail-${selected.kind}`}>
                <selected.icon size={18} />
              </div>
              <div className="detail-copy">
                <div className="detail-title-row">
                  <h3>{selected.label}</h3>
                  <span>{nodeState(selected)}</span>
                </div>
                <p>{selected.id === "question" ? question : selected.detail}</p>
                <small><ShieldCheck size={12} /> {selected.boundary}</small>
              </div>
            </div>
          </section>

          {prepared && (
            <section className="plan-strip" aria-labelledby="plan-title">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">03 / Stage</p>
                  <h2 id="plan-title">Bounded expedition plan</h2>
                </div>
                <span className="mode-badge">{maxIterations} iterations · {maxTokens.toLocaleString()} tokens</span>
              </div>
              <ol className="plan-steps">
                {PLAN_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.label}>
                      <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="step-icon"><Icon size={15} /></span>
                      <span>{step.label}</span>
                      {index < PLAN_STEPS.length - 1 && <ChevronRight size={14} aria-hidden="true" />}
                    </li>
                  );
                })}
              </ol>
              <div className="launch-boundary">
                <CircleStop size={16} />
                <span><strong>Deliberate stop.</strong> Review the plan before any compute or external search.</span>
              </div>
            </section>
          )}
        </div>

        <aside className="secondary-column" aria-label="Live system state">
          <section className="side-panel">
            <div className="side-heading">
              <div>
                <p className="section-kicker">Live system</p>
                <h2>Compute &amp; governance</h2>
              </div>
              <span className={`status-dot ${status ? "is-online" : "is-offline"}`} />
            </div>

            <div className="provider-row">
              <span>Available providers</span>
              <div>
                {(status?.providers ?? []).map((provider) => (
                  <span className="provider-chip" key={provider}>{provider}</span>
                ))}
                {!status && <span className="quiet">Unavailable</span>}
              </div>
            </div>

            <div className="capability-list">
              <CapabilityRow label="Read only" value={capabilityCounts["Read only"]} state="safe" />
              <CapabilityRow label="Approval gated" value={capabilityCounts["Approval gated"]} state="gated" />
              <CapabilityRow label="Disabled" value={capabilityCounts.Disabled} state="blocked" />
              {capabilityCounts.Unclassified > 0 && (
                <CapabilityRow label="Default denied" value={capabilityCounts.Unclassified} state="blocked" />
              )}
            </div>
          </section>

          <section className="side-panel">
            <div className="side-heading">
              <div>
                <p className="section-kicker">Agent roster</p>
                <h2>{status?.agents.length ?? 0} bounded roles</h2>
              </div>
              <BrainCircuit size={18} />
            </div>
            <div className="agent-list">
              {(status?.agents ?? []).map((agent) => (
                <div className="agent-row" key={agent.name}>
                  <span className="agent-monogram">{agent.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{agent.name}</strong>
                    <span>{agent.description}</span>
                  </div>
                </div>
              ))}
              {!status && <p className="empty-state">Agent registry unavailable.</p>}
            </div>
          </section>

          <section className="side-panel integrity-panel">
            <div className="integrity-orbit" aria-hidden="true">
              <span />
              <Fingerprint size={23} />
            </div>
            <div>
              <p className="section-kicker">Integrity</p>
              <h2>{status?.audit_chain_valid ? "Audit chain verified" : "Awaiting verification"}</h2>
              <p>Runtime integrity is visible. Scientific conclusions still require independent evidence.</p>
            </div>
          </section>
        </aside>
      </section>

      <footer className="footer">
        <span>ZoraOS Observatory · local prototype v{status?.version ?? "0.1.0"}</span>
        <span><ShieldCheck size={13} /> Nothing runs merely because this page is open.</span>
      </footer>
    </main>
  );
}

function CapabilityRow({
  label,
  value,
  state,
}: {
  label: string;
  value: number;
  state: "safe" | "gated" | "blocked";
}) {
  return (
    <div className="capability-row">
      <span className={`capability-mark is-${state}`} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
