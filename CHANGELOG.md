# Changelog

All notable changes to MarkBun will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## \[0.5.0] - 2026-04-02

### Added

* Find & Replace in WYSIWYG mode with search highlighting (`Cmd/Ctrl + F`)
* Find & Replace support extended into code blocks via CodeMirror
* Unified Command Palette with fuzzy search, replacing Quick Open (`Cmd/Ctrl + P`)
* Command usage tracking and recommended commands in Command Palette
* Session persistence — cursor position and scroll state saved and restored between sessions
* Session state service with editor cursor/scroll APIs and save hook
* Windows platform support — custom frontend menu bar, icon embedding, and CI/release pipeline
* GitHub Actions release workflow for macOS and Windows
* Favicon and improved download page on website
* GitHub Pages deployment workflow for website
* Comprehensive editor action and table command tests with ProseMirror state mocks

### Fixed

* Fix replace operations and input field keyboard handling in search
* Wire up `Cmd+G` shortcut for Find Next and fix resource leaks
* Handle `Cmd+C/X` in input fields with proper clipboard support
* Update sidebar and dark mode keyboard shortcuts
* Trigger session save on content changes to prevent data loss
* Fix command palette to record usage and show recommended commands
* Embed icons into Windows executables and set window icon at runtime
* Fix Windows menu action routing and dropdown positioning
* Reload menu config after language change on Windows
* Refresh artifacts zip after embedding icon into Setup.exe

### Changed

* Consolidate version number into single `APP_VERSION` constant
* Bundle CEF only in production builds

## \[0.4.0] - 2026-03-26

### Added

* Three-layer file protection — atomic write, crash recovery, and version history
* Crash recovery dialog on startup
* Backup settings tab in Settings dialog
* Export to PNG image (2x scale via html2canvas)
* Export to HTML (with inline CSS via marked)
* Math equations — LaTeX inline (`$...$`) and block (`$$...$$`) with live preview
* Inline Formula menu item in Format menu
* Source mode with CodeMirror 6 editor (`Cmd/Ctrl + /`)
* Source mode toggle button in toolbar
* Toolbar buttons for strikethrough, highlight, image, table, and task list
* Dynamic font size and line height configuration
* Multi-window support with New Window menu
* Format submenu in context menus
* Help menu and About dialog with cross-platform support
* Full internationalization support for English and Chinese (8 locales: en, zh-CN, de, es, fr, ja, ko, pt)
* App icons, SVG logo, and stable build config
* Custom file dialog for export save
* Static website with landing, about, features, and download pages
* Copy Cell in table right-click context menu
* Open in Finder context menu in file explorer
* Cross-platform clipboard support for Windows and Linux

### Fixed

* Fix table operations when cursor is in header row
* Fix increase/decrease heading level commands and shortcuts
* Insert sample formula in math block so it renders visibly
* Merge UI state and pending file init to prevent sidebar race condition
* Use Intl API as fallback for locale detection on Windows
* Replace manual path splitting with `dirname()` for cross-platform paths
* Resolve path issues for Show in Explorer and relative images on Windows
* Enable CEF renderer on Linux platform

### Changed

* Remove PDF export and improve image export
* Exclude CEF renderer from release builds to reduce package size

## \[0.3.0] - 2026-03-15

### Added

* Auto-save with hybrid throttle/debounce strategy
* Configurable auto-save interval
* Settings UI with General, Editor, and Appearance tabs
* UI state persistence (sidebar width, visibility, active tab)
* Theme management (light/dark/system)
* Multi-monitor support with display detection and smart fallback
* Window position and size saved and restored on restart
* Table header styling
* Markdown file save mechanism improvements

### Changed

* Code and editor improvements

## \[0.2.0] - 2026-03-15

### Added

* File explorer sidebar with folder navigation
* Outline navigation panel — jump to any heading instantly
* Quick Open with fuzzy search (`Cmd/Ctrl + P`)
* Recent files persistence
* Drag and drop image support
* Image formatting
* Renamed project from PingWrite to MarkBun

### Changed

* Improved code editor experience

## \[0.1.0] - 2026-03-14

### Added

* Milkdown WYSIWYG markdown editor integration
* Commonmark and GFM (GitHub Flavored Markdown) support
* History plugin (undo/redo)
* Clipboard plugin (copy/paste)
* Basic file operations (New, Open, Save, Save As)
* Keyboard shortcuts for file operations
* Simple toolbar with formatting buttons
* Status bar with word count and save status indicator
* Title bar with document name
* Light mode default theme
* Dark mode support
* CSS variables for theming
* React + Vite + Tailwind CSS setup
* Development environment with HMR support
* MIT License and project documentation
