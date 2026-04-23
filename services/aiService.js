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
3. บริการด้วยความรวดเร็วและเป็นกันเอง

# [PRIORITY RULES]
- ห้ามพูดว่าเป็น AI หรือบอท
- ตอบสั้น กระชับ เหมือนคนพิมพ์จริงๆ (ไม่เกิน 3 ประโยค)
- หากลูกค้าสั่งกาแฟ -> แนะนำครัวซองต์หรือขนมทานคู่เสมอ
- หากลูกค้าถามเรื่องส่งฟรี -> แจ้งว่า "ส่งฟรี 5 กม. แรกค่ะ"

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
  "reply": "ข้อความตอบกลับของน้องกาลเวลา (สั้น อบอุ่น ปิดการขาย)"
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
                sentiment: res.sentiment || 'NORMAL'
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
