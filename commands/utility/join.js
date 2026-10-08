const { SlashCommandBuilder, Collection } = require('discord.js');

const {
	joinVoiceChannel,
	getVoiceConnection,
	createAudioPlayer,
	createAudioResource,
	VoiceConnectionStatus,
} = require('@discordjs/voice');

const path = require('path');

function playJoinSound(player) {
	const audioPath = path.join(
		__dirname,
		'../sounds/join.mp3'
	);

	const resource = createAudioResource(audioPath);

	player.play(resource);
}

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

		await interaction.reply('มาละ');

		const oldConnection = getVoiceConnection(channel.guild.id);

		if (oldConnection) {
			oldConnection.destroy();
		}

		const connection = joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guild.id,
			adapterCreator: channel.guild.voiceAdapterCreator,
		});

		interaction.client.voiceConnections ??= new Collection();

		interaction.client.voiceConnections.set(
			channel.guild.id,
			connection
		);

		const player = createAudioPlayer();

		player.on('stateChange', (oldState, newState) => {
			console.log(
				'Player:',
				oldState.status,
				'->',
				newState.status
			);
		});

		player.on('error', error => {
			console.error('PLAYER ERROR:', error);
		});

		connection.subscribe(player);

		console.log('Voice status:', connection.state.status);

		const checkConnection = setInterval(() => {
			console.log('Voice status:', connection.state.status);

			if (connection.state.status === VoiceConnectionStatus.Ready) {
				clearInterval(checkConnection);

				// เปิดบรรทัดนี้เมื่อต้องการให้เล่นเสียงตอน join
				// playJoinSound(player);
			}
		}, 500);
	},
};