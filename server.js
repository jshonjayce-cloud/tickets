"use strict";

const http = require("http");
const https = require("https");
const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.disable("x-powered-by");
app.get("/", (_req, res) => res.status(200).json({ status: "ok", service: "jayce-tickets" }));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("ready", (readyClient) => console.log(`[DISCORD] Logged in as ${readyClient.user.tag}`));
client.on("error", (error) => console.error("[DISCORD] Client error:", error));

// Register the ticket interaction handler before connecting the Discord client.
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
