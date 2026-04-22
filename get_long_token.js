// ========================================================
//  get_long_token.js — สคริปต์ขอ Long-Lived Access Token (60 วัน)
// ========================================================
require('dotenv').config();
const axios = require('axios');

const {
    FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET,
    FACEBOOK_PAGE_ACCESS_TOKEN
} = process.env;

async function getLongLivedToken() {
    console.log('⏳ กำลังขอ Long-Lived Token จาก Facebook...');

    try {
        const response = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: FACEBOOK_APP_ID,
                client_secret: FACEBOOK_APP_SECRET,
                fb_exchange_token: FACEBOOK_PAGE_ACCESS_TOKEN
            }
        });

        const longToken = response.data.access_token;
        console.log('\n✅ สำเร็จ! นี่คือ Long-Lived Token ของคุณ (อายุประมาณ 60 วัน):\n');
        console.log('------------------------------------------------------------');
        console.log(longToken);
        console.log('------------------------------------------------------------');
        console.log('\n📌 กรุณานำค่านี้ไปแทนที่ FACEBOOK_PAGE_ACCESS_TOKEN ในไฟล์ .env ของคุณนะคะ');

    } catch (err) {
        console.error('❌ เกิดข้อผิดพลาด:', err.response?.data?.error?.message || err.message);
        console.log('\n💡 ตรวจสอบว่า App ID, App Secret และ Token ใน .env ถูกต้องหรือไม่');
    }
}

getLongLivedToken();
