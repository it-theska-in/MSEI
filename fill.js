// Core fill logic for the MSE "InternalAuditReport_Chapter.aspx" grid.
// Kept free of chrome.* APIs so it can be tested against a saved copy of the page.

var MSEFill = (() => {
  const GRID_ID = "ContentPlaceHolder1_gvACRData";
  const FIELDS = [
    { key: "remarks", suffix: "txtRemarks", max: 1000 },
    { key: "samples", suffix: "txtNoOfSamples", max: 200 },
    { key: "instances", suffix: "txtNoOfInstances", max: 200 },
    { key: "percent", suffix: "txtPerofNonCompliance", max: 200 },
    { key: "amount", suffix: "txtAmountofNonCompliance", max: 200 }
  ];

  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

  // The portal blocks typing " ' - ; = in these boxes, so keep values within that rule.
  const clean = (s, max) =>
    String(s || "").replace(/["';=]/g, "").replace(/-/g, " ").replace(/[ \t]{2,}/g, " ").trim().slice(0, max);

  function statusText(raw) {
    const s = norm(raw);
    if (["c", "complied"].includes(s)) return "complied";
    if (["nc", "noncomplied", "notcomplied", "noncompliance"].includes(s)) return "notcomplied";
    if (["na", "notapplicable"].includes(s)) return "notapplicable";
    return null;
  }

  function pageInfo(doc) {
    const val = (id) => (doc.getElementById(id) || {}).value || "";
    return {
      chapterId: val("ContentPlaceHolder1_txtChapterId").trim(),
      chapterName: val("ContentPlaceHolder1_txtChapterName").trim(),
      memberCode: val("ContentPlaceHolder1_txtMemberCd").trim(),
      memberName: val("ContentPlaceHolder1_txtMemberName").trim()
    };
  }

  function gridRows(doc) {
    const grid = doc.getElementById(GRID_ID);
    if (!grid) return [];
    return [...grid.querySelectorAll("select[id^='" + GRID_ID + "_drpStatus_']")].map((sel) => {
      const idx = sel.id.split("_").pop();
      const tr = sel.closest("tr");
      const cells = tr.querySelectorAll(":scope > td");
      return {
        idx,
        tr,
        select: sel,
        sno: (cells[0]?.textContent || "").trim(),
        area: (cells[1]?.textContent || "").replace(/\s+/g, " ").trim(),
        box: (suffix) => doc.getElementById(GRID_ID + "_" + suffix + "_" + idx)
      };
    });
  }

  function findChapter(data, info) {
    if (data.chapters[info.chapterId]) return data.chapters[info.chapterId];
    const n = norm(info.chapterName);
    return Object.values(data.chapters).find((c) => n && norm(c.name).startsWith(n.slice(0, 40))) || null;
  }

  // Match by checkpoint text first (survives re-ordering), then by S.No, then by position.
  function matchRows(pageRows, excelRows) {
    const used = new Set();
    const key = (s) => norm(s).slice(0, 120);
    const pairs = pageRows.map((pr) => {
      const k = key(pr.area);
      let ex = excelRows.find((e) => !used.has(e) && k && key(e.area) === k);
      let how = "text";
      if (!ex) { ex = excelRows.find((e) => !used.has(e) && e.sno && norm(e.sno) === norm(pr.sno)); how = "sno"; }
      if (!ex && pageRows.length === 1 && excelRows.length === 1 && !used.has(excelRows[0])) { ex = excelRows[0]; how = "only-row"; }
      if (ex) used.add(ex);
      return { pr, ex, how };
    });
    return { pairs, unusedExcel: excelRows.filter((e) => !used.has(e)) };
  }

  function setBox(el, value) {
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // The portal's CSS sets "outline: 0 !important" on .form-control, so use an important box-shadow.
  function mark(el, color) {
    el.style.setProperty("box-shadow", "0 0 0 2px " + color, "important");
  }

  /**
   * opts: { overwrite, defaultRemarkNA, defaultRemarkNC }
   * Statuses are set without the page's auto-postback (no refresh); the values are
   * submitted when the user clicks Save.
   */
  function fill(doc, data, opts = {}) {
    const info = pageInfo(doc);
    const report = { info, chapter: null, filled: 0, skipped: 0, statusSet: 0, unmatchedPage: [], unmatchedExcel: [], badStatus: [], textMismatch: [] };
    const rows = gridRows(doc);
    if (!rows.length) { report.error = "No audit grid found on this page. Open a chapter page in the Internal Audit Report first."; return report; }
    const chapter = findChapter(data, info);
    if (!chapter) { report.error = `Chapter ${info.chapterId} (${info.chapterName}) not found in the uploaded Excel.`; return report; }
    report.chapter = { id: chapter.id, name: chapter.name };

    const { pairs, unusedExcel } = matchRows(rows, chapter.rows);
    report.unmatchedExcel = unusedExcel.map((e) => `${e.sno || "-"} (Excel row ${e.excelRow})`);

    for (const { pr, ex, how } of pairs) {
      if (!ex) { report.unmatchedPage.push(pr.sno); mark(pr.select, "#d9534f"); continue; }
      if (how === "sno") report.textMismatch.push(`${pr.sno} (Excel row ${ex.excelRow})`);
      const color = how === "text" || how === "only-row" ? "#26a65b" : "#f0ad4e";

      const want = statusText(ex.status);
      if (ex.status && !want) report.badStatus.push(`${pr.sno}: "${ex.status}"`);
      if (want) {
        const opt = [...pr.select.options].find((o) => norm(o.text) === want);
        const isBlank = pr.select.value === "0" || pr.select.selectedIndex <= 0;
        if (opt && (opts.overwrite || isBlank) && pr.select.value !== opt.value) {
          pr.select.value = opt.value;
          report.statusSet++;
        }
        if (opt) mark(pr.select, color);
      }

      const values = { ...ex };
      if (!values.remarks && want === "notapplicable" && opts.defaultRemarkNA) values.remarks = opts.defaultRemarkNA;
      if (!values.remarks && want === "notcomplied" && opts.defaultRemarkNC) values.remarks = opts.defaultRemarkNC;

      let any = false;
      for (const f of FIELDS) {
        const el = pr.box(f.suffix);
        const v = clean(values[f.key], f.max);
        if (!el || !v) continue;
        if (el.value.trim() && el.value.trim() !== v && !opts.overwrite) { report.skipped++; continue; }
        if (el.value !== v) setBox(el, v);
        mark(el, color);
        any = true;
      }
      if (any || want) report.filled++;
    }

    return report;
  }

  return { fill, pageInfo, gridRows, statusText };
})();

if (typeof module !== "undefined") module.exports = MSEFill;
