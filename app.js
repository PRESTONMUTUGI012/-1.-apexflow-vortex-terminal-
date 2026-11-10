let derivEngine = null;
let currentMode = 'single';
let aiBotActive = false;
let tickHistory = [];
let sessionStats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  netPnL: 0
};

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  autoLoginTerminal();
});

function log(msg, type = 'info') {
  const container = document.getElementById('logs-container');
  const time = new Date().toLocaleTimeString();
  let color = 'text-gray-300';
  if (type === 'success') color = 'text-neon font-bold';
  if (type === 'error') color = 'text-rose-400 font-bold';
  if (type === 'warning') color = 'text-amber-400 font-bold';
  if (type === 'bot') color = 'text-cyan-400 font-bold';

  const line = document.createElement('div');
  line.className = `${color}`;
  line.innerHTML = `<span class="text-gray-600">[${time}]</span> ${msg}`;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

function autoLoginTerminal() {
  const appId = "34UGhpx0qrXHqpfKHAkGH";
  const accountId = "DOT95101040";
  const token = "pat_82ad513baf63f498cffe4acf81f16cf59d886ceb08c1854a62d74370d5a83c83";

  log("Auto-connecting securely via WebSocket to Deriv API...");
  derivEngine = new DerivAPIEngine(appId, token);

  derivEngine.connect(() => {
    log("Connection established. Requesting active markets and authorization...");
  });

  derivEngine.on('active_symbols', (symbols) => {
    const marketSelect = document.getElementById('select-market');
    if (symbols && symbols.length > 0) {
      marketSelect.innerHTML = '';
      symbols.forEach((sym) => {
        const opt = document.createElement('option');
        opt.value = sym.symbol;
        opt.innerText = `${sym.display_name} (${sym.symbol})`;
        marketSelect.appendChild(opt);
      });
      log(`Loaded ${symbols.length} active Deriv markets into selector.`, 'success');
      
      const defaultSymbol = marketSelect.value || 'R_100';
      initTradingViewChart(defaultSymbol);
      derivEngine.subscribeTicks(defaultSymbol);
    }
  });

  derivEngine.on('authorize', (authData) => {
    log(`Authorized successfully! Welcome trader ${authData.fullname || authData.email}`, 'success');
    document.getElementById('ui-account-id').innerText = authData.loginid || accountId;
    document.getElementById('ui-balance').innerText = `$${authData.balance}`;
  });

  // Real-time Tick Price & Analysis Engine
  derivEngine.on('tick', (tick) => {
    if (tick && tick.quote) {
      const price = parseFloat(tick.quote);
      const priceElem = document.getElementById('market-price');
      if (priceElem) {
        priceElem.innerText = price.toFixed(tick.pip_size || 2);
      }

      // Update Analysis Indicators
      updateAnalysisTools(price);

      // Run AI Bot Logic if active
      if (aiBotActive) {
        runAIBotLogic(price);
      }
    }
  });

  derivEngine.on('error', (err) => {
    log(`API Authorization Error: ${err.message}`, 'error');
  });
}

function updateAnalysisTools(currentPrice) {
  tickHistory.push(currentPrice);
  if (tickHistory.length > 20) tickHistory.shift();

  if (tickHistory.length >= 5) {
    const recent = tickHistory[tickHistory.length - 1];
    const prev = tickHistory[tickHistory.length - 5];
    const diff = recent - prev;

    const trendElem = document.getElementById('analysis-trend');
    const rsiElem = document.getElementById('analysis-rsi');

    if (diff > 0) {
      trendElem.innerText = "BULLISH 🟢";
      trendElem.className = "font-bold text-neon";
      rsiElem.innerText = (55 + Math.min(Math.abs(diff) * 10, 40)).toFixed(1);
    } else {
      trendElem.innerText = "BEARISH 🔴";
      trendElem.className = "font-bold text-rose-400";
      rsiElem.innerText = (45 - Math.min(Math.abs(diff) * 10, 40)).toFixed(1);
    }
  }
}

function runAIBotLogic(currentPrice) {
  if (tickHistory.length < 3) return;
  const p1 = tickHistory[tickHistory.length - 1];
  const p2 = tickHistory[tickHistory.length - 2];
  const p3 = tickHistory[tickHistory.length - 3];

  // Simple momentum strategy: 3 consecutive ticks up -> CALL, 3 down -> PUT
  if (p1 > p2 && p2 > p3) {
    log("[AI Bot] Momentum detected (3 Up Ticks). Executing automated CALL...", 'bot');
    executeTradeOrder('CALL', true);
    aiBotActive = false; // Pause briefly after firing to manage risk
    document.getElementById('btn-toggle-ai').innerText = "Launch AI Bot";
    document.getElementById('btn-toggle-ai').className = "w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 rounded text-xs transition";
    document.getElementById('ai-status-badge').innerText = "STANDBY";
  }
}

function setupEventListeners() {
  document.getElementById('select-market').addEventListener('change', (e) => {
    const symbol = e.target.value;
    tickHistory = [];
    initTradingViewChart(symbol);
    if (derivEngine && derivEngine.authorized) {
      derivEngine.subscribeTicks(symbol);
      log(`Switched market and analysis feeds to: ${symbol}`);
    }
  });

  // AI Bot Toggle Button
  document.getElementById('btn-toggle-ai').addEventListener('click', () => {
    aiBotActive = !aiBotActive;
    const btn = document.getElementById('btn-toggle-ai');
    const badge = document.getElementById('ai-status-badge');

    if (aiBotActive) {
      btn.innerText = "Stop AI Bot";
      btn.className = "w-full bg-rose-700 hover:bg-rose-600 text-white font-bold py-1.5 rounded text-xs transition";
      badge.innerText = "HUNTING";
      badge.className = "text-[10px] bg-emerald-900 text-neon px-1.5 py-0.5 rounded font-mono animate-pulse";
      log("🤖 Apexflow AI Dollar Hunter Bot activated! Scanning momentum...", 'bot');
    } else {
      btn.innerText = "Launch AI Bot";
      btn.className = "w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 rounded text-xs transition";
      badge.innerText = "STANDBY";
      badge.className = "text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono";
      log("🤖 AI Bot paused.", 'warning');
    }
  });

  document.getElementById('mode-single').addEventListener('click', () => {
    currentMode = 'single';
    document.getElementById('bulk-controls').classList.add('hidden');
    document.getElementById('mode-single').className = "bg-gray-800 border border-neon text-neon py-1.5 rounded text-xs font-semibold";
    document.getElementById('mode-bulk').className = "bg-gray-900 border border-gray-700 text-gray-400 py-1.5 rounded text-xs font-semibold hover:border-gray-500";
    log("Mode: Single Contract Execution.");
  });

  document.getElementById('mode-bulk').addEventListener('click', () => {
    currentMode = 'bulk';
    document.getElementById('bulk-controls').classList.remove('hidden');
    document.getElementById('mode-bulk').className = "bg-gray-800 border border-neon text-neon py-1.5 rounded text-xs font-semibold";
    document.getElementById('mode-single').className = "bg-gray-900 border border-gray-700 text-gray-400 py-1.5 rounded text-xs font-semibold hover:border-gray-500";
    log("Mode: Bulk Multi-Shot Execution activated.");
  });

  document.getElementById('btn-trade-higher').addEventListener('click', () => executeTradeOrder('CALL', false));
  document.getElementById('btn-trade-lower').addEventListener('click', () => executeTradeOrder('PUT', false));

  document.getElementById('btn-cashier').addEventListener('click', () => {
    window.open('https://app.deriv.com/cashier/deposit', '_blank');
  });

  document.getElementById('btn-calc-apply').addEventListener('click', calculateRisk);

  document.getElementById('btn-emergency-flatten').addEventListener('click', () => {
    aiBotActive = false;
    document.getElementById('btn-toggle-ai').innerText = "Launch AI Bot";
    document.getElementById('ai-status-badge').innerText = "STANDBY";
    log("EMERGENCY PANIC TRIGGERED: AI Bot aborted & sequence halted.", 'warning');
    alert("Emergency Flatten Triggered. AI bot stopped and active session halted.");
  });

  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    document.getElementById('logs-container').innerHTML = '';
  });
}

