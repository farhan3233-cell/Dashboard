// ── Client Groups Management Module ────────────────────────────────

let clientGroups = [];
let activeGroupId = 'all';

// Load groups from localStorage or initialize defaults
function loadClientGroups() {
    try {
        const stored = localStorage.getItem('trading_dashboard_client_groups');
        if (stored) {
            clientGroups = JSON.parse(stored);
        }
    } catch(e) {
        console.error("Failed to load client groups:", e);
    }

    if (!Array.isArray(clientGroups) || clientGroups.length === 0) {
        clientGroups = [
            {
                id: 'all',
                name: 'All Accounts',
                accounts: [],
                isDefault: true
            }
        ];
        saveClientGroups();
    }
}

function saveClientGroups() {
    try {
        localStorage.setItem('trading_dashboard_client_groups', JSON.stringify(clientGroups));
    } catch(e) {
        console.error("Failed to save client groups:", e);
    }
}

// Render the main Groups Page
function renderGroupsPage() {
    loadClientGroups();
    
    const accounts = cachedAccounts || [];
    renderGroupTabs();

    let currentGroup = clientGroups.find(g => g.id === activeGroupId);
    if (!currentGroup) {
        activeGroupId = 'all';
        currentGroup = clientGroups[0];
    }

    let groupAccounts = [];
    if (currentGroup.id === 'all' || !currentGroup.accounts || currentGroup.accounts.length === 0) {
        groupAccounts = accounts;
    } else {
        const idSet = new Set(currentGroup.accounts.map(a => String(a)));
        groupAccounts = accounts.filter(a => idSet.has(String(a.account)));
    }

    const titleEl = document.getElementById('selected-group-title');
    const descEl  = document.getElementById('selected-group-desc');
    const countEl = document.getElementById('group-acc-count');
    const actionsEl = document.getElementById('selected-group-actions');

    if (titleEl) titleEl.textContent = currentGroup.name;
    if (descEl) descEl.textContent = `Monitoring ${groupAccounts.length} selected account${groupAccounts.length !== 1 ? 's' : ''} in this client portfolio`;
    if (countEl) countEl.textContent = groupAccounts.length;

    if (actionsEl) {
        if (currentGroup.id === 'all') {
            actionsEl.innerHTML = `<span style="font-size:12px; color:var(--text-muted); align-self:center;">System Default Group</span>`;
        } else {
            actionsEl.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="openGroupModal('${currentGroup.id}')"><i class="ph ph-pencil"></i> Edit Group</button>
                <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="deleteGroup('${currentGroup.id}')"><i class="ph ph-trash"></i> Delete Group</button>
            `;
        }
    }

    renderGroupStats(groupAccounts);
    renderGroupAccountsTable(groupAccounts);
}

// Render tabs for switching between client groups
function renderGroupTabs() {
    const container = document.getElementById('groups-tabs-bar');
    if (!container) return;

    container.innerHTML = clientGroups.map(g => {
        const isActive = g.id === activeGroupId;
        const count = (g.id === 'all' || !g.accounts || g.accounts.length === 0) 
            ? (cachedAccounts ? cachedAccounts.length : 0)
            : g.accounts.length;
        
        return `<button class="btn ${isActive ? 'btn-primary' : 'btn-outline'}" 
            style="border-radius:20px; padding:6px 16px; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px;" 
            onclick="switchClientGroup('${g.id}')">
            <i class="ph ${g.id === 'all' ? 'ph-squares-four' : 'ph-folder-user'}"></i>
            ${g.name} <span class="badge" style="background:${isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-card-secondary)'}; font-size:11px;">${count}</span>
        </button>`;
    }).join('');
}

function switchClientGroup(groupId) {
    activeGroupId = groupId;
    renderGroupsPage();
}

// Compute and display group stat cards
function renderGroupStats(accounts) {
    const grid = document.getElementById('group-stats-grid');
    if (!grid) return;

    let tBal = 0, tEq = 0, tPlT = 0, tPlA = 0, tPos = 0, activeCount = 0;
    accounts.forEach(a => {
        tBal += parseFloat(a.balance || 0);
        tEq  += parseFloat(a.equity || 0);
        tPlT += parseFloat(a.plToday || 0);
        tPlA += parseFloat(a.plAllTime || 0);
        tPos += parseInt(a.openPositions || 0);
        if ((a.status || 'Active').toLowerCase() === 'active') activeCount++;
    });

    const pltSign = tPlT >= 0 ? '+' : '';
    const plaSign = tPlA >= 0 ? '+' : '';

    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title">Group Total Balance</span>
                <i class="ph ph-wallet icon-blue"></i>
            </div>
            <div class="stat-value">$${tBal.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
            <div class="stat-sub">Across ${accounts.length} accounts</div>
        </div>
        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title">Group Total Equity</span>
                <i class="ph ph-currency-dollar icon-purple"></i>
            </div>
            <div class="stat-value">$${tEq.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
            <div class="stat-sub">Active Accounts: ${activeCount}/${accounts.length}</div>
        </div>
        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title">Group Today P/L</span>
                <i class="ph ph-trend-up ${tPlT>=0?'icon-green':'icon-red'}"></i>
            </div>
            <div class="stat-value ${tPlT>=0?'positive':'negative'}">${pltSign}$${Math.abs(tPlT).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}</div>
            <div class="stat-sub ${tPlT>=0?'positive':'negative'}">Group daily profit/loss</div>
        </div>
        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title">Group All-Time P/L</span>
                <i class="ph ph-trophy ${tPlA>=0?'icon-green':'icon-red'}"></i>
            </div>
            <div class="stat-value ${tPlA>=0?'positive':'negative'}">${plaSign}$${Math.abs(tPlA).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}</div>
            <div class="stat-sub">Group total realized profit</div>
        </div>
    `;
}

// Render Accounts table for selected group
function renderGroupAccountsTable(accounts) {
    const tbody = document.getElementById('group-accounts-table-body');
    if (!tbody) return;

    if (!accounts.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--text-muted);">
            <i class="ph ph-folder-open" style="font-size:32px; display:block; margin-bottom:8px;"></i>
            No accounts assigned to this group yet. Click "Edit Group" to add accounts.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = accounts.map(a => {
        const holderName = a.holderName || a.name || ("Account #" + a.account);
        const bal = parseFloat(a.balance || 0);
        const eq  = parseFloat(a.equity || 0);
        const plt = parseFloat(a.plToday || 0);
        const pla = parseFloat(a.plAllTime || 0);
        const op  = parseInt(a.openPositions || 0);
        const st  = (a.status || "Active");
        const bs  = typeof getBrokerStyle === 'function' ? getBrokerStyle(a.broker) : {color:'#3b82f6', icon:'ph-bank'};

        return `<tr>
            <td>
                <strong style="display:block; color:var(--text-main);">${holderName}</strong>
                <span style="font-size:12px; color:var(--text-muted);">ID: ${a.account} (${a.type || 'Real'})</span>
            </td>
            <td>
                <span style="display:inline-flex; align-items:center; gap:6px;">
                    <i class="ph-fill ${bs.icon}" style="color:${bs.color}"></i> ${a.broker || 'MetaTrader 5'}
                </span>
            </td>
            <td><strong>$${bal.toLocaleString('en-US', {minimumFractionDigits:2})}</strong></td>
            <td>$${eq.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
            <td class="${plt >= 0 ? 'positive' : 'negative'}">
                <strong>${plt >= 0 ? '+' : '-'}$${Math.abs(plt).toLocaleString('en-US', {minimumFractionDigits:2})}</strong>
            </td>
            <td class="${pla >= 0 ? 'positive' : 'negative'}">
                <strong>${pla >= 0 ? '+' : '-'}$${Math.abs(pla).toLocaleString('en-US', {minimumFractionDigits:2})}</strong>
            </td>
            <td><span class="badge" style="background:var(--bg-card-secondary); color:var(--text-main);">${op} open</span></td>
            <td>
                <span class="status-badge ${st.toLowerCase() === 'active' ? 'status-active' : 'status-disconnected'}">
                    <span class="dot"></span> ${st}
                </span>
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="navigateTo('accounts')" title="View Account Details">
                    <i class="ph ph-eye"></i> View
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Group Modal Logic ──────────────────────────────────────────────

function openGroupModal(groupId = null) {
    loadClientGroups();
    const modal = document.getElementById('group-modal-overlay');
    const title = document.getElementById('group-modal-title');
    const idInput = document.getElementById('modal-group-id');
    const nameInput = document.getElementById('modal-group-name');
    const checkboxContainer = document.getElementById('modal-accounts-checkboxes');

    if (!modal) return;

    let targetGroup = null;
    if (groupId) {
        targetGroup = clientGroups.find(g => g.id === groupId);
    }

    if (targetGroup) {
        title.innerHTML = `<i class="ph ph-pencil"></i> Edit Client Group`;
        idInput.value = targetGroup.id;
        nameInput.value = targetGroup.name;
    } else {
        title.innerHTML = `<i class="ph ph-folder-user"></i> Create Client Group`;
        idInput.value = '';
        nameInput.value = '';
    }

    const allAccounts = cachedAccounts || [];
    const selectedSet = new Set(targetGroup && targetGroup.accounts ? targetGroup.accounts.map(a => String(a)) : []);

    if (!allAccounts.length) {
        checkboxContainer.innerHTML = `<p style="color:var(--text-muted); font-size:13px; padding:10px;">No connected accounts available.</p>`;
    } else {
        checkboxContainer.innerHTML = allAccounts.map(a => {
            const accId = String(a.account);
            const isChecked = selectedSet.has(accId);
            const name = a.holderName || a.name || `Account #${accId}`;
            return `<label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer; padding:8px 10px; border-radius:6px; background:var(--bg-card); border:1px solid var(--border-color);">
                <input type="checkbox" class="group-acc-checkbox" value="${accId}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary);">
                <span><strong>${name}</strong> (ID: ${accId} - ${a.broker || 'MT5'})</span>
            </label>`;
        }).join('');
    }

    modal.style.display = 'flex';
}

function closeGroupModal(e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('group-modal-overlay');
    if (modal) modal.style.display = 'none';
}

function saveGroupModal() {
    const idInput = document.getElementById('modal-group-id').value;
    const nameInput = document.getElementById('modal-group-name').value.trim();
    if (!nameInput) {
        alert('Please enter a Group / Client Name.');
        return;
    }

    const checkboxes = document.querySelectorAll('.group-acc-checkbox:checked');
    const selectedAccs = Array.from(checkboxes).map(cb => cb.value);

    loadClientGroups();

    if (idInput) {
        const grp = clientGroups.find(g => g.id === idInput);
        if (grp) {
            grp.name = nameInput;
            grp.accounts = selectedAccs;
        }
    } else {
        const newGroup = {
            id: 'group_' + Date.now(),
            name: nameInput,
            accounts: selectedAccs
        };
        clientGroups.push(newGroup);
        activeGroupId = newGroup.id;
    }

    saveClientGroups();
    closeGroupModal();
    renderGroupsPage();
}

function deleteGroup(groupId) {
    if (groupId === 'all') {
        alert('Cannot delete the default All Accounts group.');
        return;
    }
    if (confirm('Are you sure you want to delete this client group?')) {
        loadClientGroups();
        clientGroups = clientGroups.filter(g => g.id !== groupId);
        activeGroupId = 'all';
        saveClientGroups();
        renderGroupsPage();
    }
}
