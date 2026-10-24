const {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const fs = require("node:fs/promises");
const path = require("node:path");

const ALERT_SOUND_PATH = path.join(
  process.cwd(),
  "commands",
  "sounds",
  "xmalert.mp3"
);

// คิวและ player แยกกันตาม Discord server (guild)
const queues = new Map();
const workers = new Map();
const players = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) queues.set(guildId, []);
  return queues.get(guildId);
}

function getPlayer(guildId) {
  if (!players.has(guildId)) {
    const player = createAudioPlayer();
    player.on("error", (error) => {
      console.error(`[XM Alert Audio] Player error (${guildId}):`, error.message);
    });
    players.set(guildId, player);
  }
  return players.get(guildId);
}


function playOne(player, filePath, volume = 1) {
  return new Promise((resolve, reject) => {
    const resource = createAudioResource(filePath, {
      inlineVolume: true,
    });

    resource.volume.setVolume(volume);

    let settled = false;
    let timeout = null;

    const cleanup = () => {
      player.off("stateChange", onStateChange);
      player.off("error", onError);
      if (timeout) clearTimeout(timeout);
    };

    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const onStateChange = (_oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle) finish();
    };

    const onError = (error) => finish(error);

    player.on("stateChange", onStateChange);
    player.once("error", onError);

    timeout = setTimeout(() => {
      finish(new Error(`หมดเวลารอไฟล์เสียง: ${filePath}`));
    }, 60_000);

    timeout.unref?.();

    try {
      // ต้องเล่น resource ที่ตั้ง volume ไว้แล้ว
      player.play(resource);
    } catch (error) {
      finish(error);
    }
  });
}


async function playJob(guildId, job) {
  const { connection, files } = job;
  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

  const player = getPlayer(guildId);
  connection.subscribe(player);

  // เล่นเสียงประกาศก่อนเริ่มอ่านราคา
  try {
    await fs.access(ALERT_SOUND_PATH);
    await playOne(player, ALERT_SOUND_PATH, 0.2);
  } catch (error) {
    console.error(
      "[XM Alert Audio] เล่นเสียงประกาศไม่สำเร็จ:",
      error.message
    );
    // ถ้าเสียงประกาศมีปัญหา ให้ข้ามและลองเล่นเสียงราคา
  }

  for (const filePath of files) {
    try {
      await fs.access(filePath);
      await playOne(player, filePath);
    } catch (error) {
      console.error(
        `[XM Alert Audio] เล่นไฟล์ไม่สำเร็จ (${filePath}):`,
        error.message
      );
      // ถ้าไฟล์หนึ่งมีปัญหา ให้ข้ามไฟล์นั้นและเล่นส่วนที่เหลือต่อ
    }
  }
}

async function processQueue(guildId) {
  if (workers.has(guildId)) return workers.get(guildId);

  const worker = (async () => {
    const queue = getQueue(guildId);
    while (queue.length > 0) {
      const job = queue.shift();
      try {
        await playJob(guildId, job);
      } catch (error) {
        console.error(`[XM Alert Audio] เล่นชุดเสียงไม่สำเร็จ (${guildId}):`, error.message);
      }
    }
  })();

  workers.set(guildId, worker);
  try {
    await worker;
  } finally {
    workers.delete(guildId);
    // ปิด race ที่อาจมีงานเข้าคิวในช่วง worker กำลังจบ
    if (getQueue(guildId).length > 0) processQueue(guildId).catch(() => {});
  }
}

function enqueue(guildId, connection, files) {
  if (!Array.isArray(files) || files.length === 0) return;

  const queue = getQueue(guildId);
  queue.push({ connection, files: [...files] });
  console.log(
    `[XM Alert Audio] เพิ่มชุดเสียงเข้าคิว: guild=${guildId}, files=${files.length}, queued=${queue.length}`
  );
  processQueue(guildId).catch((error) => {
    console.error(`[XM Alert Audio] Queue error (${guildId}):`, error.message);
  });
}

module.exports = { enqueue };
