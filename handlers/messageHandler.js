// ========================================================
//  handlers/messageHandler.js
//  บทบาท: จัดการข้อความที่ส่งมาจาก Messenger (Inbox)
//  การเชื่อมโยง:
//    - เรียกใช้ aiService.js เพื่อเจนคำตอบจาก AI
//    - เรียกใช้ facebookService.js เพื่อส่งข้อความกลับ/ดึง Profile
//    - เรียกใช้ database.js เพื่อตรวจสอบและบันทึกประวัติป้องกันการตอบซ้ำ
//    - เรียกใช้ sessionService.js เพื่อจัดการตะกร้าสินค้า
// ========================================================
const { generateChatReply } = require('../services/aiService');
const { sendMessage, sendTypingIndicator, getUserProfile } = require('../services/facebookService');
const { getSession, addToCart, getCartSummary, STEPS } = require('../services/sessionService');
const { run, query } = require('../services/database');
const { buildCogReport, getHighMarginMenus } = require('../menu');

const chatHistories = new Map();
const handoffUsers = new Set(); // เก็บ ID ลูกค้าที่โอนสายให้คน

async function handleMessage(event) {
    const senderId = event.sender?.id;
    const text = event.message?.text;
    const messageId = event.message?.mid;

    if (!senderId || !text || event.message?.is_echo) return;

    // --- [STEP 1] ป้องกันการตอบซ้ำ ---
    // ตรวจสอบจาก mid (Message ID) ในฐานข้อมูล SQLite ถ้ามีแล้วให้ข้ามทันที
    const existing = await query('SELECT id FROM interactions WHERE id = ?', [messageId]);
    if (existing.length > 0) return;
    await run('INSERT INTO interactions (id, type, content) VALUES (?, ?, ?)', [messageId, 'message', text]);

    // --- [STEP 2] ตรวจสอบคำสั่ง Admin (Slash Commands) ---
    // ใช้สำหรับควบคุมระบบเบื้องหลังผ่านการพิมพ์ในแชท
    if (text.startsWith('/')) {
        const cmd = text.toLowerCase();
        // คำสั่งซิงค์ข้อมูลเมนูจาก Google Sheets
        if (cmd === '/sync' || cmd === '/syncmenu') {
            const { syncMenuFromSheets } = require('../services/syncService');
            const success = await syncMenuFromSheets();
            await sendMessage(senderId, success ? '✅ ซิงค์สำเร็จแล้วค่ะ!' : '❌ ซิงค์ขัดข้องค่ะ');
            return;
        }
        // คำสั่งดูรายงาน COG ทั้งหมด
        if (cmd === '/cog') {
            const report = buildCogReport();
            await sendMessage(senderId, report);
            return;
        }
        // คำสั่งดูเมนู High Margin (กำไรดี >= 50%)
        if (cmd === '/topmenu' || cmd === '/highmargin') {
            const tops = getHighMarginMenus();
            let msg = `🏆 เมนู High Margin (กำไร ≥ 50%)\n${'─'.repeat(28)}\n`;
            tops.forEach(i => {
                msg += `• ${i.name} — ${i.price}฿ (Margin ${i.margin}%)\n`;
            });
            await sendMessage(senderId, msg);
            return;
        }
        // คำสั่งดู COG เมนูเดียว เช่น /cog latte
        if (cmd.startsWith('/cog ')) {
            const keyword = text.slice(5).toLowerCase().trim();
            const { MENU } = require('../menu');
            const all = [
                ...MENU.breakfast, ...MENU.addons,
                ...MENU.forShare.filter(i => i.price !== null),
                ...MENU.beverages
            ];
            const found = all.filter(i => i.name.toLowerCase().includes(keyword));
            if (found.length === 0) {
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
        // คำสั่งหยุดบอทชั่วคราวเพื่อให้แอดมินคนคุยแทน
        if (cmd === '/pause') {
            handoffUsers.add(senderId);
            await sendMessage(senderId, '⏸️ หยุดระบบ AI ชั่วคราว แอดมินเข้าดูแลแทนแล้วค่ะ');
            return;
        }
        // คำสั่งให้บอทกลับมาทำงาน
        if (cmd === '/resume') {
            handoffUsers.delete(senderId);
            await sendMessage(senderId, '▶️ เปิดระบบ AI น้องกาลเวลาพร้อมให้บริการแล้วค่ะ');
            return;
        }
    }

    // --- [STEP 3] ระบบ Handoff (โหมดแอดมินดูแล) ---
    // ถ้าลูกค้าถูกย้ายไปอยู่ในกลุ่ม handoff บอทจะไม่ประมวลผลข้อความนี้ต่อ
    if (handoffUsers.has(senderId)) {
        console.log(`👤 [HANDOFF] ข้ามการตอบ AI สำหรับลูกค้า ${senderId}`);
        return;
    }

    console.log(`💬 [CHAT] จาก ${senderId}: "${text}"`);

    // --- [STEP 4] เพิ่มความเนียน (Typing Indicator) ---
    // สั่งให้ Facebook ขึ้นว่าบอทกำลังพิมพ์...
    await sendTypingIndicator(senderId, 'typing_on');

    // --- [STEP 5] ดึงข้อมูลลูกค้าเพื่อ Personalization ---
    // ไปดึงชื่อจริงจาก Facebook API มาใช้เรียกแทนตัวลูกค้า
    const profile = await getUserProfile(senderId);
    const userName = profile?.first_name || 'คุณลูกค้า';

    // --- [STEP 6] ตรวจสอบความต้องการคุยกับคน (Keywords) ---
    const handoffKeywords = ['คุยกับคน', 'ขอสายแอดมิน', 'แอดมินอยู่ไหม', 'ติดต่อเจ้าหน้าที่'];
    if (handoffKeywords.some(k => text.includes(k))) {
        handoffUsers.add(senderId);
        await sendMessage(senderId, `ได้เลยค่ะคุณ ${userName} รอสักครู่นะคะ น้องกาลเวลาขออนุญาตโอนสายให้พี่แอดมินดูแลแทนทันทีเลยค่ะ 😊`);
        return;
    }

    const session = getSession(senderId);
    
    // --- [STEP 7] ตรวจสอบการสั่งอาหาร (Cart System) ---
    // ใช้ logic พื้นฐานในการตรวจสอบคำสำคัญเพื่อเพิ่มสินค้าลงตะกร้าใน Session
    if (text.includes('สั่ง') || text.includes('เอา') || text.includes('รับ')) {
        if (text.includes('ชุดใหญ่') || text.includes('Big Breakfast')) {
            addToCart(senderId, { name: 'The Big Breakfast Box Set', price: 329 });
        }
    }

    // --- [STEP 8] ตรวจสอบการขอสรุปยอด (Check Bill) และบันทึกออร์เดอร์ ---
    if (text.includes('สรุป') || text.includes('ยอด') || text.includes('เช็คบิล')) {
        const summary = getCartSummary(senderId);
        if (summary) {
            let summaryText = `📝 [สรุปออร์เดอร์ของคุณ ${userName} ค่ะ]\n\n${summary.lines.join('\n')}\n\n💰 ยอดรวม: ${summary.total} บาท\n\nสะดวกโอนเงินหรือชำระปลายทางดีคะ? ✨`;
            await sendMessage(senderId, summaryText);
            return;
        }
    }

    // --- [STEP 8.1] ยืนยันการสั่งซื้อและส่งข้อมูลไป Google Sheets ---
    if (text.includes('โอนเงิน') || text.includes('ปลายทาง') || text.includes('ยืนยัน')) {
        const summary = getCartSummary(senderId);
        if (summary && summary.lines.length > 0) {
            const { logOrderToSheet } = require('../services/loggingService');
            const success = await logOrderToSheet({
                customerName: userName,
                items: summary.lines,
                total: summary.total,
                paymentMethod: text.includes('ปลายทาง') ? 'ชำระปลายทาง' : 'โอนเงิน'
            });
            
            if (success) {
                await sendMessage(senderId, `ขอบคุณมากค่ะคุณ ${userName} น้องกาลเวลาบันทึกออร์เดอร์ให้พี่เรียบร้อยแล้วค่ะ! เตรียมรับความอร่อยได้เลยนะคะ 🛵✨`);
                // เคลียร์ตะกร้าหลังจากสั่งเสร็จ
                const { getSession } = require('../services/sessionService');
                const session = getSession(senderId);
                session.cart = [];
                return;
            }
        }
    }

    // --- [STEP 9] เรียกใช้ AI Gemini เจนคำตอบ และวิเคราะห์อารมณ์ ---
    const history = chatHistories.get(senderId) || [];
    const { reply, sentiment } = await generateChatReply(text, history, { userName });

    // --- [STEP 10] ระบบ Sentiment Analysis & Auto-Escalation ---
    // บันทึกอารมณ์ลงฐานข้อมูล (Data Collection)
    await run('UPDATE interactions SET sentiment = ? WHERE id = ?', [sentiment, messageId]);

    // หากอารมณ์คือโกรธหรือหงุดหงิด ให้โอนสายให้แอดมินทันที (Auto Handoff)
    if (sentiment === 'ANGRY' || sentiment === 'FRUSTRATED') {
        console.log(`⚠️ [ESCALATION] ลูกค้า ${senderId} มีอารมณ์ ${sentiment} — ทำการโอนสายอัตโนมัติ`);
        handoffUsers.add(senderId);
        // เพิ่มข้อความแจ้งเตือนต่อท้ายคำตอบของบอท
        const empathyReply = `${reply}\n\n(ขณะนี้แอดมินกำลังรีบเข้ามาดูแลคุณ ${userName} โดยด่วนนะคะ ขออภัยในความไม่สะดวกด้วยค่ะ 🙏)`;
        await sendMessage(senderId, empathyReply);
        return;
    }

    // บันทึกประวัติการคุยลงใน Map
    history.push({ role: 'user', parts: [{ text: text }] });
    history.push({ role: 'model', parts: [{ text: reply }] });
    if (history.length > 10) history.splice(0, 2);
    chatHistories.set(senderId, history);

    // --- [STEP 11] ส่งข้อความกลับหาลูกค้า ---
    setTimeout(async () => {
        await sendMessage(senderId, reply);
    }, 1500);
}

module.exports = { handleMessage };
