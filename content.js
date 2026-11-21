// Runs on inspection-os.msei.in pages. Adds a floating "Autofill" button on chapter
// pages and answers fill requests from the popup.

(() => {
  if (window.__mseAutofillLoaded) return;
  window.__mseAutofillLoaded = true;
  const DEFAULTS = { overwrite: false, autoFill: false, firePostback: false, defaultRemarkNA: "", defaultRemarkNC: "" };

  const getState = () =>
    new Promise((res) => chrome.storage.local.get(["data", "settings"], (s) => res({ data: s.data, settings: { ...DEFAULTS, ...(s.settings || {}) } })));

  async function run() {
    const { data, settings } = await getState();
    if (!data) {
      const r = { error: "No Excel loaded yet. Click \"Load Excel\" (bottom left) or upload it from the extension icon." };
      showToast(r);
      return r;
    }
    const report = MSEFill.fill(document, data, settings);
    showToast(report);
    return report;
  }

  function summary(r) {
    if (r.error) return r.error;
    const lines = [`Chapter ${r.chapter.id}: ${r.filled} rows filled, ${r.statusSet} statuses set.`];
    if (r.skipped) lines.push(`${r.skipped} boxes already had values and were kept (turn on "Overwrite" to replace them).`);
    if (r.unmatchedPage.length) lines.push(`Not in Excel (red): ${r.unmatchedPage.join(", ")}`);
    if (r.textMismatch.length) lines.push(`Matched by S.No only, so check the wording (orange): ${r.textMismatch.join(", ")}`);
    if (r.unmatchedExcel.length) lines.push(`Excel rows not on page: ${r.unmatchedExcel.join(", ")}`);
    if (r.badStatus.length) lines.push(`Unknown status values: ${r.badStatus.join(", ")}`);
    lines.push("Review the page, then click Save.");
    return lines.join("\n");
  }

  function showToast(r) {
    document.getElementById("mse-autofill-toast")?.remove();
    const box = document.createElement("div");
    box.id = "mse-autofill-toast";
    box.style.cssText =
      "position:fixed;left:16px;bottom:64px;z-index:2147483647;max-width:420px;white-space:pre-wrap;" +
      "font:13px/1.45 Segoe UI,Arial,sans-serif;color:#1d2733;background:#fff;border-radius:6px;padding:12px 32px 12px 14px;" +
      "box-shadow:0 6px 24px rgba(0,0,0,.18);border-left:4px solid " + (r.error ? "#d9534f" : r.unmatchedPage?.length || r.badStatus?.length ? "#f0ad4e" : "#26a65b");
    box.textContent = summary(r);
    const x = document.createElement("span");
    x.textContent = "×";
    x.style.cssText = "position:absolute;top:6px;right:10px;cursor:pointer;font-size:18px;color:#888";
    x.onclick = () => box.remove();
    box.appendChild(x);
    document.body.appendChild(box);
    // Kept to the left and auto-closed so it never sits on the portal's Save buttons.
    let timer = setTimeout(() => box.remove(), 12000);
    box.onmouseenter = () => clearTimeout(timer);
    box.onmouseleave = () => { timer = setTimeout(() => box.remove(), 4000); };
  }

  // Excel can also be loaded right on the page (some Chrome setups close the popup when a file dialog opens).
  function pickExcel() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const parsed = parseAnnexure(await readFirstSheet(await file.arrayBuffer()));
        const data = { ...parsed, fileName: file.name, loadedAt: Date.now() };
        await new Promise((r) => chrome.storage.local.set({ data }, r));
        updateLabel();
        await run();
      } catch (e) {
        showToast({ error: "Could not read " + file.name + ": " + e.message });
      }
    };
    input.click();
  }

  const btnCss = (bg) =>
    "padding:9px 16px;border:0;border-radius:20px;background:" + bg + ";color:#fff;" +
    "font:600 13px Segoe UI,Arial,sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.2)";

  async function updateLabel() {
    const lbl = document.getElementById("mse-autofill-file");
    if (!lbl) return;
    const { data } = await getState();
    lbl.textContent = data ? data.fileName : "No Excel loaded";
    lbl.title = data ? "Loaded " + new Date(data.loadedAt).toLocaleString() : "";
  }

  function addButton() {
    if (!MSEFill.gridRows(document).length || document.getElementById("mse-autofill-bar")) return;
    const bar = document.createElement("div");
    bar.id = "mse-autofill-bar";
    bar.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:2147483647;display:flex;gap:8px;align-items:center";
    const lbl = document.createElement("span");
    lbl.id = "mse-autofill-file";
    lbl.style.cssText = "font:12px Segoe UI,Arial,sans-serif;color:#333;background:#fff;padding:4px 8px;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.15);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    const load = document.createElement("button");
    load.type = "button"; // never submit the ASP.NET form
    load.textContent = "Load Excel";
    load.style.cssText = btnCss("#5b6878");
    load.onclick = pickExcel;
    const fillBtn = document.createElement("button");
    fillBtn.type = "button";
    fillBtn.id = "mse-autofill-btn";
    fillBtn.textContent = "Autofill from Excel";
    fillBtn.style.cssText = btnCss("#1f6fb2");
    fillBtn.onclick = run;
    bar.append(lbl, load, fillBtn);
    document.body.appendChild(bar);
    updateLabel();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === "MSE_FILL") { run().then(reply); return true; }
    if (msg?.type === "MSE_INFO") { reply({ info: MSEFill.pageInfo(document), rows: MSEFill.gridRows(document).length }); }
  });

  chrome.storage.onChanged.addListener((c) => { if (c.data) updateLabel(); });
  addButton();
  getState().then(({ data, settings }) => {
    if (data && settings.autoFill && MSEFill.gridRows(document).length) run();
  });
})();
