// ========================================================
//  services/sessionService.js
//  จัดการ state การสนทนาของลูกค้าแต่ละคนแบบ Persistent (SQLite)
// ========================================================
const { db } = require('./database');

const STEPS = {
    NEW:      'NEW',
    BROWSING: 'BROWSING',
    ORDERED:  'ORDERED',
    UPSELL:   'UPSELL',
    CHECKOUT: 'CHECKOUT',
    DELIVERY: 'DELIVERY',
};

/**
 * ดึง Session จาก DB ถ้าไม่มีให้สร้างใหม่
 */
function getSession(userId) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE user_id = ?');
    const row = stmt.get(userId);

    if (!row) {
        const initialSession = {
            step: STEPS.NEW,
            cart: [],
            lastProduct: null,
            fromComment: false,
            delivery: { address: null, phone: null, method: null }
        };
        saveToDb(userId, initialSession);
        return initialSession;
    }

    return {
        user_id: row.user_id,
        step: row.step,
        cart: JSON.parse(row.cart_json || '[]'),
        delivery: JSON.parse(row.delivery_json || '{}'),
        lastProduct: row.last_product,
        fromComment: !!row.from_comment
    };
}

/**
 * บันทึก Session ลง DB
 */
function saveToDb(userId, data) {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO sessions (user_id, step, cart_json, delivery_json, last_product, from_comment, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
        userId,
        data.step,
        JSON.stringify(data.cart || []),
        JSON.stringify(data.delivery || {}),
        data.lastProduct || null,
        data.fromComment ? 1 : 0
    );
}

function updateSession(userId, data) {
    const current = getSession(userId);
    const updated = { ...current, ...data };
    saveToDb(userId, updated);
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
    saveToDb(userId, session);
}

function getCartSummary(userId) {
    const session = getSession(userId);
    if (!session.cart || !session.cart.length) return null;

    const lines = session.cart.map(i => `• ${i.name} x${i.qty} = ${i.price * i.qty}฿`);
    const total = session.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    return { lines, total };
}

function clearCart(userId) {
    updateSession(userId, {
        cart: [], 
        step: STEPS.BROWSING, 
        lastProduct: null,
        delivery: { address: null, phone: null, method: null }
    });
}

function saveDelivery(userId, delivery) {
    const session = getSession(userId);
    session.delivery = { ...session.delivery, ...delivery };
    session.step = STEPS.CHECKOUT;
    saveToDb(userId, session);
}

module.exports = { getSession, updateSession, addToCart, getCartSummary, clearCart, saveDelivery, STEPS };
