// ========================================================
//  facebookService.js — ส่งข้อความกลับไปยัง Facebook API
// ========================================================
const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const FB_API = 'https://graph.facebook.com/v19.0';

// --- ส่ง Messenger Reply ---
async function sendMessage(recipientId, text) {
    try {
        await axios.post(`${FB_API}/me/messages`, {
            recipient: { id: recipientId },
            message: { text },
            messaging_type: 'RESPONSE'
        }, {
            params: { access_token: PAGE_TOKEN }
        });
        console.log(`✅ [MESSENGER] ส่งข้อความหา ${recipientId} แล้ว`);
    } catch (err) {
        console.error('❌ [MESSENGER] ส่งข้อความไม่ได้:', err.response?.data || err.message);
    }
}

// --- ส่งสถานะ "กำลังพิมพ์..." ---
async function sendTypingIndicator(recipientId, state = 'typing_on') {
    try {
        await axios.post(`${FB_API}/me/messages`, {
            recipient: { id: recipientId },
            sender_action: state
        }, {
            params: { access_token: PAGE_TOKEN }
        });
    } catch (err) {
        console.warn('⚠️ ไม่สามารถส่ง Sender Action ได้');
    }
}

// --- ส่งสถานะ "อ่านแล้ว" ---
async function sendMarkSeen(recipientId) {
    try {
        await axios.post(`${FB_API}/me/messages`, {
            recipient: { id: recipientId },
            sender_action: 'mark_seen'
        }, {
            params: { access_token: PAGE_TOKEN }
        });
    } catch (err) {
        console.warn('⚠️ ไม่สามารถส่ง Mark Seen ได้');
    }
}

// --- ดึงข้อมูลชื่อลูกค้า ---
async function getUserProfile(userId) {
    if (!userId) return null;
    try {
        // ลองดึงแบบละเอียดก่อน
        const response = await axios.get(`${FB_API}/${userId}`, {
            params: {
                fields: 'first_name,last_name,profile_pic',
                access_token: PAGE_TOKEN
            }
        });
        return response.data;
    } catch (err) {
        // ถ้าพลาด (อาจเพราะ permission) ลองดึงแค่ name อย่างเดียว
        try {
            const fallback = await axios.get(`${FB_API}/${userId}`, {
                params: {
                    fields: 'name',
                    access_token: PAGE_TOKEN
                }
            });
            if (fallback.data && fallback.data.name) {
                const names = fallback.data.name.split(' ');
                return {
                    first_name: names[0],
                    last_name: names.slice(1).join(' ') || '',
                    ...fallback.data
                };
            }
        } catch (err2) {
            console.warn('⚠️ ไม่สามารถดึง Profile ได้ (ทั้งแบบเต็มและ fallback):', err2.response?.data || err2.message);
        }
        return null;
    }
}

// --- ตอบ Comment บน Post ---
async function replyToComment(commentId, text) {
    try {
        await axios.post(`${FB_API}/${commentId}/comments`, {
            message: text
        }, {
            params: { access_token: PAGE_TOKEN }
        });
        console.log(`✅ [COMMENT] ตอบ comment ${commentId} แล้ว`);
    } catch (err) {
        console.error('❌ [COMMENT] ตอบ comment ไม่ได้:', err.response?.data || err.message);
    }
}

// --- Like Comment ---
async function likeComment(commentId) {
    try {
        await axios.post(`${FB_API}/${commentId}/likes`, {}, {
            params: { access_token: PAGE_TOKEN }
        });
        console.log(`👍 [COMMENT] Like comment ${commentId} แล้ว`);
    } catch (err) {
        // ไม่ร้ายแรง ไม่ต้อง crash
        console.warn('⚠️ Like comment ไม่ได้:', err.response?.data?.error?.message);
    }
}

module.exports = { sendMessage, replyToComment, likeComment, sendTypingIndicator, sendMarkSeen, getUserProfile };
