const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	AttachmentBuilder,
} = require('discord.js');

const path = require('node:path');
const games = require('./game/games-list');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('game')
		.setDescription('เลือกเกมที่จะเล่น'),

	async execute(interaction) {
		const randomGame = games[Math.floor(Math.random() * games.length)];

		const imagePath = path.join(
			__dirname,
			'./game/img',
			randomGame.image
		);

		const image = new AttachmentBuilder(imagePath)
			.setName(randomGame.image);

		const embed = new EmbedBuilder()
			.setTitle('🎮 Board Games')
			.setDescription('เลือกเกมที่ต้องการเล่นจากเมนูด้านล่าง')
			.addFields({
				name: '👥 จำนวนผู้เล่น',
				value: randomGame.players,
			})
			.setImage(`attachment://${randomGame.image}`);

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('game_select')
			.setPlaceholder('เลือกเกม')
			.addOptions(
				games.map(game => ({
					label: game.name,
					description: game.description.slice(0, 100),
					value: game.id,
				}))
			);

		const row = new ActionRowBuilder()
			.addComponents(selectMenu);

		await interaction.reply({
			embeds: [embed],
			components: [row],
			files: [image],
		});
	},
};