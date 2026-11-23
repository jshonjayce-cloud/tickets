"use strict";

const fs = require("fs");
const path = require("path");
const { Client, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { staffCommands } = require("./commands");

const CATEGORY_ID = "1574447894679916684";
const STAFF_ROLE_ID = "1570780402363400262";
const TICKET_PREFIX = "jayce-ticket:";
const STORE_PATH = process.env.TICKET_DATA_FILE || path.join(process.cwd(), "ticket-data.json");
const TICKET_TYPES = [
  { name: "Main", value: "main", description: "Open a Main support ticket" },
  { name: "Mobile Main", value: "mobile-main", description: "Open a Mobile Main support ticket" },
  { name: "Key / HWID", value: "key-hwid", description: "Open a Key / HWID support ticket" },
  { name: "Bug Report", value: "bug-report", description: "Open a Bug Report support ticket" }
];

const DEFAULT_EXECUTORS = [
  ["Athena", "1.0.4", "updated"], ["Axis", "0.5.7-fc966", "updated"], ["Delta", "2.729.840", "updated"],
  ["DX9WARE V2", "1.1.229", "updated"], ["Lucid", "1.0.4", "updated"], ["Lumen", "1.0.9", "updated"],
  ["Madium", "2.9.6", "updated"], ["Matcha", "v2", "updated"], ["Matrix Hub", "v3", "updated"],
  ["Photon", "7.1", "updated"], ["Potassium", "2.7.0", "updated"], ["Real", "3.2.2", "updated"],
  ["Serotonin", "v2", "updated"], ["SirHurt", "V5.481", "updated"], ["Solara", "0.1.9a", "updated"],
  ["Velocity", "1.6.4", "updated"], ["Volcano", "v3.2.11.5", "updated"], ["Volt", "1.3.22.2", "updated"],
  ["Wave", "NEW-1.6.3", "updated"], ["Xeno", "1.3.65", "updated"], ["Delta", "2.729.838", "outdated"],
  ["Isaeva", "2.6.10", "outdated"], ["Lynx", "0.747", "outdated"], ["MacSploit", "747.1", "outdated"],
  ["Madius", "1.11.10-beta", "outdated"], ["Opiumware", "v2.6.0-hotf", "outdated"], ["Severe", "v2", "outdated"],
  ["Synapse Z", "1.0.4.0", "outdated"], ["Vega X", "2.734.917", "outdated"]
];

const blankStore = () => ({ bans: {}, tickets: {}, warnings: {}, bugs: {}, features: {}, components: {}, customerFlags: {}, customerNotes: {}, autoReplies: {}, status: "Operational", executors: {} });
let store;
function loadStore() {
  try {
    const loaded = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    store = { ...blankStore(), ...loaded };
    if (typeof store.executors !== "object" || store.executors === null || Array.isArray(store.executors)) store.executors = {};
  } catch (error) {
    if (error.code !== "ENOENT") console.error("[DATA] Could not read ticket data:", error);
    store = blankStore();
  }
}
function saveStore() {
  const temp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, STORE_PATH);
}
loadStore();
const key = (guildId, id) => `${guildId}:${id}`;
const now = () => new Date().toISOString();

function executorKey(guildId, name) { return key(guildId, name.trim().toLowerCase()); }
function ensureDefaultExecutors(guildId) {
  const guildKey = key(guildId, "registry");
  if (!store.executors[guildKey]) {
    store.executors[guildKey] = {};
    for (const [name, version, status] of DEFAULT_EXECUTORS) {
      store.executors[guildKey][executorKey(guildId, name)] = { name, version, status };
    }
  }
}
function getExecutorEntries(guildId, filter) {
  ensureDefaultExecutors(guildId);
  return Object.values(store.executors[key(guildId, "registry"] || {})
}
