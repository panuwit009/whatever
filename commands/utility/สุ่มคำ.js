const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

const wordData = require('./word_thai.json');

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomWords(mode) {
    const categories = Object.entries(wordData.categories)
        .filter(([, category]) => category.words.length >= 2);

    if (categories.length === 0) {
        throw new Error('ไม่มีหมวดหมู่ที่มีคำอย่างน้อย 2 คำ');
    }

    let category1;
    let category2;
    let word1;
    let word2;

    if (mode === 'related') {
        // เลือกหมวดเดียวกัน แล้วสุ่มคำ 2 คำที่ไม่ซ้ำกัน
        const [categoryKey, category] = randomItem(categories);

        category1 = {
            key: categoryKey,
            label: category.label
        };

        category2 = category1;

        word1 = randomItem(category.words);

        const remainingWords = category.words.filter(
            word => word !== word1
        );

        word2 = randomItem(remainingWords);
    } else {
        // สุ่มคำจากคนละหมวดหมู่
        const shuffledCategories = [...categories]
            .sort(() => Math.random() - 0.5);

        const [key1, cat1] = shuffledCategories[0];
        const [key2, cat2] = shuffledCategories[1];

        category1 = { key: key1, label: cat1.label };
        category2 = { key: key2, label: cat2.label };

        word1 = randomItem(cat1.words);
        word2 = randomItem(cat2.words);
    }

    return {
        word1,
        word2,
        category1,
        category2
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('สุ่มคำ')
        .setDescription('สุ่มคำ 2 คำ พร้อมหมวดหมู่')
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('เลือกโหมดสุ่มคำ')
                .setRequired(true)
                .addChoices(
                    { name: 'คำมั่ว', value: 'random' },
                    { name: 'คำใกล้เคียง', value: 'related' }
                )
        ),

    async execute(interaction) {
        const mode = interaction.options.getString('mode');

        try {
            const result = getRandomWords(mode);

            const embed = new EmbedBuilder()
                .setColor(mode === 'related' ? 0x57F287 : 0x5865F2)
                .setTitle('🎲 ผลการสุ่มคำ')
                .addFields(
                    {
                        name: '📝 คำที่ 1',
                        value:
                            `**${result.word1}**\n` +
                            `หมวดหมู่: ${result.category1.label}`,
                        inline: true
                    },
                    {
                        name: '📝 คำที่ 2',
                        value:
                            `**${result.word2}**\n` +
                            `หมวดหมู่: ${result.category2.label}`,
                        inline: true
                    }
                )
                .setFooter({
                    text: mode === 'related'
                        ? 'โหมดคำใกล้เคียง • หมวดหมู่เดียวกัน'
                        : 'โหมดคำมั่ว • สุ่มจากคนละหมวดหมู่'
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Random word error:', error);

            await interaction.reply({
                content: 'เกิดข้อผิดพลาดระหว่างสุ่มคำ',
                ephemeral: true
            });
        }
    }
};