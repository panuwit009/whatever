
const { SlashCommandBuilder } = require("discord.js");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { activeGames } = require("./game/service");

const frontendPath = path.join(__dirname, "game", "frontend");

let nextProcess = null;

function startNextDev() {
    if (nextProcess && nextProcess.exitCode === null && !nextProcess.killed) {
        return;
    }

    console.log("[Game] Starting Next.js development server...");

    nextProcess = spawn(
        "npm run dev -- --hostname 0.0.0.0",
        {
            cwd: frontendPath,
            shell: true,
            windowsHide: true,
            stdio: "ignore",
        }
    );

    nextProcess.on("error", (error) => {
        console.error("[Game] Failed to start Next.js:", error);
        nextProcess = null;
    });

    nextProcess.on("exit", (code) => {
        console.log(`[Game] Next.js exited with code ${code}`);
        nextProcess = null;
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("game")
        .setDescription("ระบบเกม")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("start")
                .setDescription("เปิดระบบและสร้างห้องเกม")
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() !== "start") {
            return;
        }

        //const frontendUrl = process.env.GAME_FRONTEND_URL;
		const frontendUrl = "http://tin.local:3000";

        if (!frontendUrl) {
            return interaction.reply({
                content: "ยังไม่ได้ตั้งค่า GAME_FRONTEND_URL ในไฟล์ .env",
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        try {
            // เริ่ม Next.js หากยังไม่ได้เริ่มจากคำสั่งนี้
            startNextDev();

            const roomId = crypto.randomUUID();
            const token = crypto.randomBytes(32).toString("hex");
            const user = interaction.user;

            const game = {
                roomId,
                token,
                owner: {
                    id: user.id,
                    username: user.username,
                    displayName: user.globalName ?? user.username,
                    avatar: user.displayAvatarURL({ size: 256 }),
                },
                guildId: interaction.guildId,
                createdAt: Date.now(),
                players: new Map(),
            };

            activeGames.set(token, game);

            const url = new URL(frontendUrl);
            url.searchParams.set("token", token);

            // ข้อความปกติ ทุกคนในช่อง Discord จะเห็นลิงก์
            await interaction.editReply({
                content: [
                    "🎮 **เปิดห้องเกมแล้ว!**",
                    "",
                    `ผู้สร้าง: ${game.owner.displayName}`,
                    `รหัสห้อง: \`${roomId}\``,
                    "",
                    `🔗 เข้าร่วมเกม: ${url.toString()}`,
                    "",
                    "ผู้เล่นสามารถเปิดลิงก์นี้ผ่านเครือข่าย Hamachi ได้",
                ].join("\n"),
            });

            console.log(
                `[Game] Created room ${roomId} by ${user.username}`
            );
        } catch (error) {
            console.error("[Game] Failed to start game:", error);

            await interaction.editReply({
                content: "เกิดข้อผิดพลาดขณะเปิดระบบเกม กรุณาตรวจสอบ Console",
            });
        }
    },

    activeGames,
};
