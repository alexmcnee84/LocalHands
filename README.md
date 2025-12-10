# LocalHands

Local AI assistant with Grok-style UI - built with Tauri v2 + React + TypeScript.

## Overview

LocalHands is a cross-platform desktop and mobile application that provides a clean, modern chat interface for interacting with AI models locally. Built on top of the OpenHands frontend architecture, it features a Grok-style UI with a responsive sidebar, chat interface, and support for both desktop (Windows, macOS, Linux) and mobile (Android) platforms.

## Features

- Modern Grok-style chat interface
- Responsive design with collapsible sidebar
- Dark theme optimized for extended use
- Cross-platform support (Windows, macOS, Linux, Android)
- Built with Tauri v2 for native performance
- React 19 + TypeScript for type-safe development
- Tailwind CSS for styling

## Project Structure

```
LocalHands/
├── src/                          # Frontend source code
│   ├── components/
│   │   ├── features/            # Feature-specific components
│   │   │   └── chat/            # Chat-related components
│   │   ├── shared/              # Shared layout components
│   │   └── ui/                  # Reusable UI components
│   ├── hooks/                   # Custom React hooks
│   ├── services/                # API and service layer
│   ├── stores/                  # State management
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Utility functions
│   ├── api/                     # API client code
│   └── context/                 # React context providers
├── src-tauri/                   # Tauri/Rust backend
│   ├── src/                     # Rust source code
│   ├── icons/                   # App icons
│   └── capabilities/            # Tauri capabilities
├── public/                      # Static assets
└── dist/                        # Build output
```

## Prerequisites

### For Desktop Development

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- Platform-specific dependencies:
  - **Linux**: `webkit2gtk`, `librsvg` - See [Tauri Linux Prerequisites](https://tauri.app/start/prerequisites/#linux)
  - **Windows**: WebView2 (usually pre-installed on Windows 10/11)
  - **macOS**: Xcode Command Line Tools

### For Android Development

- [Android Studio](https://developer.android.com/studio) with:
  - Android SDK
  - Android NDK
  - Java Development Kit (JDK)
- See [Tauri Android Prerequisites](https://tauri.app/start/prerequisites/#android) for detailed setup

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/alexmcnee84/LocalHands.git
cd LocalHands

# Install dependencies
npm install
```

### Development

```bash
# Start frontend development server only
npm run dev

# Start Tauri desktop development (recommended)
npm run dev:tauri

# Run TypeScript type checking
npm run lint
```

### Building

```bash
# Build frontend only
npm run build

# Build Tauri desktop application
npm run build:tauri
```

### Android Development

```bash
# Initialize Android project (requires Android SDK)
npm run android:init

# Start Android development
npm run android:dev

# Build Android APK
npm run android:build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) with extensions:
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Architecture

This project is based on the [OpenHands](https://github.com/All-Hands-AI/OpenHands) frontend architecture, adapted for a local-first AI assistant experience. Key architectural decisions:

- **Component Structure**: Feature-based organization with shared UI components
- **State Management**: React hooks and context for local state
- **Styling**: Tailwind CSS with custom theme colors matching the OpenHands design system
- **Backend**: Tauri v2 with Rust for native system access and performance

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [OpenHands](https://github.com/All-Hands-AI/OpenHands) - Frontend architecture inspiration
- [Tauri](https://tauri.app/) - Cross-platform application framework
- [React](https://react.dev/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
