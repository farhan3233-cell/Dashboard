import fs from 'fs';
const DB_FILE = '/tmp/db.json';

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { query } = req;
    const accountId = query.account_id || (req.url ? req.url.split('/').pop() : '');

    if (accountId) {
        let db = { accounts: {}, positions: {}, orders: {}, history: {} };
        try { if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
        const accStr = String(accountId);
        delete db.accounts[accStr];
        delete db.positions[accStr];
        delete db.orders[accStr];
        delete db.history[accStr];
        try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); } catch (e) {}
        return res.status(200).json({ status: 'success', message: `Account ${accStr} deleted` });
    }
    return res.status(400).json({ status: 'error', message: 'Account ID required' });
}
