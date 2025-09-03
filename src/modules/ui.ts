import {
  processItems,
  clearSortTitles,
  extractSortTitleFromExtra,
} from "./titleWithoutArticles";
import { getString } from "../utils/locale";

export class UIFactory {
  /**
   * Register the right-click menu items for the plugin
   */
  static registerRightClickMenuItems() {
    // Helper function to create the menu structure
    const createMenuStructure = (getItems: () => any[]) => ({
      tag: "menu" as const,
      id: "title-without-articles-menu",
      label: getString("menuitem-title-without-articles").trim(),
      icon: "chrome://zotero/skin/16/universal/sort.svg",
      children: [
        {
          tag: "menuitem" as const,
          id: "title-without-articles-update",
          label: getString("menuitem-update-titles"),
          commandListener: (ev: any) =>
            UIFactory.handleAddSortTitle(getItems()),
        },
        {
          tag: "menuitem" as const,
          id: "title-without-articles-remove",
          label: getString("menuitem-remove-titles"),
          commandListener: (ev: any) =>
            UIFactory.handleRemoveSortTitle(getItems()),
          getVisibility: () => {
            const items = getItems();
            // Only show if at least one item has a title without articles
            return items.some((item) => {
              const extra = item.getField("extra");
              return extra && extractSortTitleFromExtra(extra);
            });
          },
        },
        {
          tag: "menuseparator" as const,
        },
        {
          tag: "menuitem" as const,
          id: "title-without-articles-preferences",
          label: getString("menuitem-preferences"),
          commandListener: (ev: any) => UIFactory.openPreferences(),
        },
      ],
      getVisibility: () => {
        const items = getItems();
        return items.length > 0;
      },
    });

    // Register for item context menu
    ztoolkit.Menu.register(
      "item",
      createMenuStructure(() =>
        ztoolkit.getGlobal("ZoteroPane").getSelectedItems(),
      ),
    );

    // Register for collection context menu
    ztoolkit.Menu.register(
      "collection",
      createMenuStructure(() => {
        const collection = ztoolkit
          .getGlobal("ZoteroPane")
          .getSelectedCollection();
        if (collection) {
          return collection.getChildItems();
        }
        return [];
      }),
    );
  }

  /**
   * Handle adding sort titles to selected items
   */
  static async handleAddSortTitle(items?: any[]) {
    if (!items) {
      items = ztoolkit.getGlobal("ZoteroPane").getSelectedItems();
    }

    if (items.length === 0) {
      return;
    }

    // Only show notification for multiple items
    if (items.length > 1) {
      const progressWin = new ztoolkit.ProgressWindow(
        addon.data.config.addonName,
        {
          closeOnClick: true,
          closeTime: -1,
        },
      );

      progressWin
        .createLine({
          text: getString("progress-processing", {
            args: { count: items.length },
          }),
          type: "default",
          progress: 0,
        })
        .show();

      try {
        const processed = await processItems(items, true); // Force process for manual action

        progressWin.changeLine({
          text: getString("progress-completed", {
            args: { processed, total: items.length },
          }),
          type: "success",
          progress: 100,
        });

        // Auto-close after 2 seconds
        progressWin.startCloseTimer(2000);
      } catch (error) {
        progressWin.changeLine({
          text: getString("progress-error"),
          type: "fail",
          progress: 100,
        });

        progressWin.startCloseTimer(3000);
        Zotero.logError(error as Error);
      }
    } else {
      // Process single item silently
      await processItems(items, true); // Force process for manual action
    }
  }

  /**
   * Handle removing sort titles from selected items
   */
  static async handleRemoveSortTitle(items?: any[]) {
    if (!items) {
      items = ztoolkit.getGlobal("ZoteroPane").getSelectedItems();
    }

    if (items.length === 0) {
      return;
    }

    // Only show notification for multiple items
    if (items.length > 1) {
      const progressWin = new ztoolkit.ProgressWindow(
        addon.data.config.addonName,
        {
          closeOnClick: true,
          closeTime: -1,
        },
      );

      progressWin
        .createLine({
          text: getString("progress-removing", {
            args: { count: items.length },
          }),
          type: "default",
          progress: 0,
        })
        .show();

      try {
        const cleared = await clearSortTitles(items);

        progressWin.changeLine({
          text: getString("progress-removed", {
            args: { cleared, total: items.length },
          }),
          type: "success",
          progress: 100,
        });

        // Auto-close after 2 seconds
        progressWin.startCloseTimer(2000);
      } catch (error) {
        progressWin.changeLine({
          text: getString("progress-error"),
          type: "fail",
          progress: 100,
        });

        progressWin.startCloseTimer(3000);
        Zotero.logError(error as Error);
      }
    } else {
      // Process single item silently
      await clearSortTitles(items);
    }
  }

