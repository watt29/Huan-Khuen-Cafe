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
      var orderSheet = ss.getSheetByName('Order Logs') || ss.getActiveSheet();

      if (orderSheet.getLastRow() === 0) {
        orderSheet.appendRow([
          'วัน-เวลา', 'ชื่อลูกค้า', 'รายการออร์เดอร์ + Note',
          'ยอดรวม (฿)', 'ช่องทางชำระ',
          'ที่อยู่จัดส่ง', 'เบอร์โทร', 'ช่องทางส่ง', 'สถานะ'
        ]);
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
      var crmSheet = ss.getSheetByName('CRM') || ss.insertSheet('CRM');

      if (crmSheet.getLastRow() === 0) {
        crmSheet.appendRow([
          'First Interaction', 'Name', 'Facebook ID', 'Phone', 'เปิดแชท (Inbox)'
        ]);
        crmSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#cfe2ff');
      }

      // ไม่บันทึกซ้ำถ้า Facebook ID เดิมมีอยู่แล้ว
      var ids = crmSheet.getRange(2, 3, Math.max(crmSheet.getLastRow() - 1, 1), 1).getValues().flat();
      if (ids.includes(String(cdata.facebookId))) return ok('ลูกค้าเดิม ข้ามการบันทึก');

      crmSheet.appendRow([
        cdata.timestamp,
        cdata.name,
        cdata.facebookId,
        cdata.phone || '-',
        cdata.inboxLink   // ลิงก์เปิดแชทใน Messenger โดยตรง
      ]);

      // ทำ inboxLink เป็น Hyperlink คลิกได้
      var lastRow = crmSheet.getLastRow();
      var linkFormula = `=HYPERLINK("${cdata.inboxLink}","เปิดแชท")`;
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
