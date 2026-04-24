// ========================================================
//  handlers/menuHandler.js
//  บทบาท: จัดการแสดงเมนูผ่าน Quick Replies + Text
// ========================================================
const { sendMessage, sendQuickReplies } = require('../services/facebookService');
const { MENU } = require('../menu');

// ─────────────────────────────────────────────
//  Keywords ที่ trigger เมนู
// ─────────────────────────────────────────────
const MENU_KEYWORDS = ['เมนู', 'menu', 'มีอะไรบ้าง', 'ราคา', 'ขายอะไร', 'อาหาร', 'เครื่องดื่ม', 'สั่งอาหาร'];

// Postback payloads จาก Quick Reply ปุ่มหมวด
const MENU_PAYLOADS = {
    MENU_BREAKFAST: 'MENU_BREAKFAST',
    MENU_BEVERAGE:  'MENU_BEVERAGE',
    MENU_FORSHARE:  'MENU_FORSHARE',
    MENU_ADDON:     'MENU_ADDON',
    MENU_ALL:       'MENU_ALL'
};

// ─────────────────────────────────────────────
//  ตรวจสอบว่าข้อความนี้ต้องการดูเมนูไหม
// ─────────────────────────────────────────────
function isMenuRequest(text) {
    const lower = text.toLowerCase();
    return MENU_KEYWORDS.some(k => lower.includes(k));
}

// ─────────────────────────────────────────────
//  ตรวจสอบว่าเป็น Quick Reply Payload ไหม
// ─────────────────────────────────────────────
function isMenuPayload(payload) {
    return Object.values(MENU_PAYLOADS).includes(payload);
}

// ─────────────────────────────────────────────
//  ส่งปุ่มเลือกหมวดเมนู (Quick Replies)
// ─────────────────────────────────────────────
async function sendMenuCategories(senderId, userName = 'คุณลูกค้า') {
    await sendQuickReplies(
        senderId,
        `สวัสดีค่ะคุณ${userName} 😊\nร้านกาลเวลา หวนคืน คาเฟ่ มีเมนูหลายหมวดเลยค่ะ\nอยากดูหมวดไหนก่อนดีคะ?`,
        [
            { title: '🍳 อาหารเช้า',    payload: MENU_PAYLOADS.MENU_BREAKFAST },
            { title: '☕ เครื่องดื่ม',  payload: MENU_PAYLOADS.MENU_BEVERAGE },
            { title: '🍟 ของทานเล่น',  payload: MENU_PAYLOADS.MENU_FORSHARE },
            { title: '➕ Add-ons',      payload: MENU_PAYLOADS.MENU_ADDON },
            { title: '📋 ดูทั้งหมด',   payload: MENU_PAYLOADS.MENU_ALL }
        ]
    );
}

// ─────────────────────────────────────────────
//  สร้าง Text เมนูอาหารเช้า
// ─────────────────────────────────────────────
function buildBreakfastText() {
    let text = `🍳 เมนูอาหารเช้า\n${'─'.repeat(28)}\n`;
    MENU.breakfast.forEach(item => {
        text += `\n• ${item.name}\n  ${item.highlight}\n  💰 ${item.price} บาท\n`;
    });
    text += `\n➕ เพิ่มท็อปปิ้งได้ด้วยนะคะ (พิมพ์ "add-ons" เพื่อดู)`;
    return text;
}

// ─────────────────────────────────────────────
//  สร้าง Text เมนูเครื่องดื่ม
// ─────────────────────────────────────────────
function buildBeverageText() {
    const hot  = MENU.beverages.filter(i => i.type === 'hot');
    const iced = MENU.beverages.filter(i => i.type === 'iced');

    let text = `☕ เมนูเครื่องดื่ม\n${'─'.repeat(28)}\n`;

    text += `\n🔥 ร้อน\n`;
    hot.forEach(item => {
        text += `• ${item.name} (${item.size})\n  ${item.highlight}\n  💰 ${item.price} บาท\n`;
    });

    text += `\n🧊 เย็น\n`;
    iced.forEach(item => {
        text += `• ${item.name} (${item.size})\n  ${item.highlight}\n  💰 ${item.price} บาท\n`;
    });

    return text;
}

// ─────────────────────────────────────────────
//  สร้าง Text เมนูของทานเล่น
// ─────────────────────────────────────────────
function buildForShareText() {
    const available = MENU.forShare.filter(i => i.price !== null);
    let text = `🍟 เมนูทานเล่น / For Share\n${'─'.repeat(28)}\n`;
    available.forEach(item => {
        text += `\n• ${item.name}\n  ${item.highlight}\n  💰 ${item.price} บาท\n`;
    });
    return text;
}

// ─────────────────────────────────────────────
//  สร้าง Text Add-ons
// ─────────────────────────────────────────────
function buildAddonText() {
    let text = `➕ Add-ons (เพิ่มในเมนูอาหารเช้าได้เลยค่ะ)\n${'─'.repeat(28)}\n`;
    MENU.addons.forEach(item => {
        const name = item.name.replace('Add on - ', '');
        text += `• ${name} — ${item.price} บาท\n`;
    });
    return text;
}

// ─────────────────────────────────────────────
//  สร้าง Text เมนูทั้งหมด (ย่อ)
// ─────────────────────────────────────────────
function buildAllMenuText() {
    let text = `📋 เมนูทั้งหมด — ร้านกาลเวลา หวนคืน คาเฟ่\n${'═'.repeat(32)}\n`;

    text += `\n🍳 อาหารเช้า\n`;
    MENU.breakfast.forEach(i => {
        text += `• ${i.name} ......... ${i.price} ฿\n`;
    });

    text += `\n☕ เครื่องดื่ม\n`;
    MENU.beverages.forEach(i => {
        text += `• ${i.name} ......... ${i.price} ฿\n`;
    });

    text += `\n🍟 ของทานเล่น\n`;
    MENU.forShare.filter(i => i.price !== null).forEach(i => {
        text += `• ${i.name} ......... ${i.price} ฿\n`;
    });

    text += `\n➕ Add-ons\n`;
    MENU.addons.forEach(i => {
        const name = i.name.replace('Add on - ', '');
        text += `• ${name} ......... ${i.price} ฿\n`;
    });

    text += `\n📞 สอบถามเพิ่มเติม: ${MENU.shop.contact}`;
    return text;
}

// ─────────────────────────────────────────────
//  จัดการ Quick Reply Payload
// ─────────────────────────────────────────────
async function handleMenuPayload(senderId, payload) {
    switch (payload) {
        case MENU_PAYLOADS.MENU_BREAKFAST:
            await sendMessage(senderId, buildBreakfastText());
            break;
        case MENU_PAYLOADS.MENU_BEVERAGE:
            await sendMessage(senderId, buildBeverageText());
            break;
        case MENU_PAYLOADS.MENU_FORSHARE:
            await sendMessage(senderId, buildForShareText());
            break;
        case MENU_PAYLOADS.MENU_ADDON:
            await sendMessage(senderId, buildAddonText());
            break;
        case MENU_PAYLOADS.MENU_ALL:
            await sendMessage(senderId, buildAllMenuText());
            break;
    }
}

module.exports = { isMenuRequest, isMenuPayload, sendMenuCategories, handleMenuPayload };
