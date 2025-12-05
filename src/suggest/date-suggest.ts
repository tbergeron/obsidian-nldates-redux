import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo
} from "obsidian";
import type NaturalLanguageDates from "src/main";
import { generateMarkdownLink, getDateLinkAlias } from "src/utils";

interface IDateCompletion {
  label: string;
}

export default class DateSuggest extends EditorSuggest<IDateCompletion> {
  app: App;
  private plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.app = app;
    this.plugin = plugin;

    this.scope.register(["Shift"], "Enter", (evt: KeyboardEvent) => {
      // @ts-expect-error - suggestions is private API
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.suggestions.useSelectedItem(evt);
      return false;
    });

    if (this.plugin.settings.autosuggestToggleLink) {
      this.setInstructions([{ command: "Shift", purpose: "Keep text as alias" }]);
    }
  }

  getSuggestions(context: EditorSuggestContext): IDateCompletion[] {
    const suggestions = this.getDateSuggestions(context);
    if (suggestions.length) {
      return suggestions;
    }

    // catch-all if there are no matches
    return [{ label: context.query }];
  }

  getDateSuggestions(
    context: EditorSuggestContext | { query: string },
    defaults: string[] = ["Now", "Today", "Yesterday", "Tomorrow", "In 1 hour", "1 hour ago"]
  ): IDateCompletion[] {
    if (context.query.match(/^time/)) {
      return ["now", "+15 minutes", "+1 hour", "-15 minutes", "-1 hour"]
        .map((val) => ({ label: `time:${val}` }))
        .filter((item) => item.label.toLowerCase().startsWith(context.query));
    }
    if (context.query.match(/(next|last|this)/i)) {
      const reference = context.query.match(/(next|last|this)/i)[1];
      return [
        "week",
        "month",
        "year",
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ]
        .map((val) => ({ label: `${reference} ${val}` }))
        .filter((items) => items.label.toLowerCase().startsWith(context.query));
    }

    const relativeDate =
      context.query.match(/^in ([+-]?\d+)/i) || context.query.match(/^([+-]?\d+)/i);
    if (relativeDate) {
      const timeDelta = relativeDate[1];
      return [
        { label: `in ${timeDelta} minutes` },
        { label: `in ${timeDelta} hours` },
        { label: `in ${timeDelta} days` },
        { label: `in ${timeDelta} weeks` },
        { label: `in ${timeDelta} months` },
        { label: `${timeDelta} days ago` },
        { label: `${timeDelta} weeks ago` },
        { label: `${timeDelta} months ago` },
      ].filter((items) => items.label.toLowerCase().startsWith(context.query));
    }

    return defaults
      .map((label) => ({ label }))
      .filter((items) => items.label.toLowerCase().startsWith(context.query));
  }

  renderSuggestion(suggestion: IDateCompletion, el: HTMLElement): void {
    el.setText(suggestion.label);
  }

  selectSuggestion(suggestion: IDateCompletion, event: KeyboardEvent | MouseEvent): void {
    const { editor } = this.context;

    const includeAlias = event.shiftKey;
    let dateStr = "";
    let makeIntoLink = this.plugin.settings.autosuggestToggleLink;

    if (suggestion.label.startsWith("time:")) {
      const timePart = suggestion.label.substring(5);
      dateStr = this.plugin.parseTime(timePart).formattedString;
      makeIntoLink = false;
    } else {
      dateStr = this.plugin.parseDate(suggestion.label).formattedString;
    }

    if (makeIntoLink) {
      const alias = getDateLinkAlias(this.plugin, suggestion.label, includeAlias);
      dateStr = generateMarkdownLink(
        this.app,
        dateStr,
        alias
      );
    }

    editor.replaceRange(dateStr, this.context.start, this.context.end);
    this.close();
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor
  ): EditorSuggestTriggerInfo {
    if (!this.plugin.settings.isAutosuggestEnabled) {
      return null;
    }

    const triggerPhrase = this.plugin.settings.autocompleteTriggerPhrase;
    const startPos = this.context?.start || {
      line: cursor.line,
      ch: cursor.ch - triggerPhrase.length,
    };

    if (!editor.getRange(startPos, cursor).startsWith(triggerPhrase)) {
      return null;
    }

    const precedingChar = editor.getRange(
      {
        line: startPos.line,
        ch: startPos.ch - 1,
      },
      startPos
    );

    // Short-circuit if `@` as a part of a word (e.g. part of an email address)
    if (precedingChar && /[`a-zA-Z0-9]/.test(precedingChar)) {
      return null;
    }

    const query = editor.getRange(startPos, cursor).substring(triggerPhrase.length);
    
    // Dismiss suggestions if user types a space right after the trigger phrase
    if (query === " ") {
      return null;
    }

    return {
      start: startPos,
      end: cursor,
      query: query,
    };
  }
}
