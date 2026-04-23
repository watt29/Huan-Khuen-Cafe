// ========================================================
//  services/catchupService.js
//  บทบาท: กวาดข้อความค้างในช่วงที่บอทปิดไป (ย้อนหลัง 30 นาที)
// ========================================================
const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const FB_API = 'https://graph.facebook.com/v19.0';

/**
 * ฟังก์ชันกวาดข้อความที่ค้างอยู่
 */
async function runCatchup(handleMessageFunc) {
    console.log('🔍 [CATCHUP] เริ่มสแกนข้อความค้าง (ย้อนหลัง 30 นาที)...');
    
    try {
        // 1. ดึงรายการสนทนาล่าสุด
        const convos = await axios.get(`${FB_API}/me/conversations`, {
            params: {
                fields: 'id,updated_time,messages.limit(1){message,id,created_time,from}',
                access_token: PAGE_TOKEN
            }
        });

        const now = new Date();
        const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000);

        for (const convo of convos.data.data) {
            const lastMsg = convo.messages?.data[0];
            if (!lastMsg) continue;

            const msgTime = new Date(lastMsg.created_time);
            
            // เงื่อนไข: ข้อความอยู่ในช่วง 30 นาที และ คนส่งไม่ใช่เพจ (เป็นลูกค้า)
            if (msgTime > thirtyMinsAgo && lastMsg.from?.id !== process.env.FACEBOOK_PAGE_ID) {
                console.log(`📩 [CATCHUP] พบข้อความค้างจาก ${lastMsg.from?.name || lastMsg.from?.id}`);
                
                // จำลอง event ให้เหมือน Webhook เพื่อส่งให้ handleMessage ทำงาน
                const mockEvent = {
                    sender: { id: lastMsg.from?.id },
                    message: { 
                        text: lastMsg.message,
                        mid: lastMsg.id 
                    }
                };
                
                // ส่งไปให้ระบบ AI ประมวลผล
                await handleMessageFunc(mockEvent);
            }
        }
        console.log('✅ [CATCHUP] สแกนเสร็จสิ้น');
    } catch (err) {
        console.error('❌ [CATCHUP] ทำงานขัดข้อง:', err.response?.data || err.message);
    }
}

module.exports = { runCatchup };
