// MarkBun help documentation content
// Embedded as a TypeScript string to ensure it's always bundled
export const HELP_CONTENT = `# MarkBun Help

MarkBun is a lightweight Markdown writing app designed for focused, distraction-free writing.

---

## Getting Started

### New File

- Menu: **File → New** (\`⌘N\`)
- New files are untitled until saved

### Open File

- **File → Open** (\`⌘O\`) — open a single Markdown file
- **File → Open Folder** (\`⌘⇧O\`) — load a folder into the sidebar
- **File → Quick Open** (\`⌘P\`) — fuzzy-search recent and workspace files

### Save File

- **Save** (\`⌘S\`) — save to the current path
- **Save As** (\`⌘⇧S\`) — choose a new path
- **Auto Save** — enable in Preferences; saves every 2 seconds by default

---

## Editor

MarkBun uses the [Milkdown](https://milkdown.dev/) editor for rich Markdown editing.

### Source Mode

Press \`⌘/\` or use **View → Source Mode** to switch to plain-text Markdown editing.

### Formatting Shortcuts

| Format | Shortcut |
|--------|----------|
| Bold | \`⌘B\` |
| Italic | \`⌘I\` |
| Inline Code | \`⌘⇧C\` |
| Link | \`⌘K\` |
| Image | \`⌘⇧I\` |
| Strikethrough | \`⌘⇧~\` |
| Highlight | \`⌘⇧H\` |

### Paragraph Shortcuts

| Type | Shortcut |
|------|----------|
| Heading 1–6 | \`⌘1\` — \`⌘6\` |
| Paragraph | \`⌘0\` |
| Quote | \`⌥⌘Q\` |
| Ordered List | \`⌥⌘O\` |
| Unordered List | \`⌥⌘U\` |
| Task List | \`⌥⌘X\` |
| Code Block | \`⌥⌘C\` |
| Math Block | \`⌥⌘B\` |
| Horizontal Rule | \`⌥⌘-\` |
| Insert Table | \`⌥⌘T\` |

---

## Sidebar

- Toggle with \`⌘B\` or **View → Show Sidebar**
- **Files** tab — browse the workspace file tree
- **Outline** tab — navigate headings in the current document
- **Search** tab — search files in the workspace

---

## Multiple Windows

- **File → New Window** (\`⌘⇧N\`) — open an independent editor window
- Each window maintains its own file state and history

---

## View Options

- **Toggle Dark Mode** (\`⌘⇧T\`) — switch between light and dark themes
- **Show Title Bar** — toggle the window title bar
- **Show Tool Bar** — toggle the formatting toolbar
- **Show Status Bar** — toggle the bottom word-count bar
- **Developer Tools** (\`⌘⌥I\`) — open the WebView inspector

---

## Backup & Recovery

MarkBun uses a three-layer file protection system:

1. **Atomic Write** — writes to a temp file then renames, preventing corruption on interrupted saves
2. **Crash Recovery** — periodically snapshots your work; on restart, prompts to restore unsaved changes
3. **Version History** — creates a backup on every save; browse and restore via **File → History**

Recovery files: \`~/.config/markbun/recovery/\`
Version backups: \`~/.config/markbun/backups/\`

Configure backup behavior in **Preferences → Backup**.

---

## Preferences

Open with **MarkBun → Preferences** (\`⌘,\`):

- **Theme** — Light / Dark / System
- **Font Size** — editor font size
- **Line Height** — editor line spacing
- **Auto Save** — toggle and configure the save interval
- **Backup** — set max versions, retention days, and recovery write interval

---

## Recent Files

Use **File → Quick Open** (\`⌘P\`) to browse and reopen recently accessed files.

---

## About MarkBun

MarkBun is a desktop Markdown editor built with [Electrobun](https://electrobun.dev/),
powered by the Bun runtime and WebView (CEF) rendering engine.
`;
