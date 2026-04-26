// ========================================================
//  handlers/orderHandler.js
//  บทบาท: จัดการออร์เดอร์ ตะกร้า และการจัดส่ง
// ========================================================
const { sendMessage, sendQuickReplies } = require('../services/facebookService');
const { getSession, getCartSummary, clearCart, saveDelivery, STEPS } = require('../services/sessionService');
const { logOrderToSheet } = require('../services/googleSheetService');

/**
 * จัดการข้อมูลจัดส่ง (ที่อยู่ เบอร์ โทร)
 */
async function handleDeliveryInfo(senderId, text, userName, fullName) {
    const lower = text.toLowerCase();
    const method = lower.includes('grab') ? 'Grab' :
                   lower.includes('line') || lower.includes('ไลน์แมน') ? 'LINE MAN' :
                   lower.includes('วิ่ง') || lower.includes('ร้านส่ง') || lower.includes('เอง') ? 'ร้านวิ่งส่ง' : null;

    const phoneMatch = text.match(/0[0-9]{8,9}/);
    const phone = phoneMatch ? phoneMatch[0] : null;

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

    // Log ลง Sheets
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
}

/**
 * สรุปยอดเงิน (Bill Summary)
 */
async function handleBillSummary(senderId, userName) {
    const summary = getCartSummary(senderId);
    if (summary) {
        await sendQuickReplies(
            senderId,
            `🧾 ทวนออร์เดอร์ของคุณ${userName} นะคะ\n\n${summary.lines.join('\n')}\n\n💰 รวม ${summary.total} บาท\n\nถูกต้องไหมคะ?`,
            [
                { title: '✅ ยืนยัน', payload: 'ORDER_CONFIRM' },
                { title: '❌ แก้ไข',  payload: 'ORDER_EDIT' }
            ]
        );
    } else {
        await sendMessage(senderId, `ยังไม่มีรายการออร์เดอร์นะคะคุณ${userName} บอกน้องกาลเวลาได้เลยว่าอยากได้เมนูอะไรคะ 😊`);
    }
}

module.exports = { handleDeliveryInfo, handleBillSummary };
