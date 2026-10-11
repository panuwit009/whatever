
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const path = require("node:path");
const fs = require("node:fs/promises");

const rootPath = process.cwd();

const pythonPath = path.join(
  rootPath,
  "wayu-env",
  "Scripts",
  "python.exe"
);

const bridgePath = path.join(
  rootPath,
  "commands",
  "utility",
  "xm",
  "mt5_bridge.py"
);

let child = null;
let started = false;
let ready = false;
let readyPromise = null;
let resolveReady = null;
let rejectReady = null;
let nextId = 1;

const pending = new Map();

function rejectPending(error) {
  for (const [id, request] of pending) {
    clearTimeout(request.timer);
    request.reject(error);
    pending.delete(id);
  }
}

function start() {
  if (child && started) {
    return readyPromise;
  }

  started = true;
  ready = false;

  readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  // ป้องกัน unhandled rejection ตอนยังไม่มีใครเรียก getPrice()
  readyPromise.catch(() => {});

  console.log("[MT5] กำลังเปิดและเชื่อมต่อ MT5...");

  const process = spawn(
    pythonPath,
    [bridgePath],
    {
      cwd: rootPath,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  child = process;

  const stdout = readline.createInterface({
    input: process.stdout,
  });

  stdout.on("line", (line) => {
    let message;

    try {
      message = JSON.parse(line);
    } catch {
      console.log("[MT5] ข้อความจาก Python:", line);
      return;
    }

    if (message.type === "ready") {
      ready = true;
      console.log("[MT5] เชื่อมต่อสำเร็จ พร้อมดึงราคา");
      resolveReady();
      return;
    }

    if (message.type === "startup_error") {
      const error = new Error(message.error);
      console.error("[MT5] เชื่อมต่อไม่สำเร็จ:", error.message);
      rejectReady(error);
      return;
    }

    if (message.id !== undefined) {
      const request = pending.get(message.id);

      if (!request) return;

      clearTimeout(request.timer);
      pending.delete(message.id);

      if (message.ok) {
        request.resolve(message.data);
      } else {
        request.reject(new Error(message.error));
      }
    }
  });

  process.stderr.on("data", (data) => {
    console.error("[MT5 Python]", data.toString().trim());
  });

  process.on("error", (error) => {
    if (child !== process) return;

    console.error("[MT5] เปิด Python ไม่สำเร็จ:", error.message);

    if (!ready) rejectReady(error);

    rejectPending(error);
    child = null;
    started = false;
    ready = false;
  });

  process.on("close", (code) => {
    if (child !== process) return;

    const error = new Error(
      `MT5 Python process หยุดทำงาน (code ${code})`
    );

    if (!ready) rejectReady(error);

    rejectPending(error);

    child = null;
    started = false;
    ready = false;

    console.error("[MT5]", error.message);
  });

  return readyPromise;
}

async function getPrice(symbol = "GOLD") {
  // เริ่ม process ใหม่ได้ ถ้า process เก่าหยุดทำงานไปแล้ว
  await start();

  if (!child || !ready) {
    throw new Error("MT5 ยังไม่พร้อมใช้งาน");
  }

  const currentChild = child;
  const id = nextId++;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("MT5 ใช้เวลาตอบกลับนานเกิน 2 นาที"));
    }, 120000);

    pending.set(id, {
      resolve,
      reject,
      timer,
    });

    currentChild.stdin.write(
      JSON.stringify({
        id,
        action: "price",
        symbol,
      }) + "\n",
      (error) => {
        if (!error) return;

        const request = pending.get(id);
        if (!request) return;

        clearTimeout(request.timer);
        pending.delete(id);
        request.reject(
          new Error(
            `ส่งคำขอไปยัง MT5 ไม่สำเร็จ: ${error.message}`
          )
        );
      }
    );
  });
}

async function getSymbols() {
  await start();

  if (!child || !ready) {
    throw new Error("MT5 ยังไม่พร้อมใช้งาน");
  }

  const id = nextId++;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("MT5 ใช้เวลาดึงรายการ Symbol นานเกิน 2 นาที"));
    }, 120000);

    pending.set(id, {
      resolve,
      reject,
      timer,
    });

    child.stdin.write(
      JSON.stringify({
        id,
        action: "symbols",
      }) + "\n",
      (error) => {
        if (!error) return;

        const request = pending.get(id);
        if (!request) return;

        clearTimeout(request.timer);
        pending.delete(id);
        reject(error);
      }
    );
  });
}

function isReady() {
  return ready && child !== null;
}

const selectedSymbolsPath = path.join(
  __dirname,
  "selected-symbols.json"
);

async function getSelectedSymbols() {
  const content = await fs.readFile(
    selectedSymbolsPath,
    "utf8"
  );

  const data = JSON.parse(content);

  return Array.isArray(data.symbols)
    ? data.symbols
    : [];
}

async function saveSelectedSymbols(symbols) {
  const uniqueSymbols = [...new Set(symbols)];

  await fs.writeFile(
    selectedSymbolsPath,
    JSON.stringify(
      { symbols: uniqueSymbols },
      null,
      2
    ),
    "utf8"
  );
}

module.exports = {
  start,
  getPrice,
  getSymbols,
  getSelectedSymbols,
  saveSelectedSymbols,
  isReady,
};
