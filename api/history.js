import fs from 'fs';
const DB_FILE = '/tmp/db.json';

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let db = { accounts: {}, history: {} };
    try { if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
    const allHistory = [];
    for (const [accId, deals] of Object.entries(db.history || {})) {
        if (Array.isArray(deals)) {
            deals.forEach(d => {
                allHistory.push({ ...d, _account: accId, _broker: db.accounts?.[accId]?.broker || '' });
            });
        }
    }
    return res.status(200).json({ status: 'success', data: allHistory });
}
