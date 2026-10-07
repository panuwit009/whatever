const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('server').setDescription('บอกข้อมูลเซิฟ'),
	async execute(interaction) {
		// interaction.guild is the object representing the Guild in which the command was run
		await interaction.reply(
			`ชื่อเซิฟ: ${interaction.guild.name} มีสมาชิกทั้งหมด ${interaction.guild.memberCount} คน`,
		);
	},
};