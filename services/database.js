// ========================================================
//  services/database.js — จัดการ SQLite Memory
//  (โครงสร้างเดียวกับ Sentinel-Thailand-OSINT)
// ========================================================
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/intelligence_memory.db');

// สร้างโฟลเดอร์ data ถ้ายังไม่มี
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'));
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // ตารางเก็บประวัติการตอบ (ป้องกันการตอบซ้ำ)
    db.run(`
        CREATE TABLE IF NOT EXISTS interactions (
            id TEXT PRIMARY KEY, 
            type TEXT, 
            content TEXT, 
            sentiment TEXT DEFAULT 'NORMAL',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ตารางเก็บ Log การทำงาน
    db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

module.exports = { db, query, run };
