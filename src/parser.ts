import chrono, { Chrono } from "chrono-node";

import { moment } from "obsidian";

import { DayOfWeek } from "./settings";
import {
  ORDINAL_NUMBER_PATTERN,
  getLastDayOfMonth,
  getLocaleWeekStart,
  getWeekNumber,
  parseOrdinalNumberPattern,
} from "./utils";

export interface NLDResult {
  formattedString: string;
  date: Date;
  moment: moment.Moment;
}

function getLocalizedChrono(): Chrono {
  const locale = window.moment.locale();

  switch (locale) {
    case "en-gb":
      return new Chrono(chrono.en.createCasualConfiguration(true));
    default:
      return new Chrono(chrono.en.createCasualConfiguration(false));
  }
}

function getConfiguredChrono(): Chrono {
  const localizedChrono = getLocalizedChrono();
  localizedChrono.parsers.push({
    pattern: () => {
      return /\bChristmas\b/i;
    },
    extract: () => {
      return {
        day: 25,
        month: 12,
      };
    },
  });

  localizedChrono.parsers.push({
    pattern: () => new RegExp(ORDINAL_NUMBER_PATTERN),
    extract: (_context, match) => {
      return {
        day: parseOrdinalNumberPattern(match[0]),
        month: window.moment().month(),
      };
    },
  });
  return localizedChrono;
}

export default class NLDParser {
  chrono: Chrono;

  constructor() {
    this.chrono = getConfiguredChrono();
  }

  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    const parser = this.chrono;
    const initialParse = parser.parse(selectedText);
    const weekdayIsCertain = initialParse[0]?.start.isCertain("weekday");

    const weekStart =
      weekStartPreference === "locale-default"
        ? getLocaleWeekStart()
        : weekStartPreference;

    const locale = {
      weekStart: getWeekNumber(weekStart),
    };

    const thisDateMatch = selectedText.match(/this\s([\w]+)/i);
    const nextDateMatch = selectedText.match(/next\s([\w]+)/i);
    const lastDayOfMatch = selectedText.match(/(last day of|end of)\s*([^\n\r]*)/i);
    const midOf = selectedText.match(/mid\s([\w]+)/i);

    const referenceDate = weekdayIsCertain
      ? window.moment().weekday(0).toDate()
      : new Date();

    if (thisDateMatch && thisDateMatch[1] === "week") {
      return parser.parseDate(`this ${String(weekStart)}`, referenceDate) ?? referenceDate;
    }

    if (nextDateMatch && nextDateMatch[1] === "week") {
      return parser.parseDate(`next ${String(weekStart)}`, referenceDate, {
        forwardDate: true,
      }) ?? referenceDate;
    }

    if (nextDateMatch && nextDateMatch[1] === "month") {
      const thisMonth = parser.parseDate("this month", new Date(), {
        forwardDate: true,
      }) ?? new Date();
      return parser.parseDate(selectedText, thisMonth, {
        forwardDate: true,
      }) ?? thisMonth;
    }

    if (nextDateMatch && nextDateMatch[1] === "year") {
      const thisYear = parser.parseDate("this year", new Date(), {
        forwardDate: true,
      }) ?? new Date();
      return parser.parseDate(selectedText, thisYear, {
        forwardDate: true,
      }) ?? thisYear;
    }

    if (lastDayOfMatch && lastDayOfMatch[2]) {
      const tempDate = parser.parse(lastDayOfMatch[2]);
      const parsedResult = tempDate[0];
      if (!parsedResult) {
        return parser.parseDate(selectedText, referenceDate, { locale }) ?? referenceDate;
      }
      const year = parsedResult.start.get("year");
      const month = parsedResult.start.get("month");
      if (year === null || month === null) {
        return parser.parseDate(selectedText, referenceDate, { locale }) ?? referenceDate;
      }
      const lastDay = getLastDayOfMonth(year, month);

      return parser.parseDate(`${year}-${month}-${lastDay}`, new Date(), {
        forwardDate: true,
      }) ?? referenceDate;
    }

    if (midOf) {
      return parser.parseDate(`${midOf[1]} 15th`, new Date(), {
        forwardDate: true,
      }) ?? new Date();
    }

    return parser.parseDate(selectedText, referenceDate, { locale }) ?? referenceDate;
  }
}
