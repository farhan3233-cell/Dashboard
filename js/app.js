// ── Navigation & Data Store ─────────────────────────────────────
let cachedAccounts = [];
let cachedPositions = [];
let cachedOrders = [];
let cachedHistory = [];
let refreshInterval = null;

const pageTitles = {
    dashboard:    ["Welcome Mr Farhan", "Overview of all trading accounts"],
    accounts:     ["Accounts", "Detailed view of all connected accounts"],
    groups:       ["Client Groups", "Group accounts by client to monitor specific portfolios"],
    sharing:      ["Profit Sharing", "Weekly 70/30 profit split breakdown per account"],
    positions:    ["Positions", "All open positions across accounts"],
    orders:       ["Orders", "Pending orders across all accounts"],
    transactions: ["Transactions", "Trade history and closed deals"],
    performance:  ["Performance", "P/L analytics and account performance"],
    risk:         ["Risk", "Margin and exposure analysis"],
    alerts:       ["Alerts", "System notifications and warnings"],
    reports:      ["Reports", "Generate and export reports"],
    settings:     ["Settings", "Configuration and EA setup guide"]
};

function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');
    const nav = document.querySelector(`[data-page="${pageId}"]`);
    if (nav) nav.classList.add('active');
    const t = pageTitles[pageId] || ["Page", ""];
    document.getElementById('page-title').textContent = t[0];
    document.getElementById('page-subtitle').textContent = t[1];
    refreshCurrentPage(pageId);
}

async function fetchJSON(url) {
    try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const j = await r.json();
        return j.status === 'success' ? j.data : null;
    } catch(e) { console.error(url, e); return null; }
}

async function refreshAll() {
    const [acc, pos, ord, hist] = await Promise.all([
        fetchJSON('/api/accounts'),
        fetchJSON('/api/positions'),
        fetchJSON('/api/orders'),
        fetchJSON('/api/history')
    ]);
    cachedAccounts = acc || [];
    cachedPositions = pos || [];
    cachedOrders = ord || [];
    cachedHistory = hist || [];

    const dot = document.getElementById('conn-dot');
    const lbl = document.getElementById('conn-label');
    if (cachedAccounts.length > 0) {
        dot.className = 'status-dot online';
        lbl.textContent = cachedAccounts.length + ' account' + (cachedAccounts.length>1?'s':'') + ' connected';
    } else {
        dot.className = 'status-dot offline';
        lbl.textContent = 'No accounts';
    }

    const activePage = document.querySelector('.page.active');
    if (activePage) {
        refreshCurrentPage(activePage.id.replace('page-',''));
    }

    // Update P/L cards from real history data after every refresh
    if (typeof updateAllTimePLFromHistory === 'function') updateAllTimePLFromHistory();
    if (typeof updateDashboardPeriodCard === 'function') {
        const headerLabel = document.getElementById('header-date')?.textContent || 'Today';
        updateDashboardPeriodCard(headerLabel, periodFromTs, periodToTs);
    }
}

function refreshCurrentPage(pageId) {
    switch(pageId) {
        case 'dashboard': renderDashboard(); break;
        case 'accounts': renderAccounts(); break;
        case 'groups': if (typeof renderGroupsPage === 'function') renderGroupsPage(); break;
        case 'sharing': renderProfitSharing(); break;
        case 'positions': renderPositions(); break;
        case 'orders': renderOrders(); break;
        case 'transactions': renderTransactions(); break;
        case 'performance': renderPerformance(); break;
        case 'risk': renderRisk(); break;
        case 'alerts': renderAlerts(); break;
    }
}

// ── Init ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("header-date").textContent = todayLabel();

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });

    const darkToggle = document.getElementById('dark-mode-toggle');
    const settingsDark = document.getElementById('setting-dark-mode');
    darkToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark', darkToggle.checked);
        if(settingsDark) settingsDark.checked = darkToggle.checked;
    });
    if(settingsDark) {
        settingsDark.addEventListener('change', () => {
            document.body.classList.toggle('dark', settingsDark.checked);
            darkToggle.checked = settingsDark.checked;
        });
    }

    const autoToggle = document.getElementById('auto-refresh-toggle');
    refreshInterval = setInterval(refreshAll, 5000);
    autoToggle.addEventListener('change', () => {
        if (autoToggle.checked) {
            refreshInterval = setInterval(refreshAll, 5000);
        } else {
            clearInterval(refreshInterval);
        }
    });

    refreshAll();
});
