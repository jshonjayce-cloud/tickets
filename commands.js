"use strict";

const { SlashCommandBuilder, ChannelType } = require("discord.js");

const commands = [];
const staffCommands = new Set(["setticketpanel", "ticket", "mod", "bug", "feature", "core", "executors"]);

const panel = new SlashCommandBuilder()
  .setName("setticketpanel")
  .setDescription("Post the jayce.EXE support ticket panel")
  .addChannelOption((o) => o.setName("channel").setDescription("Where to post the ticket panel").addChannelTypes(ChannelType.GuildText).setRequired(true));
commands.push(panel);

commands.push(new SlashCommandBuilder().setName("account").setDescription("Show your Discord account details"));
commands.push(new SlashCommandBuilder().setName("stats").setDescription("Show live server statistics"));
commands.push(new SlashCommandBuilder().setName("staff").setDescription("Show support team and ticket statistics"));
commands.push(new SlashCommandBuilder().setName("status").setDescription("Show jayce.EXE support status"));
commands.push(new SlashCommandBuilder().setName("customer").setDescription("Look up a server member")
  .addUserOption((o) => o.setName("user").setDescription("Member to look up").setRequired(true)));

const ticket = new SlashCommandBuilder().setName("ticket").setDescription("Manage support tickets");
ticket.addSubcommand((s) => s.setName("history").setDescription("View ticket activity history").addChannelOption((o) => o.setName("channel").setDescription("Ticket channel (defaults to this channel)")));
ticket.addSubcommand((s) => s.setName("note").setDescription("Add a private staff note to a ticket").addStringOption((o) => o.setName("text").setDescription("Note text").setRequired(true)));
ticket.addSubcommand((s) => s.setName("priority").setDescription("Set ticket priority").addStringOption((o) => o.setName("level").setDescription("Priority level").setRequired(true).addChoices({name:"Low",value:"low"},{name:"Normal",value:"normal"},{name:"High",value:"high"},{name:"Urgent",value:"urgent"})));
ticket.addSubcommand((s) => s.setName("reopen").setDescription("Reopen a closed ticket"));
ticket.addSubcommand((s) => s.setName("close").setDescription("Close/archive this ticket"));
ticket.addSubcommand((s) => s.setName("delete").setDescription("Permanently delete this ticket"));
ticket.addSubcommand((s) => s.setName("transfer").setDescription("Transfer ticket to a department").addStringOption((o) => o.setName("department").setDescription("New department or staff group").setRequired(true)));
ticket.addSubcommand((s) => s.setName("unclaim").setDescription("Remove the staff claim from this ticket"));
ticket.addSubcommand((s) => s.setName("waiting").setDescription("Mark this ticket as waiting for the customer"));
ticket.addSubcommand((s) => s.setName("rename").setDescription("Rename this ticket channel").addStringOption((o) => o.setName("name").setDescription("New channel name").setRequired(true)));
ticket.addSubcommand((s) => s.setName("ban").setDescription("Block a member from opening tickets").addUserOption((o) => o.setName("user").setDescription("Member to block").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("Reason for the block")));
ticket.addSubcommand((s) => s.setName("unban").setDescription("Allow a member to open tickets again").addUserOption((o) => o.setName("user").setDescription("Member to unblock").setRequired(true)));
ticket.addSubcommand((s) => s.setName("say").setDescription("Send a message as the bot in this ticket").addStringOption((o) => o.setName("message").setDescription("Message to send").setRequired(true)));
ticket.addSubcommand((s) => s.setName("autoreply").setDescription("Add or update an automatic ticket reply").addStringOption((o) => o.setName("trigger").setDescription("Text that triggers this reply").setRequired(true)).addStringOption((o) => o.setName("reply").setDescription("Bot response text").setRequired(true)));
ticket.addSubcommand((s) => s.setName("removeautoreply").setDescription("Remove an automatic ticket reply").addStringOption((o) => o.setName("trigger").setDescription("Trigger to remove").setRequired(true)));
ticket.addSubcommand((s) => s.setName("claim").setDescription("Claim this ticket"));
commands.push(ticket);