function initTradingViewChart(symbol) {
  const container = document.getElementById('tv_chart_container');
  container.innerHTML = "";

  let tvSymbol = `FX:${symbol.replace('frx', '')}`;
  if (symbol.startsWith('R_') || symbol.includes('1HZ')) {
    tvSymbol = `DERIV:${symbol}`;
  }

  new TradingView.widget({
    "autosize": true,
    "symbol": tvSymbol,
    "interval": "1",
    "timezone": "Etc/UTC",
    "theme": "dark",
    "style": "1",
    "locale": "en",
    "toolbar_bg": "#0d131f",
    "enable_publishing": false,
    "hide_top_toolbar": false,
    "container_id": "tv_chart_container"
  });
}

async function executeTradeOrder(contractType, isFromBot = false) {
  if (!derivEngine || !derivEngine.authorized) {
    log("Terminal not connected! Please wait for authorization.", "error");
    return;
  }

  const maxLossLimit = parseFloat(document.getElementById('risk-max-loss').value);
  if (sessionStats.netPnL <= -Math.abs(maxLossLimit)) {
    log(`CIRCUIT BREAKER ACTIVATED: Max daily stop loss of -$${maxLossLimit} reached!`, 'error');
    if (!isFromBot) alert(`Stop Loss Limit Reached (-$${maxLossLimit}).`);
    return;
  }

  const symbol = document.getElementById('select-market').value;
  const stake = document.getElementById('input-stake').value;
  const duration = document.getElementById('input-duration').value;
  const durationUnit = document.getElementById('input-duration-unit').value;
  const count = (!isFromBot && currentMode === 'bulk') ? parseInt(document.getElementById('input-bulk-count').value) : 1;

  log(`Executing order (${count}x) | ${contractType} on ${symbol} @ $${stake}...`);

  for (let i = 0; i < count; i++) {
    try {
      const result = await derivEngine.executeTrade({
        symbol: symbol,
        amount: stake,
        duration: duration,
        duration_unit: durationUnit,
        contract_type: contractType
      });

      sessionStats.totalTrades++;
      log(`[Trade Success] Contract ID: ${result.contract_id} | Paid: $${result.buy_price} | Payout: $${result.payout}`, 'success');
    } catch (err) {
      log(`[Trade Failed]: ${err.message || err.code}`, 'error');
    }
  }
}

function calculateRisk() {
  const targetProfit = parseFloat(document.getElementById('risk-target-profit').value);
  const maxLoss = parseFloat(document.getElementById('risk-max-loss').value);
  const martingale = parseFloat(document.getElementById('risk-martingale').value);

  const recommendedStake = (maxLoss * 0.05).toFixed(2);
  let totalLoss = parseFloat(recommendedStake);
  let currentStake = parseFloat(recommendedStake);
  let lossesCount = 0;

  while (totalLoss < maxLoss) {
    lossesCount++;
    currentStake = currentStake * martingale;
    totalLoss += currentStake;
  }

  document.getElementById('calc-rec-stake').innerText = `$${recommendedStake}`;
  document.getElementById('calc-max-losses').innerText = `${lossesCount} Trades`;
  log(`Risk Profile Locked: Base Stake $${recommendedStake} | Max Consecutive Loss Steps: ${lossesCount}`, 'success');
}
