import fs from 'fs';
const DB_FILE = '/tmp/db.json';

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let db = { accounts: {}, positions: {} };
    try { if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
    const accounts = Object.values(db.accounts || {});
    const totalBalance = accounts.reduce((acc, a) => acc + (parseFloat(a.balance) || 0), 0);
    const totalEquity = accounts.reduce((acc, a) => acc + (parseFloat(a.equity) || 0), 0);
    const totalPlToday = accounts.reduce((acc, a) => acc + (parseFloat(a.plToday) || 0), 0);
    const totalPlAllTime = accounts.reduce((acc, a) => acc + (parseFloat(a.plAllTime) || 0), 0);
    const totalPositions = accounts.reduce((acc, a) => acc + (parseInt(a.openPositions) || 0), 0);
    const activeCount = accounts.filter(a => String(a.status || 'Active').toLowerCase() === 'active').length;

    return res.status(200).json({
        status: 'success',
        data: {
            totalAccounts: accounts.length,
            activeAccounts: activeCount,
            inactiveAccounts: accounts.length - activeCount,
            totalBalance,
            totalEquity,
            totalPlToday,
            totalPlAllTime,
            openPositions: totalPositions
        }
    });
}
