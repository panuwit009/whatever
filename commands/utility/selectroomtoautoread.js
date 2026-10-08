const { SlashCommandBuilder, ChannelType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const configPath = path.join(
	__dirname,
	'../../config/tts-config.json'
);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('selectroomtoautoread')
		.setDescription('เลือกห้องสำหรับให้อ่านข้อความ')
		.addChannelOption(option =>
			option
				.setName('text_channel')
				.setDescription('เลือกห้องข้อความ')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
		),

	async execute(interaction) {
		const textChannel = interaction.options.getChannel('text_channel');

		const config = JSON.parse(
			fs.readFileSync(configPath, 'utf8')
		);

		config[interaction.guild.id] = {
			textChannelId: textChannel.id,
		};

		fs.writeFileSync(
			configPath,
			JSON.stringify(config, null, 2)
		);

		interaction.client.ttsConfig.set(
			interaction.guild.id,
			config[interaction.guild.id]
		);

		await interaction.reply(
			`ตั้งค่าแล้ว\nอ่านข้อความจาก ${textChannel}`
		);
	},
};