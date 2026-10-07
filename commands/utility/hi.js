const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hi')
		.setDescription('อย่าใช้คำสั่งนี้เลยถือว่าเตือนแล้ว'),
	async execute(interaction) {
		await interaction.reply('ควยไร เรียกหาพ่อมึงหรอ');
	},
};
