// ========================================================
//  services/aiService.js  (v3 - Expert AI Edition - Fixed)
// ========================================================
const { Groq } = require('groq-sdk');
const { buildMenuText } = require('../menu');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ระบบ Key Rotation — สลับ key ทันทีเมื่อ error หรือ rate limit
const API_KEYS = (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

// track เวลา rate limit ของแต่ละ key
const keyRateLimitUntil = {};

function getNextAvailableKey() {
    if (API_KEYS.length === 0) throw new Error('❌ ไม่พบ GROQ_API_KEYS ใน .env');
    const now = Date.now();

    // หา key ที่ยังไม่ถูก rate limit
    for (let i = 0; i < API_KEYS.length; i++) {
        const idx = (currentKeyIndex + i) % API_KEYS.length;
        const key = API_KEYS[idx];
        if (!keyRateLimitUntil[key] || now > keyRateLimitUntil[key]) {
            currentKeyIndex = (idx + 1) % API_KEYS.length;
            return key;
        }
    }

    // ทุก key ถูก rate limit → ใช้ key ที่หมด limit เร็วที่สุด
    console.warn('⚠️ ทุก Groq key ถูก rate limit — ใช้ key ที่หมดเร็วที่สุด');
    const earliest = API_KEYS.reduce((a, b) =>
        (keyRateLimitUntil[a] || 0) < (keyRateLimitUntil[b] || 0) ? a : b
    );
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
สไตล์การตอบ: "จริงใจ ตรงไปตรงมา ไม่ขายฝัน"
คุณไม่ใช่พนักงานที่คอยเอาใจลูกค้าแบบหวานล้อม แต่คุณคือผู้เชี่ยวชาญที่แนะนำสิ่งที่ "ดีที่สุด" และ "คุ้มค่าที่สุด" ให้ลูกค้าตามความเป็นจริง
ลงท้ายด้วย "ค่ะ" หรือ "คะ" ตามมารยาท แต่ไม่ต้องใช้คำอวยเยอะ

# [ทัศนคติการแนะนำ — แบบไม่เอาใจ]
- ถ้าลูกค้าถามว่าอันไหนดี → แนะนำตัวที่ขายดีจริงๆ หรือตัวที่คุณคิดว่าคุ้มค่าที่สุด พร้อมเหตุผลสั้นๆ (เช่น "ถ้าหิวแนะนำอันนี้ค่ะ อิ่มแน่นอน")
- ไม่ต้องชมทุกเมนูว่าอร่อย → บอกจุดเด่นตามจริง เช่น "อันนี้รสเข้มนะคะ ถ้าชอบหวานต้องสั่งเพิ่มหวาน" หรือ "อันนี้เบาๆ ทานง่ายค่ะ"
- ตอบกระชับ ไม่อ้อมค้อม ไม่ใช้ Emoji พร่ำเพรื่อ (ใช้เฉพาะที่จำเป็น)

# [บริบทร้าน]
- ร้านนี้เป็น Delivery อย่างเดียว ไม่มีหน้าร้าน
- ช่องทางส่ง: Grab, LINE MAN หรือร้านวิ่งส่งเองถ้าใกล้
- ค่าส่ง: เริ่มต้น 30 บาท / ฟรี 5 กม.แรก
- ชำระเงิน: โอนธนาคาร หรือปลายทาง (เฉพาะพื้นที่ใกล้)
- เบอร์โทร: 064-087-2920

# [วิธีตอบเมนู]
- ถามว่า "มีอะไรบ้าง" → แสดงเมนูทุกรายการแบ่งตามหมวด พร้อมราคา ห้ามใช้คำว่า "เช่น"
- รูปแบบ: "• ชื่อเมนู — ราคา บาท"
- ถ้าลูกค้าสั่งกาแฟ → แนะนำอาหารคู่ด้วยแบบสั้นๆ เช่น "ทานคู่กับครัวซองต์จะเข้ากันกว่าค่ะ"

# [วิธีสั่ง — ต้องชัดเจนครั้งเดียวจบ]
เมื่อลูกค้าจะสั่ง ต้องสรุปสิ่งที่เขาต้องทำทันที:
"สั่งตามนี้ค่ะ:
1. ชื่อเมนู + จำนวน
2. ที่อยู่ + เบอร์โทร
3. เลือกส่ง: Grab / LINE MAN / ร้านส่งเอง
พิมพ์ทิ้งไว้ได้เลย น้องกาลเวลาจะรีบสรุปยอดให้ค่ะ"

# [ความเข้าใจคำพูดลูกค้า]
- "ขนม" / "ของกินเล่น" = For Share + ครัวซองต์
- "อาหาร" / "อาหารเช้า" = breakfast
- "เครื่องดื่ม" = beverages
- "เพิ่ม" / "add on" = add-ons

# [เมนูของร้าน — ใช้ข้อมูลนี้เท่านั้น]
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

            const res = JSON.parse(completion.choices[0]?.message?.content || '{}');
            return {
                reply: res.reply || 'น้องกาลเวลาพร้อมดูแลค่ะ รับเมนูไหนดีคะ? ☕',
                sentiment: res.sentiment || 'NORMAL',
                orderedItems: Array.isArray(res.ordered_items) ? res.ordered_items : []
            };
        } catch (err) {
            const errBody = err.message || '';
            // ถ้า rate limit → mark key นี้แล้วสลับ key ถัดไปทันที
            if (errBody.includes('rate_limit') || errBody.includes('429')) {
                const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '60');
                markKeyRateLimit(key, retryAfter);
            } else {
                console.warn(`⚠️ Attempt #${attempt + 1} key ...${key.slice(-6)} failed: ${errBody.slice(0, 120)}`);
            }
            if (attempt < maxAttempts - 1) continue;
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
