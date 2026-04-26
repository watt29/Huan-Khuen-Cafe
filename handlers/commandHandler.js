// ========================================================
//  handlers/commandHandler.js
//  บทบาท: จัดการ Admin Slash Commands (/)
// ========================================================
const { sendMessage } = require('../services/facebookService');
const { clearCart } = require('../services/sessionService');
const { setHandoff } = require('../services/database');
const { buildCogReport, getHighMarginMenus, MENU } = require('../menu');

async function handleCommand(senderId, text) {
    const cmd = text.toLowerCase();

    if (cmd === '/sync' || cmd === '/syncmenu') {
        try {
            const { syncMenuFromSheets } = require('../services/syncService');
            const ok = await syncMenuFromSheets();
            await sendMessage(senderId, ok ? '✅ ซิงค์สำเร็จแล้วค่ะ!' : '❌ ซิงค์ขัดข้องค่ะ');
        } catch {
            await sendMessage(senderId, '❌ ยังไม่ได้ตั้งค่า syncService ค่ะ');
        }
        return true;
    }
    
    if (cmd === '/cog') {
        await sendMessage(senderId, buildCogReport());
        return true;
    }
    
    if (cmd === '/topmenu' || cmd === '/highmargin') {
        const tops = getHighMarginMenus();
        let msg = `🏆 เมนู High Margin (กำไร ≥ 50%)\n${'─'.repeat(28)}\n`;
        tops.forEach(i => { msg += `• ${i.name} — ${i.price}฿ (Margin ${i.margin}%)\n`; });
        await sendMessage(senderId, msg);
        return true;
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
        return true;
    }
    
    if (cmd === '/pause') {
        setHandoff(senderId, true);
        await sendMessage(senderId, '⏸️ หยุดระบบ AI ชั่วคราว แอดมินเข้าดูแลแทนแล้วค่ะ');
        return true;
    }
    
    if (cmd === '/resume') {
        setHandoff(senderId, false);
        await sendMessage(senderId, '▶️ เปิดระบบ AI น้องกาลเวลาพร้อมให้บริการแล้วค่ะ');
        return true;
    }
    
    if (cmd === '/clearcart') {
        clearCart(senderId);
        await sendMessage(senderId, '🗑️ ล้างตะกร้าเรียบร้อยแล้วค่ะ');
        return true;
    }

    return false; // ไม่ใช่ command ที่รู้จัก
}

module.exports = { handleCommand };
