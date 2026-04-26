// ========================================================
//  services/aiService.js  (v4 - Robust Edition with Zod)
// ========================================================
const { Groq } = require('groq-sdk');
const { z } = require('zod');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// --- Schema Validation ---
const ChatResponseSchema = z.object({
    sentiment: z.enum(['HAPPY', 'NORMAL', 'FRUSTRATED', 'ANGRY']).default('NORMAL'),
    reply: z.string().min(1),
    ordered_items: z.array(z.object({
        name: z.string(),
        price: z.number(),
        qty: z.number().default(1),
        note: z.string().nullable().default(null)
    })).default([])
});

// ระบบ Key Rotation
const API_KEYS = (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;
const keyRateLimitUntil = {};

function getNextAvailableKey() {
    if (API_KEYS.length === 0) throw new Error('❌ ไม่พบ GROQ_API_KEYS ใน .env');
    const now = Date.now();
    for (let i = 0; i < API_KEYS.length; i++) {
        const idx = (currentKeyIndex + i) % API_KEYS.length;
        const key = API_KEYS[idx];
        if (!keyRateLimitUntil[key] || now > keyRateLimitUntil[key]) {
            currentKeyIndex = (idx + 1) % API_KEYS.length;
            return key;
        }
    }
    const earliest = API_KEYS.reduce((a, b) => (keyRateLimitUntil[a] || 0) < (keyRateLimitUntil[b] || 0) ? a : b);
    return earliest;
}

function markKeyRateLimit(key, retryAfterSec = 60) {
    keyRateLimitUntil[key] = Date.now() + (retryAfterSec * 1000);
    console.warn(`⏳ Key ...${key.slice(-6)} ถูก rate limit ${retryAfterSec}s → สลับ key อื่น`);
}

function getGroqClient() {
    const key = getNextAvailableKey();
    return { client: new Groq({ apiKey: key }), key };
}

const SYSTEM_PROMPT = `
# [ตัวตน]
คุณคือ "น้องกาลเวลา" ผู้ดูแลร้าน "กาลเวลา หวนคืน คาเฟ่"
บุคลิก: "ผู้เชี่ยวชาญด้านอาหารและเครื่องดื่มที่พูดตรงไปตรงมา" 
ทัศนคติ: คุณมองว่าเวลาของลูกค้ามีค่า และความซื่อสัตย์คือสิ่งสำคัญที่สุด คุณไม่ใช่พนักงานขายที่พยายามจะยัดเยียดของ แต่คุณคือ "ที่ปรึกษา" ที่จะบอกความจริงว่าอะไรดี อะไรคุ้ม และอะไรที่ลูกค้า "ไม่ควรพลาด"

# [กฎการตอบ — แบบไม่เกรงใจ (ตรงไปตรงมา)]
1. **ไม่อวยเกินจริง**: ถ้าเมนูไหนธรรมดา ก็บอกว่าทานง่าย ถ้าเมนูไหนเป็น Signature ก็บอกว่าต้องสั่ง
2. **แนะนำแบบมืออาชีพ**: ถ้าลูกค้าสั่งแค่เครื่องเคียง (Add-ons) ให้ทักท้วงทันทีว่า "มันไม่อิ่ม" หรือ "มันไม่ใช่เมนูหลัก"
3. **ใช้คำพูดกระชับ**: ตัดคำหวานล้อมออก (เช่น "ยินดีต้อนรับสู่ร้าน..." หรือ "อยากทราบข้อมูลส่วนไหน...") ให้เข้าเรื่องทันที
4. **ลงท้าย**: ใช้ "ค่ะ/คะ" ตามมารยาท แต่โทนเสียงต้องดูมั่นใจและเป็นผู้ใหญ่
5. **Emoji**: ใช้ให้น้อยที่สุด (เฉพาะที่จำเป็นจริงๆ)

# [ตัวอย่างการตอบแบบ "น้องกาลเวลา"]
- ลูกค้า: "อันนี้อร่อยไหม?"
- ตอบ: "ถ้าชอบรสเข้มตัวนี้คือที่สุดค่ะ แต่ถ้าไม่ชอบขมแนะนำให้ผ่านไปดูตัวอื่นดีกว่าค่ะ"
- ลูกค้า: "สั่งแค่อะโวคาโด"
- ตอบ: "อะโวคาโดเป็นแค่เครื่องเคียงค่ะ สั่งไปทานเปล่าๆ ไม่อิ่มแน่นอน แนะนำให้สั่งคู่กับชุด Breakfast Box Set จะคุ้มค่ากว่าค่ะ"

# [บริบทร้าน]
- Delivery เท่านั้น ไม่มีหน้าร้าน (Grab, LINE MAN, หรือร้านส่งเองฟรี 5 กม. แรก)
- ชำระเงิน: โอนธนาคาร หรือปลายทาง
- เบอร์โทร: 064-087-2920

# [วิธีสั่ง — ต้องชัดเจนครั้งเดียวจบ]
เมื่อลูกค้าจะสั่ง ต้องสรุปสิ่งที่เขาต้องทำทันที:
"สั่งตามนี้ค่ะ:
1. ชื่อเมนู + จำนวน
2. ที่อยู่ + เบอร์โทร
3. เลือกส่ง: Grab / LINE MAN / ร้านส่งเอง"

# [เมนูของร้าน]
MENU_PLACEHOLDER
`.trim();

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
    { "name": "ชื่อเมนู", "price": ราคาตัวเลข, "qty": จำนวน, "note": "หวานน้อย/null" }
  ]
}
ถ้าไม่ได้สั่งให้ ordered_items เป็น []`;

    const maxAttempts = Math.max(API_KEYS.length, 1);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { client: groq, key } = getGroqClient();
        try {
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

            const rawRes = JSON.parse(completion.choices[0]?.message?.content || '{}');
            const validated = ChatResponseSchema.safeParse(rawRes);
            
            if (!validated.success) {
                console.warn('⚠️ Validation Failed:', validated.error.format());
                throw new Error('Invalid AI Format');
            }

            const res = validated.data;
            return {
                reply: res.reply,
                sentiment: res.sentiment,
                orderedItems: res.ordered_items
            };
        } catch (err) {
            const errBody = err.message || '';
            if (errBody.includes('rate_limit') || errBody.includes('429')) {
                const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '60');
                markKeyRateLimit(key, retryAfter);
            } else {
                console.warn(`⚠️ Attempt #${attempt + 1} failed: ${errBody.slice(0, 100)}`);
            }
            if (attempt < maxAttempts - 1) continue;
        }
    }

    return {
        reply: `ขออภัยนะคะคุณ${userName} น้องกาลเวลาขอไปเตรียมเมนูอร่อยๆ แป๊บนึงนะคะ เดี๋ยวรีบกลับมาดูแลค่ะ 🙏`,
        sentiment: 'NORMAL',
        orderedItems: []
    };
}

async function generateCommentReply(commentText) {
    const prompt = `คุณคือน้องกาลเวลา จากร้าน กาลเวลา | Huan Khuen Cafe
มีคนคอมเมนต์ว่า: "${commentText}"
ตอบสั้นๆ อบอุ่น (1 ประโยค) ชวนให้ทัก Inbox เพื่อดูเมนู ลงท้ายด้วย คะ เท่านั้น`;

    try {
        const { client: groq } = getGroqClient();
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
