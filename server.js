// ========================================================
//  server.js
//  บทบาท: ไฟล์หลัก (Entry Point) สำหรับรันเซิร์ฟเวอร์
//  การเชื่อมโยง:
//    - เป็นตัวรับ Webhook จาก Facebook (POST /webhook)
//    - ส่งต่อข้อมูล Messenger ให้ messageHandler.js
//    - ส่งต่อข้อมูล Comment ให้ commentHandler.js
// ========================================================
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { handleMessage } = require('./handlers/messageHandler');
const { handleComment } = require('./handlers/commentHandler');
const { runCatchup } = require('./services/catchupService');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

// ============================================================
// GET /webhook — สำหรับให้ Meta ยืนยัน Webhook (ทำครั้งเดียว)
// ============================================================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified by Meta!');
        res.status(200).send(challenge);
    } else {
        console.warn('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});

// ============================================================
// POST /webhook — รับ Events จาก Facebook
// ============================================================
app.post('/webhook', async (req, res) => {
    const body = req.body;

    // ต้อง response 200 เร็วๆ ก่อน ไม่งั้น Facebook จะส่ง retry
    res.sendStatus(200);

    if (body.object !== 'page') return;

    for (const entry of body.entry || []) {
        // --- 1. Messenger (Chat) ---
        for (const event of entry.messaging || []) {
            if (event.message) {
                handleMessage(event).catch(console.error);
            }
        }

        // --- 2. Comments บน Post (Feed) ---
        for (const change of entry.changes || []) {
            if (change.field === 'feed' && change.value?.item === 'comment') {
                // ตอบเฉพาะ comment ใหม่ (ไม่ใช่ edited หรือ removed)
                if (change.value?.verb === 'add') {
                    handleComment(change).catch(console.error);
                }
            }
        }
    }
});

// ============================================================
// Health Check
// ============================================================
app.get('/', (req, res) => {
    res.json({
        status: '🟢 Online',
        page: process.env.PAGE_NAME,
        timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
    });
});

// ============================================================
// [NEW] Test Endpoint — เช็คว่าบอทพร้อมตอบจริงไหม
// ============================================================
app.get('/test', async (req, res) => {
    const results = { ai: '⌛ Testing...', facebook: '⌛ Testing...' };
    
    // 1. Test AI (Groq)
    try {
        const { generateChatReply } = require('./services/aiService');
        const aiRes = await generateChatReply('สวัสดี', [], { userName: 'TestUser' });
        results.ai = `✅ OK (Reply: ${aiRes.reply})`;
    } catch (e) {
        results.ai = `❌ Error: ${e.message}`;
    }

    // 2. Test Facebook Token
    try {
        const FB_API = 'https://graph.facebook.com/v19.0';
        const fbRes = await axios.get(`${FB_API}/me`, {
            params: { access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN, fields: 'id,name' }
        });
        results.facebook = `✅ OK (Page: ${fbRes.data.name})`;
    } catch (e) {
        results.facebook = `❌ Error: ${e.response?.data?.error?.message || e.message}`;
    }

    res.json(results);
});

// ============================================================
// Self-Ping ป้องกัน Render Free Tier หลับ (ทุก 10 นาที)
// ============================================================
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

if (RENDER_URL && RENDER_URL !== 'https://YOUR-SERVICE-NAME.onrender.com') {
    async function selfPing(retryCount = 0) {
        const pingUrl = RENDER_URL.endsWith('/') ? RENDER_URL : RENDER_URL + '/';
        const timestamp = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });

        try {
            const response = await axios.get(pingUrl, { timeout: 30000 });
            console.log(`🔔 Self-ping OK: ${response.status} — ${timestamp}`);
        } catch (error) {
            console.warn(`⚠️ Self-ping failed (${error.code || error.message}) — ${timestamp}`);
            
            // ถ้าเฟล ให้ลองใหม่สูงสุด 3 ครั้ง (เว้นระยะ 2 นาที)
            if (retryCount < 3) {
                const nextRetry = 2 * 60 * 1000;
                console.log(`🔄 จะลองใหม่ใน 2 นาที (ครั้งที่ ${retryCount + 1}/3)`);
                setTimeout(() => selfPing(retryCount + 1), nextRetry);
            }
        }
    }

    // เริ่ม Ping ครั้งแรกหลังจาก Start 1 นาที
    setTimeout(selfPing, 60 * 1000);
    
    // ตั้งเวลา Ping ทุก 10 นาที
    setInterval(selfPing, 10 * 60 * 1000);
    console.log(`🔁 Self-ping ระบบเปิดใช้งาน → ${RENDER_URL} (ทุก 10 นาที)`);
} else {
    console.warn('⚠️ RENDER_EXTERNAL_URL ยังไม่ได้ตั้งค่า หรือยังเป็นค่าเริ่มต้น — Server จะหลับบน Render!');
}

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║   ☕ Huan Khuen Facebook Bot          ║');
    console.log('║   🟢 Server running on port ' + PORT + '      ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('📌 Webhook URL: http://localhost:' + PORT + '/webhook');
    console.log('📌 Verify Token:', VERIFY_TOKEN);
    console.log('');
    console.log('⚡ รอรับ Events จาก Facebook...');

    // [NEW] รัน Catch-up กวาดข้อความค้าง 30 นาทีล่าสุด
    setTimeout(() => {
        runCatchup(handleMessage).catch(err => console.error('❌ Catch-up failed:', err));
    }, 5000); // รอ 5 วินาทีให้ระบบนิ่งก่อนเริ่มกวาด
});
