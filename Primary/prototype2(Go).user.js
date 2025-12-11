// ==UserScript==
// @name         SteamDB Data Fork
// @namespace    https://steamdb.info/
// @version      0.2.3
// @description  Fetches Achievements/DLCs. Generates Tenoke, Goldberg, and RUNE configs.
// @author       SCN
// @match        https://steamdb.info/app/*
// @icon         https://steamdb.info/static/logos/192px.png
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// ==/UserScript==

(function ($) {
  "use strict";

  // =================================================================
  // 1. CONSTANTS & CONFIG
  // =================================================================
  const CONFIG = {
    CDN_BASE:
      "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps",
    BATCH_SIZE: 50,
    PREFIX: "sdb-fork",
  };

  const RUNE_ASCII = `###                                                                \\    /
###                       _  _                 _            _      \\\\__//
###      ____ ._/______:_//\\//_/____       _  //___  ./_ __//_____:_\\\\//
###     :\\  //_/    _  . /_/  /    /_/__:_//_/    /\\ /\\__/_    _  . /\\\\\\
###      \\\\///      ____/___./    / /     / /    /  /  \\X_/   //___/ /_\\_
###     . \\///   _______   _/_   /_/    _/_/     \\\\/   //        /_\\_\\  /.
###       z_/   _/\  _/   // /         //      /  \\   ///     __//   :\\//
###     | / _   / /\\//   /__//      __//_   _ /\\     /X/     /__/   |/\\/2
###   --+-_=\\__/ / /    / \\_____:__/ //\\____// /\\   /\\/__:_______=_-+--\\4
###     |-\\__\\- / /________\\____.__\\/- -\\--/_\\/_______\\--.\\________\\|___\\
###      = dS!\\/- -\\_______\\ =-RUNE- -== \\/ ==-\\______\\-= ======== --\\__\\
###`;

  // =================================================================
  // 2. STYLES
  // =================================================================
  GM_addStyle(`
        #${CONFIG.PREFIX}-trigger {
            position: fixed; bottom: 20px; right: 20px;
            background: #1b2838; color: #66c0f4; border: 1px solid #66c0f4;
            padding: 10px 20px; border-radius: 4px; font-weight: bold; cursor: pointer;
            z-index: 9999; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            font-family: "Motiva Sans", Arial, sans-serif;
            transition: all 0.2s;
        }
        #${CONFIG.PREFIX}-trigger:hover { background: #66c0f4; color: #fff; transform: translateY(-2px); }

        #${CONFIG.PREFIX}-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); z-index: 10000;
            justify-content: center; align-items: center;
        }
        #${CONFIG.PREFIX}-overlay.active { display: flex; }

        #${CONFIG.PREFIX}-modal {
            background: #16202d; width: 700px; max-height: 90vh;
            display: flex; flex-direction: column;
            border-radius: 6px; border: 1px solid #2a475e;
            font-family: "Motiva Sans", Arial, sans-serif; color: #c6d4df;
            box-shadow: 0 0 40px rgba(0,0,0,0.5);
        }

        .${CONFIG.PREFIX}-header {
            padding: 15px 20px; background: #101822; border-bottom: 1px solid #2a475e;
            display: flex; justify-content: space-between; align-items: center;
        }
        .${CONFIG.PREFIX}-header h3 { margin: 0; color: #fff; font-size: 18px; }
        .${CONFIG.PREFIX}-close { cursor: pointer; font-size: 24px; color: #67c1f5; }
        .${CONFIG.PREFIX}-close:hover { color: #fff; }

        .${CONFIG.PREFIX}-nav { display: flex; background: #1b2838; border-bottom: 1px solid #000; }
        .${CONFIG.PREFIX}-nav-item {
            flex: 1; padding: 15px; text-align: center; cursor: pointer; color: #8f98a0;
            border-bottom: 3px solid transparent; font-weight: bold; font-size: 14px;
            transition: background 0.2s;
        }
        .${CONFIG.PREFIX}-nav-item:hover { background: #233246; color: #fff; }
        .${CONFIG.PREFIX}-nav-item.active { border-bottom-color: #66c0f4; color: #fff; background: #233246; }

        .${CONFIG.PREFIX}-body { padding: 20px; overflow-y: auto; flex-grow: 1; min-height: 400px; }
        .${CONFIG.PREFIX}-tab { display: none; }
        .${CONFIG.PREFIX}-tab.active { display: block; }

        .${CONFIG.PREFIX}-controls {
            display: flex; margin-bottom: 10px; align-items: center;
            flex-wrap: nowrap; width: 100%; box-sizing: border-box;
        }

        /* Direct children spacing (replaces gap to allow full collapse) */
        .${CONFIG.PREFIX}-controls > * { margin-right: 8px; }
        .${CONFIG.PREFIX}-controls > *:last-child { margin-right: 0; }

        .${CONFIG.PREFIX}-select {
            flex-grow: 1; height: 36px; padding: 0 35px 0 10px;
            background-color: #000; color: #fff; border: 1px solid #444; border-radius: 3px;
            outline: none; cursor: pointer; font-size: 13px;
            appearance: none; -webkit-appearance: none; -moz-appearance: none;
            background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
            background-repeat: no-repeat; background-position: right 12px center; background-size: 10px;
        }
        .${CONFIG.PREFIX}-select:disabled { opacity: 0.5; cursor: not-allowed; }

        .${CONFIG.PREFIX}-checkbox-label {
            display: flex; align-items: center; gap: 5px; cursor: pointer;
            font-size: 13px; user-select: none; color: #8f98a0; white-space: nowrap;
        }
        .${CONFIG.PREFIX}-checkbox-label:hover { color: #fff; }
        .${CONFIG.PREFIX}-checkbox-label.disabled { opacity: 0.5; cursor: not-allowed; }
        .${CONFIG.PREFIX}-checkbox { accent-color: #66c0f4; width: 16px; height: 16px; margin: 0; cursor: pointer; }
        .${CONFIG.PREFIX}-checkbox:disabled { cursor: not-allowed; }

        .${CONFIG.PREFIX}-btn {
            padding: 0 16px; height: 36px; line-height: 36px;
            border: none; border-radius: 3px; cursor: pointer; font-weight: bold; color: #fff;
            transition: background 0.2s; position: relative; overflow: hidden; font-size: 13px;
            white-space: nowrap;
        }
        .${CONFIG.PREFIX}-btn-primary { background: #66c0f4; color: #000; }
        .${CONFIG.PREFIX}-btn-primary:hover { background: #fff; }
        .${CONFIG.PREFIX}-btn-secondary { background: #3a4b5d; }
        .${CONFIG.PREFIX}-btn-secondary:hover { background: #4b627a; }
        .${CONFIG.PREFIX}-btn:disabled { opacity: 0.8; cursor: not-allowed; color: #ddd; }

        .${CONFIG.PREFIX}-btn.pause-mode { background: #f39c12; color: #fff; }
        .${CONFIG.PREFIX}-btn.pause-mode:hover { background: #d68910; }
        .${CONFIG.PREFIX}-btn.resume-mode { background: #27ae60; color: #fff; }
        .${CONFIG.PREFIX}-btn.resume-mode:hover { background: #2ecc71; }
        .${CONFIG.PREFIX}-btn.cancel-mode { background: #c0392b; color: #fff; }
        .${CONFIG.PREFIX}-btn.cancel-mode:hover { background: #e74c3c; }

        .${CONFIG.PREFIX}-textarea {
            width: 100%; height: 350px; background: #0d121a; color: #a6b2be;
            border: 1px solid #444; padding: 10px; box-sizing: border-box;
            font-family: Consolas, monospace; font-size: 12px; resize: vertical; white-space: pre;
        }

        .${CONFIG.PREFIX}-footer { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
        #${CONFIG.PREFIX}-status { color: #8f98a0; text-align: right; }
        #${CONFIG.PREFIX}-footer-stats { color: #66c0f4; font-weight: bold; font-size: 12px; }

        /* --- Transitions for Download UI --- */

        /* Items that hide: Smoothly collapse to 0 width/margin */
        .${CONFIG.PREFIX}-trans-hide {
            transition: all 0.3s ease-in-out;
            max-width: 300px;
            opacity: 1;
            margin-right: 8px; /* Standard gap */
            visibility: visible;
        }

        /* Items that show: Smoothly expand from 0 width */
        .${CONFIG.PREFIX}-trans-show {
            transition: all 0.3s ease-in-out;
            max-width: 0;
            opacity: 0;
            overflow: hidden;
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin: 0 !important;
            border-width: 0 !important;
            white-space: nowrap;
            visibility: hidden;
            pointer-events: none;
        }

        /* The main button: Acts as "gas", fills empty space */
        .${CONFIG.PREFIX}-btn-grow {
            transition: flex-grow 0.3s ease-in-out, background 0.3s ease;
            flex-grow: 1; /* Always flexible */
        }

        /* --- Active Downloading State (.sdb-fork-downloading) --- */

        /* Collapse hidden items completely */
        .${CONFIG.PREFIX}-downloading .${CONFIG.PREFIX}-trans-hide {
            max-width: 0;
            opacity: 0;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            visibility: hidden;
            pointer-events: none;
        }

        /* Expand hidden buttons */
        .${CONFIG.PREFIX}-downloading .${CONFIG.PREFIX}-trans-show {
            max-width: 120px;
            opacity: 1;
            padding: 0 16px !important;
            margin-left: 8px !important; /* Restore gap */
            visibility: visible;
            pointer-events: auto;
        }
    `);

  // =================================================================
  // 3. NETWORK MODULE
  // =================================================================
  const Network = {
    fetchBuffer: (url) => {
      return new Promise((resolve) => {
        if (!url) return resolve(null);
        // GM_XHR only (No Console Spam)
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          responseType: "arraybuffer",
          onload: (res) =>
            resolve(res.status === 200 ? new Uint8Array(res.response) : null),
          onerror: () => resolve(null),
        });
      });
    },

    fetchText: (url) => {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "text/html",
          },
          onload: (res) => {
            if (res.status === 200) resolve(res.responseText);
            else reject(`HTTP ${res.status}`);
          },
          onerror: (err) => reject("Network Error"),
        });
      });
    },
  };

  // =================================================================
  // 4. PARSER MODULE
  // =================================================================
  const Parser = {
    cleanHtml(htmlString) {
      return htmlString.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
    },

    achievements(htmlString, appId) {
      const safeHtml = this.cleanHtml(htmlString);
      const doc = new DOMParser().parseFromString(safeHtml, "text/html");
      const $doc = $(doc);
      const list = [];

      $doc.find(".achievement_inner").each((i, el) => {
        const $el = $(el);
        const apiName = $el.find(".achievement_api").text().trim();
        const displayName = $el.find(".achievement_name").text().trim();
        let description = $el.find(".achievement_desc").text().trim();

        const $spoiler = $el.find(".achievement_spoiler");
        const isHidden = $spoiler.length > 0;
        if (isHidden) description = $spoiler.text().trim();

        const iconBase = $el.find(".achievement_image").attr("data-name");
        const iconGrayBase = $el
          .closest(".achievement")
          .find(".achievement_checkmark .achievement_image_small")
          .attr("data-name");

        if (apiName) {
          list.push({
            apiName,
            displayName,
            description,
            hidden: isHidden,
            iconUrl: iconBase
              ? `${CONFIG.CDN_BASE}/${appId}/${iconBase}`
              : null,
            iconGrayUrl: iconGrayBase
              ? `${CONFIG.CDN_BASE}/${appId}/${iconGrayBase}`
              : null,
            iconBase,
            iconGrayBase,
          });
        }
      });
      return list;
    },

    dlcs(htmlString) {
      const safeHtml = this.cleanHtml(htmlString);
      const doc = new DOMParser().parseFromString(
        `<table>${safeHtml}</table>`,
        "text/html"
      );
      const $doc = $(doc);
      const list = [];

      $doc.find("tr.app[data-appid]").each((i, el) => {
        const $el = $(el);
        const id = $el.attr("data-appid");
        let $td = $el.find("td:nth-of-type(3)");
        let name = $td.find("a b").first().text().trim();

        if (!name) name = $td.find("a").first().text().trim();
        if (!name) {
          let clone = $td.clone();
          clone.find(".muted, .label").remove();
          name = clone.text().trim();
        }

        if (id && name) list.push({ id, name });
      });
      return list;
    },
  };

  // =================================================================
  // 5. GENERATORS MODULE
  // =================================================================
  const Generators = {
    // --- ACHIEVEMENTS ---
    tenoke_ach: {
      type: "ach",
      name: "Tenoke (.ini)",
      supportsIcons: true,
      render: (data) => {
        let out = "";
        data.forEach((ach) => {
          out += `[ACHIEVEMENTS.${ach.apiName}]\n`;
          if (ach.iconBase) out += `icon = "${ach.iconBase}"\n`;
          if (ach.iconGrayBase) out += `icon_gray = "${ach.iconGrayBase}"\n`;
          if (ach.hidden) out += `hidden = "1"\n`;
          out += `\n[ACHIEVEMENTS.${ach.apiName}.name]\nenglish = "${ach.displayName}"\n\n`;
          out += `[ACHIEVEMENTS.${ach.apiName}.desc]\nenglish = "${ach.description}"\n\n`;
        });
        return out.trim();
      },
      getFileName: (ach, type) =>
        type === "main" ? ach.iconBase : ach.iconGrayBase,
    },

    json_ach: {
      type: "ach",
      name: "Goldberg / JSON (.json)",
      supportsIcons: true,
      render: (data) => {
        const achievements = data.map((ach) => ({
          hidden: ach.hidden ? 1 : 0,
          displayName: { english: ach.displayName },
          description: { english: ach.description },
          icon_gray: ach.iconGrayBase ? `img/${ach.iconGrayBase}` : "",
          icon: ach.iconBase ? `img/${ach.iconBase}` : "",
          name: ach.apiName,
        }));
        return JSON.stringify(achievements, null, 2);
      },
      getFileName: (ach, type) =>
        type === "main" ? ach.iconBase : ach.iconGrayBase,
    },

    // --- DLC ---
    tenoke_dlc: {
      type: "dlc",
      name: "Tenoke (.ini)",
      filename: "tenoke.ini",
      render: (data) => {
        if (!data.length) return "";
        let out = "[DLC]\n";
        data.forEach((d) => (out += `${d.id} = "${d.name}"\n`));
        return out;
      },
    },
    goldberg_dlc: {
      type: "dlc",
      name: "Goldberg (.ini)",
      filename: "configs.app.ini",
      render: (data) => {
        let out = "[app::dlcs]\nunlock_all=0\n";
        if (data.length > 0) {
          data.forEach((d) => (out += `${d.id}=${d.name}\n`));
        }
        return out;
      },
    },
    rune_dlc: {
      type: "dlc",
      name: "RUNE (.ini)",
      filename: "steam_emu.ini",
      render: (data) => {
        let out =
          "[DLC]\n###\n### Automatically unlock all DLCs\n###\nDLCUnlockall=0\n###\n### Identifiers for DLCs\n###\n#ID=Name\n";
        data.forEach((d) => (out += `${d.id}=${d.name}\n`));
        return out;
      },
    },

    // --- FULL PACKAGES ---
    tenoke_ini: {
      type: "ini",
      name: "Tenoke Full Config",
      supportsIcons: true,
      render: (appInfo, dlcs, achs) => {
        let ini = `[TENOKE]\nid = ${appInfo.appId} # ${appInfo.gameName}\nuser = "TENOKE"\naccount = 0x1234\nuniverse = 1\naccount_type = 1\nlanguage = "english"\ncountry = "UK"\noverlay = false\n\n`;
        if (dlcs.length) ini += Generators.tenoke_dlc.render(dlcs) + "\n\n";
        if (achs.length) ini += Generators.tenoke_ach.render(achs);
        return ini.trim();
      },
    },
    goldberg_zip: {
      type: "ini",
      name: "Goldberg Full Package",
      supportsIcons: true,
      render: (appInfo, dlcs, achs) => {
        const ac = achs.length;
        const dc = dlcs.length;
        return `[Goldberg Configuration Package]\n\nClicking 'Download' will generate a ZIP containing:\n\n1. steam_settings/steam_appid.txt\n2. steam_settings/achievements.json (${ac} items)\n3. steam_settings/configs.app.ini (${dc} items)\n4. steam_settings/img/ (${
          ac * 2
        } images)\n\nNote: This saves time by organizing the folder structure automatically.`;
      },
    },
    rune_ini: {
      type: "ini",
      name: "RUNE Full Config",
      filename: "steam_emu.ini",
      supportsIcons: false,
      render: (appInfo, dlcs, achs) => {
        const id = appInfo.appId;
        let out = RUNE_ASCII + "\n\n";
        out += `###\n###\n### Game data is stored at %SystemDrive%\\Users\\Public\\Documents\\Steam\\RUNE\\${id}\n###\n\n`;
        out += `[Settings]\n###\n### Game identifier (http://store.steampowered.com/app/${id})\n###\nAppId=${id}\n`;
        out += `###\n### Steam Account ID, set it to 0 to get a random Account ID\n###\n#AccountId=0\n`;
        out += `### \n### Name of the current player\n###\nUserName=RUNE\n`;
        out += `###\n### Language that will be used in the game\n###\nLanguage=english\n`;
        out += `###\n### Enable lobby mode\n###\nLobbyEnabled=1\n`;
        out += `###\n### Lobby port to listen on\n###\n#LobbyPort=31183\n`;
        out += `###\n### Enable/Disable Steam overlay\n###\nOverlays=1\n`;
        out += `###\n### Set Steam connection to offline mode\n###\nOffline=0\n`;
        out += `###\nLegacyCallbacks=1\n###\n\n`;
        out += `[Interfaces]\n###\n### Steam Client API interface versions\n###\n###\n\n`;
        out += `[DLC]\n###\n### Automatically unlock all DLCs\n###\nDLCUnlockall=0\n`;
        out += `###\n### Identifiers for DLCs\n###\n#ID=Name\n`;
        if (dlcs.length) dlcs.forEach((d) => (out += `${d.id}=${d.name}\n`));
        out += `###\n\n[Crack]\n`;
        return out;
      },
    },
  };

  // =================================================================
  // 6. PACKAGER (DOWNLOAD & ZIP)
  // =================================================================
  const Packager = {
    // State tracking
    state: { active: false, stop: false, paused: false, resumeResolver: null },

    // Helper: Toggle UI Controls with Smooth CSS Transitions
    toggleControls(containerSelector, isDownloading) {
      const p = CONFIG.PREFIX;
      const $container = $(containerSelector);

      // Toggle state class on the container
      if (isDownloading) {
        $container.addClass(`${p}-downloading`);
        $container
          .find(`.${p}-btn-grow`)
          .prop("disabled", true)
          .text("Starting...");
        // Inputs disabled handled via css pointer-events or js prop
        $container
          .find(`select, input, button[id*="copy"]`)
          .prop("disabled", true);
      } else {
        $container.removeClass(`${p}-downloading`);
        // Reset main button text happens in caller
        $container
          .find(`select, input, button[id*="copy"]`)
          .prop("disabled", false);
      }
    },

    // Action: Cancel
    cancel() {
      if (this.state.active) {
        this.state.stop = true;
        if (this.state.resumeResolver) {
          this.state.resumeResolver();
        }
      }
    },

    // Action: Toggle Pause
    togglePause(btnSelector) {
      if (this.state.paused) {
        this.state.paused = false;
        if (this.state.resumeResolver) {
          this.state.resumeResolver();
          this.state.resumeResolver = null;
        }
        $(btnSelector)
          .text("Pause")
          .removeClass("resume-mode")
          .addClass("pause-mode");
      } else {
        this.state.paused = true;
        $(btnSelector)
          .text("Resume")
          .removeClass("pause-mode")
          .addClass("resume-mode");
      }
    },

    async fetchImagesWithProgress(achs, containerSelector, btnSelector) {
      this.state = {
        active: true,
        stop: false,
        paused: false,
        resumeResolver: null,
      };

      // Update UI to Download Mode (Transitions)
      this.toggleControls(containerSelector, true);

      const tasks = [];
      achs.forEach((ach) => {
        if (ach.iconUrl && ach.iconBase)
          tasks.push({ url: ach.iconUrl, name: ach.iconBase });
        if (ach.iconGrayUrl && ach.iconGrayBase)
          tasks.push({ url: ach.iconGrayUrl, name: ach.iconGrayBase });
      });

      const total = tasks.length;
      let completed = 0;
      const downloadedData = {};
      const $statusBtn = $(btnSelector);

      const updateProgress = (pct) => {
        if (this.state.stop) return;
        const p = Math.floor(pct * 100);
        $statusBtn.text(`Downloading... ${p}%`);
        $statusBtn.css(
          "background",
          `linear-gradient(90deg, #66c0f4 ${p}%, #3a4b5d ${p}%)`
        );
      };

      try {
        for (let i = 0; i < tasks.length; ) {
          if (this.state.stop) throw new Error("CANCELLED");

          if (this.state.paused) {
            $statusBtn.text(
              `Paused (${Math.floor((completed / total) * 100)}%)`
            );
            await new Promise((res) => (this.state.resumeResolver = res));
            if (this.state.stop) throw new Error("CANCELLED");
          }

          const batch = tasks.slice(i, i + CONFIG.BATCH_SIZE);
          await Promise.all(
            batch.map(async (task) => {
              const buf = await Network.fetchBuffer(task.url);
              if (buf) downloadedData[task.name] = buf;
              completed++;
            })
          );

          updateProgress(completed / total);
          i += CONFIG.BATCH_SIZE;
        }
      } catch (e) {
        if (e.message === "CANCELLED") {
          $statusBtn.text("Cancelled").css("background", "");
          setTimeout(() => {
            this.toggleControls(containerSelector, false);
            $statusBtn
              .text($statusBtn.data("original-text"))
              .prop("disabled", false);
          }, 1000);
          this.state.active = false;
          return null;
        }
      }

      $statusBtn.text("Zipping...").css("background", "");
      return downloadedData;
    },

    async downloadTenoke(appInfo, dlcs, achs, withIcons, btnSelector) {
      const container = `#${CONFIG.PREFIX}-tab-ini .${CONFIG.PREFIX}-controls`;
      const iniContent = Generators.tenoke_ini.render(appInfo, dlcs, achs);

      // If icons are NOT requested, simply save the text file directly.
      if (!withIcons || achs.length === 0) {
        saveAs(
          new Blob([iniContent], { type: "text/plain;charset=utf-8" }),
          "tenoke.ini"
        );
        return;
      }

      const zip = {};
      zip["tenoke.ini"] = new TextEncoder().encode(iniContent);

      if (withIcons && achs.length > 0) {
        // Save original text to restore after download
        $(btnSelector).data("original-text", "Download");
        const icons = await this.fetchImagesWithProgress(
          achs,
          container,
          btnSelector
        );
        if (!icons) return;

        const innerZipData = {};
        for (const [name, buf] of Object.entries(icons))
          innerZipData[name] = buf;

        zip["icons.zip"] = await new Promise((res) =>
          fflate.zip(innerZipData, { level: 0 }, (err, data) => res(data))
        );
      }
      this.finalizeZip(zip, "tenoke_release.zip", container, btnSelector);
    },

    async downloadGoldberg(appInfo, dlcs, achs, withIcons, btnSelector) {
      const container = `#${CONFIG.PREFIX}-tab-ini .${CONFIG.PREFIX}-controls`;
      const zip = {};
      zip["steam_settings/steam_appid.txt"] = new TextEncoder().encode(
        appInfo.appId
      );

      if (achs.length > 0) {
        const json = Generators.json_ach.render(achs);
        zip["steam_settings/achievements.json"] = new TextEncoder().encode(
          json
        );
      }
      if (dlcs.length) {
        const ini = Generators.goldberg_dlc.render(dlcs);
        zip["steam_settings/configs.app.ini"] = new TextEncoder().encode(ini);
      }
      if (withIcons && achs.length > 0) {
        $(btnSelector).data("original-text", "Download");
        const icons = await this.fetchImagesWithProgress(
          achs,
          container,
          btnSelector
        );
        if (!icons) return;

        for (const [name, buf] of Object.entries(icons)) {
          zip[`steam_settings/img/${name}`] = buf;
        }
      }
      this.finalizeZip(zip, "steam_settings.zip", container, btnSelector);
    },

    async downloadIconsOnly(achs, presetKey, btnSelector) {
      const container = `#${CONFIG.PREFIX}-ach-image-row`;
      $(btnSelector).data("original-text", "Download Icons (Zip)");
      const icons = await this.fetchImagesWithProgress(
        achs,
        container,
        btnSelector
      );
      if (!icons) return;

      const preset = Generators[presetKey];
      const zip = {};

      achs.forEach((ach) => {
        if (icons[ach.iconBase])
          zip[preset.getFileName(ach, "main")] = icons[ach.iconBase];
        if (icons[ach.iconGrayBase])
          zip[preset.getFileName(ach, "gray")] = icons[ach.iconGrayBase];
      });

      this.finalizeZip(zip, "icons.zip", container, btnSelector);
    },

    finalizeZip(zipData, filename, containerSelector, btnSelector) {
      fflate.zip(zipData, { level: 0, mem: 8 }, (err, data) => {
        if (err) alert("Zip error: " + err);
        else saveAs(new Blob([data], { type: "application/zip" }), filename);

        // Reset UI
        this.toggleControls(containerSelector, false);
        const $btn = $(btnSelector);
        $btn
          .text($btn.data("original-text"))
          .prop("disabled", false)
          .css("background", "");
        this.state.active = false;
      });
    },
  };

  // =================================================================
  // 7. MAIN APP CONTROLLER
  // =================================================================
  const App = {
    appId: null,
    gameName: "Unknown Game",
    achievements: [],
    dlcs: [],
    loader: null,
    uiBuilt: false,
    activeTab: "ach",
    iconState: false,

    init() {
      this.appId = $(".scope-app[data-appid]").attr("data-appid");
      if (!this.appId) return false;

      const nameEl = $('h1[itemprop="name"]');
      if (nameEl.length) this.gameName = nameEl.text().trim();

      this.loader = this.startPreload();
      this.injectButton();
    },

    async startPreload() {
      const [achRes, dlcRes] = await Promise.allSettled([
        Network.fetchText(
          `https://steamdb.info/api/RenderAppSection/?section=stats&appid=${this.appId}`
        ),
        Network.fetchText(
          `https://steamdb.info/api/RenderLinkedApps/?appid=${this.appId}`
        ),
      ]);

      if (achRes.status === "fulfilled")
        this.achievements = Parser.achievements(achRes.value, this.appId);
      if (dlcRes.status === "fulfilled") this.dlcs = Parser.dlcs(dlcRes.value);

      return { achCount: this.achievements.length, dlcCount: this.dlcs.length };
    },

    injectButton() {
      const $btn = $(
        `<div id="${CONFIG.PREFIX}-trigger">SteamDB Data Fork</div>`
      );
      $btn.on("click", () => this.openUI());
      $("body").append($btn);
    },

    openUI() {
      if (!this.uiBuilt) UI.build(this);
      $(`#${CONFIG.PREFIX}-overlay`).addClass("active");
      this.syncUI();
    },

    async syncUI() {
      const $status = $(`#${CONFIG.PREFIX}-status`);

      if (this.achievements.length || this.dlcs.length) {
        this.refreshAll();
        return;
      }

      $status.text("Waiting for background fetch...");
      $(`.${CONFIG.PREFIX}-textarea`).val("Loading...");

      try {
        const res = await this.loader;
        $status.text("Data loaded successfully.");
        this.refreshAll();
      } catch (e) {
        $status.text("Error!");
        $(`.${CONFIG.PREFIX}-textarea`).val("Error: " + e);
      }
    },

    refreshAll() {
      this.renderTab("ach");
      this.renderTab("dlc");
      this.renderTab("ini");
      this.updateFooter();
    },

    updateFooter() {
      const $stats = $(`#${CONFIG.PREFIX}-footer-stats`);
      if (this.activeTab === "ach") {
        const c = this.achievements.length;
        $stats.text(`${c} Achievements (${c * 2} Images)`);
      } else if (this.activeTab === "dlc") {
        $stats.text(`${this.dlcs.length} DLCs Found`);
      } else if (this.activeTab === "ini") {
        $stats.text(`Ready to generate full config`);
      }
    },

    renderTab(type) {
      const presetKey = $(`#${CONFIG.PREFIX}-${type}-preset`).val();
      const generator = Generators[presetKey];
      if (!generator) return;

      let out = "";

      if (type === "ach") {
        out = this.achievements.length
          ? generator.render(this.achievements)
          : "No achievements found.";
      } else if (type === "dlc") {
        out = generator.render(this.dlcs);
      } else if (type === "ini") {
        out = generator.render(
          { appId: this.appId, gameName: this.gameName },
          this.dlcs,
          this.achievements
        );
      }

      $(`#${CONFIG.PREFIX}-${type}-output`).val(out);
    },
  };

  // =================================================================
  // 8. UI BUILDER
  // =================================================================
  const UI = {
    build(ctx) {
      const p = CONFIG.PREFIX;

      // Helper to generate options
      const getOptions = (type) => {
        return Object.entries(Generators)
          .filter(([key, gen]) => gen.type === type)
          .map(([key, gen]) => `<option value="${key}">${gen.name}</option>`)
          .join("");
      };

      const modal = `
                <div id="${p}-overlay">
                    <div id="${p}-modal">
                        <div class="${p}-header">
                            <h3>SteamDB Data Fork</h3>
                            <span class="${p}-close">&times;</span>
                        </div>
                        <div class="${p}-nav">
                            <div class="${p}-nav-item active" data-tab="ach">Achievements</div>
                            <div class="${p}-nav-item" data-tab="dlc">DLC</div>
                            <div class="${p}-nav-item" data-tab="ini">Full Config</div>
                        </div>
                        <div class="${p}-body">
                            <!-- Achievements -->
                            <div id="${p}-tab-ach" class="${p}-tab active">
                                <div class="${p}-controls">
                                    <select id="${p}-ach-preset" class="${p}-select">
                                        ${getOptions("ach")}
                                    </select>
                                    <button id="${p}-btn-ach-copy" class="${p}-btn ${p}-btn-secondary">Copy</button>
                                    <button id="${p}-btn-ach-save" class="${p}-btn ${p}-btn-primary">Save</button>
                                </div>
                                <textarea id="${p}-ach-output" class="${p}-textarea" readonly>Loading...</textarea>
                                <div id="${p}-ach-image-row" class="${p}-controls" style="margin-top:15px; display:flex;">
                                    <button id="${p}-btn-img" class="${p}-btn ${p}-btn-secondary ${p}-btn-grow" style="flex-grow:1">Download Icons (Zip)</button>
                                    <button id="${p}-btn-ach-pause" class="${p}-btn pause-mode ${p}-trans-show">Pause</button>
                                    <button id="${p}-btn-ach-cancel" class="${p}-btn cancel-mode ${p}-trans-show">Cancel</button>
                                </div>
                            </div>
                            <!-- DLC -->
                            <div id="${p}-tab-dlc" class="${p}-tab">
                                <div class="${p}-controls">
                                    <select id="${p}-dlc-preset" class="${p}-select">
                                        ${getOptions("dlc")}
                                    </select>
                                    <button id="${p}-btn-dlc-copy" class="${p}-btn ${p}-btn-secondary">Copy</button>
                                    <button id="${p}-btn-dlc-save" class="${p}-btn ${p}-btn-primary">Save</button>
                                </div>
                                <textarea id="${p}-dlc-output" class="${p}-textarea" readonly>Loading...</textarea>
                            </div>
                            <!-- Config -->
                            <div id="${p}-tab-ini" class="${p}-tab">
                                <div class="${p}-controls">
                                    <select id="${p}-ini-preset" class="${p}-select ${p}-trans-hide">
                                        ${getOptions("ini")}
                                    </select>
                                    <label class="${p}-checkbox-label ${p}-trans-hide" id="${p}-ini-icons-label">
                                        <input type="checkbox" id="${p}-ini-include-icons" class="${p}-checkbox">
                                        Include Icons
                                    </label>
                                    <button id="${p}-btn-ini-copy" class="${p}-btn ${p}-btn-secondary ${p}-trans-hide">Copy</button>
                                    <button id="${p}-btn-ini-save" class="${p}-btn ${p}-btn-primary ${p}-btn-grow">Download</button>
                                    <button id="${p}-btn-ini-pause" class="${p}-btn pause-mode ${p}-trans-show">Pause</button>
                                    <button id="${p}-btn-ini-cancel" class="${p}-btn cancel-mode ${p}-trans-show">Cancel</button>
                                </div>
                                <textarea id="${p}-ini-output" class="${p}-textarea" readonly>Loading...</textarea>
                            </div>
                            <!-- Footer -->
                            <div class="${p}-footer">
                                <div id="${p}-footer-stats"></div>
                                <div id="${p}-status">Ready</div>
                            </div>
                        </div>
                    </div>
                </div>`;
      $("body").append(modal);
      this.bindEvents(ctx);
      ctx.uiBuilt = true;
    },

    bindEvents(ctx) {
      const p = CONFIG.PREFIX;

      // Close (Auto-Cancel Logic)
      const closeModal = () => {
        $(`#${p}-overlay`).removeClass("active");
        Packager.cancel();
      };

      $(`.${p}-close, #${p}-overlay`).on("click", (e) => {
        if (e.target === e.currentTarget) closeModal();
      });
      $(document).on("keydown", (e) => {
        if (e.key === "Escape" && $(`#${p}-overlay`).hasClass("active"))
          closeModal();
      });

      // Tabs
      $(`.${p}-nav-item`).on("click", (e) => {
        const tab = $(e.currentTarget).data("tab");
        ctx.activeTab = tab;
        $(`.${p}-nav-item`).removeClass("active");
        $(e.currentTarget).addClass("active");
        $(`.${p}-tab`).removeClass("active");
        $(`#${p}-tab-${tab}`).addClass("active");
        ctx.updateFooter();
      });

      // Icons Checkbox Toggle
      $(`#${p}-ini-include-icons`).on("change", function () {
        ctx.iconState = $(this).is(":checked");
      });

      // Presets Change
      $(`select[id^="${p}-"]`).on("change", (e) => {
        const key = $(e.currentTarget).val();
        if (e.currentTarget.id === `${p}-ini-preset`) {
          const gen = Generators[key];
          const $cb = $(`#${p}-ini-include-icons`);
          const $lbl = $(`#${p}-ini-icons-label`);

          if (gen && gen.supportsIcons === false) {
            $cb.prop("checked", false).prop("disabled", true);
            $lbl.addClass("disabled");
          } else {
            $cb.prop("disabled", false).prop("checked", ctx.iconState);
            $lbl.removeClass("disabled");
          }
        }
        ctx.refreshAll();
      });

      // Copy Buttons
      $(`button[id*="-copy"]`).on("click", (e) => {
        const target = $(e.currentTarget)
          .attr("id")
          .replace("-btn-", "-")
          .replace("-copy", "-output");
        GM_setClipboard($(`#${target}`).val());
        const old = $(e.currentTarget).text();
        $(e.currentTarget).text("Copied!");
        setTimeout(() => $(e.currentTarget).text(old), 1000);
      });

      // Standalone Save Buttons
      $(`#${p}-btn-ach-save`).on("click", () => {
        const key = $(`#${p}-ach-preset`).val();
        const fname = key.includes("tenoke")
          ? "tenoke_achievements.ini"
          : "achievements.json";
        saveAs(
          new Blob([$(`#${p}-ach-output`).val()], {
            type: "text/plain;charset=utf-8",
          }),
          fname
        );
      });

      $(`#${p}-btn-dlc-save`).on("click", () => {
        const key = $(`#${p}-dlc-preset`).val();
        const fname = Generators[key].filename || "dlc_list.ini";
        saveAs(
          new Blob([$(`#${p}-dlc-output`).val()], {
            type: "text/plain;charset=utf-8",
          }),
          fname
        );
      });

      // Download Actions

      // 1. Achievements Tab Image Download
      $(`#${p}-btn-img`).on("click", () => {
        const key = $(`#${p}-ach-preset`).val();
        Packager.downloadIconsOnly(ctx.achievements, key, `#${p}-btn-img`);
      });

      // 2. Full Config Tab Download
      $(`#${p}-btn-ini-save`).on("click", () => {
        const key = $(`#${p}-ini-preset`).val();
        const withIcons = $(`#${p}-ini-include-icons`).is(":checked");
        const btnId = `#${p}-btn-ini-save`;

        if (key === "goldberg_zip") {
          Packager.downloadGoldberg(
            { appId: ctx.appId },
            ctx.dlcs,
            ctx.achievements,
            withIcons,
            btnId
          );
        } else if (key === "tenoke_ini") {
          Packager.downloadTenoke(
            { appId: ctx.appId, gameName: ctx.gameName },
            ctx.dlcs,
            ctx.achievements,
            withIcons,
            btnId
          );
        } else if (key === "rune_ini") {
          const content = $(`#${p}-ini-output`).val();
          saveAs(
            new Blob([content], { type: "text/plain;charset=utf-8" }),
            Generators.rune_ini.filename
          );
        }
      });

      // Global Pause/Cancel Handlers
      // Using wildcards to catch both ach and ini buttons
      $(`button[id*="-pause"]`).on("click", function (e) {
        Packager.togglePause(this);
      });

      $(`button[id*="-cancel"]`).on("click", function () {
        Packager.cancel();
      });
    },
  };

  $(document).ready(() => App.init());
})(jQuery);
