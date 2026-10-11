const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

const mt5Service = require("./xm/mt5Service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("symbols")
    .setDescription("แสดงรายการสินทรัพย์จาก MT5"),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const symbols = await mt5Service.getSymbols();

      if (!symbols.length) {
        await interaction.editReply(
          "ไม่พบ Symbol ใน MT5"
        );
        return;
      }

      const pageSize = 30;
      const totalPages = Math.ceil(
        symbols.length / pageSize
      );

      const lines = symbols
        .slice(0, pageSize)
        .map((symbol) => {
          const description = symbol.description
            ? ` — ${symbol.description}`
            : "";

          return `\`${symbol.name}\`${description}`;
        });

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("รายการสินทรัพย์จาก MT5")
        .setDescription(lines.join("\n"))
        .setFooter({
          text: `ทั้งหมด ${symbols.length} รายการ • หน้า 1/${totalPages}`,
        });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("[XM Symbols]", error);

      await interaction.editReply(
        `ดึงรายการ Symbol ไม่สำเร็จ\nสาเหตุ: ${error.message}`
      );
    }
  },
};