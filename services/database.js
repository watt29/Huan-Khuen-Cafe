// ========================================================
//  services/database.js
//  บทบาท: จัดการ SQLite Database เพื่อความเสถียรของข้อมูล
// ========================================================

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// เชื่อมต่อ DB (สร้างโฟลเดอร์ถ้ายังไม่มี)
const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.db');
const db = new Database(dbPath);

// --- Initialization: สร้าง Table ถ้ายังไม่มี ---
db.exec(`
    CREATE TABLE IF NOT EXISTS processed_ids (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
        user_id TEXT PRIMARY KEY,
        step TEXT,
        cart_json TEXT,
        delivery_json TEXT,
        last_product TEXT,
        from_comment INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS handoffs (
        user_id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Index เพื่อความเร็ว
    CREATE INDEX IF NOT EXISTS idx_processed_id ON processed_ids(id);
    CREATE INDEX IF NOT EXISTS idx_handoff_user ON handoffs(user_id);
`);

/**
 * จัดการ Handoff (โอนสายให้แอดมิน)
 */
function setHandoff(userId, active) {
    if (active) {
        db.prepare('INSERT OR IGNORE INTO handoffs (user_id) VALUES (?)').run(userId);
    } else {
        db.prepare('DELETE FROM handoffs WHERE user_id = ?').run(userId);
    }
}

function isHandoff(userId) {
    const row = db.prepare('SELECT user_id FROM handoffs WHERE user_id = ?').get(userId);
    return !!row;
}

/**
 * ตรวจว่า ID นี้เคยตอบแล้วหรือยัง
 */
function hasProcessed(id) {
    const stmt = db.prepare('SELECT id FROM processed_ids WHERE id = ?');
    const row = stmt.get(id);
    return !!row;
}

/**
 * บันทึก ID ว่าตอบแล้ว
 */
function markProcessed(id) {
    const stmt = db.prepare('INSERT OR IGNORE INTO processed_ids (id) VALUES (?)');
    stmt.run(id);
    
    // Auto-cleanup: ลบ ID เก่าๆ ถ้ามีเกิน 10,000 รายการ (เพื่อประหยัดพื้นที่)
    const count = db.prepare('SELECT COUNT(*) as total FROM processed_ids').get().total;
    if (count > 10000) {
        db.prepare('DELETE FROM processed_ids WHERE id IN (SELECT id FROM processed_ids ORDER BY created_at ASC LIMIT 1000)').run();
    }
}

module.exports = { db, hasProcessed, markProcessed };
