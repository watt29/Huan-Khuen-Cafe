// ========================================================
//  services/googleSheetService.js (v2)
//  บทบาท: จัดการข้อมูลลง Google Sheets (Orders & Customers)
// ========================================================
const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const SCRIPT_URL = process.env.GOOGLE_SHEET_APP_URL;

/**
 * บันทึกออร์เดอร์ลง Google Sheets
 */
async function logOrderToSheet(orderData) {
    if (!SCRIPT_URL) return false;
    try {
        const payload = {
            action: 'logOrder',
            data: {
                timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
                customerName: orderData.customerName,
                orderItems: orderData.orderItems,
                totalPrice: orderData.totalPrice,
                paymentMethod: orderData.paymentMethod || 'รอแจ้งโอน',
                status: 'New Order'
            }
        };
        await axios.post(SCRIPT_URL, payload);
        return true;
    } catch (err) {
        console.error('❌ Google Sheet Order Error:', err.message);
        return false;
    }
}

/**
 * บันทึกข้อมูลลูกค้า (CRM)
 */
async function logCustomerToSheet(customerData) {
    if (!SCRIPT_URL) return false;
    try {
        const payload = {
            action: 'logCustomer',
            data: {
                timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
                name: customerData.name,
                facebookId: customerData.facebookId,
                phone: customerData.phone || '-',
                profileLink: `https://www.facebook.com/${customerData.facebookId}`
            }
        };
        await axios.post(SCRIPT_URL, payload);
        return true;
    } catch (err) {
        console.error('❌ Google Sheet Customer Error:', err.message);
        return false;
    }
}

module.exports = { logOrderToSheet, logCustomerToSheet };
