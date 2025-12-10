# SteamDB Data Fork

A high-performance userscript for [SteamDB.info](https://steamdb.info/) that fetches app data and generates configuration files for various steam emulators and tools.

## 📥 Installation

1.  Install a userscript manager like **Tampermonkey** (Chrome/Edge/Firefox) or **Violentmonkey**.
2.  Click the button below to install the script:

[**👉 Install Script**](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/raw/main/steamdb-data-fork.user.js)

_(Note: If the link above doesn't work, ensure you are viewing the "Raw" file in the repository)._

---

## ⚡ Project Goals

This project is a complete refactor of the original "Get Data from Steam / SteamDB" script. The focus of this fork is **performance**, **stability**, and **modularity**.

- **Zero Console Spam:** HTML parsing is sanitized to prevent Content Security Policy (CSP) errors in the browser console.
- **Instant Loading:** Data is pre-fetched in the background immediately upon page load.
- **Parallel Downloads:** Uses a "fire-and-forget" parallel fetching strategy to max out bandwidth when downloading image assets.
- **Clean Parsing:** Aggressively cleans DLC names to remove SteamDB badges (e.g., "DLCForAppID") for cleaner output.

---

## 🛠 Features

### 1. Achievements Tool

- Fetches hidden and public achievements via internal APIs.
- **Icon Downloader:** Downloads all achievement icons (Locked & Unlocked) in parallel and bundles them into a ZIP file with zero compression (Store mode) for instant saving.
- Supports multiple output formats (JSON, INI).

### 2. DLC Tool

- Fetches the full DLC list regardless of which tab you are currently viewing.
- Sanitizes data to ensure only the DLC Name and ID are captured.

### 3. Full Configuration Generator

- Combines AppID, Name, DLCs, and Achievements into complete configuration files.
- **Automation:** Can generate comprehensive ZIP packages containing folder structures, images, and text files automatically.

---

## 🤝 Contributing & Adding New Presets

We welcome Pull Requests! The script is designed to be modular. You can easily add support for your preferred emulator or tool without touching the complex fetching logic.

### How to add a new config format

1.  Open the script source.
2.  Locate the `const Generators` object.
3.  Add your new key (e.g., `my_custom_emu`).

**Example Template:**

```javascript
my_custom_emu: {
    // 1. Define the text rendering logic
    render: (data) => {
        let output = "[MyConfig]\n";
        data.forEach(item => {
            output += `Item=${item.apiName}\n`;
        });
        return output;
    },
    // 2. Define image naming convention (if applicable)
    getFileName: (achievement, type) => {
        // type is 'main' or 'gray'
        // achievement.iconBase is the hash (e.g. 8d3a...jpg)
        return type === 'main' ? achievement.iconBase : achievement.iconGrayBase;
    }
}
```
