// ========================================================
//  handlers/commentHandler.js  (v2)
//  จัดการ Comment บน Post + ดึงเข้า Inbox อัตโนมัติ
//  ใช้ In-Memory store แทน SQLite
// ========================================================
const { generateCommentReply } = require('../services/aiService');
const { replyToComment, likeComment, sendMessage } = require('../services/facebookService');
const { updateSession, STEPS } = require('../services/sessionService');
const { hasProcessed, markProcessed } = require('../services/database');

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;

// คำที่ trigger ให้ส่ง DM เข้า Inbox
const INBOX_TRIGGER_WORDS = [
    'สนใจ', 'สั่ง', 'cf', 'order', 'ขอ', 'เอา', 'อยากได้',
    'ราคา', 'เท่าไหร่', 'เท่าไร', 'กี่บาท', 'โอน', 'จ่าย',
    'ส่ง', 'เดลิเวอรี่', 'delivery', 'อยากลอง', 'น่ากิน'
];

function shouldTriggerInbox(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return INBOX_TRIGGER_WORDS.some(word => lower.includes(word));
}

async function handleComment(item) {
    const commentId   = item.value?.comment_id || item.value?.id;
    const commentText = item.value?.message;
    const fromId      = item.value?.from?.id;
    const fromName    = item.value?.from?.name || 'คุณลูกค้า';

    if (!commentId || !commentText) return;
    if (fromId === PAGE_ID) return; // ไม่ตอบตัวเอง

    // ---- ป้องกันตอบซ้ำ ----
    if (hasProcessed(commentId)) return;
    markProcessed(commentId);

    console.log(`💬 [COMMENT] "${commentText}" จาก ${fromName} (${fromId})`);

    // 1. Like comment ก่อนเสมอ
    await likeComment(commentId);

    if (shouldTriggerInbox(commentText)) {
        // 2a. ตอบใต้ comment ชวนไป Inbox
        await replyToComment(commentId,
            `ขอบคุณที่สนใจนะคะ ${fromName} 🤍 ส่งรายละเอียดให้ทาง Inbox แล้วค่ะ ☕`
        );
        // 2b. ส่ง DM เข้า Inbox ทันที
        updateSession(fromId, { step: STEPS.BROWSING, fromComment: true });
        await sendMessage(fromId,
            `สวัสดีค่ะ ${fromName} 🤍\n` +
            `ยินดีต้อนรับสู่ กาลเวลา | Huan Khuen Cafe ค่ะ\n\n` +
            `เห็นว่าสนใจอยู่นะคะ ✨ มีเมนูแนะนำค่ะ:\n` +
            `☕ กาแฟสกัดเย็น — หอมเข้มสดชื่น\n` +
            `🥐 ครัวซองต์อบใหม่ — เนยหอม กรอบนอกนุ่มใน\n` +
            `🌿 ชาเขียวพรีเมียม — มัทฉะแท้จากญี่ปุ่น\n\n` +
            `สนใจเมนูไหนเป็นพิเศษคะ? 😊`
        );
        console.log(`📩 [INBOX] ส่ง DM ไปหา ${fromName} (${fromId}) แล้ว`);
    } else {
        // 2b. ตอบ comment ด้วย Groq AI
        const reply = await generateCommentReply(commentText);
        if (reply) await replyToComment(commentId, reply);
    }
}

module.exports = { handleComment };
