// ── Date Picker Logic ────────────────────────────────────────────
// Tracks currently active date period
let activePeriod = 'today';
let periodFromTs = 0;
let periodToTs   = 0;

// Compute unix timestamp range for a given period key
function getPeriodRange(period) {
    const now = new Date();

    // Start of today (local / midnight)
    function todayStart() {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        return Math.floor(d.getTime() / 1000);
    }

    switch (period) {
        case 'today': {
            const s = todayStart();
            return { from: s - 86400, to: Math.floor(now.getTime() / 1000) + 86400, label: 'Today' };
        }
        case 'yesterday': {
            const s = todayStart() - 86400;
            return { from: s, to: todayStart() - 1, label: 'Yesterday' };
        }
        case 'week': {
            const d = new Date(now);
            const day = d.getDay() || 7;
            d.setDate(d.getDate() - day + 1);
            d.setHours(0, 0, 0, 0);
            return { from: Math.floor(d.getTime() / 1000), to: Math.floor(now.getTime() / 1000) + 86400, label: 'This Week' };
        }
        case 'month': {
            const d = new Date(now.getFullYear(), now.getMonth(), 1);
            return { from: Math.floor(d.getTime() / 1000), to: Math.floor(now.getTime() / 1000) + 86400, label: 'This Month' };
        }
        case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end   = new Date(now.getFullYear(), now.getMonth(), 1);
            return { from: Math.floor(start.getTime() / 1000), to: Math.floor(end.getTime() / 1000) - 1, label: 'Last Month' };
        }
        case 'alltime': {
            return { from: 0, to: Math.floor(now.getTime() / 1000) + 86400, label: 'All Time' };
        }
        default:
            return { from: 0, to: Math.floor(now.getTime() / 1000) + 86400, label: 'All Time' };
    }
}

// Compute P/L from cachedHistory for a timestamp range
function computePeriodPL(fromTs, toTs) {
    let total = 0;
    let count = 0;
    const history = cachedHistory || [];

    if (history.length > 0) {
        history.forEach(d => {
            const dealType = String(d.type || '').toLowerCase();
            if (dealType !== 'buy' && dealType !== 'sell') return;

            const entry = String(d.entry || '').toLowerCase();
            if (entry === 'in' || entry === '0') return;

            const t = parseInt(d.time || 0);
            if (fromTs > 0 && t > 0 && (t < fromTs || t > toTs)) return;

            const pnl = (d.totalPnl !== undefined && d.totalPnl !== null)
                ? parseFloat(d.totalPnl)
                : (parseFloat(d.profit || 0) + parseFloat(d.swap || 0) + parseFloat(d.commission || 0));
            
            total += pnl;
            count++;
        });
    }

    // Fallback: If history deals were not sent or period is 'today' / 'alltime', use account-level P/L sums
    if (count === 0 && typeof cachedAccounts !== 'undefined' && cachedAccounts.length > 0) {
        if (activePeriod === 'today') {
            total = cachedAccounts.reduce((s, a) => s + parseFloat(a.plToday || 0), 0);
            count = cachedAccounts.length;
        } else if (activePeriod === 'alltime') {
            total = cachedAccounts.reduce((s, a) => s + parseFloat(a.plAllTime || 0), 0);
            count = cachedAccounts.length;
        }
    }

    return { total, count };
}

