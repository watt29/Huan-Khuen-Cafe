// ========================================================
//  services/sessionService.js
//  จัดการ state การสนทนาของลูกค้าแต่ละคนใน Inbox
// ========================================================

// state ต่อ userId: { step, cart, lastProduct }
const sessions = new Map();

const STEPS = {
    NEW:      'NEW',       // ทักครั้งแรก
    BROWSING: 'BROWSING',  // กำลังดูเมนู
    ORDERED:  'ORDERED',   // สั่งอย่างน้อย 1 อย่างแล้ว
    UPSELL:   'UPSELL',    // เสนอเมนูเพิ่ม
    CHECKOUT: 'CHECKOUT',  // สรุปออร์เดอร์
};

function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            step: STEPS.NEW,
            cart: [],          // [{ name, price, qty }]
            lastProduct: null, // เมนูล่าสุดที่สนใจ
            fromComment: false // มาจาก comment trigger หรือไม่
        });
    }
    return sessions.get(userId);
}

function updateSession(userId, data) {
    const session = getSession(userId);
    Object.assign(session, data);
    sessions.set(userId, session);
}

function addToCart(userId, item) {
    const session = getSession(userId);
    const existing = session.cart.find(c => c.name === item.name);
    if (existing) {
        existing.qty += item.qty || 1;
    } else {
        session.cart.push({ ...item, qty: item.qty || 1 });
    }
    session.step = STEPS.ORDERED;
    sessions.set(userId, session);
}

function getCartSummary(userId) {
    const session = getSession(userId);
    if (!session.cart.length) return null;

    const lines = session.cart.map(i => `• ${i.name} x${i.qty} = ${i.price * i.qty}฿`);
    const total = session.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    return { lines, total };
}

function clearCart(userId) {
    updateSession(userId, { cart: [], step: STEPS.BROWSING, lastProduct: null });
}

module.exports = { getSession, updateSession, addToCart, getCartSummary, clearCart, STEPS };
