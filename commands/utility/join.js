const { SlashCommandBuilder } = require('discord.js');
const { joinChannel } = require('../../voiceService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('เรียกบอทเข้าห้องที่เรากำลังอยู่'),

    async execute(interaction) {
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.reply(
                'มึงต้องเข้าห้องก่อนกูถึงจะตามมึงได้'
            );
        }

        await interaction.deferReply();

        try {
            const connection = await joinChannel(
                channel.guild,
                channel
            );

            // เก็บ connection ไว้เหมือนระบบเดิม
            interaction.client.voiceConnections ??= new Map();

            interaction.client.voiceConnections.set(
                channel.guild.id,
                connection
            );

            await interaction.editReply('มาละ');

            console.log(
                '[JOIN] เข้าห้องสำเร็จ:',
                channel.name
            );
        } catch (error) {
            console.error('[JOIN ERROR]', error);

            await interaction.editReply(
                'เข้าห้อง Voice ไม่สำเร็จ ลองใหม่อีกครั้ง'
            );
        }
    },
};