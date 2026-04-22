# ☕ Huan Khuen Facebook Bot

บอทสำหรับเพจ **Huan Khuen Cafe** — ตอบแชทและคอมเม้นอัตโนมัติด้วย AI (Gemini)

---

## ✅ ติดตั้ง

```bash
cd facebook-bot
npm install
```

---

## 🚀 รันเซิร์ฟเวอร์

```bash
npm start
```

---

## 🌐 ขั้นตอน Connect กับ Facebook (ทำครั้งแรก)

### 1. เปิด Port ออก Internet ด้วย ngrok

```bash
# ติดตั้ง ngrok (ถ้ายังไม่มี)
npm install -g ngrok

# เปิด tunnel
ngrok http 3000
```

> คัดลอก URL ที่ได้ เช่น `https://xxxx.ngrok-free.app`

### 2. ตั้งค่า Webhook ใน Meta Developer

1. ไปที่ https://developers.facebook.com → เลือก App
2. เมนู **Messenger → Settings → Webhooks**
3. ใส่ค่า:
   - **Callback URL**: `https://xxxx.ngrok-free.app/webhook`
   - **Verify Token**: `huankhuen_secret_2026`
4. Subscribe: ✅ `messages`, ✅ `messaging_postbacks`, ✅ `feed`
5. กด **Verify and Save**

### 3. Subscribe เพจกับ App

```bash
# รันคำสั่งนี้ครั้งเดียว
curl -X POST "https://graph.facebook.com/v19.0/713991985132270/subscribed_apps?subscribed_fields=messages,feed&access_token=<PAGE_TOKEN>"
```

---

## 📁 โครงสร้างไฟล์

```
facebook-bot/
├── server.js              ← Webhook หลัก
├── .env                   ← Credentials
├── handlers/
│   ├── messageHandler.js  ← จัดการแชท
│   └── commentHandler.js  ← จัดการคอมเม้น
└── services/
    ├── aiService.js        ← Gemini AI
    └── facebookService.js ← Facebook API
```
