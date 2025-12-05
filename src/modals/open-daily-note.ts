import { Notice, SuggestModal, App } from "obsidian";
import { getOrCreateDailyNote } from "../utils";
import type NaturalLanguageDates from "../main";
import DateSuggest from "../suggest/date-suggest";

// Credit: https://github.com/charliecm/obsidian-open-with-nldates
export class OpenDailyNoteModal extends SuggestModal<string> {
  plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.plugin = plugin;
  }

  getSuggestions(query: string): string[] {
    const tempSuggest = new DateSuggest(this.app, this.plugin);
    const suggestions = tempSuggest.getDateSuggestions(
      { query },
      ['Today', 'Yesterday', 'Tomorrow']
    );
    return suggestions.map(s => s.label).length ? suggestions.map(s => s.label) : [query];
  }

  renderSuggestion(suggestion: string, el: HTMLElement) {
    el.createEl("div", { text: suggestion });
  }

  onChooseSuggestion(suggestion: string): void {
    const parsedDate = this.plugin.parseDate(suggestion);
    const date = parsedDate.moment;
    if (!parsedDate.date || !date.isValid()) {
      new Notice("Unable to parse date");
      return;
    }

    void getOrCreateDailyNote(date).then((note) => {
      void this.app.workspace.getLeaf().openFile(note);
    });
  }
}
