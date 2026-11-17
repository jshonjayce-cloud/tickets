"use strict";

const http = require("http");
const https = require("https");
const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.disable("x-powered-by");
app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", service: "jayce-tickets" });
});
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", (readyClient) => {
  console.log(`[DISCORD] Logged in as ${readyClient.user.tag}`);
});

client.on("error", (error) => {
  console.error("[DISCORD] Client error:", error);
});

if (!process.env.DISCORD_TOKEN) {
  console.warn("[DISCORD] DISCORD_TOKEN is not set. The web server will run, but Discord features will be offline.");
} else {
  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error("[DISCORD] Login failed:", error);
  });
}

// Load the ticket interaction extension after the Discord client is created.
require("./index.js");

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[EXPRESS] Listening on port ${PORT}`);

  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL;
  if (!keepAliveUrl) return;

  const interval = setInterval(() => {
    const transport = keepAliveUrl.startsWith("https") ? https : http;
    transport
      .get(keepAliveUrl, { timeout: 5000 }, (response) => {
        response.resume();
      })
      .on("error", (error) => {
        console.log(`[KEEP-ALIVE] Ping failed: ${error.message}`);
      });
  }, 5 * 60 * 1000);

  interval.unref();
});
