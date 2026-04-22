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
const { handleMessage } = require('./handlers/messageHandler');
const { handleComment } = require('./handlers/commentHandler');

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
});
