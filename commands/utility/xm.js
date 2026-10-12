
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const mt5Service = require("./xm/mt5Service");
const alertService = require("./xm/alertService");

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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("candles")
        .setDescription("ดึงข้อมูลแท่งเทียนจาก MT5")
        .addStringOption((option) =>
          option
            .setName("symbol")
            .setDescription("ชื่อ Symbol เช่น GOLD หรือ BTCUSD")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("timeframe")
            .setDescription("ช่วงเวลาของแท่งเทียน")
            .setRequired(true)
            .addChoices(
              { name: "M1 (1 นาที)", value: "M1" },
              { name: "M5 (5 นาที)", value: "M5" },
              { name: "M15 (15 นาที)", value: "M15" },
              { name: "M30 (30 นาที)", value: "M30" },
              { name: "H1 (1 ชั่วโมง)", value: "H1" },
              { name: "H4 (4 ชั่วโมง)", value: "H4" },
              { name: "D1 (1 วัน)", value: "D1" }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName("count")
            .setDescription("จำนวนแท่งเทียน 1–20")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(true)
        )
    )
    
    .addSubcommandGroup((group) =>
      group
        .setName("alert")
        .setDescription("จัดการการแจ้งเตือนราคา")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("เพิ่มเงื่อนไขแจ้งเตือนราคา")
            .addStringOption((option) =>
              option
                .setName("symbol")
                .setDescription("สินทรัพย์ เช่น GOLD หรือ BTCUSD")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("condition")
                .setDescription("เงื่อนไขราคา")
                .setRequired(true)
                .addChoices(
                  { name: "มากกว่า", value: "above" },
                  { name: "ต่ำกว่า", value: "below" }
                )
            )
            .addNumberOption((option) =>
              option
                .setName("price")
                .setDescription("ราคาเป้าหมาย")
                .setMinValue(0.000001)
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("room")
            .setDescription("เลือกห้องข้อความแจ้งเตือน")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("ห้องที่ต้องการใช้แจ้งเตือน")
                .addChannelTypes(
                  ChannelType.GuildText,
                  ChannelType.GuildAnnouncement
                )
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("list")
            .setDescription("แสดงเงื่อนไขแจ้งเตือนทั้งหมด")
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("ลบเงื่อนไขแจ้งเตือน")
            .addStringOption((option) =>
              option
                .setName("id")
                .setDescription("ID ของเงื่อนไขจากคำสั่ง list")
                .setRequired(true)
            )
        )
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

    
    // -----------------------------
    // /xm candles
    // -----------------------------
    if (subcommand === "candles") {
      await interaction.deferReply();

      try {
        const symbol = interaction.options
          .getString("symbol")
          .trim();

        const timeframe = interaction.options
          .getString("timeframe");

        const count = interaction.options
          .getInteger("count");

        await interaction.editReply(
          `กำลังดึงแท่งเทียน ${symbol} ${timeframe} จำนวน ${count} แท่ง...`
        );

        const result = await mt5Service.getCandles(
          symbol,
          timeframe,
          count
        );

        const format = (value) =>
          Number(value).toFixed(result.digits);

        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle(
            `${result.symbol} • ${result.timeframe}`
          )
          .setDescription(
            `แท่งเทียน ${result.count} แท่ง\n` +
            `เรียงจากเก่าไปใหม่\n` +
            `หมายเหตุ: แท่งล่าสุดอาจยังไม่ปิด`
          );

        for (const candle of result.candles) {
          const candleTime = new Date(
            candle.time * 1000
          ).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
          });

          embed.addFields({
            name: candleTime,
            value: [
              `**Open:** ${format(candle.open)}`,
              `**High:** ${format(candle.high)}`,
              `**Low:** ${format(candle.low)}`,
              `**Close:** ${format(candle.close)}`,
              `**Tick Volume:** ${candle.tick_volume}`,
            ].join("\n"),
            inline: true,
          });
        }

        embed
          .setFooter({
            text: "XM MT5 • ข้อมูลจากบัญชีที่เชื่อมต่อ",
          })
          .setTimestamp();

        await interaction.editReply({
          content: "",
          embeds: [embed],
        });
      } catch (error) {
        console.error("[XM Candles]", error);

        await interaction.editReply(
          `ดึงแท่งเทียนไม่สำเร็จ: ${error.message}`
        );
      }
    }

    
    const subcommandGroup = interaction.options.getSubcommandGroup(false);

    if (subcommandGroup === "alert") {
      if (!interaction.guild) {
        await interaction.reply({
          content: "คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์",
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guild.id;

      // /xm alert room
      if (subcommand === "room") {
        const channel = interaction.options.getChannel("channel");

        await interaction.deferReply({ ephemeral: true });

        try {
          const me = interaction.guild.members.me;

          if (!me?.permissionsIn(channel).has("SendMessages")) {
            await interaction.editReply(
              "บอทไม่มีสิทธิ์ส่งข้อความในห้องที่เลือก"
            );
            return;
          }

          await alertService.setRoom(guildId, channel.id);

          await interaction.editReply(
            `✅ ตั้งห้องแจ้งเตือนเป็น ${channel} แล้ว\n` +
            "ห้องใหม่นี้จะแทนที่ห้องเดิม"
          );
        } catch (error) {
          console.error("[XM Alert Room]", error);

          await interaction.editReply(
            `ตั้งห้องไม่สำเร็จ: ${error.message}`
          );
        }

        return;
      }

      // /xm alert add
      if (subcommand === "add") {
        await interaction.deferReply({ ephemeral: true });

        try {
          const roomId = alertService.getRoom(guildId);

          if (!roomId) {
            await interaction.editReply(
              "กรุณาเลือกห้องแจ้งเตือนก่อนด้วย `/xm alert room`"
            );
            return;
          }

          const symbol = interaction.options.getString("symbol").trim();
          const condition = interaction.options.getString("condition");
          const price = interaction.options.getNumber("price");

          // ตรวจ Symbol กับ MT5 เพื่อป้องกันการเพิ่มชื่อที่ไม่มีจริง
          const symbols = await mt5Service.getSymbols();
          const matched = symbols.find(
            (item) => item.name.toLowerCase() === symbol.toLowerCase()
          );

          if (!matched) {
            await interaction.editReply(
              `ไม่พบ Symbol \`${symbol}\` ใน MT5\n` +
              "ใช้ชื่อ Symbol ให้ตรงกับรายการใน MT5"
            );
            return;
          }

          // ยืนยันว่าดึงราคาปัจจุบันได้ก่อนสร้างเงื่อนไข
          const quote = await mt5Service.getPrice(matched.name);

          const alert = await alertService.addAlert(
            guildId,
            matched.name,
            condition,
            price
          );

          const directionText =
            condition === "above" ? "มากกว่า" : "ต่ำกว่า";

          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle("🔔 เพิ่ม Price Alert สำเร็จ")
                .setDescription(
                  `**${matched.name}** ${directionText} **${price}**`
                )
                .addFields(
                  {
                    name: "ราคา Bid ปัจจุบัน",
                    value: Number(quote.bid).toFixed(quote.digits),
                    inline: true,
                  },
                  {
                    name: "Alert ID",
                    value: `\`${alert.id}\``,
                    inline: false,
                  }
                )
                .setFooter({
                  text: "ระบบจะเริ่มตรวจราคาอัตโนมัติ",
                })
                .setTimestamp(),
            ],
          });
        } catch (error) {
          console.error("[XM Alert Add]", error);

          await interaction.editReply(
            `เพิ่ม Alert ไม่สำเร็จ: ${error.message}`
          );
        }

        return;
      }

      // /xm alert list
      if (subcommand === "list") {
        const alerts = alertService.listAlerts(guildId);
        const roomId = alertService.getRoom(guildId);

        if (!alerts.length) {
          await interaction.reply({
            content: "ยังไม่มีเงื่อนไขแจ้งเตือน ใช้ `/xm alert add` เพื่อเพิ่ม",
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle("📋 รายการ Price Alert")
          .setDescription(
            `ห้องแจ้งเตือน: ${roomId ? `<#${roomId}>` : "ยังไม่ได้ตั้งค่า"}`
          );

        for (const alert of alerts) {
          const directionText =
            alert.direction === "above" ? "มากกว่า" : "ต่ำกว่า";

          embed.addFields({
            name: `${alert.symbol} ${directionText} ${alert.target}`,
            value: `ID: \`${alert.id}\``,
            inline: false,
          });
        }

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });

        return;
      }

      // /xm alert remove
      
      if (subcommand === "remove") {
        const id = interaction.options.getString("id", true).trim();

        try {
          if (id.toLowerCase() === "all") {
            const removedCount = await alertService.removeAllAlerts(guildId);

            await interaction.reply({
              content: `✅ ลบ Alert ทั้งหมดแล้ว จำนวน ${removedCount} รายการ`,
              ephemeral: true,
            });

            return;
          }

          const removed = await alertService.removeAlert(guildId, id);

          await interaction.reply({
            content: removed
              ? `✅ ลบ Alert \`${id}\` แล้ว`
              : `ไม่พบ Alert ID \`${id}\``,
            ephemeral: true,
          });
        } catch (error) {
          console.error("[XM Alert Remove]", error);

          await interaction.reply({
            content: `ลบ Alert ไม่สำเร็จ: ${error.message}`,
            ephemeral: true,
          });
        }

        return;
      }

    }

  },
};
