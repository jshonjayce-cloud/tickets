"use strict";

const fs = require("fs");
const path = require("path");
const {
  Client, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require("discord.js");
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
    if (!store.executors || typeof store.executors !== "object" || Array.isArray(store.executors)) store.executors = {};
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
const executorKey = (guildId, name) => key(guildId, name.trim().toLowerCase());
function ensureDefaultExecutors(guildId) {
  const guildKey = key(guildId, "registry");
  if (!store.executors[guildKey]) {
    store.executors[guildKey] = {};
    for (const [name, version, status] of DEFAULT_EXECUTORS) store.executors[guildKey][executorKey(guildId, name)] = { name, version, status };
  }
}
function getExecutorEntries(guildId, filter) {
  ensureDefaultExecutors(guildId);
  return Object.values(store.executors[key(guildId, "registry")] || {})
    .filter((entry) => !filter || entry.status === filter)
    .sort((a, b) => a.name.localeCompare(b.name) || a.status.localeCompare(b.status));
}
function executorEmbed(guildId, filter) {
  const entries = getExecutorEntries(guildId, filter);
  const text = entries.length ? entries.map((entry) => `${entry.status === "updated" ? "🟢" : "🔴"} **${entry.name}** — ${entry.version} (${entry.status})`).join("\n") : "No executors found.";
  return new EmbedBuilder().setTitle("Executor Status").setColor(filter === "outdated" ? 0xed4245 : filter === "updated" ? 0x57f287 : 0x5865f2).setDescription(text.slice(0, 4000)).setFooter({ text: `${entries.length} executor${entries.length === 1 ? "" : "s"}` });
}
function isStaff(i) {
  const roles = i.member?.roles;
  return (Array.isArray(roles) ? roles.includes(STAFF_ROLE_ID) : Boolean(roles?.cache?.has(STAFF_ROLE_ID))) || Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator));
}
function ownerId(channel) { return channel?.topic?.match(/^jayce-ticket:(\d+):[a-z-]+(?::closed)?$/)?.[1] || null; }
function isTicket(channel) { return Boolean(ownerId(channel)); }
function ticketKey(channel) { return key(channel.guildId, channel.id); }
function ticketLog(channel, action, actor, extra = "") {
  const k = ticketKey(channel);
  store.tickets[k] ||= { channelId: channel.id, guildId: channel.guildId, ownerId: ownerId(channel), createdAt: now(), events: [], notes: [] };
  store.tickets[k].events.push({ at: now(), action, actorId: actor.id, actorTag: actor.tag || actor.username, extra });
  saveStore();
}
function panelPayload() {
  const menu = new StringSelectMenuBuilder().setCustomId("jayce_ticket:create").setPlaceholder("Choose a cozy category")
    .addOptions(TICKET_TYPES.map((t) => ({ label: t.name, value: t.value, description: t.description, emoji: "☕" })));
  const embed = new EmbedBuilder().setTitle("🐸 Cozy Ticket Support")
    .setDescription("Welcome to jayce.EXE support.\n\nChoose a category below to open a private ticket.\nOnly you and the support team can view it.")
    .setColor(0x5865f2).setFooter({ text: "jayce.EXE • Ticket Support" });
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}
function cleanName(value) { return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "ticket"; }
async function closeTicket(channel, actor, reason = "Ticket closed") {
  const owner = ownerId(channel);
  if (!owner) throw new Error("This is not a recognized ticket channel.");
  await channel.permissionOverwrites.edit(owner, { SendMessages: false, AddReactions: false });
  await channel.setTopic(channel.topic.replace(/:closed$/, "") + ":closed", reason);
  await channel.setName(cleanName(`closed-${channel.name}`));
  ticketLog(channel, "closed", actor, reason);
}
async function reopenTicket(channel, actor) {
  const owner = ownerId(channel);
  if (!owner) throw new Error("This is not a recognized ticket channel.");
  await channel.permissionOverwrites.edit(owner, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  await channel.setTopic(channel.topic.replace(/:closed$/, ""), "Ticket reopened");
  await channel.setName(cleanName(channel.name.replace(/^closed-/, "")));
  ticketLog(channel, "reopened", actor);
}
async function replyError(i, error) {
  console.error("[TICKETS] Action failed:", error);
  const text = `Action failed${error?.code ? ` (Discord ${error.code})` : ""}: ${error?.message || "unknown error"}`;
  try {
    if (i.deferred || i.replied) await i.followUp({ content: text, flags: MessageFlags.Ephemeral });
    else await i.reply({ content: text, flags: MessageFlags.Ephemeral });
  } catch (_) {}
}
async function handle(i) {
  if (i.isStringSelectMenu() && i.customId === "jayce_ticket:create") {
    if (!i.inGuild()) return i.reply({ content: "Tickets only work in a server.", flags: MessageFlags.Ephemeral });
    const type = TICKET_TYPES.find((t) => t.value === i.values[0]);
    if (!type) return i.reply({ content: "Unknown ticket category.", flags: MessageFlags.Ephemeral });
    const ban = store.bans[key(i.guildId, i.user.id)];
    if (ban) return i.reply({ content: `You cannot open tickets: ${ban.reason || "ticket access restricted"}`, flags: MessageFlags.Ephemeral });
    const category = await i.guild.channels.fetch(CATEGORY_ID).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) return i.reply({ content: `Ticket category ${CATEGORY_ID} was not found or is not a category.`, flags: MessageFlags.Ephemeral });
    const channels = await i.guild.channels.fetch();
    const existing = channels.find((c) => c && c.parentId === CATEGORY_ID && ownerId(c) === i.user.id && !c.topic?.endsWith(":closed"));
    if (existing) return i.reply({ content: `You already have an open ticket: ${existing}.`, flags: MessageFlags.Ephemeral });
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = await i.guild.channels.create({
      name: `ticket-${cleanName(i.user.username).slice(0, 60)}`, type: ChannelType.GuildText, parent: CATEGORY_ID,
      topic: `${TICKET_PREFIX}${i.user.id}:${type.value}`,
      permissionOverwrites: [
        { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: i.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
      ], reason: `Ticket opened by ${i.user.tag} (${type.name})`
    });
    const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("jayce_ticket:close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger));
    await channel.send({ content: `${i.user} <@&${STAFF_ROLE_ID}>`, embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("jayce.EXE — Support").setDescription(`Welcome ${i.user}! Please describe what you need help with. A staff member will be with you soon.`)], components: [closeRow] });
    ticketLog(channel, "created", i.user, type.name);
    return i.editReply({ content: `Your private ticket has been created: ${channel}.` });
  }
  if (i.isButton() && i.customId === "jayce_ticket:close") {
    if (!i.inGuild() || !isTicket(i.channel)) return i.reply({ content: "This is not a ticket channel.", flags: MessageFlags.Ephemeral });
    if (i.user.id !== ownerId(i.channel) && !isStaff(i)) return i.reply({ content: "Only the ticket creator or staff can close this ticket.", flags: MessageFlags.Ephemeral });
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await closeTicket(i.channel, i.user, "Closed with ticket button");
    return i.editReply("Ticket closed and archived. Staff can reopen it with /ticket reopen.");
  }
  if (!i.isChatInputCommand()) return;
  const command = i.commandName;
  if (staffCommands.has(command) && !isStaff(i)) return i.reply({ content: "You need the support staff role or Administrator permission.", flags: MessageFlags.Ephemeral });
  const sub = ["ticket", "mod", "bug", "feature", "core", "executors"].includes(command) ? i.options.getSubcommand() : null;

  if (command === "setticketpanel") {
    const destination = i.channel;
    if (!destination?.isSendable?.()) return i.reply({ content: "Run this command inside a regular text channel where the bot can send messages.", flags: MessageFlags.Ephemeral });
    await destination.send(panelPayload());
    return i.reply({ content: `Cozy ticket panel posted in ${destination}.`, flags: MessageFlags.Ephemeral });
  }
  if (command === "account") return i.reply({ embeds: [new EmbedBuilder().setTitle("Discord Account").setThumbnail(i.user.displayAvatarURL()).addFields({ name: "Username", value: i.user.tag || i.user.username, inline: true }, { name: "User ID", value: i.user.id, inline: true })] });
  if (command === "status") {
    const entries = getExecutorEntries(i.guildId);
    return i.reply(`**jayce.EXE status:** ${store.status}\n**Executors:** ${entries.filter((e) => e.status === "updated").length} updated, ${entries.filter((e) => e.status === "outdated").length} outdated`);
  }
  if (command === "executors") {
    ensureDefaultExecutors(i.guildId);
    const guildKey = key(i.guildId, "registry");
    if (sub === "view") return i.reply({ embeds: [executorEmbed(i.guildId, i.options.getString("filter"))] });
    const name = i.options.getString("name").trim();
    const entryKey = executorKey(i.guildId, name);
    if (sub === "set") {
      store.executors[guildKey][entryKey] = { name, version: i.options.getString("version").trim(), status: i.options.getString("status") };
      saveStore();
      return i.reply({ embeds: [executorEmbed(i.guildId, null)] });
    }
    if (!store.executors[guildKey][entryKey]) return i.reply({ content: `Executor **${name}** was not found.`, flags: MessageFlags.Ephemeral });
    delete store.executors[guildKey][entryKey]; saveStore();
    return i.reply({ content: `Executor **${name}** removed.`, embeds: [executorEmbed(i.guildId, null)] });
  }
  if (command === "ticket") {
    const channel = i.channel;
    if (["ban", "unban"].includes(sub)) {
      const user = i.options.getUser("user"); const k = key(i.guildId, user.id);
      if (sub === "ban") store.bans[k] = { userId: user.id, reason: i.options.getString("reason") || "", by: i.user.id, at: now() };
      else delete store.bans[k];
      saveStore();
      return i.reply({ content: sub === "ban" ? `${user.tag} is blocked from opening tickets.` : `${user.tag} can open tickets again.`, flags: MessageFlags.Ephemeral });
    }
    if (sub === "autoreply" || sub === "removeautoreply") {
      const trigger = i.options.getString("trigger").toLowerCase(); store.autoReplies[i.guildId] ||= {};
      if (sub === "autoreply") store.autoReplies[i.guildId][trigger] = i.options.getString("reply"); else delete store.autoReplies[i.guildId][trigger];
      saveStore(); return i.reply({ content: sub === "autoreply" ? `Auto-reply saved for “${trigger}”.` : `Auto-reply removed for “${trigger}”.`, flags: MessageFlags.Ephemeral });
    }
    if (!isTicket(channel)) return i.reply({ content: "Run this command inside a ticket channel.", flags: MessageFlags.Ephemeral });
    if (sub === "close") { await closeTicket(channel, i.user, "Closed by staff command"); return i.reply({ content: "Ticket closed and archived.", flags: MessageFlags.Ephemeral }); }
    if (sub === "reopen") { await reopenTicket(channel, i.user); return i.reply({ content: "Ticket reopened.", flags: MessageFlags.Ephemeral }); }
    const k = ticketKey(channel); store.tickets[k] ||= { channelId: channel.id, guildId: channel.guildId, ownerId: ownerId(channel), events: [], notes: [] };
    if (sub === "say") { await channel.send(i.options.getString("message")); ticketLog(channel, "staff message", i.user); return i.reply({ content: "Message sent.", flags: MessageFlags.Ephemeral }); }
    if (sub === "delete") { await i.reply({ content: "Deleting ticket…", flags: MessageFlags.Ephemeral }); ticketLog(channel, "deleted", i.user); return channel.delete(`Deleted by ${i.user.tag}`); }
    if (sub === "rename") { const oldName = channel.name; await channel.setName(cleanName(i.options.getString("name"))); ticketLog(channel, "renamed", i.user, oldName); return i.reply({ content: "Ticket renamed.", flags: MessageFlags.Ephemeral }); }
    if (sub === "note") { store.tickets[k].notes.push({ text: i.options.getString("text"), by: i.user.id, at: now() }); ticketLog(channel, "staff note added", i.user); return i.reply({ content: "Private staff note saved.", flags: MessageFlags.Ephemeral }); }
    if (sub === "history") { const events = store.tickets[k].events || []; return i.reply({ content: events.length ? events.slice(-15).map((e) => `${e.at} — ${e.action} by ${e.actorTag || e.actorId}`).join("\n") : "No ticket history yet.", flags: MessageFlags.Ephemeral }); }
    if (sub === "priority") { store.tickets[k].priority = i.options.getString("level"); ticketLog(channel, "priority changed", i.user, store.tickets[k].priority); return i.reply(`Priority set to ${store.tickets[k].priority}.`); }
    if (sub === "transfer") { store.tickets[k].department = i.options.getString("department"); ticketLog(channel, "transferred", i.user, store.tickets[k].department); return i.reply(`Ticket transferred to ${store.tickets[k].department}.`); }
    if (sub === "waiting") { store.tickets[k].status = "waiting"; ticketLog(channel, "waiting for customer", i.user); return i.reply("Ticket marked as waiting for the customer."); }
    if (sub === "claim" || sub === "unclaim") { if (sub === "claim") store.tickets[k].claimedBy = i.user.id; else delete store.tickets[k].claimedBy; ticketLog(channel, sub === "claim" ? "claimed" : "unclaimed", i.user); return i.reply(sub === "claim" ? `Ticket claimed by ${i.user}.` : "Ticket is unclaimed."); }
  }
  if (command === "stats" || command === "staff" || (command === "core" && sub === "analytics")) {
    const tickets = i.guild.channels.cache.filter((c) => isTicket(c));
    const open = tickets.filter((c) => !c.topic?.endsWith(":closed")).size;
    return i.reply({ embeds: [new EmbedBuilder().setTitle(command === "staff" ? "jayce.EXE Staff Dashboard" : "Server Statistics").addFields({ name: "Members", value: String(i.guild.memberCount), inline: true }, { name: "Open tickets", value: String(open), inline: true }, { name: "Total tickets", value: String(tickets.size), inline: true })] });
  }
  if (command === "customer" || (command === "core" && sub === "customer")) {
    const user = i.options.getUser("user"); const k = key(i.guildId, user.id);
    return i.reply({ content: `Customer: ${user.tag || user.username}\nFlags: ${(store.customerFlags[k] || []).join(", ") || "None"}\nNotes: ${(store.customerNotes[k] || []).map((n) => n.text).join(" | ") || "None"}`, flags: MessageFlags.Ephemeral });
  }
  if (command === "mod") {
    const user = i.options.getUser("user"); const k = key(i.guildId, user.id);
    if (sub === "blacklist") store.bans[k] = { userId: user.id, reason: i.options.getString("reason") || "", by: i.user.id, at: now() };
    else if (sub === "unblacklist") delete store.bans[k];
    else if (sub === "warn") { store.warnings[k] ||= []; store.warnings[k].push({ reason: i.options.getString("reason"), by: i.user.id, at: now() }); }
    saveStore();
    if (sub === "history") return i.reply({ content: `Blacklist: ${store.bans[k]?.reason || (store.bans[k] ? "Yes" : "No")}\nWarnings: ${(store.warnings[k] || []).map((w) => `${w.at}: ${w.reason}`).join("\n") || "None"}`, flags: MessageFlags.Ephemeral });
    return i.reply({ content: sub === "blacklist" ? `${user.tag} ticket-blacklisted.` : sub === "unblacklist" ? `${user.tag} removed from ticket blacklist.` : `Warning recorded for ${user.tag}.`, flags: MessageFlags.Ephemeral });
  }
  if (command === "bug" || command === "feature") {
    const item = i.options.getString("item"); const map = command === "bug" ? store.bugs : store.features;
    if (sub === "update") { map[key(i.guildId, item.toLowerCase())] = { item, status: i.options.getString("status"), details: i.options.getString("details") || "", by: i.user.id, at: now() }; saveStore(); }
    const record = map[key(i.guildId, item.toLowerCase())];
    return i.reply(record ? `**${record.item}** — ${record.status}\n${record.details}` : `No ${command} status found for **${item}**.`);
  }
  if (command === "core") {
    if (sub === "status") { store.status = i.options.getString("status"); saveStore(); return i.reply(`Product status set to: ${store.status}`); }
    if (sub === "component") { const name = i.options.getString("name"); store.components[key(i.guildId, name.toLowerCase())] = { name, status: i.options.getString("status"), at: now() }; saveStore(); return i.reply(`Component **${name}** status updated.`); }
    if (sub === "customerflag" || sub === "customnote") {
      const user = i.options.getUser("user"); const k = key(i.guildId, user.id);
      if (sub === "customerflag") { store.customerFlags[k] ||= []; store.customerFlags[k].push(i.options.getString("flag")); }
      else { store.customerNotes[k] ||= []; store.customerNotes[k].push({ text: i.options.getString("text"), by: i.user.id, at: now() }); }
      saveStore(); return i.reply({ content: "Customer record updated.", flags: MessageFlags.Ephemeral });
    }
  }
  return i.reply({ content: "Command handled, but this operation is not available here.", flags: MessageFlags.Ephemeral });
}
async function onInteraction(i) { try { await handle(i); } catch (error) { await replyError(i, error); } }
async function onMessage(message) {
  if (message.author.bot || !message.guild || !isTicket(message.channel)) return;
  const replies = store.autoReplies[message.guild.id] || {};
  const content = message.content.toLowerCase();
  const match = Object.keys(replies).find((trigger) => trigger && content.includes(trigger));
  if (match) await message.reply({ content: replies[match], allowedMentions: { repliedUser: false } }).catch((e) => console.error("[AUTOREPLY]", e));
}
const originalEmit = Client.prototype.emit;
Client.prototype.emit = function (eventName, ...args) {
  if (eventName === "interactionCreate" && args[0]) { onInteraction(args[0]); return true; }
  if (eventName === "messageCreate" && args[0]) onMessage(args[0]).catch((e) => console.error("[AUTOREPLY]", e));
  return originalEmit.call(this, eventName, ...args);
};
