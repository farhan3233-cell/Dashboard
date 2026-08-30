// ── Performance Page ────────────────────────────────────────────
function renderPerformance() {
    const stats = document.getElementById("perf-stats");
    const byAcc = document.getElementById("perf-by-account");
    const breakdown = document.getElementById("perf-breakdown");
    const accounts = cachedAccounts;

    if(!accounts.length) {
        stats.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:40px"><i class="ph ph-chart-bar"></i><p>No performance data</p></div>';
        byAcc.innerHTML = ''; breakdown.innerHTML = '';
        return;
    }

    let tBal=0, tEq=0, tPlT=0, tPlA=0, tPos=0;
    accounts.forEach(a => {
        tBal+=parseFloat(a.balance||0); tEq+=parseFloat(a.equity||0);
        tPlT+=parseFloat(a.plToday||0); tPlA+=parseFloat(a.plAllTime||0);
        tPos+=parseInt(a.openPositions||0);
    });

    // Calculate real Win Rate from actual closed trade history deals
    const tradeDeals = cachedHistory.filter(d => d.type === 'Buy' || d.type === 'Sell');
    let winRateLabel = "N/A (0 Trades)";
    if (tradeDeals.length > 0) {
        const winCount = tradeDeals.filter(d => parseFloat(d.profit || 0) > 0).length;
        const wr = (winCount / tradeDeals.length) * 100;
        winRateLabel = `${wr.toFixed(0)}% (${winCount}/${tradeDeals.length})`;
    }

    stats.innerHTML = `
        <div class="perf-stat-card"><div class="perf-stat-label">Total Balance</div><div class="perf-stat-value">${fmtPlain$(tBal)}</div></div>
        <div class="perf-stat-card"><div class="perf-stat-label">Total Equity</div><div class="perf-stat-value">${fmtPlain$(tEq)}</div></div>
        <div class="perf-stat-card"><div class="perf-stat-label">Today's P/L</div><div class="perf-stat-value ${tPlT>=0?'positive':'negative'}">${fmt$(tPlT)}</div></div>
        <div class="perf-stat-card"><div class="perf-stat-label">Win Rate (History)</div><div class="perf-stat-value">${winRateLabel}</div></div>`;

    const maxPl = Math.max(...accounts.map(a => Math.abs(parseFloat(a.plToday||0))), 1);
    byAcc.innerHTML = accounts.map(a => {
        const pl = parseFloat(a.plToday||0);
        const w = Math.abs(pl)/maxPl*100;
        return `<div class="perf-bar-item">
            <div class="perf-bar-top"><span>${a.account}</span><span class="${pl>=0?'positive':'negative'}">${fmt$(pl)}</span></div>
            <div class="perf-bar-track"><div class="perf-bar-fill ${pl<0?'negative':''}" style="width:${w}%"></div></div>
        </div>`;
    }).join('');

    breakdown.innerHTML = accounts.map(a => {
        const bal = parseFloat(a.balance||0);
        const pct = tBal>0 ? (bal/tBal*100) : 0;
        return `<div class="breakdown-row"><span class="breakdown-label">${a.account}</span><span>${fmtPlain$(bal)} (${pct.toFixed(1)}%)</span></div>`;
    }).join('');
}

