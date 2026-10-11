
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const mt5Service = require("./xm/mt5Service");

const MAX_SELECTED = 20;
const PAGE_SIZE = 25;
const MENU_TIMEOUT = 5 * 60 * 1000;

// ใช้หมวดหมู่แรกใน symbol.path จาก MT5
function getCategory(symbol) {
  const symbolPath = symbol.path || "";
  return symbolPath.split(/[\\/]/)[0] || "Other";
}

function buildCategoryMenu(categories, currentCategory) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("xm:category")
    .setPlaceholder("เลือกหมวดหมู่สินทรัพย์")
    .addOptions(
      categories.map((category) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(category.slice(0, 100))
          .setValue(category)
          .setDefault(category === currentCategory)
      )
    );

  return new ActionRowBuilder().addComponents(menu);
}

function buildSymbolMenu(symbols, selected, page) {
  const pageSymbols = symbols.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId("xm:symbols")
    .setPlaceholder("ตัวอย่างสินทรัพย์(มีไว้เพื่อทดสอบเฉยๆ)")
    .setMinValues(0)
    .setMaxValues(Math.max(1, Math.min(10, pageSymbols.length)));

  for (const symbol of pageSymbols) {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(symbol.name.slice(0, 100))
      .setValue(symbol.name)
      .setDefault(selected.has(symbol.name));

    if (symbol.description) {
      option.setDescription(symbol.description.slice(0, 100));
    }

    menu.addOptions(option);
  }

  return new ActionRowBuilder().addComponents(menu);
}

function buildPageButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("xm:prev")
      .setLabel("หน้าก่อน")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),

    new ButtonBuilder()
      .setCustomId("xm:next")
      .setLabel("หน้าถัดไป")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

