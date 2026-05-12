// Vendored from obsidian-daily-notes-interface
// https://github.com/liamcain/obsidian-daily-notes-interface
// Licensed under MIT

import { moment, normalizePath, Notice, TFile, TFolder, Vault } from "obsidian";
import type { App } from "obsidian";

declare global {
  interface Window {
    app: App;
  }
}

const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";

class DailyNotesFolderMissingError extends Error {}

interface DailyNoteSettings {
  format: string;
  folder: string;
  template: string;
}

function getDailyNoteSettings(): DailyNoteSettings {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = window.app as any;
    const periodicNotes = app.plugins?.getPlugin("periodic-notes");
    if (periodicNotes && periodicNotes.settings?.daily?.enabled) {
      const { format, folder, template } = periodicNotes.settings?.daily || {};
      return {
        format: format || DEFAULT_DAILY_NOTE_FORMAT,
        folder: folder?.trim() || "",
        template: template?.trim() || "",
      };
    }
    const dailyNotesPlugin = app.internalPlugins?.getPluginById("daily-notes");
    const options = dailyNotesPlugin?.instance?.options || {};
    return {
      format: options.format || DEFAULT_DAILY_NOTE_FORMAT,
      folder: options.folder?.trim() || "",
      template: options.template?.trim() || "",
    };
  } catch (err) {
    console.debug("No custom daily note settings found!", err);
    return {
      format: DEFAULT_DAILY_NOTE_FORMAT,
      folder: "",
      template: "",
    };
  }
}

function join(...partSegments: string[]): string {
  let parts: string[] = [];
  for (let i = 0, l = partSegments.length; i < l; i++) {
    const segment = partSegments[i];
    if (!segment) continue;
    parts = parts.concat(segment.split("/"));
  }
  const newParts: string[] = [];
  for (let i = 0, l = parts.length; i < l; i++) {
    const part = parts[i];
    if (!part || part === ".") continue;
    else newParts.push(part);
  }
  if (parts[0] === "") newParts.unshift("");
  return newParts.join("/");
}

async function ensureFolderExists(path: string): Promise<void> {
  const dirs = path.replace(/\\/g, "/").split("/");
  dirs.pop();
  if (dirs.length) {
    const dir = join(...dirs);
    if (!window.app.vault.getAbstractFileByPath(dir)) {
      await window.app.vault.createFolder(dir);
    }
  }
}

async function getNotePath(directory: string, filename: string): Promise<string> {
  if (!filename.endsWith(".md")) {
    filename += ".md";
  }
  const path = normalizePath(join(directory, filename));
  await ensureFolderExists(path);
  return path;
}

async function getTemplateInfo(template: string): Promise<[string, unknown | null]> {
  const { metadataCache, vault } = window.app;
  const templatePath = normalizePath(template);
  if (templatePath === "/") {
    return Promise.resolve(["", null]);
  }
  try {
    const templateFile = metadataCache.getFirstLinkpathDest(templatePath, "");
    if (!templateFile) {
      return ["", null];
    }
    const contents = await vault.cachedRead(templateFile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IFoldInfo = (window.app as any).foldManager.load(templateFile);
    return [contents, IFoldInfo];
  } catch (err) {
    console.error(`Failed to read the daily note template '${templatePath}'`, err);
    new Notice("Failed to read the daily note template");
    return ["", null];
  }
}

function getDateUID(date: moment.Moment, granularity = "day"): string {
  const ts = date.clone().startOf(granularity as moment.unitOfTime.StartOf).format();
  return `${granularity}-${ts}`;
}

function removeEscapedCharacters(format: string): string {
  return format.replace(/\[[^\]]*\]/g, "");
}

function isFormatAmbiguous(format: string, granularity: string): boolean {
  if (granularity === "week") {
    const cleanFormat = removeEscapedCharacters(format);
    return (
      /w{1,2}/i.test(cleanFormat) &&
      (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat))
    );
  }
  return false;
}

function getDateFromFilename(filename: string, granularity: string): moment.Moment | null {
  const format = getDailyNoteSettings().format.split("/").pop() || DEFAULT_DAILY_NOTE_FORMAT;
  const noteDate = window.moment(filename, format, true);
  if (!noteDate.isValid()) {
    return null;
  }
  if (isFormatAmbiguous(format, granularity)) {
    if (granularity === "week") {
      const cleanFormat = removeEscapedCharacters(format);
      if (/w{1,2}/i.test(cleanFormat)) {
        return window.moment(
          filename,
          format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""),
          false
        );
      }
    }
  }
  return noteDate;
}

function getDateFromFile(file: TFile, granularity: string): moment.Moment | null {
  return getDateFromFilename(file.basename, granularity);
}

export async function createDailyNote(date: moment.Moment): Promise<TFile | null> {
  const app = window.app;
  const { vault } = app;
  const moment = window.moment;
  const { template, format, folder } = getDailyNoteSettings();
  const [templateContents, IFoldInfo] = await getTemplateInfo(template);
  const filename = date.format(format);
  const normalizedPath = await getNotePath(folder, filename);
  try {
    const createdFile = await vault.create(
      normalizedPath,
      templateContents
        .replace(/{{\s*date\s*}}/gi, filename)
        .replace(/{{\s*time\s*}}/gi, moment().format("HH:mm"))
        .replace(/{{\s*title\s*}}/gi, filename)
        .replace(
          /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
          (_: string, _timeOrDate: string, calc: string, timeDelta: string, unit: string, momentFormat: string) => {
            const now = moment();
            const currentDate = date.clone().set({
              hour: now.get("hour"),
              minute: now.get("minute"),
              second: now.get("second"),
            });
            if (calc) {
              currentDate.add(parseInt(timeDelta, 10), unit as moment.unitOfTime.DurationConstructor);
            }
            if (momentFormat) {
              return currentDate.format(momentFormat.substring(1).trim());
            }
            return currentDate.format(format);
          }
        )
        .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
        .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "d").format(format))
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).foldManager.save(createdFile, IFoldInfo);
    return createdFile;
  } catch (err) {
    console.error(`Failed to create file: '${normalizedPath}'`, err);
    new Notice("Unable to create new file.");
    return null;
  }
}

export function getDailyNote(date: moment.Moment, dailyNotes: Record<string, TFile>): TFile | null {
  return dailyNotes[getDateUID(date, "day")] ?? null;
}

export function getAllDailyNotes(): Record<string, TFile> {
  const { vault } = window.app;
  const { folder } = getDailyNoteSettings();
  const dailyNotesFolder = vault.getAbstractFileByPath(normalizePath(folder));
  if (!dailyNotesFolder || !(dailyNotesFolder instanceof TFolder)) {
    throw new DailyNotesFolderMissingError("Failed to find daily notes folder");
  }
  const dailyNotes: Record<string, TFile> = {};
  Vault.recurseChildren(dailyNotesFolder, (note) => {
    if (note instanceof TFile) {
      const date = getDateFromFile(note, "day");
      if (date) {
        const dateString = getDateUID(date, "day");
        dailyNotes[dateString] = note;
      }
    }
  });
  return dailyNotes;
}
