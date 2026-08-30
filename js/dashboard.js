// ── Dashboard Page ──────────────────────────────────────────────
function renderDashboard() {
    const searchInput = document.getElementById("accounts-search");
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
    
    let accounts = cachedAccounts;
    if (search) {
        accounts = accounts.filter(a =>
            a.account.toLowerCase().includes(search) ||
            (a.holderName || a.name || "").toLowerCase().includes(search) ||
            (a.broker || "").toLowerCase().includes(search) ||
            (a.type || "").toLowerCase().includes(search)
        );
    }

    const tbody = document.getElementById("dashboard-table-body");
    tbody.innerHTML = "";

    if (!cachedAccounts.length) {
        tbody.innerHTML = emptyRow(8, "Waiting for EA connections…", "Attach DashboardSync EA to your MT5 charts");
        resetDashboardStats();
        return;
    }

    if (!accounts.length && search) {
        tbody.innerHTML = emptyRow(8, "No matching accounts found", `No results for "${search}"`);
        document.getElementById("dashboard-showing").textContent = "0 accounts found";
        return;
    }

    let tBal=0, tEq=0, tPlT=0, tPlA=0, actv=0, inactv=0, tPos=0;
    let bestProfit=null, bestGainer=null, attCount=0;

    accounts.forEach(d => {
        const holderName = d.holderName || d.name || ("Account #" + d.account);
        const bal = parseFloat(d.balance||0);
        const eq = parseFloat(d.equity||0);
        const plt = parseFloat(d.plToday||0);
        const pla = parseFloat(d.plAllTime||0);
        const pltPct = parseFloat(d.plTodayPct||0);
        const plaPct = parseFloat(d.plAllTimePct||0);
        const op = parseInt(d.openPositions||0);
        const st = d.status||"Active";
        const isAct = st.toLowerCase()==="active";

        tBal+=bal; tEq+=eq; tPlT+=plt; tPlA+=pla; tPos+=op;
        if(isAct) actv++; else inactv++;
        if(plt<0 || !isAct) attCount++;

        if(!bestProfit || plt > parseFloat(bestProfit.plToday||0)) bestProfit = d;
        if(!bestGainer || plaPct > parseFloat(bestGainer.plAllTimePct||0)) bestGainer = d;

        const bs = getBrokerStyle(d.broker);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <div style="display:flex;align-items:center;gap:6px">
                    <span class="account-name font-weight-bold" style="font-weight:600;color:var(--text-main);">${holderName}</span>
                    <i class="ph ph-pencil-simple" title="Edit Holder Name" style="cursor:pointer;color:var(--text-muted);font-size:14px" onclick="editAccountNickname('${d.account}', '${holderName.replace(/'/g, "\\'")}')"></i>
                </div>
            </td>
            <td><div class="account-cell"><span class="account-name">${d.account}</span><span class="account-type">${d.type||"Real"}</span></div></td>
            <td><div class="broker-cell"><div class="broker-logo" style="color:${bs.color}"><i class="ph-fill ${bs.icon}"></i></div><span>${d.broker||"—"}</span></div></td>
            <td>${fmtPlain$(bal)}</td>
            <td><div class="pl-cell"><span class="pl-val ${plt>=0?'positive':'negative'}">${fmt$(plt)}</span><span class="pl-pct ${pltPct>=0?'positive':'negative'}">${fmtPct(pltPct)}</span></div></td>
            <td><div class="pl-cell"><span class="pl-val ${pla>=0?'positive':'negative'}">${fmt$(pla)}</span><span class="pl-pct ${plaPct>=0?'positive':'negative'}">${fmtPct(plaPct)}</span></div></td>
            <td><span class="status-pill ${st.toLowerCase()}">${st}</span></td>
            <td>
                <div style="position:relative;display:inline-block">
                    <button class="actions-btn" onclick="toggleAccountMenu(event, '${d.account}')" title="Account Actions"><i class="ph ph-dots-three-vertical"></i></button>
                    <div id="acc-menu-${d.account}" class="acc-actions-menu" style="display:none;position:absolute;right:0;top:100%;z-index:999;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);width:150px;padding:4px 0">
                        <div onclick="editAccountNickname('${d.account}', '${holderName.replace(/'/g, "\\'")}')" style="padding:8px 12px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;gap:8px;color:var(--text-primary);"><i class="ph ph-pencil"></i> Edit Holder</div>
                        <div onclick="confirmDeleteAccount('${d.account}', '${holderName.replace(/'/g, "\\'")}')" style="padding:8px 12px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;gap:8px;color:var(--red)"><i class="ph ph-trash"></i> Remove</div>
                    </div>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });

    // Stats
    document.getElementById("stat-total-accounts").textContent = accounts.length;
    document.getElementById("stat-active-accounts").textContent = "Active: "+actv;
    document.getElementById("stat-inactive-accounts").textContent = "Inactive: "+inactv;
    document.getElementById("stat-total-balance").textContent = fmtPlain$(tBal);
    document.getElementById("stat-total-equity").textContent = "Active Accounts";

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

async function editAccountNickname(accountId, currentName) {
    const defaultVal = currentName.startsWith('Account #') ? '' : currentName;
    const newName = prompt(`Enter Account Holder Name / Nickname for Account #${accountId}:`, defaultVal);
    if (newName !== null && newName.trim() !== "") {
        const cleaned = newName.trim();
        try {
            const res = await fetch('/api/set_nickname', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: accountId, holderName: cleaned })
            });
            if (res.ok) {
                const acc = cachedAccounts.find(a => String(a.account) === String(accountId));
                if (acc) acc.holderName = cleaned;
                renderDashboard();
                if (typeof renderAccounts === 'function') renderAccounts();
                if (typeof renderProfitSharing === 'function') renderProfitSharing();
            }
        } catch (e) {
            console.error('Error setting nickname:', e);
        }
    }
}

function toggleAccountMenu(event, accountId) {
    event.stopPropagation();
    document.querySelectorAll('.acc-actions-menu').forEach(m => m.style.display = 'none');
    const menu = document.getElementById(`acc-menu-${accountId}`);
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

async function confirmDeleteAccount(accountId, name) {
    if (confirm(`Are you sure you want to remove account #${accountId} (${name}) from dashboard?`)) {
        try {
            const res = await fetch(`/api/delete_account/${accountId}`, { method: 'DELETE' });
            if (res.ok) {
                cachedAccounts = cachedAccounts.filter(a => String(a.account) !== String(accountId));
                renderDashboard();
                if (typeof renderAccounts === 'function') renderAccounts();
                if (typeof renderProfitSharing === 'function') renderProfitSharing();
            }
        } catch (e) {
            console.error('Error deleting account:', e);
        }
    }
}

document.addEventListener('click', () => {
    document.querySelectorAll('.acc-actions-menu').forEach(m => m.style.display = 'none');
});
