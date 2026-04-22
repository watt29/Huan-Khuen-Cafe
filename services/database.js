// ========================================================
//  services/database.js — จัดการ SQLite Memory
// ========================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'intelligence_memory.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        type TEXT,
        content TEXT,
        sentiment TEXT DEFAULT 'NORMAL',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

function query(sql, params = []) {
    return Promise.resolve(db.prepare(sql).all(...params));
}

function run(sql, params = []) {
    return Promise.resolve(db.prepare(sql).run(...params));
}

module.exports = { db, query, run };
