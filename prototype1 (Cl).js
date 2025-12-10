// ==UserScript==
// @name         SteamDB Data Tool (Fast DL)
// @namespace    https://steamdb.info/
// @version      2.5
// @description  Fetches Achievements/DLCs using the internal SteamDB API. Generates Tenoke/Codex INIs. "Instant" parallel downloads.
// @author       You
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
  // 1. CONFIG & STYLES
  // =================================================================
  const CDN_BASE =
    "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps";

  GM_addStyle(`
        /* Trigger Button */
        #sk-trigger {
            position: fixed; bottom: 20px; right: 20px;
            background: #1b2838; color: #66c0f4; border: 1px solid #66c0f4;
            padding: 10px 20px; border-radius: 4px; font-weight: bold; cursor: pointer;
            z-index: 9999; box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-family: "Motiva Sans", Arial, sans-serif;
            transition: all 0.2s;
        }
        #sk-trigger:hover { background: #66c0f4; color: #fff; transform: translateY(-2px); }

        /* Modal Overlay */
        #sk-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); z-index: 10000;
            justify-content: center; align-items: center; backdrop-filter: blur(2px);
        }
        #sk-overlay.active { display: flex; }

        /* Modal Box */
        #sk-modal {
            background: #16202d; width: 700px; max-height: 90vh; display: flex; flex-direction: column;
            border-radius: 6px; border: 1px solid #2a475e; box-shadow: 0 0 40px rgba(0,0,0,0.5);
            font-family: "Motiva Sans", Arial, sans-serif; color: #c6d4df;
        }

        /* Header */
        .sk-header {
            padding: 15px 20px; background: #101822; border-bottom: 1px solid #2a475e;
            display: flex; justify-content: space-between; align-items: center;
        }
        .sk-header h3 { margin: 0; color: #fff; font-size: 18px; }
        .sk-close { cursor: pointer; font-size: 24px; color: #67c1f5; line-height: 1; }
        .sk-close:hover { color: #fff; }

        /* Navigation */
        .sk-nav { display: flex; background: #1b2838; border-bottom: 1px solid #000; }
        .sk-nav-item {
            flex: 1; padding: 15px; text-align: center; cursor: pointer; color: #8f98a0;
            border-bottom: 3px solid transparent; font-weight: bold; font-size: 14px;
            transition: background 0.2s;
        }
        .sk-nav-item:hover { background: #233246; color: #fff; }
        .sk-nav-item.active { border-bottom-color: #66c0f4; color: #fff; background: #233246; }

        /* Content Area */
        .sk-body { padding: 20px; overflow-y: auto; flex-grow: 1; min-height: 400px; }
        .sk-tab { display: none; }
        .sk-tab.active { display: block; }

        /* Controls */
        .sk-controls { display: flex; gap: 10px; margin-bottom: 15px; }
        .sk-select {
            flex-grow: 1; padding: 8px; background: #000000; color: #fff;
            border: 1px solid #444; border-radius: 3px; outline: none;
        }
        .sk-btn {
            padding: 8px 16px; border: none; border-radius: 3px; cursor: pointer;
            font-weight: bold; color: #fff; transition: background 0.2s;
        }
        .sk-btn-primary { background: #66c0f4; color: #000; }
        .sk-btn-primary:hover { background: #fff; }
        .sk-btn-secondary { background: #3a4b5d; }
        .sk-btn-secondary:hover { background: #4b627a; }
        .sk-btn:disabled { opacity: 0.5; cursor: wait; }

        /* Textarea */
        .sk-textarea {
            width: 100%; height: 350px; background: #0d121a; color: #a6b2be;
            border: 1px solid #444; padding: 10px; box-sizing: border-box;
            font-family: Consolas, monospace; font-size: 12px; resize: vertical;
            white-space: pre;
        }

        /* Utility */
        .sk-info-bar { margin-top: 10px; font-size: 12px; color: #66c0f4; text-align: right; }
    `);

  // =================================================================
  // 2. DATA EXTRACTOR
  // =================================================================
  const Extractor = {
    appId: null,
    gameName: "Unknown Game",
    data: { achievements: [], dlcs: [] },
    loader: null,

    init() {
      this.appId = $(".scope-app[data-appid]").attr("data-appid");
      if (!this.appId) return false;

      // Extract game name for INI header
      this.gameName = $('h1[itemprop="name"]').text().trim() || "Unknown Game";

      // Start preloading immediately - returns promise but don't await
      this.loader = this.startPreload();
      return true;
    },

    async startPreload() {
      const [achResult, dlcResult] = await Promise.allSettled([
        this.fetchStats(),
        this.fetchDLC(),
      ]);

      let achCount = 0,
        dlcCount = 0;

      if (achResult.status === "fulfilled") {
        achCount = this.parseAchievements(achResult.value);
      }

      if (dlcResult.status === "fulfilled") {
        dlcCount = this.parseDLC(dlcResult.value);
      }

      return { achCount, dlcCount };
    },

    async fetchStats() {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: `https://steamdb.info/api/RenderAppSection/?section=stats&appid=${this.appId}`,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "text/html",
          },
          onload: (res) => {
            if (res.status === 200) {
              resolve(res.responseText || "");
            } else {
              reject(`HTTP Error: ${res.status}`);
            }
          },
          onerror: () => reject("Network Error"),
        });
      });
    },

    async fetchDLC() {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: `https://steamdb.info/api/RenderLinkedApps/?appid=${this.appId}`,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "text/html",
          },
          onload: (res) => {
            if (res.status === 200) {
              resolve(res.responseText || "");
            } else {
              reject(`HTTP Error: ${res.status}`);
            }
          },
          onerror: () => reject("Network Error"),
        });
      });
    },

    parseAchievements(htmlString) {
      const $html = $(`<div>${htmlString}</div>`);
      const list = [];

      if (
        $html.find(".achievements_wrapper").length === 0 &&
        $html.text().includes("No stats")
      ) {
        return 0;
      }

      $html.find(".achievement").each((i, el) => {
        const $el = $(el);
        const $inner = $el.find(".achievement_inner");

        const apiName = $inner.find(".achievement_api").text().trim();
        const displayName = $inner.find(".achievement_name").text().trim();
        let desc = $inner.find(".achievement_desc").text().trim();
        const hiddenEl = $inner.find(".achievement_spoiler");
        const isHidden = hiddenEl.length > 0;

        if (isHidden) desc = hiddenEl.text().trim();

        const iconBase = $inner.find(".achievement_image").attr("data-name");
        const iconGrayBase = $el
          .find(".achievement_checkmark .achievement_image_small")
          .attr("data-name");

        if (apiName) {
          list.push({
            apiName,
            displayName,
            description: desc || "No description.",
            hidden: isHidden,
            iconUrl: iconBase ? `${CDN_BASE}/${this.appId}/${iconBase}` : null,
            iconGrayUrl: iconGrayBase
              ? `${CDN_BASE}/${this.appId}/${iconGrayBase}`
              : null,
            iconBase: iconBase,
            iconGrayBase: iconGrayBase,
          });
        }
      });

      this.data.achievements = list;
      return list.length;
    },

    parseDLC(htmlString) {
      const doc = new DOMParser().parseFromString(htmlString, "text/html");
      const $doc = $(doc);
      const list = [];

      const $rows = $doc.find("tr.app[data-appid]");

      $rows.each((i, el) => {
        const $row = $(el);
        const appId = $row.attr("data-appid");

        const type = $row.find("td:nth-of-type(2)").text().trim();

        const $td3 = $row.find("td:nth-of-type(3)");

        let name = $td3.find("a b").first().text().trim();

        if (!name) {
          const $link = $td3.find("a").first();
          const $clone = $link.clone();
          $clone.find(".muted").remove();
          name = $clone.text().trim();
        }

        if (!name) {
          name = $td3.find("a").first().text().trim();
        }

        name = name.replace(/\s+/g, " ").trim();

        if (appId && name && (type === "DLC" || type === "Unknown")) {
          list.push({
            appId: appId,
            name: name,
          });
        }
      });

      this.data.dlcs = list;
      return list.length;
    },
  };

  // =================================================================
  // 3. GENERATORS (PRESETS)
  // =================================================================
  const Generators = {
    tenoke: {
      name: "TENOKE (.ini)",
      ext: "ini",
      zipName: "icons.zip",
      render: (data) => {
        let out = "";
        data.forEach((ach) => {
          out += `[ACHIEVEMENTS.${ach.apiName}]\n`;
          if (ach.iconBase) out += `icon = "${ach.iconBase}"\n`;
          if (ach.iconGrayBase) out += `icon_gray = "${ach.iconGrayBase}"\n`;
          if (ach.hidden) out += `hidden = "1"\n`;
          out += `\n`;
          out += `[ACHIEVEMENTS.${ach.apiName}.name]\n`;
          out += `english = "${ach.displayName}"\n`;
          out += `\n`;
          out += `[ACHIEVEMENTS.${ach.apiName}.desc]\n`;
          out += `english = "${ach.description}"\n`;
          out += `\n`;
        });
        return out.trim();
      },
      getFileName: (ach, type) =>
        type === "main" ? ach.iconBase : ach.iconGrayBase,
    },
    codex: {
      name: "CODEX / RUNE (.ini)",
      ext: "ini",
      zipName: "codex_icons.zip",
      render: (data) => {
        let sec1 = "[Achievements]\n";
        let sec2 = "\n[AchievementIcons]\n";
        data.forEach((ach) => {
          sec1 += `${ach.apiName}=${ach.hidden ? "0" : "1"}\n`;
          if (ach.iconBase) sec2 += `${ach.apiName} Achieved=${ach.iconBase}\n`;
          if (ach.iconGrayBase)
            sec2 += `${ach.apiName} Unachieved=${ach.iconGrayBase}\n`;
        });
        return (sec1 + sec2).trim();
      },
      getFileName: (ach, type) =>
        type === "main" ? ach.iconBase : ach.iconGrayBase,
    },
    json: {
      name: "Goldberg / JSON",
      ext: "json",
      zipName: "goldberg_icons.zip",
      render: (data) => JSON.stringify(data, null, 2),
      getFileName: (ach, type) =>
        type === "main" ? ach.iconBase : ach.iconGrayBase,
    },
  };

  const DLCGenerators = {
    tenoke: {
      name: "TENOKE (.ini)",
      ext: "ini",
      render: (data) => {
        if (!data.length) return "; No DLC found";
        let out = "[DLC]\n";
        data.forEach((dlc) => {
          const escapedName = dlc.name.replace(/"/g, '\\"');
          out += `${dlc.appId} = "${escapedName}"\n`;
        });
        return out.trim();
      },
    },
  };

  const INIGenerators = {
    tenoke: {
      name: "TENOKE Full Config",
      ext: "ini",
      render: () => {
        // Header with boilerplate settings
        let ini = `[TENOKE]
# appid
id = ${Extractor.appId} # ${Extractor.gameName}

# username
user = "TENOKE"

# account id
account = 0x1234

# k_EUniverseInvalid = 0,
# k_EUniversePublic = 1,
# k_EUniverseBeta = 2,
# k_EUniverseInternal = 3,
# k_EUniverseDev = 4,
universe = 1

# k_EAccountTypeInvalid = 0,
# k_EAccountTypeIndividual = 1,		// single user account
# k_EAccountTypeMultiseat = 2,		// multiseat (e.g. cybercafe) account
# k_EAccountTypeGameServer = 3,		// game server account
# k_EAccountTypeAnonGameServer = 4,	// anonymous game server account
# k_EAccountTypePending = 5,        // pending
# k_EAccountTypeContentServer = 6,  // content server
# k_EAccountTypeClan = 7,
# k_EAccountTypeChat = 8,
# k_EAccountTypeConsoleUser = 9,    // Fake SteamID for local PSN account on PS3 or Live account on 360, etc.
# k_EAccountTypeAnonUser = 10,
account_type = 1

# valid value: arabic, bulgarian, schinese, tchinese, czech, danish, dutch, english,
#              finnish, french, german, greek, hungarian, italian, japanese, koreana,
#              norwegian, polish, portuguese, brazilian, romanian, russian, spanish,
#              latam, swedish, thai, turkish, ukrainian, vietnamese,
language = "english"

# ISO 3166-1-alpha-2 country code
# https://www.iban.com/country-codes
country = "UK"

overlay = false

`;
        // Add DLCs
        if (Extractor.data.dlcs.length > 0) {
          const dlcSection = DLCGenerators.tenoke.render(Extractor.data.dlcs);
          if (dlcSection && !dlcSection.includes("; No DLC")) {
            ini += dlcSection + "\n\n";
          }
        }

        // Add Achievements
        if (Extractor.data.achievements.length > 0) {
          ini += Generators.tenoke.render(Extractor.data.achievements);
        }

        return ini.trim();
      },
    },
  };

  // =================================================================
  // 4. IMAGE DOWNLOADER (MAXIMUM SPEED)
  // =================================================================

  // Fast fetch using GM_xmlhttpRequest (bypasses CSP)
  const fastFetch = (url) => {
    return new Promise((resolve) => {
      if (!url) return resolve(null);

      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        responseType: "arraybuffer",
        timeout: 8000,
        onload: (res) => {
          if (res.status === 200) {
            resolve(new Uint8Array(res.response));
          } else {
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    });
  };

  async function downloadIcons(presetKey) {
    const achs = Extractor.data.achievements;
    if (!achs.length) return alert("No achievements found!");

    const preset = Generators[presetKey];
    const zip = {};
    let completed = 0;

    const updateBtn = (msg, progress) => {
      const $btn = $("#sk-btn-img");
      $btn.text(msg).prop("disabled", true);

      if (progress !== undefined) {
        const pct = Math.floor(progress * 100);
        $btn.css(
          "background",
          `linear-gradient(90deg, #66c0f4 ${pct}%, #3a4b5d ${pct}%)`
        );
      }
    };

    updateBtn("Starting...", 0);

    // Aggressive batching - download MANY at once
    const BATCH_SIZE = 50;
    const tasks = [];

    // Pre-generate all tasks
    achs.forEach((ach) => {
      if (ach.iconUrl && ach.iconBase) {
        tasks.push({
          url: ach.iconUrl,
          name: preset.getFileName(ach, "main"),
        });
      }
      if (ach.iconGrayUrl && ach.iconGrayBase) {
        tasks.push({
          url: ach.iconGrayUrl,
          name: preset.getFileName(ach, "gray"),
        });
      }
    });

    // Process in batches of 50, update UI after each batch
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (task) => {
          const data = await fastFetch(task.url);
          if (data && task.name) {
            zip[task.name] = data;
          }
          completed++;
        })
      );

      // Update progress after each batch completes
      updateBtn(
        `Downloading ${completed}/${tasks.length}...`,
        completed / tasks.length
      );
    }

    updateBtn("Zipping...", 1);

    // Use fastest compression (level 0 = no compression, just store)
    fflate.zip(zip, { level: 0, mem: 8 }, (err, data) => {
      if (err) {
        alert("Zip error: " + err);
        updateBtn("Error");
        $("#sk-btn-img").css("background", "");
      } else {
        saveAs(new Blob([data], { type: "application/zip" }), preset.zipName);
        updateBtn("Download Icons");
        $("#sk-btn-img").prop("disabled", false).css("background", "");
      }
    });
  }

  // =================================================================
  // 5. UI MANAGER
  // =================================================================
  const UI = {
    built: false,

    build() {
      if (this.built) return;
      const modal = `
                <div id="sk-overlay">
                    <div id="sk-modal">
                        <div class="sk-header">
                            <h3>SteamDB Ach Tool (Fast DL)</h3>
                            <span class="sk-close">&times;</span>
                        </div>
                        <div class="sk-nav">
                            <div class="sk-nav-item active" data-tab="ach">Achievements</div>
                            <div class="sk-nav-item" data-tab="dlc">DLC</div>
                            <div class="sk-nav-item" data-tab="ini">Full Config</div>
                        </div>
                        <div class="sk-body">
                            <div id="sk-tab-ach" class="sk-tab active">
                                <div class="sk-controls">
                                    <select id="sk-ach-preset" class="sk-select">
                                        <option value="tenoke">Tenoke .ini</option>
                                        <option value="codex">Codex .ini</option>
                                        <option value="json">JSON / Goldberg</option>
                                    </select>
                                    <button id="sk-btn-copy" class="sk-btn sk-btn-secondary">Copy</button>
                                    <button id="sk-btn-save" class="sk-btn sk-btn-primary">Save .ini</button>
                                </div>
                                <textarea id="sk-ach-output" class="sk-textarea" readonly>Prefetching data...</textarea>
                                <div class="sk-controls" style="margin-top:15px;">
                                    <button id="sk-btn-img" class="sk-btn sk-btn-secondary" style="width:100%">Download Icons (Zip)</button>
                                </div>
                                <div id="sk-status" class="sk-info-bar">Ready</div>
                            </div>
                            <div id="sk-tab-dlc" class="sk-tab">
                                <div class="sk-controls">
                                    <select id="sk-dlc-preset" class="sk-select">
                                        <option value="tenoke">Tenoke .ini</option>
                                    </select>
                                    <button id="sk-btn-dlc-copy" class="sk-btn sk-btn-secondary">Copy</button>
                                    <button id="sk-btn-dlc-save" class="sk-btn sk-btn-primary">Save .ini</button>
                                </div>
                                <textarea id="sk-dlc-output" class="sk-textarea" readonly>Prefetching data...</textarea>
                                <div id="sk-dlc-status" class="sk-info-bar">Ready</div>
                            </div>
                            <div id="sk-tab-ini" class="sk-tab">
                                <div class="sk-controls">
                                    <select id="sk-ini-preset" class="sk-select">
                                        <option value="tenoke">Tenoke Full Config</option>
                                    </select>
                                    <button id="sk-btn-ini-copy" class="sk-btn sk-btn-secondary">Copy</button>
                                    <button id="sk-btn-ini-save" class="sk-btn sk-btn-primary">Save .ini</button>
                                </div>
                                <textarea id="sk-ini-output" class="sk-textarea" readonly>Prefetching data...</textarea>
                                <div id="sk-ini-status" class="sk-info-bar">Ready</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
      $("body").append(modal);
      this.bindEvents();
      this.built = true;
    },

    close() {
      $("#sk-overlay").removeClass("active");
    },

    bindEvents() {
      $(".sk-close, #sk-overlay").on("click", (e) => {
        if (e.target === e.currentTarget) this.close();
      });

      $(document).on("keydown", (e) => {
        if (e.key === "Escape" && $("#sk-overlay").hasClass("active")) {
          this.close();
        }
      });

      $(".sk-nav-item").on("click", function () {
        const tab = $(this).data("tab");
        $(".sk-nav-item").removeClass("active");
        $(this).addClass("active");
        $(".sk-tab").removeClass("active");
        $(`#sk-tab-${tab}`).addClass("active");
      });

      $("#sk-ach-preset").on("change", () => this.refreshPreview());

      $("#sk-btn-save").on("click", () => {
        const presetKey = $("#sk-ach-preset").val();
        const content = $("#sk-ach-output").val();
        const preset = Generators[presetKey];
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });

        let filename = `achievements.${preset.ext}`;
        if (presetKey === "tenoke") {
          filename = "tenoke.ini";
        } else if (presetKey === "codex") {
          filename = "codex.ini";
        } else if (presetKey === "json") {
          filename = "achievements.json";
        }

        saveAs(blob, filename);
      });

      $("#sk-btn-copy").on("click", () => {
        GM_setClipboard($("#sk-ach-output").val());
        const old = $("#sk-btn-copy").text();
        $("#sk-btn-copy").text("Copied!");
        setTimeout(() => $("#sk-btn-copy").text(old), 1000);
      });

      $("#sk-btn-img").on("click", () => {
        downloadIcons($("#sk-ach-preset").val());
      });

      $("#sk-dlc-preset").on("change", () => this.refreshDLCPreview());

      $("#sk-btn-dlc-save").on("click", () => {
        const presetKey = $("#sk-dlc-preset").val();
        const content = $("#sk-dlc-output").val();
        const preset = DLCGenerators[presetKey];
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        saveAs(blob, `tenoke_dlc.${preset.ext}`);
      });

      $("#sk-btn-dlc-copy").on("click", () => {
        GM_setClipboard($("#sk-dlc-output").val());
        const old = $("#sk-btn-dlc-copy").text();
        $("#sk-btn-dlc-copy").text("Copied!");
        setTimeout(() => $("#sk-btn-dlc-copy").text(old), 1000);
      });

      $("#sk-ini-preset").on("change", () => this.refreshINIPreview());

      $("#sk-btn-ini-save").on("click", () => {
        const presetKey = $("#sk-ini-preset").val();
        const content = $("#sk-ini-output").val();
        const preset = INIGenerators[presetKey];
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        saveAs(blob, `tenoke.${preset.ext}`);
      });

      $("#sk-btn-ini-copy").on("click", () => {
        GM_setClipboard($("#sk-ini-output").val());
        const old = $("#sk-btn-ini-copy").text();
        $("#sk-btn-ini-copy").text("Copied!");
        setTimeout(() => $("#sk-btn-ini-copy").text(old), 1000);
      });
    },

    open() {
      if (!this.built) this.build();
      $("#sk-overlay").addClass("active");
      this.syncUI();
    },

    async syncUI() {
      const $status = $("#sk-status");

      // If data is already loaded, display immediately
      if (
        Extractor.data.achievements.length > 0 ||
        Extractor.data.dlcs.length > 0
      ) {
        this.refreshPreview();
        this.refreshDLCPreview();
        this.refreshINIPreview();
        $status.text(
          `Ready - ${Extractor.data.achievements.length} achievements, ${Extractor.data.dlcs.length} DLCs`
        );
        $("#sk-dlc-status").text(`${Extractor.data.dlcs.length} DLCs loaded`);
        $("#sk-ini-status").text("Full config ready");
        return;
      }

      // Otherwise wait for the background fetch to complete
      $status.text("Loading data...");

      try {
        await Extractor.loader;
        this.refreshPreview();
        this.refreshDLCPreview();
        this.refreshINIPreview();
        $status.text(
          `Loaded ${Extractor.data.achievements.length} achievements, ${Extractor.data.dlcs.length} DLCs`
        );
        $("#sk-dlc-status").text(`${Extractor.data.dlcs.length} DLCs loaded`);
        $("#sk-ini-status").text("Full config ready");
      } catch (e) {
        console.error(e);
        $status.text("Error loading data!");
        $("#sk-ach-output").val("Error: " + e);
        $("#sk-dlc-output").val("Error: " + e);
        $("#sk-ini-output").val("Error: " + e);
      }
    },

    refreshPreview() {
      const presetKey = $("#sk-ach-preset").val();
      const data = Extractor.data.achievements;
      if (!data.length) {
        $("#sk-ach-output").val("No achievements found for this app.");
        return;
      }
      const output = Generators[presetKey].render(data);
      $("#sk-ach-output").val(output);
    },

    refreshDLCPreview() {
      const presetKey = $("#sk-dlc-preset").val();
      const data = Extractor.data.dlcs;
      const output = DLCGenerators[presetKey].render(data);
      $("#sk-dlc-output").val(output);
    },

    refreshINIPreview() {
      const presetKey = $("#sk-ini-preset").val();
      const output = INIGenerators[presetKey].render();
      $("#sk-ini-output").val(output);
    },
  };

  // =================================================================
  // 6. MAIN INIT
  // =================================================================
  function init() {
    if (!Extractor.init()) return;
    const $btn = $(`<div id="sk-trigger">SteamDB Ach Tool</div>`);
    $btn.on("click", () => UI.open());
    $("body").append($btn);
  }

  $(document).ready(init);
})(jQuery);
