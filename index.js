require("dotenv").config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const prefix = "!";
const warnings = new Map();
let loggingEnabled = true;

function isAdmin(member) {
    return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity("Managing Everything ⚡", { type: 3 });
});

// 🎉 Giveaway storage
let giveaways = [];

// 📩 Ticket system
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "create_ticket") {
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: 0,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });
        await channel.send(`🎟️ Ticket created by ${interaction.user}. Type \`!close\` to close.`);
        await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }
});

// 📜 Commands
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // 🔧 Utility
    if (cmd === "ping") return message.reply("🏓 Pong!");
    if (cmd === "help") {
        const embed = new EmbedBuilder()
            .setTitle("📋 Commands List")
            .setDescription("Utility, Moderation, Fun, Logging, Giveaways & Ticket system included!")
            .addFields(
                { name: "🔧 Utility", value: "`ping, help, announce, server, userinfo, botinfo, avatar, say, poll, status, ticketpanel`" },
                { name: "👮 Moderation", value: "`ban, kick, mute, unmute, warn, warnings, clear, lock, unlock, slowmode, nuke`" },
                { name: "🎉 Fun", value: "`meme, joke, 8ball, gif, coinflip, dice`" },
                { name: "🎁 Giveaways", value: "`gstart`" },
                { name: "📈 Logging", value: "`setup-logs, logs, modlogs`" }
            )
            .setColor("Blue");
        return message.channel.send({ embeds: [embed] });
    }
    if (cmd === "announce") {
        if (!isAdmin(message.member)) return;
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply("❌ Mention a channel.");
        const msg = args.slice(1).join(" ");
        channel.send(`📢 ${msg}`);
    }
    if (cmd === "server") {
        const embed = new EmbedBuilder()
            .setTitle("📊 Server Info")
            .addFields(
                { name: "Name", value: message.guild.name },
                { name: "Members", value: `${message.guild.memberCount}` },
                { name: "Created", value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:R>` }
            )
            .setColor("Green");
        return message.channel.send({ embeds: [embed] });
    }
    if (cmd === "userinfo") {
        const user = message.mentions.users.first() || message.author;
        return message.channel.send(`👤 User: ${user.tag}\n🆔 ID: ${user.id}`);
    }
    if (cmd === "botinfo") return message.channel.send(`🤖 I am in ${client.guilds.cache.size} servers with ${client.users.cache.size} users.`);
    if (cmd === "avatar") {
        const user = message.mentions.users.first() || message.author;
        return message.channel.send(user.displayAvatarURL({ size: 512, dynamic: true }));
    }
    if (cmd === "say") return message.channel.send(args.join(" "));
    if (cmd === "poll") {
        const [question, ...opts] = args.join(" ").split(";");
        if (!question || opts.length < 2) return message.reply("❌ Format: `!poll Question; Option1; Option2`");
        const embed = new EmbedBuilder().setTitle(`📊 ${question}`).setColor("Orange");
        let desc = "";
        const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
        opts.forEach((o, i) => desc += `${emojis[i]} ${o}\n`);
        embed.setDescription(desc);
        const pollMsg = await message.channel.send({ embeds: [embed] });
        for (let i = 0; i < opts.length; i++) await pollMsg.react(emojis[i]);
    }
    if (cmd === "status") {
        const uptime = process.uptime();
        return message.channel.send(`📡 Ping: ${client.ws.ping}ms\n⏱ Uptime: ${Math.floor(uptime / 60)}m`);
    }
    if (cmd === "ticketpanel") {
        if (!isAdmin(message.member)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("create_ticket").setLabel("🎫 Create Ticket").setStyle(ButtonStyle.Primary)
        );
        return message.channel.send({ content: "Need help? Click below to create a ticket!", components: [row] });
    }

    // 👮 Moderation
    if (cmd === "ban") {
        if (!isAdmin(message.member)) return;
        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mention a user.");
        user.ban({ reason: args.slice(1).join(" ") || "No reason" });
        return message.channel.send(`🔨 Banned ${user.user.tag}`);
    }
    if (cmd === "kick") {
        if (!isAdmin(message.member)) return;
        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mention a user.");
        user.kick(args.slice(1).join(" ") || "No reason");
        return message.channel.send(`👢 Kicked ${user.user.tag}`);
    }
    if (cmd === "mute") {
        if (!isAdmin(message.member)) return;
        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mention a user.");
        const time = args[1] || "10m";
        const ms = require("ms");
        await user.timeout(ms(time), args.slice(2).join(" ") || "Muted");
        return message.channel.send(`🔇 Muted ${user.user.tag} for ${time}`);
    }
    if (cmd === "unmute") {
        if (!isAdmin(message.member)) return;
        const user = message.mentions.members.first();
        if (!user) return;
        await user.timeout(null);
        return message.channel.send(`🔊 Unmuted ${user.user.tag}`);
    }
    if (cmd === "warn") {
        if (!isAdmin(message.member)) return;
        const user = message.mentions.users.first();
        if (!user) return;
        const reason = args.slice(1).join(" ") || "No reason";
        if (!warnings.has(user.id)) warnings.set(user.id, []);
        warnings.get(user.id).push(reason);
        return message.channel.send(`⚠️ Warned ${user.tag}: ${reason}`);
    }
    if (cmd === "warnings") {
        const user = message.mentions.users.first() || message.author;
        const userWarnings = warnings.get(user.id) || [];
        return message.channel.send(`⚠️ ${user.tag} has ${userWarnings.length} warnings:\n${userWarnings.join("\n")}`);
    }
    if (cmd === "clear") {
        if (!isAdmin(message.member)) return;
        const amount = parseInt(args[0]);
        if (!amount || isNaN(amount) || amount < 1 || amount > 1000) {
            return message.reply("❌ Please provide a number between 1-1000.");
        }
        let deleted = 0;
        let toDelete = amount;
        while (toDelete > 0) {
            const delAmount = toDelete > 100 ? 100 : toDelete;
            const msgs = await message.channel.bulkDelete(delAmount, true);
            deleted += msgs.size;
            toDelete -= delAmount;
            await new Promise(res => setTimeout(res, 1500));
        }
        return message.channel.send(`🧹 Deleted ${deleted} messages.`);
    }
    if (cmd === "lock") {
        if (!isAdmin(message.member)) return;
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        return message.channel.send("🔒 Channel locked.");
    }
    if (cmd === "unlock") {
        if (!isAdmin(message.member)) return;
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
        return message.channel.send("🔓 Channel unlocked.");
    }
    if (cmd === "slowmode") {
        if (!isAdmin(message.member)) return;
        const time = parseInt(args[0]);
        await message.channel.setRateLimitPerUser(time || 0);
        return message.channel.send(`🐌 Slowmode set to ${time || 0}s`);
    }
    if (cmd === "nuke") {
        if (!isAdmin(message.member)) return;
        const pos = message.channel.position;
        const newChannel = await message.channel.clone();
        await message.channel.delete();
        newChannel.setPosition(pos);
        return newChannel.send("💣 Channel nuked!");
    }

    // 🎉 Fun
    if (cmd === "8ball") {
        const replies = ["Yes", "No", "Maybe", "Definitely", "Never"];
        return message.reply(replies[Math.floor(Math.random() * replies.length)]);
    }
    if (cmd === "coinflip") return message.reply(Math.random() > 0.5 ? "🪙 Heads" : "🪙 Tails");
    if (cmd === "dice") return message.reply(`🎲 You rolled a ${Math.floor(Math.random() * 6) + 1}`);
    if (cmd === "joke") return message.reply("😂 Why don’t skeletons fight each other? Because they don’t have the guts!");
    if (cmd === "meme") return message.reply("🤣 Meme feature requires Reddit API integration.");
    if (cmd === "gif") return message.reply("🎬 GIF feature requires Tenor API key.");

    // 🎁 Giveaways
    if (cmd === "gstart") {
        if (!isAdmin(message.member)) return;
        const duration = args[0];
        const winnersCount = parseInt(args[1]);
        const prize = args.slice(2).join(" ");
        if (!duration || !winnersCount || !prize) return message.reply("❌ Format: `!gstart 1m 1 Prize`");
        const ms = require("ms");
        const embed = new EmbedBuilder().setTitle("🎉 Giveaway!").setDescription(`Prize: **${prize}**\nReact with 🎉 to enter!\nEnds in: ${duration}`).setColor("Gold");
        const gwMsg = await message.channel.send({ embeds: [embed] });
        await gwMsg.react("🎉");
        giveaways.push({ msgId: gwMsg.id, prize, winnersCount, end: Date.now() + ms(duration) });

        setTimeout(async () => {
            const fetched = await message.channel.messages.fetch(gwMsg.id);
            const reactions = await fetched.reactions.cache.get("🎉").users.fetch();
            const entries = reactions.filter(u => !u.bot).map(u => u);
            if (entries.length === 0) return message.channel.send("❌ No valid entries.");
            const winners = [];
            for (let i = 0; i < winnersCount; i++) {
                const win = entries[Math.floor(Math.random() * entries.length)];
                if (win && !winners.includes(win)) winners.push(win);
            }
            message.channel.send(`🎉 Congratulations ${winners.map(w => w.toString()).join(", ")}! You won **${prize}**`);
        }, ms(duration));
    }

    // 📈 Logging
    if (cmd === "setup-logs") {
        if (!isAdmin(message.member)) return;
        const ch = await message.guild.channels.create({ name: "mod-logs", type: 0 });
        return message.channel.send(`✅ Logs channel created: ${ch}`);
    }
    if (cmd === "logs") {
        if (!isAdmin(message.member)) return;
        const option = args[0];
        if (option === "on") loggingEnabled = true;
        else if (option === "off") loggingEnabled = false;
        return message.channel.send(`📈 Logs ${loggingEnabled ? "enabled" : "disabled"}.`);
    }
    if (cmd === "modlogs") return message.channel.send("📑 Modlogs feature can be extended with DB.");
});

client.login(process.env.TOKEN);