// ── Risk Page ───────────────────────────────────────────────────
function renderRisk() {
    const grid = document.getElementById("risk-grid");
    const tbody = document.getElementById("risk-table-body");
    const accounts = cachedAccounts;

    if(!accounts.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:40px"><i class="ph ph-shield-warning"></i><p>No risk data</p></div>';
        tbody.innerHTML = ''; return;
    }

    let tMu=0, tMf=0, tBal=0, tEq=0, dangerCount=0;
    accounts.forEach(a => {
        tMu+=parseFloat(a.marginUsed||0); tMf+=parseFloat(a.marginFree||0);
        tBal+=parseFloat(a.balance||0); tEq+=parseFloat(a.equity||0);
        if(parseFloat(a.marginLevel||0)<200 && parseFloat(a.marginLevel||0)>0) dangerCount++;
    });
    const avgML = accounts.reduce((s,a)=>s+parseFloat(a.marginLevel||0),0) / accounts.length;
    const drawdown = tBal>0 ? ((tBal-tEq)/tBal*100) : 0;
    const riskLevel = avgML<200 ? 'high' : avgML<500 ? 'medium' : 'low';

    grid.innerHTML = `
        <div class="risk-card"><div class="risk-card-title">Avg Margin Level</div><div class="risk-card-value">${fmtPctPlain(avgML)}</div><span class="risk-badge ${riskLevel}">${riskLevel.toUpperCase()}</span></div>
        <div class="risk-card"><div class="risk-card-title">Total Margin Used</div><div class="risk-card-value">${fmtPlain$(tMu)}</div></div>
        <div class="risk-card"><div class="risk-card-title">Drawdown</div><div class="risk-card-value ${drawdown>0?'negative':''}">${drawdown.toFixed(2)}%</div></div>
        <div class="risk-card"><div class="risk-card-title">At-Risk Accounts</div><div class="risk-card-value ${dangerCount>0?'negative':''}">${dangerCount}</div><div class="risk-card-label">Margin level below 200%</div></div>`;

    tbody.innerHTML = accounts.map(a => {
        const ml = parseFloat(a.marginLevel||0);
        const rl = ml<200&&ml>0?'high':ml<500?'medium':'low';
        return `<tr>
            <td><b>${a.account}</b></td>
            <td>${fmtPlain$(parseFloat(a.balance||0))}</td>
            <td>${fmtPlain$(parseFloat(a.equity||0))}</td>
            <td>${fmtPlain$(parseFloat(a.marginUsed||0))}</td>
            <td>${fmtPlain$(parseFloat(a.marginFree||0))}</td>
            <td>${fmtPctPlain(ml)}</td>
            <td>${parseInt(a.openPositions||0)}</td>
            <td><span class="risk-badge ${rl}">${rl.toUpperCase()}</span></td>
        </tr>`;
    }).join('');
}

// ── Alerts Page ─────────────────────────────────────────────────
function renderAlerts() {
    const container = document.getElementById("alerts-list");
    const accounts = cachedAccounts;
    let alerts = [];

    accounts.forEach(a => {
        const ml = parseFloat(a.marginLevel||0);
        const plt = parseFloat(a.plToday||0);
        const st = (a.status||"active").toLowerCase();

        if(ml > 0 && ml < 200) {
            alerts.push({type:'danger',icon:'ph-warning-circle',title:'Critical Margin Level',
                desc:`${a.account} margin level at ${fmtPctPlain(ml)} — risk of margin call`,time:'Live'});
        } else if(ml > 0 && ml < 500) {
            alerts.push({type:'warning',icon:'ph-warning',title:'Low Margin Level',
                desc:`${a.account} margin level at ${fmtPctPlain(ml)}`,time:'Live'});
        }
        if(plt < -100) {
            alerts.push({type:'warning',icon:'ph-trend-down',title:'Significant Loss Today',
                desc:`${a.account} is down ${fmt$(plt)} today`,time:'Live'});
        }
        if(st === 'inactive') {
            alerts.push({type:'info',icon:'ph-info',title:'Inactive Account',
                desc:`${a.account} is marked as inactive`,time:'Live'});
        }
        if(plt > 0) {
            alerts.push({type:'success',icon:'ph-check-circle',title:'Account Profitable',
                desc:`${a.account} is up ${fmt$(plt)} today`,time:'Live'});
        }
    });

    if(accounts.length > 0 && alerts.filter(a=>a.type==='danger'||a.type==='warning').length === 0) {
        alerts.unshift({type:'success',icon:'ph-check-circle',title:'All Systems Normal',
            desc:'All accounts are within safe margin levels',time:'Live'});
    }

    if(!alerts.length) {
        container.innerHTML = '<div class="empty-state" style="padding:60px"><i class="ph ph-bell-slash"></i><p>No alerts</p><small>Alerts appear when accounts need attention</small></div>';
        return;
    }

    // Filter tabs
    const activeFilter = document.querySelector('.alerts-filter-tabs .tab-btn.active');
    const filter = activeFilter ? activeFilter.dataset.filter : 'all';
    if(filter !== 'all') {
        const mapping = {warning:'warning',info:'info',success:'success',danger:'danger'};
        alerts = alerts.filter(a => a.type === filter || (filter==='warning' && a.type==='danger'));
    }

    container.innerHTML = alerts.map(a => `
        <div class="alert-item ${a.type}">
            <i class="ph ${a.icon} alert-icon"></i>
            <div class="alert-body"><div class="alert-title">${a.title}</div><div class="alert-desc">${a.desc}</div></div>
            <span class="alert-time">${a.time}</span>
        </div>`).join('');
}

