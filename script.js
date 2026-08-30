// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatCurrency(value) {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const formatted = "$" + absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return isNegative ? "-" + formatted : "+" + formatted;
}

function formatCurrencyPlain(value) {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const formatted = "$" + absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return isNegative ? "-" + formatted : formatted;
}

function formatPercent(value) {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    return (isNegative ? "-" : "+") + absValue.toFixed(2) + "%";
}

function formatPercentPlain(value) {
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

function todayLabel() {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Broker Branding ─────────────────────────────────────────────────────────

function getBrokerStyle(brokerName) {
    const name = (brokerName || "").toLowerCase();
    if (name.includes('ftmo'))        return { color: "#0D2C54", icon: "ph-diamond" };
    if (name.includes('exness'))      return { color: "#FFC600", icon: "ph-x" };
    if (name.includes('fund'))        return { color: "#4F46E5", icon: "ph-chart-polar" };
    if (name.includes('vantage'))     return { color: "#E11D48", icon: "ph-vignette" };
    if (name.includes('ic market'))   return { color: "#000000", icon: "ph-chart-bar" };
    if (name.includes('startrader'))  return { color: "#1E88E5", icon: "ph-star" };
    return { color: "#3B82F6", icon: "ph-briefcase" };
}

// ─── Fetch from backend ───────────────────────────────────────────────────────

async function fetchAccountsData() {
    try {
        const response = await fetch('/api/accounts');
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();
        if (json.status === 'success') {
            updateDashboard(json.data);
        }
    } catch (error) {
        console.error("Error fetching accounts:", error);
    }
}

// ─── Main Dashboard Renderer ──────────────────────────────────────────────────

function updateDashboard(accounts) {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    // No accounts yet – show empty state
    if (!accounts || accounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <i class="ph ph-plugs-connected"></i>
                    <p>Waiting for EA connections…</p>
                    <small>Make sure the EA is running and the server is reachable.</small>
                </td>
            </tr>`;
        resetStats();
        resetHighlights();
        document.getElementById("showing-text").textContent = "No accounts connected yet";
        document.getElementById("pagination").innerHTML = "";
        return;
    }

    // ── Aggregate totals ──────────────────────────────────────────────────────
    let totalBalance   = 0;
    let totalEquity    = 0;
    let totalPlToday   = 0;
    let totalPlAllTime = 0;
    let activeCount    = 0;
    let inactiveCount  = 0;
    let totalOpenPositions = 0;

    // Highlight trackers
    let mostProfitableAccount = null;
    let topGainerAccount      = null;
    let highestMarginAccount  = null;
    let needsAttentionCount   = 0;

    accounts.forEach(data => {
        const balance        = parseFloat(data.balance   || 0);
        const equity         = parseFloat(data.equity    || 0);
        const plToday        = parseFloat(data.plToday   || 0);
        const plAllTime      = parseFloat(data.plAllTime || 0);
        const plTodayPct     = parseFloat(data.plTodayPct    || 0);
        const plAllTimePct   = parseFloat(data.plAllTimePct  || 0);
        const marginLevel    = parseFloat(data.marginLevel   || 0);
        const marginUsed     = parseFloat(data.marginUsed    || 0);
        const openPositions  = parseInt(data.openPositions   || 0, 10);
        const status         = (data.status || "Active");
        const isActive       = status.toLowerCase() === "active";

        totalBalance        += balance;
        totalEquity         += equity;
        totalPlToday        += plToday;
        totalPlAllTime      += plAllTime;
        totalOpenPositions  += openPositions;

        if (isActive) { activeCount++; } else { inactiveCount++; }

        // Track needs attention (negative P/L today or inactive)
        if (plToday < 0 || !isActive) needsAttentionCount++;

        // Most profitable today
        if (!mostProfitableAccount || plToday > parseFloat(mostProfitableAccount.plToday || 0)) {
            mostProfitableAccount = data;
        }
        // Top gainer all time by %
        if (!topGainerAccount || plAllTimePct > parseFloat(topGainerAccount.plAllTimePct || 0)) {
            topGainerAccount = data;
        }
        // Highest margin level
        if (!highestMarginAccount || marginLevel > parseFloat(highestMarginAccount.marginLevel || 0)) {
            highestMarginAccount = data;
        }

        // ── Build table row ───────────────────────────────────────────────────
        const plTodayClass   = plToday   >= 0 ? "positive" : "negative";
        const plAllTimeClass = plAllTime >= 0 ? "positive" : "negative";
        const brokerStyle    = getBrokerStyle(data.broker);
        const statusClass    = status.toLowerCase();

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <div class="account-cell">
                    <span class="account-name">${data.account}</span>
                    <span class="account-type">${data.type || "Real"}</span>
                </div>
            </td>
            <td>
                <div class="broker-cell">
                    <div class="broker-logo" style="color: ${brokerStyle.color}">
                        <i class="ph-fill ${brokerStyle.icon}"></i>
                    </div>
                    <span>${data.broker || "—"}</span>
                </div>
            </td>
            <td>${formatCurrencyPlain(balance)}</td>
            <td>${formatCurrencyPlain(equity)}</td>
            <td>
                <div class="pl-cell">
                    <span class="pl-val ${plTodayClass}">${formatCurrency(plToday)}</span>
                    <span class="pl-pct ${plTodayClass}">${formatPercent(plTodayPct)}</span>
                </div>
            </td>
            <td>
                <div class="pl-cell">
                    <span class="pl-val ${plAllTimeClass}">${formatCurrency(plAllTime)}</span>
                    <span class="pl-pct ${plAllTimeClass}">${formatPercent(plAllTimePct)}</span>
                </div>
            </td>
            <td>${formatCurrencyPlain(marginUsed)}</td>
            <td>
                <div>${formatPercentPlain(marginLevel)}</div>
                <div class="margin-bar-container">
                    <div class="margin-bar" style="width: ${Math.min(100, marginLevel / 10)}%"></div>
                </div>
            </td>
            <td>
                <span class="status-pill ${statusClass}">${status}</span>
            </td>
            <td>
                <button class="actions-btn"><i class="ph ph-dots-three-vertical"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // ── Update Stat Cards ─────────────────────────────────────────────────────
    document.getElementById("stat-total-accounts").textContent = accounts.length;
    document.getElementById("stat-active-accounts").textContent   = `Active: ${activeCount}`;
    document.getElementById("stat-inactive-accounts").textContent = `Inactive: ${inactiveCount}`;

    document.getElementById("stat-total-balance").textContent = formatCurrencyPlain(totalBalance);
    document.getElementById("stat-total-equity").textContent  = `Equity ${formatCurrencyPlain(totalEquity)}`;

    const plTodayEl = document.getElementById("stat-pl-today");
    plTodayEl.textContent = formatCurrency(totalPlToday);
    plTodayEl.className   = `stat-value ${totalPlToday >= 0 ? 'positive' : 'negative'}`;

    const avgPlTodayPct = totalBalance > 0 ? (totalPlToday / totalBalance * 100) : 0;
    const plTodayPctEl  = document.getElementById("stat-pl-today-pct");
    plTodayPctEl.textContent = formatPercent(avgPlTodayPct);
    plTodayPctEl.className   = totalPlToday >= 0 ? 'positive' : 'negative';

    const plAllTimeEl = document.getElementById("stat-pl-alltime");
    plAllTimeEl.textContent = formatCurrency(totalPlAllTime);
    plAllTimeEl.className   = `stat-value ${totalPlAllTime >= 0 ? 'positive' : 'negative'}`;

    const startingBalance   = totalBalance - totalPlAllTime;
    const avgPlAllTimePct   = startingBalance > 0 ? (totalPlAllTime / startingBalance * 100) : 0;
    const plAllTimePctEl    = document.getElementById("stat-pl-alltime-pct");
    plAllTimePctEl.textContent = formatPercent(avgPlAllTimePct);
    plAllTimePctEl.className   = totalPlAllTime >= 0 ? 'positive' : 'negative';

    document.getElementById("stat-open-positions").textContent    = totalOpenPositions;
    document.getElementById("stat-positions-accounts").textContent = `Across ${activeCount} Accounts`;

    // ── Update Bottom Highlights ──────────────────────────────────────────────
    if (mostProfitableAccount) {
        document.getElementById("hl-most-profitable-name").textContent = mostProfitableAccount.account;
        const mpVal = parseFloat(mostProfitableAccount.plToday || 0);
        const mpEl  = document.getElementById("hl-most-profitable-val");
        mpEl.textContent = formatCurrency(mpVal);
        mpEl.className   = `highlight-value ${mpVal >= 0 ? 'positive' : 'negative'}`;
    }

    if (topGainerAccount) {
        document.getElementById("hl-top-gainer-name").textContent = topGainerAccount.account;
        const tgEl = document.getElementById("hl-top-gainer-val");
        tgEl.textContent = formatPercent(parseFloat(topGainerAccount.plAllTimePct || 0));
        tgEl.className   = `highlight-value positive`;
    }

    if (highestMarginAccount) {
        document.getElementById("hl-margin-name").textContent = highestMarginAccount.account;
        document.getElementById("hl-margin-val").textContent  = formatPercentPlain(parseFloat(highestMarginAccount.marginLevel || 0));
    }

    const attentionEl = document.getElementById("hl-attention");
    attentionEl.textContent = needsAttentionCount > 0 ? `${needsAttentionCount} Account${needsAttentionCount > 1 ? 's' : ''}` : "None";
    attentionEl.className   = `highlight-value ${needsAttentionCount > 0 ? 'negative' : 'positive'}`;

    // ── Footer ────────────────────────────────────────────────────────────────
    document.getElementById("showing-text").textContent = `Showing ${accounts.length} account${accounts.length !== 1 ? 's' : ''} connected`;
    document.getElementById("pagination").innerHTML = ""; // hide pagination for live data
}

// ─── Reset helpers (no data state) ───────────────────────────────────────────

function resetStats() {
    document.getElementById("stat-total-accounts").textContent    = "0";
    document.getElementById("stat-active-accounts").textContent   = "Active: 0";
    document.getElementById("stat-inactive-accounts").textContent = "Inactive: 0";
    document.getElementById("stat-total-balance").textContent     = "$0.00";
    document.getElementById("stat-total-equity").textContent      = "Equity $0.00";
    document.getElementById("stat-pl-today").textContent          = "$0.00";
    document.getElementById("stat-pl-today-pct").textContent      = "0.00%";
    document.getElementById("stat-pl-alltime").textContent        = "$0.00";
    document.getElementById("stat-pl-alltime-pct").textContent    = "0.00%";
    document.getElementById("stat-open-positions").textContent    = "0";
    document.getElementById("stat-positions-accounts").textContent = "Across 0 Accounts";
}

function resetHighlights() {
    ["hl-most-profitable-name","hl-most-profitable-val",
     "hl-top-gainer-name","hl-top-gainer-val",
     "hl-margin-name","hl-margin-val","hl-attention"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = "—"; el.className = "highlight-value"; }
    });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    // Set live date in header
    document.getElementById("header-date").textContent = todayLabel();

    // Initial fetch
    fetchAccountsData();

    // Auto-refresh every 5 seconds (controlled by the toggle)
    let refreshInterval = setInterval(fetchAccountsData, 5000);

    const autoRefreshToggle = document.querySelector('.auto-refresh input');
    if (autoRefreshToggle) {
        autoRefreshToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                refreshInterval = setInterval(fetchAccountsData, 5000);
            } else {
                clearInterval(refreshInterval);
            }
        });
    }
});
