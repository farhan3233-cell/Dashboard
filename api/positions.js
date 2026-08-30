import fs from 'fs';
const DB_FILE = '/tmp/db.json';

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let db = { accounts: {}, positions: {} };
    try { if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
    const allPositions = [];
    for (const [accId, positions] of Object.entries(db.positions || {})) {
        if (Array.isArray(positions)) {
            positions.forEach(p => {
                allPositions.push({ ...p, _account: accId, _broker: db.accounts?.[accId]?.broker || '' });
            });
        }
    }
    return res.status(200).json({ status: 'success', data: allPositions });
}
