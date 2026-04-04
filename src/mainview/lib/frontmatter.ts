/**
 * Frontmatter conversion utilities
 *
 * Handles bidirectional conversion between YAML frontmatter (---\n...\n---)
 * and yaml code blocks (```yaml\n...\n```) for display in the editor.
 *
 * The editor displays frontmatter as a yaml code block, but saves/exports
 * it as standard YAML frontmatter. These utilities ensure clipboard output
 * uses the correct format.
 */

/**
 * Convert frontmatter to yaml code block for display in editor.
 * `---\ncontent\n---` → `` ```yaml\ncontent\n``` ``
 */
export function convertFrontmatterToCodeBlock(markdown: string): string {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
  const match = markdown.match(frontmatterRegex);

  if (match) {
    const frontmatter = match[1];
    const content = markdown.slice(match[0].length);
    return "```yaml\n" + frontmatter + "\n```\n" + content;
  }

  return markdown;
}

/**
 * Convert yaml code block back to frontmatter for saving/clipboard.
 * `` ```yaml\ncontent\n``` `` → `---\ncontent\n---`
 *
 * The `^` anchor ensures only a yaml code block at the very start of the
 * string is converted. This prevents false positives when copying partial
 * selections that happen to contain a yaml code block.
 */
export function convertCodeBlockToFrontmatter(markdown: string): string {
  // Match yaml code block at the very beginning of the document
  const codeBlockRegex = /^```yaml\s*\n([\s\S]*?)\n```\s*(?:\n|$)/;
  const match = markdown.match(codeBlockRegex);

  if (match) {
    const frontmatter = match[1];
    const content = markdown.slice(match[0].length);
    // Ensure frontmatter ends with newline before closing ---
    const normalizedFrontmatter = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
    return "---\n" + normalizedFrontmatter + "---\n\n" + content;
  }

  return markdown;
}
