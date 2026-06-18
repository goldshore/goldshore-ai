export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GoldShore Trading — Multi-Agent Dashboard</title>
<script src="https://cdn.tailwindcss.com/3.4.17"></script>
<script src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.10/dist/cdn.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<style>
  [x-cloak]{display:none!important}
  body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif}
  ::-webkit-scrollbar{width:6px;height:6px}
  ::-webkit-scrollbar-track{background:#1e293b}
  ::-webkit-scrollbar-thumb{background:#475569;border-radius:3px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:10px}
  .badge-running{background:#065f46;color:#6ee7b7}
  .badge-idle{background:#1e3a5f;color:#93c5fd}
  .badge-paused{background:#451a03;color:#fcd34d}
  .badge-error{background:#450a0a;color:#fca5a5}
  .badge-stopped{background:#1f2937;color:#9ca3af}
  .tab-active{border-bottom:2px solid #8b5cf6;color:#a78bfa}
  .broker-schwab{color:#3b82f6}
  .broker-robinhood{color:#22c55e}
  .positive{color:#34d399}
  .negative{color:#f87171}
  input,select{background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:6px 10px}
  input:focus,select:focus{outline:1px solid #8b5cf6}
  button.primary{background:#7c3aed;color:#fff;border-radius:6px;padding:6px 14px;font-weight:600}
  button.primary:hover{background:#6d28d9}
  button.danger{background:#991b1b;color:#fff;border-radius:6px;padding:4px 10px;font-size:0.75rem}
  button.danger:hover{background:#7f1d1d}
  button.ghost{background:transparent;border:1px solid #475569;color:#94a3b8;border-radius:6px;padding:4px 10px;font-size:0.75rem}
  button.ghost:hover{border-color:#8b5cf6;color:#a78bfa}
  .pulse{animation:pulse 2s cubic-bezier(0.4,0,0.6,1) infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
</style>
</head>
<body x-data="tradingDash()" x-init="init()">

<!-- Sidebar -->
<div class="flex h-screen overflow-hidden">
  <aside class="w-56 flex-shrink-0 flex flex-col" style="background:#0f172a;border-right:1px solid #1e293b">
    <div class="p-4 border-b" style="border-color:#1e293b">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#7c3aed,#2563eb)">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
        </div>
        <div>
          <div class="text-sm font-bold text-white">GoldShore</div>
          <div class="text-xs" style="color:#64748b">Trading Platform</div>
        </div>
      </div>
    </div>
    <nav class="flex-1 p-3 space-y-1">
      <template x-for="item in nav" :key="item.id">
        <button @click="tab=item.id" class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
          :class="tab===item.id ? 'text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'"
          :style="tab===item.id ? 'background:rgba(124,58,237,0.2)' : ''">
          <span x-html="item.icon" class="w-4 h-4 flex-shrink-0"></span>
          <span x-text="item.label"></span>
        </button>
      </template>
    </nav>
    <div class="p-3 border-t" style="border-color:#1e293b">
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <div class="w-2 h-2 rounded-full pulse" :class="isMarketOpen ? 'bg-green-400' : 'bg-red-400'"></div>
        <span x-text="isMarketOpen ? 'Market Open' : 'Market Closed'"></span>
      </div>
      <div class="text-xs text-slate-600 mt-1" x-text="currentTime"></div>
    </div>
  </aside>

  <!-- Main -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-3" style="background:#0f172a;border-bottom:1px solid #1e293b">
      <div class="flex items-center gap-4">
        <h1 class="text-lg font-semibold text-white" x-text="nav.find(n=>n.id===tab)?.label || 'Dashboard'"></h1>
        <div class="flex gap-2">
          <span class="text-xs px-2 py-0.5 rounded-full" style="background:#1e293b;color:#8b5cf6">MCP v2</span>
          <span class="text-xs px-2 py-0.5 rounded-full" style="background:#1e293b;color:#22c55e">Schwab</span>
          <span class="text-xs px-2 py-0.5 rounded-full" style="background:#1e293b;color:#f59e0b">Robinhood</span>
          <span x-show="demoMode" class="text-xs px-2 py-0.5 rounded-full" style="background:#451a03;color:#fcd34d">DEMO</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button @click="refresh()" class="ghost text-xs">&#8635; Refresh</button>
        <div class="text-sm" style="color:#64748b" x-text="lastUpdated ? 'Updated ' + lastUpdated : 'Loading...'"></div>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 overflow-auto p-6">

      <!-- OVERVIEW TAB -->
      <div x-show="tab==='overview'" x-cloak>
        <!-- Demo banner -->
        <div x-show="demoMode" class="mb-4 p-3 rounded-lg text-sm" style="background:#451a03;color:#fcd34d;border:1px solid #92400e">
          Demo mode — connect Schwab or Robinhood credentials to see live data
        </div>
        <!-- Summary Cards -->
        <div class="grid grid-cols-4 gap-4 mb-6">
          <template x-for="card in summaryCards" :key="card.label">
            <div class="card p-4">
              <div class="text-xs mb-2" style="color:#64748b" x-text="card.label"></div>
              <div class="text-2xl font-bold" :class="card.colorClass" x-text="card.value"></div>
              <div class="text-xs mt-1" :class="card.change >= 0 ? 'positive' : 'negative'" x-show="card.change !== undefined">
                <span x-text="card.change >= 0 ? '▲' : '▼'"></span>
                <span x-text="Math.abs(card.change).toFixed(2) + '%'"></span>
              </div>
            </div>
          </template>
        </div>
        <!-- Charts Row -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="card p-4 col-span-2">
            <div class="flex items-center justify-between mb-3">
              <div class="text-sm font-medium" x-text="demoMode ? 'Portfolio Value (30d demo)' : 'Portfolio Value by Broker'"></div>
              <span x-show="demoMode" class="text-xs text-amber-500">sample data</span>
            </div>
            <canvas id="portfolioChart" height="140"></canvas>
          </div>
          <div class="card p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="text-sm font-medium">Allocation by Broker</div>
              <span x-show="demoMode" class="text-xs text-amber-500">sample</span>
            </div>
            <canvas id="allocationChart" height="140"></canvas>
          </div>
        </div>
        <!-- Positions preview -->
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="text-sm font-medium">Open Positions</div>
            <button @click="tab='positions'" class="ghost text-xs">View All</button>
          </div>
          <table class="w-full text-sm">
            <thead><tr class="text-xs border-b" style="color:#64748b;border-color:#334155">
              <th class="text-left pb-2">Symbol</th><th class="text-left pb-2">Broker</th>
              <th class="text-right pb-2">Qty</th><th class="text-right pb-2">Avg Cost</th>
              <th class="text-right pb-2">Last</th><th class="text-right pb-2">Mkt Value</th>
              <th class="text-right pb-2">P&L</th><th class="text-right pb-2">P&L%</th>
            </tr></thead>
            <tbody>
              <template x-for="p in positions.slice(0,5)" :key="p.symbol+p.broker">
                <tr class="border-b text-sm" style="border-color:#1e293b">
                  <td class="py-2 font-medium" x-text="p.symbol"></td>
                  <td class="py-2"><span class="text-xs" :class="'broker-'+p.broker" x-text="p.broker"></span></td>
                  <td class="py-2 text-right" x-text="p.quantity"></td>
                  <td class="py-2 text-right" x-text="fmt(p.avgCost)"></td>
                  <td class="py-2 text-right" x-text="fmt(p.currentPrice)"></td>
                  <td class="py-2 text-right" x-text="fmt(p.marketValue)"></td>
                  <td class="py-2 text-right" :class="p.unrealizedPL>=0?'positive':'negative'" x-text="fmtPL(p.unrealizedPL)"></td>
                  <td class="py-2 text-right" :class="p.unrealizedPLPct>=0?'positive':'negative'" x-text="p.unrealizedPLPct.toFixed(2)+'%'"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- POSITIONS TAB -->
      <div x-show="tab==='positions'" x-cloak>
        <div class="flex items-center gap-3 mb-4">
          <select x-model="posBrokerFilter" class="text-sm">
            <option value="">All Brokers</option>
            <option value="schwab">Schwab / ThinkorSwim</option>
            <option value="robinhood">Robinhood</option>
          </select>
          <select x-model="posTypeFilter" class="text-sm">
            <option value="">All Types</option>
            <option value="EQUITY">Equity</option>
            <option value="ETF">ETF</option>
            <option value="OPTION">Options</option>
          </select>
        </div>
        <div class="card">
          <table class="w-full text-sm">
            <thead><tr class="text-xs border-b" style="color:#64748b;border-color:#334155">
              <th class="text-left p-3">Symbol</th><th class="text-left p-3">Broker</th><th class="text-left p-3">Type</th>
              <th class="text-right p-3">Qty</th><th class="text-right p-3">Avg Cost</th>
              <th class="text-right p-3">Current</th><th class="text-right p-3">Mkt Value</th>
              <th class="text-right p-3">Unrealized P&L</th><th class="text-right p-3">Return%</th>
            </tr></thead>
            <tbody>
              <template x-for="p in filteredPositions" :key="p.symbol+p.broker">
                <tr class="border-b hover:bg-slate-800/30 transition-colors" style="border-color:#1e293b">
                  <td class="p-3 font-semibold" x-text="p.symbol"></td>
                  <td class="p-3"><span class="text-xs px-2 py-0.5 rounded" :class="p.broker==='schwab' ? 'bg-blue-900/40 text-blue-400' : 'bg-green-900/40 text-green-400'" x-text="p.broker==='schwab' ? 'Schwab' : 'Robinhood'"></span></td>
                  <td class="p-3 text-xs text-slate-400" x-text="p.assetType"></td>
                  <td class="p-3 text-right" x-text="p.quantity"></td>
                  <td class="p-3 text-right" x-text="fmt(p.avgCost)"></td>
                  <td class="p-3 text-right" x-text="fmt(p.currentPrice)"></td>
                  <td class="p-3 text-right font-medium" x-text="fmt(p.marketValue)"></td>
                  <td class="p-3 text-right font-medium" :class="p.unrealizedPL>=0?'positive':'negative'" x-text="fmtPL(p.unrealizedPL)"></td>
                  <td class="p-3 text-right" :class="p.unrealizedPLPct>=0?'positive':'negative'" x-text="p.unrealizedPLPct.toFixed(2)+'%'"></td>
                </tr>
              </template>
              <tr x-show="filteredPositions.length===0"><td colspan="9" class="p-6 text-center text-slate-500">No positions found</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ORDERS TAB -->
      <div x-show="tab==='orders'" x-cloak>
        <div class="grid grid-cols-2 gap-6">
          <!-- Place Order -->
          <div class="card p-5">
            <div class="text-sm font-semibold mb-4">Place Order</div>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <div><label class="text-xs text-slate-400 block mb-1">Broker</label>
                  <select x-model="newOrder.broker" class="w-full text-sm">
                    <option value="schwab">Schwab / TOS</option>
                    <option value="robinhood">Robinhood</option>
                  </select></div>
                <div><label class="text-xs text-slate-400 block mb-1">Symbol</label>
                  <input x-model="newOrder.symbol" placeholder="AAPL" class="w-full text-sm uppercase" /></div>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div><label class="text-xs text-slate-400 block mb-1">Side</label>
                  <select x-model="newOrder.side" class="w-full text-sm">
                    <option value="BUY">BUY</option><option value="SELL">SELL</option>
                  </select></div>
                <div><label class="text-xs text-slate-400 block mb-1">Type</label>
                  <select x-model="newOrder.orderType" class="w-full text-sm">
                    <option value="MARKET">MARKET</option><option value="LIMIT">LIMIT</option>
                  </select></div>
                <div><label class="text-xs text-slate-400 block mb-1">Qty</label>
                  <input type="number" x-model="newOrder.quantity" placeholder="100" class="w-full text-sm" /></div>
              </div>
              <div x-show="newOrder.orderType==='LIMIT'">
                <label class="text-xs text-slate-400 block mb-1">Limit Price</label>
                <input type="number" x-model="newOrder.limitPrice" placeholder="0.00" class="w-full text-sm" step="0.01" />
              </div>
              <div x-show="orderMessage" class="text-xs p-2 rounded" :class="orderError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'" x-text="orderMessage"></div>
              <button @click="placeOrder()" class="primary w-full" :disabled="placingOrder">
                <span x-show="!placingOrder">Place Order</span>
                <span x-show="placingOrder">Placing...</span>
              </button>
            </div>
          </div>
          <!-- Open Orders -->
          <div class="card p-5">
            <div class="text-sm font-semibold mb-4">Open Orders</div>
            <div class="space-y-2">
              <template x-for="o in openOrders" :key="o.id">
                <div class="flex items-center justify-between p-2 rounded" style="background:#0f172a">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-sm" x-text="o.symbol"></span>
                      <span class="text-xs" :class="o.side==='BUY'?'text-green-400':'text-red-400'" x-text="o.side"></span>
                      <span class="text-xs text-slate-400" x-text="o.quantity + ' @ ' + o.orderType"></span>
                    </div>
                    <div class="text-xs text-slate-500 mt-0.5" x-text="o.broker + (o.limitPrice ? ' · $' + o.limitPrice : '')"></div>
                  </div>
                  <button @click="cancelOrder(o)" class="danger">Cancel</button>
                </div>
              </template>
              <div x-show="openOrders.length===0" class="text-sm text-slate-500 text-center py-4">No open orders</div>
            </div>
          </div>
        </div>
        <!-- Order History -->
        <div class="card mt-6">
          <div class="text-sm font-semibold p-4 border-b" style="border-color:#334155">Order History</div>
          <table class="w-full text-sm">
            <thead><tr class="text-xs border-b" style="color:#64748b;border-color:#334155">
              <th class="text-left p-3">Symbol</th><th class="text-left p-3">Broker</th>
              <th class="text-left p-3">Side</th><th class="text-left p-3">Type</th>
              <th class="text-right p-3">Qty</th><th class="text-right p-3">Fill Price</th>
              <th class="text-left p-3">Status</th><th class="text-left p-3">Time</th>
            </tr></thead>
            <tbody>
              <template x-for="o in orders" :key="o.id">
                <tr class="border-b hover:bg-slate-800/20" style="border-color:#1e293b">
                  <td class="p-3 font-medium" x-text="o.symbol"></td>
                  <td class="p-3 text-xs text-slate-400" x-text="o.broker"></td>
                  <td class="p-3 text-xs" :class="o.side==='BUY'?'text-green-400':'text-red-400'" x-text="o.side"></td>
                  <td class="p-3 text-xs text-slate-400" x-text="o.orderType"></td>
                  <td class="p-3 text-right" x-text="o.quantity"></td>
                  <td class="p-3 text-right" x-text="o.filledPrice ? fmt(o.filledPrice) : '—'"></td>
                  <td class="p-3">
                    <span class="text-xs px-2 py-0.5 rounded"
                      :class="{FILLED:'bg-green-900/40 text-green-400',OPEN:'bg-blue-900/40 text-blue-400',CANCELLED:'bg-slate-700 text-slate-400',REJECTED:'bg-red-900/40 text-red-400',PENDING:'bg-yellow-900/40 text-yellow-400'}[o.status]"
                      x-text="o.status"></span>
                  </td>
                  <td class="p-3 text-xs text-slate-500" x-text="fmtTime(o.placedAt)"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- AGENTS TAB -->
      <div x-show="tab==='agents'" x-cloak>
        <div class="grid grid-cols-3 gap-4 mb-6">
          <template x-for="a in agents" :key="a.id">
            <div class="card p-4">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <div class="font-semibold text-sm" x-text="a.name"></div>
                  <div class="text-xs text-slate-500 mt-0.5" x-text="a.role"></div>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="'badge-'+a.status.toLowerCase()" x-text="a.status"></span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-3">
                <div>Runs: <span class="text-white" x-text="a.runCount"></span></div>
                <div>Errors: <span :class="a.errorCount>0?'text-red-400':'text-white'" x-text="a.errorCount"></span></div>
                <div x-show="a.metrics.signalsGenerated !== undefined">Signals: <span class="text-white" x-text="a.metrics.signalsGenerated ?? 0"></span></div>
                <div x-show="a.metrics.ordersPlaced !== undefined">Orders: <span class="text-white" x-text="a.metrics.ordersPlaced ?? 0"></span></div>
              </div>
              <div class="flex gap-2">
                <button x-show="a.status!=='RUNNING'" @click="agentCmd(a.id,'START')" class="ghost text-xs flex-1">Start</button>
                <button x-show="a.status==='RUNNING'" @click="agentCmd(a.id,'PAUSE')" class="ghost text-xs flex-1">Pause</button>
                <button x-show="a.status==='RUNNING' || a.status==='PAUSED'" @click="agentCmd(a.id,'STOP')" class="danger text-xs flex-1">Stop</button>
                <button x-show="a.status==='PAUSED'" @click="agentCmd(a.id,'RESUME')" class="ghost text-xs flex-1">Resume</button>
              </div>
              <div x-show="a.lastError" class="text-xs text-red-400 mt-2" x-text="a.lastError"></div>
            </div>
          </template>
        </div>
        <!-- Agent config panel -->
        <div class="card p-4">
          <div class="text-sm font-semibold mb-3">MCP Orchestration Log</div>
          <div class="font-mono text-xs space-y-1" style="color:#94a3b8;max-height:200px;overflow-y:auto">
            <template x-for="(log, i) in agentLogs" :key="i">
              <div class="flex gap-3">
                <span style="color:#475569" x-text="log.time"></span>
                <span :class="log.level==='ERROR'?'text-red-400':log.level==='WARN'?'text-yellow-400':'text-slate-400'" x-text="'['+log.level+']'"></span>
                <span x-text="log.msg"></span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- SIGNALS TAB -->
      <div x-show="tab==='signals'" x-cloak>
        <div class="flex items-center justify-between mb-4">
          <div class="text-sm text-slate-400">AI-generated trading signals from the Signal Agent</div>
          <button @click="generateSignals()" class="primary text-sm">Generate Signals</button>
        </div>
        <div class="space-y-3">
          <template x-for="s in signals" :key="s.id">
            <div class="card p-4 flex items-start gap-4">
              <div class="flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center"
                :class="s.action==='BUY'?'bg-green-900/50':s.action==='SELL'?'bg-red-900/50':'bg-slate-700/50'">
                <div class="font-bold text-lg" :class="s.action==='BUY'?'text-green-400':s.action==='SELL'?'text-red-400':'text-slate-400'" x-text="s.action==='BUY'?'↑':s.action==='SELL'?'↓':'→'"></div>
                <div class="text-xs font-medium" :class="s.action==='BUY'?'text-green-400':s.action==='SELL'?'text-red-400':'text-slate-400'" x-text="s.action"></div>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-1">
                  <span class="font-bold" x-text="s.symbol"></span>
                  <span class="text-xs text-slate-400" x-text="'Confidence: ' + (s.confidence*100).toFixed(0)+'%'"></span>
                  <div class="flex-1 h-1.5 rounded-full" style="background:#1e293b">
                    <div class="h-full rounded-full" :style="'width:'+s.confidence*100+'%;background:'+(s.confidence>0.8?'#22c55e':s.confidence>0.6?'#eab308':'#f87171')"></div>
                  </div>
                </div>
                <div class="text-xs text-slate-400" x-text="s.reasoning"></div>
                <div class="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span x-show="s.targetPrice">Target: <span class="text-slate-300" x-text="fmt(s.targetPrice)"></span></span>
                  <span x-show="s.stopLoss">Stop: <span class="text-slate-300" x-text="fmt(s.stopLoss)"></span></span>
                  <span x-text="'by ' + s.generatedBy"></span>
                  <span x-text="'expires ' + fmtTime(s.expiresAt)"></span>
                </div>
              </div>
              <button @click="actOnSignal(s)" class="primary text-xs flex-shrink-0">
                <span x-text="s.action==='HOLD' ? 'Review' : 'Execute'"></span>
              </button>
            </div>
          </template>
          <div x-show="signals.length===0" class="card p-8 text-center text-slate-500">No signals yet. Click Generate Signals.</div>
        </div>
      </div>

      <!-- PAPER TRADING TAB -->
      <div x-show="tab==='paper'" x-cloak>
        <!-- Three-state panel header -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <!-- LIVE BROKER DATA -->
          <div class="card p-4" style="border-color:#3b82f6">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-2 h-2 rounded-full bg-green-400 pulse"></div>
              <div class="text-sm font-semibold text-blue-400">LIVE BROKER DATA</div>
            </div>
            <div class="space-y-1 text-xs text-slate-400">
              <template x-for="a in accounts" :key="a.broker+a.accountId">
                <div class="flex justify-between">
                  <span class="capitalize" x-text="a.broker"></span>
                  <span class="text-white font-mono" x-text="fmt(a.totalValue)"></span>
                </div>
              </template>
              <div x-show="accounts.length===0" class="text-slate-500">No brokers connected</div>
            </div>
          </div>
          <!-- PAPER SIMULATION -->
          <div class="card p-4" style="border-color:#6366f1">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-2 h-2 rounded-full bg-blue-400"></div>
              <div class="text-sm font-semibold text-indigo-400">PAPER SIMULATION</div>
            </div>
            <div class="space-y-1 text-xs text-slate-400">
              <div class="flex justify-between">
                <span>Cash Balance</span>
                <span class="text-white font-mono" x-text="paperPortfolio ? fmt(paperPortfolio.cash) : '—'"></span>
              </div>
              <div class="flex justify-between">
                <span>Total Equity</span>
                <span class="text-white font-mono" x-text="paperPortfolio ? fmt(paperPortfolio.totalEquity) : '—'"></span>
              </div>
              <div class="flex justify-between">
                <span>Unrealized P&amp;L</span>
                <span :class="(paperPortfolio?.unrealizedPnL??0)>=0?'positive':'negative'" x-text="paperPortfolio ? fmtPL(paperPortfolio.unrealizedPnL) : '—'"></span>
              </div>
              <div class="flex justify-between">
                <span>Positions</span>
                <span class="text-white" x-text="(paperPortfolio?.positions?.length ?? 0) + ' open'"></span>
              </div>
            </div>
          </div>
          <!-- AGENTIC ACCOUNT -->
          <div class="card p-4" style="border-color:#f59e0b">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-2 h-2 rounded-full bg-yellow-400"></div>
              <div class="text-sm font-semibold text-yellow-400">AGENTIC ACCOUNT</div>
            </div>
            <div class="space-y-1 text-xs text-slate-400">
              <div class="flex justify-between">
                <span>Pending Approvals</span>
                <span class="text-yellow-400 font-bold" x-text="agentRecs.length"></span>
              </div>
              <div class="flex justify-between">
                <span>Agents Running</span>
                <span class="text-white" x-text="agents.filter(a=>a.status==='RUNNING').length"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Paper order entry + positions -->
        <div class="grid grid-cols-2 gap-6 mb-6">
          <!-- Paper Order Entry -->
          <div class="card p-5">
            <div class="text-sm font-semibold mb-4" style="color:#a78bfa">Paper Order Entry</div>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <div><label class="text-xs text-slate-400 block mb-1">Symbol</label>
                  <input x-model="paperOrder.symbol" placeholder="AAPL" class="w-full text-sm uppercase" /></div>
                <div><label class="text-xs text-slate-400 block mb-1">Side</label>
                  <select x-model="paperOrder.side" class="w-full text-sm">
                    <option value="buy">BUY</option><option value="sell">SELL</option>
                  </select></div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div><label class="text-xs text-slate-400 block mb-1">Type</label>
                  <select x-model="paperOrder.order_type" class="w-full text-sm">
                    <option value="market">MARKET</option>
                    <option value="limit">LIMIT</option>
                    <option value="stop">STOP</option>
                  </select></div>
                <div><label class="text-xs text-slate-400 block mb-1">Qty</label>
                  <input type="number" x-model="paperOrder.quantity" placeholder="10" class="w-full text-sm" /></div>
              </div>
              <div x-show="paperOrder.order_type!=='market'">
                <label class="text-xs text-slate-400 block mb-1">Price</label>
                <input type="number" x-model="paperOrder.limit_price" placeholder="0.00" class="w-full text-sm" step="0.01" />
              </div>
              <div x-show="paperOrderMsg" class="text-xs p-2 rounded" :class="paperOrderErr?'bg-red-900/30 text-red-400':'bg-green-900/30 text-green-400'" x-text="paperOrderMsg"></div>
              <button @click="placePaperOrder()" class="primary w-full" :disabled="paperPlacing">
                <span x-show="!paperPlacing">Submit Paper Order</span>
                <span x-show="paperPlacing">Submitting...</span>
              </button>
            </div>
          </div>

          <!-- Paper Positions -->
          <div class="card p-5">
            <div class="text-sm font-semibold mb-3" style="color:#a78bfa">Paper Positions</div>
            <div class="space-y-2 text-sm">
              <template x-for="p in (paperPortfolio?.positions ?? [])" :key="p.id">
                <div class="flex items-center justify-between p-2 rounded" style="background:#0f172a">
                  <div>
                    <span class="font-semibold" x-text="p.symbol"></span>
                    <span class="text-xs text-slate-400 ml-2" x-text="p.quantity + ' shares @ ' + fmt(p.avg_cost)"></span>
                  </div>
                  <span class="text-xs text-indigo-400 uppercase" x-text="p.side"></span>
                </div>
              </template>
              <div x-show="(paperPortfolio?.positions?.length ?? 0)===0" class="text-slate-500 text-xs text-center py-3">No open paper positions</div>
            </div>
          </div>
        </div>

        <!-- Agent Recommendations (Human in the Loop) -->
        <div class="card p-5 mb-6">
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm font-semibold text-yellow-400">Agent Recommendations — Pending Approval</div>
            <button @click="loadAgentRecs()" class="ghost text-xs">Refresh</button>
          </div>
          <div class="space-y-3">
            <template x-for="rec in agentRecs" :key="rec.id">
              <div class="flex items-start gap-4 p-3 rounded" style="background:#0f172a;border:1px solid #334155">
                <div class="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center"
                  :class="rec.action==='buy'?'bg-green-900/50':rec.action==='sell'?'bg-red-900/50':'bg-slate-700/50'">
                  <div class="text-lg font-bold" :class="rec.action==='buy'?'text-green-400':rec.action==='sell'?'text-red-400':'text-slate-400'"
                    x-text="rec.action==='buy'?'↑':rec.action==='sell'?'↓':'→'"></div>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-sm" x-text="rec.symbol"></span>
                    <span class="text-xs text-slate-400 uppercase" x-text="rec.action"></span>
                    <span x-show="rec.quantity" class="text-xs text-slate-500" x-text="'× ' + rec.quantity"></span>
                    <span x-show="rec.confidence" class="text-xs text-slate-400" x-text="'(' + (rec.confidence*100).toFixed(0)+'% confidence)'"></span>
                  </div>
                  <div class="text-xs text-slate-400" x-text="rec.rationale || 'No rationale provided'"></div>
                  <div class="text-xs text-slate-600 mt-1" x-text="'Agent: ' + rec.agent + ' · Expires: ' + fmtTime(new Date(rec.expires_at).toISOString())"></div>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                  <button @click="approveRec(rec.id)" class="primary text-xs">Approve</button>
                  <button @click="rejectRec(rec.id)" class="danger text-xs">Reject</button>
                </div>
              </div>
            </template>
            <div x-show="agentRecs.length===0" class="text-slate-500 text-sm text-center py-4">No pending agent recommendations</div>
          </div>
        </div>

        <!-- Paper P&L Equity Curve -->
        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="text-sm font-semibold" style="color:#a78bfa">Paper Trading Equity Curve (30d)</div>
            <div class="text-xs text-slate-400" x-text="paperPnL ? 'Total Realized: ' + fmtPL(paperPnL.total?.realized) : ''"></div>
          </div>
          <canvas id="paperEquityChart" height="120"></canvas>
        </div>
      </div>

      <!-- RISK TAB -->
      <div x-show="tab==='risk'" x-cloak>
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="card p-4">
            <div class="text-xs text-slate-400 mb-1">Daily P&L</div>
            <div class="text-2xl font-bold" :class="risk.totalDayPL>=0?'positive':'negative'" x-text="fmtPL(risk.totalDayPL)"></div>
            <div class="text-xs mt-1" :class="risk.totalDayPLPct>=0?'positive':'negative'" x-text="risk.totalDayPLPct?.toFixed(2)+'%'"></div>
          </div>
          <div class="card p-4">
            <div class="text-xs text-slate-400 mb-1">Top 5 Concentration</div>
            <div class="text-2xl font-bold text-white" x-text="(risk.top5Concentration*100)?.toFixed(1)+'%'"></div>
            <div class="text-xs text-slate-500 mt-1">of total portfolio</div>
          </div>
          <div class="card p-4">
            <div class="text-xs text-slate-400 mb-1">Cash %</div>
            <div class="text-2xl font-bold text-white" x-text="(risk.cashPct*100)?.toFixed(1)+'%'"></div>
            <div class="text-xs text-slate-500 mt-1">available liquidity</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="card p-4">
            <div class="text-sm font-semibold mb-4">Position Concentration</div>
            <div class="space-y-2">
              <template x-for="c in (risk.concentrations || [])" :key="c.symbol">
                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span x-text="c.symbol"></span>
                    <span x-text="(c.pct*100).toFixed(1)+'%'"></span>
                  </div>
                  <div class="h-1.5 rounded-full" style="background:#1e293b">
                    <div class="h-full rounded-full" :style="'width:'+Math.min(c.pct*100,100)+'%;background:'+(c.pct>0.15?'#f87171':c.pct>0.10?'#fbbf24':'#8b5cf6')"></div>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div class="card p-4">
            <div class="text-sm font-semibold mb-4">Risk Limits</div>
            <div class="space-y-3">
              <template x-for="limit in riskLimits" :key="limit.label">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm" x-text="limit.label"></div>
                    <div class="text-xs text-slate-500" x-text="limit.desc"></div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-mono" x-text="limit.current"></span>
                    <span class="text-xs px-2 py-0.5 rounded-full" :class="limit.ok ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'" x-text="limit.ok ? 'OK' : 'BREACH'"></span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

    </main>
  </div>
</div>

<script>
function tradingDash() {
  return {
    tab: 'overview',
    positions: [], orders: [], agents: [], signals: [], risk: {},
    accounts: [], demoMode: false,
    posBrokerFilter: '', posTypeFilter: '',
    newOrder: { broker: 'schwab', symbol: '', side: 'BUY', quantity: 1, orderType: 'MARKET', limitPrice: null },
    placingOrder: false, orderMessage: '', orderError: false,
    lastUpdated: '', currentTime: '', isMarketOpen: false,
    agentLogs: [],
    _portfolioChart: null, _allocationChart: null, _paperEquityChart: null,
    paperPortfolio: null, agentRecs: [], paperPnL: null,
    paperOrder: { symbol: '', side: 'buy', quantity: 1, order_type: 'market', limit_price: null },
    paperPlacing: false, paperOrderMsg: '', paperOrderErr: false,
    nav: [
      {id:'overview', label:'Overview', icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>'},
      {id:'positions', label:'Positions', icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>'},
      {id:'orders', label:'Orders', icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>'},
      {id:'agents', label:'Agents', icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"/></svg>'},
      {id:'signals', label:'Signals', icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>'},
      {id:'risk', label:'Risk', icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'},
      {id:'paper', label:'Paper Trading', icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>'},
    ],

    get summaryCards() {
      const total = this.accounts.reduce((s,a)=>s+a.totalValue,0);
      const cash = this.accounts.reduce((s,a)=>s+a.cashBalance,0);
      const dayPL = this.accounts.reduce((s,a)=>s+a.dayPL,0);
      const bp = this.accounts.reduce((s,a)=>s+a.buyingPower,0);
      const dayPct = total > 0 ? dayPL/total*100 : 0;
      return [
        {label:'Total Portfolio Value', value:this.fmt(total), colorClass:'text-white', change: undefined},
        {label:'Daily P&L', value:this.fmtPL(dayPL), colorClass:dayPL>=0?'positive':'negative', change:dayPct},
        {label:'Cash Balance', value:this.fmt(cash), colorClass:'text-white', change:undefined},
        {label:'Buying Power', value:this.fmt(bp), colorClass:'text-white', change:undefined},
      ];
    },

    get filteredPositions() {
      return this.positions.filter(p=>
        (!this.posBrokerFilter || p.broker===this.posBrokerFilter) &&
        (!this.posTypeFilter || p.assetType===this.posTypeFilter)
      );
    },

    get openOrders() { return this.orders.filter(o=>o.status==='OPEN'||o.status==='PENDING'); },

    get riskLimits() {
      const r = this.risk;
      // Use the largest single position (concentrations is sorted descending by pct)
      const largestPosPct = r.concentrations?.[0]?.pct ?? 0;
      return [
        {label:'Max Position Size', desc:'Single position <= 5% portfolio', current:(largestPosPct*100).toFixed(1)+'%', ok:largestPosPct<=0.05},
        {label:'Daily Loss Limit', desc:'Daily loss <= 2% portfolio', current:Math.abs(r.totalDayPLPct||0).toFixed(2)+'%', ok:(r.totalDayPLPct||0)>-2},
        {label:'Cash Minimum', desc:'Maintain >= 10% cash', current:((r.cashPct||0)*100).toFixed(1)+'%', ok:(r.cashPct||0)>=0.10},
        {label:'Concentration', desc:'Top 5 positions <= 80%', current:((r.top5Concentration||0)*100).toFixed(1)+'%', ok:(r.top5Concentration||0)<=0.80},
      ];
    },

    fmt(v) { return v!=null ? '$'+Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'; },
    fmtPL(v) { if(v==null) return '—'; return (v>=0?'+':'')+this.fmt(v); },
    fmtTime(iso) { if(!iso) return ''; try{ return new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }catch{return iso;} },

    async init() {
      this.updateClock();
      setInterval(()=>this.updateClock(), 1000);
      await this.refresh();
      setInterval(()=>this.refresh(), 30000);
      this.seedLogs();
    },

    updateClock() {
      const now = new Date();
      this.currentTime = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'America/New_York'})+' ET';
      const h = parseInt(now.toLocaleString('en-US',{hour:'numeric',hour12:false,timeZone:'America/New_York'}));
      const d = now.toLocaleString('en-US',{weekday:'short',timeZone:'America/New_York'});
      this.isMarketOpen = !['Sat','Sun'].includes(d) && h>=9 && h<16;
    },

    async refresh() {
      await Promise.allSettled([
        this.loadAccounts(), this.loadPositions(), this.loadOrders(),
        this.loadAgents(), this.loadSignals(), this.loadRisk(),
        this.loadPaperPortfolio(), this.loadAgentRecs(), this.loadPaperPnL(),
      ]);
      this.lastUpdated = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
      this.$nextTick(()=>this.renderCharts());
    },

    async loadAccounts() {
      try {
        const d = await fetch('/api/trading/accounts').then(r=>r.json());
        this.accounts = d.accounts?.flat() || [];
        this.demoMode = !!d.demo;
      } catch {}
    },
    async loadPositions() { try{ const d=await fetch('/api/trading/positions').then(r=>r.json()); this.positions=d.positions||[]; }catch{} },
    async loadOrders() { try{ const d=await fetch('/api/trading/orders').then(r=>r.json()); this.orders=d.orders||[]; }catch{} },
    async loadAgents() { try{ const d=await fetch('/api/agents').then(r=>r.json()); this.agents=d.agents||[]; }catch{} },
    async loadSignals() { try{ const d=await fetch('/api/agents/signals/all').then(r=>r.json()); this.signals=d.signals||[]; }catch{} },
    async loadRisk() { try{ const d=await fetch('/api/trading/risk').then(r=>r.json()); this.risk=d.metrics||{}; }catch{} },
    async loadPaperPortfolio() { try{ const d=await fetch('/paper/portfolio').then(r=>r.json()); if(!d.error) this.paperPortfolio=d; }catch{} },
    async loadAgentRecs() { try{ const d=await fetch('/api/agents/recommendations').then(r=>r.json()); this.agentRecs=d.recommendations||[]; }catch{} },
    async loadPaperPnL() { try{ const d=await fetch('/paper/pnl').then(r=>r.json()); if(!d.error) this.paperPnL=d; }catch{} },

    async placePaperOrder() {
      this.paperPlacing=true; this.paperOrderMsg=''; this.paperOrderErr=false;
      try{
        const body={...this.paperOrder, symbol: this.paperOrder.symbol.toUpperCase(), quantity: Number(this.paperOrder.quantity)};
        const res=await fetch('/paper/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const d=await res.json();
        if(d.error||d.rejected){ this.paperOrderErr=true; this.paperOrderMsg=d.error||d.reason||'Order rejected'; }
        else{ this.paperOrderMsg='Order submitted! Status: '+(d.order?.status||'filled'); await this.loadPaperPortfolio(); }
      }catch(e){ this.paperOrderErr=true; this.paperOrderMsg='Network error: '+e.message; }
      this.paperPlacing=false;
    },

    async approveRec(id) {
      try{
        const res=await fetch('/api/agents/recommendations/'+id+'/approve',{method:'POST'});
        const d=await res.json();
        if(d.error){ this.addLog('ERROR','Approve failed: '+d.error); }
        else{ this.addLog('INFO','Recommendation approved, order: '+d.orderId); await this.loadAgentRecs(); }
      }catch(e){ this.addLog('ERROR','Approve failed: '+e.message); }
    },

    async rejectRec(id) {
      try{
        const res=await fetch('/api/agents/recommendations/'+id+'/reject',{method:'POST'});
        const d=await res.json();
        if(d.error){ this.addLog('ERROR','Reject failed: '+d.error); }
        else{ this.addLog('INFO','Recommendation rejected'); await this.loadAgentRecs(); }
      }catch(e){ this.addLog('ERROR','Reject failed: '+e.message); }
    },

    async agentCmd(id,action) {
      try{
        const d=await fetch('/api/agents/'+id+'/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}).then(r=>r.json());
        if(d.agent){ const i=this.agents.findIndex(a=>a.id===id); if(i>-1) this.agents[i]=d.agent; }
        this.addLog('INFO',id+': '+action+' command sent');
      }catch(e){ this.addLog('ERROR','Agent command failed: '+e.message); }
    },

    async placeOrder() {
      this.placingOrder=true; this.orderMessage=''; this.orderError=false;
      try{
        const res=await fetch('/api/trading/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.newOrder)});
        const d=await res.json();
        if(d.error){ this.orderError=true; this.orderMessage=d.error; }
        else{ this.orderMessage='Order placed! ID: '+d.orderId; await this.loadOrders(); }
      }catch(e){ this.orderError=true; this.orderMessage='Network error: '+e.message; }
      this.placingOrder=false;
    },

    async cancelOrder(o) {
      try{ await fetch('/api/trading/orders/'+o.id+'?broker='+o.broker,{method:'DELETE'}); await this.loadOrders(); }
      catch(e){ this.addLog('ERROR','Cancel failed: '+e.message); }
    },

    async generateSignals() {
      try{ const d=await fetch('/api/agents/signals/generate',{method:'POST'}).then(r=>r.json()); this.signals=d.signals||this.signals; }
      catch{}
    },

    actOnSignal(s) {
      if(s.action==='HOLD') return;
      this.newOrder={broker:s.broker||'schwab',symbol:s.symbol,side:s.action,quantity:1,orderType:'LIMIT',limitPrice:s.targetPrice?.toFixed(2)||null};
      this.tab='orders';
    },

    seedLogs() {
      const msgs=[
        ['INFO','Orchestrator initialized with 6 agents'],
        ['INFO','Signal Agent: loaded watchlist (7 symbols)'],
        ['INFO','Risk Manager: limits loaded from KV config'],
        ['WARN','Execution Agent: Robinhood token expiring in 3h'],
        ['INFO','Scheduler: market open routine armed for 09:30 ET'],
        ['INFO','Monitor: all systems nominal'],
      ];
      this.agentLogs=msgs.map(([level,msg])=>({time:this.fmtTime(new Date().toISOString()),level,msg}));
    },

    addLog(level,msg) {
      this.agentLogs.unshift({time:this.fmtTime(new Date().toISOString()),level,msg});
      if(this.agentLogs.length>50) this.agentLogs.pop();
    },

    async renderPaperEquityChart() {
      const ctx = document.getElementById('paperEquityChart');
      if (!ctx) return;
      if (this._paperEquityChart) { this._paperEquityChart.destroy(); this._paperEquityChart = null; }
      try {
        const d = await fetch('/paper/performance?days=30').then(r=>r.json());
        const history = d.history || [];
        if (history.length > 0) {
          this._paperEquityChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: history.map(h=>h.date),
              datasets: [{
                label: 'Realized P&L',
                data: history.map(h=>h.realized),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.08)',
                borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true,
              }]
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { display: true, grid: { color: '#1e293b' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
                y: { display: true, grid: { color: '#1e293b' }, ticks: { color: '#64748b', callback: v => '$'+Number(v).toFixed(0) } },
              }
            }
          });
        } else {
          this._paperEquityChart = new Chart(ctx, {
            type: 'line',
            data: { labels: ['No data yet'], datasets: [{ label: 'P&L', data: [0], borderColor: '#475569' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          });
        }
      } catch {}
    },

    renderCharts() {
      const pCtx = document.getElementById('portfolioChart');
      const aCtx = document.getElementById('allocationChart');
      if (!pCtx || !aCtx) return;

      // Destroy existing chart instances before re-creating
      if (this._portfolioChart) { this._portfolioChart.destroy(); this._portfolioChart = null; }
      if (this._allocationChart) { this._allocationChart.destroy(); this._allocationChart = null; }
      if (this.tab === 'paper') this.renderPaperEquityChart();

      if (this.demoMode) {
        // Demo: 30-day simulated history line chart
        const labels=['Jun 6','Jun 9','Jun 10','Jun 11','Jun 12','Jun 13','Jun 16','Jun 17','Jun 18','Jun 19','Jun 20','Jun 23','Jun 24','Jun 25','Jun 26','Jun 27','Jun 30','Jul 1','Jul 2','Jul 3','Jul 7','Jul 8','Jul 9','Jul 10','Jul 11','Jul 14','Jul 15','Jul 16','Jul 17','Jul 18'];
        const values=[119000,120400,119800,121000,122500,121800,123200,124000,123400,125000,124800,126200,127400,126800,128000,129500,130200,131000,130400,132000,131600,133000,134200,133600,135000,136400,137800,139000,141200,144180];
        this._portfolioChart = new Chart(pCtx,{type:'line',data:{labels,datasets:[{label:'Portfolio Value',data:values,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,0.08)',borderWidth:2,pointRadius:0,tension:0.4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:true,grid:{color:'#1e293b'},ticks:{color:'#64748b',callback:v=>'$'+Number(v/1000).toFixed(0)+'k'}}}}});
        this._allocationChart = new Chart(aCtx,{type:'doughnut',data:{labels:['Schwab','Robinhood','Cash'],datasets:[{data:[85,10,5],backgroundColor:['#3b82f6','#22c55e','#64748b'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',font:{size:11}}}}}});
      } else {
        // Live mode: current broker value bar chart
        const brokerMap = {};
        for (const a of this.accounts) {
          const key = a.broker === 'schwab' ? 'Schwab' : a.broker === 'robinhood' ? 'Robinhood' : a.broker;
          brokerMap[key] = (brokerMap[key] || 0) + a.totalValue;
        }
        const labels = Object.keys(brokerMap);
        const values = Object.values(brokerMap);
        const colors = labels.map(l => l === 'Schwab' ? '#3b82f6' : '#22c55e');

        this._portfolioChart = new Chart(pCtx,{type:'bar',data:{labels,datasets:[{label:'Account Value',data:values,backgroundColor:colors,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'#1e293b'},ticks:{color:'#94a3b8'}},y:{grid:{color:'#1e293b'},ticks:{color:'#64748b',callback:v=>'$'+Number(v/1000).toFixed(0)+'k'}}}}});

        // Allocation doughnut from live cash vs invested
        const cashTotal = this.accounts.reduce((s,a)=>s+a.cashBalance,0);
        const allLabels = [...labels, 'Cash'];
        const allData = [...labels.map(lbl => Math.max(0, (brokerMap[lbl]||0) - this.accounts.filter(a=>(a.broker==='schwab'&&lbl==='Schwab')||(a.broker==='robinhood'&&lbl==='Robinhood')).reduce((s,a)=>s+a.cashBalance,0))), cashTotal];
        this._allocationChart = new Chart(aCtx,{type:'doughnut',data:{labels:allLabels,datasets:[{data:allData,backgroundColor:['#3b82f6','#22c55e','#64748b'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',font:{size:11}}}}}});
      }
    },
  };
}
</script>
</body>
</html>`;
}
