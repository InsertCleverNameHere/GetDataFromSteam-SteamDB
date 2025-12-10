// ==UserScript==
// @name         SteamDB Data Tool (Polished Text)
// @namespace    https://steamdb.info/
// @version      4.5
// @description  Fetches Data. Progress Bar. Fixed text spacing in footer stats.
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

  const CDN_BASE =
    "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps";

  GM_addStyle(`
        #sk-trigger {
            position: fixed; bottom: 20px; right: 20px;
            background: #1b2838; color: #66c0f4; border: 1px solid #66c0f4;
            padding: 10px 20px; border-radius: 4px; font-weight: bold; cursor: pointer;
            z-index: 9999; box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-family: "Motiva Sans", Arial, sans-serif;
            transition: all 0.2s;
        }
        #sk-trigger:hover { background: #66c0f4; color: #fff; transform: translateY(-2px); }

        #sk-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; justify-content: center; align-items: center; }
        #sk-overlay.active { display: flex; }

        #sk-modal { background: #16202d; width: 700px; max-height: 90vh; display: flex; flex-direction: column; border-radius: 6px; border: 1px solid #2a475e; font-family: "Motiva Sans", Arial, sans-serif; color: #c6d4df; }
        .sk-header { padding: 15px 20px; background: #101822; border-bottom: 1px solid #2a475e; display: flex; justify-content: space-between; align-items: center; }
        .sk-header h3 { margin: 0; color: #fff; font-size: 18px; }
        .sk-close { cursor: pointer; font-size: 24px; color: #67c1f5; }
        .sk-close:hover { color: #fff; }

        .sk-nav { display: flex; background: #1b2838; border-bottom: 1px solid #000; }
        .sk-nav-item { flex: 1; padding: 15px; text-align: center; cursor: pointer; color: #8f98a0; border-bottom: 3px solid transparent; font-weight: bold; font-size: 14px; transition: background 0.2s; }
        .sk-nav-item:hover { background: #233246; color: #fff; }
        .sk-nav-item.active { border-bottom-color: #66c0f4; color: #fff; background: #233246; }

        .sk-body { padding: 20px; overflow-y: auto; flex-grow: 1; min-height: 400px; }
        .sk-tab { display: none; }
        .sk-tab.active { display: block; }
        .sk-controls { display: flex; gap: 10px; margin-bottom: 10px; }
        .sk-select { flex-grow: 1; padding: 8px; background: #000; color: #fff; border: 1px solid #444; border-radius: 3px; outline: none; }

        .sk-btn { padding: 8px 16px; border: none; border-radius: 3px; cursor: pointer; font-weight: bold; color: #fff; transition: background 0.2s; position: relative; overflow: hidden; }
        .sk-btn-primary { background: #66c0f4; color: #000; }
        .sk-btn-primary:hover { background: #fff; }
        .sk-btn-secondary { background: #3a4b5d; }
        .sk-btn-secondary:hover { background: #4b627a; }
        .sk-btn:disabled { opacity: 0.8; cursor: not-allowed; color: #ddd; }

        .sk-textarea { width: 100%; height: 350px; background: #0d121a; color: #a6b2be; border: 1px solid #444; padding: 10px; box-sizing: border-box; font-family: Consolas, monospace; font-size: 12px; resize: vertical; white-space: pre; }

        /* Footer Layout */
        .sk-footer { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
        #sk-status { color: #8f98a0; text-align: right; }
        /* Stats Numbers (Left) - Fixed Spacing/Case */
        #sk-footer-stats { color: #66c0f4; font-weight: bold; font-size: 12px; }
    `);

  // =================================================================
  // 2. DATA EXTRACTOR
  // =================================================================
  const Extractor = {
    appId: null,
    data: { achievements: [], dlcs: [] },
    loader: null,

    init() {
      this.appId = $(".scope-app[data-appid]").attr("data-appid");
      if (!this.appId) return false;
      this.loader = this.startPreload();
      return true;
    },

    request(url) {
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

    async startPreload() {
      const [achRes, dlcRes] = await Promise.allSettled([
        this.request(
          `https://steamdb.info/api/RenderAppSection/?section=stats&appid=${this.appId}`
        ),
        this.request(
          `https://steamdb.info/api/RenderLinkedApps/?appid=${this.appId}`
        ),
      ]);

      let achCount = 0;
      let dlcCount = 0;

      if (achRes.status === "fulfilled")
        achCount = this.parseAchievements(achRes.value);
      if (dlcRes.status === "fulfilled")
        dlcCount = this.parseDLCs(dlcRes.value);

      console.log(
        `[SteamDB Tool] Pre-load complete. Ach: ${achCount}, DLC: ${dlcCount}`
      );
      return { achCount, dlcCount };
    },

    parseAchievements(htmlString) {
      const safeHtml = htmlString.replace(
        /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
        ""
      );
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
            iconUrl: iconBase ? `${CDN_BASE}/${this.appId}/${iconBase}` : null,
            iconGrayUrl: iconGrayBase
              ? `${CDN_BASE}/${this.appId}/${iconGrayBase}`
              : null,
            iconBase,
            iconGrayBase,
          });
        }
      });

      this.data.achievements = list;
      return list.length;
    },

    parseDLCs(htmlString) {
      const safeHtml = htmlString.replace(
        /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
        ""
      );
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

      this.data.dlcs = list;
      return list.length;
    },
  };

  // =================================================================
  // 3. GENERATORS
  // =================================================================
  const Generators = {
    tenoke_ach: {
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
    codex_ach: {
      render: (data) => {
        let s1 = "[Achievements]\n",
          s2 = "\n[AchievementIcons]\n";
        data.forEach((ach) => {
          s1 += `${ach.apiName}=${ach.hidden ? "0" : "1"}\n`;
          if (ach.iconBase) s2 += `${ach.apiName} Achieved=${ach.iconBase}\n`;
          if (ach.iconGrayBase)
            s2 += `${ach.apiName} Unachieved=${ach.iconGrayBase}\n`;
        });
        return (s1 + s2).trim();
      },
      getFileName: (ach, type) =>
        type === "main" ? ach.iconBase : ach.iconGrayBase,
    },
    tenoke_dlc: {
      render: (data) => {
        if (!data.length) return "; No DLCs found";
        let out = "[DLC]\n";
        data.forEach((d) => (out += `${d.id} = "${d.name}"\n`));
        return out;
      },
    },
    cream: {
      render: (data) => {
        if (!data.length) return "; No DLCs found";
        let out = "[dlc]\n";
        data.forEach((d) => (out += `${d.id} = ${d.name}\n`));
        return out;
      },
    },
  };

  // =================================================================
  // 4. DOWNLOADER (PROGRESS BAR)
  // =================================================================
  const fastFetch = (url) => {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      fetch(url, { mode: "cors" })
        .then((r) => {
          if (r.ok) return r.arrayBuffer();
          throw new Error(r.status);
        })
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(() => {
          GM_xmlhttpRequest({
            method: "GET",
            url,
            responseType: "arraybuffer",
            onload: (res) =>
              resolve(res.status === 200 ? new Uint8Array(res.response) : null),
            onerror: () => resolve(null),
          });
        });
    });
  };

  async function downloadIcons() {
    const achs = Extractor.data.achievements;
    if (!achs.length) return alert("No achievements found!");

    const $btn = $("#sk-btn-img");
    const updateBtn = (msg, pct) => {
      $btn.text(msg).prop("disabled", true);
      if (pct !== undefined) {
        // Render progress bar via background gradient
        $btn.css(
          "background",
          `linear-gradient(90deg, #66c0f4 ${pct}%, #3a4b5d ${pct}%)`
        );
      }
    };

    updateBtn("Starting...", 0);

    const preset = Generators[$("#sk-ach-preset").val()];
    const zip = {};
    const tasks = [];
    const total = achs.length * 2;
    let completed = 0;

    const updateProgress = () => {
      completed++;
      if (completed % Math.ceil(total / 20) === 0 || completed === total) {
        const pct = Math.floor((completed / total) * 100);
        updateBtn(`Downloading... ${pct}%`, pct);
      }
    };

    achs.forEach((ach) => {
      tasks.push(async () => {
        const buf = await fastFetch(ach.iconUrl);
        if (buf && ach.iconBase) zip[preset.getFileName(ach, "main")] = buf;
        updateProgress();
      });
      tasks.push(async () => {
        const buf = await fastFetch(ach.iconGrayUrl);
        if (buf && ach.iconGrayBase) zip[preset.getFileName(ach, "gray")] = buf;
        updateProgress();
      });
    });

    await Promise.all(tasks.map((t) => t()));

    updateBtn("Zipping...", 100);

    fflate.zip(zip, { level: 0 }, (err, data) => {
      if (err) {
        alert("Zip error: " + err);
        updateBtn("Error");
        $btn.css("background", "");
      } else {
        saveAs(new Blob([data], { type: "application/zip" }), "icons.zip");
        updateBtn("Download Icons (Zip)");
        $btn.prop("disabled", false);
        $btn.css("background", ""); // Reset background
      }
    });
  }

  // =================================================================
  // 5. UI MANAGER
  // =================================================================
  const UI = {
    built: false,
    activeTab: "ach",

    build() {
      if (this.built) return;
      const modal = `
                <div id="sk-overlay">
                    <div id="sk-modal">
                        <div class="sk-header">
                            <h3>SteamDB Tool</h3>
                            <span class="sk-close">&times;</span>
                        </div>
                        <div class="sk-nav">
                            <div class="sk-nav-item active" data-tab="ach">Achievements</div>
                            <div class="sk-nav-item" data-tab="dlc">DLC</div>
                        </div>
                        <div class="sk-body">
                            <div id="sk-tab-ach" class="sk-tab active">
                                <div class="sk-controls">
                                    <select id="sk-ach-preset" class="sk-select">
                                        <option value="tenoke_ach">Tenoke .ini</option>
                                        <option value="codex_ach">Codex .ini</option>
                                    </select>
                                    <button id="sk-btn-ach-copy" class="sk-btn sk-btn-secondary">Copy</button>
                                    <button id="sk-btn-ach-save" class="sk-btn sk-btn-primary">Save .ini</button>
                                </div>
                                <textarea id="sk-ach-output" class="sk-textarea" readonly>Loading...</textarea>
                                <div class="sk-controls" style="margin-top:15px;">
                                    <button id="sk-btn-img" class="sk-btn sk-btn-secondary" style="width:100%">Download Icons (Zip)</button>
                                </div>
                            </div>
                            <div id="sk-tab-dlc" class="sk-tab">
                                <div class="sk-controls">
                                    <select id="sk-dlc-preset" class="sk-select">
                                        <option value="tenoke_dlc">Tenoke .ini</option>
                                        <option value="cream">CreamAPI .ini</option>
                                    </select>
                                    <button id="sk-btn-dlc-copy" class="sk-btn sk-btn-secondary">Copy</button>
                                    <button id="sk-btn-dlc-save" class="sk-btn sk-btn-primary">Save .ini</button>
                                </div>
                                <textarea id="sk-dlc-output" class="sk-textarea" readonly>Loading...</textarea>
                            </div>
                            <!-- FOOTER -->
                            <div class="sk-footer">
                                <div id="sk-footer-stats"></div>
                                <div id="sk-status">Ready</div>
                            </div>
                        </div>
                    </div>
                </div>`;
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
        if (e.key === "Escape" && $("#sk-overlay").hasClass("active"))
          this.close();
      });

      $(".sk-nav-item").on("click", (e) => {
        const tab = $(e.currentTarget).data("tab");
        this.activeTab = tab; // Store state
        $(".sk-nav-item").removeClass("active");
        $(e.currentTarget).addClass("active");
        $(".sk-tab").removeClass("active");
        $(`#sk-tab-${tab}`).addClass("active");
        this.updateFooterStats(); // Refresh footer numbers
      });

      $("#sk-ach-preset").on("change", () => this.refreshPreview("ach"));
      $("#sk-btn-ach-save").on("click", () => this.saveFile("ach"));
      $("#sk-btn-ach-copy").on("click", () => this.copyToClip("ach"));
      $("#sk-btn-img").on("click", () => downloadIcons());

      $("#sk-dlc-preset").on("change", () => this.refreshPreview("dlc"));
      $("#sk-btn-dlc-save").on("click", () => this.saveFile("dlc"));
      $("#sk-btn-dlc-copy").on("click", () => this.copyToClip("dlc"));
    },

    saveFile(type) {
      const presetKey = $(`#sk-${type}-preset`).val();
      const content = $(`#sk-${type}-output`).val();
      const fname = presetKey.includes("tenoke")
        ? type === "ach"
          ? "tenoke_achievements.ini"
          : "tenoke_dlc.ini"
        : "config.ini";
      saveAs(new Blob([content], { type: "text/plain;charset=utf-8" }), fname);
    },

    copyToClip(type) {
      GM_setClipboard($(`#sk-${type}-output`).val());
      const $btn = $(`#sk-btn-${type}-copy`);
      const originalText = $btn.text();
      $btn.text("Copied!");
      setTimeout(() => $btn.text(originalText), 1000);
    },

    open() {
      if (!this.built) this.build();
      $("#sk-overlay").addClass("active");
      this.syncUI();
    },

    async syncUI() {
      const $status = $("#sk-status");

      if (Extractor.data.achievements.length || Extractor.data.dlcs.length) {
        this.refreshAll();
        return;
      }

      $status.text("Waiting for background fetch...");
      $("#sk-ach-output, #sk-dlc-output").val("Loading...");

      try {
        const res = await Extractor.loader;
        $status.text("Data loaded successfully.");
        this.refreshAll();
      } catch (e) {
        console.error(e);
        $status.text("Error!");
        $("#sk-ach-output").val("Error: " + e);
      }
    },

    refreshAll() {
      this.refreshPreview("ach");
      this.refreshPreview("dlc");
      this.updateFooterStats();
    },

    updateFooterStats() {
      const $stats = $("#sk-footer-stats");
      if (this.activeTab === "ach") {
        const count = Extractor.data.achievements.length;
        const images = count * 2;
        $stats.text(`${count} Achievements (${images} Images)`);
      } else {
        const count = Extractor.data.dlcs.length;
        $stats.text(`${count} DLCs Found`);
      }
    },

    refreshPreview(type) {
      const key = $(`#sk-${type}-preset`).val();
      const data =
        type === "ach" ? Extractor.data.achievements : Extractor.data.dlcs;
      const out = Generators[key].render(data);
      $(`#sk-${type}-output`).val(out);
    },
  };

  function init() {
    if (!Extractor.init()) return;
    const $btn = $('<div id="sk-trigger">SteamDB Tool</div>');
    $btn.on("click", () => UI.open());
    $("body").append($btn);
  }

  $(document).ready(init);
})(jQuery);
