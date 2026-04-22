// ========================================================
//  menu.js — ข้อมูลเมนูอย่างเป็นทางการ (Official Menu Data)
//  อ้างอิงจาก: Summary COGS Sheet + COG Detail Sheets
//  COG = ต้นทุนสินค้า (Cost of Goods) ต่อ 1 ชิ้น/แก้ว (ไม่รวมแพ็กเกจจิ้ง Takeaway)
//  margin = กำไรขั้นต้น % = (ราคาขาย - COG รวม) / ราคาขาย * 100
// ========================================================

const MENU = {
    // --- 1. Breakfast & Food ---
    breakfast: [
        {
            id: 'b1', name: 'The Classic SW', price: 69.00,
            cog: 27.61, cogPct: 0.54,
            margin: 59, // (69 - 37.11) / 69 * 100 (รวม packaging TA)
            ingredients: ['Wheatbread x2', 'Egg x1', 'Butter Parmesan 10g', 'Napkin', 'Wax Paper'],
            highlight: 'แซนด์วิชคลาสสิก ไข่ + เนยพาร์เมซาน'
        },
        {
            id: 'b2', name: 'The Tasty Cheddar SW', price: 79.00,
            cog: 31.95, cogPct: 0.52,
            margin: 56,
            ingredients: ['Wheatbread x2', 'Egg x1', 'Butter Parmesan 10g', 'Cheddar Slice x1', 'Napkin', 'Wax Paper'],
            highlight: 'แซนด์วิช + เชดดาร์สไลซ์ นัวเป็นพิเศษ'
        },
        {
            id: 'b3', name: 'The Big Breakfast Box Set', price: 329.00,
            cog: 160.58, cogPct: 0.59,
            margin: 41,
            ingredients: ['Sourdough', 'Smoked Bacon x3', 'Chipolatas', 'Cherry Tomato', 'Mushroom', 'Hash Brown', 'Egg x2', 'Butter', 'Rocket', 'Baked Beans', 'Whipping Cream'],
            highlight: 'Box Set อาหารเช้าจัดเต็ม คุ้มสุดในเมนู'
        },
        {
            id: 'b4', name: 'Croissant Thai Bake Egg', price: 139.00,
            cog: 63.11, cogPct: 0.57,
            margin: 43,
            ingredients: ['Croissant x1', 'Egg x1', 'Mushroom 40g', 'Pork Mince 60g', 'Butter Parmesan 5g'],
            highlight: 'ครัวซองต์อบใหม่ ไส้ไข่ไทย + เห็ด + หมูสับ'
        },
        {
            id: 'b5', name: 'Croissant Thai Bake Egg Cheesy', price: 159.00,
            cog: 76.37, cogPct: 0.58,
            margin: 42,
            ingredients: ['Croissant x1', 'Egg x1', 'Mushroom 40g', 'Pork Mince 60g', 'Butter Parmesan 5g', 'Cheddar Slice x1'],
            highlight: 'ครัวซองต์อบใหม่ ไส้ไข่ไทย + เชดดาร์ละลาย'
        }
    ],

    // --- 2. Add-ons ---
    addons: [
        { id: 'a1', name: 'Add on - Smoked Chicken Breast', price: 35.00, cog: 13.90, margin: 60 },
        { id: 'a2', name: 'Add on - Smoked Bacon',          price: 40.00, cog: 14.15, margin: 65 },
        { id: 'a3', name: 'Add on - Avocado',               price: 20.00, cog: 11.25, margin: 44 },
        { id: 'a4', name: 'Add on - Cheddar Slice',         price: 15.00, cog:  4.35, margin: 71 }
    ],

    // --- 3. For Share ---
    // COG ที่คำนวณได้จาก CSV (ครบทุกเมนู)
    // เมนูที่มี #ERROR ใน Excel ถูกคำนวณใหม่จากราคาวัตถุดิบจริง
    forShare: [
        {
            id: 's1', name: "Mac N' Cheese ball", price: 79.00,
            cog: 42.08, cogPct: 0.53, margin: 47,
            highlight: 'ลูกชีสบอล Mac N Cheese 8 ลูก'
        },
        {
            id: 's2', name: 'Chicken Pop', price: 59.00,
            cog: 21.86, cogPct: 0.37, margin: 63,
            highlight: 'ไก่ป๊อบ Tyson 150g ซอสพริก'
        },
        // ---- เมนูที่คำนวณ COG ใหม่จากข้อมูลจริง (เคย #ERROR) ----
        {
            id: 's3', name: 'Calamari & Chips', price: null,
            // CRUMB SQUID RING 100g (843.75/25pcs=33.75) + FARM FRITES 150g (523.48/12000*150=6.54)
            // KETCHUP 30g (24.6/1200*30=0.62) + SALT 1g (13/1000=0.01) + TARTAR 30g (69.73/1000*30=2.09)
            // LEMON 20g (82.73/1000*20=1.65) + WAX PAPER (0.52) + NAPKIN (0.23)
            cog: 45.41, cogPct: null, margin: null,
            note: 'ราคายังไม่กำหนด — COG ประมาณ 45.41 ฿'
        },
        {
            id: 's4', name: 'Waffle Fries', price: null,
            // WAFFLE FRIES 200g (201/2040*200=19.71) + CHILI MAYO 30g (2.49) + KETCHUP (0.62)
            // WAX PAPER (0.52) + NAPKIN (0.23)
            cog: 23.57, cogPct: null, margin: null,
            note: 'ราคายังไม่กำหนด — COG ประมาณ 23.57 ฿'
        },
        {
            id: 's5', name: 'Truffle Fries', price: null,
            // FARM FRITES 200g (523.48/12000*200=8.72) + TRUFFLE SPRINKLE 8g (64.8/200*8=2.59)
            // TRUFFLE DIPPING 30g (ประมาณ ~8฿) + PARSLEY 0.5g (0.71) + WAX PAPER (0.52) + NAPKIN (0.23)
            cog: 20.77, cogPct: null, margin: null,
            note: 'ราคายังไม่กำหนด — COG ประมาณ 20.77 ฿'
        },
        {
            id: 's6', name: 'Chips & Dips', price: null,
            // FARM FRITES 300g (523.48/12000*300=13.09) + KETCHUP (0.62) + CHILI MAYO (2.49)
            // SALT (0.01) + PARSLEY (0.71) + WAX PAPER (0.52) + NAPKIN (0.23)
            cog: 17.67, cogPct: null, margin: null,
            note: 'ราคายังไม่กำหนด — COG ประมาณ 17.67 ฿'
        },
        {
            id: 's7', name: 'Mushroom Cream Soup', price: null,
            // MUSHROOM SOUP PREP 100g (~28฿) + FULL CREAM MILK 20ml (0.71) + BLACK PEPPER (0.56)
            // ANCHOR BUTTER 5g (4845.33/20000*5=1.21) + WHIPPING CREAM 20g (1064/12000*20=1.77)
            // PARSLEY (0.71) + SOURDOUGH 0.5pcs (462/76*0.5=3.04) + NAPKIN (0.23)
            cog: 36.23, cogPct: null, margin: null,
            note: 'ราคายังไม่กำหนด — COG ประมาณ 36.23 ฿'
        }
    ],

    // --- 4. Beverage ---
    beverages: [
        {
            id: 'd1', name: 'Black Coffee - Hot', price: 55.00,
            cog: 25.79, cogPct: 0.49, margin: 51,
            size: '8 oz', type: 'hot',
            highlight: 'Old Town Coffee สูตรเข้ม'
        },
        {
            id: 'd2', name: 'Wake up Milk - Hot', price: 60.00,
            cog: 30.02, cogPct: 0.52, margin: 48,
            size: '8 oz', type: 'hot',
            highlight: 'Sleepyhead Coffee + นมสด'
        },
        {
            id: 'd3', name: 'Classic Coffee - Americano', price: 50.00,
            cog: 26.50, cogPct: 0.55, margin: 45,
            size: '16 oz', type: 'iced',
            highlight: 'Classic Coffee สกัดเย็น'
        },
        {
            id: 'd4', name: 'Stronger Coffee - Cappucino', price: 50.00,
            cog: 25.87, cogPct: 0.54, margin: 46,
            size: '16 oz', type: 'iced',
            highlight: 'Strong Man + นมสด'
        },
        {
            id: 'd5', name: 'Rum Milky Coffee - Latte', price: 70.00,
            cog: 34.77, cogPct: 0.51, margin: 49,
            size: '16 oz', type: 'iced',
            highlight: 'Rum Raisin Coffee + นมสด กลิ่นหอมพิเศษ'
        },
        {
            id: 'd6', name: 'Peaberry Orange Coffee - Fruity***', price: 80.00,
            cog: 42.70, cogPct: 0.55, margin: 45,
            size: '14 oz', type: 'iced',
            highlight: 'Peaberry + Tipco Tangerine ซ่าสดชื่น'
        },
        {
            id: 'd7', name: 'Nishio Coconut Pure Matcha***', price: 80.00,
            cog: 39.91, cogPct: 0.51, margin: 49,
            size: '14 oz', type: 'iced',
            highlight: 'Maromi Matcha + Coconut Water Tipco'
        },
        {
            id: 'd8', name: 'Shizuoka Matcha Milky***', price: 80.00,
            cog: 41.59, cogPct: 0.53, margin: 47,
            size: '14 oz', type: 'iced',
            highlight: 'Nishio Matcha 6g + นมสด พรีเมียมจากญี่ปุ่น'
        },
        {
            id: 'd9', name: 'Huan Khuen (กาลเวลา) - 16 oz', price: 50.00,
            cog: 22.72, cogPct: 0.47, margin: 53,
            size: '16 oz', type: 'iced',
            highlight: 'ชาไทยสูตรบ้าน ผสมกาแฟ นมสด ชาพรีเมียม'
        },
        {
            id: 'd10', name: 'Thai Milk Tea - 16 oz', price: 45.00,
            cog: 19.48, cogPct: 0.45, margin: 55,
            size: '16 oz', type: 'iced',
            highlight: 'ชาไทย Chatramue + Synova Tea + นมสด'
        },
        {
            id: 'd11', name: 'Dark Choco 63.7% Signature - 16 oz***', price: 70.00,
            cog: 34.57, cogPct: 0.51, margin: 49,
            size: '16 oz', type: 'iced',
            highlight: 'Van Houten 65.7% + นมสด ช็อกโกแลตเข้มข้น'
        }
    ],

    // --- 5. Shop Meta Data ---
    shop: {
        name: 'กาลเวลา | Huan Khuen Cafe',
        slogan: 'ความทรงจำดีดี ที่เริ่มจากความใส่ใจ',
        philosophy: 'Timeless • Memory • Return',
        contact: '064-087-2920'
    }
};

