export type AgentStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'STOPPED';

export interface AgentState {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  errorCount: number;
  lastError?: string;
  config: Record<string, unknown>;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  signalsGenerated?: number;
  ordersPlaced?: number;
  ordersRejected?: number;
  tradesWon?: number;
  tradesLost?: number;
  totalPL?: number;
  avgConfidence?: number;
}

export interface AgentCommand {
  agentId: string;
  action: 'START' | 'STOP' | 'PAUSE' | 'RESUME' | 'CONFIG';
  config?: Record<string, unknown>;
}

export const DEFAULT_AGENTS: Omit<AgentState, 'lastRun' | 'nextRun' | 'lastError'>[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    role: 'Coordinates all agents and enforces trading rules',
    status: 'RUNNING',
    runCount: 0,
    errorCount: 0,
    config: { interval: 30, maxConcurrentAgents: 4 },
    metrics: {},
  },
  {
    id: 'signal-agent',
    name: 'Signal Agent',
    role: 'Generates trading signals using technical analysis and AI',
    status: 'RUNNING',
    runCount: 0,
    errorCount: 0,
    config: { symbols: ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA'], confidenceThreshold: 0.7 },
    metrics: { signalsGenerated: 0, avgConfidence: 0 },
  },
  {
    id: 'risk-agent',
    name: 'Risk Manager',
    role: 'Enforces position limits, drawdown controls, and exposure rules',
    status: 'RUNNING',
    runCount: 0,
    errorCount: 0,
    config: { maxPositionSize: 0.05, maxDrawdown: 0.10, maxDailyLoss: 0.02 },
    metrics: { ordersRejected: 0 },
  },
  {
    id: 'execution-agent',
    name: 'Execution Agent',
    role: 'Routes and executes orders across Schwab and Robinhood',
    status: 'IDLE',
    runCount: 0,
    errorCount: 0,
    config: { preferredBroker: 'schwab', smartRouting: true, maxSlippage: 0.005 },
    metrics: { ordersPlaced: 0, tradesWon: 0, tradesLost: 0, totalPL: 0 },
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    role: 'Manages timed tasks: market open/close routines, rebalancing',
    status: 'RUNNING',
    runCount: 0,
    errorCount: 0,
    config: { timezone: 'America/New_York', marketOpenBuffer: 5, marketCloseBuffer: 15 },
    metrics: {},
  },
  {
    id: 'monitor',
    name: 'Monitor',
    role: 'Tracks agent health, position drift, and system alerts',
    status: 'RUNNING',
    runCount: 0,
    errorCount: 0,
    config: { alertThreshold: 'MEDIUM', healthCheckInterval: 60 },
    metrics: {},
  },
];
