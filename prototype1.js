// ==UserScript==
// @name         SteamDB Achievement & DLC Tool (Pre-Loader)
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Instant data (Pre-loaded). Uses jQuery API calls. Generates Tenoke/Codex INI.
// @author       You
// @match        https://steamdb.info/app/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=steamdb.info
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  "use strict";

  const CDN_BASE = "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps";

  // Global Cache to store pre-loaded data
  const CACHE = {
    achievements: [],
    dlcs: [],
    appId: null,
    gameName: "Unknown",
    status: { ach: "Waiting...", dlc: "Waiting..." },
  };

  // =================================================================
  // 1. PRESETS
  // =================================================================
  const ACH_PRESETS = {
    tenoke: {
      name: "TENOKE .ini",
      ext: "ini",
      configName: "tenoke_achievements.ini",
      zipName: "icons.zip",
      generate: (achievements) => {
        let output = "";
        achievements.forEach((ach) => {
          output += `[ACHIEVEMENTS.${ach.apiName}]\n`;
          if (ach.iconBase) output += `icon = "${ach.iconBase}"\n`;
          if (ach.iconGrayBase) output += `icon_gray = "${ach.iconGrayBase}"\n`;
          if (ach.hidden === "1") output += `hidden = "1"\n`;
          output += `\n`;

          output += `[ACHIEVEMENTS.${ach.apiName}.name]\n`;
          output += `english = "${ach.displayName}"\n\n`;

          output += `[ACHIEVEMENTS.${ach.apiName}.desc]\n`;
          output += `english = "${ach.description}"\n\n`;
        });
        return output.trim();
      },
    },
    codex: {
      name: "CODEX .ini",
      ext: "ini",
      configName: "steam_emu.ini",
      generate: (achievements) => {
        let section1 = "[Achievements]\n";
        let section2 = "\n[AchievementIcons]\n";
        achievements.forEach((ach) => {
          section1 += `${ach.apiName}=${ach.hidden === "1" ? "0" : "1"}\n`;
          const iconName = ach.iconBase.replace(/\.(jpg|png|jpeg)/i, ".bmp");
          const iconGrayName = ach.iconGrayBase.replace(/\.(jpg|png|jpeg)/i, ".bmp");
          section2 += `${ach.apiName} Achieved=${iconName}\n`;
          section2 += `${ach.apiName} Unachieved=${iconGrayName}\n`;
        });
        return (section1 + section2).trim();
      },
    },
  };

  const DLC_PRESETS = {
    ini: {
      name: "Standard INI",
      ext: "ini",
      generate: (dlcs) => {
        if (!dlcs.length) return "# No DLCs found.";
        let output = "[DLC]\n";
        dlcs.forEach((dlc) => (output += `${dlc.id} = "${dlc.name}"\n`));
        return output;
      },
    },
    cream: {
      name: "CreamAPI",
      ext: "ini",
      generate: (dlcs) => {
        if (!dlcs.length) return "; No DLCs found.";
        let output = "[dlc]\n";
        dlcs.forEach((dlc) => (output += `${dlc.id} = ${dlc.name}\n`));
        return output;
      },
    },
    luma: {
      name: "LumaEmu",
      ext: "ini",
      generate: (dlcs) => {
        if (!dlcs.length) return "; No DLCs found.";
        let output = "[DLC]\n";
        dlcs.forEach((dlc) => (output += `${dlc.id} = ${dlc.name}\n`));
        return output;
      },
    },
    list: {
      name: "ID List",
      ext: "txt",
      generate: (dlcs) => dlcs.map((d) => d.id).join("\n"),
    },
  };

  // =================================================================
  // 2. CSS
  // =================================================================
  GM_addStyle(`
        #sag-trigger {
            position: fixed; bottom: 20px; right: 20px;
            background: #0d121a; color: #66c0f4; border: 1px solid #66c0f4;
            padding: 10px 15px; border-radius: 5px; font-weight: bold; cursor: pointer;
            z-index: 99990; box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-family: Arial, sans-serif;
        }
        #sag-trigger:hover { background: #66c0f4; color: #fff; }

        #sag-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); z-index: 99999;
            align-items: center; justify-content: center;
        }
        #sag-overlay.open { display: flex; }

        #sag-modal {
            background: #1b2838; width: 600px; max-height: 90vh;
            border-radius: 4px; box-shadow: 0 0 20px rgba(0,0,0,0.8);
            display: flex; flex-direction: column;
            font-family: "Motiva Sans", Arial, sans-serif; color: #fff;
        }

        .sag-header { padding: 15px; background: #16202d; border-bottom: 1px solid #2a475e; display: flex; justify-content: space-between; align-items: center; }
        .sag-header h3 { margin: 0; font-size: 18px; color: #66c0f4; }
        .sag-close { cursor: pointer; font-size: 20px; color: #888; }
        .sag-close:hover { color: #fff; }

        .sag-tabs { display: flex; background: #101822; border-bottom: 1px solid #2a475e; }
        .sag-tab-btn {
            padding: 12px 20px; background: transparent; border: none; color: #8f98a0; cursor: pointer; font-size: 14px; border-right: 1px solid #2a475e;
        }
        .sag-tab-btn:hover { background: #223449; color: #fff; }
        .sag-tab-btn.active { background: #1b2838; color: #66c0f4; font-weight: bold; border-bottom: 2px solid #66c0f4; }

        .sag-body { padding: 20px; overflow-y: auto; }
        .sag-tab-pane { display: none; }
        .sag-tab-pane.active { display: block; }

        .sag-row { margin-bottom: 15px; display: flex; gap: 10px; align-items: center; }
        .sag-select { padding: 8px; background: #0f1217; color: #fff; border: 1px solid #444; border-radius: 3px; flex-grow: 1; }
        .sag-btn { background: #2a475e; color: #fff; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer; font-weight: bold; flex: 1; }
        .sag-btn:hover { background: #66c0f4; }
        .sag-btn:disabled { background: #333; color: #777; cursor: not-allowed; }
        .sag-btn-action { background: #67c1f5; color: #000; }

        textarea.sag-preview { width: 100%; height: 300px; background: #0f1217; color: #ccc; border: 1px solid #333; font-family: monospace; font-size: 12px; padding: 10px; box-sizing: border-box; white-space: pre; overflow: auto; }
        .sag-status { font-size: 12px; color: #888; text-align: right; margin-top: 5px; font-family: monospace; }
    `);

  // =================================================================
  // 3. CORE LOGIC (jQuery API Fetcher)
  // =================================================================

  function getAppID() {
    return $(".scope-app[data-appid]").attr("data-appid");
  }

  function cleanDescription(text) {
    if (!text) return "";
    return text.replace(/^Hidden achievement:\s*/i, "");
  }

  /**
   * MAIN PRE-LOAD FUNCTION
   * Fires immediately when script runs.
   * Uses jQuery .ajax to hit the internal API (RenderAppSection).
   */
  function preloadData() {
    const appId = getAppID();
    if (!appId) return;

    CACHE.appId = appId;
    CACHE.gameName = $('h1[itemprop="name"]').text().trim();

    // 1. Fetch Achievements (Stats)
    CACHE.status.ach = "Fetching in background...";
    $.ajax({
      url: `https://steamdb.info/api/RenderAppSection/?section=stats&appid=${appId}`,
      headers: { "X-Requested-With": "XMLHttpRequest" },
      success: (res) => {
        // Parse the HTML fragment using jQuery
        const $html = $(`<div>${res}</div>`);
        const data = [];

        $html.find(".achievement").each((i, el) => {
          const $row = $(el);
          const $inner = $row.find(".achievement_inner");
          const apiName = $inner.find(".achievement_api").text().trim();
          if (!apiName) return;

          const displayName = $inner.find(".achievement_name").text().trim();
          let rawDesc = $inner.find(".achievement_desc").text().trim();
          const $hiddenEl = $inner.find(".achievement_spoiler");
          if ($hiddenEl.length) rawDesc = $hiddenEl.text().trim();

          const iconFilename = $inner.find(".achievement_image").attr("data-name") || "locked.jpg";
          const iconGrayFilename =
            $row.find(".achievement_checkmark .achievement_image_small").attr("data-name") || "unlocked.jpg";

          data.push({
            apiName,
            displayName,
            description: cleanDescription(rawDesc),
            hidden: $hiddenEl.length ? "1" : "0",
            iconUrl: `${CDN_BASE}/${appId}/${iconFilename}`,
            iconGrayUrl: `${CDN_BASE}/${appId}/${iconGrayFilename}`,
            iconBase: iconFilename,
            iconGrayBase: iconGrayFilename,
          });
        });

        CACHE.achievements = data;
        CACHE.status.ach = `Ready (${data.length} found)`;
        updateAchUI(); // Update UI if open
      },
      error: () => {
        CACHE.status.ach = "Failed to fetch.";
      },
    });

    // 2. Fetch DLCs
    CACHE.status.dlc = "Fetching in background...";
    $.ajax({
      url: `https://steamdb.info/api/RenderAppSection/?section=dlc&appid=${appId}`,
      headers: { "X-Requested-With": "XMLHttpRequest" },
      success: (res) => {
        // The DLC API returns loose <tr> tags. jQuery handles this perfectly.
        const $html = $(`<div>${res}</div>`);
        const data = [];

        // Find all rows with data-appid (these are DLCs)
        $html.find("tr.app[data-appid]").each((i, el) => {
          const $el = $(el);
          const id = $el.attr("data-appid");

          // Name extraction (removing badges like 'Unused')
          let name = $el
            .find("td:nth-child(2)")
            .contents()
            .filter(function () {
              return this.nodeType === 3; // Text node
            })
            .text()
            .trim();

          if (!name) name = $el.find("td:nth-child(2) a").text().trim();

          if (id && name) data.push({ id, name });
        });

        CACHE.dlcs = data;
        CACHE.status.dlc = `Ready (${data.length} found)`;
        updateDlcUI(); // Update UI if open
      },
      error: () => {
        CACHE.status.dlc = "Failed to fetch.";
      },
    });
  }

  // =================================================================
  // 4. UI LOGIC
  // =================================================================

  function updateAchUI() {
    if ($("#sag-modal").length === 0) return;
    const $status = $("#sag-ach-status");
    const format = $("#sag-ach-format").val();

    if (!CACHE.achievements.length) {
      $status.text(CACHE.status.ach);
      return;
    }

    const preset = ACH_PRESETS[format];
    const content = preset.generate(CACHE.achievements);
    $("#sag-ach-preview").val(content);
    $status.text(CACHE.status.ach);
  }

  function updateDlcUI() {
    if ($("#sag-modal").length === 0) return;
    const $status = $("#sag-dlc-status");
    const format = $("#sag-dlc-format").val();

    if (!CACHE.dlcs.length) {
      $status.text(CACHE.status.dlc);
      return;
    }

    const preset = DLC_PRESETS[format];
    const content = preset.generate(CACHE.dlcs);
    $("#sag-dlc-preview").val(content);
    $status.text(CACHE.status.dlc);
  }

  function downloadConfig(type) {
    const content = type === "ach" ? $("#sag-ach-preview").val() : $("#sag-dlc-preview").val();
    const format = type === "ach" ? $("#sag-ach-format").val() : $("#sag-dlc-format").val();

    if (!content) return;

    const preset = type === "ach" ? ACH_PRESETS[format] : DLC_PRESETS[format];
    const filename = preset.configName || `${CACHE.appId}_${type}.${preset.ext}`;

    saveAs(new Blob([content], { type: "text/plain;charset=utf-8" }), filename);
  }

  function downloadImages() {
    const data = CACHE.achievements;
    if (!data.length) return;

    const $btn = $("#sag-btn-ach-img");
    const $status = $("#sag-ach-status");
    const format = $("#sag-ach-format").val();
    const preset = ACH_PRESETS[format];

    $btn.prop("disabled", true);

    const tasks = new Map();
    data.forEach((ach) => {
      if (ach.iconUrl) tasks.set(ach.iconBase, ach.iconUrl);
      if (ach.iconGrayUrl) tasks.set(ach.iconGrayBase, ach.iconGrayUrl);
    });

    const total = tasks.size;
    let processed = 0;
    const filesObj = {};

    $status.text(`Downloading ${total} images...`);

    const promises = [];
    for (const [name, url] of tasks) {
      promises.push(
        new Promise((resolve) => {
          GM_xmlhttpRequest({
            method: "GET",
            url: url,
            responseType: "arraybuffer",
            onload: (res) => {
              if (res.status === 200) filesObj[name] = new Uint8Array(res.response);
              processed++;
              $status.text(`Downloading: ${processed}/${total}`);
              resolve();
            },
            onerror: () => {
              processed++;
              resolve();
            },
          });
        })
      );
    }

    Promise.all(promises).then(() => {
      $status.text("Zipping...");
      const zipData = fflate.zipSync(filesObj, { level: 0 });
      saveAs(new Blob([zipData], { type: "application/zip" }), preset.zipName || "icons.zip");
      $status.text("Done!");
      $btn.prop("disabled", false);
    });
  }

  // =================================================================
  // 5. DOM
  // =================================================================

  function switchTab(tabName) {
    $(".sag-tab-btn").removeClass("active");
    $(`.sag-tab-btn[data-tab="${tabName}"]`).addClass("active");
    $(".sag-tab-pane").removeClass("active");
    $(`#sag-tab-${tabName}`).addClass("active");
  }

  function createModal() {
    const html = `
            <div id="sag-overlay">
                <div id="sag-modal">
                    <div class="sag-header">
                        <h3>SteamDB Tool</h3>
                        <span class="sag-close">&times;</span>
                    </div>
                    <div class="sag-tabs">
                        <button class="sag-tab-btn active" data-tab="achievements">Achievements</button>
                        <button class="sag-tab-btn" data-tab="dlcs">DLCs</button>
                    </div>
                    <div class="sag-body">
                        <div id="sag-tab-achievements" class="sag-tab-pane active">
                            <div class="sag-row">
                                <select id="sag-ach-format" class="sag-select">
                                    ${Object.entries(ACH_PRESETS)
                                      .map(([k, v]) => `<option value="${k}">${v.name}</option>`)
                                      .join("")}
                                </select>
                                <button id="sag-btn-ach-save" class="sag-btn">Download INI</button>
                            </div>
                            <textarea id="sag-ach-preview" class="sag-preview" spellcheck="false"></textarea>
                            <div class="sag-row">
                                <button id="sag-btn-ach-copy" class="sag-btn" style="background:#223449">Copy Text</button>
                                <button id="sag-btn-ach-img" class="sag-btn sag-btn-action">Download Icons</button>
                            </div>
                            <div id="sag-ach-status" class="sag-status">${CACHE.status.ach}</div>
                        </div>
                        <div id="sag-tab-dlcs" class="sag-tab-pane">
                            <div class="sag-row">
                                <select id="sag-dlc-format" class="sag-select">
                                    ${Object.entries(DLC_PRESETS)
                                      .map(([k, v]) => `<option value="${k}">${v.name}</option>`)
                                      .join("")}
                                </select>
                                <button id="sag-btn-dlc-save" class="sag-btn">Download Config</button>
                            </div>
                            <textarea id="sag-dlc-preview" class="sag-preview" spellcheck="false"></textarea>
                             <div class="sag-row">
                                <button id="sag-btn-dlc-copy" class="sag-btn" style="background:#223449">Copy Text</button>
                            </div>
                            <div id="sag-dlc-status" class="sag-status">${CACHE.status.dlc}</div>
                        </div>
                    </div>
                </div>
            </div>`;

    $("body").append(html);

    // Bind Events
    $(".sag-close, #sag-overlay").on("click", function (e) {
      if (e.target === this) $("#sag-overlay").removeClass("open");
    });
    $(".sag-tab-btn").on("click", function () {
      switchTab($(this).data("tab"));
    });

    $("#sag-ach-format").on("change", updateAchPreview);
    $("#sag-btn-ach-save").on("click", () => downloadConfig("ach"));
    $("#sag-btn-ach-img").on("click", downloadAchImages);
    $("#sag-btn-ach-copy").on("click", () => {
      $("#sag-ach-preview").select();
      document.execCommand("copy");
    });

    $("#sag-dlc-format").on("change", updateDlcPreview);
    $("#sag-btn-dlc-save").on("click", () => downloadConfig("dlc"));
    $("#sag-btn-dlc-copy").on("click", () => {
      $("#sag-dlc-preview").select();
      document.execCommand("copy");
    });
  }

  function init() {
    if ($("#sag-trigger").length) return;

    const btn = $('<div id="sag-trigger">Get Data</div>');
    btn.on("click", () => {
      if ($("#sag-overlay").length === 0) createModal();
      $("#sag-overlay").addClass("open");
      updateAchPreview();
      updateDlcPreview();
    });
    $("body").append(btn);

    // START PRE-LOADING
    preloadData();
  }

  $(window).on("load", init);
  // SPA Check
  setInterval(() => {
    if (window.location.href.includes("/app/") && $("#sag-trigger").length === 0) {
      init();
    }
  }, 1000);
})();
