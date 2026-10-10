
const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('ส่งข้อความส่วนตัวให้ผู้ใช้')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('เลือกผู้รับข้อความ')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('ข้อความที่ต้องการส่ง')
                .setRequired(true)
                .setMaxLength(2000)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const message = interaction.options.getString('message');

        try {
            await user.send(message);

            await interaction.reply({
                content: `ส่ง DM ให้ ${user.tag} เรียบร้อยแล้ว`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            console.error('ส่ง DM ไม่สำเร็จ:', error);

            await interaction.reply({
                content: `ส่ง DM ให้ ${user.tag} ไม่สำเร็จ ผู้รับอาจปิดรับข้อความส่วนตัว`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};