// ── Date Picker Logic ────────────────────────────────────────────
// Tracks currently active date period
let activePeriod = 'today';
let periodFromTs = 0;
let periodToTs   = 0;

// Compute unix timestamp range (UTC) for a given period key
function getPeriodRange(period) {
    const now = new Date();

    // Helper: start of today in UTC (midnight)
    function todayStart() {
        const d = new Date(now);
        d.setUTCHours(0, 0, 0, 0);
        return Math.floor(d.getTime() / 1000);
    }

    switch (period) {
        case 'today': {
            const s = todayStart();
            return { from: s, to: Math.floor(now.getTime() / 1000), label: 'Today' };
        }
        case 'yesterday': {
            const s = todayStart() - 86400;
            return { from: s, to: todayStart() - 1, label: 'Yesterday' };
        }
        case 'week': {
            // Start of current ISO week (Monday)
            const d = new Date(now);
            const day = d.getUTCDay() || 7;          // 0=Sun → 7
            d.setUTCDate(d.getUTCDate() - day + 1);  // Monday
            d.setUTCHours(0, 0, 0, 0);
            return { from: Math.floor(d.getTime() / 1000), to: Math.floor(now.getTime() / 1000), label: 'This Week' };
        }
        case 'month': {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            return { from: Math.floor(d.getTime() / 1000), to: Math.floor(now.getTime() / 1000), label: 'This Month' };
        }
        case 'last_month': {
            const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
            const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            return { from: Math.floor(start.getTime() / 1000), to: Math.floor(end.getTime() / 1000) - 1, label: 'Last Month' };
        }
        case 'alltime': {
            return { from: 0, to: Math.floor(now.getTime() / 1000), label: 'All Time' };
        }
        default:
            return { from: 0, to: Math.floor(now.getTime() / 1000), label: 'All Time' };
    }
}

// Compute P/L from cachedHistory for a timestamp range
function computePeriodPL(fromTs, toTs) {
    let total = 0;
    let count = 0;
    (cachedHistory || []).forEach(d => {
        const entry = (d.entry || 'out').toLowerCase();
        if (!['out', 'out_by', 'inout'].includes(entry)) return;
        const t = parseInt(d.time || 0);
        if (t < fromTs || t > toTs) return;
        const pnl = (d.totalPnl !== undefined)
            ? parseFloat(d.totalPnl)
            : (parseFloat(d.profit || 0) + parseFloat(d.swap || 0) + parseFloat(d.commission || 0));
        total += pnl;
        count++;
    });
    return { total, count };
}

// Select a preset period and update the UI
function selectPeriod(period, btn) {
    // Highlight active button
    document.querySelectorAll('.dp-period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    activePeriod = period;
    const range = getPeriodRange(period);
    periodFromTs = range.from;
    periodToTs   = range.to;

    // Update button label
    const headerDate = document.getElementById('header-date');
    if (headerDate) headerDate.textContent = range.label;

    // Compute and display P/L in the dropdown result box
    showPeriodResult(range.label, periodFromTs, periodToTs);

    // Update the "Total P/L (Today)" stat card on the dashboard
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
    // Parse as UTC midnight
    periodFromTs = Math.floor(new Date(fromVal + 'T00:00:00Z').getTime() / 1000);
    periodToTs   = Math.floor(new Date(toVal   + 'T23:59:59Z').getTime() / 1000);
    activePeriod = 'custom';

    // Deactivate preset buttons
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

    // P/L as % of total balance
    let pctText = '';
    if (typeof cachedAccounts !== 'undefined' && cachedAccounts.length > 0) {
        const tBal = cachedAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);
        if (tBal > 0) {
            const pct = (total / tBal) * 100;
            pctText = ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        }
    }
    subEl.textContent = count + ' closed deal' + (count !== 1 ? 's' : '') + pctText;
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

// Update all-time P/L stat card directly from history (bypass account data)
function updateAllTimePLFromHistory() {
    const valEl = document.getElementById('stat-pl-alltime');
    const pctEl = document.getElementById('stat-pl-alltime-pct');
    if (!valEl) return;

    const { total, count } = computePeriodPL(0, Math.floor(Date.now() / 1000));
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
        pctEl.textContent = count + ' total deals';
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

    // Refresh result when opening
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

// Initialize on DOM ready — set today's period as default
document.addEventListener('DOMContentLoaded', () => {
    const range = getPeriodRange('today');
    periodFromTs = range.from;
    periodToTs   = range.to;

    // Set default date input values for custom range
    const today = new Date().toISOString().split('T')[0];
    const fromInput = document.getElementById('dp-from');
    const toInput   = document.getElementById('dp-to');
    if (fromInput) fromInput.value = today;
    if (toInput)   toInput.value   = today;
});
