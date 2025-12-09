// ==UserScript==
// @name         SteamDB Data Tool (Fast DL)
// @namespace    https://steamdb.info/
// @version      2.3
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
    data: { achievements: [], dlcs: [] },

    init() {
      this.appId = $(".scope-app[data-appid]").attr("data-appid");
      if (!this.appId) return false;
      return true;
    },

    // Fetches data using the internal API endpoint to be more reliable
    async fetchStats() {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: `https://steamdb.info/api/RenderAppSection/?section=stats&appid=${this.appId}`,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "text/html", // Force HTML response
          },
          onload: (res) => {
            if (res.status === 200) {
              if (!res.responseText) reject("Empty response from SteamDB");
              else resolve(res.responseText);
            } else {
              reject(`HTTP Error: ${res.status}`);
            }
          },
          onerror: (err) => reject("Network Error"),
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
  };

  // =================================================================
  // 3. GENERATORS (PRESETS)
  // =================================================================
  const Generators = {
    tenoke: {
      name: "TENOKE (.ini)",
      ext: "ini",
      zipName: "tenoke_icons.zip",
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
      zipName: "icons.zip",
      render: (data) => JSON.stringify(data, null, 2),
      getFileName: (ach, type) =>
        type === "main" ? ach.iconBase : ach.iconGrayBase,
    },
  };

  // =================================================================
  // 4. IMAGE DOWNLOADER (INSTANT / PARALLEL)
  // =================================================================
  async function downloadIcons(presetKey) {
    const achs = Extractor.data.achievements;
    if (!achs.length) return alert("No achievements found!");

    const preset = Generators[presetKey];
    const zip = {};
    const total = achs.length * 2;
    let count = 0;

    const updateBtn = (msg) =>
      $("#sk-btn-img").text(msg).prop("disabled", true);
    updateBtn(`Starting...`);

    // Helper to fetch buffer (GM_XHR bypasses CORS)
    const fetchImg = (url) => {
      return new Promise((resolve) => {
        if (!url) return resolve({ ok: false });
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          responseType: "arraybuffer",
          onload: (res) =>
            resolve({
              ok: res.status === 200,
              data: new Uint8Array(res.response),
            }),
          onerror: () => resolve({ ok: false }),
        });
      });
    };

    // Prepare all tasks at once
    const tasks = [];

    achs.forEach((ach) => {
      // Main Icon Task
      tasks.push(async () => {
        const res = await fetchImg(ach.iconUrl);
        if (res.ok) {
          const name = preset.getFileName(ach, "main");
          if (name) zip[name] = res.data;
        }
        count++;
        updateBtn(`Downloading ${count}/${total}...`);
      });

      // Gray Icon Task
      tasks.push(async () => {
        const res = await fetchImg(ach.iconGrayUrl);
        if (res.ok) {
          const name = preset.getFileName(ach, "gray");
          if (name) zip[name] = res.data;
        }
        count++;
        updateBtn(`Downloading ${count}/${total}...`);
      });
    });

    // Fire all requests simultaneously (Parallel Execution)
    // This mimics the original script's behavior using Promise.all on the whole array
    await Promise.all(tasks.map((t) => t()));

    updateBtn("Zipping...");

    // Zip and Save
    fflate.zip(zip, { level: 0 }, (err, data) => {
      if (err) {
        alert("Zip error: " + err);
        updateBtn("Error");
      } else {
        saveAs(new Blob([data], { type: "application/zip" }), preset.zipName);
        updateBtn("Download Icons");
        $("#sk-btn-img").prop("disabled", false);
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
                            <div class="sk-nav-item" data-tab="dlc" style="opacity:0.5; cursor:not-allowed">DLC (Coming Soon)</div>
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
                                <textarea id="sk-ach-output" class="sk-textarea" readonly>Select a preset to generate data...</textarea>
                                <div class="sk-controls" style="margin-top:15px;">
                                    <button id="sk-btn-img" class="sk-btn sk-btn-secondary" style="width:100%">Download Icons (Zip)</button>
                                </div>
                                <div id="sk-status" class="sk-info-bar">Ready</div>
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

      $("#sk-ach-preset").on("change", () => this.refreshPreview());

      $("#sk-btn-save").on("click", () => {
        const presetKey = $("#sk-ach-preset").val();
        const content = $("#sk-ach-output").val();
        const preset = Generators[presetKey];
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        saveAs(
          blob,
          preset.name.includes("Tenoke")
            ? "tenoke_achievements.ini"
            : `achievements.${preset.ext}`
        );
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
    },

    open() {
      if (!this.built) this.build();
      $("#sk-overlay").addClass("active");
      if (Extractor.data.achievements.length === 0) {
        this.loadData();
      }
    },

    async loadData() {
      const $status = $("#sk-status");
      $status.text("Fetching achievements from SteamDB...");
      $("#sk-ach-output").val("Loading...");

      try {
        const html = await Extractor.fetchStats();
        const count = Extractor.parseAchievements(html);
        if (count > 0) {
          $status.text(`Loaded ${count} achievements.`);
          this.refreshPreview();
        } else {
          $status.text("No achievements found.");
          $("#sk-ach-output").val("No achievements found for this app.");
        }
      } catch (e) {
        console.error(e);
        let msg = "Error fetching data.";
        if (e.toString().includes("403")) msg += " (Cloudflare Blocked?)";
        if (e.toString().includes("404")) msg += " (Page not found)";
        $status.text("Error!");
        $("#sk-ach-output").val(`${msg}\nDetails: ${e}`);
      }
    },

    refreshPreview() {
      const presetKey = $("#sk-ach-preset").val();
      const data = Extractor.data.achievements;
      if (!data.length) return;
      const output = Generators[presetKey].render(data);
      $("#sk-ach-output").val(output);
    },
  };

  // =================================================================
  // 6. MAIN INIT
  // =================================================================
  const Cg = "SteamDB Ach Tool";

  function init() {
    if (!Extractor.init()) return;
    const $btn = $(`<div id="sk-trigger">${Cg}</div>`);
    $btn.on("click", () => UI.open());
    $("body").append($btn);
    console.log(`[${Cg}] Ready.`);
  }

  $(document).ready(init);
})(jQuery);
