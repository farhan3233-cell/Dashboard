// ── Client Groups Management Module ────────────────────────────────

let clientGroups = [];
let currentGroupView = 'list'; // 'list' | 'create' | 'edit' | 'detail'
let selectedGroupId = null;
let editingGroupId = null;

function loadClientGroups() {
    try {
        const stored = localStorage.getItem('trading_dashboard_client_groups');
        if (stored) {
            clientGroups = JSON.parse(stored);
        }
    } catch(e) {
        console.error("Failed to load client groups:", e);
    }
    if (!Array.isArray(clientGroups)) {
        clientGroups = [];
    }
}

function saveClientGroups() {
    try {
        localStorage.setItem('trading_dashboard_client_groups', JSON.stringify(clientGroups));
    } catch(e) {
        console.error("Failed to save client groups:", e);
    }
}

function renderGroupsPage() {
    loadClientGroups();
    const container = document.getElementById('groups-page-container');
    if (!container) return;

    if (currentGroupView === 'create' || currentGroupView === 'edit') {
        renderGroupCreateForm(container);
    } else if (currentGroupView === 'detail' && selectedGroupId) {
        renderGroupDetailView(container);
    } else {
        renderGroupsList(container);
    }
}

// ── State 1: List of Created Client Groups ─────────────────────────
function renderGroupsList(container) {
    const accounts = cachedAccounts || [];

    if (!clientGroups || !clientGroups.length) {
        container.innerHTML = `
            <div class="card" style="padding:40px; text-align:center; max-width:600px; margin:40px auto; background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px;">
                <div style="width:64px; height:64px; border-radius:50%; background:var(--blue-light); display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px;">
                    <i class="ph ph-folder-user" style="font-size:32px; color:var(--blue);"></i>
                </div>
                <h2 style="margin:0 0 8px 0; font-size:20px; color:var(--text-primary);">No Client Groups Created</h2>
                <p style="color:var(--text-secondary); font-size:14px; margin-bottom:24px;">Create a client group to separate and monitor portfolio performance for specific clients.</p>
                <button class="btn btn-primary" onclick="showGroupCreateForm()" style="padding:12px 24px; font-size:15px;">
                    <i class="ph ph-plus-circle"></i> Create Client Group
                </button>
            </div>
        `;
        return;
    }

    const cardsHtml = clientGroups.map(grp => {
        const idSet = new Set((grp.accounts || []).map(a => String(a)));
        const grpAccounts = accounts.filter(a => idSet.has(String(a.account)));

        let tBal = 0, tEq = 0, tPlT = 0, tPlA = 0;
        grpAccounts.forEach(a => {
            tBal += parseFloat(a.balance || 0);
            tEq  += parseFloat(a.equity || 0);
            tPlT += parseFloat(a.plToday || 0);
            tPlA += parseFloat(a.plAllTime || 0);
        });

        const pltSign = tPlT >= 0 ? '+' : '';

        return `
            <div class="card" style="padding:20px; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s; background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px;" onclick="openGroupDetail('${grp.id}')">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                    <div>
                        <h3 style="margin:0; font-size:18px; color:var(--text-primary); font-weight:700;">${grp.name}</h3>
                        <span class="badge" style="background:var(--main-bg); color:var(--text-secondary); font-size:12px; margin-top:4px; display:inline-block; padding:4px 8px; border-radius:6px;">
                            <i class="ph ph-users"></i> ${grpAccounts.length} Account${grpAccounts.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div onclick="event.stopPropagation();" style="display:flex; gap:6px;">
                        <button class="btn btn-outline btn-sm" onclick="showGroupEditForm('${grp.id}')" title="Edit Group"><i class="ph ph-pencil"></i></button>
                        <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteGroup('${grp.id}')" title="Delete Group"><i class="ph ph-trash"></i></button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px; background:var(--main-bg); border-radius:8px; margin-bottom:16px;">
                    <div>
                        <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Total Capital</span>
                        <div style="font-size:16px; font-weight:700; color:var(--text-primary);">$${tBal.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                    </div>
                    <div>
                        <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Today P/L</span>
                        <div style="font-size:16px; font-weight:700;" class="${tPlT>=0?'positive':'negative'}">${pltSign}$${Math.abs(tPlT).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                    </div>
                </div>

                <button class="btn btn-outline" style="width:100%; justify-content:center;">
                    <i class="ph ph-eye"></i> View Client Dashboard
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
                <h2 style="margin:0; font-size:22px; font-weight:700; color:var(--text-primary);">Client Groups (${clientGroups.length})</h2>
                <p style="margin:4px 0 0 0; font-size:13px; color:var(--text-secondary);">Select a client group to view its dedicated dashboard and accounts</p>
            </div>
            <button class="btn btn-primary" onclick="showGroupCreateForm()">
                <i class="ph ph-plus-circle"></i> Create New Group
            </button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:20px; margin-bottom:32px;">
            ${cardsHtml}
        </div>

        <div style="text-align:center; padding:24px; background:var(--card-bg); border:1px dashed var(--border-color); border-radius:12px;">
            <button class="btn btn-primary" onclick="showGroupCreateForm()" style="padding:10px 24px;">
                <i class="ph ph-plus-circle"></i> Create New Client Group
            </button>
        </div>
    `;
}

// ── State 2: Create / Edit Group Form ──────────────────────────────
function renderGroupCreateForm(container) {
    const isEdit = currentGroupView === 'edit' && editingGroupId;
    const targetGrp = isEdit ? clientGroups.find(g => g.id === editingGroupId) : null;

    const groupName = targetGrp ? targetGrp.name : '';
    const selectedSet = new Set(targetGrp && targetGrp.accounts ? targetGrp.accounts.map(a => String(a)) : []);
    const allAccounts = cachedAccounts || [];

    let checkboxesHtml = '';
    if (!allAccounts.length) {
        checkboxesHtml = `<p style="color:var(--text-secondary); font-size:13px; padding:12px;">No connected accounts available. Please attach DashboardSync EA to MT5 charts first.</p>`;
    } else {
        checkboxesHtml = allAccounts.map(a => {
            const accId = String(a.account);
            const isChecked = selectedSet.has(accId);
            const name = a.holderName || a.name || `Account #${accId}`;
            const bal = parseFloat(a.balance || 0);
            return `
                <label style="display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--main-bg); border:1px solid var(--border-color); border-radius:8px; cursor:pointer;">
                    <input type="checkbox" class="form-group-acc-cb" value="${accId}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--blue);">
                    <div style="flex:1;">
                        <strong style="color:var(--text-primary); font-size:14px; display:block;">${name}</strong>
                        <span style="font-size:12px; color:var(--text-secondary);">Account ID: ${accId} | Broker: ${a.broker || 'MT5'} | Balance: $${bal.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
                    </div>
                </label>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div style="margin-bottom:20px;">
            <button class="btn btn-outline" onclick="cancelGroupForm()"><i class="ph ph-arrow-left"></i> Back to Client Groups</button>
        </div>

        <div class="card" style="max-width:700px; margin:0 auto; padding:28px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px;">
            <h2 style="margin:0 0 6px 0; font-size:20px; font-weight:700; color:var(--text-primary);">
                <i class="ph ${isEdit ? 'ph-pencil' : 'ph-folder-user'}" style="margin-right:8px; color:var(--blue);"></i>
                ${isEdit ? 'Edit Client Group' : 'Create New Client Group'}
            </h2>
            <p style="margin:0 0 24px 0; font-size:13px; color:var(--text-secondary);">
                Enter group name and select accounts to monitor in this client group.
            </p>

            <div style="margin-bottom:20px;">
                <label style="display:block; font-size:13px; font-weight:600; margin-bottom:8px; color:var(--text-primary);">Client / Group Name *</label>
                <input type="text" id="form-group-name" value="${groupName}" placeholder="e.g. Farhan Sayyed" style="width:100%; padding:12px 16px; background:var(--main-bg); border:1px solid var(--border-color); border-radius:8px; color:var(--text-primary); font-size:14px; box-sizing:border-box;">
            </div>

            <div style="margin-bottom:24px;">
                <label style="display:block; font-size:13px; font-weight:600; margin-bottom:8px; color:var(--text-primary);">Select Available Accounts for this Group</label>
                <div style="display:flex; flex-direction:column; gap:10px; max-height:320px; overflow-y:auto; padding:4px 0;">
                    ${checkboxesHtml}
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid var(--border-color); padding-top:20px;">
                <button class="btn btn-outline" onclick="cancelGroupForm()">Cancel</button>
                <button class="btn btn-primary" onclick="submitGroupForm('${isEdit ? editingGroupId : ''}')" style="padding:10px 24px;">
                    <i class="ph ph-check-circle"></i> ${isEdit ? 'Save Changes' : 'Create Group'}
                </button>
            </div>
        </div>
    `;
}

// ── State 3: Dashboard View for Selected Group ─────────────────────
function renderGroupDetailView(container) {
    const grp = clientGroups.find(g => g.id === selectedGroupId);
    if (!grp) {
        currentGroupView = 'list';
        renderGroupsList(container);
        return;
    }

    const accounts = cachedAccounts || [];
    const idSet = new Set((grp.accounts || []).map(a => String(a)));
    const grpAccounts = accounts.filter(a => idSet.has(String(a.account)));

    let tBal = 0, tEq = 0, tPlT = 0, tPlA = 0, tPos = 0, activeCount = 0;
    grpAccounts.forEach(a => {
        tBal += parseFloat(a.balance || 0);
        tEq  += parseFloat(a.equity || 0);
        tPlT += parseFloat(a.plToday || 0);
        tPlA += parseFloat(a.plAllTime || 0);
        tPos += parseInt(a.openPositions || 0);
        if ((a.status || 'Active').toLowerCase() === 'active') activeCount++;
    });

    const pltSign = tPlT >= 0 ? '+' : '';
    const plaSign = tPlA >= 0 ? '+' : '';

    const rowsHtml = grpAccounts.length === 0 
        ? `<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">No accounts assigned to this group yet. Click "Edit Group" to add accounts.</td></tr>`
        : grpAccounts.map(d => {
            const holderName = d.holderName || d.name || ("Account #" + d.account);
            const bal = parseFloat(d.balance || 0);
            const plt = parseFloat(d.plToday || 0);
            const pla = parseFloat(d.plAllTime || 0);
            const pltPct = parseFloat(d.plTodayPct || 0);
            const plaPct = parseFloat(d.plAllTimePct || 0);
            const st = (d.status || "Active");
            const bs = typeof getBrokerStyle === 'function' ? getBrokerStyle(d.broker) : {color:'#3b82f6', icon:'ph-bank'};

            return `<tr>
                <td>
                    <div style="display:flex;align-items:center;gap:6px">
                        <span class="account-name font-weight-bold" style="font-weight:600;color:var(--text-primary);">${holderName}</span>
                    </div>
                </td>
                <td><div class="account-cell"><span class="account-name">${d.account}</span><span class="account-type">${d.type||"Real"}</span></div></td>
                <td><div class="broker-cell"><div class="broker-logo" style="color:${bs.color}"><i class="ph-fill ${bs.icon}"></i></div><span>${d.broker||"—"}</span></div></td>
                <td>${fmtPlain$(bal)}</td>
                <td><div class="pl-cell"><span class="pl-val ${plt>=0?'positive':'negative'}">${fmt$(plt)}</span><span class="pl-pct ${pltPct>=0?'positive':'negative'}">${fmtPct(pltPct)}</span></div></td>
                <td><div class="pl-cell"><span class="pl-val ${pla>=0?'positive':'negative'}">${fmt$(pla)}</span><span class="pl-pct ${plaPct>=0?'positive':'negative'}">${fmtPct(plaPct)}</span></div></td>
                <td><span class="status-pill ${st.toLowerCase()}">${st}</span></td>
                <td>
                    <button class="actions-btn" onclick="navigateTo('accounts')" title="View Account Details"><i class="ph ph-eye"></i></button>
                </td>
            </tr>`;
        }).join('');

    container.innerHTML = `
        <!-- Top Toolbar -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <button class="btn btn-outline" onclick="backToGroupsList()"><i class="ph ph-arrow-left"></i> All Client Groups</button>
                <h2 style="margin:0; font-size:22px; font-weight:700; color:var(--text-primary);">${grp.name}</h2>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-outline btn-sm" onclick="showGroupEditForm('${grp.id}')"><i class="ph ph-pencil"></i> Edit Group</button>
                <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteGroup('${grp.id}')"><i class="ph ph-trash"></i> Delete Group</button>
            </div>
        </div>

        <!-- Dashboard Stat Cards (4 Cards) -->
        <section class="stats-grid" style="margin-bottom:24px;">
            <div class="card stat-card">
                <div class="stat-card-header">
                    <span class="stat-title">Client Total Balance</span>
                    <div class="stat-icon blue"><i class="ph ph-wallet"></i></div>
                </div>
                <div class="stat-value">$${tBal.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <div class="stat-subtitle"><span>Across ${grpAccounts.length} selected accounts</span></div>
            </div>

            <div class="card stat-card">
                <div class="stat-card-header">
                    <span class="stat-title">Client Total Equity</span>
                    <div class="stat-icon purple"><i class="ph ph-currency-dollar"></i></div>
                </div>
                <div class="stat-value">$${tEq.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <div class="stat-subtitle"><span>Active Accounts: ${activeCount}/${grpAccounts.length}</span></div>
            </div>

            <div class="card stat-card">
                <div class="stat-card-header">
                    <span class="stat-title">Client Today's P/L</span>
                    <div class="stat-icon ${tPlT>=0?'green':'red'}"><i class="ph ph-trend-up"></i></div>
                </div>
                <div class="stat-value ${tPlT>=0?'positive':'negative'}">${pltSign}$${Math.abs(tPlT).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <div class="stat-subtitle"><span class="${tPlT>=0?'positive':'negative'}">Client daily closed deals</span></div>
            </div>

            <div class="card stat-card">
                <div class="stat-card-header">
                    <span class="stat-title">Client All-Time P/L</span>
                    <div class="stat-icon ${tPlA>=0?'green':'red'}"><i class="ph ph-trophy"></i></div>
                </div>
                <div class="stat-value ${tPlA>=0?'positive':'negative'}">${plaSign}$${Math.abs(tPlA).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <div class="stat-subtitle"><span>Realized total profit</span></div>
            </div>
        </section>

        <!-- Dashboard Accounts Table -->
        <section class="card table-card">
            <div class="table-header">
                <h2>Accounts in ${grp.name} (${grpAccounts.length})</h2>
            </div>
            <div class="table-responsive">
                <table class="accounts-table">
                    <thead><tr>
                        <th>Account Holder</th><th>Account ID</th><th>Broker</th><th>Balance</th>
                        <th>P/L (Today)</th><th>P/L (All Time)</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </section>
    `;
}

// ── Control Actions ────────────────────────────────────────────────
function showGroupCreateForm() {
    currentGroupView = 'create';
    editingGroupId = null;
    renderGroupsPage();
}

function showGroupEditForm(id) {
    currentGroupView = 'edit';
    editingGroupId = id;
    renderGroupsPage();
}

function openGroupDetail(id) {
    currentGroupView = 'detail';
    selectedGroupId = id;
    renderGroupsPage();
}

function backToGroupsList() {
    currentGroupView = 'list';
    selectedGroupId = null;
    renderGroupsPage();
}

function cancelGroupForm() {
    if (selectedGroupId && currentGroupView === 'edit') {
        currentGroupView = 'detail';
    } else {
        currentGroupView = 'list';
    }
    renderGroupsPage();
}

function submitGroupForm(editId) {
    const nameInput = document.getElementById('form-group-name');
    const nameVal = nameInput ? nameInput.value.trim() : '';

    if (!nameVal) {
        alert('Please enter a Group / Client Name.');
        return;
    }

    const checkboxes = document.querySelectorAll('.form-group-acc-cb:checked');
    const selectedAccs = Array.from(checkboxes).map(cb => cb.value);

    loadClientGroups();

    if (editId) {
        const grp = clientGroups.find(g => g.id === editId);
        if (grp) {
            grp.name = nameVal;
            grp.accounts = selectedAccs;
        }
        selectedGroupId = editId;
    } else {
        const newGroup = {
            id: 'group_' + Date.now(),
            name: nameVal,
            accounts: selectedAccs
        };
        clientGroups.push(newGroup);
        selectedGroupId = newGroup.id;
    }

    saveClientGroups();
    currentGroupView = 'detail';
    renderGroupsPage();
}

function deleteGroup(groupId) {
    if (confirm('Are you sure you want to delete this client group?')) {
        loadClientGroups();
        clientGroups = clientGroups.filter(g => g.id !== groupId);
        saveClientGroups();
        currentGroupView = 'list';
        selectedGroupId = null;
        renderGroupsPage();
    }
}

// Auto render on load
document.addEventListener("DOMContentLoaded", () => {
    renderGroupsPage();
});
