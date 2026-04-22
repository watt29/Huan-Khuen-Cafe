const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SCRIPT_URL = process.env.GOOGLE_SHEET_APP_URL;

/**
 * ส่งข้อมูลออร์เดอร์ไปยัง Google Sheets
 * @param {Object} orderData - { customerName, items, total, paymentMethod }
 */
async function logOrderToSheet(orderData) {
    if (!SCRIPT_URL) {
        console.error('❌ Google Sheet URL is not configured in .env');
        return false;
    }

    try {
        console.log(`📡 Sending order for ${orderData.customerName} to Google Sheets...`);
        const payload = {
            action: 'logOrder',
            data: {
                timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
                customerName: orderData.customerName,
                orderItems: orderData.items.join(', '),
                totalPrice: orderData.total,
                status: 'รอการชำระเงิน',
                paymentMethod: orderData.paymentMethod || 'ยังไม่ระบุ'
            }
        };

        const response = await axios.post(SCRIPT_URL, payload);
        if (response.data && response.data.status === 'success') {
            console.log('✅ Order logged successfully.');
            return true;
        } else {
            console.error('⚠️ Logging failed:', response.data);
            return false;
        }
    } catch (err) {
        console.error('❌ Logging Error:', err.message);
        return false;
    }
}

module.exports = { logOrderToSheet };
