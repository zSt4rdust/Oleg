import {
    AttachmentPayload,
    Client,
    EmbedBuilder,
    Message,
    PartialMessage,
    TextChannel,
    time,
    User,
} from "discord.js";
import { embedHelp, embedInfo, embedSuccess, embedWarning } from "./embeds.ts";
import {
    dateExpression,
    durationalExpression,
    formatDate,
    hhmmExpression,
    offsetToTimezone,
    timeExpression,
    timezoneToOffset,
    truncate,
} from "./utils.ts";
import { exists } from "https://deno.land/std@0.206.0/fs/mod.ts";
//import { parseExpression } from "npm:cron-parser";

class Reminder {
    readonly id: number;
    readonly origin: Message<boolean>;

    date: Date;
    message: string;
    attachments: string[];

    constructor(
        id: number,
        origin: Message<boolean>,
        date: Date,
        message: string,
        attachments: string[],
    ) {
        this.id = id;
        this.origin = origin;
        this.date = date;
        this.message = message;
        this.attachments = attachments;
    }

    export() {
        return {
            id: this.id,
            origin: {
                messageId: this.origin.id,
                channelId: this.origin.channel.id,
                guildId: this.origin.guildId,
            },
            date: this.date.getTime(),
            message: this.message,
            attachments: this.attachments,
        } as ReminderJSON;
    }
}

interface ReminderJSON {
    id: number;
    origin: {
        messageId: string;
        channelId: string;
        guildId: string;
    };
    date: number;
    message: string;
    attachments: string[];
}

interface Config {
    server: boolean;
    id: string;
    timezone: number;
}

const truncationLength = 75;

const remindersPath = "./saved/reminders.json";
const configsPath = "./saved/configs.json";

let reminders = [] as Reminder[];
let configs = [] as Config[];

const help = await Deno.readTextFile("./help/reminders/help");

const helpHelp = await Deno.readTextFile("./help/reminders/helpHelp");
const helpNew = await Deno.readTextFile("./help/reminders/helpNew");
const helpDel = await Deno.readTextFile("./help/reminders/helpDel");
const helpEdit = await Deno.readTextFile("./help/reminders/helpEdit");
const helpList = await Deno.readTextFile("./help/reminders/helpList");
const helpConfig = await Deno.readTextFile("./help/reminders/helpConfig");

setInterval(() => {
    const currentDate = new Date().getTime();
    for (const reminder of reminders) {
        if (currentDate >= reminder.date.getTime()) {
            reminder.origin.reply({
                content: reminder.message,
                files: reminder.attachments.map((value) => ({
                    attachment: value,
                } as AttachmentPayload)),
            });
            removeReminder(reminder);
        }
    }
}, 1000 * 5);

export function processMessageDeletion(
    message: Message<boolean> | PartialMessage,
) {
    const reminder = reminders.find((value) => value.origin.id == message.id);
    if (reminder == undefined) return;

    removeReminder(reminder);
    const embed = embedWarning(
        `reminder by ${message.author} with id **${reminder.id}** was automatically deleted because someone deleted it's origin`,
    );
    message.channel.send({ embeds: [embed] });
}

export function useReminderCommand(args: string[], origin: Message<boolean>) {
    if (args.length == 0) throw "args is empty";
    if (args[0] != "r") throw "command cannot be a reminder command";

    if (args.length == 1) {
        provideOverallHelp(origin);
    } else {
        switch (args[1]) {
            case "help":
                reminderHelp(args, origin);
                break;
            case "new":
                reminderNew(args, origin);
                break;
            case "edit":
                reminderEdit(args, origin);
                break;
            case "del":
                reminderDelete(args, origin);
                break;
            case "list":
                reminderList(args, origin);
                break;
            case "config":
                reminderConfig(args, origin);
                break;
            default:
                provideOverallHelp(origin);
                break;
        }
    }
}

function provideOverallHelp(origin: Message<boolean>) {
    origin.reply({ embeds: [embedHelp("reminders", help)] });
}

function reminderHelp(args: string[], origin: Message<boolean>) {
    if (args.length > 3) {
        throw "invalid arguments, use *!r help help* if you don't know how to get help for commands";
    }

    if (args.length == 2) {
        provideOverallHelp(origin);
    } else {
        switch (args[2]) {
            case "help":
                origin.reply({ embeds: [embedHelp('"help"', helpHelp)] });
                break;
            case "new":
                origin.reply({ embeds: [embedHelp('"new"', helpNew)] });
                break;
            case "del":
                origin.reply({ embeds: [embedHelp('"del"', helpDel)] });
                break;
            case "edit":
                origin.reply({ embeds: [embedHelp('"edit"', helpEdit)] });
                break;
            case "list":
                origin.reply({ embeds: [embedHelp('"list"', helpList)] });
                break;
            case "config":
                origin.reply({ embeds: [embedHelp('"config"', helpConfig)] });
                break;
            default:
                throw `command *${args[2]}* does not exists`;
        }
    }
}

