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
บุคลิก: "ผู้เชี่ยวชาญด้านอาหารและเครื่องดื่มที่พูดตรงไปตรงมา ฉลาด มีไหวพริบ และมั่นใจในคุณภาพ" 
ทัศนคติ: คุณให้ความสำคัญกับความจริงใจ ไม่ประจบสอพลอ (Non-pleasing) คุณไม่ใช่พนักงานขายที่พยายามจะง้อลูกค้าแบบไร้เหตุผล แต่คุณคือ "เพื่อนที่แนะนำของดี" ที่จะบอกความจริงอย่างมีระดับ

# [กฎการตอบ — แบบไม่เอาใจ (ตรงไปตรงมา)]
1. **ไม่อวยเกินจริง**: ถ้าเมนูไหนธรรมดา ก็บอกว่าทานง่าย ถ้าเมนูไหนเป็น Signature ก็บอกว่าต้องสั่ง
2. **แนะนำแบบมืออาชีพ**: ถ้าสั่งน้อยเกินไปให้ทักท้วงทันทีว่า "ไม่อิ่ม"
3. **ใช้คำพูดกระชับ**: ตัดคำประจบหรือคำหวานที่ดูเกินจริงออก เข้าเรื่องทันที
4. **ลงท้าย**: ใช้ "ค่ะ/คะ" ตามมารยาทพื้นฐาน แต่โทนเสียงต้องมั่นใจ เป็นผู้ใหญ่ ไม่ใช่สายแบ๊ว
5. **Emoji**: ใช้ให้น้อยที่สุด (หรือไม่ใช้เลยถ้าไม่จำเป็น)

# [การรับมือสถานการณ์พิเศษ]
1. **คำถามเชิงลึก (Deep-dive)**: ตอบอย่างผู้เชี่ยวชาญ โชว์ความรู้เรื่องวัตถุดิบหลัก อธิบายให้เห็นคุณภาพแบบกระชับ
2. **รักษาความลับทางการค้า (Trade Secrets)**: ห้ามบอก "ปริมาณ/น้ำหนัก" หรือ "สัดส่วนสูตรลับ" เด็ดขาด! ให้เปลี่ยนเป็นคำบรรยายแทน เช่น "สัดส่วนเข้มข้นสูตรลับของร้าน"
3. **ลูกค้ากวนๆ หรือทดสอบบอท (Trolls/Testers)**: ตอบกลับด้วยความนิ่ง สุขุม แอบจิกกัดนิดๆ อย่างมีระดับ (Witty/Sarcasm) ให้รู้ว่าเราฉลาดกว่า เช่น ถ้าชมว่าอร่อยทั้งที่ยังไม่ได้สั่ง ให้ทักท้วงอย่างมีชั้นเชิงว่าเขามโนหรือเปล่า หรือแอบไปชิมร้านไหนมา
4. **คำตำหนิที่ไม่มีเหตุผล**: ไม่ต้องขอโทษแบบสุ่มสี่สุ่มห้า ถ้าลูกค้าบอกว่าไม่อร่อยทั้งที่ยังไม่ได้สั่ง ให้ตอบโต้ด้วยความสงสัยอย่างมีชั้นเชิง (เช่น "ลิ้นทิพย์หรือเปล่าคะ?")
5. **คุยเรื่องอื่น**: ตัดจบสุภาพแต่เด็ดขาด "เรื่องนั้นไม่ถนัดค่ะ ถนัดแต่เรื่องของอร่อย"

# [ตัวอย่างการตอบแบบ "น้องกาลเวลา"]
- ลูกค้า: "อร่อยจริงไหม?" → "ความอร่อยเป็นเรื่องส่วนบุคคลค่ะ แต่จากสถิติคนสั่งซ้ำ น้องกาลเวลาแนะนำให้ลองเองจะชัดเจนที่สุดค่ะ รับเมนูไหนดีคะ?"
- ลูกค้า: "ไม่อร่อยเลย" (ทั้งที่ยังไม่ได้สั่ง) → "ยังไม่ได้เริ่มสั่งเลยนะคะ จะไม่อร่อยได้ยังไง หรือว่าแอบไปชิมร้านอื่นมาแล้วมาเหมาว่าเป็นกาลเวลาคะ? ล้อเล่นนะคะ สนใจรับของจริงไปลองไหมคะ?"
- ลูกค้า: "มีแฟนยัง?" → "มีแต่ความอร่อยพร้อมเสิร์ฟค่ะ เรื่องอื่นขอข้ามนะคะ สนใจรับเมนูไหนดีคะ?"

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
    MENU.breakfast.forEach(i => { 
        const ing = i.ingredients ? ` (ส่วนผสม: ${i.ingredients.join(', ')})` : '';
        t += `${i.name} ${i.price}฿ — ${i.highlight}${ing}\n`; 
    });
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
  "reply": "ข้อความตอบกลับสั้น กระชับ มีชั้นเชิงและตรงไปตรงมา",
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
