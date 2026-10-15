
const {
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const fs = require("node:fs");
const path = require("node:path");

const AUDIO_DIR = path.join(process.cwd(), "audio");
const sessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("playfile")
    .setDescription("เล่นไฟล์เสียงจากเครื่อง")
    .addStringOption(option =>
      option
        .setName("name")
        .setDescription("ชื่อไฟล์ ไม่ต้องใส่นามสกุล")
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.member.voice?.channel;

    if (!channel) {
      return interaction.reply({
        content: "มึงต้องเข้าห้องเสียงก่อน",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      const name = interaction.options
        .getString("name", true)
        .trim();

      if (!fs.existsSync(AUDIO_DIR)) {
        fs.mkdirSync(AUDIO_DIR, { recursive: true });
      }

      // หาไฟล์ที่ชื่อเหมือนกัน โดยไม่สนใจนามสกุล
      const files = fs.readdirSync(AUDIO_DIR, {
        withFileTypes: true,
      });

      const matches = files.filter(file => {
        if (!file.isFile()) return false;

        const ext = path.extname(file.name).toLowerCase();

        if (![".mp3", ".wav", ".ogg", ".flac", ".m4a"].includes(ext)) {
          return false;
        }

        return path.parse(file.name).name.toLowerCase()
          === name.toLowerCase();
      });

      if (matches.length === 0) {
        return interaction.editReply(
          `ไม่พบไฟล์ "${name}" ในโฟลเดอร์ audio`
        );
      }

      if (matches.length > 1) {
        return interaction.editReply(
          `พบไฟล์ชื่อ "${name}" หลายไฟล์ กรุณาให้เหลือชื่อที่ไม่ซ้ำกัน`
        );
      }

      const filePath = path.join(AUDIO_DIR, matches[0].name);

      const permissions = channel.permissionsFor(
        interaction.client.user
      );

      if (
        !permissions?.has("Connect") ||
        !permissions?.has("Speak")
      ) {
        return interaction.editReply(
          "บอทต้องมีสิทธิ์ Connect และ Speak ในห้องเสียง"
        );
      }

      let session = sessions.get(interaction.guildId);

      if (
        session &&
        session.channelId !== channel.id
      ) {
        session.connection.destroy();
        sessions.delete(interaction.guildId);
        session = null;
      }

      if (!session) {
        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: true,
        });

        const player = createAudioPlayer();

        connection.subscribe(player);

        session = {
          connection,
          player,
          channelId: channel.id,
        };

        sessions.set(interaction.guildId, session);

        connection.on(
          VoiceConnectionStatus.Disconnected,
          () => {
            if (sessions.get(interaction.guildId) === session) {
              sessions.delete(interaction.guildId);
              connection.destroy();
            }
          }
        );
      }

      await entersState(
        session.connection,
        VoiceConnectionStatus.Ready,
        20_000
      );

      const resource = createAudioResource(filePath);

      session.player.play(resource);

      await interaction.editReply(
        `กำลังเล่น **${matches[0].name}** ในห้อง **${channel.name}**`
      );

    } catch (error) {
      console.error("[playfile]", error);

      await interaction.editReply(
        `เล่นไฟล์ไม่สำเร็จ: ${error.message}`
      ).catch(() => {});
    }
  },
};
