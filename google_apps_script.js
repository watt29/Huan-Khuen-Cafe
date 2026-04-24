// ========================================================
// 📊 Google Apps Script สำหรับ "กาลเวลา | Huan Khuen Cafe"
// หน้าที่: รับข้อมูลออร์เดอร์จาก Facebook Bot แล้วเขียนลงตาราง
// ========================================================

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── logOrder ──────────────────────────────────────────
    if (payload.action === 'logOrder') {
      var data = payload.data;
      // รองรับทั้ง "ชีท1" และ "Order Logs"
      var orderSheet = ss.getSheetByName('ชีท1') || ss.getSheetByName('Order Logs') || ss.getActiveSheet();

      // อัพเดต header ให้ครบ 9 คอลัมน์ ไม่ว่า Sheet จะมี header เก่าหรือใหม่
      var headers = ['วัน-เวลา', 'ชื่อลูกค้า', 'รายการออร์เดอร์ + Note',
                     'ยอดรวม (฿)', 'ช่องทางชำระ',
                     'ที่อยู่จัดส่ง', 'เบอร์โทร', 'ช่องทางส่ง', 'สถานะ'];
      if (orderSheet.getLastRow() === 0) {
        orderSheet.appendRow(headers);
        orderSheet.getRange('A1:I1').setFontWeight('bold').setBackground('#e0e0e0');
      } else if (orderSheet.getRange(1, 1).getValue() === 'Timestamp') {
        // header เก่าภาษาอังกฤษ → เขียนทับด้วย header ใหม่
        orderSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        orderSheet.getRange('A1:I1').setFontWeight('bold').setBackground('#e0e0e0');
      }

      orderSheet.appendRow([
        data.timestamp,
        data.customerName,
        data.orderItems,
        data.totalPrice,
        data.paymentMethod,
        data.deliveryAddress || '-',
        data.deliveryPhone   || '-',
        data.deliveryMethod  || '-',
        data.status || 'New Order'
      ]);

      return ok('บันทึกออร์เดอร์เรียบร้อย');
    }

    // ── logCustomer (CRM) ─────────────────────────────────
    if (payload.action === 'logCustomer') {
      var cdata = payload.data;
      // รองรับทั้ง "CRM" และ "Customers"
      var crmSheet = ss.getSheetByName('CRM') || ss.getSheetByName('Customers') || ss.insertSheet('CRM');

      var crmHeaders = ['First Interaction', 'Name', 'Facebook ID', 'Phone', 'เปิดแชท (Inbox)'];
      if (crmSheet.getLastRow() === 0) {
        crmSheet.appendRow(crmHeaders);
        crmSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#cfe2ff');
      } else if (crmSheet.getRange(1, 5).getValue() !== 'เปิดแชท (Inbox)') {
        // header เก่าไม่มีคอลัมน์ "เปิดแชท" → เขียนทับ
        crmSheet.getRange(1, 1, 1, crmHeaders.length).setValues([crmHeaders]);
        crmSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#cfe2ff');
      }

      // ไม่บันทึกซ้ำถ้า Facebook ID เดิมมีอยู่แล้ว
      var ids = crmSheet.getRange(2, 3, Math.max(crmSheet.getLastRow() - 1, 1), 1).getValues().flat();
      if (ids.includes(String(cdata.facebookId))) return ok('ลูกค้าเดิม ข้ามการบันทึก');

      // แก้ปัญหาชื่อ ??? — decode UTF-8 ให้ถูกต้อง
      var safeName = cdata.name ? cdata.name.toString() : 'ไม่ทราบชื่อ';

      crmSheet.appendRow([
        cdata.timestamp,
        safeName,
        cdata.facebookId,
        cdata.phone || '-',
        cdata.inboxLink
      ]);

      // ทำลิงก์คลิกได้ — ใช้ Business Suite URL
      var lastRow = crmSheet.getLastRow();
      var linkFormula = '=HYPERLINK("' + cdata.inboxLink + '","เปิดแชท")';
      crmSheet.getRange(lastRow, 5).setFormula(linkFormula);

      return ok('บันทึกลูกค้าใหม่เรียบร้อย');
    }

    return ok('ไม่ได้ระบุ Action');

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error', message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function ok(msg) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success', message: msg
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput('✅ กาลเวลา | Google Sheets API is running 100%');
}
