import { config } from "../../package.json";
import { getString } from "../utils/locale";

export async function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  // See addon/content/preferences.xhtml onpaneload
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }

  // No need for table or complex UI - our preferences are simple
  bindPrefEvents();
}

function bindPrefEvents() {
  // Add event listener for the articles textarea if needed
  const articlesTextarea = addon.data.prefs!.window.document?.querySelector(
    `#zotero-prefpane-${config.addonRef}-articles`,
  ) as HTMLTextAreaElement;

  if (articlesTextarea) {
    // Set initial value from preferences
    const currentValue = Zotero.Prefs.get(
      `${config.prefsPrefix}.articles`,
      true,
    ) as string;
    if (currentValue) {
      articlesTextarea.value = currentValue;
    }

    // Save on change
    articlesTextarea.addEventListener("change", (e: Event) => {
      const newValue = (e.target as HTMLTextAreaElement).value;
      Zotero.Prefs.set(`${config.prefsPrefix}.articles`, newValue, true);
    });
  }
}
