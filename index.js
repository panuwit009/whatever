const fs = require('node:fs');
const path = require('node:path');
// Require the necessary discord.js classes
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
// const { token } = require('./config.json');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const { getVoiceConnection } = require('@discordjs/voice');
const tts = require('./tts');
const ttsPlayer = require('./tts-player');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
	console.log(`พร้อม! ตอนนนี้ login แล้วด้วยชื่อ ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);

client.commands = new Collection(); 

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);
for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		} else {
			await interaction.reply({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		}
	}
});

client.ttsConfig = new Collection();

const configPath = path.join(
	__dirname,
	'config/tts-config.json'
);

const savedConfig = JSON.parse(
	fs.readFileSync(configPath, 'utf8')
);

for (const [guildId, config] of Object.entries(savedConfig)) {
	client.ttsConfig.set(guildId, config);
}

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return;

	const config = client.ttsConfig.get(message.guild?.id);

	if (!config) return;

	if (message.channel.id !== config.textChannelId) return;

	const voiceChannel = message.guild.members.me?.voice.channel;

	if (!voiceChannel) {
		console.log('บอทไม่ได้อยู่ในห้อง');
		return;
	}

	const connection = getVoiceConnection(message.guild.id);

	if (!connection) {
		return;
	}

	ttsPlayer.connect(message.guild.id, connection);

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

	const audioPath = await tts.speak(message.content);

	console.log('สร้าง TTS แล้ว:', audioPath);

	ttsPlayer.addToQueue(
		message.guild.id,
		() => tts.speak(message.content)
	);
});