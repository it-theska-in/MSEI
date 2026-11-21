const $ = (id) => document.getElementById(id);
const OPTS = ["overwrite", "defaultRemarkNA", "defaultRemarkNC"];
let hasData = false;

const store = {
  get: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
  set: (obj) => new Promise((r) => chrome.storage.local.set(obj, r))
};

function showLoaded(data) {
  hasData = !!data;
  if (!data) { $("loaded").textContent = "No file loaded."; $("loaded").className = "muted small"; return; }
  const chapters = Object.values(data.chapters);
  const rows = chapters.reduce((n, c) => n + c.rows.length, 0);
  $("loaded").className = "ok small";
  $("loaded").textContent = `${data.fileName}: ${chapters.length} chapters, ${rows} checkpoints` +
    (data.hasRemarksColumn ? ", has Remarks column" : "") + ` (loaded ${new Date(data.loadedAt).toLocaleString()})`;
}

function refreshButton() {
  $("fill").disabled = !hasData;
  $("fill").title = hasData ? "" : "Load the Excel first";
}

$("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $("loaded").className = "muted small";
  $("loaded").textContent = "Reading…";
  try {
    const rows = await readFirstSheet(await file.arrayBuffer());
    const parsed = parseAnnexure(rows);
    const data = { ...parsed, fileName: file.name, loadedAt: Date.now() };
    await store.set({ data });
    showLoaded(data);
  } catch (err) {
    $("loaded").className = "err small";
    $("loaded").textContent = "Could not read file: " + err.message;
  }
  refreshButton();
  e.target.value = "";
});

async function saveSettings() {
  const settings = {};
  for (const k of OPTS) settings[k] = $(k).type === "checkbox" ? $(k).checked : $(k).value;
  await store.set({ settings });
}
for (const k of OPTS) $(k).addEventListener($(k).type === "checkbox" ? "change" : "input", saveSettings);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const send = (tabId, msg) =>
  new Promise((res) => chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }, (r) => res(chrome.runtime.lastError ? null : r)));

// Talk to the page; if the content script isn't there (tab opened before install), inject it.
async function talk(tab, msg) {
  let r = await send(tab.id, msg);
  if (r) return r;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["fill.js", "content.js"] });
  } catch (e) {
    return { error: tab.url?.startsWith("file:")
      ? "Chrome blocks extensions on local files. In chrome://extensions > MSE Inspection Autofill > Details, turn on \"Allow access to file URLs\", then reload the page."
      : "Can't access this page. Open a chapter page on inspection-os.msei.in. (" + e.message + ")" };
  }
  return (await send(tab.id, msg)) || { error: "Could not reach the page. Reload the tab and try again." };
}

$("fill").addEventListener("click", async () => {
  $("result").className = "";
  $("result").textContent = "Filling…";
  const r = await talk(await activeTab(), { type: "MSE_FILL" });
  if (r.error) { $("result").className = "err"; $("result").textContent = r.error; return; }
  const warn = r.unmatchedPage.length || r.badStatus.length || r.textMismatch.length;
  $("result").className = warn ? "" : "ok";
  $("result").textContent = [
    `Chapter ${r.chapter.id}: ${r.filled} rows filled, ${r.statusSet} statuses set.`,
    r.skipped && `${r.skipped} boxes already had values and were kept (tick "Overwrite" to replace them).`,
    r.unmatchedPage.length && `Not in Excel (red): ${r.unmatchedPage.join(", ")}`,
    r.textMismatch.length && `Matched by S.No only, so check the wording (orange): ${r.textMismatch.join(", ")}`,
    r.unmatchedExcel.length && `Excel rows not on this page: ${r.unmatchedExcel.join(", ")}`,
    r.badStatus.length && `Unknown status values: ${r.badStatus.join(", ")}`,
    "Review the page, then click Save."
  ].filter(Boolean).join("\n");
});

(async () => {
  const { data, settings = {} } = await store.get(["data", "settings"]);
  showLoaded(data);
  for (const k of OPTS) {
    if ($(k).type === "checkbox") $(k).checked = !!settings[k];
    else $(k).value = settings[k] || "";
  }
  refreshButton();
  const r = await talk(await activeTab(), { type: "MSE_INFO" });
  if (r.error) $("page").textContent = r.error;
  else if (!r.rows) $("page").textContent = "This page has no audit grid. Open a chapter of the Internal Audit Report.";
  else $("page").textContent = `Chapter ${r.info.chapterId}: ${r.info.chapterName} (${r.rows} rows). Member: ${r.info.memberName}`;
})();
