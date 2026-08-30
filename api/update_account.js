import fs from 'fs';

const DB_FILE = '/tmp/db.json';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body.replace(/\0/g, '').trim());
        } catch (e) {}
    }

    if (!body || !body.account) {
        return res.status(400).json({ status: 'error', message: "'account' field is required." });
    }

    let db = { accounts: {}, positions: {}, orders: {}, history: {}, alerts: [] };
    try {
        if (fs.existsSync(DB_FILE)) {
            db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {}

    const accountId = String(body.account);
    const accountInfo = {};
    for (const [k, v] of Object.entries(body)) {
        if (!['positions', 'orders', 'history'].includes(k)) {
            accountInfo[k] = v;
        }
    }
    accountInfo.lastSeen = Math.floor(Date.now() / 1000);

    const incomingHolder = String(accountInfo.holderName || '').trim();
    const existingHolder = String(db.accounts[accountId]?.holderName || '').trim();

    if (existingHolder && !existingHolder.startsWith('Account #') && (!incomingHolder || incomingHolder.startsWith('Account #'))) {
        accountInfo.holderName = existingHolder;
    } else if (!incomingHolder) {
        accountInfo.holderName = existingHolder || `Account #${accountId}`;
    }

    db.accounts[accountId] = { ...(db.accounts[accountId] || {}), ...accountInfo };

    if (Array.isArray(body.positions)) db.positions[accountId] = body.positions;
    if (Array.isArray(body.orders)) db.orders[accountId] = body.orders;
    if (Array.isArray(body.history)) db.history[accountId] = body.history;

    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {}

    return res.status(200).json({ status: 'success', message: `Account ${accountId} updated.` });
}
