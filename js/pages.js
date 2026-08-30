// ── Accounts Page ───────────────────────────────────────────────
function renderAccounts() {
    const grid = document.getElementById("accounts-cards-grid");
    const search = (document.getElementById("acc-search")||{}).value||"";
    const filterSt = (document.getElementById("acc-filter-status")||{}).value||"";
    const filterTy = (document.getElementById("acc-filter-type")||{}).value||"";
    
    const filterSelect = document.getElementById("global-filter");
    const globalFilterVal = filterSelect ? filterSelect.value : "default";

    let list = [...cachedAccounts];
    if (globalFilterVal === "active-only") {
        list = list.filter(a => (a.status || "Active").toLowerCase() === "active");
    }
    
    list.sort((a, b) => {
        if (globalFilterVal === "latest") return (b.lastSeen || 0) - (a.lastSeen || 0);
        if (globalFilterVal === "oldest") return (a.lastSeen || 0) - (b.lastSeen || 0);
        if (globalFilterVal === "most-profitable") return parseFloat(b.plToday || 0) - parseFloat(a.plToday || 0);
        if (globalFilterVal === "most-loss") return parseFloat(a.plToday || 0) - parseFloat(b.plToday || 0);
        if (globalFilterVal === "profit-alltime") return parseFloat(b.plAllTime || 0) - parseFloat(a.plAllTime || 0);
        if (globalFilterVal === "loss-alltime") return parseFloat(a.plAllTime || 0) - parseFloat(b.plAllTime || 0);
        if (globalFilterVal === "highest-balance") return parseFloat(b.balance || 0) - parseFloat(a.balance || 0);
        if (globalFilterVal === "lowest-balance") return parseFloat(a.balance || 0) - parseFloat(b.balance || 0);
        return 0;
    });

    list = list.filter(a => {
        const holderName = a.holderName || a.name || ("Account #" + a.account);
        if(search && !a.account.toLowerCase().includes(search.toLowerCase()) && !holderName.toLowerCase().includes(search.toLowerCase())) return false;
        if(filterSt && (a.status||"active").toLowerCase()!==filterSt) return false;
        if(filterTy && (a.type||"real").toLowerCase()!==filterTy) return false;
        return true;
    });

    if(!list.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:60px"><i class="ph ph-users"></i><p>No accounts found</p></div>';
        return;
    }

    grid.innerHTML = list.map(d => {
        const holderName = d.holderName || d.name || ("Account #" + d.account);
        const bal=parseFloat(d.balance||0);
        const plt=parseFloat(d.plToday||0), pla=parseFloat(d.plAllTime||0);
        const op=parseInt(d.openPositions||0), st=d.status||"Active";
        const bs=getBrokerStyle(d.broker);
        return `<div class="account-card">
            <div class="acc-card-header">
                <div class="acc-card-id"><h3 style="margin-bottom:2px">${holderName}</h3><span style="font-size:12px;color:var(--text-muted)">ID: ${d.account} (${d.type||"Real"})</span></div>
                <div class="acc-card-broker"><div class="broker-logo" style="color:${bs.color}"><i class="ph-fill ${bs.icon}"></i></div>${d.broker||"—"}</div>
            </div>
            <div class="acc-card-row"><span class="acc-card-label">Account Holder</span><span class="acc-card-value font-weight-bold" style="font-weight:600;color:var(--text-main);">${holderName}</span></div>
            <div class="acc-card-row"><span class="acc-card-label">Balance</span><span class="acc-card-value">${fmtPlain$(bal)}</span></div>
            <div class="acc-card-row"><span class="acc-card-label">P/L Today</span><span class="acc-card-value ${plt>=0?'positive':'negative'}">${fmt$(plt)}</span></div>
            <div class="acc-card-row"><span class="acc-card-label">P/L All Time</span><span class="acc-card-value ${pla>=0?'positive':'negative'}">${fmt$(pla)}</span></div>
            <div class="acc-card-row"><span class="acc-card-label">Open Positions</span><span class="acc-card-value">${op}</span></div>
            <div class="acc-card-row"><span class="acc-card-label">Status</span><span class="status-pill ${st.toLowerCase()}">${st}</span></div>
        </div>`;
    }).join('');
}

