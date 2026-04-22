// ========================================================
//  handlers/commentHandler.js
//  จัดการ Comment บน Post + ดึงเข้า Inbox อัตโนมัติ
// ========================================================
const { generateCommentReply } = require('../services/aiService');
const { replyToComment, likeComment, sendMessage } = require('../services/facebookService');
const { getSession, updateSession, STEPS } = require('../services/sessionService');
const { run, query } = require('../services/database');

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;

// คำที่ trigger ให้ดึงเข้า Inbox
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
    if (fromId === PAGE_ID) return;           

    // --- ตรวจสอบการตอบซ้ำ (Intelligent Memory) ---
    const existing = await query('SELECT id FROM interactions WHERE id = ?', [commentId]);
    if (existing.length > 0) return;
    await run('INSERT INTO interactions (id, type, content) VALUES (?, ?, ?)', [commentId, 'comment', commentText]);

    console.log(`💬 [COMMENT] "${commentText}" จาก ${fromName} (${fromId})`);

    // 1. Like comment
    await likeComment(commentId);

    const triggerInbox = shouldTriggerInbox(commentText);

    if (triggerInbox) {
        // 2a. ตอบใต้ comment สั้นๆ ชวนไป Inbox
        await replyToComment(commentId,
            `ขอบคุณที่สนใจนะคะ ${fromName} 🤍 ส่งรายละเอียดให้ทาง Inbox แล้วค่ะ ☕`
        );

        // 2b. ส่ง DM เข้า Inbox ทันที
        const session = getSession(fromId);
        updateSession(fromId, { step: STEPS.BROWSING, fromComment: true });

        await sendMessage(fromId,
            `สวัสดีค่ะ ${fromName} 🤍\n` +
            `ยินดีต้อนรับสู่ กาลเวลา | Huan Khuen Cafe ค่ะ\n\n` +
            `เห็นว่าสนใจอยู่นะคะ ✨ มีเมนูแนะนำค่ะ:\n` +
            `☕ กาแฟสกัดเย็น — หอมเข้มสดชื่น\n` +
            `🥐 ครัวซองต์อบใหม่ — เนยหอม กรอบนอกนุ่มใน\n` +
            `🌿 ชาเขียวพรีเมียม — มัทฉะแท้จากญี่ปุ่น\n\n` +
            `สนใจเมนูไหนเป็นพิเศษคะ? หรืออยากดูเมนูทั้งหมดก่อนเลยค่ะ 😊`
        );

        console.log(`📩 [INBOX] ส่ง DM ไปหา ${fromName} (${fromId}) แล้ว`);
    } else {
        // 2b. ตอบ comment ปกติด้วย AI
        const reply = await generateCommentReply(commentText);
        await replyToComment(commentId, reply);
    }
}

module.exports = { handleComment };
