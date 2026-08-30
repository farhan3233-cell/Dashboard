import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    const candidatePaths = [
        path.join(process.cwd(), 'index.html'),
        path.join(__dirname, 'index.html'),
        path.join(__dirname, '..', 'index.html'),
        '/var/task/index.html'
    ];

    for (const filePath of candidatePaths) {
        try {
            if (fs.existsSync(filePath)) {
                const html = fs.readFileSync(filePath, 'utf8');
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.status(200).send(html);
            }
        } catch (e) {}
    }
    return res.status(404).send(`index.html not found. Tried: ${candidatePaths.join(', ')}`);
}