// Select a preset period and update the UI
function selectPeriod(period, btn) {
    document.querySelectorAll('.dp-period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    activePeriod = period;
    const range = getPeriodRange(period);
    periodFromTs = range.from;
    periodToTs   = range.to;

    const headerDate = document.getElementById('header-date');
    if (headerDate) headerDate.textContent = range.label;

    showPeriodResult(range.label, periodFromTs, periodToTs);
    updateDashboardPeriodCard(range.label, periodFromTs, periodToTs);
}

// Apply custom date range
function applyCustomRange() {
    const fromVal = document.getElementById('dp-from').value;
    const toVal   = document.getElementById('dp-to').value;
    if (!fromVal || !toVal) {
        alert('Please select both From and To dates.');
        return;
    }

    periodFromTs = Math.floor(new Date(fromVal + 'T00:00:00').getTime() / 1000);
    periodToTs   = Math.floor(new Date(toVal   + 'T23:59:59').getTime() / 1000);
    activePeriod = 'custom';

    document.querySelectorAll('.dp-period-btn').forEach(b => b.classList.remove('active'));

    const label = `${fromVal} → ${toVal}`;
    const headerDate = document.getElementById('header-date');
    if (headerDate) headerDate.textContent = label;

    showPeriodResult(label, periodFromTs, periodToTs);
    updateDashboardPeriodCard(label, periodFromTs, periodToTs);
}

// Show P/L result inside the dropdown panel
function showPeriodResult(label, fromTs, toTs) {
    const box = document.getElementById('dp-result-box');
    const valEl = document.getElementById('dp-result-value');
    const subEl = document.getElementById('dp-result-sub');
    const lblEl = document.getElementById('dp-result-label');
    if (!box) return;

    const { total, count } = computePeriodPL(fromTs, toTs);

    box.style.display = 'block';
    lblEl.textContent = label + ' P/L';

    const sign = total >= 0 ? '+' : '';
    valEl.textContent = sign + '$' + Math.abs(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    valEl.className = 'dp-result-value ' + (total >= 0 ? 'positive' : 'negative');

    let pctText = '';
    if (typeof cachedAccounts !== 'undefined' && cachedAccounts.length > 0) {
        const tBal = cachedAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);
        if (tBal > 0) {
            const pct = (total / tBal) * 100;
            pctText = ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        }
    }
    subEl.textContent = count + ' deal' + (count !== 1 ? 's' : '') + pctText;
}

// Update the "Total P/L (Today/Period)" stat card on dashboard
function updateDashboardPeriodCard(label, fromTs, toTs) {
    const labelEl = document.getElementById('stat-pl-period-label');
    const valEl   = document.getElementById('stat-pl-today');
    const pctEl   = document.getElementById('stat-pl-today-pct');
    if (!labelEl || !valEl) return;

    labelEl.textContent = 'Total P/L (' + label + ')';

    const { total, count } = computePeriodPL(fromTs, toTs);

    const sign = total >= 0 ? '+' : '-';
    valEl.textContent = sign + '$' + Math.abs(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    valEl.className = 'stat-value ' + (total >= 0 ? 'positive' : 'negative');

    if (typeof cachedAccounts !== 'undefined' && cachedAccounts.length > 0) {
        const tBal = cachedAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);
        if (tBal > 0) {
            const pct = (total / tBal) * 100;
            pctEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
            pctEl.className = total >= 0 ? 'positive' : 'negative';
        }
    } else {
        pctEl.textContent = count + ' deals';
    }
}

// Update all-time P/L stat card
function updateAllTimePLFromHistory() {
    const valEl = document.getElementById('stat-pl-alltime');
    const pctEl = document.getElementById('stat-pl-alltime-pct');
    if (!valEl) return;

    if (typeof cachedAccounts === 'undefined' || !cachedAccounts.length) {
        valEl.textContent = "$0.00";
        if (pctEl) pctEl.textContent = "0.00%";
        return;
    }

    // Sum plAllTime across all connected accounts for accurate All-Time P/L
    const totalAllTime = cachedAccounts.reduce((sum, a) => sum + parseFloat(a.plAllTime || 0), 0);
    const totalBalance = cachedAccounts.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

    const sign = totalAllTime >= 0 ? '+' : '-';
    valEl.textContent = sign + '$' + Math.abs(totalAllTime).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    valEl.className = 'stat-value ' + (totalAllTime >= 0 ? 'positive' : 'negative');

    if (pctEl) {
        const startBal = totalBalance - totalAllTime;
        const pct = startBal > 0 ? (totalAllTime / startBal) * 100 : (totalBalance > 0 ? (totalAllTime / totalBalance) * 100 : 0);
        pctEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        pctEl.className = totalAllTime >= 0 ? 'positive' : 'negative';
    }
}

// Toggle date picker panel open/close
function toggleDatePicker(event) {
    event.stopPropagation();
    const panel = document.getElementById('date-picker-dropdown');
    const caret = document.getElementById('date-picker-caret');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (caret) caret.style.transform = isOpen ? '' : 'rotate(180deg)';

    if (!isOpen) {
        showPeriodResult(
            document.getElementById('header-date')?.textContent || 'Today',
            periodFromTs,
            periodToTs
        );
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('date-picker-wrapper');
    const panel   = document.getElementById('date-picker-dropdown');
    const caret   = document.getElementById('date-picker-caret');
    if (wrapper && panel && !wrapper.contains(e.target)) {
        panel.style.display = 'none';
        if (caret) caret.style.transform = '';
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const range = getPeriodRange('today');
    periodFromTs = range.from;
    periodToTs   = range.to;

    const today = new Date().toISOString().split('T')[0];
    const fromInput = document.getElementById('dp-from');
    const toInput   = document.getElementById('dp-to');
    if (fromInput) fromInput.value = today;
    if (toInput)   toInput.value   = today;
});
