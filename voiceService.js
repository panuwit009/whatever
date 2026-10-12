const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

async function joinChannel(guild, channel) {
  const oldConnection = getVoiceConnection(guild.id);

  // ถ้าอยู่ห้องนี้อยู่แล้ว ไม่ต้อง join ใหม่
  if (
    oldConnection &&
    oldConnection.joinConfig.channelId === channel.id
  ) {
    await entersState(oldConnection, VoiceConnectionStatus.Ready, 15_000);
    return oldConnection;
  }

  // ย้ายห้องโดยปิด connection เดิมก่อน
  if (oldConnection) {
    oldConnection.destroy();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    return connection;
  } catch (error) {
    connection.destroy();
    throw error;
  }
}

module.exports = { joinChannel };