function buildSelectMessage(
  allSymbols,
  categories,
  category,
  selected,
  page
) {
  const filtered = allSymbols.filter(
    (symbol) => getCategory(symbol) === category
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  page = Math.max(0, Math.min(page, totalPages - 1));

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle("เลือกสินทรัพย์จาก MT5")
    .setDescription(
      [
        `หมวดหมู่: **${category}**`,
        `เลือกแล้ว: **${selected.size}/${MAX_SELECTED}**`,
        `หน้า ${page + 1}/${totalPages}`,
        "",
        "เลือกหรือยกเลิกสินทรัพย์ในเมนูได้เลย",
        "ระบบจะบันทึกตัวเลือกให้อัตโนมัติ",
      ].join("\n")
    );

  const components = [
    buildCategoryMenu(categories, category),
  ];

  if (filtered.length > 0) {
    components.push(
      buildSymbolMenu(filtered, selected, page)
    );
  }

  components.push(buildPageButtons(page, totalPages));

  return {
    embeds: [embed],
    components,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xm")
    .setDescription("จัดการสินทรัพย์จาก XM MT5")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("select")
        .setDescription("เลือกสินทรัพย์ที่ต้องการติดตาม")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("price")
        .setDescription("แสดงราคาของสินทรัพย์ที่เลือก")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // -----------------------------
    // /xm select
    // -----------------------------
    if (subcommand === "select") {
      await interaction.deferReply({ ephemeral: true });

      try {
        const allSymbols = await mt5Service.getSymbols();

        if (!allSymbols.length) {
          await interaction.editReply(
            "ไม่พบ Symbol จาก MT5"
          );
          return;
        }

        const validNames = new Set(
          allSymbols.map((symbol) => symbol.name)
        );

        const selected = new Set(
          (await mt5Service.getSelectedSymbols())
            .filter((name) => validNames.has(name))
        );

        // ลบเฉพาะ Symbol ที่ไม่มีอยู่ใน MT5 แล้ว
        await mt5Service.saveSelectedSymbols([...selected]);

        const categories = [
          ...new Set(allSymbols.map(getCategory)),
        ].sort();

        if (categories.length > 25) {
          await interaction.editReply(
            `พบ ${categories.length} หมวดหมู่ ซึ่งเกินขีดจำกัดเมนู Discord 25 ตัวเลือก ต้องแบ่งหมวดหมู่เพิ่มเติม`
          );
          return;
        }

        let category = categories.includes("Forex")
          ? "Forex"
          : categories[0];

        let page = 0;

        const message = await interaction.editReply(
          buildSelectMessage(
            allSymbols,
            categories,
            category,
            selected,
            page
          )
        );

        const collector = message.createMessageComponentCollector({
          time: MENU_TIMEOUT,
          filter: (component) =>
            component.user.id === interaction.user.id,
        });

        collector.on("collect", async (component) => {
          try {
            if (component.customId === "xm:category") {
              category = component.values[0];
              page = 0;

              await component.update(
                buildSelectMessage(
                  allSymbols,
                  categories,
                  category,
                  selected,
                  page
                )
              );
              return;
            }

            if (
              component.customId === "xm:prev" ||
              component.customId === "xm:next"
            ) {
              const filtered = allSymbols.filter(
                (symbol) => getCategory(symbol) === category
              );

              const totalPages = Math.max(
                1,
                Math.ceil(filtered.length / PAGE_SIZE)
              );

              page += component.customId === "xm:next" ? 1 : -1;
              page = Math.max(
                0,
                Math.min(page, totalPages - 1)
              );

              await component.update(
                buildSelectMessage(
                  allSymbols,
                  categories,
                  category,
                  selected,
                  page
                )
              );
              return;
            }

            if (component.customId === "xm:symbols") {
              const filtered = allSymbols.filter(
                (symbol) => getCategory(symbol) === category
              );

              const pageSymbols = filtered.slice(
                page * PAGE_SIZE,
                (page + 1) * PAGE_SIZE
              );

              // เปลี่ยนตัวเลือกเฉพาะหน้าปัจจุบัน
              const candidate = new Set(selected);

              for (const symbol of pageSymbols) {
                candidate.delete(symbol.name);
              }

              for (const name of component.values) {
                candidate.add(name);
              }

              if (candidate.size > MAX_SELECTED) {
                await component.reply({
                  content:
                    `เลือกได้สูงสุด ${MAX_SELECTED} สินทรัพย์ ` +
                    "กรุณายกเลิกบางตัวก่อน",
                  ephemeral: true,
                });
                return;
              }

              // บันทึกก่อนเปลี่ยน state เพื่อไม่ให้ state
              // ในหน่วยความจำกับ JSON ไม่ตรงกันเมื่อเขียนไฟล์ล้มเหลว
              await mt5Service.saveSelectedSymbols([...candidate]);

              selected.clear();
              for (const name of candidate) {
                selected.add(name);
              }

              await component.update(
                buildSelectMessage(
                  allSymbols,
                  categories,
                  category,
                  selected,
                  page
                )
              );
            }
          } catch (error) {
            console.error("[XM Select]", error);

            if (!component.replied && !component.deferred) {
              await component.reply({
                content: `ทำรายการไม่สำเร็จ: ${error.message}`,
                ephemeral: true,
              }).catch(() => {});
            }
          }
        });

        collector.on("end", async () => {
          await interaction.editReply({
            content:
              `ปิดเมนูแล้ว บันทึกสินทรัพย์ไว้ ${selected.size} รายการ`,
            embeds: [],
            components: [],
          }).catch(() => {});
        });
      } catch (error) {
        console.error("[XM Select]", error);

        await interaction.editReply(
          `เปิดเมนูเลือกสินทรัพย์ไม่สำเร็จ: ${error.message}`
        );
      }

      return;
    }

    // -----------------------------
    // /xm price
    // -----------------------------
    if (subcommand === "price") {
      await interaction.deferReply();

      try {
        const selected = await mt5Service.getSelectedSymbols();

        if (!selected.length) {
          await interaction.editReply(
            "ยังไม่ได้เลือกสินทรัพย์ ใช้ `/xm select` เพื่อเลือกก่อน"
          );
          return;
        }

        await interaction.editReply(
          `⏳ กำลังดึงราคาจาก MT5 จำนวน ${selected.length} รายการ...`
        );

        const embed = new EmbedBuilder()
          .setColor(0xD4AF37)
          .setTitle("ราคาสินทรัพย์จาก XM MT5")
          .setDescription(
            `สินทรัพย์ที่เลือกไว้ ${selected.length} รายการ`
          );

        for (const symbol of selected) {
          try {
            const quote = await mt5Service.getPrice(symbol);
            const format = (value) =>
              Number(value).toFixed(quote.digits);

            embed.addFields({
              name: quote.symbol,
              value: [
                `**Bid:** ${format(quote.bid)}`,
                `**Ask:** ${format(quote.ask)}`,
                `**Spread:** ${format(quote.ask - quote.bid)}`,
                `เวลา: ${new Date(quote.time * 1000).toLocaleString(
                  "th-TH",
                  { timeZone: "Asia/Bangkok" }
                )}`,
              ].join("\n"),
              inline: true,
            });
          } catch (error) {
            embed.addFields({
              name: symbol,
              value: `ดึงราคาไม่สำเร็จ: ${error.message}`.slice(0, 1000),
              inline: true,
            });
          }
        }

        embed
          .setFooter({
            text: "XM MT5 • ราคาจากบัญชีที่เชื่อมต่อ",
          })
          .setTimestamp();

        await interaction.editReply({
          content: "",
          embeds: [embed],
        });
      } catch (error) {
        console.error("[XM Price]", error);

        await interaction.editReply(
          `ดึงราคาไม่สำเร็จ: ${error.message}`
        );
      }
    }
  },
};