function reminderNew(args: string[], origin: Message<boolean>) {
    if (args.length < 3) {
        throw "invalid arguments, use *!r help new* if you don't know how to create reminders";
    }

    if (getOwnedReminders(origin.author).length >= 15) {
        throw "you've reached your reminder limit";
    }

    const message = args.length > 3 ? args.toSpliced(0, 3).join(" ") : "remind";
    const tuple = parseTime(args[2], origin);
    const reminderDate = tuple[0];
    const warnEmbed = tuple[1];

    const reminder = new Reminder(
        generateId(origin.author),
        origin,
        reminderDate,
        message,
        origin.attachments.map((value) => value.url),
    );
    addReminder(reminder);

    const embed = embedSuccess("Reminder created").setDescription(
        `
**#${reminder.id}.** ${formatDate(reminder.date)}
${getReminderInfo(reminder)}`,
    );

    if (warnEmbed != null) origin.reply({ embeds: [embed, warnEmbed] });
    else origin.reply({ embeds: [embed] });
}

function reminderEdit(args: string[], origin: Message<boolean>) {
    if (args.length < 4) {
        throw "invalid arguments, use *!r help edit* if you don't know how to edit reminders";
    }

    const reminders = getOwnedRemindersById(origin.author, args[2]);
    if (args[3] == "time") {
        if (args.length != 5) {
            throw "invalid arguments, use *!r help edit* if you don't know how to edit reminders";
        }

        const tuple = parseTime(args[4], origin);
        const reminderDate = tuple[0];
        const warnEmbed = tuple[1];

        const embed = embedSuccess(
            reminders.length == 1
                ? "Changed reminder date"
                : "Changed reminders date",
        );

        for (const reminder of reminders) {
            const temp = reminder.date;
            editReminder(reminder, undefined, reminderDate);

            embed.addFields({
                name: `**#${reminder.id}.**`,
                value: `from: ${time(temp)}\nto: ${time(reminderDate)}`,
            });
        }

        if (warnEmbed != null) origin.reply({ embeds: [embed, warnEmbed] });
        else origin.reply({ embeds: [embed] });
    } else if (args[3] == "message") {
        const newMessage = args.toSpliced(0, 4).join(" ");

        const embed = embedSuccess(
            reminders.length == 1
                ? "Changed reminder message"
                : "Changed reminders message",
        );

        for (const reminder of reminders) {
            const temp = reminder.message;
            editReminder(reminder, newMessage);

            embed.addFields({
                name: `**#${reminder.id}.**`,
                value: `from: "${truncate(temp, truncationLength)}"\nto: "${
                    truncate(newMessage, truncationLength)
                }"`,
            });
        }

        origin.reply({ embeds: [embed] });
    } else if (args[3] == "attachments") {
        if (args.length != 4) {
            throw "invalid arguments, use *!r help edit* if you don't know how to edit reminders";
        }

        const embed = embedSuccess(
            reminders.length == 1
                ? "Changed reminder attachments"
                : "Changed reminders attachments",
        );

        for (const reminder of reminders) {
            const temp = reminder.attachments;
            const newAttachments = origin.attachments.map((value) => value.url);
            if (newAttachments.length == 0 && temp.length == 0) {
                throw "nothing has changed";
            }

            editReminder(reminder, undefined, undefined, newAttachments);

            embed.addFields({
                name: `**#${reminder.id}.**`,
                value: temp.length == 0
                    ? getAttachmentsInfo(newAttachments)
                    : `from: ${getAttachmentsInfo(temp)}\nto: ${
                        getAttachmentsInfo(newAttachments)
                    }`,
            });
        }

        origin.reply({ embeds: [embed] });
    } else {throw `invalid option *${
            args[3]
        }*, write *!r help edit* if you want to know valid options`;}
}

function reminderDelete(args: string[], origin: Message<boolean>) {
    if (args.length != 3) {
        throw "invalid arguments, use *!r help delete* if you don't know how to delete reminders";
    }

    const reminders = getOwnedRemindersById(origin.author, args[2]);
    const embed = embedSuccess(
        reminders.length == 1 ? "Reminder deleted" : "Reminders deleted",
    );

    for (const reminder of reminders) {
        embed.addFields({
            name: `**#${reminder.id}**. ${time(reminder.date)}`,
            value: `${getReminderInfo(reminder)}`,
        });
        removeReminder(reminder);
    }

    origin.reply({ embeds: [embed] });
}

