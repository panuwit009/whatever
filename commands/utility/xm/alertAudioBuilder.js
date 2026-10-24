const fs = require("node:fs/promises");
const path = require("node:path");

const TTS_DIR = path.join(__dirname, "tts");
const WORDS_DIR = path.join(TTS_DIR, "words");
const NUMBERS_DIR = path.join(TTS_DIR, "numbers");
const LETTERS_DIR = path.join(TTS_DIR, "letters");
// const SYMBOLS_DIR = path.join(TTS_DIR, "symbols");
const SYMBOL_MAP_PATH = path.join(TTS_DIR, "symbol-map.json");

const wordFile = (name) => path.join(WORDS_DIR, `${name}.wav`);
const numberFile = (name) => path.join(NUMBERS_DIR, `${name}.wav`);
const letterFile = (name) => path.join(LETTERS_DIR, `${name}.wav`);

let symbolMapCache = null;
let symbolMapMtime = 0;

async function getSymbolMap() {
  try {
    const stat = await fs.stat(SYMBOL_MAP_PATH);
    if (symbolMapCache && stat.mtimeMs === symbolMapMtime) return symbolMapCache;

    const parsed = JSON.parse(await fs.readFile(SYMBOL_MAP_PATH, "utf8"));
    symbolMapCache = parsed && typeof parsed === "object" ? parsed : {};
    symbolMapMtime = stat.mtimeMs;
    return symbolMapCache;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function appendBelowMillion(value, files) {
  if (value === 0) return;
  if (value >= 1_000_000) throw new Error("appendBelowMillion รับค่าได้ต่ำกว่าหนึ่งล้านเท่านั้น");

  let remainder = value;
  const places = [
    [100_000, "แสน"],
    [10_000, "หมื่น"],
    [1_000, "พัน"],
    [100, "ร้อย"],
  ];

  for (const [placeValue, placeName] of places) {
    const digit = Math.floor(remainder / placeValue);
    if (digit > 0) {
      files.push(numberFile(digit));
      files.push(numberFile(placeName));
      remainder %= placeValue;
    }
  }

  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;

  if (tens === 1) {
    files.push(numberFile("10")); // ไฟล์นี้ออกเสียงว่า “สิบ”
  } else if (tens === 2) {
    files.push(numberFile("ยี่"));
    files.push(numberFile("10"));
  } else if (tens > 2) {
    files.push(numberFile(tens));
    files.push(numberFile("10"));
  }

  if (ones > 0) {
    if (ones === 1 && value > 1) files.push(numberFile("เอ็ด"));
    else files.push(numberFile(ones));
  }
}

function appendInteger(value, files) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`จำนวนเต็มไม่รองรับ: ${value}`);
  }
  if (value === 0) {
    files.push(numberFile("0"));
    return;
  }

  const millions = Math.floor(value / 1_000_000);
  const remainder = value % 1_000_000;

  if (millions > 0) {
    appendInteger(millions, files);
    files.push(numberFile("ล้าน"));
  }
  if (remainder > 0) appendBelowMillion(remainder, files);
}

function appendDecimalNumber(text, files) {
  const normalized = String(text).trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`รูปแบบราคาไม่ถูกต้อง: ${normalized}`);
  }

  const [integerPart, decimalPart] = normalized.split(".");
  appendInteger(Number(integerPart), files);

  if (decimalPart !== undefined) {
    files.push(wordFile("จุด"));
    // หลังจุดทศนิยมอ่านทีละตัว เพื่อคงจำนวนหลักและเลขศูนย์นำหน้า
    for (const digit of decimalPart) files.push(numberFile(digit));
  }
}

async function appendSymbol(symbol, files) {
  const normalized = String(symbol).trim().toUpperCase();
  const map = await getSymbolMap();
  const mapped = map[normalized];

  if (mapped) {
    const mappedPaths = Array.isArray(mapped) ? mapped : [mapped];
    for (const relativePath of mappedPaths) {
      if (typeof relativePath !== "string") continue;
      const resolved = path.resolve(TTS_DIR, relativePath);
      const root = path.resolve(TTS_DIR) + path.sep;
      if (!resolved.startsWith(root)) {
        throw new Error(`symbol-map.json มี path ที่ออกนอกโฟลเดอร์ tts: ${relativePath}`);
      }
      files.push(resolved);
    }
    if (mappedPaths.length > 0) return;
  }

  // fallback: อ่านชื่อ symbol เป็นตัวอักษรภาษาอังกฤษทีละตัว
  for (const char of normalized) {
    if (/^[A-Z]$/.test(char)) {
      files.push(letterFile(char.toLowerCase()));
    } else if (/^\d$/.test(char)) {
      files.push(numberFile(char));
    }
  }
}

async function buildAlertAudio({ symbol, directionText, targetText, actualText }) {
  const files = [wordFile("ราคา")];
  await appendSymbol(symbol, files);
  files.push(wordFile(directionText));
  appendDecimalNumber(targetText, files);
  files.push(wordFile("แล้ว"));
  files.push(wordFile("ราคาปัจจุบันอยู่ที่"));
  appendDecimalNumber(actualText, files);

  // ตรวจไฟล์ทั้งหมดก่อนเข้าคิว เพื่อแจ้งชื่อไฟล์ที่ขาดอย่างชัดเจน
  const uniqueMissing = [];
  for (const filePath of files) {
    try {
      await fs.access(filePath);
    } catch {
      if (!uniqueMissing.includes(filePath)) uniqueMissing.push(filePath);
    }
  }
  if (uniqueMissing.length) {
    throw new Error(`ไม่พบไฟล์เสียงต่อไปนี้:\n${uniqueMissing.join("\n")}`);
  }

  return files;
}

module.exports = { buildAlertAudio };
