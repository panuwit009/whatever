const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leave')
		.setDescription('ให้บอทออกจากห้อง'),

	async execute(interaction) {
		const connection = getVoiceConnection(interaction.guild.id);

		if (!connection) {
			return interaction.reply('กูไม่ได้อยู่ในห้องเสียง');
		}

		connection.destroy();

		await interaction.reply('ไปละ');
	},
};