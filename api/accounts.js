import fs from 'fs';

const DB_FILE = '/tmp/db.json';

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let db = { accounts: {} };
    try {
        if (fs.existsSync(DB_FILE)) {
            db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {}

    const now = Math.floor(Date.now() / 1000);
    const accounts = Object.entries(db.accounts || {})
        .filter(([k]) => k !== '888888' && k !== '999999')
        .map(([_, a]) => {
            const lastSeen = a.lastSeen || 0;
            const diff = lastSeen > 0 ? now - lastSeen : 999999;
            let status = 'Active';
            if (diff > 65) status = 'Disconnected';
            else if (diff > 25) status = 'Processing';
            return { ...a, status };
        });

    return res.status(200).json({ status: 'success', data: accounts });
}
