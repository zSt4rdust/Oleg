import { Client, GatewayIntentBits, Message } from "discord.js";
import { embedError } from "./embeds.ts";
import config from "../config.json" assert { type: "json" };

import {
    loadConfigs,
    loadReminders,
    processMessageDeletion,
    useReminderCommand,
} from "./reminders.ts";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once("ready", (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    loadReminders(c);
    loadConfigs();
});
client.on("messageCreate", (message) => {
    if (!message.content.startsWith("!") || message.author.bot) return;
    const args = message.content.substring(1).split(" ");

    try {
        defineAndRespond(args, message);
    } catch (error) {
        console.log(error);
        message.reply({ embeds: [embedError(error)] });
    }
});

client.on("messageDelete", (message) => {
    try {
        processMessageDeletion(message);
    } catch (error) {
        message.reply({ embeds: [embedError(error)] });
    }
});

function defineAndRespond(args: string[], origin: Message<boolean>) {
    if (args.length < 1) return;

    switch (args[0]) {
        case "r":
            useReminderCommand(args, origin);
            return;

        default:
            return;
    }
}

client.login(config.token);