// ─────────────────────────────────────────────
//  Helper: เมนูที่ขายได้จริง (มีราคา)
// ─────────────────────────────────────────────
function getActiveMenus() {
    return {
        breakfast: MENU.breakfast,
        addons: MENU.addons,
        forShare: MENU.forShare.filter(i => i.price !== null),
        beverages: MENU.beverages
    };
}

// ─────────────────────────────────────────────
//  Helper: เมนู High Margin (margin >= 50%)
// ─────────────────────────────────────────────
function getHighMarginMenus() {
    const all = [
        ...MENU.breakfast,
        ...MENU.addons,
        ...MENU.forShare.filter(i => i.price !== null),
        ...MENU.beverages
    ];
    return all.filter(i => i.margin >= 50).sort((a, b) => b.margin - a.margin);
}

// ─────────────────────────────────────────────
//  สร้างข้อความเมนูสำหรับ AI (Knowledge Base)
// ─────────────────────────────────────────────
function buildMenuText() {
    let text = `📖 รายการเมนูร้านกาลเวลา (Huan Khuen Cafe)\n\n`;

    text += `[มื้อเช้าพรีเมียม]\n`;
    MENU.breakfast.forEach(i => text += `• ${i.name}: ${i.price.toFixed(2)}.- (${i.highlight})\n`);

    text += `\n[Add-ons เพิ่มความนัว]\n`;
    MENU.addons.forEach(i => text += `• ${i.name}: ${i.price.toFixed(2)}.-\n`);

    text += `\n[เมนูทานเล่น]\n`;
    MENU.forShare.filter(i => i.price !== null).forEach(i =>
        text += `• ${i.name}: ${i.price.toFixed(2)}- (${i.highlight})\n`
    );

    text += `\n[เมนูเครื่องดื่มแนะนำ]\n`;
    MENU.beverages.forEach(i => text += `• ${i.name}: ${i.price.toFixed(2)}.- ${i.size} (${i.highlight})\n`);

    return text.trim();
}