  /**
   * Register an extra column to display sort titles
   */
  static async registerSortTitleColumn() {
    await Zotero.ItemTreeManager.registerColumns({
      pluginID: addon.data.config.addonID,
      dataKey: "title-without-articles",
      label: getString("column-sort-title"),
      dataProvider: (item: Zotero.Item, dataKey: string) => {
        const extra = item.getField("extra");
        if (!extra) return "";

        const sortTitle = extractSortTitleFromExtra(extra);
        return sortTitle || "";
      },
      iconPath: "chrome://zotero/skin/16/universal/sort.svg",
    });
  }

  /**
   * Register a toolbar button
   */
  static registerToolbarButton() {
    const toolbarID = "zotero-tb-advanced-search";
    const toolbar = ztoolkit.getGlobal("document").getElementById(toolbarID);

    if (!toolbar) return;

    const button = ztoolkit.UI.createElement(
      ztoolkit.getGlobal("document"),
      "toolbarbutton",
      {
        id: "title-without-articles-button",
        classList: ["zotero-tb-button"],
        attributes: {
          tooltiptext: getString("toolbar-button-tooltip"),
          type: "menu",
        },
        children: [
          {
            tag: "menupopup",
            children: [
              {
                tag: "menuitem",
                attributes: {
                  label: getString("menuitem-update-titles"),
                  oncommand: "Zotero.TitleWithoutArticles.handleAddSortTitle()",
                },
              },
              {
                tag: "menuitem",
                attributes: {
                  label: getString("menuitem-remove-titles"),
                  oncommand:
                    "Zotero.TitleWithoutArticles.handleRemoveSortTitle()",
                },
              },
              {
                tag: "menuseparator",
              },
              {
                tag: "menuitem",
                attributes: {
                  label: getString("menuitem-preferences"),
                  oncommand: "Zotero.TitleWithoutArticles.openPreferences()",
                },
              },
            ],
          },
        ],
      },
    );

    toolbar.appendChild(button);
  }

  /**
   * Show info in the item pane
   */
  static registerItemPaneInfo() {
    Zotero.ItemPaneManager.registerSection({
      paneID: "sort-title-info",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: `${addon.data.config.addonRef}-itemPane-sort-title-label`,
        icon: "chrome://zotero/skin/16/universal/sort.svg",
      },
      sidenav: {
        l10nID: `${addon.data.config.addonRef}-itemPane-sort-title-label`,
        icon: "chrome://zotero/skin/20/universal/sort.svg",
      },
      onRender: ({ body, item, editable, tabType }) => {
        if (!item) return;

        const doc = body.ownerDocument;
        if (!doc) return;

        // Clear any existing content first
        body.innerHTML = "";

        const extra = item.getField("extra");
        const sortTitle = extra ? extractSortTitleFromExtra(extra) : null;

        const container = doc.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "row";
        container.style.alignItems = "center";
        container.style.gap = "8px";

        const text = doc.createElement("div");
        text.style.flex = "1";
        text.textContent = sortTitle || getString("itemPane-no-sort-title");

        if (!sortTitle) {
          text.style.color = "#999";
          text.style.fontStyle = "italic";
        }

        if (editable) {
          const button = doc.createElement("button");
          button.textContent = sortTitle
            ? getString("button-regenerate")
            : getString("button-generate");
          button.style.fontSize = "11px";
          button.addEventListener("click", async () => {
            await UIFactory.processCurrentItem(item);
          });
          container.appendChild(button);
        }

        container.insertBefore(text, container.firstChild);
        body.appendChild(container);
      },
    });
  }

  /**
   * Process the current item
   */
  static async processCurrentItem(item: Zotero.Item) {
    const { processItem } = await import("./titleWithoutArticles");
    await processItem(item, true); // Force process for manual action
  }

  /**
   * Open preferences dialog
   */
  static openPreferences() {
    const win = ztoolkit.getGlobal("window");
    win.openDialog(
      "chrome://zotero/content/preferences/preferences.xhtml",
      "zotero-prefs",
      "chrome,titlebar,toolbar,centerscreen",
      {
        pane: `zotero-prefpane-${addon.data.config.addonRef}`,
      },
    );
  }
}
