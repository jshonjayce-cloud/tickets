// Adds the ticket panel command and ticket workflow to the Discord client.
const {
  Client,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require("discord.js");

const CATEGORY_ID = "1572392852540100690";
const STAFF_ROLE_ID = "1570780402363400262";
const TICKET_PREFIX = "jayce-ticket:";
const TICKET_TYPES = [
  { name: "Main", value: "main", description: "Open a Main support ticket" },
  { name: "Mobile Main", value: "mobile-main", description: "Open a Mobile Main support ticket" },
  { name: "Key / HWID", value: "key-hwid", description: "Open a Key / HWID support ticket" },
  { name: "Bug Report", value: "bug-report", description: "Open a Bug Report support ticket" }
];

// Inject /jayce setticketpanel <channel> into the existing command payload.
const originalToJSON = SlashCommandBuilder.prototype.toJSON;
SlashCommandBuilder.prototype.toJSON = function (...args) {
  const data = originalToJSON.apply(this, args);
  if (data.name === "jayce" && Array.isArray(data.options) && !data.options.some((option) => option.name === "setticketpanel")) {
    data.options.push({
      type: 1,
      name: "setticketpanel",
      description: "Send the support ticket panel to a selected channel",
      options: [{
        type: 7,
        name: "channel",
        description: "Text channel where the ticket panel should be posted",
        required: true,
        channel_types: [ChannelType.GuildText]
      }]
    });
  }
  return data;
};

function ticketPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Jayce Support Tickets")
    .setDescription("Choose a category below to open a private support ticket. Only you and the support team can see it.");
  const menu = new StringSelectMenuBuilder()
    .setCustomId("jayce_ticket:create")
    .setPlaceholder("Choose a ticket category")
    .addOptions(TICKET_TYPES.map(({ name, value, description }) => ({ label: name, value, description })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function getOwnerId(channel) {
  const match = typeof channel?.topic === "string" && channel.topic.match(/^jayce-ticket:(\d+):[a-z-]+$/);
  return match ? match[1] : null;
}

function isStaff(interaction) {
  return Boolean(interaction.member?.roles?.cache?.has(STAFF_ROLE_ID));
}

async function handleTicketInteraction(interaction) {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) return false;

  if (interaction.isChatInputCommand() && interaction.commandName === "jayce" && interaction.options.getSubcommand(false) === "setticketpanel") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!isStaff(interaction)) {
      await interaction.reply({ content: "You need the support staff role to post the ticket panel.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const panelChannel = interaction.options.getChannel("channel");
    if (!panelChannel || panelChannel.type !== ChannelType.GuildText || typeof panelChannel.send !== "function") {
      await interaction.reply({ content: "Please select a regular text channel.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await panelChannel.send(ticketPanelPayload());
    await interaction.reply({ content: `Ticket panel sent to ${panelChannel}.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "jayce_ticket:create") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "Tickets can only be opened in the server.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const type = TICKET_TYPES.find((entry) => entry.value === interaction.values[0]);
    if (!type) {
      await interaction.reply({ content: "Unknown ticket category.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const guild = interaction.guild;
    const category = await guild.channels.fetch(CATEGORY_ID).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) {
      await interaction.reply({ content: "The configured ticket category was not found. Please contact staff.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const staffRole = await guild.roles.fetch(STAFF_ROLE_ID).catch(() => null);
    if (!staffRole) {
      await interaction.reply({ content: "The configured support role was not found. Please contact staff.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const channels = await guild.channels.fetch();
    const existing = channels.find((channel) => channel.parentId === CATEGORY_ID && getOwnerId(channel) === interaction.user.id);
    if (existing) {
      await interaction.reply({ content: `You already have an open ticket: ${existing}.`, flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const safeName = interaction.user.username.toLowerCase()
      .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "member";
    const botUser = interaction.client.user;
    const channel = await guild.channels.create({
      name: `ticket-${safeName}`.slice(0, 90),
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      topic: `${TICKET_PREFIX}${interaction.user.id}:${type.value}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
        { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: botUser.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] }
      ],
      reason: `Support ticket opened by ${interaction.user.tag} (${type.name})`
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("jayce_ticket:close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger)
    );
    await channel.send({
      content: `${interaction.user} <@&${STAFF_ROLE_ID}>`,
      embeds: [new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${type.name} Support Ticket`)
        .setDescription(`Hi ${interaction.user}! Please describe what you need help with. Support staff will be with you soon.`)
        .addFields({ name: "Opened by", value: interaction.user.tag, inline: true })
        .setTimestamp()],
      components: [closeRow],
      allowedMentions: { users: [interaction.user.id], roles: [STAFF_ROLE_ID] }
    });
    await interaction.editReply({ content: `Your private ticket has been created: ${channel}.` });
    return true;
  }

  if (interaction.isButton() && interaction.customId === "jayce_ticket:close") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This button only works in a server.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const ownerId = getOwnerId(interaction.channel);
    if (!ownerId) {
      await interaction.reply({ content: "This channel is not a recognized ticket.", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (interaction.user.id !== ownerId && !isStaff(interaction)) {
      await interaction.reply({ content: "Only the ticket creator or support staff can close this ticket.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.reply({ content: "Closing this ticket…", flags: MessageFlags.Ephemeral });
    await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`);
    return true;
  }
  return false;
}

// Intercept ticket interactions so the existing command handler cannot double-respond.
const originalEmit = Client.prototype.emit;
Client.prototype.emit = function (eventName, ...args) {
  if (eventName === "interactionCreate" && args[0]) {
    const interaction = args[0];
    const isTicketPanelCommand = interaction.isChatInputCommand?.() &&
      interaction.commandName === "jayce" && interaction.options.getSubcommand(false) === "setticketpanel";
    const isTicketComponent = (interaction.isStringSelectMenu?.() && interaction.customId === "jayce_ticket:create") ||
      (interaction.isButton?.() && interaction.customId === "jayce_ticket:close");
    if (isTicketPanelCommand || isTicketComponent) {
      handleTicketInteraction(interaction).catch(async (error) => {
        console.error("[TICKETS] Interaction failed:", error);
        try {
          const payload = { content: "Ticket action failed. Please contact support staff.", flags: MessageFlags.Ephemeral };
          if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
          else await interaction.reply(payload);
        } catch (_) {}
      });
      return true;
    }
  }
  return originalEmit.call(this, eventName, ...args);
};
