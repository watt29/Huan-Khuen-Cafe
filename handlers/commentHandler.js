// ========================================================
//  handlers/commentHandler.js  (v2)
//  จัดการ Comment บน Post + ดึงเข้า Inbox อัตโนมัติ
//  ใช้ In-Memory store แทน SQLite
// ========================================================
const { generateCommentReply } = require('../services/aiService');
const { replyToComment, likeComment, sendMessage, sendQuickReplies } = require('../services/facebookService');
const { updateSession, STEPS } = require('../services/sessionService');
const { hasProcessed, markProcessed } = require('../services/database');
const { logCustomerToSheet } = require('../services/googleSheetService');
const { MENU } = require('../menu');

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

    // 0. บันทึกข้อมูลลูกค้าลง CRM
    logCustomerToSheet({
        name: fromName,
        facebookId: fromId
    }).catch(() => {});

    // 1. Like comment ก่อนเสมอ
    await likeComment(commentId);

    if (shouldTriggerInbox(commentText)) {
        // 2a. ตอบใต้ comment ชวนไป Inbox
        await replyToComment(commentId,
            `ขอบคุณที่สนใจนะคะ ${fromName} 🤍 ส่งรายละเอียดให้ทาง Inbox แล้วค่ะ ☕`
        );

        // 2b. ส่ง DM เข้า Inbox พร้อม Quick Reply เลือกหมวดเมนูจริง
        updateSession(fromId, { step: STEPS.BROWSING, fromComment: true });

        // detect keyword จาก comment เพื่อแนะนำเมนูที่ตรงกับสิ่งที่ลูกค้าสนใจ
        const lowerComment = commentText.toLowerCase();
        let suggestedMenu = '';

        if (lowerComment.includes('กาแฟ') || lowerComment.includes('coffee') || lowerComment.includes('ลาเต้') || lowerComment.includes('อเมริกาโน')) {
            // แนะนำเมนูกาแฟจริงจาก MENU
            const coffees = MENU.beverages.filter(i => i.type === 'iced' && i.name.toLowerCase().includes('coffee') || i.name.toLowerCase().includes('latte') || i.name.toLowerCase().includes('americano') || i.name.toLowerCase().includes('cappucino'));
            suggestedMenu = coffees.slice(0, 3).map(i => `☕ ${i.name} — ${i.highlight} (${i.price}฿)`).join('\n');
        } else if (lowerComment.includes('ชา') || lowerComment.includes('มัทฉะ') || lowerComment.includes('matcha')) {
            const teas = MENU.beverages.filter(i => i.name.toLowerCase().includes('matcha') || i.name.toLowerCase().includes('tea'));
            suggestedMenu = teas.map(i => `🌿 ${i.name} — ${i.highlight} (${i.price}฿)`).join('\n');
        } else if (lowerComment.includes('ครัวซองต์') || lowerComment.includes('อาหาร') || lowerComment.includes('เช้า')) {
            suggestedMenu = MENU.breakfast.slice(0, 3).map(i => `🥐 ${i.name} — ${i.highlight} (${i.price}฿)`).join('\n');
        } else {
            // ไม่รู้ว่าสนใจอะไร → แนะนำ highlight ของร้าน
            suggestedMenu =
                `☕ ${MENU.beverages[4].name} — ${MENU.beverages[4].highlight} (${MENU.beverages[4].price}฿)\n` +
                `🌿 ${MENU.beverages[6].name} — ${MENU.beverages[6].highlight} (${MENU.beverages[6].price}฿)\n` +
                `🥐 ${MENU.breakfast[3].name} — ${MENU.breakfast[3].highlight} (${MENU.breakfast[3].price}฿)`;
        }

        await sendQuickReplies(
            fromId,
            `สวัสดีค่ะ ${fromName} 🤍 ยินดีต้อนรับสู่ กาลเวลา หวนคืน คาเฟ่ค่ะ\n\n` +
            `เมนูที่น่าสนใจค่ะ:\n${suggestedMenu}\n\n` +
            `อยากดูเมนูหมวดไหนเพิ่มเติมคะ?`,
            [
                { title: '☕ เครื่องดื่ม',  payload: 'MENU_BEVERAGE' },
                { title: '🍳 อาหารเช้า',    payload: 'MENU_BREAKFAST' },
                { title: '🍟 ของทานเล่น',  payload: 'MENU_FORSHARE' },
                { title: '📋 ดูทั้งหมด',   payload: 'MENU_ALL' }
            ]
        );
        console.log(`📩 [INBOX] ส่ง DM ไปหา ${fromName} (${fromId}) แล้ว`);
    } else {
        // 2b. ตอบ comment ด้วย AI
        const reply = await generateCommentReply(commentText);
        if (reply) await replyToComment(commentId, reply);
    }
}

module.exports = { handleComment };
