const providerName = process.env.TTS_PROVIDER || "wayu";

// ปิด TTS แล้วไม่ต้องโหลด provider ใด ๆ
if (process.env.TTS_ENABLED !== "true") {
//console.log("[TTS] ระบบ TTS ปิดใช้งาน ไม่โหลด Provider จากไฟล์ tts/provider.js");

  module.exports = null;
} else {
  const providers = {
    wayu: () => require("./providers/wayu"),
  };

  const loadProvider = providers[providerName];

  if (!loadProvider) {
    throw new Error(`ไม่พบ TTS provider: ${providerName}`);
  }

  const provider = loadProvider();

  console.log("TTS Provider:", providerName);

  module.exports = provider;
}
