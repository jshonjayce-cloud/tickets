"use strict";

const http = require("http");
const https = require("https");
const express = require("express");
const { Client, GatewayIntentBits, SlashCommandBuilder, ChannelType, REST, Routes } = require("discord.js");

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.disable("x-powered-by");
app.get("/", (_req, res) => res.status(200).json({ status: "ok", service: "jayce-tickets" }));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("ready", async (readyClient) => {
  console.log(`[DISCORD] Logged in as ${readyClient.user.tag}`);
  try {
    const panelCommand = new SlashCommandBuilder()
      .setName("setticketpanel")
      .setDescription("Post the support ticket panel in a text channel")
      .addChannelOption((option) => option
        .setName("channel")
        .setDescription("Text channel where the ticket panel should be posted")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true));

    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    const guildId = process.env.DISCORD_GUILD_ID;
    const route = guildId
      ? Routes.applicationGuildCommands(readyClient.application.id, guildId)
      : Routes.applicationCommands(readyClient.application.id);
    // Preserve other existing commands and replace only this command.
    const existing = await rest.get(route);
    const commands = existing.filter((command) => command.name !== "setticketpanel");
    commands.push(panelCommand.toJSON());
    await rest.put(route, { body: commands });
    console.log(`[DISCORD] Registered /setticketpanel ${guildId ? `in guild ${guildId}` : "globally"}`);
  } catch (error) {
    console.error("[DISCORD] Failed to register /setticketpanel:", error);
  }
});
client.on("error", (error) => console.error("[DISCORD] Client error:", error));

// Install the ticket interaction handler before logging in.
require("./index.js");

if (!process.env.DISCORD_TOKEN) {
  console.error("[DISCORD] DISCORD_TOKEN is required; set it in the Render environment variables.");
  process.exitCode = 1;
} else {
  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error("[DISCORD] Login failed:", error);
    process.exitCode = 1;
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[EXPRESS] Listening on port ${PORT}`);
  const target = process.env.RENDER_EXTERNAL_URL;
  if (!target) return;
  const interval = setInterval(() => {
    const transport = target.startsWith("https:") ? https : http;
    transport.get(target, { timeout: 5000 }, (response) => response.resume())
      .on("error", (error) => console.warn(`[KEEP-ALIVE] Ping failed: ${error.message}`));
  }, 5 * 60 * 1000);
  interval.unref();
});
