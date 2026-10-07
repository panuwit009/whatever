const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('อธิบายข้อมูลผู้ใช้ที่รันคำสั่งนี้'),

	async execute(interaction) {
		const user = interaction.user;
		const member = interaction.member;

		const formatThaiDate = (date) => {
			return new Intl.DateTimeFormat('th-TH', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false,
				timeZone: 'Asia/Bangkok',
			}).format(date);
		};

		const embed = new EmbedBuilder()
			.setColor(0x5865F2)
			.setTitle('ข้อมูลผู้ใช้')
			.setThumbnail(user.displayAvatarURL({ size: 256 }))
			.addFields(
				{
					name: '👤 ผู้ใช้',
					value: `${user}`,
					inline: true,
				},
				{
					name: '🏷️ Username',
					value: `\`${user.username}\``,
					inline: true,
				},
				{
					name: '🆔 User ID',
					value: `\`${user.id}\``,
					inline: false,
				},
				{
					name: '📅 สร้างบัญชีเมื่อ',
					value: formatThaiDate(user.createdAt),
					inline: false,
				},
				{
					name: '📥 เข้าร่วมเซิร์ฟเวอร์เมื่อ',
					value: formatThaiDate(member.joinedAt),
					inline: false,
				},
				{
					name: '🤖 เป็น Bot',
					value: user.bot ? 'ใช่' : 'ไม่ใช่',
					inline: true,
				},
			)
			.setFooter({
				text: `Requested by ${user.username}`,
			})
			.setTimestamp();

		await interaction.reply({
			embeds: [embed],
		});
	},
};
