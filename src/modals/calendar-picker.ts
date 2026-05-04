import { App, Modal } from "obsidian";
import type NaturalLanguageDates from "../main";
import { getWeekNumber } from "../utils";

type CalendarView = "day" | "month";

export default class CalendarPickerModal extends Modal {
  private plugin: NaturalLanguageDates;
  private viewDate: Date;
  private selectedDate: Date | null = null;
  private currentView: CalendarView = "day";
  private onSelect: (date: Date) => void;

  constructor(app: App, plugin: NaturalLanguageDates, onSelect: (date: Date) => void) {
    super(app);
    this.plugin = plugin;
    this.viewDate = new Date();
    this.onSelect = onSelect;
  }

  onOpen(): void {
    this.modalEl.addClass("nld-calendar-modal");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private getWeekStartOffset(): number {
    const { weekStart } = this.plugin.settings;
    if (weekStart === "locale-default") {
      // @ts-ignore
      return window.moment.localeData()._week.dow;
    }
    return getWeekNumber(weekStart);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private render(): void {
    this.contentEl.empty();
    if (this.currentView === "day") {
      this.renderDayView();
    } else {
      this.renderMonthView();
    }
  }

  private renderDayView(): void {
    const today = new Date();
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const weekStartOffset = this.getWeekStartOffset();

    const shortDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const orderedDays = [
      ...shortDays.slice(weekStartOffset),
      ...shortDays.slice(0, weekStartOffset),
    ];

    // Header
    const header = this.contentEl.createDiv("nld-cal-header");

    const prevBtn = header.createEl("button", {
      cls: "nld-cal-nav",
      attr: { type: "button", "aria-label": "Previous month" },
    });
    prevBtn.setText("‹");
    prevBtn.addEventListener("click", () => {
      this.viewDate = new Date(year, month - 1, 1);
      this.render();
    });

    const titleBtn = header.createEl("button", {
      cls: "nld-cal-title-btn",
      attr: { type: "button" },
    });
    const titleSpan = titleBtn.createEl("span", {
      text: window.moment(this.viewDate).format("MMM YYYY"),
    });
    titleSpan.createEl("span", { text: " ⌄", cls: "nld-cal-chevron" });
    titleBtn.addEventListener("click", () => {
      this.currentView = "month";
      this.render();
    });

    const nextBtn = header.createEl("button", {
      cls: "nld-cal-nav",
      attr: { type: "button", "aria-label": "Next month" },
    });
    nextBtn.setText("›");
    nextBtn.addEventListener("click", () => {
      this.viewDate = new Date(year, month + 1, 1);
      this.render();
    });

    // Weekday labels
    const weekdaysRow = this.contentEl.createDiv("nld-cal-weekdays");
    orderedDays.forEach((day) => {
      weekdaysRow.createEl("span", { text: day, cls: "nld-cal-weekday" });
    });

    // Day grid
    const grid = this.contentEl.createDiv("nld-cal-grid");

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const paddingCells = (firstDayOfMonth - weekStartOffset + 7) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < paddingCells; i++) {
      grid.createDiv("nld-cal-empty");
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = this.isSameDay(date, today);
      const isSelected = this.selectedDate && this.isSameDay(date, this.selectedDate);

      const cls = ["nld-cal-day"];
      if (isSelected) cls.push("nld-cal-selected");
      else if (isToday) cls.push("nld-cal-today");

      const dayEl = grid.createEl("button", {
        cls: cls.join(" "),
        attr: { type: "button" },
      });
      dayEl.createEl("span", { text: String(day) });

      dayEl.addEventListener("click", () => {
        this.selectedDate = date;
        this.onSelect(date);
        this.close();
      });
    }
  }

  private renderMonthView(): void {
    const year = this.viewDate.getFullYear();
    const currentMonth = this.viewDate.getMonth();

    // Header — nav arrows change the year
    const header = this.contentEl.createDiv("nld-cal-header");

    const prevBtn = header.createEl("button", {
      cls: "nld-cal-nav",
      attr: { type: "button", "aria-label": "Previous year" },
    });
    prevBtn.setText("‹");
    prevBtn.addEventListener("click", () => {
      this.viewDate = new Date(year - 1, currentMonth, 1);
      this.render();
    });

    header.createEl("span", { text: String(year), cls: "nld-cal-title-plain" });

    const nextBtn = header.createEl("button", {
      cls: "nld-cal-nav",
      attr: { type: "button", "aria-label": "Next year" },
    });
    nextBtn.setText("›");
    nextBtn.addEventListener("click", () => {
      this.viewDate = new Date(year + 1, currentMonth, 1);
      this.render();
    });

    // 3×4 month grid
    const grid = this.contentEl.createDiv("nld-cal-month-grid");
    const shortMonths = window.moment.monthsShort();

    shortMonths.forEach((name, i) => {
      const isCurrent = i === currentMonth;
      const btn = grid.createEl("button", {
        text: name,
        cls: `nld-cal-month-cell${isCurrent ? " nld-cal-month-current" : ""}`,
        attr: { type: "button" },
      });
      btn.addEventListener("click", () => {
        this.viewDate = new Date(year, i, 1);
        this.currentView = "day";
        this.render();
      });
    });
  }
}
