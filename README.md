# PingWrite

> 📝 A fast, beautiful, Typora-like markdown desktop editor

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Milkdown](https://img.shields.io/badge/Built%20with-Milkdown-orange)](https://milkdown.dev)
[![Powered by Electrobun](https://img.shields.io/badge/Powered%20by-Electrobun-purple)](https://electrobun.dev)

PingWrite is an open-source, cross-platform markdown editor designed for seamless writing. Like Typora, it provides a distraction-free WYSIWYG editing experience where markdown syntax fades away to reveal beautifully formatted content.

![PingWrite Preview](doc/assets/preview.png)

## ✨ Features

- 🎯 **Seamless WYSIWYG Editing** - Write markdown naturally without distraction
- ⚡ **Lightning Fast** - Built with Bun and native webviews for <50ms startup
- 🎨 **Beautiful Typography** - Carefully crafted themes and styles
- 📁 **File Management** - Built-in file browser with folder support
- 🔍 **Outline Navigation** - Jump to any heading instantly
- 🧮 **Math Support** - LaTeX equations with live preview
- 📊 **Tables** - Intuitive table editing
- 🌙 **Dark Mode** - Easy on the eyes for night writing
- 🖼️ **Image Support** - Drag and drop images
- 💾 **Auto Save** - Never lose your work
- ⌨️ **Keyboard Shortcuts** - Vim mode support (planned)

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- macOS 11+, Windows 10+, or Linux

### Installation

```bash
# Install dependencies
bun install

# Development without HMR (uses bundled assets)
bun run dev

# Development with HMR (recommended)
bun run dev:hmr
```

### Build

```bash
# Build for production
bun run build

# Build for production release
bun run build:prod
```

## How HMR Works

When you run `bun run dev:hmr`:

1. **Vite dev server** starts on `http://localhost:5173` with HMR enabled
2. **Electrobun** starts and detects the running Vite server
3. The app loads from the Vite dev server instead of bundled assets
4. Changes to React components update instantly without full page reload

When you run `bun run dev` (without HMR):

1. Electrobun starts and loads from `views://mainview/index.html`
2. You need to rebuild (`bun run build`) to see changes

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [Milkdown](https://milkdown.dev) | WYSIWYG Markdown editor core |
| [Electrobun](https://electrobun.dev) | Cross-platform desktop framework |
| [shadcn/ui](https://ui.shadcn.com) | UI component library |
| [Bun](https://bun.sh) | JavaScript runtime and bundler |
| [TypeScript](https://typescriptlang.org) | Type-safe development |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |

## 📁 Project Structure

```
pingwrite/
├── src/
│   ├── bun/                  
│   │   ├── index.ts          # Main process (Electrobun/Bun)
│   │   ├── menu.ts           # Application menus
│   │   ├── window.ts         # Window management
│   │   └── ipc/              # IPC handlers
│   │
│   ├── mainview/             # Renderer process (WebView)
│   │   ├── components/       # React components
│   │   │   ├── editor/       # Milkdown editor wrapper
│   │   │   ├── sidebar/      # File explorer
│   │   │   ├── toolbar/      # Editor toolbar
│   │   │   └── statusbar/    # Status bar
│   │   │
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities
│   │   ├── styles/           # Global styles
│   │   ├── main.tsx        # React entry point
│   │   ├── App.tsx           # Main App component
│   │   └── index.html        # HTML entry
│   │
│   └── shared/               # Shared types and utilities
│
├── doc/                      # Documentation
│   ├── architecture.md       # Architecture overview
│   └── assets/               # Documentation assets
│
├── resources/                # Static resources
│   ├── icons/                # App icons
│   └── themes/               # Editor themes
│
├── electrobun.config.ts      # Electrobun configuration
├── components.json           # shadcn/ui configuration
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
├── package.json
└── README.md
```

## 🎮 Usage

### Basic Editing

1. **New File**: `Cmd/Ctrl + N`
2. **Open File**: `Cmd/Ctrl + O`
3. **Save**: `Cmd/Ctrl + S`
4. **Save As**: `Cmd/Ctrl + Shift + S`

### Markdown Shortcuts

| Action | Shortcut |
|--------|----------|
| Bold | `Cmd/Ctrl + B` |
| Italic | `Cmd/Ctrl + I` |
| Code | `` Cmd/Ctrl + ` `` |
| Heading 1 | `Cmd/Ctrl + 1` |
| Heading 2 | `Cmd/Ctrl + 2` |
| Heading 3 | `Cmd/Ctrl + 3` |
| Bullet List | `Cmd/Ctrl + Shift + 8` |
| Numbered List | `Cmd/Ctrl + Shift + 7` |
| Quote | `Cmd/Ctrl + Shift + .` |
| Link | `Cmd/Ctrl + K` |

### Slash Commands

Type `/` anywhere to open the command palette:
- `/h1` - Insert heading 1
- `/table` - Insert table
- `/code` - Insert code block
- `/math` - Insert math block
- `/image` - Insert image

## 🎨 Customization

### Themes

PingWrite supports custom themes. Place your theme files in `~/.pingwrite/themes/`:

```css
/* ~/.pingwrite/themes/my-theme.css */
:root {
  --font-serif: "Georgia", serif;
  --font-sans: "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  
  --color-primary: #0066cc;
  --color-background: #ffffff;
  --color-text: #1a1a1a;
}
```

### Settings

Settings are stored in `~/.pingwrite/config.json`:

```json
{
  "theme": "default",
  "fontSize": 16,
  "lineHeight": 1.6,
  "autoSave": true,
  "autoSaveInterval": 30000,
  "showLineNumbers": false,
  "wordWrap": true
}
```

## 🛠️ Development

### Scripts

```bash
bun dev          # Start development server
bun build        # Build for production
bun build:all    # Build for all platforms
bun test         # Run tests
bun lint         # Run ESLint
bun format       # Format code with Prettier
```

### Adding shadcn Components

```bash
npx shadcn@latest add button tooltip dialog
```

### Adding Milkdown Plugins

```bash
bun add @milkdown/plugin-math
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Roadmap

### v0.1.0 (MVP)
- [ ] Basic WYSIWYG editing
- [ ] File open/save
- [ ] Markdown syntax support
- [ ] Dark mode

### v0.2.0
- [ ] File explorer sidebar
- [ ] Outline navigation
- [ ] Image drag & drop
- [ ] Math equations

### v0.3.0
- [ ] Table editing
- [ ] Auto-save
- [ ] Recent files
- [ ] Settings UI

### v1.0.0
- [ ] Vim mode
- [ ] Plugin system
- [ ] Custom themes
- [ ] Cloud sync

## 📄 License

PingWrite is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgements

- [Milkdown](https://milkdown.dev) - The amazing WYSIWYG markdown framework
- [Electrobun](https://electrobun.dev) - Ultra-fast desktop framework
- [shadcn/ui](https://ui.shadcn.com) - Beautiful React components
- [ProseMirror](https://prosemirror.net) - The foundation of Milkdown
- [Typora](https://typora.io) - Inspiration for the editing experience

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/xiaochong">@xiaochong</a>
</p>
