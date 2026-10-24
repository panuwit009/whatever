
const {
  EmbedBuilder,
} = require("discord.js");

const {
  getVoiceConnection,
} = require("@discordjs/voice");

const fs = require("node:fs/promises");
const path = require("node:path");

const mt5Service = require("./mt5Service");
const alertAudioQueue = require("./alertAudioQueue");
const { buildAlertAudio } = require("./alertAudioBuilder");
const { joinChannel } = require("../../../voiceService");

const CONFIG_PATH = path.join(__dirname, "alert-config.json");
const POLL_INTERVAL = 5000;

let client = null;
let timer = null;
let polling = false;
let config = {
  guilds: {},
};

const previousPrices = new Map();

async function saveConfig() {
  const tempPath = `${CONFIG_PATH}.tmp`;

  await fs.writeFile(
    tempPath,
    JSON.stringify(config, null, 2),
    "utf8"
  );

  await fs.rename(tempPath, CONFIG_PATH);
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);

    config = {
      guilds:
        parsed && typeof parsed.guilds === "object"
          ? parsed.guilds
          : {},
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await saveConfig();
  }
}

function getGuildConfig(guildId) {
  if (!config.guilds[guildId]) {
    config.guilds[guildId] = {
      channelId: null,
      alerts: [],
    };
  }

  return config.guilds[guildId];
}

function normalizeDirection(direction) {
  if (direction === "above" || direction === "below") {
    return direction;
  }

  throw new Error("เงื่อนไขราคาที่ระบุไม่ถูกต้อง");
}

async function setRoom(guildId, channelId) {
  const guildConfig = getGuildConfig(guildId);
  guildConfig.channelId = channelId;

  await saveConfig();
}

function getRoom(guildId) {
  return getGuildConfig(guildId).channelId;
}

async function addAlert(guildId, symbol, direction, target) {
  const guildConfig = getGuildConfig(guildId);

  const normalizedSymbol = symbol.trim();

  if (!normalizedSymbol) {
    throw new Error("กรุณาระบุ Symbol");
  }

  if (!Number.isFinite(target) || target <= 0) {
    throw new Error("ราคาเป้าหมายต้องเป็นตัวเลขมากกว่า 0");
  }

  direction = normalizeDirection(direction);

  const alert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    symbol: normalizedSymbol,
    direction,
    target,
    createdAt: new Date().toISOString(),
  };

  guildConfig.alerts.push(alert);
  await saveConfig();

  return alert;
}

function listAlerts(guildId) {
  return [...getGuildConfig(guildId).alerts];
}

async function removeAlert(guildId, alertId) {
  const guildConfig = getGuildConfig(guildId);
  const before = guildConfig.alerts.length;

  guildConfig.alerts = guildConfig.alerts.filter(
    (alert) => alert.id !== alertId
  );

  if (guildConfig.alerts.length === before) {
    return false;
  }

  previousPrices.delete(`${guildId}:${alertId}`);
  await saveConfig();

  return true;
}


async function removeAllAlerts(guildId) {
  const guildConfig = config.guilds[guildId];

  if (!guildConfig) {
    return 0;
  }

  const removedCount = guildConfig.alerts?.length ?? 0;

  guildConfig.alerts = [];

  // ล้างราคาก่อนหน้าของ Alert ในเซิร์ฟเวอร์นี้ด้วย
  for (const key of previousPrices.keys()) {
    if (key.startsWith(`${guildId}:`)) {
      previousPrices.delete(key);
    }
  }

  await saveConfig();

  console.log(
    `[XM Alert] ลบ Alert ทั้งหมด ${removedCount} รายการ จากเซิร์ฟเวอร์ ${guildId}`
  );

  return removedCount;
}


function getTraderVoiceMember(guild) {
  const traderRoleId = process.env.TRADER_ROLE_ID;

  if (!guild || !traderRoleId) {
    if (!traderRoleId) {
      console.error("[XM Alert] ไม่พบ TRADER_ROLE_ID ใน .env");
    }
    return null;
  }

  const voiceChannel = guild.members.me?.voice.channel;

  if (!voiceChannel) {
    return null;
  }

  for (const [, member] of guild.members.cache) {
    if (
      member.voice.channelId === voiceChannel.id &&
      !member.user.bot &&
      member.roles.cache.has(traderRoleId)
    ) {
      return member;
    }
  }

  return null;
}

async function speakAlert(guild, alert, directionText, targetText, actualText) {
  // Keep the existing environment switch for backward compatibility.
  if (process.env.TTS_ENABLED !== "true") return;

  try {
    // ลองหา trader ในห้องที่บอทอยู่ก่อน
    let trader = getTraderVoiceMember(guild);

    // ถ้าไม่เจอ ให้ค้นหาห้องอื่นที่มี trader และมีคนอยู่
    if (!trader) {
      const targetChannel = guild.channels.cache.find(
        (channel) =>
          channel.isVoiceBased() &&
          channel.members.size > 0 &&
          channel.members.some(
            (member) =>
              !member.user.bot &&
              member.roles.cache.some(
                (role) => role.name === "trader"
              )
          )
      );

      if (!targetChannel) {
        console.log(
          "[XM Alert Audio] ไม่พบห้อง Voice ที่มีสมาชิก Role trader"
        );
        return;
      }

      console.log(
        `[XM Alert Audio] กำลังเข้าห้อง ${targetChannel.name}`
      );

      await joinChannel(guild, targetChannel);
    }

    const connection = getVoiceConnection(guild.id);

    if (!connection) {
      console.log("[XM Alert Audio] ไม่พบ Voice connection");
      return;
    }

    const files = await buildAlertAudio({
      symbol: alert.symbol,
      directionText,
      targetText,
      actualText,
    });

    if (!files.length) {
      console.warn("[XM Alert Audio] ไม่มีไฟล์เสียงสำหรับ Alert นี้");
      return;
    }

    // ใช้คิวเสียง Alert แยกจาก TTS queue โดยสิ้นเชิง
    alertAudioQueue.enqueue(guild.id, connection, files);
  } catch (error) {
    console.error("[XM Alert Audio]", error);
  }
}

