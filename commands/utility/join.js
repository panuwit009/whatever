const { SlashCommandBuilder } = require('discord.js');

const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	VoiceConnectionStatus,
} = require('@discordjs/voice');

const path = require('path');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('join')
		.setDescription('เรียกบอทเข้าห้องที่เรากำลังอยู่'),

	async execute(interaction) {
		const channel = interaction.member.voice.channel;

		if (!channel) {
			return interaction.reply('มึงต้องเข้าห้องก่อนกูถึงจะตามมึงได้');
		}

		await interaction.reply('มาละ');

		const connection = joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guild.id,
			adapterCreator: channel.guild.voiceAdapterCreator,
		});

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

				console.log('Voice connection พร้อมแล้ว');

				const audioPath = path.join(
					__dirname,
					'../sounds/join.mp3'
				);

				console.log('ไฟล์:', audioPath);

				const resource = createAudioResource(audioPath);

				player.play(resource);

				console.log('สั่งให้เล่นเสียงแล้ว');
			}
		}, 500);
	},
};