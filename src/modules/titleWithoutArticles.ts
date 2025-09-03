/**
 * Get the list of articles from preferences
 */
function getArticlesFromPreferences(): string[] {
  try {
    // Get the articles preference value
    const articlesString = Zotero.Prefs.get(
      `${addon.data.config.prefsPrefix}.articles`,
      true,
    ) as string;

    if (!articlesString) {
      // Return default if preference is empty
      return ["a", "an", "the"];
    }

    // Split by comma and trim whitespace
    return articlesString
      .split(",")
      .map((article) => article.trim())
      .filter((article) => article.length > 0);
  } catch (error) {
    // Fallback to defaults if there's an error
    return ["a", "an", "the"];
  }
}

/**
 * Remove articles from the beginning of a title
 */
export function removeArticles(title: string): string {
  if (!title) return "";

  // Get articles from user preferences
  const articles = getArticlesFromPreferences();

  if (articles.length === 0) {
    return title;
  }

  // Create regex pattern to match articles at the beginning
  // Case-insensitive, followed by whitespace
  const pattern = new RegExp(
    `^(${articles.map((a) => escapeRegExp(a)).join("|")})\\s+`,
    "i",
  );

  return title.replace(pattern, "");
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get the sort title field name for Extra field
 */
export function getSortTitleFieldName(): string {
  return "title-without-articles";
}

/**
 * Extract sort-title from Extra field
 */
export function extractSortTitleFromExtra(extra: string): string | null {
  if (!extra) return null;

  const fieldName = getSortTitleFieldName();
  const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, "im");
  const match = extra.match(regex);

  return match ? match[1].trim() : null;
}

/**
 * Add or update sort-title in Extra field
 */
export function updateExtraWithSortTitle(
  extra: string,
  sortTitle: string,
): string {
  const fieldName = getSortTitleFieldName();
  const newLine = `${fieldName}: ${sortTitle}`;

  if (!extra) {
    return newLine;
  }

  // Check if sort-title already exists
  const regex = new RegExp(`^${fieldName}:.*$`, "im");

  if (regex.test(extra)) {
    // Replace existing sort-title
    return extra.replace(regex, newLine);
  } else {
    // Add sort-title at the beginning
    return newLine + "\n" + extra;
  }
}

/**
 * Remove sort-title from Extra field
 */
export function removeSortTitleFromExtra(extra: string): string {
  if (!extra) return "";

  const fieldName = getSortTitleFieldName();
  const regex = new RegExp(`^${fieldName}:.*\n?`, "gim");

  return extra.replace(regex, "").trim();
}

/**
 * Process a Zotero item to add or remove sort-title
 * @param forceProcess - If true, always process (for new items and manual actions). If false, only update existing fields.
 */
export async function processItem(
  item: any,
  forceProcess: boolean = false,
): Promise<boolean> {
  try {
    const title = item.getField("title");
    if (!title) return false;

    // Get current extra field
    let extra = item.getField("extra") || "";
    const currentSortTitle = extractSortTitleFromExtra(extra);

    // If not forcing and field doesn't exist, don't add it (respect user's choice)
    if (!forceProcess && currentSortTitle === null) {
      return false;
    }

    // Generate sort title based on current preferences
    const sortTitle = removeArticles(title);

    // Case 1: Sort title matches original title (no articles to remove)
    // Remove the field if it exists
    if (sortTitle === title) {
      if (currentSortTitle !== null) {
        // Remove the title-without-articles field since it's no longer needed
        extra = removeSortTitleFromExtra(extra);
        item.setField("extra", extra);
        await item.saveTx();
        return true;
      }
      return false;
    }

    // Case 2: Sort title is different from original
    // Update or add the field
    if (currentSortTitle !== sortTitle) {
      extra = updateExtraWithSortTitle(extra, sortTitle);
      item.setField("extra", extra);
      await item.saveTx();
      return true;
    }

    return false;
  } catch (error) {
    Zotero.logError(new Error(`Failed to process item ${item.id}: ${error}`));
    return false;
  }
}

/**
 * Process multiple items
 */
export async function processItems(
  items: any[],
  forceProcess: boolean = false,
): Promise<number> {
  let processed = 0;

  for (const item of items) {
    if (await processItem(item, forceProcess)) {
      processed++;
    }
  }

  return processed;
}

/**
 * Clear sort-title from a Zotero item
 */
export async function clearSortTitle(item: any): Promise<boolean> {
  try {
    const extra = item.getField("extra");
    if (!extra) return false;

    const newExtra = removeSortTitleFromExtra(extra);

    if (newExtra === extra) {
      return false; // No change needed
    }

    item.setField("extra", newExtra);
    await item.saveTx();

    return true;
  } catch (error) {
    Zotero.logError(
      new Error(`Failed to clear sort title for item ${item.id}: ${error}`),
    );
    return false;
  }
}

/**
 * Clear sort-title from multiple items
 */
export async function clearSortTitles(items: any[]): Promise<number> {
  let cleared = 0;

  for (const item of items) {
    if (await clearSortTitle(item)) {
      cleared++;
    }
  }

  return cleared;
}
