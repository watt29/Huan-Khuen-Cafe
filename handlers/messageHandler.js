// ========================================================
//  handlers/messageHandler.js  (v2)
//  บทบาท: จัดการข้อความ Messenger (Inbox)
//  ใช้ In-Memory store แทน SQLite
// ========================================================
const { generateChatReply } = require('../services/aiService');
const { sendMessage, sendTypingIndicator, sendMarkSeen, getUserProfile } = require('../services/facebookService');
const { getSession, addToCart, getCartSummary, clearCart, saveDelivery, STEPS } = require('../services/sessionService');
const { hasProcessed, markProcessed } = require('../services/database');
const { buildCogReport, getHighMarginMenus, MENU } = require('../menu');
const { logOrderToSheet, logCustomerToSheet } = require('../services/googleSheetService');
const { isMenuRequest, isMenuPayload, sendMenuCategories, handleMenuPayload } = require('./menuHandler');

// ประวัติการสนทนาต่อ User (max 10 turns)
const chatHistories = new Map();
// User ID ที่โอนให้แอดมินดูแลแทน
const handoffUsers = new Set();

async function handleMessage(event) {
    const senderId = event.sender?.id;
    const text = event.message?.text?.trim();
    const messageId = event.message?.mid;
    const quickReplyPayload = event.message?.quick_reply?.payload;

    // กรองเงื่อนไขพื้นฐาน
    if (!senderId || !text || event.message?.is_echo) return;

    // ---- [1] ป้องกันตอบซ้ำ ----
    if (hasProcessed(messageId)) return;
    markProcessed(messageId);

    // ---- [2] Mark Seen (อ่านแล้วอัตโนมัติ) ----
    await sendMarkSeen(senderId);

    // ---- [2] Admin Slash Commands ----
    if (text.startsWith('/')) {
        const cmd = text.toLowerCase();

        if (cmd === '/sync' || cmd === '/syncmenu') {
            try {
                const { syncMenuFromSheets } = require('../services/syncService');
                const ok = await syncMenuFromSheets();
                await sendMessage(senderId, ok ? '✅ ซิงค์สำเร็จแล้วค่ะ!' : '❌ ซิงค์ขัดข้องค่ะ');
            } catch {
                await sendMessage(senderId, '❌ ยังไม่ได้ตั้งค่า syncService ค่ะ');
            }
            return;
        }
        if (cmd === '/cog') {
            await sendMessage(senderId, buildCogReport());
            return;
        }
        if (cmd === '/topmenu' || cmd === '/highmargin') {
            const tops = getHighMarginMenus();
            let msg = `🏆 เมนู High Margin (กำไร ≥ 50%)\n${'─'.repeat(28)}\n`;
            tops.forEach(i => { msg += `• ${i.name} — ${i.price}฿ (Margin ${i.margin}%)\n`; });
            await sendMessage(senderId, msg);
            return;
        }
        if (cmd.startsWith('/cog ')) {
            const keyword = text.slice(5).toLowerCase().trim();
            const all = [
                ...MENU.breakfast, ...MENU.addons,
                ...MENU.forShare.filter(i => i.price !== null),
                ...MENU.beverages
            ];
            const found = all.filter(i => i.name.toLowerCase().includes(keyword));
            if (!found.length) {
                await sendMessage(senderId, `❌ ไม่พบเมนูที่ตรงกับ "${keyword}" ค่ะ`);
            } else {
                let msg = `🔍 ผลการค้นหา: "${keyword}"\n`;
                found.forEach(i => {
                    const icon = i.margin >= 60 ? '🟢' : i.margin >= 45 ? '🟡' : '🔴';
                    msg += `\n${icon} ${i.name}\n   ราคา: ${i.price}฿ | COG: ${i.cog}฿ | Margin: ${i.margin}%\n`;
                });
                await sendMessage(senderId, msg);
            }
            return;
        }
        if (cmd === '/pause') {
            handoffUsers.add(senderId);
            await sendMessage(senderId, '⏸️ หยุดระบบ AI ชั่วคราว แอดมินเข้าดูแลแทนแล้วค่ะ');
            return;
        }
        if (cmd === '/resume') {
            handoffUsers.delete(senderId);
            await sendMessage(senderId, '▶️ เปิดระบบ AI น้องกาลเวลาพร้อมให้บริการแล้วค่ะ');
            return;
        }
        if (cmd === '/clearcart') {
            clearCart(senderId);
            await sendMessage(senderId, '🗑️ ล้างตะกร้าเรียบร้อยแล้วค่ะ');
            return;
        }
    }

    // ---- [3] Handoff Mode ----
    if (handoffUsers.has(senderId)) {
        console.log(`👤 [HANDOFF] ข้ามการตอบ AI สำหรับ ${senderId}`);
        return;
    }

    // ---- [3.5] Quick Reply Payload (ลูกค้ากดปุ่มหมวดเมนู) ----
    if (quickReplyPayload && isMenuPayload(quickReplyPayload)) {
        await sendTypingIndicator(senderId, 'typing_on');
        await handleMenuPayload(senderId, quickReplyPayload);
        await sendTypingIndicator(senderId, 'typing_off');
        return;
    }

    console.log(`💬 [CHAT] จาก ${senderId}: "${text}"`);

    // ---- [4] Typing Indicator ----
    await sendTypingIndicator(senderId, 'typing_on');

    // ---- [5] ดึงชื่อลูกค้า ----
    const profile = await getUserProfile(senderId);
    const userName = profile?.first_name || 'คุณลูกค้า';
    const fullName = profile ? `${profile.first_name} ${profile.last_name || ''}`.trim() : 'คุณลูกค้า';

    // ---- [5.1] บันทึกข้อมูลลูกค้าลง CRM (Google Sheets) ----
    logCustomerToSheet({
        name: fullName,
        facebookId: senderId
    }).catch(() => {}); // ทำแบบเบลอๆ เบื้องหลัง

    // ---- [6] Keyword Handoff ----
    const handoffKeywords = ['คุยกับคน', 'ขอสายแอดมิน', 'แอดมินอยู่ไหม', 'ติดต่อเจ้าหน้าที่'];
    if (handoffKeywords.some(k => text.includes(k))) {
        handoffUsers.add(senderId);
        await sendMessage(senderId,
            `ได้เลยค่ะคุณ${userName} รอสักครู่นะคะ น้องกาลเวลาขออนุญาตโอนสายให้พี่แอดมินดูแลแทนทันทีเลยค่ะ 😊`
        );
        return;
    }

    // ---- [6.5] Menu Request Detection ----
    if (isMenuRequest(text)) {
        await sendTypingIndicator(senderId, 'typing_on');
        await sendMenuCategories(senderId, userName);
        await sendTypingIndicator(senderId, 'typing_off');
        return;
    }

    // ---- [7] Cart Detection (ง่ายๆ) ----
    if (text.includes('สั่ง') || text.includes('เอา') || text.includes('รับ')) {
        if (text.includes('ชุดใหญ่') || text.toLowerCase().includes('big breakfast')) {
            addToCart(senderId, { name: 'The Big Breakfast Box Set', price: 329 });
        }
    }

    // ---- [8] Delivery Info Collection ----
    const session = getSession(senderId);

    // ถ้าอยู่ใน step DELIVERY → parse ข้อมูลที่อยู่ เบอร์ ช่องทางส่ง
    if (session.step === STEPS.DELIVERY) {
        const lower = text.toLowerCase();
        const method = lower.includes('grab') ? 'Grab' :
                       lower.includes('line') || lower.includes('ไลน์แมน') ? 'LINE MAN' :
                       lower.includes('วิ่ง') || lower.includes('ร้านส่ง') || lower.includes('เอง') ? 'ร้านวิ่งส่ง' : null;

        const phoneMatch = text.match(/0[0-9]{8,9}/);
        const phone = phoneMatch ? phoneMatch[0] : null;

        // ตัดเบอร์และ keyword ออก เหลือที่อยู่
        let address = text
            .replace(/0[0-9]{8,9}/g, '')
            .replace(/(grab|lineman|ไลน์แมน|line man|วิ่งส่ง|ร้านส่ง|ร้านวิ่ง)/gi, '')
            .replace(/\s+/g, ' ').trim();

        saveDelivery(senderId, {
            address: address || null,
            phone: phone || null,
            method: method || 'รอยืนยัน'
        });

        const summary = getCartSummary(senderId);
        const delivery = getSession(senderId).delivery;

        // log ลง Sheets พร้อมข้อมูลจัดส่งครบ
        logOrderToSheet({
            customerName: fullName,
            orderItems: summary ? summary.lines.join(', ') : '-',
            totalPrice: summary ? summary.total : '-',
            paymentMethod: 'รอแจ้งโอน',
            deliveryAddress: delivery.address || '-',
            deliveryPhone: delivery.phone || '-',
            deliveryMethod: delivery.method || '-'
        }).catch(console.error);

        await sendMessage(senderId,
            `✅ รับทราบค่ะคุณ${userName}!\n\n` +
            `📦 ที่อยู่: ${delivery.address || 'รอยืนยัน'}\n` +
            `📞 เบอร์: ${delivery.phone || 'รอยืนยัน'}\n` +
            `🛵 ส่งผ่าน: ${delivery.method}\n\n` +
            `${summary ? `💰 ยอดรวม: ${summary.total} บาท\n\n` : ''}` +
            `น้องกาลเวลาจะรีบเตรียมออร์เดอร์ให้เลยค่ะ 🙏`
        );
        return;
    }

    // ---- [8.1] Bill Summary → ถามข้อมูลจัดส่ง ----
    if (text.includes('สรุป') || text.includes('ยอด') || text.includes('เช็คบิล')) {
        const summary = getCartSummary(senderId);
        if (summary) {
            // เปลี่ยน step เป็น DELIVERY เพื่อรอรับข้อมูล
            session.step = STEPS.DELIVERY;

            await sendMessage(senderId,
                `📝 สรุปออร์เดอร์ของคุณ${userName} ค่ะ\n\n${summary.lines.join('\n')}\n\n💰 ยอดรวม: ${summary.total} บาท\n\n` +
                `รบกวนแจ้งข้อมูลจัดส่งด้วยนะคะ 🛵\n` +
                `1. ที่อยู่จัดส่ง\n` +
                `2. เบอร์โทรติดต่อ\n` +
                `3. ส่งผ่าน Grab / LINE MAN / ให้ร้านวิ่งส่ง\n\n` +
                `พิมพ์มาในข้อความเดียวได้เลยค่ะ 😊`
            );
            return;
        }
    }

    // ---- [9] AI Reply (Groq) ----
    const history = chatHistories.get(senderId) || [];
    const { reply, sentiment, orderNote } = await generateChatReply(text, history, { userName });

    // ---- [9.1] Monitor — log ออเดอร์+note ลง Sheets ทันทีที่ AI รับออเดอร์ ----
    if (orderNote) {
        console.log(`🛒 [ORDER NOTE] ${fullName}: ${orderNote}`);
        logOrderToSheet({
            customerName: fullName,
            orderItems: orderNote,
            totalPrice: '-',
            paymentMethod: 'รอยืนยัน'
        }).catch(() => {});
    }

    // ---- [10] Sentiment Auto-Escalation ----
    if (sentiment === 'ANGRY' || sentiment === 'FRUSTRATED') {
        console.log(`⚠️ [ESCALATION] ลูกค้า ${senderId} sentiment=${sentiment}`);
        handoffUsers.add(senderId);
        await sendMessage(senderId,
            `${reply}\n\n(แอดมินกำลังรีบเข้ามาดูแลคุณ${userName} โดยด่วนนะคะ ขออภัยในความไม่สะดวกด้วยค่ะ 🙏)`
        );
        return;
    }

    // ---- [11] บันทึก History ----
    history.push({ role: 'user', parts: [{ text }] });
    history.push({ role: 'model', parts: [{ text: reply }] });
    if (history.length > 20) history.splice(0, 2); // เก็บแค่ 10 turns ล่าสุด
    chatHistories.set(senderId, history);

    // ---- [12] ส่งคำตอบ (หน่วงนิดหน่อยให้เนียน) ----
    await sendTypingIndicator(senderId, 'typing_off');
    setTimeout(async () => {
        await sendMessage(senderId, reply);
    }, 1000);
}

module.exports = { handleMessage };
