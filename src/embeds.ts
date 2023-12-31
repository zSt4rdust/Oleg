import { Colors, EmbedBuilder } from "discord.js";

export function embedError(message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("<:Error:1174557565670133841> error!")
        .setDescription(message);
}

export function embedWarning(message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle(`<:Warning:1174558323949973605> warning!`)
        .setDescription(message);
}

export function embedHelp(title: string, body: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(Colors.LightGrey)
        .setTitle(`**Help:** ${title}`)
        .setDescription(`${body}`);
}

export function embedInfo(title: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle(`<:Info:1174560637746159616> ${title.toLowerCase()}`);
}

export function embedSuccess(title: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(`<:Success:1174559098709229648> ${title.toLowerCase()}`);
}
