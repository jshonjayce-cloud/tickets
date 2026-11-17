"use strict";

// index.js contains the HTTP listener and keep-alive loop; expose its
// dependencies before loading the ticket extension so it can start cleanly.
global.http = require("http");
global.https = require("https");
global.PORT = Number(process.env.PORT) || 3000;
global.app = require("express")();

global.app.disable("x-powered-by");
global.app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", service: "jayce-tickets" });
});
global.app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const { Client, GatewayIntentBits } = require("discord.js");
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

// This module patches the Discord client and starts the HTTP/keep-alive
// services. Do not start another listener here or it will bind twice.
require("./index.js");
