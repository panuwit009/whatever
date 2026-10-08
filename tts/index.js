const { getVoiceConnection } = require('@discordjs/voice');

const provider = require('./provider');
const ttsPlayer = require('./player');

function handleMessage(message, ttsConfig) {
	if (process.env.TTS_ENABLED !== 'true') {
		return;
	}
	// 1. ไม่อ่านข้อความจาก bot
	if (message.author.bot) return;

	// 2. หา config ของ server
	const config = ttsConfig.get(message.guild?.id);

	if (!config) return;

	// 3. ต้องเป็นห้องที่เลือกไว้
	if (message.channel.id !== config.textChannelId) return;

	// 4. หา voice channel ที่ bot อยู่
	const voiceChannel = message.guild.members.me?.voice.channel;

	if (!voiceChannel) {
		console.log('บอทไม่ได้อยู่ในห้อง');
		return;
	}

	// 5. หา voice connection
	const connection = getVoiceConnection(message.guild.id);

	if (!connection) {
		return;
	}

	ttsPlayer.connect(message.guild.id, connection);

	// 6. เช็กว่ามีคนอื่นอยู่ในห้องไหม
	const otherMembers = voiceChannel.members.filter(
		member => !member.user.bot
	);

	if (otherMembers.size === 0) {
		console.log('ไม่มีคนอยู่ในห้อง');
		return;
	}

	console.log('บอทอยู่ห้อง:', voiceChannel.name);
	console.log('มีคนอื่นอยู่:', otherMembers.size);
	console.log('ข้อความที่ต้องอ่าน:', message.content);

	// 7. เพิ่มข้อความเข้า queue
	ttsPlayer.addToQueue(
		message.guild.id,
		() => provider.speak(message.content)
	);
}

module.exports = {
	handleMessage,
};