async function notify(guild, alert, quote) {
  const guildConfig = getGuildConfig(guild.id);

  if (!guildConfig.channelId) {
    console.warn(
      `[XM Alert] ยังไม่ได้เลือกห้องแจ้งเตือนของ ${guild.name}`
    );
    return;
  }

  const channel = await guild.channels
    .fetch(guildConfig.channelId)
    .catch(() => null);

  if (!channel || !channel.isTextBased() || !channel.send) {
    console.error(
      `[XM Alert] ห้องแจ้งเตือนใช้ไม่ได้: ${guildConfig.channelId}`
    );
    return;
  }

  const isAbove = alert.direction === "above";
  const color = isAbove ? 0x20A464 : 0xE05252;
  const directionText = isAbove ? "มากกว่า" : "ต่ำกว่า";
  const actualPrice = Number(quote.bid);
  const targetText = Number(alert.target).toFixed(quote.digits);
  const actualText = actualPrice.toFixed(quote.digits);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(
      `${isAbove ? "📈" : "📉"} Price Alert • ${alert.symbol}`
    )
    .setDescription(
      `ราคาของ **${alert.symbol}** ${directionText} **${targetText}** แล้ว`
    )
    .addFields(
      {
        name: "ราคา Bid ปัจจุบัน",
        value: `**${actualText}**`,
        inline: true,
      },
      {
        name: "ราคาเป้าหมาย",
        value: `**${targetText}**`,
        inline: true,
      },
      {
        name: "เงื่อนไข",
        value: isAbove
          ? "🟢 ราคาสูงกว่าระดับที่กำหนด"
          : "🔴 ราคาต่ำกว่าระดับที่กำหนด",
        inline: false,
      }
    )
    .setFooter({
      text: "XM MT5 • Price Alert",
    })
    .setTimestamp();

  try {
    await channel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });

    await speakAlert(
      guild,
      alert,
      directionText,
      targetText,
      actualText
    );
  } catch (error) {
    console.error("[XM Alert] ส่งแจ้งเตือนไม่สำเร็จ:", error);
  }
}

async function checkAlerts() {
  if (polling || !client) {
    return;
  }

  polling = true;

  try {
    for (const [guildId, guildConfig] of Object.entries(config.guilds)) {
      const guild = client.guilds.cache.get(guildId);

      if (!guild || !guildConfig.alerts?.length) {
        continue;
      }

      for (const alert of [...guildConfig.alerts]) {
        const key = `${guildId}:${alert.id}`;

        try {
          const quote = await mt5Service.getPrice(alert.symbol);
          const currentPrice = Number(quote.bid);

          if (!Number.isFinite(currentPrice)) {
            continue;
          }

          const previousPrice = previousPrices.get(key);

          // รอบแรกใช้เป็นราคาตั้งต้น ป้องกันการแจ้งเตือนทันที
          // เพียงเพราะราคาอยู่เหนือ/ต่ำกว่าเป้าหมายอยู่ก่อนแล้ว
          if (previousPrice === undefined) {
            previousPrices.set(key, currentPrice);

            const alreadyTriggered =
              (alert.direction === "above" && currentPrice > alert.target) ||
              (alert.direction === "below" && currentPrice < alert.target);

            if (alreadyTriggered) {
              await notify(guild, alert, quote);

              await removeAlert(guildId, alert.id);
              previousPrices.delete(key);
            }

            continue;
          }

          const crossedAbove =
            previousPrice <= alert.target &&
            currentPrice > alert.target;

          const crossedBelow =
            previousPrice >= alert.target &&
            currentPrice < alert.target;

          previousPrices.set(key, currentPrice);

          if (
            (alert.direction === "above" && crossedAbove) ||
            (alert.direction === "below" && crossedBelow)
          ) {
            await notify(guild, alert, quote);

            await removeAlert(guildId, alert.id);
            previousPrices.delete(key);
          }
        } catch (error) {
          console.error(
            `[XM Alert] ตรวจ ${alert.symbol} ไม่สำเร็จ:`,
            error.message
          );
        }
      }
    }
  } finally {
    polling = false;
  }
}

async function start(discordClient) {
  client = discordClient;

  await loadConfig();

  if (timer) {
    return;
  }

  console.log("[XM Alert] เริ่มระบบตรวจราคา");

  // เรียกทันทีหนึ่งรอบ แล้วตรวจต่อเนื่องตามช่วงเวลา
  await checkAlerts();

  timer = setInterval(() => {
    checkAlerts().catch((error) => {
      console.error("[XM Alert] รอบตรวจราคาล้มเหลว:", error);
    });
  }, POLL_INTERVAL);
}

module.exports = {
  start,
  setRoom,
  getRoom,
  addAlert,
  listAlerts,
  removeAlert,
  removeAllAlerts
};
