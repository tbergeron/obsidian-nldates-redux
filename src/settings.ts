import { App, PluginSettingTab, Setting } from "obsidian";
import NaturalLanguageDates from "./main";
import { getLocaleWeekStart } from "./utils";

export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "locale-default";

export interface NLDSettings {
  autosuggestToggleLink: boolean;
  autocompleteTriggerPhrase: string;
  isAutosuggestEnabled: boolean;
  appendTimeToDateWhenRelated: boolean;

  format: string;
  timeFormat: string;
  separator: string;
  weekStart: DayOfWeek;

  modalToggleTime: boolean;
  modalToggleLink: boolean;
  modalMomentFormat: string;
}

export const DEFAULT_SETTINGS: NLDSettings = {
  autosuggestToggleLink: true,
  autocompleteTriggerPhrase: "@",
  isAutosuggestEnabled: true,
  appendTimeToDateWhenRelated: true,

  format: "YYYY-MM-DD",
  timeFormat: "HH:mm",
  separator: " ",
  weekStart: "locale-default",

  modalToggleTime: false,
  modalToggleLink: false,
  modalMomentFormat: "YYYY-MM-DD HH:mm",
};

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export class NLDSettingsTab extends PluginSettingTab {
  plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const localizedWeekdays = window.moment.weekdays();
    const localeWeekStart = getLocaleWeekStart();

    containerEl.empty();

    new Setting(containerEl).setName('Format').setHeading();

    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Specify the format for displaying dates (default: YYYY-MM-DD)")
      .addMomentFormat((text) =>
        text
          .setDefaultFormat("YYYY-MM-DD")
          .setValue(this.plugin.settings.format)
          .onChange(async (value) => {
            this.plugin.settings.format = value || "YYYY-MM-DD";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Time format")
      .setDesc("Specify the format for displaying time (default: HH:mm)")
      .addMomentFormat((text) =>
        text
          .setDefaultFormat("HH:mm")
          .setValue(this.plugin.settings.timeFormat)
          .onChange(async (value) => {
            this.plugin.settings.timeFormat = value || "HH:mm";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date-time separator")
      .setDesc("Character(s) used to separate date and time (default: space)")
      .addText((text) =>
        text
          .setPlaceholder("Enter separator")
          .setValue(this.plugin.settings.separator)
          .onChange(async (value) => {
            this.plugin.settings.separator = value || " ";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Append time to date when relevant")
      .setDesc(
        `Enable Notion-like behavior. ie. @now includes date and time, while @today includes only the date. If disabled, the plugin will behave like the original version and will use the date format *only* and time format will only be used for commands.`
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.appendTimeToDateWhenRelated)
          .onChange(async (value) => {
            this.plugin.settings.appendTimeToDateWhenRelated = value || false;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Week starts on")
      .setDesc("Select the day to be considered as the start of the week")
      .addDropdown((dropdown) => {
        dropdown.addOption("locale-default", `Locale default (${localeWeekStart})`);
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.settings.weekStart.toLowerCase());
        dropdown.onChange(async (value: DayOfWeek) => {
          this.plugin.settings.weekStart = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName('Autosuggestion').setHeading();

    new Setting(containerEl)
      .setName("Enable date autosuggestion")
      .setDesc(
        `Toggle to enable or disable the autosuggestion menu, triggered by ${this.plugin.settings.autocompleteTriggerPhrase}`
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isAutosuggestEnabled)
          .onChange(async (value) => {
            this.plugin.settings.isAutosuggestEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Trigger")
      .setDesc("Character(s) to trigger autosuggestion (default: @)")
      .addMomentFormat((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.autocompleteTriggerPhrase)
          .setValue(this.plugin.settings.autocompleteTriggerPhrase || "@")
          .onChange(async (value) => {
            this.plugin.settings.autocompleteTriggerPhrase = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Wrap dates in links")
      .setDesc(
        "If enabled, dates created via autosuggestion will be wrapped in [[wikilinks]]"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autosuggestToggleLink)
          .onChange(async (value) => {
            this.plugin.settings.autosuggestToggleLink = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
