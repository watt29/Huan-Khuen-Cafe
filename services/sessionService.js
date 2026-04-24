// ========================================================
//  services/sessionService.js
//  จัดการ state การสนทนาของลูกค้าแต่ละคนใน Inbox
// ========================================================

// state ต่อ userId: { step, cart, lastProduct }
const sessions = new Map();

const STEPS = {
    NEW:      'NEW',
    BROWSING: 'BROWSING',
    ORDERED:  'ORDERED',
    UPSELL:   'UPSELL',
    CHECKOUT: 'CHECKOUT',
    DELIVERY: 'DELIVERY',  // รอลูกค้ากรอกที่อยู่ + เบอร์ + ช่องทางส่ง
};

function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            step: STEPS.NEW,
            cart: [],
            lastProduct: null,
            fromComment: false,
            delivery: {        // ข้อมูลจัดส่ง
                address: null,
                phone: null,
                method: null   // 'grab' | 'lineman' | 'self'
            }
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
    updateSession(userId, {
        cart: [], step: STEPS.BROWSING, lastProduct: null,
        delivery: { address: null, phone: null, method: null }
    });
}

function saveDelivery(userId, delivery) {
    const session = getSession(userId);
    Object.assign(session.delivery, delivery);
    session.step = STEPS.CHECKOUT;
    sessions.set(userId, session);
}

module.exports = { getSession, updateSession, addToCart, getCartSummary, clearCart, saveDelivery, STEPS };
