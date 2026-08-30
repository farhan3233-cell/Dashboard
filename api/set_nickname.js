import fs from 'fs';
const DB_FILE = '/tmp/db.json';

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    let body = req.body || {};
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
    }

    const accId = String(body.account || '');
    const nickname = String(body.holderName || '').trim();

    if (accId && nickname) {
        let db = { accounts: {} };
        try { if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
        if (!db.accounts[accId]) db.accounts[accId] = { account: accId };
        db.accounts[accId].holderName = nickname;
        try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); } catch (e) {}
        return res.status(200).json({ status: 'success', message: `Updated nickname for ${accId}` });
    }
    return res.status(400).json({ status: 'error', message: 'Account not found or invalid name' });
}
