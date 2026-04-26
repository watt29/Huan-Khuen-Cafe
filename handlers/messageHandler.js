// ========================================================
//  handlers/messageHandler.js  (v3 - Modular Edition)
//  บทบาท: Main Entry Point สำหรับจัดการข้อความ Messenger
// ========================================================
const { generateChatReply } = require('../services/aiService');
const { sendMessage, sendQuickReplies, sendTypingIndicator, sendMarkSeen, getUserProfile } = require('../services/facebookService');
const { getSession, addToCart, clearCart, STEPS } = require('../services/sessionService');
const { hasProcessed, markProcessed, isHandoff, setHandoff } = require('../services/database');
const { logCustomerToSheet } = require('../services/googleSheetService');
const { isMenuRequest, isMenuPayload, sendMenuCategories, handleMenuPayload } = require('./menuHandler');
const { handleCommand } = require('./commandHandler');
const { handleDeliveryInfo, handleBillSummary } = require('./orderHandler');

// ประวัติการสนทนาต่อ User (In-Memory สำหรับ History สั้นๆ - ถ้าจะแก้ให้เทพต้องลง DB ด้วย)
const chatHistories = new Map();

async function handleMessage(event) {
    const senderId = event.sender?.id;
    const text = event.message?.text?.trim();
    const messageId = event.message?.mid;
    const quickReplyPayload = event.message?.quick_reply?.payload;

    if (!senderId || !text || event.message?.is_echo) return;

    // 1. ป้องกันตอบซ้ำ
    if (hasProcessed(messageId)) return;
    markProcessed(messageId);

    // 2. สถานะเบื้องต้น
    await sendMarkSeen(senderId);

    // 3. Admin Commands (/)
    if (text.startsWith('/')) {
        const isCmd = await handleCommand(senderId, text);
        if (isCmd) return;
    }

    // 4. Handoff Check (จาก DB)
    if (isHandoff(senderId)) {
        console.log(`👤 [HANDOFF] Active for ${senderId}`);
        return;
    }

    // 5. Quick Reply Handlers
    if (quickReplyPayload) {
        if (isMenuPayload(quickReplyPayload)) {
            await handleMenuPayload(senderId, quickReplyPayload);
            return;
        }
        if (quickReplyPayload === 'ORDER_CONFIRM') {
            const s = getSession(senderId);
            s.step = STEPS.DELIVERY;
            require('../services/sessionService').updateSession(senderId, s);
            await sendMessage(senderId, `ขอบคุณค่ะ 🙏 รบกวนแจ้งที่อยู่ เบอร์โทร และช่องทางส่ง (Grab/LINE MAN) ได้เลยค่ะ`);
            return;
        }
        if (quickReplyPayload === 'ORDER_EDIT') {
            clearCart(senderId);
            await sendMessage(senderId, `ล้างรายการเดิมแล้ว บอกน้องกาลเวลาใหม่ได้เลยนะคะว่ารับอะไรดีคะ 😊`);
            return;
        }
    }

    console.log(`💬 [CHAT] ${senderId}: "${text}"`);
    await sendTypingIndicator(senderId, 'typing_on');

    // 6. Profile & CRM
    const profile = await getUserProfile(senderId);
    const userName = profile?.first_name || 'คุณลูกค้า';
    const fullName = profile ? `${profile.first_name} ${profile.last_name || ''}`.trim() : 'คุณลูกค้า';
    logCustomerToSheet({ name: fullName, facebookId: senderId }).catch(() => {});

    // 7. Keyword Escalation
    const handoffKeywords = ['คุยกับคน', 'ขอสายแอดมิน', 'แอดมินอยู่ไหม', 'ติดต่อเจ้าหน้าที่'];
    if (handoffKeywords.some(k => text.includes(k))) {
        setHandoff(senderId, true);
        await sendMessage(senderId, `ได้เลยค่ะคุณ${userName} น้องกาลเวลาโอนสายให้พี่แอดมินดูแลแทนทันทีนะคะ 😊`);
        return;
    }

    // 8. Menu Detection
    if (isMenuRequest(text)) {
        await sendMenuCategories(senderId, userName);
        await sendTypingIndicator(senderId, 'typing_off');
        return;
    }

    const session = getSession(senderId);

    // 9. Delivery Step
    if (session.step === STEPS.DELIVERY) {
        await handleDeliveryInfo(senderId, text, userName, fullName);
        await sendTypingIndicator(senderId, 'typing_off');
        return;
    }

    // 10. Bill Summary
    if (text.includes('สรุป') || text.includes('ยอด') || text.includes('เช็คบิล')) {
        await handleBillSummary(senderId, userName);
        await sendTypingIndicator(senderId, 'typing_off');
        return;
    }

    // 11. AI Generation (Groq)
    const history = chatHistories.get(senderId) || [];
    const { reply, sentiment, orderedItems } = await generateChatReply(text, history, { userName });

    // 12. Update Cart from AI
    if (orderedItems && orderedItems.length > 0) {
        orderedItems.forEach(item => {
            addToCart(senderId, {
                name: item.note ? `${item.name} (${item.note})` : item.name,
                price: item.price || 0,
                qty: item.qty || 1
            });
        });
    }

    // 13. Sentiment Escalation
    if (sentiment === 'ANGRY' || sentiment === 'FRUSTRATED') {
        setHandoff(senderId, true);
        await sendMessage(senderId, `${reply}\n\n(แอดมินกำลังรีบเข้ามาดูแลคุณ${userName} นะคะ 🙏)`);
        return;
    }

    // 14. History & Sending
    history.push({ role: 'user', parts: [{ text }] });
    history.push({ role: 'model', parts: [{ text: reply }] });
    if (history.length > 20) history.splice(0, 2);
    chatHistories.set(senderId, history);

    await sendTypingIndicator(senderId, 'typing_off');
    setTimeout(() => sendMessage(senderId, reply), 500);
}

module.exports = { handleMessage };
