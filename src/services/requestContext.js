const hasAnyPattern = (message, patterns) => patterns.some((pattern) => pattern.test(message));

/**
 * Keep open-tool state only when the current request refers to that tool.
 * An open document is useful context for "update this sheet", but it must not
 * influence an unrelated request such as "create a Battleship simulation".
 */
export function filterRelevantActiveTools(userMessage, activeTools = {}) {
  const message = (userMessage || '').trim().toLowerCase();
  if (!message) return {};

  const spreadsheetRelevant = hasAnyPattern(message, [
    /\b(spreadsheet|excel|workbook|worksheet|sheet|csv|cell|row|column|formula)\b/,
    /\b(update|edit|modify|add|save|fix|format|calculate|sort|filter)\b.*\b(this|that|it|current|open)\b/,
  ]);

  const workspaceRelevant = hasAnyPattern(message, [
    /\b(browser|webpage|web page|website|site|tab|url|workspace)\b/,
    /\b(click|navigate|scroll|fill|submit|read)\b.*\b(this|that|it|page|site|tab)\b/,
  ]);

  const relevant = {};
  if (activeTools.spreadsheet && spreadsheetRelevant) {
    relevant.spreadsheet = activeTools.spreadsheet;
  }
  if (activeTools.workspace && workspaceRelevant) {
    relevant.workspace = activeTools.workspace;
  }
  return relevant;
}