const mod = new SlashCommandBuilder().setName("mod").setDescription("Moderation and ticket access controls");
mod.addSubcommand((s) => s.setName("blacklist").setDescription("Block a member from tickets").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("Reason")));
mod.addSubcommand((s) => s.setName("unblacklist").setDescription("Remove a ticket blacklist").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)));
mod.addSubcommand((s) => s.setName("history").setDescription("View a member's moderation and ticket history").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)));
mod.addSubcommand((s) => s.setName("warn").setDescription("Record a staff warning").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)).addStringOption((o) => o.setName("reason").setDescription("Warning reason").setRequired(true)));
commands.push(mod);

const bug = new SlashCommandBuilder().setName("bug").setDescription("Track bug reports");
bug.addSubcommand((s) => s.setName("status").setDescription("View a bug status").addStringOption((o) => o.setName("item").setDescription("Bug title or ID").setRequired(true)));
bug.addSubcommand((s) => s.setName("update").setDescription("Create or update a bug status").addStringOption((o) => o.setName("item").setDescription("Bug title or ID").setRequired(true)).addStringOption((o) => o.setName("status").setDescription("Current status").setRequired(true)).addStringOption((o) => o.setName("details").setDescription("Details")));
commands.push(bug);

const feature = new SlashCommandBuilder().setName("feature").setDescription("Track feature requests");
feature.addSubcommand((s) => s.setName("status").setDescription("View a feature status").addStringOption((o) => o.setName("item").setDescription("Feature title or ID").setRequired(true)));
feature.addSubcommand((s) => s.setName("update").setDescription("Create or update feature status").addStringOption((o) => o.setName("item").setDescription("Feature title or ID").setRequired(true)).addStringOption((o) => o.setName("status").setDescription("Current status").setRequired(true)).addStringOption((o) => o.setName("details").setDescription("Details")));
commands.push(feature);

const core = new SlashCommandBuilder().setName("core").setDescription("Manage product and customer support records");
core.addSubcommand((s) => s.setName("analytics").setDescription("View support analytics"));
core.addSubcommand((s) => s.setName("component").setDescription("Set a component status").addStringOption((o) => o.setName("name").setDescription("Component").setRequired(true)).addStringOption((o) => o.setName("status").setDescription("Status").setRequired(true)));
core.addSubcommand((s) => s.setName("customerflag").setDescription("Add a customer flag").addUserOption((o) => o.setName("user").setDescription("Customer").setRequired(true)).addStringOption((o) => o.setName("flag").setDescription("Flag").setRequired(true)));
core.addSubcommand((s) => s.setName("customnote").setDescription("Add a private customer note").addUserOption((o) => o.setName("user").setDescription("Customer").setRequired(true)).addStringOption((o) => o.setName("note").setDescription("Note").setRequired(true)));
core.addSubcommand((s) => s.setName("status").setDescription("Update overall product status").addStringOption((o) => o.setName("status").setDescription("Status").setRequired(true)));
core.addSubcommand((s) => s.setName("customer").setDescription("Look up stored customer notes and flags").addUserOption((o) => o.setName("user").setDescription("Customer").setRequired(true)));
commands.push(core);

const executors = new SlashCommandBuilder()
  .setName("executors")
  .setDescription("View or update executor service status")
  .addSubcommand((s) => s.setName("view").setDescription("Show all executor versions and status")
    .addStringOption((o) => o.setName("filter").setDescription("Filter by updated or outdated").setRequired(false).addChoices({ name: "Updated", value: "updated" }, { name: "Outdated", value: "outdated" })))
  .addSubcommand((s) => s.setName("set").setDescription("Add or update an executor")
    .addStringOption((o) => o.setName("name").setDescription("Executor name").setRequired(true))
    .addStringOption((o) => o.setName("version").setDescription("Executor version").setRequired(true))
    .addStringOption((o) => o.setName("status").setDescription("Executor status").setRequired(true).addChoices({ name: "Updated", value: "updated" }, { name: "Outdated", value: "outdated" })))
  .addSubcommand((s) => s.setName("remove").setDescription("Remove an executor")
    .addStringOption((o) => o.setName("name").setDescription("Executor name").setRequired(true)));
commands.push(executors);

module.exports = { commands: commands.map((command) => command.toJSON()), staffCommands };