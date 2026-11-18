"use strict";

const fs = require("fs");
const path = require("path");
const {
  Client, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require("discord.js");
const { staffCommands } = require("./commands");

const CATEGORY_ID = "1572392852540100690";
const STAFF_ROLE_ID = "1570780402363400262";
const TICKET_PREFIX = "jayce-ticket:";
const STORE_PATH = process.env.TICKET_DATA_FILE || path.join(process.cwd(), "ticket-data.json");
const TICKET_TYPES = [
  { name: "Main", value: "main", description: "Open a Main support ticket" },
  { name: "Mobile Main", value: "mobile-main", description: "Open a Mobile Main support ticket" },
  { name: "Key / HWID", value: "key-hwid", description: "Open a Key / HWID support ticket" },
  { name: "Bug Report", value: "bug-report", description: "Open a Bug Report support ticket" }
];
const blankStore = () => ({ bans: {}, tickets: {}, warnings: {}, bugs: {}, features: {}, components: {}, customerFlags: {}, customerNotes: {}, autoReplies: {}, status: "Operational", executors: "Unknown" });
let store;
function loadStore() {
  try { store = { ...blankStore(), ...JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) }; }
  catch (error) {
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
function isStaff(i) {
  const roles = i.member?.roles;
  return (Array.isArray(roles) ? roles.includes(STAFF_ROLE_ID) : Boolean(roles?.cache?.has(STAFF_ROLE_ID))) || Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator));
}
function ownerId(channel) {
  const m = channel?.topic?.match(/^jayce-ticket:(\d+):[a-z-]+(?::closed)?$/);
  return m?.[1] || null;
}
function ticketKey(channel) { return key(channel.guildId, channel.id); }
function isTicket(channel) { return Boolean(ownerId(channel)); }
function ticketLog(channel, action, actor, extra = "") {
  const k = ticketKey(channel);
  store.tickets[k] ||= { channelId: channel.id, guildId: channel.guildId, ownerId: ownerId(channel), createdAt: now(), events: [], notes: [] };
  store.tickets[k].events.push({ at: now(), action, actorId: actor.id, actorTag: actor.tag || actor.username, extra });
  saveStore();
}
function panelPayload() {
  const menu = new StringSelectMenuBuilder().setCustomId("jayce_ticket:create").setPlaceholder("Choose a ticket category")
    .addOptions(TICKET_TYPES.map((t) => ({ label: t.name, value: t.value, description: t.description })));
  return { content: "# jayce.EXE\n**Choose a category to open a private ticket.**\nOnly you and the support team can view the ticket.", components: [new ActionRowBuilder().addComponents(menu)] };
}
function cleanName(value) { return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "ticket"; }
async function closeTicket(channel, actor, reason = "Ticket closed") {
  const owner = ownerId(channel);
  if (!owner) throw new Error("This is not a recognized ticket channel.");
  await channel.permissionOverwrites.edit(owner, { SendMessages: false, AddReactions: false });
  const topic = channel.topic.replace(/:closed$/, "") + ":closed";
  await channel.setTopic(topic, reason);
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
  const code = error?.code ? ` (Discord ${error.code})` : "";
  const text = `Action failed${code}: ${error?.message || "unknown error"}`;
  try { if (i.deferred || i.replied) await i.followUp({ content: text, flags: MessageFlags.Ephemeral }); else await i.reply({ content: text, flags: MessageFlags.Ephemeral }); } catch (_) {}
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
    const existing = channels.find((c) => c && c.parentId === CATEGORY_ID && ownerId(c) === i.user.id && !c.topic.endsWith(":closed"));
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
    await channel.send({ content: `${i.user} <@&${STAFF_ROLE_ID}>`, embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("jayce.EXE — Support").setDescription("Please describe what you need help with. Support staff will be with you soon.").addFields({ name: "Ticket type", value: type.name, inline: true }, { name: "Opened by", value: i.user.tag, inline: true }).setTimestamp()], components: [closeRow], allowedMentions: { users: [i.user.id], roles: [STAFF_ROLE_ID] } });
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
  const sub = ["ticket", "mod", "bug", "feature", "core"].includes(command) ? i.options.getSubcommand() : null;
  if (command === "setticketpanel") {
    const ch = i.options.getChannel("channel"); await ch.send(panelPayload()); return i.reply({ content: `Ticket panel posted in ${ch}.`, flags: MessageFlags.Ephemeral });
  }
  if (command === "account") {
    const u = i.user;
    return i.reply({ embeds: [new EmbedBuilder().setTitle("Discord Account").setThumbnail(u.displayAvatarURL()).addFields({ name: "Username", value: u.tag || u.username, inline: true }, { name: "User ID", value: u.id, inline: true }, { name: "Created", value: `<t:${Math.floor(u.createdTimestamp / 1000)}:F>` })], flags: MessageFlags.Ephemeral });
  }
  if (command === "stats" || command === "staff" || (command === "core" && sub === "analytics")) {
    const g = i.guild; const tickets = g.channels.cache.filter((c) => isTicket(c)); const open = tickets.filter((c) => !c.topic.endsWith(":closed")).size;
    const staffCount = g.members.cache.filter((m) => m.roles.cache.has(STAFF_ROLE_ID)).size;
    return i.reply({ embeds: [new EmbedBuilder().setTitle(command === "staff" ? "jayce.EXE Staff Dashboard" : "Server Statistics").addFields({ name: "Members", value: String(g.memberCount), inline: true }, { name: "Channels", value: String(g.channels.cache.size), inline: true }, { name: "Open tickets", value: String(open), inline: true }, { name: "Staff online/cache", value: String(staffCount), inline: true }, { name: "Product status", value: store.status, inline: true })], flags: MessageFlags.Ephemeral });
  }
  if (command === "status") return i.reply(`**jayce.EXE status:** ${store.status}\n**Executors:** ${store.executors}`);
  if (command === "customer" || (command === "core" && sub === "customer")) {
    const u = i.options.getUser("user"); const k = key(i.guildId, u.id);
    return i.reply({ content: `Customer: ${u.tag || u.username}\nFlags: ${(store.customerFlags[k] || []).join(", ") || "None"}\nNotes: ${(store.customerNotes[k] || []).map((n) => n.text).join(" | ") || "None"}`, flags: command === "customer" ? MessageFlags.Ephemeral : MessageFlags.Ephemeral });
  }
  if (command === "executors") { if (i.options.getString("status")) { store.executors = i.options.getString("status"); saveStore(); } return i.reply(`Executor status: ${store.executors}`); }
  if (command === "ticket") {
    const channel = i.options.getChannel("channel") || i.channel;
    if (["ban", "unban"].includes(sub)) {
      const u = i.options.getUser("user"); const k = key(i.guildId, u.id);
      if (sub === "ban") store.bans[k] = { userId: u.id, reason: i.options.getString("reason") || "", by: i.user.id, at: now() };
      else delete store.bans[k]; saveStore();
      return i.reply({ content: sub === "ban" ? `${u.tag} is blocked from opening tickets.` : `${u.tag} can open tickets again.`, flags: MessageFlags.Ephemeral });
    }
    if (sub === "autoreply" || sub === "removeautoreply") {
      const trigger = i.options.getString("trigger").toLowerCase(); const k = i.guildId;
      store.autoReplies[k] ||= {};
      if (sub === "autoreply") store.autoReplies[k][trigger] = i.options.getString("reply"); else delete store.autoReplies[k][trigger];
      saveStore(); return i.reply({ content: sub === "autoreply" ? `Auto-reply saved for “${trigger}”.` : `Auto-reply removed for “${trigger}”.`, flags: MessageFlags.Ephemeral });
    }
    if (!isTicket(channel)) return i.reply({ content: "Run this command inside a ticket channel.", flags: MessageFlags.Ephemeral });
    if (sub === "say") { await channel.send(i.options.getString("message")); ticketLog(channel, "staff message", i.user); return i.reply({ content: "Message sent.", flags: MessageFlags.Ephemeral }); }
    if (sub === "delete") { await i.reply({ content: "Deleting ticket…", flags: MessageFlags.Ephemeral }); ticketLog(channel, "deleted", i.user); return channel.delete(`Deleted by ${i.user.tag}`); }
    if (sub === "close") { await closeTicket(channel, i.user, "Closed by staff command"); return i.reply({ content: "Ticket closed and archived. Use /ticket reopen to reopen it.", flags: MessageFlags.Ephemeral }); }
    if (sub === "reopen") { await reopenTicket(channel, i.user); return i.reply({ content: "Ticket reopened.", flags: MessageFlags.Ephemeral }); }
    if (sub === "rename") { await channel.setName(cleanName(i.options.getString("name"))); ticketLog(channel, "renamed", i.user, channel.name); return i.reply({ content: "Ticket renamed.", flags: MessageFlags.Ephemeral }); }
    const k = ticketKey(channel); store.tickets[k] ||= { channelId: channel.id, guildId: channel.guildId, ownerId: ownerId(channel), events: [], notes: [] };
    if (sub === "note") { store.tickets[k].notes.push({ text: i.options.getString("text"), by: i.user.id, at: now() }); ticketLog(channel, "staff note added", i.user); return i.reply({ content: "Private staff note saved.", flags: MessageFlags.Ephemeral }); }
    if (sub === "history") { const t = store.tickets[k]; const lines = [...(t.events || []).map((e) => `${e.at} — ${e.action} by ${e.actorTag} ${e.extra}`), ...(t.notes || []).map((n) => `${n.at} — NOTE: ${n.text}`)]; return i.reply({ content: lines.slice(-15).join("\n") || "No history recorded.", flags: MessageFlags.Ephemeral }); }
    if (sub === "priority") { store.tickets[k].priority = i.options.getString("level"); ticketLog(channel, "priority changed", i.user, store.tickets[k].priority); saveStore(); return i.reply(`Priority set to **${store.tickets[k].priority}**.`); }
    if (sub === "transfer") { store.tickets[k].department = i.options.getString("department"); ticketLog(channel, "transferred", i.user, store.tickets[k].department); saveStore(); return i.reply(`Ticket transferred to **${store.tickets[k].department}**.`); }
    if (sub === "waiting") { store.tickets[k].status = "waiting"; ticketLog(channel, "waiting for customer", i.user); saveStore(); return i.reply("Ticket marked as waiting for the customer."); }
    if (sub === "claim") { store.tickets[k].claimedBy = i.user.id; ticketLog(channel, "claimed", i.user); saveStore(); return i.reply(`Ticket claimed by ${i.user}.`); }
    if (sub === "unclaim") { delete store.tickets[k].claimedBy; ticketLog(channel, "unclaimed", i.user); saveStore(); return i.reply("Ticket is unclaimed."); }
  }
  if (command === "mod") {
    const u = i.options.getUser("user"); const k = key(i.guildId, u.id);
    if (sub === "blacklist") store.bans[k] = { userId: u.id, reason: i.options.getString("reason") || "", by: i.user.id, at: now() };
    else if (sub === "unblacklist") delete store.bans[k];
    else if (sub === "warn") { store.warnings[k] ||= []; store.warnings[k].push({ reason: i.options.getString("reason"), by: i.user.id, at: now() }); }
    saveStore();
    if (sub === "history") return i.reply({ content: `Blacklist: ${store.bans[k]?.reason || (store.bans[k] ? "Yes" : "No")}\nWarnings: ${(store.warnings[k] || []).map((w) => `${w.at}: ${w.reason}`).join("\n") || "None"}`, flags: MessageFlags.Ephemeral });
    return i.reply({ content: sub === "blacklist" ? `${u.tag} ticket-blacklisted.` : sub === "unblacklist" ? `${u.tag} removed from ticket blacklist.` : `Warning recorded for ${u.tag}.`, flags: MessageFlags.Ephemeral });
  }
  if (command === "bug" || command === "feature") {
    const item = i.options.getString("item"); const map = command === "bug" ? store.bugs : store.features;
    if (sub === "update") { map[key(i.guildId, item.toLowerCase())] = { item, status: i.options.getString("status"), details: i.options.getString("details") || "", by: i.user.id, at: now() }; saveStore(); return i.reply(`${command} **${item}** updated: ${i.options.getString("status")}.`); }
    const record = map[key(i.guildId, item.toLowerCase())]; return i.reply(record ? `**${record.item}** — ${record.status}\n${record.details}` : `No ${command} status found for **${item}**.`);
  }
  if (command === "core") {
    if (sub === "status") { store.status = i.options.getString("status"); saveStore(); return i.reply(`Product status set to: ${store.status}`); }
    if (sub === "component") { const name = i.options.getString("name"); store.components[key(i.guildId, name.toLowerCase())] = { name, status: i.options.getString("status"), at: now() }; saveStore(); return i.reply(`Component **${name}** updated.`); }
    if (sub === "customerflag" || sub === "customnote") { const u = i.options.getUser("user"); const k = key(i.guildId, u.id); if (sub === "customerflag") { store.customerFlags[k] ||= []; store.customerFlags[k].push(i.options.getString("flag")); } else { store.customerNotes[k] ||= []; store.customerNotes[k].push({ text: i.options.getString("note"), by: i.user.id, at: now() }); } saveStore(); return i.reply({ content: `${sub === "customerflag" ? "Customer flag" : "Customer note"} saved for ${u.tag}.`, flags: MessageFlags.Ephemeral }); }
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
  if (eventName === "messageCreate" && args[0]) { onMessage(args[0]).catch((e) => console.error("[AUTOREPLY]", e)); }
  return originalEmit.call(this, eventName, ...args);
};
