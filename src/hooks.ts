import {
  getSortTitleFieldName,
  processItem,
} from "./modules/titleWithoutArticles";
import { UIFactory } from "./modules/ui";
import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Register notifier to auto-generate/update titles without articles
  //
  // AUTO-UPDATE LOGIC:
  // 1. New items (manually created): Add placeholder field "[pending]" immediately
  //    - When user adds title, it triggers modify event and updates the field
  // 2. New items (imported/duplicated): Process normally if title exists
  // 3. Modified items: Check if "title-without-articles" field exists in Extra
  //    - If exists: Update it based on current title and preferences
  //    - If doesn't exist: Do nothing (respects manual removal)
  // 4. Manual menu/button action: Always process (add/update/remove as needed)
  //
  // This ensures:
  // - New items get the field automatically
  // - Existing items only update if they already have the field
  // - Users can manually remove the field and it won't regenerate
  // - Changing preferences updates existing fields but doesn't add new ones
  Zotero.Notifier.registerObserver(
    {
      notify: async (
        event: string,
        type: string,
        ids: string[] | number[],
        extraData: any,
      ) => {
        if (type === "item") {
          if (event === "add") {
            // For new items, add a placeholder field so it gets updated when title is added
            for (const id of ids) {
              const item = await Zotero.Items.getAsync(id as number);
              if (item && !item.isNote() && !item.isAttachment()) {
                const title = item.getField("title");

                if (!title) {
                  // New item with empty title - add placeholder field
                  // This ensures the field exists for when user adds the title
                  let extra = item.getField("extra") || "";
                  const fieldName = getSortTitleFieldName();

                  // Only add if not already present
                  if (!extra.includes(fieldName)) {
                    const placeholder = `${fieldName}: [pending]`;
                    extra = extra ? `${placeholder}\n${extra}` : placeholder;
                    item.setField("extra", extra);
                    await item.saveTx();
                  }
                } else {
                  // Item already has title (e.g., imported/duplicated)
                  await processItem(item, true);
                }
              }
            }
          } else if (event === "modify") {
            // For modified items, just check if we need to update existing field
            for (const id of ids) {
              const item = await Zotero.Items.getAsync(id as number);
              if (item && !item.isNote() && !item.isAttachment()) {
                // Simple logic: on any modification, update if field exists
                // This handles title changes and preference changes
                // Don't force - only update if field already exists
                await processItem(item, false);
              }
            }
          }
        }
      },
    },
    ["item"],
    "titleWithoutArticles",
  );

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  // Load localization
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // Show startup notification
  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();

  // Register preferences pane
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `chrome://${addon.data.config.addonRef}/content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });

  // Register UI components
  UIFactory.registerRightClickMenuItems();
  await UIFactory.registerSortTitleColumn();
  UIFactory.registerItemPaneInfo();
  UIFactory.registerToolbarButton();

  // Make functions available globally for menu commands
  // @ts-expect-error - Adding to Zotero global
  win.Zotero.TitleWithoutArticles = {
    handleAddSortTitle: UIFactory.handleAddSortTitle,
    handleRemoveSortTitle: UIFactory.handleRemoveSortTitle,
    openPreferences: UIFactory.openPreferences,
  };

  await Zotero.Promise.delay(500);

  popupWin.changeLine({
    progress: 100,
    text: getString("startup-finish"),
  });
  popupWin.startCloseTimer(2000);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();

  // Clean up global functions
  const zoteroGlobal = (win as any).Zotero;
  if (zoteroGlobal && zoteroGlobal.TitleWithoutArticles) {
    delete zoteroGlobal.TitleWithoutArticles;
  }
}

function onShutdown(): void {
  ztoolkit.unregisterAll();

  // Unregister notifier
  Zotero.Notifier.unregisterObserver("titleWithoutArticles");

  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * Notify handler for item events
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // Handle notifications if needed
  ztoolkit.log("notify", event, type, ids, extraData);
}

/**
 * Preference event handler
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load": {
      // Register preference UI if needed
      const { registerPrefsScripts } = await import(
        "./modules/preferenceScript"
      );
      await registerPrefsScripts(data.window);
      break;
    }
    default:
      return;
  }
}

function onShortcuts(type: string) {
  // Handle keyboard shortcuts if needed
}

function onDialogEvents(type: string) {
  // Handle dialog events if needed
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