// ── Positions Page ──────────────────────────────────────────────
function renderPositions() {
    const tbody = document.getElementById("positions-table-body");
    const search = (document.getElementById("pos-search")||{}).value||"";
    const filterTy = (document.getElementById("pos-filter-type")||{}).value||"";
    const pills = document.getElementById("positions-summary-pills");

    let list = cachedPositions.filter(p => {
        if(search && !(p.symbol||"").toLowerCase().includes(search.toLowerCase())) return false;
        if(filterTy && p.type!==filterTy) return false;
        return true;
    });

    let buyCount=0, sellCount=0, totalProfit=0;
    list.forEach(p => {
        if(p.type==="Buy") buyCount++; else sellCount++;
        totalProfit += parseFloat(p.profit||0);
    });
    pills.innerHTML = `<span class="summary-pill buy">Buy: ${buyCount}</span><span class="summary-pill sell">Sell: ${sellCount}</span><span class="summary-pill">Total P/L: <b class="${totalProfit>=0?'positive':'negative'}">${fmt$(totalProfit)}</b></span>`;

    if(!list.length) {
        tbody.innerHTML = emptyRow(11,"No open positions","Positions will appear when the EA reports open trades");
        document.getElementById("positions-showing").textContent = "No open positions";
        return;
    }

    tbody.innerHTML = list.map(p => {
        const pr = parseFloat(p.profit||0);
        return `<tr>
            <td>${p.ticket||"—"}</td>
            <td><div class="account-cell"><span class="account-name">${p._account||"—"}</span></div></td>
            <td><b>${p.symbol||"—"}</b></td>
            <td><span class="${p.type==='Buy'?'positive':'negative'}">${p.type}</span></td>
            <td>${parseFloat(p.lots||0).toFixed(2)}</td>
            <td>${parseFloat(p.openPrice||0).toFixed(5)}</td>
            <td>${parseFloat(p.currentPrice||0).toFixed(5)}</td>
            <td>${parseFloat(p.sl||0).toFixed(5)}</td>
            <td>${parseFloat(p.tp||0).toFixed(5)}</td>
            <td>${parseFloat(p.swap||0).toFixed(2)}</td>
            <td class="${pr>=0?'positive':'negative'}"><b>${fmt$(pr)}</b></td>
        </tr>`;
    }).join('');
    document.getElementById("positions-showing").textContent = list.length+" position"+(list.length!==1?"s":"");
}

// ── Orders Page ─────────────────────────────────────────────────
function renderOrders() {
    const tbody = document.getElementById("orders-table-body");
    const search = (document.getElementById("ord-search")||{}).value||"";
    const filterTy = (document.getElementById("ord-filter-type")||{}).value||"";

    let list = cachedOrders.filter(o => {
        if(search && !(o.symbol||"").toLowerCase().includes(search.toLowerCase())) return false;
        if(filterTy && o.type!==filterTy) return false;
        return true;
    });

    if(!list.length) {
        tbody.innerHTML = emptyRow(8,"No pending orders","Pending orders will appear when the EA reports them");
        document.getElementById("orders-showing").textContent = "No pending orders";
        return;
    }

    tbody.innerHTML = list.map(o => `<tr>
        <td>${o.ticket||"—"}</td>
        <td><div class="account-cell"><span class="account-name">${o._account||"—"}</span></div></td>
        <td><b>${o.symbol||"—"}</b></td>
        <td>${o.type||"—"}</td>
        <td>${parseFloat(o.lots||0).toFixed(2)}</td>
        <td>${parseFloat(o.price||0).toFixed(5)}</td>
        <td>${parseFloat(o.sl||0).toFixed(5)}</td>
        <td>${parseFloat(o.tp||0).toFixed(5)}</td>
    </tr>`).join('');
    document.getElementById("orders-showing").textContent = list.length+" order"+(list.length!==1?"s":"");
}

// ── Transactions Page ───────────────────────────────────────────
function renderTransactions() {
    const tbody = document.getElementById("transactions-table-body");
    const search = (document.getElementById("tx-search")||{}).value||"";
    const filterTy = (document.getElementById("tx-filter-type")||{}).value||"";

    let list = cachedHistory.filter(d => {
        if(search && !(d.symbol||"").toLowerCase().includes(search.toLowerCase())) return false;
        if(filterTy && d.type!==filterTy) return false;
        return true;
    });

    if(!list.length) {
        tbody.innerHTML = emptyRow(9,"No transaction history","Recent deals will appear once the EA sends history data");
        document.getElementById("transactions-showing").textContent = "No transaction history";
        return;
    }

    tbody.innerHTML = list.map(d => {
        const pr = parseFloat(d.profit||0);
        return `<tr>
            <td>${d.ticket||"—"}</td>
            <td><div class="account-cell"><span class="account-name">${d._account||"—"}</span></div></td>
            <td><b>${d.symbol||"—"}</b></td>
            <td><span class="${d.type==='Buy'?'positive':'negative'}">${d.type||"—"}</span></td>
            <td>${parseFloat(d.lots||0).toFixed(2)}</td>
            <td>${parseFloat(d.price||0).toFixed(5)}</td>
            <td class="${pr>=0?'positive':'negative'}"><b>${fmt$(pr)}</b></td>
            <td>${parseFloat(d.swap||0).toFixed(2)}</td>
            <td>${tsToDate(d.time)}</td>
        </tr>`;
    }).join('');
    document.getElementById("transactions-showing").textContent = list.length+" transaction"+(list.length!==1?"s":"");
}
