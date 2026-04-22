// ========================================================
//  services/syncService.js — ซิงค์ข้อมูลเมนูจาก Google Sheets
// ========================================================
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_APP_URL;
const DATA_PATH = path.join(__dirname, '../data/recipes.json');

/**
 * ดึงข้อมูลจาก Google Sheets และบันทึกลงไฟล์ JSON
 */
async function syncMenuFromSheets() {
    if (!GOOGLE_SHEET_URL) {
        console.error('❌ ไม่พบ GOOGLE_SHEET_APP_URL ใน .env');
        return false;
    }

    try {
        console.log('⏳ กำลังซิงค์ข้อมูลจาก Google Sheets...');
        const response = await axios.get(GOOGLE_SHEET_URL);
        
        if (response.data) {
            // สร้างโฟลเดอร์ data ถ้ายังไม่มี
            if (!fs.existsSync(path.dirname(DATA_PATH))) {
                fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
            }

            // บันทึกข้อมูลลงไฟล์
            fs.writeFileSync(DATA_PATH, JSON.stringify(response.data, null, 2), 'utf8');
            console.log('✅ ซิงค์ข้อมูลสำเร็จ! บันทึกไว้ที่:', DATA_PATH);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Sync Error:', error.message);
        return false;
    }
}

/**
 * โหลดข้อมูลเมนูที่ซิงค์มา (ถ้าไม่มีให้ใช้ค่า Default)
 */
function getDynamicMenu() {
    if (fs.existsSync(DATA_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        } catch (e) {
            return null;
        }
    }
    return null;
}

module.exports = { syncMenuFromSheets, getDynamicMenu };
