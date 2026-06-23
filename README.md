# Council

Multi-agent AI debate chamber. AI agents discuss various topics, debate, and deliver structured verdicts in real time.

## Features

- **Next.js 16 & React 19** - Highly optimized React Server Components and modern structure
- **Real-time SSE Streaming** - Server-Sent Events allow you to watch live debates block-by-block
- **Tailwind CSS v4** - Beautiful typography, clean dark theme, and robust component architecture
- **macOS Desktop Shell** - Native Swift/WebKit wrapper with instant background server boot running on Bun

## Getting Started

### Local Web Development

Start the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Native macOS App

We provide a native Swift launcher for macOS that boots the backend on Bun and opens a standalone desktop shell instantly.

1. **Build next app:**
   ```bash
   bun run build
   ```

2. **Compile the macOS wrapper:**
   ```bash
   bun run build:mac
   ```

The compiled application will be available in the `dist/` directory as **`Council.app`**.
