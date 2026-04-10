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

### 2️⃣ Start your Local Model (LM Studio)
Open the LM Studio app and download a local model with good coding capabilities (e.g., `Qwen 3.5 9B` or `Llama 3 8B Instruct`).
*Click the **Local Server** button from the LM Studio menu (usually on Port 1234) and start listening.*

*Warning:* Since massive tool sets (22K) may be sent to the model on the initial prompt, it is highly recommended to set the `Context Length (n_ctx)` tab to `32768` (32K) in the right-side configuration panel before loading the model.

### 3️⃣ Apply the Isolation Patch
The following command will scan your NPM folder in the background, copy the original cli code, and patch the directory paths (config and history paths) to `.ByIbosCode`. *Your original code will remain completely untouched.* Only a new decoupled adapter is generated!
```bash
node patch_cli.js
```
Once this step is complete, a new `byibos_cli.js` file will appear in your folder!

### 4️⃣ One-Click Start (Triple-Boot)
To awaken the system, simply double-click your `start.bat` file. 

```bash
# For Windows Users:
./start.bat
```

**What does `start.bat` do?**
1. It silently starts the model listening in the background via `lms server start` (if installed).
2. It spins up `local_proxy.js`, our real-time `Stream`-enabled Node.JS API Translator.
3. Finally, it launches the patched agent `byibos_cli.js`! Your assistant is now ready for use!

---

### FAQ (Frequently Asked Questions)

**Q: Why should I choose this repo over tools like LiteLLM?**
A: LiteLLM is bulky and slow. ByIbos's adapter directly translates Claude's `Server-Sent Events (SSE)` payload into OpenAI format (firing off real-time streams!) without using any 3rd party package dependencies—just pure Node.js `http`.

**Q: Is this patch legal?**
A: Yes! We do not display the original 12 MB `cli.js` code in our repository without permission (nor should you). We merely use the Node.JS FS utility to copy the file from your own native directory and perform memory-redirection modifications to derive `byibos_cli.js`! This is entirely DMCA friendly.

---
> 🦾 Coded with love for open-source by ByIbos Feel free to Fork!
