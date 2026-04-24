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

        // detect keyword จาก comment → ส่งเมนูหมวดที่ตรงครบทุกรายการ
        const lowerComment = commentText.toLowerCase();
        let firstMsg = '';
        let firstPayload = 'MENU_ALL';

        if (lowerComment.includes('กาแฟ') || lowerComment.includes('coffee') ||
            lowerComment.includes('ลาเต้') || lowerComment.includes('อเมริกาโน') ||
            lowerComment.includes('คาปูชิโน') || lowerComment.includes('matcha') ||
            lowerComment.includes('มัทฉะ') || lowerComment.includes('ชา') ||
            lowerComment.includes('โกโก้') || lowerComment.includes('เครื่องดื่ม')) {

            // แสดงเครื่องดื่มทุกตัว
            const hot  = MENU.beverages.filter(i => i.type === 'hot');
            const iced = MENU.beverages.filter(i => i.type === 'iced');
            firstMsg =
                `สวัสดีค่ะ ${fromName} 🤍\nนี่คือเมนูเครื่องดื่มทั้งหมดของร้านค่ะ\n` +
                `${'─'.repeat(28)}\n` +
                `🔥 ร้อน\n` +
                hot.map(i => `• ${i.name} (${i.size}) — ${i.highlight}\n  💰 ${i.price} บาท`).join('\n') +
                `\n\n🧊 เย็น\n` +
                iced.map(i => `• ${i.name} (${i.size}) — ${i.highlight}\n  💰 ${i.price} บาท`).join('\n');
            firstPayload = 'MENU_BEVERAGE';

        } else if (lowerComment.includes('ครัวซองต์') || lowerComment.includes('อาหาร') ||
                   lowerComment.includes('เช้า') || lowerComment.includes('แซนด์วิช') ||
                   lowerComment.includes('breakfast')) {

            // แสดงอาหารเช้าทุกตัว
            firstMsg =
                `สวัสดีค่ะ ${fromName} 🤍\nนี่คือเมนูอาหารเช้าทั้งหมดของร้านค่ะ\n` +
                `${'─'.repeat(28)}\n` +
                MENU.breakfast.map(i => `• ${i.name}\n  ${i.highlight}\n  💰 ${i.price} บาท`).join('\n\n') +
                `\n\n➕ Add-ons เพิ่มได้ด้วยนะคะ\n` +
                MENU.addons.map(i => `• ${i.name.replace('Add on - ','')} — ${i.price} บาท`).join('\n');
            firstPayload = 'MENU_BREAKFAST';

        } else {
            // ไม่รู้หมวด → ส่งเมนูทั้งหมดครบทุกหมวด
            firstMsg =
                `สวัสดีค่ะ ${fromName} 🤍 ยินดีต้อนรับสู่ กาลเวลา หวนคืน คาเฟ่ค่ะ\n` +
                `${'═'.repeat(30)}\n\n` +
                `🍳 อาหารเช้า\n` +
                MENU.breakfast.map(i => `• ${i.name} — ${i.price} บาท`).join('\n') +
                `\n\n☕ เครื่องดื่ม\n` +
                MENU.beverages.map(i => `• ${i.name} — ${i.price} บาท`).join('\n') +
                `\n\n🍟 ของทานเล่น\n` +
                MENU.forShare.filter(i => i.price).map(i => `• ${i.name} — ${i.price} บาท`).join('\n') +
                `\n\n➕ Add-ons\n` +
                MENU.addons.map(i => `• ${i.name.replace('Add on - ','')} — ${i.price} บาท`).join('\n') +
                `\n\n📞 สอบถามเพิ่มเติม: ${MENU.shop.contact}`;
        }

        // ส่งเมนูจริงครบก่อน แล้วค่อยส่งปุ่มให้เลือกดูหมวดอื่น
        await sendMessage(fromId, firstMsg);
        await sendQuickReplies(
            fromId,
            `อยากดูหมวดอื่นเพิ่มเติมไหมคะ? 😊`,
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
