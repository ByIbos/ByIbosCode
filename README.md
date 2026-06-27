[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![App](https://img.shields.io/badge/App-ByIbosCode-success.svg)]()

> **ByIbosCode** is an open adapter that connects Anthropic's official [Claude Code CLI](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) tool to open-source models (like `Qwen`, `Llama` etc.) running on your local machine (via LM Studio, etc.) in a **completely local**, **free**, and cloud-restriction-free environment.

Instead of stealing and distributing Anthropic's proprietary `cli.js` code, this repository acts ethically as a **"Patcher/Modder"**. It simply redirects the folder memory parameters of the official Claude script currently in your "NPM" folder, creating an isolated `.ByIbosCode` configuration system instead of the standard `.claude` system.

Then, a miniature `Local Proxy` with **real-time (True SSE Streaming)** support intervenes, instantaneously translating Claude's massive "26-Tool" schemas into the OpenAI format expected by LM Studio! Say goodbye to wallet-burning Cloud tokens!

---

## 💻 System Requirements

Before you begin, ensure the following software is installed on your computer:
1. **[Node.js](https://nodejs.org/)** (v18+)
2. **[LM Studio](https://lmstudio.ai/)** or any local server based on the OpenAI API.
3. Most importantly: `npm install -g @anthropic-ai/claude-code`

---

## ⚡ Quick Start Setup

After cloning or downloading this repository, open a terminal in the folder and execute the following steps:

### 1️⃣ Install Claude Code on your PC (Skip if already installed)
First, install Anthropic's original CLI application globally:
```bash
npm install -g @anthropic-ai/claude-code
```

### 2️⃣ Apply the Isolation Patch
The following command will scan your NPM folder in the background, copy the original CLI code, and patch the directory paths (config and history paths) to `.ByIbosCode`. *Your original code will remain completely untouched.* Only a new decoupled adapter is generated!
```bash
node patch_cli.js
```
Once this step is complete, a new `byibos_cli.js` file will appear in your folder!

### 3️⃣ Setup & Configuration Wizard
We provide an interactive wizard that automatically sets up the environment variables (`.env` file) for you. Run the wizard by launching the startup script:

```bash
# Double-click start.bat, or run via CLI:
node start.js
```

Upon first launch, it will guide you step-by-step:
1. **Choose your LLM Provider**:
   - **Option 1: LM Studio (Local)**
     - Enter LM Studio Port (default: `1234`)
     - Enter Model Name (default: `gemma4:e4b`)
     - Enter Target Project Directory to open Claude Code in.
   - **Option 2: Gemini API (Cloud)**
     - Enter your Gemini API Key (starts with `AIzaSy...`)
     - Enter Gemini Model Name (default: `gemini-1.5-flash`)
     - Enter Target Project Directory to open Claude Code in.
2. The configuration will be saved in a local `.env` file. Since `.env` is listed in `.gitignore`, **your API keys and secrets are never committed to GitHub**.
3. **Subsequent launches** will bypass the setup wizard and automatically load your saved configuration.
4. If you ever want to re-run the setup, simply launch the command with the setup flag:
   ```bash
   node start.js --setup
   # or
   node start.js -s
   ```

### 4️⃣ One-Click Start
To start your proxy server and launch the Claude CLI interface in one go, simply run:
```bash
# Run via start.bat (double-click) or CLI:
./start.bat
```
The startup sequence will:
1. Fire up `local_proxy.js` (listening on port `8082`).
2. Boot up `byibos_cli.js` in your target directory with the configured backend!

---

### FAQ (Frequently Asked Questions)

**Q: Why should I choose this repo over tools like LiteLLM?**
A: LiteLLM is bulky and slow. ByIbos's adapter directly translates Claude's `Server-Sent Events (SSE)` payload into OpenAI format (firing off real-time streams!) without using any 3rd party package dependencies—just pure Node.js `http`.

**Q: Is this patch legal?**
A: Yes! We do not display the original 12 MB `cli.js` code in our repository without permission (nor should you). We merely use the Node.JS FS utility to copy the file from your own native directory and perform memory-redirection modifications to derive `byibos_cli.js`! This is entirely DMCA friendly.

---
> 🦾 Coded with love for open-source by ByIbos Feel free to Fork!
