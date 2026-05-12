import { normalizePath, Notice, TFile, TFolder, Vault } from "obsidian";

type MomentInstance = ReturnType<typeof window.moment>;

interface IFold {
  from: number;
  to: number;
}

interface IFoldInfo {
  folds: IFold[];
}

interface IPeriodicNoteSettings {
  folder?: string;
  format?: string;
  template?: string;
}

type IGranularity = "day" | "week" | "month" | "quarter" | "year";

const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";

interface AppWithInternals {
  vault: Vault;
  plugins: {
    getPlugin(id: string): unknown;
  };
  internalPlugins: {
    getPluginById(id: string): { instance?: { options?: Record<string, unknown> } } | undefined;
  };
  foldManager: {
    save(file: TFile, foldInfo: IFoldInfo): void;
    load(file: TFile): IFoldInfo;
  };
  metadataCache: {
    getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null;
  };
}

function getApp(): AppWithInternals {
  return window.app as unknown as AppWithInternals;
}

function shouldUsePeriodicNotesSettings(periodicity: string): boolean {
  const plugin = getApp().plugins.getPlugin("periodic-notes") as
    | { settings?: Record<string, { enabled?: boolean }> }
    | undefined;
  return Boolean(plugin?.settings?.[periodicity]?.enabled);
}

function getDailyNoteSettings(): IPeriodicNoteSettings {
  try {
    const app = getApp();

    if (shouldUsePeriodicNotesSettings("daily")) {
      const plugin = app.plugins.getPlugin("periodic-notes") as
        | { settings?: { daily?: { format?: string; folder?: string; template?: string } } }
        | undefined;
      const daily = plugin?.settings?.daily || {};
      return {
        format: typeof daily.format === "string" ? daily.format : DEFAULT_DAILY_NOTE_FORMAT,
        folder: typeof daily.folder === "string" ? daily.folder.trim() : "",
        template: typeof daily.template === "string" ? daily.template.trim() : "",
      };
    }

    const plugin = app.internalPlugins.getPluginById("daily-notes");
    const options = plugin?.instance?.options as
      | { folder?: string; format?: string; template?: string }
      | undefined;
    return {
      format: typeof options?.format === "string" ? options.format : DEFAULT_DAILY_NOTE_FORMAT,
      folder: typeof options?.folder === "string" ? options.folder.trim() : "",
      template: typeof options?.template === "string" ? options.template.trim() : "",
    };
  } catch (err) {
    console.warn("No custom daily note settings found!", err);
    return {
      format: DEFAULT_DAILY_NOTE_FORMAT,
      folder: "",
      template: "",
    };
  }
}

function getDateUID(date: MomentInstance, granularity: IGranularity = "day"): string {
  const ts = date.clone().startOf(granularity).format();
  return `${granularity}-${ts}`;
}

function removeEscapedCharacters(format: string): string {
  return format.replace(/\[[^\]]*\]/g, "");
}

function isFormatAmbiguous(format: string, granularity: IGranularity): boolean {
  if (granularity === "week") {
    const cleanFormat = removeEscapedCharacters(format);
    return /w{1,2}/i.test(cleanFormat) && (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat));
  }
  return false;
}

function getDateFromFilename(filename: string, granularity: IGranularity): MomentInstance | null {
  const getSettings: Record<IGranularity, () => IPeriodicNoteSettings> = {
    day: getDailyNoteSettings,
    week: getDailyNoteSettings,
    month: getDailyNoteSettings,
    quarter: getDailyNoteSettings,
    year: getDailyNoteSettings,
  };

  const formatSetting = getSettings[granularity]().format.split("/").pop() || DEFAULT_DAILY_NOTE_FORMAT;
  const noteDate = window.moment(filename, formatSetting, true);

  if (!noteDate.isValid()) {
    return null;
  }

  if (isFormatAmbiguous(formatSetting, granularity)) {
    if (granularity === "week") {
      const cleanFormat = removeEscapedCharacters(formatSetting);
      if (/w{1,2}/i.test(cleanFormat)) {
        return window.moment(
          filename,
          formatSetting.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""),
          false
        );
      }
    }
  }

  return noteDate;
}

