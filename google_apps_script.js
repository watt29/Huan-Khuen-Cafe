// ========================================================
// 📊 Google Apps Script สำหรับ "กาลเวลา | Huan Khuen Cafe"
// หน้าที่: รับข้อมูลออร์เดอร์จาก Facebook Bot แล้วเขียนลงตาราง
// ========================================================

function doPost(e) {
  try {
    // แปลงข้อมูล JSON ที่ส่งมาจาก Render
    var payload = JSON.parse(e.postData.contents);
    
    // ตรวจสอบว่าเป็นการส่ง Action: 'logOrder' หรือไม่
    if (payload.action === 'logOrder') {
      var data = payload.data;
      
      // เลือก Sheet ปัจจุบัน (ชื่อ Sheet แนะนำ: "Order Logs")
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      
      // หาก Sheet ยังว่างเปล่า ให้สร้าง Header ให้อัตโนมัติ
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "วัน-เวลา", 
          "ชื่อลูกค้า (Facebook)", 
          "รายการออร์เดอร์ (Items)", 
          "ยอดรวม (บาท)", 
          "ช่องทางการชำระ", 
          "สถานะออร์เดอร์"
        ]);
        // ตกแต่ง Header ให้สวยงาม
        sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#e0e0e0");
      }
      
      // เพิ่มแถวข้อมูลใหม่
      sheet.appendRow([
        data.timestamp,       // A: วัน-เวลา
        data.customerName,    // B: ชื่อลูกค้า
        data.orderItems,      // C: รายการออร์เดอร์
        data.totalPrice,      // D: ยอดรวม
        data.paymentMethod,   // E: ช่องทางการชำระ (โอน/ปลายทาง)
        data.status           // F: สถานะ (รอการชำระเงิน)
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "message": "บันทึกออร์เดอร์เรียบร้อย"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "ignored",
      "message": "ไม่ได้ระบุ Action"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// สำหรับ Test ผ่าน Browser (เพื่อเช็คว่า Script Live หรือไม่)
function doGet(e) {
  return ContentService.createTextOutput("✅ กาลเวลา | Google Sheets API is running 100%");
}
