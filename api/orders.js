import fs from 'fs';
const DB_FILE = '/tmp/db.json';

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let db = { accounts: {}, orders: {} };
    try { if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
    const allOrders = [];
    for (const [accId, orders] of Object.entries(db.orders || {})) {
        if (Array.isArray(orders)) {
            orders.forEach(o => {
                allOrders.push({ ...o, _account: accId, _broker: db.accounts?.[accId]?.broker || '' });
            });
        }
    }
    return res.status(200).json({ status: 'success', data: allOrders });
}