function reminderList(args: string[], origin: Message<boolean>) {
    if (args.length > 3) {
        throw "invalid arguments, use *!r help list* if you don't know how to get reminders list";
    }

    const user = args.length == 3
        ? origin.mentions.users.at(0)!
        : origin.author;

    if (user == undefined) {
        throw "invalid user for this guild";
    }

    const owned = getOwnedReminders(user);
    if (owned.length == 0) throw `user ${user} don't have any reminders`;

    const embed = embedInfo(`${user.displayName}'s reminders`);
    for (const reminder of owned) {
        embed.addFields({
            name: `**#${reminder.id}**. ${formatDate(reminder.date)}`,
            value: `${getReminderInfo(reminder)}`,
        });
    }

    origin.reply({ embeds: [embed] });
}

function reminderConfig(args: string[], origin: Message<boolean>) {
    if (args.length <= 3) {
        if (args.length == 3 && args[2] == "--server") {
            const configIdx = configs.findIndex((value) =>
                value.server && value.id == origin.guildId
            );

            if (configIdx != -1) {
                replyConfigEmbed(configIdx, true, origin);
            } else throw `server doesn't have it's own config`;
        } else {
            const user = args.length == 3
                ? origin.mentions.users.at(0)!
                : origin.author;

            if (user == undefined) {
                throw "invalid user for this guild";
            }

            const configIdx = configs.findIndex((value) =>
                !value.server && value.id == user.id
            );

            if (configIdx != -1) {
                replyConfigEmbed(configIdx, false, origin);
            } else throw `user ${user} doesn't have his own config`;
        }
    } else if (args.length >= 4 && args.length <= 5) {
        let server = false;
        if (args.length == 5) {
            if (args[4] == "--server") server = true;
            else throw `invalid argument *${args[4]}*`;
        }

        if (server && !origin.member?.permissions.has("Administrator")) {
            throw "you can't configure the server unless you are an administrator";
        }

        switch (args[2]) {
            case "timezone":
                configTimezone(args[3], server, origin);
                break;
            default:
                throw "invalid option, valid options:\n*timezone*";
        }

        saveConfigs();
    } else {
        throw "invalid arguments, use *!r help config* if you don't know how to config reminders";
    }
}

function replyConfigEmbed(
    configIdx: number,
    server: boolean,
    origin: Message<boolean>,
) {
    const config = configs[configIdx];

    const embed = embedInfo(
        `${
            server
                ? origin.guild?.name
                : origin.guild?.members.cache.get(config.id)?.user.displayName
        }'s config`,
    ).addFields({
        name: "timezone",
        value: offsetToTimezone(config.timezone),
    });

    origin.reply({ embeds: [embed] });
}

function configTimezone(
    value: string,
    server: boolean,
    origin: Message<boolean>,
) {
    const time = timezoneToOffset(value);

    if (server) {
        const configIdx = configs.findIndex((value) =>
            value.server && value.id == origin.guildId
        );

        const embed = embedSuccess("Server timezone configured");
        if (configIdx != -1) {
            const temp = configs[configIdx].timezone;
            configs[configIdx].timezone = time;

            embed.setDescription(
                `from: ${offsetToTimezone(temp)}\nto: ${
                    offsetToTimezone(time)
                }`,
            );
            origin.reply({ embeds: [embed] });
        } else {
            configs.push({
                server: true,
                id: origin.guildId!,
                timezone: time,
            });

            embed.setDescription(`timezone: ${offsetToTimezone(time)}`);
            origin.reply({ embeds: [embed] });
        }
    } else {
        const configIdx = configs.findIndex((value) =>
            !value.server && value.id == origin.author.id
        );

        const embed = embedSuccess("User timezone configured");
        if (configIdx != -1) {
            const temp = configs[configIdx].timezone;
            configs[configIdx].timezone = time;

            embed.setDescription(
                `from: ${offsetToTimezone(temp)}\nto: ${
                    offsetToTimezone(time)
                }`,
            );
            origin.reply({ embeds: [embed] });
        } else {
            configs.push({
                server: false,
                id: origin.author.id,
                timezone: time,
            });

            embed.setDescription(`timezone: ${offsetToTimezone(time)}`);
            origin.reply({ embeds: [embed] });
        }
    }
}

function getOwnedReminders(user: User): Reminder[] {
    return reminders.filter((reminder) => reminder.origin.author.id == user.id);
}