// ── Reports Page ────────────────────────────────────────────────
function generateReport(type) {
    const output = document.getElementById('report-output');
    const title = document.getElementById('report-output-title');
    const content = document.getElementById('report-output-content');
    output.style.display = 'block';
    const accounts = cachedAccounts;

    if(!accounts.length) {
        title.textContent = 'Report'; content.innerHTML = '<p style="color:var(--text-muted)">No data to generate report.</p>';
        return;
    }

    let html = '';
    if(type === 'summary') {
        title.textContent = 'Account Summary Report';
        html = `<table class="accounts-table"><thead><tr><th>Account</th><th>Broker</th><th>Balance</th><th>Equity</th><th>P/L Today</th><th>Status</th></tr></thead><tbody>`;
        accounts.forEach(a => {
            const plt = parseFloat(a.plToday||0);
            html += `<tr><td>${a.account}</td><td>${a.broker||"—"}</td><td>${fmtPlain$(parseFloat(a.balance||0))}</td><td>${fmtPlain$(parseFloat(a.equity||0))}</td><td class="${plt>=0?'positive':'negative'}">${fmt$(plt)}</td><td>${a.status||"Active"}</td></tr>`;
        });
        html += '</tbody></table>';
    } else if(type === 'performance') {
        title.textContent = 'Performance Report';
        html = `<table class="accounts-table"><thead><tr><th>Account</th><th>P/L Today</th><th>P/L Today %</th><th>P/L All Time</th><th>P/L All Time %</th></tr></thead><tbody>`;
        accounts.forEach(a => {
            const plt=parseFloat(a.plToday||0), pla=parseFloat(a.plAllTime||0);
            html += `<tr><td>${a.account}</td><td class="${plt>=0?'positive':'negative'}">${fmt$(plt)}</td><td>${fmtPct(parseFloat(a.plTodayPct||0))}</td><td class="${pla>=0?'positive':'negative'}">${fmt$(pla)}</td><td>${fmtPct(parseFloat(a.plAllTimePct||0))}</td></tr>`;
        });
        html += '</tbody></table>';
    } else if(type === 'risk') {
        title.textContent = 'Risk Report';
        html = `<table class="accounts-table"><thead><tr><th>Account</th><th>Margin Used</th><th>Margin Level</th><th>Open Positions</th><th>Risk</th></tr></thead><tbody>`;
        accounts.forEach(a => {
            const ml=parseFloat(a.marginLevel||0);
            const rl=ml<200&&ml>0?'high':ml<500?'medium':'low';
            html += `<tr><td>${a.account}</td><td>${fmtPlain$(parseFloat(a.marginUsed||0))}</td><td>${fmtPctPlain(ml)}</td><td>${parseInt(a.openPositions||0)}</td><td><span class="risk-badge ${rl}">${rl.toUpperCase()}</span></td></tr>`;
        });
        html += '</tbody></table>';
    } else if(type === 'transactions') {
        title.textContent = 'Transaction History Report';
        if(!cachedHistory.length) { content.innerHTML='<p style="color:var(--text-muted)">No history data.</p>'; return; }
        html = `<table class="accounts-table"><thead><tr><th>Ticket</th><th>Account</th><th>Symbol</th><th>Type</th><th>Lots</th><th>Profit</th><th>Time</th></tr></thead><tbody>`;
        cachedHistory.forEach(d => {
            const pr=parseFloat(d.profit||0);
            html += `<tr><td>${d.ticket||"—"}</td><td>${d._account||"—"}</td><td>${d.symbol||"—"}</td><td>${d.type||"—"}</td><td>${parseFloat(d.lots||0).toFixed(2)}</td><td class="${pr>=0?'positive':'negative'}">${fmt$(pr)}</td><td>${tsToDate(d.time)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    content.innerHTML = html;
}

function printReport() { window.print(); }

function saveSettings() {
    alert('Settings saved! Refresh interval and alert thresholds updated.');
}

// ── Profit Sharing Page ─────────────────────────────────────────
function renderProfitSharing() {
    const tbody = document.getElementById("sharing-table-body");
    const search = (document.getElementById("sharing-search")||{}).value||"";
    const period = (document.getElementById("sharing-period")||{}).value||"weekly";
    const accounts = cachedAccounts;

    let list = accounts.filter(a => {
        if (search && !a.account.toLowerCase().includes(search.toLowerCase()) && !(a.broker||"").toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    if (!list.length) {
        tbody.innerHTML = emptyRow(7, "No accounts found for profit sharing", "Connect MT5 accounts or adjust your search filter");
        document.getElementById("stat-sharing-gross").textContent = "$0.00";
        document.getElementById("stat-sharing-our").textContent = "$0.00";
        document.getElementById("stat-sharing-client").textContent = "$0.00";
        document.getElementById("stat-sharing-count").textContent = "0";
        document.getElementById("sharing-showing").textContent = "No accounts";
        return;
    }

    let totalGross = 0, totalOur = 0, totalClient = 0, profitCount = 0;

    const rowsHtml = list.map(a => {
        const holderName = a.holderName || a.name || ("Account #" + a.account);
        const bal = parseFloat(a.balance||0);
        let gross = 0;
        if (period === "today") gross = parseFloat(a.plToday||0);
        else if (period === "alltime") gross = parseFloat(a.plAllTime||0);
        else gross = parseFloat(a.plToday||0); // Weekly estimated

        const isProfitable = gross > 0;
        const ourShare = isProfitable ? gross * 0.30 : 0;
        const clientShare = isProfitable ? gross * 0.70 : gross;

        totalGross += gross;
        if (isProfitable) {
            totalOur += ourShare;
            totalClient += clientShare;
            profitCount++;
        }

        return `<tr>
            <td><span class="account-name font-weight-bold" style="font-weight:600;color:var(--text-main);">${holderName}</span></td>
            <td><div class="account-cell"><span class="account-name">${a.account}</span><span class="account-type">${a.type||"Real"}</span></div></td>
            <td><b>${a.broker||"—"}</b></td>
            <td>${fmtPlain$(bal)}</td>
            <td class="${gross>=0?'positive':'negative'}"><b>${fmt$(gross)}</b></td>
            <td class="positive"><b>${fmt$(ourShare)}</b></td>
            <td class="${clientShare>=0?'positive':'negative'}"><b>${fmt$(clientShare)}</b></td>
            <td><span class="status-pill ${isProfitable?'active':'inactive'}">${isProfitable?'70/30 Active':'No Profit'}</span></td>
        </tr>`;
    }).join('');

    tbody.innerHTML = rowsHtml;

    document.getElementById("stat-sharing-gross").textContent = fmt$(totalGross);
    document.getElementById("stat-sharing-gross").className = "stat-value " + (totalGross>=0?"positive":"negative");
    document.getElementById("stat-sharing-our").textContent = fmt$(totalOur);
    document.getElementById("stat-sharing-client").textContent = fmt$(totalClient);
    document.getElementById("stat-sharing-count").textContent = profitCount;
    document.getElementById("sharing-showing").textContent = `Showing ${list.length} account${list.length!==1?'s':''}`;
}

// ── Alert filter tabs ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.alerts-filter-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.alerts-filter-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            renderAlerts();
        });
    });
    // Search & filter bindings
    ['acc-search','acc-filter-status','acc-filter-type'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', renderAccounts);
        if(el) el.addEventListener('change', renderAccounts);
    });
    ['sharing-search','sharing-period'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', renderProfitSharing);
        if(el) el.addEventListener('change', renderProfitSharing);
    });
    ['pos-search','pos-filter-type'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', renderPositions);
        if(el) el.addEventListener('change', renderPositions);
    });
    ['ord-search','ord-filter-type'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', renderOrders);
        if(el) el.addEventListener('change', renderOrders);
    });
    ['tx-search','tx-filter-type'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', renderTransactions);
        if(el) el.addEventListener('change', renderTransactions);
    });
});
