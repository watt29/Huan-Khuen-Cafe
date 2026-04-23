// ========================================================
//  services/database.js
//  บทบาท: In-Memory Store (แทน SQLite เพื่อความเสถียรบน Render)
//  เก็บ Message ID ที่ตอบแล้วไว้กัน duplicate (max 5000 entries)
// ========================================================

const processedIds = new Set();
const MAX_SIZE = 5000;

/**
 * ตรวจว่า ID นี้เคยตอบแล้วหรือยัง
 * @param {string} id - message ID หรือ comment ID
 * @returns {boolean}
 */
function hasProcessed(id) {
    return processedIds.has(id);
}

/**
 * บันทึก ID ว่าตอบแล้ว (auto-cleanup เมื่อเกิน MAX_SIZE)
 * @param {string} id
 */
function markProcessed(id) {
    if (processedIds.size >= MAX_SIZE) {
        // ลบ 500 ตัวแรกออก
        const toDelete = [...processedIds].slice(0, 500);
        toDelete.forEach(k => processedIds.delete(k));
    }
    processedIds.add(id);
}

module.exports = { hasProcessed, markProcessed };
