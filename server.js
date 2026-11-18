"use strict";

const http = require("http");
const https = require("https");
const express = require("express");
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const { commands } = require("./commands");
const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.disable("x-powered-by");
app.get("/", (_req, res) => res.status(200).json({ status: "ok", service: "jayce-tickets" }));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once("ready", async (bot) => {
  console.log(`[DISCORD] Logged in as ${bot.user.tag}`);
  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    const guildId = process.env.DISCORD_GUILD_ID;
    const route = guildId ? Routes.applicationGuildCommands(bot.application.id, guildId) : Routes.applicationCommands(bot.application.id);
    const current = await rest.get(route);
    const names = new Set(commands.map((c) => c.name));
    const payload = current.filter((c) => !names.has(c.name)).concat(commands);
    await rest.put(route, { body: payload });
    console.log(`[DISCORD] Registered ${commands.length} Jayce commands ${guildId ? `in guild ${guildId}` : "globally"}`);
  } catch (error) { console.error("[DISCORD] Slash-command registration failed:", error); }
});
client.on("error", (error) => console.error("[DISCORD] Client error:", error));
require("./index.js");
if (!process.env.DISCORD_TOKEN) { console.error("[DISCORD] DISCORD_TOKEN is required."); process.exitCode = 1; }
else client.login(process.env.DISCORD_TOKEN).catch((error) => { console.error("[DISCORD] Login failed:", error); process.exitCode = 1; });
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[EXPRESS] Listening on port ${PORT}`);
  const target = process.env.RENDER_EXTERNAL_URL;
  if (!target) return;
  const timer = setInterval(() => {
    const transport = target.startsWith("https:") ? https : http;
    transport.get(target, { timeout: 5000 }, (res) => res.resume()).on("error", (e) => console.warn(`[KEEP-ALIVE] ${e.message}`));
  }, 300000);
  timer.unref();
});
