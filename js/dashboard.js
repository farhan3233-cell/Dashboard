// ── Dashboard Page ──────────────────────────────────────────────
function renderDashboard() {
    const searchInput = document.getElementById("accounts-search");
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
    
    let accounts = cachedAccounts;
    if (search) {
        accounts = accounts.filter(a =>
            a.account.toLowerCase().includes(search) ||
            (a.broker || "").toLowerCase().includes(search) ||
            (a.type || "").toLowerCase().includes(search)
        );
    }

    const tbody = document.getElementById("dashboard-table-body");
    tbody.innerHTML = "";

    if (!cachedAccounts.length) {
        tbody.innerHTML = emptyRow(10, "Waiting for EA connections…", "Attach DashboardSync EA to your MT5 charts");
        resetDashboardStats();
        return;
    }

    if (!accounts.length && search) {
        tbody.innerHTML = emptyRow(10, "No matching accounts found", `No results for "${search}"`);
        document.getElementById("dashboard-showing").textContent = "0 accounts found";
        return;
    }

    let tBal=0, tEq=0, tPlT=0, tPlA=0, actv=0, inactv=0, tPos=0;
    let bestProfit=null, bestGainer=null, bestMargin=null, attCount=0;

    accounts.forEach(d => {
        const bal = parseFloat(d.balance||0);
        const eq = parseFloat(d.equity||0);
        const plt = parseFloat(d.plToday||0);
        const pla = parseFloat(d.plAllTime||0);
        const pltPct = parseFloat(d.plTodayPct||0);
        const plaPct = parseFloat(d.plAllTimePct||0);
        const ml = parseFloat(d.marginLevel||0);
        const mu = parseFloat(d.marginUsed||0);
        const op = parseInt(d.openPositions||0);
        const st = d.status||"Active";
        const isAct = st.toLowerCase()==="active";

        tBal+=bal; tEq+=eq; tPlT+=plt; tPlA+=pla; tPos+=op;
        if(isAct) actv++; else inactv++;
        if(plt<0 || !isAct) attCount++;

        if(!bestProfit || plt > parseFloat(bestProfit.plToday||0)) bestProfit = d;
        if(!bestGainer || plaPct > parseFloat(bestGainer.plAllTimePct||0)) bestGainer = d;
        if(!bestMargin || ml > parseFloat(bestMargin.marginLevel||0)) bestMargin = d;

        const bs = getBrokerStyle(d.broker);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><div class="account-cell"><span class="account-name">${d.account}</span><span class="account-type">${d.type||"Real"}</span></div></td>
            <td><div class="broker-cell"><div class="broker-logo" style="color:${bs.color}"><i class="ph-fill ${bs.icon}"></i></div><span>${d.broker||"—"}</span></div></td>
            <td>${fmtPlain$(bal)}</td>
            <td>${fmtPlain$(eq)}</td>
            <td><div class="pl-cell"><span class="pl-val ${plt>=0?'positive':'negative'}">${fmt$(plt)}</span><span class="pl-pct ${pltPct>=0?'positive':'negative'}">${fmtPct(pltPct)}</span></div></td>
            <td><div class="pl-cell"><span class="pl-val ${pla>=0?'positive':'negative'}">${fmt$(pla)}</span><span class="pl-pct ${plaPct>=0?'positive':'negative'}">${fmtPct(plaPct)}</span></div></td>
            <td>${fmtPlain$(mu)}</td>
            <td><div>${fmtPctPlain(ml)}</div><div class="margin-bar-container"><div class="margin-bar ${ml<200?'danger':ml<500?'warning':''}" style="width:${Math.min(100,ml/10)}%"></div></div></td>
            <td><span class="status-pill ${st.toLowerCase()}">${st}</span></td>
            <td><button class="actions-btn"><i class="ph ph-dots-three-vertical"></i></button></td>`;
        tbody.appendChild(tr);
    });

    // Stats
    document.getElementById("stat-total-accounts").textContent = accounts.length;
    document.getElementById("stat-active-accounts").textContent = "Active: "+actv;
    document.getElementById("stat-inactive-accounts").textContent = "Inactive: "+inactv;
    document.getElementById("stat-total-balance").textContent = fmtPlain$(tBal);
    document.getElementById("stat-total-equity").textContent = "Equity "+fmtPlain$(tEq);

    const plTE = document.getElementById("stat-pl-today");
    plTE.textContent = fmt$(tPlT);
    plTE.className = "stat-value "+(tPlT>=0?"positive":"negative");
    const plTPE = document.getElementById("stat-pl-today-pct");
    const tpPct = tBal>0?(tPlT/tBal*100):0;
    plTPE.textContent = fmtPct(tpPct);
    plTPE.className = tPlT>=0?"positive":"negative";

    const plAE = document.getElementById("stat-pl-alltime");
    plAE.textContent = fmt$(tPlA);
    plAE.className = "stat-value "+(tPlA>=0?"positive":"negative");
    const sb = tBal - tPlA;
    const apPct = sb>0?(tPlA/sb*100):0;
    const plAPE = document.getElementById("stat-pl-alltime-pct");
    plAPE.textContent = fmtPct(apPct);
    plAPE.className = tPlA>=0?"positive":"negative";

    document.getElementById("stat-open-positions").textContent = tPos;
    document.getElementById("stat-positions-accounts").textContent = "Across "+actv+" Accounts";
    document.getElementById("dashboard-showing").textContent = "Showing "+accounts.length+" account"+(accounts.length!==1?"s":"");

    // Highlights
    if(bestProfit) {
        document.getElementById("hl-most-profitable-name").textContent = bestProfit.account;
        const v = parseFloat(bestProfit.plToday||0);
        const el = document.getElementById("hl-most-profitable-val");
        el.textContent = fmt$(v); el.className = "highlight-value "+(v>=0?"positive":"negative");
    }
    if(bestGainer) {
        document.getElementById("hl-top-gainer-name").textContent = bestGainer.account;
        document.getElementById("hl-top-gainer-val").textContent = fmtPct(parseFloat(bestGainer.plAllTimePct||0));
        document.getElementById("hl-top-gainer-val").className = "highlight-value positive";
    }
    if(bestMargin) {
        document.getElementById("hl-margin-name").textContent = bestMargin.account;
        document.getElementById("hl-margin-val").textContent = fmtPctPlain(parseFloat(bestMargin.marginLevel||0));
    }
    const ae = document.getElementById("hl-attention");
    ae.textContent = attCount>0 ? attCount+" Account"+(attCount>1?"s":"") : "None";
    ae.className = "highlight-value "+(attCount>0?"negative":"positive");
}

function resetDashboardStats() {
    ["stat-total-accounts","stat-open-positions"].forEach(id=>{ const e=document.getElementById(id); if(e) e.textContent="0"; });
    document.getElementById("stat-active-accounts").textContent="Active: 0";
    document.getElementById("stat-inactive-accounts").textContent="Inactive: 0";
    document.getElementById("stat-total-balance").textContent="$0.00";
    document.getElementById("stat-total-equity").textContent="Equity $0.00";
    document.getElementById("stat-pl-today").textContent="$0.00";
    document.getElementById("stat-pl-today-pct").textContent="0.00%";
    document.getElementById("stat-pl-alltime").textContent="$0.00";
    document.getElementById("stat-pl-alltime-pct").textContent="0.00%";
    document.getElementById("stat-positions-accounts").textContent="Across 0 Accounts";
    document.getElementById("dashboard-showing").textContent="No accounts connected";
    ["hl-most-profitable-name","hl-most-profitable-val","hl-top-gainer-name","hl-top-gainer-val","hl-margin-name","hl-margin-val","hl-attention"].forEach(id=>{
        const e=document.getElementById(id); if(e){e.textContent="—";e.className="highlight-value";}
    });
}

// Bind accounts-search input listener
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("accounts-search");
    if (searchInput) {
        searchInput.addEventListener("input", renderDashboard);
    }
});
