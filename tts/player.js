const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");

const players = new Map();
const queues = new Map();
const processing = new Set();

function getPlayer(guildId) {
  if (!players.has(guildId)) {
    const player = createAudioPlayer();

    player.on("stateChange", (oldState, newState) => {
      console.log(
        "TTS Player:",
        oldState.status,
        "->",
        newState.status
      );
    });

    player.on("error", (error) => {
      console.error("TTS PLAYER ERROR:", error);
    });

    players.set(guildId, player);
  }

  return players.get(guildId);
}

function connect(guildId, connection) {
  const player = getPlayer(guildId);
  connection.subscribe(player);
  return player;
}

function addToQueue(
  guildId,
  speakFunction,
  beforeAudioPath = null
) {
  if (!queues.has(guildId)) {
    queues.set(guildId, []);
  }

  queues.get(guildId).push({
    speakFunction,
    beforeAudioPath,
  });

  processQueue(guildId);
}

// เล่นไฟล์เสียงและกำหนดระดับเสียงแยกกันได้
function playAndWait(player, audioPath, volume = 1.0) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      player.off(AudioPlayerStatus.Idle, onIdle);
      player.off("error", onError);
    };

    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const onIdle = () => finish();
    const onError = (error) => finish(error);

    player.once(AudioPlayerStatus.Idle, onIdle);
    player.once("error", onError);

    try {
      const resource = createAudioResource(audioPath, {
        inlineVolume: true,
      });

      resource.volume.setVolume(volume);
      player.play(resource);
    } catch (error) {
      finish(error);
    }
  });
}

async function processQueue(guildId) {
  if (processing.has(guildId)) return;

  const queue = queues.get(guildId);
  if (!queue || queue.length === 0) return;

  const player = getPlayer(guildId);
  processing.add(guildId);

  try {
    while (queue.length > 0) {
      const task = queue.shift();

      try {
        // 1. สร้าง TTS ให้เสร็จก่อน
        const ttsAudioPath = await task.speakFunction();

        console.log("สร้าง TTS แล้ว:", ttsAudioPath);

        // 2. เล่นเสียงแจ้งเตือนที่ระดับ 20%
        if (task.beforeAudioPath) {
          await playAndWait(
            player,
            task.beforeAudioPath,
            0.2
          );
        }

        // 3. เล่นเสียง TTS ที่ระดับ 100%
        await playAndWait(
          player,
          ttsAudioPath,
          1.0
        );
      } catch (error) {
        console.error("TTS QUEUE ERROR:", error);
      }
    }
  } finally {
    processing.delete(guildId);

    // ตรวจสอบว่ามีงานใหม่ในคิวหรือไม่
    if (queue.length > 0) {
      processQueue(guildId);
    }
  }
}

module.exports = {
  getPlayer,
  connect,
  addToQueue,
};