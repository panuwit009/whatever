const {
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
} = require('@discordjs/voice');

const players = new Map();
const queues = new Map();
const processing = new Set();

function getPlayer(guildId) {
	if (!players.has(guildId)) {
		const player = createAudioPlayer();

		player.on('stateChange', (oldState, newState) => {
			console.log(
				'TTS Player:',
				oldState.status,
				'->',
				newState.status
			);
		});

		player.on('error', error => {
			console.error('TTS PLAYER ERROR:', error);
		});

		players.set(guildId, player);
	}

	return players.get(guildId);
}

function connect(guildId, connection) {
	const player = getPlayer(guildId);

	connection.subscribe(player);

	return player;
}

function addToQueue(guildId, speakFunction) {
	if (!queues.has(guildId)) {
		queues.set(guildId, []);
	}

	queues.get(guildId).push(speakFunction);

	processQueue(guildId);
}

async function processQueue(guildId) {
	if (processing.has(guildId)) {
		return;
	}

	const queue = queues.get(guildId);

	if (!queue || queue.length === 0) {
		return;
	}

	const player = getPlayer(guildId);
	const speakFunction = queue.shift();

	processing.add(guildId);

	try {
		// สร้าง TTS
		const audioPath = await speakFunction();

		console.log('สร้าง TTS แล้ว:', audioPath);

		// เล่นเสียง
		const resource = createAudioResource(audioPath);

		player.play(resource);

		// รอจนเสียงจบ
		await new Promise((resolve, reject) => {
			const onIdle = () => {
				cleanup();
				resolve();
			};

			const onError = error => {
				cleanup();
				reject(error);
			};

			const cleanup = () => {
				player.off(AudioPlayerStatus.Idle, onIdle);
				player.off('error', onError);
			};

			player.on(AudioPlayerStatus.Idle, onIdle);
			player.on('error', onError);
		});

	} catch (error) {
		console.error('TTS QUEUE ERROR:', error);
	}

	processing.delete(guildId);

	processQueue(guildId);
}

module.exports = {
	getPlayer,
	connect,
	addToQueue,
};