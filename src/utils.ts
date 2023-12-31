import { time } from "discord.js";

const daysInMonths: Map<number, number> = new Map([
    [1, 31],
    [3, 31],
    [4, 30],
    [5, 31],
    [6, 30],
    [7, 31],
    [8, 31],
    [9, 30],
    [10, 31],
    [11, 30],
    [12, 31],
]);

export function durationalExpression(input: string): Date {
    let output = 0;
    let lastNumber = "";

    function parseNum(input: string, marker: string): number {
        const parsed = parseInt(input);
        if (parsed == 0) {
            throw `${marker} cant be zero`;
        }

        return parsed;
    }

    for (const char of input) {
        if (isInteger(char)) lastNumber += char;
        else if (lastNumber == "") {
            throw "found time marker when number is empty";
        } else {
            switch (char) {
                case "m": {
                    output += parseNum(lastNumber, "minutes");
                    lastNumber = "";
                    break;
                }
                case "h": {
                    output += parseNum(lastNumber, "hours") * 60;
                    lastNumber = "";
                    break;
                }
                case "d": {
                    output += parseNum(lastNumber, "days") * 60 * 24;
                    lastNumber = "";
                    break;
                }
                case "y": {
                    output += parseNum(lastNumber, "years") * 60 * 24 * 365;
                    lastNumber = "";
                    break;
                }

                default:
                    throw "found invalid time marker";
            }
        }
    }

    if (lastNumber != "") {
        throw "expected time marker at the end";
    }

    if (output > 10000 * 1440 * 365) throw "number is too large";

    return new Date(
        Date.now() + output * 60000,
    );
}

export function hhmmExpression(input: string, p_offset: number): Date {
    const hhmm = String(input).match(/^(?<hours>\d+):(?<minutes>\d+)$/);

    const nowLocal = getLocal(p_offset);
    if (hhmm != null) {
        const hours = parseInt(hhmm.groups!.hours, 10);
        if (hours > 23 || hours < 0) {
            throw "hours must be in range 0-23";
        }

        if (hhmm.groups!.minutes.length != 2) {
            throw "minutes must be 2 digits long";
        }

        const minutes = parseInt(hhmm.groups!.minutes, 10);
        if (minutes > 59 || minutes < 0) {
            throw "hours must be in range 0-59";
        }

        let output = new Date(
            nowLocal.getFullYear(),
            nowLocal.getMonth(),
            nowLocal.getDate(),
            hours,
            minutes,
        );

        if (nowLocal.getHours() > hours) {
            output = new Date(output.getTime() + 24 * 3600 * 1000);
        }

        const backOffset = -output.getTimezoneOffset() - p_offset;
        return offset(output, backOffset);
    } else throw "invalid expression";
}

export function dateExpression(input: string, p_offset: number): Date {
    const date = String(input).match(
        /^(?<day>\d+).(?<month>\d+).(?<year>\d+)$/,
    );

    const nowLocal = getLocal(p_offset);
    if (date != null) {
        const output = parseDate(
            date.groups!.day,
            date.groups!.month,
            date.groups!.year,
            p_offset,
        );

        if (output.getTime() < nowLocal.getTime()) {
            throw "specified date in the past";
        }

        return output;
    } else throw "invalid expression";
}

export function timeExpression(input: string, p_offset: number): Date {
    const time = String(input).match(
        /^(?<day>\d+).(?<month>\d+).(?<year>\d+)-(?<hours>\d+):(?<minutes>\d+)$/,
    );

    if (time != null) {
        const date = parseDate(
            time.groups!.day,
            time.groups!.month,
            time.groups!.year,
            p_offset,
        );

        const hours = parseInt(time.groups!.hours, 10);
        if (hours > 23 || hours < 0) {
            throw "hours must be in range 0-23";
        }

        if (time.groups!.minutes.length != 2) {
            throw "minutes must be 2 digits long";
        }

        const minutes = parseInt(time.groups!.minutes, 10);
        if (minutes > 59 || minutes < 0) {
            throw "hours must be in range 0-59";
        }

        const output = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours() + hours,
            date.getMinutes() + minutes,
        );

        return output;
    } else throw "invalid expression";
}

export function parseDate(
    day: string,
    month: string,
    year: string,
    p_offset: number,
): Date {
    if (day.length > 2) {
        throw "day cant be more than 2 digits long";
    }

    if (month.length > 2) {
        throw "month cant be more than 2 digits long";
    }

    const dayNum = parseInt(day, 10);
    if (dayNum < 0) {
        throw "day cant be negative";
    }

    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
        throw "month must be in range 1-12";
    }

    const yearNum = parseInt(year, 10);
    if (yearNum < 0) {
        throw "year cant be negative";
    } else if (yearNum >= 10000) {
        throw "year is too big";
    }

    if (monthNum == 2) {
        if (yearNum % 4 == 0 || (yearNum % 100 == 0 && yearNum % 400 == 0)) {
            if (dayNum < 1 || dayNum > 29) {
                throw "leap day must be in range 1-29";
            }
        } else if (dayNum < 1 || dayNum > 28) {
            throw "day must be in range 1-28";
        }
    } else {
        const daysInMonth = daysInMonths.get(monthNum);
        if (dayNum < 1 || dayNum > daysInMonth!) {
            throw `day must be in range 1-${daysInMonth}`;
        }
    }

    const output = new Date(
        yearNum,
        monthNum - 1,
        dayNum,
    );

    const backOffset = -output.getTimezoneOffset() - p_offset;
    return offset(output, backOffset);
}

export function timezoneToOffset(input: string): number {
    const negative = input.startsWith("-");
    if (!negative && !input.startsWith("+")) {
        throw "expected **-** or **+**";
    }
    const expr = input.substring(1, input.length);
    const parsed = String(expr).match(/^(?<hours>\d+):(?<minutes>\d+)$/);

    if (parsed != null) {
        const hours = parseInt(parsed.groups!.hours, 10);
        if (hours > 12 || hours < 0) {
            throw "hours must be in range 0-12";
        }

        if (parsed.groups!.minutes.length != 2) {
            throw "minutes must be 2 digits long";
        }

        const minutes = parseInt(parsed.groups!.minutes, 10);
        if (hours < 12 && (minutes > 59 || minutes < 0)) {
            throw "minutes must be in range 0-59";
        } else if (hours == 12 && minutes != 0) {
            throw "minutes must be 00";
        }

        const offset = hours * 60 + minutes;
        return negative ? -offset : offset;
    } else throw "invalid expression";
}

export function offsetToTimezone(input: number): string {
    let output = input < 0 ? "-" : "+";

    const absInput = Math.abs(input);
    const minutes = absInput % 60;
    const hours = (absInput - minutes) / 60;

    const strMinutes = minutes < 10 ? `0${minutes}` : minutes.toString();
    output += `${hours}:${strMinutes}`;

    return output;
}

export function getLocal(p_offset: number): Date {
    const now = new Date();
    const utc = new Date(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
    );

    return offset(utc, p_offset);
}

export function offset(date: Date, offset: number): Date {
    return new Date(date.getTime() + offset * 60 * 1000);
}

export function formatDate(date: Date): string {
    return `${time(date)} (${time(date, "R")})`;
}

export function isInteger(input: string) {
    return /^[0-9]$/.test(input);
}

export function truncate(input: string, length: number): string {
    if (input.length <= 100) return input;

    return input.slice(0, length) + "...";
}
