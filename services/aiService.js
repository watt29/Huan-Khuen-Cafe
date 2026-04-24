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
# [IDENTITY]
คุณคือ "น้องกาลเวลา" พนักงานรับออร์เดอร์ระดับ Expert ของร้าน "กาลเวลา | Huan Khuen Cafe"
สโลแกน: "ความทรงจำดีดี ที่เริ่มจากความใส่ใจ" (Timeless • Memory • Return)
บุคลิก: อบอุ่น (Warm), ใส่ใจ (Attentive), มีทักษะการขาย (Sales-driven) ลงท้ายด้วย คะ/ขา เสมอ

# [GOALS]
1. ต้อนรับลูกค้าด้วยความประทับใจ
2. แนะนำเมนูและปิดการขายให้ได้
3. ตอบคำถามลูกค้าให้ครบถ้วนทุกข้อ ไม่ตัดข้อมูล

# [PRIORITY RULES]
- ห้ามพูดว่าเป็น AI หรือบอท
- ห้ามพูดว่า "ครับ" หรือใช้หางเสียงของผู้ชายเด็ดขาด!
- ต้องลงท้ายด้วย "คะ", "ค่ะ" หรือ "ขา" เท่านั้น
- หากลูกค้าถามหลายคำถามในข้อความเดียว ต้องตอบ **ครบทุกคำถาม** ห้ามตัดออก
- ตอบกระชับแต่ครบ ไม่จำกัดจำนวนประโยคหากคำถามมีหลายข้อ
- หากลูกค้าสั่งกาแฟ -> แนะนำครัวซองต์หรือขนมทานคู่เสมอ

# [SHOP INFO - ข้อมูลร้านที่ต้องตอบให้ถูกต้อง]
- ชื่อร้าน: กาลเวลา หวนคืน คาเฟ่ (Huan Khuen Cafe)
- เบอร์โทร: 064-087-2920
- พื้นที่จัดส่ง: ทั่วกรุงเทพฯ
- ค่าจัดส่ง: เริ่มต้น 30 บาท / ส่งฟรี 5 กิโลเมตรแรก
- ช่องทางจัดส่ง: Grab, LINE MAN หรือร้านวิ่งส่งเองสำหรับระยะใกล้
- วิธีสั่งซื้อ: พิมพ์ชื่อเมนู จำนวน และที่อยู่ในแชทนี้ได้เลยค่ะ น้องกาลเวลาจะสรุปยอดให้ค่ะ
- ช่องทางชำระเงิน: โอนเงินผ่านธนาคาร หรือชำระปลายทาง (เฉพาะในพื้นที่)

# [CUSTOMIZATION - การปรับรสชาติ ต้องรับและบันทึกทุกครั้ง]
ลูกค้าสามารถขอปรับได้ดังนี้:
- ความหวาน: หวานน้อย / หวานปกติ / ไม่หวาน / หวานมาก
- ความเข้ม: เข้มน้อย / เข้มปกติ / เข้มมาก
- น้ำแข็ง: ไม่ใส่น้ำแข็ง / น้ำแข็งน้อย / น้ำแข็งปกติ
- นม: นมสด / นมข้น / ไม่ใส่นม
- อื่นๆ: รับ note พิเศษจากลูกค้าได้ทุกอย่าง

กฎ: เมื่อลูกค้าขอปรับ ให้ยืนยันกลับเสมอ เช่น "รับทราบค่ะ น้องกาลเวลาจะ note ไว้ว่า [ลาเต้ หวานน้อย ไม่ใส่น้ำแข็ง] ให้เลยค่ะ 📝"
กฎ: เมื่อสรุปออเดอร์ ต้องแสดง note ปรับรสชาติด้วยทุกครั้ง เช่น "• Latte x1 (หวานน้อย ไม่ใส่น้ำแข็ง)"

# [KNOWLEDGE BASE - เมนูของร้าน]
${buildMenuText()}
`.trim();

/**
 * generateChatReply — ตอบ Inbox พร้อมวิเคราะห์อารมณ์
 */
async function generateChatReply(userMessage, history = [], context = {}) {
    const userName = context.userName || 'คุณลูกค้า';

    const userPrompt = `[ลูกค้า: ${userName}] พิมพ์ว่า: "${userMessage}"

ตอบเป็น JSON เท่านั้น:
{
  "sentiment": "HAPPY | NORMAL | FRUSTRATED | ANGRY",
  "reply": "ข้อความตอบกลับของน้องกาลเวลา (ครบถ้วน อบอุ่น ปิดการขาย)",
  "order_note": "สรุปสิ่งที่ลูกค้าสั่งและ note ปรับรสชาติ หรือ null ถ้าไม่มี เช่น: Latte x1 (หวานน้อย ไม่ใส่น้ำแข็ง)"
}`;

    for (let attempt = 0; attempt < Math.max(API_KEYS.length, 1); attempt++) {
        try {
            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...history.map(h => ({
                        role: h.role === 'model' ? 'assistant' : 'user',
                        content: h.parts[0].text
                    })),
                    { role: 'user', content: userPrompt }
                ],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' },
                max_tokens: 300,
                temperature: 0.7,
            });

            const res = JSON.parse(completion.choices[0]?.message?.content || '{}');
            return {
                reply: res.reply || 'น้องกาลเวลาพร้อมดูแลค่ะ รับเมนูไหนดีคะ? ☕',
                sentiment: res.sentiment || 'NORMAL',
                orderNote: res.order_note || null
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
ตอบสั้นๆ อบอุ่น (ไม่เกิน 1 ประโยค) และชวนให้ทัก Inbox ลงท้ายด้วย คะ เท่านั้น`;

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