// ─────────────────────────────────────────────
//  สร้างรายงาน COG สำหรับ Admin Command /cog
// ─────────────────────────────────────────────
function buildCogReport(filter = 'all') {
    const categories = [
        { label: '🍳 Breakfast', items: MENU.breakfast },
        { label: '➕ Add-ons',   items: MENU.addons },
        { label: '🍟 For Share', items: MENU.forShare.filter(i => i.price !== null) },
        { label: '☕ Beverage',  items: MENU.beverages }
    ];

    let report = `📊 รายงาน COG ร้านกาลเวลา\n${'─'.repeat(30)}\n`;

    for (const cat of categories) {
        report += `\n${cat.label}\n`;
        for (const item of cat.items) {
            const marginIcon = item.margin >= 60 ? '🟢' : item.margin >= 45 ? '🟡' : '🔴';
            report += `${marginIcon} ${item.name}\n`;
            report += `   ราคา: ${item.price}฿ | COG: ${item.cog}฿ | Margin: ${item.margin}%\n`;
        }
    }

    // สรุปเมนูที่ยังไม่มีราคา (For Share ที่ #ERROR)
    const pending = MENU.forShare.filter(i => i.price === null);
    if (pending.length) {
        report += `\n⚠️ เมนูรอกำหนดราคา\n`;
        pending.forEach(i => report += `• ${i.name} — ${i.note}\n`);
    }

    return report;
}

module.exports = { MENU, buildMenuText, buildCogReport, getActiveMenus, getHighMarginMenus };
