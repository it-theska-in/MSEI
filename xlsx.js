// Minimal .xlsx reader (no dependencies) + Annexure II parser.
// Works in the extension popup and in Node 18+ (for testing).

async function unzip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file (zip directory not found).");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const lNameLen = view.getUint16(local + 26, true);
    const lExtraLen = view.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    files[name] = { method, data: bytes.subarray(start, start + csize) };
  }
  return {
    async text(name) {
      const f = files[name];
      if (!f) return null;
      if (f.method === 0) return dec.decode(f.data);
      if (f.method !== 8) throw new Error("Unsupported compression in " + name);
      const stream = new Blob([f.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(stream).text();
    }
  };
}

function xmlDecode(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, "&");
}

function textRuns(xml) {
  let out = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return xmlDecode(out);
}

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// For each cell style index: "percent", "date", or null. Lets numbers typed as
// 6% or 30/09/2026 come out the way they look in Excel instead of 0.06 / 46295.
function styleNumberKinds(stylesXml) {
  if (!stylesXml) return [];
  const custom = {};
  for (const m of stylesXml.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) custom[m[1]] = xmlDecode(m[2]);
  const xfs = (stylesXml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/) || [""])[0];
  return [...xfs.matchAll(/<xf\b[^>]*>/g)].map((m) => {
    const id = +((m[0].match(/numFmtId="(\d+)"/) || [])[1] || 0);
    if (id === 9 || id === 10) return "percent";
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return "date";
    const code = (custom[id] || "").replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
    if (code.includes("%")) return "percent";
    if (/[dy]/i.test(code) || /m{3,}/i.test(code)) return "date";
    return null;
  });
}

function formatNumber(n, kind) {
  if (kind === "percent") return +(n * 100).toFixed(2) + "%";
  const d = new Date(Math.round((n - 25569) * 86400000));
  const p = (x) => String(x).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Returns the first worksheet as an array of rows (arrays of strings).
async function readFirstSheet(buffer) {
  const zip = await unzip(buffer);
  const wb = await zip.text("xl/workbook.xml");
  const rels = await zip.text("xl/_rels/workbook.xml.rels");
  let sheetPath = "xl/worksheets/sheet1.xml";
  const firstSheet = wb && wb.match(/<sheet\b[^>]*r:id="([^"]+)"/);
  if (firstSheet && rels) {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0])
      .find(r => r.includes(`Id="${firstSheet[1]}"`));
    const target = rel && rel.match(/Target="([^"]+)"/);
    if (target) sheetPath = target[1].startsWith("/") ? target[1].slice(1) : "xl/" + target[1];
  }
  const ssXml = await zip.text("xl/sharedStrings.xml");
  const shared = ssXml ? [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textRuns(m[1])) : [];
  const styleKinds = styleNumberKinds(await zip.text("xl/styles.xml"));
  const sheet = await zip.text(sheetPath);
  if (!sheet) throw new Error("Worksheet not found in workbook.");
  const rows = [];
  for (const rm of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rNum = +((rm[1].match(/\br="(\d+)"/) || [])[1] || rows.length + 1);
    const row = [];
    for (const cm of (rm[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] || "";
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/\bt="(\w+)"/) || [])[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/);
      let val = "";
      if (type === "s" && v) val = shared[+v[1]] ?? "";
      else if (type === "inlineStr") val = textRuns(body);
      else if (v) {
        val = xmlDecode(v[1]);
        const kind = !type || type === "n" ? styleKinds[+((attrs.match(/\bs="(\d+)"/) || [])[1] || 0)] : null;
        if (kind && val !== "" && !isNaN(+val)) val = formatNumber(+val, kind);
      }
      val = val.replace(/_x([0-9A-F]{4})_/g, (_, h) => (h === "000D" ? "" : String.fromCharCode(parseInt(h, 16))));
      row[ref ? colIndex(ref) : row.length] = val;
    }
    rows[rNum - 1] = row;
  }
  return Array.from(rows, r => Array.from(r || [], c => (c == null ? "" : String(c))));
}

// Parse the Annexure II layout:
//  A=Area/SubArea (0 = chapter header, 1 = checkpoint), B=HeaderId (chapter no.),
//  D=S.No, E=Area of Verification, F=C/NC/N.A, G=Sample size, H=No. of instances,
//  I=% of instances, J=Amount, plus an optional "Remarks" column found by header text.
function parseAnnexure(rows) {
  let remarksCol = -1;
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    (rows[r] || []).forEach((v, c) => { if (remarksCol < 0 && /remark/i.test(v)) remarksCol = c; });
  }
  const chapters = {};
  let cur = null;
  const pick = (row) => ({
    status: (row[5] || "").trim(),
    samples: (row[6] || "").trim(),
    instances: (row[7] || "").trim(),
    percent: (row[8] || "").trim(),
    amount: (row[9] || "").trim(),
    remarks: remarksCol >= 0 ? (row[remarksCol] || "").trim() : ""
  });
  rows.forEach((row, i) => {
    if (!row) return;
    const kind = (row[0] || "").trim();
    if (kind === "0" && (row[1] || "").trim()) {
      const id = row[1].trim();
      cur = { id, name: (row[4] || "").trim(), header: { excelRow: i + 1, sno: "", area: (row[4] || "").trim(), ...pick(row) }, rows: [] };
      chapters[id] = cur;
    } else if (kind === "1" && cur) {
      cur.rows.push({ excelRow: i + 1, sno: (row[3] || "").trim(), area: (row[4] || "").trim(), ...pick(row) });
    }
  });
  // Chapters with no checkpoints (e.g. 22, 23) keep their answer on the header row.
  for (const ch of Object.values(chapters)) {
    if (!ch.rows.length && ch.header.status) ch.rows.push(ch.header);
    delete ch.header;
  }
  if (!Object.keys(chapters).length) {
    throw new Error("No chapters found. Expected the Annexure II layout (column A = 0/1, column B = chapter no.).");
  }
  return { chapters, hasRemarksColumn: remarksCol >= 0 };
}

if (typeof module !== "undefined") module.exports = { readFirstSheet, parseAnnexure };
