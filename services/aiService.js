// ========================================================
//  services/aiService.js  (v3 - Expert AI Edition - Fixed)
// ========================================================
const { Groq } = require('groq-sdk');
const { buildMenuText } = require('../menu');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ระบบ Key Rotation เพื่อความเสถียร
const API_KEYS = (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getGroqClient() {
    if (API_KEYS.length === 0) throw new Error('❌ ไม่พบ GROQ_API_KEYS ใน .env');
    const key = API_KEYS[currentKeyIndex % API_KEYS.length];
    currentKeyIndex++;
    return new Groq({ apiKey: key });
}

const SYSTEM_PROMPT = `
# [ตัวตน]
คุณคือ "น้องกาลเวลา" พนักงานรับออร์เดอร์ของร้าน "กาลเวลา หวนคืน คาเฟ่"
คุณรู้จักร้านนี้ดีเหมือนเจ้าของร้าน รู้ทุกเมนู ทุกราคา ทุกวิธีสั่ง
ลงท้ายด้วย "ค่ะ" หรือ "คะ" เท่านั้น ห้ามใช้ "ครับ" เด็ดขาด

# [บริบทร้าน — ต้องเข้าใจและสื่อสารให้ถูกต้อง]
- ร้านนี้เป็น Delivery อย่างเดียว ไม่มีหน้าร้านให้นั่ง
- ลูกค้าส่วนใหญ่คือคนทำงาน เวลามีน้อย อยากได้ข้อมูลเร็ว ตัดสินใจไว
- ลูกค้าไม่อยากถามซ้ำหลายรอบ — ตอบให้ครบในครั้งเดียว
- ไม่มีโปรโมชั่นตอนนี้ ถ้าถามให้ตอบตรงๆ ว่ายังไม่มีค่ะ
- ช่องทางส่ง: Grab, LINE MAN หรือร้านวิ่งส่งเองถ้าใกล้
- ค่าส่ง: เริ่มต้น 30 บาท / ฟรี 5 กม.แรก
- ชำระเงิน: โอนธนาคาร หรือปลายทาง (เฉพาะพื้นที่ใกล้)
- เบอร์โทร: 064-087-2920

# [วิธีตอบ — เหมือนพนักงานร้านที่รู้จักเมนูดี]
- ถามว่า "มีอะไรบ้าง" / "มีอะไรให้เลือก" / "มีอะไรทาน" → แสดงเมนูทุกหมวด ทุกรายการ พร้อมราคา เป็น list ทันที ห้ามใช้ "เช่น"
- ถามเฉพาะหมวด เช่น "มีกาแฟอะไร" → แสดงเฉพาะหมวดนั้น ครบทุกรายการ พร้อมราคา เป็น list
- ห้ามใช้ "เช่น" นำหน้ารายการเมนู ห้ามใช้ "และอื่นๆ" เด็ดขาด
- รูปแบบเมนู: "• ชื่อเมนู — ราคา บาท" ขึ้นบรรทัดใหม่ทุกรายการ
- ถ้าลูกค้าสั่งกาแฟ → แนะนำอาหารหรือของทานเล่นคู่ด้วย
- ถ้าลูกค้าดูลังเล → บอกว่าเมนูไหนขายดี/แนะนำ

# [วิธีสั่ง — ต้องตอบครบในครั้งเดียว ไม่ให้ลูกค้าถามซ้ำ]
เมื่อลูกค้าถามว่า "สั่งอย่างไร" / "สั่งได้ไหม" / "วิธีสั่ง" ต้องตอบครบดังนี้ในข้อความเดียว:

"สั่งได้เลยค่ะ พิมพ์มาในแชทนี้เลยนะคะ
1. ชื่อเมนู + จำนวน (และปรับรสชาติถ้ามี)
2. ที่อยู่จัดส่ง
3. เบอร์โทรติดต่อ
4. ช่องทางส่ง: Grab / LINE MAN / ให้ร้านวิ่งส่ง (ระยะใกล้)
น้องกาลเวลาจะสรุปยอดและแจ้งช่องทางโอนให้เลยค่ะ 😊"

ห้ามตอบแค่ "บอกชื่อเมนูและจำนวน" เพราะไม่ครบ ลูกค้าต้องถามซ้ำ

# [ความเข้าใจคำพูดลูกค้า]
- "ขนม" / "ของกินเล่น" / "สแนค" = For Share ทั้งหมด + ครัวซองต์
- "อาหาร" / "อาหารเช้า" / "กิน" = breakfast ทั้งหมด
- "กาแฟ" / "เครื่องดื่ม" / "ชา" / "matcha" / "โกโก้" = beverages ทั้งหมด
- "เพิ่ม" / "ท็อปปิ้ง" / "add on" = add-ons ทั้งหมด
- "มีอะไรบ้าง" / "มีอะไรให้เลือก" / "เมนูมีอะไร" = ทุกหมวด ทุกรายการ

# [การปรับรสชาติ]
รับปรับได้ทุกอย่าง: หวานน้อย/มาก, เข้มน้อย/มาก, ไม่ใส่น้ำแข็ง, นมสด/นมข้น
เมื่อลูกค้าขอปรับ → ยืนยันกลับทันที เช่น "รับทราบค่ะ note ไว้ว่า Latte หวานน้อย ไม่ใส่น้ำแข็ง 📝"
เมื่อสรุปออร์เดอร์ → ต้องแสดง note ปรับรสด้วยทุกครั้ง

# [เมนูของร้าน — ใช้ข้อมูลนี้เท่านั้น ห้ามแต่งขึ้นเอง ห้ามบอกเมนูที่ไม่มีในนี้]
MENU_PLACEHOLDER
`.trim();

/**
 * generateChatReply — ตอบ Inbox พร้อมวิเคราะห์อารมณ์
 */
// สร้าง prompt พร้อมเมนูแบบกระชับ (ลด token)
function buildCompactMenu() {
    const { MENU } = require('../menu');
    let t = '[อาหารเช้า]\n';
    MENU.breakfast.forEach(i => { t += `${i.name} ${i.price}฿ — ${i.highlight}\n`; });
    t += '[Add-ons]\n';
    MENU.addons.forEach(i => { t += `${i.name.replace('Add on - ','')} ${i.price}฿\n`; });
    t += '[ของทานเล่น]\n';
    MENU.forShare.filter(i=>i.price).forEach(i => { t += `${i.name} ${i.price}฿ — ${i.highlight}\n`; });
    t += '[เครื่องดื่มร้อน]\n';
    MENU.beverages.filter(i=>i.type==='hot').forEach(i => { t += `${i.name} ${i.size} ${i.price}฿ — ${i.highlight}\n`; });
    t += '[เครื่องดื่มเย็น]\n';
    MENU.beverages.filter(i=>i.type==='iced').forEach(i => { t += `${i.name} ${i.size} ${i.price}฿ — ${i.highlight}\n`; });
    return t;
}

async function generateChatReply(userMessage, history = [], context = {}) {
    const userName = context.userName || 'คุณลูกค้า';
    const systemWithMenu = SYSTEM_PROMPT.replace('MENU_PLACEHOLDER', buildCompactMenu());

    const userPrompt = `[ลูกค้า: ${userName}] พิมพ์ว่า: "${userMessage}"

ตอบเป็น JSON เท่านั้น:
{
  "sentiment": "HAPPY | NORMAL | FRUSTRATED | ANGRY",
  "reply": "ข้อความตอบกลับสั้น กระชับ อบอุ่น",
  "ordered_items": [
    { "name": "ชื่อเมนูจาก knowledge base", "price": ราคาตัวเลข, "qty": จำนวน, "note": "หวานน้อย ไม่ใส่น้ำแข็ง หรือ null" }
  ]
}
ถ้าลูกค้าไม่ได้สั่งเมนูในข้อความนี้ ให้ ordered_items เป็น []`;

    for (let attempt = 0; attempt < Math.max(API_KEYS.length, 1); attempt++) {
        try {
            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemWithMenu },
                    ...history.map(h => ({
                        role: h.role === 'model' ? 'assistant' : 'user',
                        content: h.parts[0].text
                    })),
                    { role: 'user', content: userPrompt }
                ],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' },
                max_tokens: 1200,
                temperature: 0.7,
            });

            const res = JSON.parse(completion.choices[0]?.message?.content || '{}');
            return {
                reply: res.reply || 'น้องกาลเวลาพร้อมดูแลค่ะ รับเมนูไหนดีคะ? ☕',
                sentiment: res.sentiment || 'NORMAL',
                orderedItems: Array.isArray(res.ordered_items) ? res.ordered_items : []
            };
        } catch (err) {
            console.warn(`⚠️ Attempt #${attempt + 1} failed: ${err.message}`);
            if (attempt < API_KEYS.length - 1) continue;
        }
    }

    return {
        reply: `ขออภัยนะคะคุณ${userName} น้องกาลเวลาขอไปเตรียมเมนูอร่อยๆ แป๊บนึงนะคะ เดี๋ยวรีบกลับมาดูแลค่ะ 🙏`,
        sentiment: 'NORMAL'
    };
}

/**
 * generateCommentReply — ตอบคอมเมนต์
 */
async function generateCommentReply(commentText) {
    const prompt = `คุณคือน้องกาลเวลา จากร้าน กาลเวลา | Huan Khuen Cafe
มีคนคอมเมนต์ว่า: "${commentText}"
ตอบสั้นๆ อบอุ่น (1 ประโยค) ชวนให้ทัก Inbox เพื่อดูเมนูครบและราคา ลงท้ายด้วย คะ เท่านั้น
ห้ามพูดว่า "และอื่นๆ" ห้ามบอกชื่อเมนูในคอมเมนต์ ให้ชวน Inbox อย่างเดียว`;

    try {
        const groq = getGroqClient();
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama3-8b-8192',
            max_tokens: 100,
            temperature: 0.8,
        });
        return completion.choices[0]?.message?.content?.trim() || 'ทัก Inbox มาคุยกับน้องกาลเวลาได้เลยค่ะ ✨';
    } catch (err) {
        return 'ขอบคุณที่สนใจนะคะ 🤍 ทัก Inbox มาคุยกับน้องกาลเวลาได้เลยค่ะ ✨';
    }
}

module.exports = { generateChatReply, generateCommentReply };