function getOwnedRemindersById(owner: User, strId: string): Reminder[] {
    const owned = getOwnedReminders(owner);
    if (owned.length == 0) throw "you don't have any reminders";

    const id = parseInt(strId);
    if (id < 0) throw "id cant be negative";

    if (Number.isInteger(id)) {
        const reminderIdx = owned.findIndex((value) => value.id == id);
        if (reminderIdx == -1) {
            throw `you don't have a reminder with **${id}** id`;
        }

        return [owned[reminderIdx]];
    } else {
        switch (strId) {
            case "last":
                return [owned[owned.length - 1]];

            case "first":
                return [owned[0]];

            case "all":
                return owned;

            default:
                throw "id is not an integer or keyword";
        }
    }
}

function generateId(user: User) {
    const owned = getOwnedReminders(user);
    let temp = 0;

    for (const reminder of owned) {
        if (temp == reminder.id) temp++;
    }

    return temp;
}

function addReminder(reminder: Reminder) {
    reminders.push(reminder);
    saveReminders();
}

function removeReminder(reminder: Reminder) {
    const idx = reminders.indexOf(reminder);
    if (idx == -1) throw "reminders array doesn't contain given reminder";

    reminders.splice(idx, 1);
    saveReminders();
}

function editReminder(
    reminder: Reminder,
    newMessage?: string,
    newDate?: Date,
    newAttachments?: string[],
) {
    if (newMessage != undefined) reminder.message = newMessage;
    if (newDate != undefined) reminder.date = newDate;
    if (newAttachments != undefined) reminder.attachments = newAttachments;

    saveReminders();
}

function parseTime(
    input: string,
    origin: Message<boolean>,
): [Date, EmbedBuilder | null] {
    let date: Date;
    let embed: EmbedBuilder | null = null;

    if (input.includes("-")) {
        const tuple = getOffset(origin);
        const offset = tuple[0];
        embed = tuple[1];

        date = timeExpression(input, offset);
    } else if (input.includes(":")) {
        const tuple = getOffset(origin);
        const offset = tuple[0];
        embed = tuple[1];

        date = hhmmExpression(input, offset);
    } else if (input.includes(".")) {
        const tuple = getOffset(origin);
        const offset = tuple[0];
        embed = tuple[1];

        date = dateExpression(input, offset);
    } else {
        date = durationalExpression(input);
    }

    return [date, embed];
}

function getOffset(
    origin: Message<boolean>,
): [number, EmbedBuilder | null] {
    let embed: EmbedBuilder | null = null;
    let offset = 0;

    const userConfig = configs.find((value) => value.id == origin.author.id);
    if (userConfig != undefined) {
        offset = userConfig.timezone;
    } else {
        const serverConfig = configs.find((value) =>
            value.id == origin.guildId
        );
        if (serverConfig != undefined) {
            offset = serverConfig.timezone;
            embed = embedWarning(
                `you haven't configured your timezone, so the server timezone (${
                    offsetToTimezone(serverConfig.timezone)
                }) will be used`,
            );
        } else {
            embed = embedWarning(
                `you and server don't have a configured timezone, so the ${
                    offsetToTimezone(0)
                } timezone will be used`,
            );
        }
    }

    return [offset, embed];
}

function getReminderInfo(reminder: Reminder): string {
    const attachmentsCount = reminder.attachments.length;
    return `"${truncate(reminder.message, truncationLength)}"` +
        (attachmentsCount > 0
            ? `\n${getAttachmentsInfo(reminder.attachments)}`
            : "");
}

function getAttachmentsInfo(attachments: string[]): string {
    return `*${attachments.length} ${
        attachments.length == 1 ? "attachment" : "attachments"
    }*`;
}

async function saveReminders() {
    const remindersJson = JSON.stringify(
        reminders.map((r) => r.export()),
        undefined,
        4,
    );

    await Deno.writeTextFile(
        remindersPath,
        remindersJson,
    );
}

export async function loadReminders(client: Client<true>) {
    if (!await exists(remindersPath)) {
        Deno.writeTextFile(remindersPath, "[]");
        return;
    }

    reminders = await Promise.all(
        (JSON.parse(await Deno.readTextFile(remindersPath)) as ReminderJSON[])
            .map(async (value) => {
                const channel = await client.channels.fetch(
                    value.origin.channelId,
                ) as TextChannel;

                const origin = await channel.messages.fetch(
                    value.origin.messageId,
                );

                return new Reminder(
                    value.id,
                    origin,
                    new Date(value.date),
                    value.message,
                    value.attachments,
                );
            }),
    );
}

async function saveConfigs() {
    const configsJson = JSON.stringify(
        configs,
        undefined,
        4,
    );

    await Deno.writeTextFile(
        configsPath,
        configsJson,
    );
}

export async function loadConfigs() {
    if (!await exists(configsPath)) {
        Deno.writeTextFile(configsPath, "[]");
        return;
    }

    configs = JSON.parse(await Deno.readTextFile(configsPath)) as Config[];
}
