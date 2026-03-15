# Contributing to MarkBun

Thank you for your interest in contributing to MarkBun! This document provides guidelines and instructions for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.0+ installed
- Git
- macOS 11+, Windows 10+, or Linux

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/markbun.git
   cd markbun
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run in development mode**
   ```bash
   # With HMR (recommended for UI development)
   bun run dev:hmr
   
   # Without HMR
   bun run dev
   ```

## 🏗️ Project Structure

```
markbun/
├── src/
│   ├── bun/              # Main process (Bun/Electrobun)
│   │   └── index.ts      # Entry point
│   └── mainview/         # Renderer process (React)
│       ├── App.tsx       # Main component
│       ├── main.tsx      # React entry
│       └── index.css     # Styles
├── doc/                  # Documentation
├── electrobun.config.ts  # Electrobun configuration
└── package.json
```

## 📝 Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow the existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic

### Commit Messages

We follow conventional commits:

```
feat: Add new feature
fix: Fix a bug
docs: Update documentation
style: Code style changes
refactor: Code refactoring
test: Add or update tests
chore: Build process or auxiliary tool changes
```

Example:
```
feat: Add file explorer sidebar component

- Implement folder tree navigation
- Add file open/save handlers
- Style with Tailwind CSS
```

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

## 🧪 Testing

Before submitting a PR:

1. Test your changes in both HMR and non-HMR modes
2. Verify the app builds successfully:
   ```bash
   bun run build:canary
   ```
3. Check for TypeScript errors:
   ```bash
   bun run tsc --noEmit
   ```

## 📤 Submitting Changes

1. Create a new branch for your feature/fix
2. Make your changes with clear commit messages
3. Push to your fork
4. Open a Pull Request with:
   - Clear description of changes
   - Screenshots (if UI changes)
   - Reference to any related issues

## 🎯 Current Development Focus

We're currently working on MVP (v0.1.0):

- [ ] Milkdown WYSIWYG editor integration
- [ ] Basic file open/save functionality
- [ ] Simple toolbar with formatting buttons
- [ ] Dark/light mode toggle

Check the [ROADMAP.md](./ROADMAP.md) for more details.

## 💬 Communication

- Open an issue for bug reports or feature requests
- Use discussions for questions and ideas
- Be respectful and constructive

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make MarkBun better! 🎉
