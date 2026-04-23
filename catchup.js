// ========================================================
//  catchup.js (v2) — ไล่ตอบแชทโดยใช้ endpoint ที่บอทเข้าถึงได้
// ========================================================
require('dotenv').config();
const axios = require('axios');
const { generateChatReply } = require('./services/aiService');
const { sendMessage } = require('./services/facebookService');

const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FB_API = 'https://graph.facebook.com/v19.0';

async function catchUp() {
    console.log('🔍 กำลังดึงรายการบทสนทนา...');
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

    try {
        // 1. ดึงเฉพาะ ID บทสนทนาที่มีการอัปเดต
        const convRes = await axios.get(`${FB_API}/me/conversations`, {
            params: {
                fields: 'id,updated_time',
                access_token: PAGE_TOKEN
            }
        });

        const conversations = convRes.data.data || [];
        console.log(`💬 ตรวจสอบ ${conversations.length} บทสนทนา...`);

        let count = 0;

        for (const conv of conversations) {
            const updatedTime = new Date(conv.updated_time).getTime();
            if (updatedTime < twentyFourHoursAgo) continue;

            // 2. ดึงข้อความล่าสุดของแต่ละบทสนทนาแยกกัน
            const msgRes = await axios.get(`${FB_API}/${conv.id}/messages`, {
                params: {
                    fields: 'message,from,created_time',
                    limit: 1,
                    access_token: PAGE_TOKEN
                }
            });

            const lastMsg = msgRes.data.data?.[0];
            if (!lastMsg) continue;

            const fromId = lastMsg.from?.id;
            const fromName = lastMsg.from?.name;

            // ถ้าคนส่งล่าสุด "ไม่ใช่เพจ"
            if (fromId !== PAGE_ID) {
                console.log(`\n📩 พบแชทค้างจาก: ${fromName} (${fromId})`);
                console.log(`📝 ข้อความ: "${lastMsg.message}"`);

                const { reply } = await generateChatReply(lastMsg.message, [], { userName: fromName.split(' ')[0] });
                
                await sendMessage(fromId, reply);
                console.log(`✅ ตอบกลับเรียบร้อย`);
                count++;
            }
        }

        console.log(`\n✨ เสร็จสิ้น! ไล่ตอบไปทั้งหมด ${count} คนค่ะ`);

    } catch (err) {
        console.error('❌ พลาดที่จุดนี้:', err.response?.data || err.message);
        console.log('\n💡 หากขึ้น error สิทธิ์ ให้เช็คว่าใน Token มี pages_read_user_content หรือไม่');
    }
}

catchUp();
