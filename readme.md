# Discord TTS Bot

Discord Bot สำหรับอ่านข้อความจาก Text Channel ที่กำหนด แล้วแปลงข้อความเป็นเสียงภาษาไทยด้วย **Wayu Paxa TTS Edge** และเล่นเสียงเข้า Discord Voice Channel

## Requirements

ก่อนติดตั้ง ต้องมี:

* Node.js 22.x หรือใหม่กว่า
* Python 3.11
* FFmpeg
* Git
* Discord Bot Token

> แนะนำให้ใช้ Python 3.11 เพราะ environment ปัจจุบันของโปรเจกต์ใช้ Python 3.11

---

## 1. Clone Project

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd whatever
```

---

## 2. ติดตั้ง Node.js Dependencies

ติดตั้ง package ของ Node.js จาก `package.json`:

```bash
npm install
```

ไม่จำเป็นต้องติดตั้ง package ทีละตัว เพราะ `npm install` จะติดตั้ง dependencies ที่ระบุไว้ใน `package.json` ให้อัตโนมัติ

---

## 3. ติดตั้ง Python

ตรวจสอบว่า Python ใช้งานได้:

```bash
python --version
```

ควรได้ประมาณ:

```text
Python 3.11.x
```

ถ้ามี Python หลายเวอร์ชัน ให้ตรวจสอบด้วย:

```bash
py --list
```

---

## 4. สร้าง Python Virtual Environment

สร้าง environment ใหม่ใน project:

```bash
python -m venv wayu-env
```

จากนั้น activate:

```bash
wayu-env\Scripts\activate
```

ถ้าสำเร็จ จะเห็นประมาณ:

```text
(wayu-env) C:\github\whatever>
```

---

## 5. ติดตั้ง Python Dependencies

ติดตั้ง dependencies ที่โปรเจกต์ใช้:

```bash
pip install -r requirements.txt
```

`wayu-env` ไม่ได้ถูกเก็บไว้ใน GitHub เพราะเป็น environment เฉพาะเครื่อง

เครื่องใหม่จึงต้องสร้าง `wayu-env` และติดตั้ง dependencies ใหม่

---

## 6. Wayu TTS

โปรเจกต์ใช้:

**Wayu Paxa TTS Edge**

Python package และ model จะถูกดาวน์โหลด/ติดตั้งผ่าน dependency ของ Wayu

หากจำเป็นต้องติดตั้ง package เพิ่ม:

```bash
pip install git+https://github.com/wayu-ai/wayu-tts-inference.git
```

Model จะถูกดาวน์โหลดเมื่อมีการเรียกใช้งานครั้งแรก

> Wayu Paxa TTS Edge ใช้ license CC-BY-NC-4.0 ซึ่งมีข้อจำกัดด้านการใช้งานเชิงพาณิชย์

---

## 7. ติดตั้ง FFmpeg

โปรเจกต์ใช้ FFmpeg สำหรับการจัดการเสียงของ Discord Voice

ตรวจสอบว่า FFmpeg ติดตั้งแล้ว:

```bash
ffmpeg -version
```

ถ้าคำสั่งไม่พบ ต้องติดตั้ง FFmpeg และเพิ่ม `ffmpeg` เข้า PATH ของระบบ

---

## 8. ตั้งค่า Environment Variables

สร้างไฟล์:

```text
.env
```

ภายใน project

ใส่:

```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
OPENAI_API_KEY=
```

`DISCORD_TOKEN` จำเป็นสำหรับการ login Discord Bot

`OPENAI_API_KEY` ไม่จำเป็นสำหรับระบบ TTS ปัจจุบัน เนื่องจากใช้ Local Wayu TTS แต่เก็บไว้รองรับการใช้งานในอนาคต

**ห้าม commit `.env` ขึ้น GitHub**

ไฟล์ `.gitignore` ควรมี:

```gitignore
node_modules/
wayu-env/
.env
```

---

## 9. ตรวจสอบโครงสร้าง Project

หลังติดตั้งควรมีโครงสร้างประมาณนี้:

```text
whatever/
├── commands/
│   └── ...
├── config/
│   └── tts-config.json
├── tts-player.js
├── tts.js
├── tts_worker.py
├── index.js
├── package.json
├── package-lock.json
├── requirements.txt
├── .env
└── wayu-env/
```

โดย:

* `wayu-env/` ไม่ต้อง commit
* `.env` ไม่ต้อง commit
* `node_modules/` ไม่ต้อง commit

---

## 10. เริ่มต้นใช้งาน

เปิด Python virtual environment:

```bash
wayu-env\Scripts\activate
```

จากนั้นรัน Bot:

```bash
node index.js
```

ถ้า login สำเร็จจะเห็นข้อความประมาณ:

```text
พร้อม! ตอนนี้ login แล้วด้วยชื่อ ...
```

---

## การใช้งาน

### 1. เลือก Text Channel

ใช้คำสั่ง:

```text
/selectroomtoautoread
```

แล้วเลือก Text Channel ที่ต้องการให้ Bot อ่าน

การตั้งค่าจะถูกบันทึกไว้ใน:

```text
config/tts-config.json
```

ดังนั้นการ restart bot จะไม่ทำให้ Text Channel ที่เลือกหาย

### 2. ให้ Bot เข้าห้อง Voice

ใช้:

```text
/join
```

Bot จะเข้าห้อง Voice ที่ผู้ใช้กำลังอยู่

### 3. ส่งข้อความ

เมื่อมีข้อความใหม่ใน Text Channel ที่เลือก:

* Bot ต้องอยู่ใน Voice Channel
* ต้องมีผู้ใช้อื่นอยู่ใน Voice Channel
* Bot จะสร้างเสียงจากข้อความ
* เสียงจะถูกนำไปต่อคิว
* Bot จะอ่านข้อความทีละข้อความ

---

## เมื่อต้องย้ายไปเครื่องใหม่

ทำตามลำดับนี้:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd whatever

npm install

python -m venv wayu-env
wayu-env\Scripts\activate

pip install -r requirements.txt
```

จากนั้น:

1. ติดตั้ง FFmpeg
2. สร้าง `.env`
3. ใส่ `DISCORD_TOKEN`
4. ตรวจสอบ `tts-config.json`
5. รัน:

```bash
node index.js
```

---

## Development Notes

### Node.js

Node.js dependencies ถูกจัดการโดย:

```text
package.json
package-lock.json
```

ติดตั้งด้วย:

```bash
npm install
```

### Python

Python dependencies ถูกจัดการโดย:

```text
requirements.txt
```

ติดตั้งด้วย:

```bash
pip install -r requirements.txt
```

Virtual environment:

```text
wayu-env/
```

ไม่ถูก commit เข้า GitHub

### TTS Architecture

```text
Discord Message
       ↓
MessageCreate
       ↓
ตรวจ Text Channel
       ↓
ตรวจ Voice Channel
       ↓
TTS Queue
       ↓
Wayu TTS
       ↓
worker-test.wav
       ↓
Discord Audio Player
       ↓
Voice Channel
```