function getDateFromFile(file: TFile, granularity: IGranularity): MomentInstance | null {
  return getDateFromFilename(file.basename, granularity);
}

function joinPaths(...segments: string[]): string {
  const parts: string[] = [];
  for (const segment of segments) {
    parts.push(...segment.split("/"));
  }
  const result: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    result.push(part);
  }
  if (parts[0] === "") {
    result.unshift("");
  }
  return result.join("/");
}

async function ensureFolderExists(path: string): Promise<void> {
  const dirs = path.replace(/\\/g, "/").split("/");
  dirs.pop();

  if (dirs.length > 0) {
    const dir = joinPaths(...dirs);
    if (!getApp().vault.getAbstractFileByPath(dir)) {
      await getApp().vault.createFolder(dir);
    }
  }
}

async function getNotePath(directory: string, filename: string): Promise<string> {
  let name = filename;
  if (!name.endsWith(".md")) {
    name += ".md";
  }
  const path = normalizePath(joinPaths(directory, name));

  await ensureFolderExists(path);

  return path;
}

async function getTemplateInfo(template: string): Promise<[string, IFoldInfo]> {
  const app = getApp();
  const templatePath = normalizePath(template);
  if (templatePath === "/") {
    return ["", { folds: [] }];
  }

  try {
    const templateFile = app.metadataCache.getFirstLinkpathDest(templatePath, "");
    if (!templateFile) {
      throw new Error("Template file not found");
    }
    const contents = await app.vault.cachedRead(templateFile);
    const foldInfo = app.foldManager.load(templateFile);
    return [contents, foldInfo];
  } catch (err) {
    console.error(`Failed to read the daily note template '${templatePath}'`, err);
    new Notice("Failed to read the daily note template");
    return ["", { folds: [] }];
  }
}

export async function createDailyNote(date: MomentInstance): Promise<TFile> {
  const app = getApp();
  const { vault } = app;

  const { template, format, folder } = getDailyNoteSettings();

  const [templateContents, foldInfo] = await getTemplateInfo(template);
  const filename = date.format(format);
  const normalizedPath = await getNotePath(folder, filename);

  try {
    const createdFile = await vault.create(
      normalizedPath,
      templateContents
        .replace(/{{\s*date\s*}}/gi, filename)
        .replace(/{{\s*time\s*}}/gi, window.moment().format("HH:mm"))
        .replace(/{{\s*title\s*}}/gi, filename)
        .replace(
          /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
          (
            _match: string,
            _timeOrDate: string,
            calc: string,
            timeDelta: string,
            unit: string,
            momentFormat: string
          ): string => {
            const now = window.moment();
            const currentDate = date.clone().set({
              hour: now.get("hour"),
              minute: now.get("minute"),
              second: now.get("second"),
            });
            if (calc) {
              currentDate.add(parseInt(timeDelta, 10) as never, unit as never);
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

    app.foldManager.save(createdFile, foldInfo);

    return createdFile;
  } catch (err) {
    console.error(`Failed to create file: '${normalizedPath}'`, err);
    new Notice("Unable to create new file.");
    throw err;
  }
}

export function getDailyNote(date: MomentInstance, dailyNotes: Record<string, TFile>): TFile | null {
  return dailyNotes[getDateUID(date, "day")] ?? null;
}

export function getAllDailyNotes(): Record<string, TFile> {
  const app = getApp();
  const { vault } = app;
  const { folder } = getDailyNoteSettings();

  const dailyNotesFolder = vault.getAbstractFileByPath(normalizePath(folder)) as TFolder | null;

  if (!dailyNotesFolder) {
    throw new Error("Failed to find daily notes folder");
  }

  const dailyNotes: Record<string, TFile> = {};
  Vault.recurseChildren(dailyNotesFolder, (note) => {
    if (note instanceof TFile) {
      const noteDate = getDateFromFile(note, "day");
      if (noteDate) {
        const dateString = getDateUID(noteDate, "day");
        dailyNotes[dateString] = note;
      }
    }
  });

  return dailyNotes;
}