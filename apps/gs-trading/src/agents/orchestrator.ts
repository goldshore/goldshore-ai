import type { KVNamespace } from '@cloudflare/workers-types';
import type { AgentState, AgentCommand, AgentMetrics } from './types';
import { DEFAULT_AGENTS } from './types';
import type { TradingSignal } from '../types';

const AGENTS_KEY = 'agents:state';
const SIGNALS_KEY = 'trading:signals';

export class AgentOrchestrator {
  constructor(private kv: KVNamespace) {}

  async getAgents(): Promise<AgentState[]> {
    const raw = await this.kv.get(AGENTS_KEY);
    if (!raw) {
      const initial = DEFAULT_AGENTS.map(a => ({
        ...a,
        lastRun: new Date().toISOString(),
        nextRun: new Date(Date.now() + 30_000).toISOString(),
      }));
      await this.kv.put(AGENTS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as AgentState[];
  }

  async getAgent(id: string): Promise<AgentState | null> {
    const agents = await this.getAgents();
    return agents.find(a => a.id === id) ?? null;
  }

  async updateAgent(id: string, updates: Partial<AgentState>): Promise<AgentState | null> {
    const agents = await this.getAgents();
    const idx = agents.findIndex(a => a.id === id);
    if (idx === -1) return null;
    agents[idx] = { ...agents[idx], ...updates };
    await this.kv.put(AGENTS_KEY, JSON.stringify(agents));
    return agents[idx];
  }

  async executeCommand(cmd: AgentCommand): Promise<AgentState | null> {
    const now = new Date().toISOString();
    switch (cmd.action) {
      case 'START':
        return this.updateAgent(cmd.agentId, { status: 'RUNNING', lastRun: now });
      case 'STOP':
        return this.updateAgent(cmd.agentId, { status: 'STOPPED' });
      case 'PAUSE':
        return this.updateAgent(cmd.agentId, { status: 'PAUSED' });
      case 'RESUME':
        return this.updateAgent(cmd.agentId, { status: 'RUNNING', lastRun: now });
      case 'CONFIG':
        return this.updateAgent(cmd.agentId, { config: cmd.config ?? {} });
      default:
        return null;
    }
  }

  async updateMetrics(id: string, metrics: Partial<AgentMetrics>): Promise<void> {
    const agent = await this.getAgent(id);
    if (!agent) return;
    await this.updateAgent(id, {
      metrics: { ...agent.metrics, ...metrics },
      runCount: agent.runCount + 1,
      lastRun: new Date().toISOString(),
    });
  }

  async getSignals(): Promise<TradingSignal[]> {
    const raw = await this.kv.get(SIGNALS_KEY);
    return raw ? (JSON.parse(raw) as TradingSignal[]) : [];
  }

  async addSignal(signal: TradingSignal): Promise<void> {
    const signals = await this.getSignals();
    const now = Date.now();
    const active = signals.filter(s => new Date(s.expiresAt).getTime() > now);
    active.unshift(signal);
    await this.kv.put(SIGNALS_KEY, JSON.stringify(active.slice(0, 100)));
  }

  async generateDemoSignals(): Promise<TradingSignal[]> {
    const symbols = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN'];
    const actions: TradingSignal['action'][] = ['BUY', 'SELL', 'HOLD'];
    const signals: TradingSignal[] = symbols.slice(0, 5).map((sym, i) => ({
      id: `sig-${Date.now()}-${i}`,
      symbol: sym,
      action: actions[i % 3],
      confidence: 0.6 + Math.random() * 0.39,
      targetPrice: 100 + Math.random() * 400,
      stopLoss: 90 + Math.random() * 300,
      reasoning: `Technical analysis indicates ${actions[i % 3]} signal based on RSI, MACD, and volume patterns.`,
      generatedBy: 'signal-agent',
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }));
    for (const s of signals) await this.addSignal(s);
    return signals;
  }
}
