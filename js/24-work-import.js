"use strict";
/* =============================================================
   งานหลายรายการ: นำเข้าจาก Excel / CSV / วางข้อความ • ส่งออกรายการงาน • คัดลอกไปวิชา/ห้องอื่น
   คอลัมน์: ลำดับ • ชื่องาน • รายละเอียด • กำหนดส่ง • คะแนนเต็ม • ช่องทางส่งงาน • ประเภท (เก็บ/กลางภาค/ปลายภาค)
   ============================================================= */

const WORK_COLS = ["ลำดับ", "ชื่องาน", "รายละเอียด/คำสั่งงาน", "กำหนดส่ง", "คะแนนเต็ม", "ช่องทางส่งงาน", "ประเภท"];
/** ตรวจหัวคอลัมน์ (ลำดับการตรวจสำคัญ: “วันที่ส่ง” ต้องเป็นกำหนดส่ง ไม่ใช่ “ที่” = ลำดับ) */
const WORK_HEAD = [
  ["due", /(กำหนด|วันส่ง|วันที่ส่ง|วันสอบ|ส่งภายใน|due|deadline|^date$|^วันที่$)/i],
  ["max", /(คะแนนเต็ม|เต็ม|^คะแนน$|max|full\s*(score|mark)|points?|^score$)/i],
  ["channel", /(ช่องทาง|ส่งทาง|ส่งที่|วิธีส่ง|channel|submit)/i],
  ["detail", /(รายละเอียด|คำอธิบาย|คำสั่ง|คำชี้แจง|description|detail|instruction)/i],
  ["part", /(ประเภท|ส่วนของคะแนน|หมวด|^ส่วน$|part|type|category)/i],
  ["title", /(ชื่องาน|ชื่อกิจกรรม|^งาน|กิจกรรม|ภาระงาน|title|task|assignment|^name$)/i],
  ["order", /^(ลำดับ|ลำดับที่|ที่|ข้อ|no\.?|#|order)$/i]
];
const THAI_MONTH = { "ม.ค.": 1, "มกราคม": 1, "ก.พ.": 2, "กุมภาพันธ์": 2, "มี.ค.": 3, "มีนาคม": 3, "เม.ย.": 4, "เมษายน": 4, "พ.ค.": 5, "พฤษภาคม": 5, "มิ.ย.": 6, "มิถุนายน": 6,
  "ก.ค.": 7, "กรกฎาคม": 7, "ส.ค.": 8, "สิงหาคม": 8, "ก.ย.": 9, "กันยายน": 9, "ต.ค.": 10, "ตุลาคม": 10, "พ.ย.": 11, "พฤศจิกายน": 11, "ธ.ค.": 12, "ธันวาคม": 12 };
const toArabicDigits = s => String(s ?? "").replace(/[๐-๙]/g, d => "๐๑๒๓๔๕๖๗๘๙".indexOf(d));
const isoOf = (y, m, d) => {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
};
const fullYear = y => { y = +y; if (y < 100) y += y >= 40 ? 2500 : 2000; return y > 2400 ? y - 543 : y; }; // ๖๙ → ๒๕๖๙ → 2026 • 26 → 2026

/** แปลงค่าวันที่ทุกรูปแบบ → "YYYY-MM-DD" • ว่าง/ในห้อง → "" • อ่านไม่ได้ → null */
function parseDue(v) {
  if (v instanceof Date && !isNaN(v)) return isoOf(v.getFullYear(), v.getMonth() + 1, v.getDate());
  let s = toArabicDigits(v).trim();
  if (!s || /^(-|–|ไม่มี|ในห้อง|ในคาบ|ส่งในห้อง|สอบในห้อง|กิจกรรม|none|n\/a)$/i.test(s)) return "";
  if (/^\d{5}(\.\d+)?$/.test(s)) { const n = Math.floor(+s); if (n > 20000 && n < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + n * 864e5); return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); } }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return isoOf(fullYear(m[1]), +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return isoOf(fullYear(m[3]), +m[2], +m[1]);            // วัน/เดือน/ปี (แบบไทย)
  m = s.replace(/^(วัน\S*\s*)?(ที่\s*)?/, "").match(/^(\d{1,2})\s*([ก-๙.]+)\s*(\d{2,4})?$/);
  if (m) {
    const key = Object.keys(THAI_MONTH).find(k => m[2].replace(/\s/g, "") === k || m[2].startsWith(k.replace(/\.$/, "")));
    if (key) return isoOf(m[3] ? fullYear(m[3]) : (db.term.semester === 2 && THAI_MONTH[key] <= 4 ? db.term.year - 542 : db.term.year - 543), THAI_MONTH[key], +m[1]);
  }
  return null;
}
function parsePart(v, title) {
  const s = String(v ?? "").trim().toLowerCase();
  if (/กลาง|mid/.test(s)) return "mid";
  if (/ปลาย|final/.test(s)) return "final";
  if (/เก็บ|collect|ระหว่าง/.test(s)) return "collect";
  if (!s) { if (/สอบกลางภาค|midterm/i.test(title)) return "mid"; if (/สอบปลายภาค|final\s*exam/i.test(title)) return "final"; }
  return "collect";
}
const normTitle = t => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();

/* ---------- อ่านไฟล์ (เก็บวันที่เป็น Date จริง ไม่แปลงเป็นข้อความกำกวม) ---------- */
async function readWorkFile(f) {
  const ext = f.name.split(".").pop().toLowerCase();
  if (["xlsx", "xls", "xlsm", "ods", "csv"].includes(ext)) {
    await loadScript("lib/xlsx.full.min.js");
    const buf = await f.arrayBuffer();
    const wb = ext === "csv" ? XLSX.read(new TextDecoder("utf-8").decode(buf).replace(/^﻿/, ""), { type: "string", raw: true }) : XLSX.read(buf, { type: "array", cellDates: true });
    const name = wb.SheetNames.find(n => !/วิธี|คำอธิบาย|help|readme/i.test(n)) || wb.SheetNames[0];
    return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
  }
  return textToRows(await f.text());
}

/** แถว → รายการงาน: หาแถวหัวตาราง ถ้าไม่มีใช้ลำดับคอลัมน์ ชื่องาน • รายละเอียด • กำหนดส่ง • คะแนนเต็ม • ช่องทาง */
function parseWorkRows(rows) {
  rows = rows.map(r => (Array.isArray(r) ? r : [r]));
  let map = null, start = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const m = {}, used = new Set();
    rows[i].forEach((cell, j) => {
      const h = String(cell ?? "").trim(); if (!h || h.length > 40) return;
      const hit = WORK_HEAD.find(([k, re]) => !used.has(k) && re.test(h));
      if (hit) { m[hit[0]] = j; used.add(hit[0]); }
    });
    if (m.title !== undefined && (m.max !== undefined || m.due !== undefined || m.detail !== undefined)) { map = m; start = i + 1; break; }
  }
  const guessed = !map;
  if (!map) map = { title: 0, detail: 1, due: 2, max: 3, channel: 4 };
  const out = [];
  rows.slice(start).forEach((r, k) => {
    const g = key => (map[key] === undefined ? "" : r[map[key]]);
    const title = String(g("title") ?? "").replace(/\s+/g, " ").trim();
    if (!title && !String(g("max") ?? "").trim()) return; // แถวว่าง
    const maxRaw = toArabicDigits(g("max")).replace(/คะแนน|pts?|points?/gi, "").trim();
    const max = maxRaw === "" ? null : +maxRaw.replace(/,/g, "");
    const dueRaw = g("due"), due = parseDue(dueRaw);
    const orderRaw = +toArabicDigits(g("order"));
    const row = { line: start + k + 1, title, detail: String(g("detail") ?? "").trim(), due, dueRaw: dueRaw instanceof Date ? "" : String(dueRaw ?? "").trim(),
      max, channel: String(g("channel") ?? "").trim(), part: parsePart(g("part"), title), order: orderRaw > 0 ? Math.floor(orderRaw) : null, errors: [] };
    if (!title) row.errors.push("ไม่มีชื่องาน");
    if (!(row.max > 0)) row.errors.push(maxRaw === "" ? "ไม่มีคะแนนเต็ม" : `คะแนนเต็ม “${maxRaw}” ไม่ใช่ตัวเลข`);
    if (due === null) row.errors.push(`อ่านวันที่ “${row.dueRaw}” ไม่ได้ (ใช้ วัน/เดือน/ปี เช่น 15/11/2569)`);
    out.push(row);
  });
  return { list: out, guessed, cols: Object.keys(map) };
}

/* ---------- หน้าต่างนำเข้างาน ---------- */
let wimp = null;
function importWorks() {
  if (ui.archive) return toast("โหมดดูย้อนหลังแก้ไขไม่ได้");
  wimp = { list: [], source: "", guessed: false, targets: new Set([ui.courseId]), dup: "update" };
  modal(`${ico("download", "tab")}นำเข้างานหลายรายการ`, `
    <p class="muted small" style="margin-top:0">รับข้อมูล <b>ชื่องาน • รายละเอียด • กำหนดส่ง • คะแนนเต็ม • ช่องทางส่งงาน</b> (และ ลำดับ • ประเภท เก็บ/กลางภาค/ปลายภาค ถ้ามี) • หัวคอลัมน์สลับลำดับได้</p>
    <div class="toolbar">
      <label class="btn primary">📂 เลือกไฟล์ Excel / CSV<input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt" hidden onchange="wimpFile(this.files[0])"></label>
      <button class="btn gray" onclick="workTemplate()">⬇️ แม่แบบ Excel</button>
      ${courseItems().length ? `<button class="btn gray" onclick="exportWorks()">⬇️ รายการงานของวิชานี้ (${courseItems().length})</button>` : ""}
    </div>
    <details class="section" id="wimpTextBox"><summary><b>✏️ หรือคัดลอกจาก Excel / Google Sheets แล้ววางที่นี่</b></summary>
      <textarea class="input" id="wimpText" rows="5" style="width:100%;margin-top:8px" placeholder="ชื่องาน&#9;รายละเอียด&#9;กำหนดส่ง&#9;คะแนนเต็ม&#9;ช่องทางส่งงาน&#10;Unit 1 Worksheet&#9;ทำแบบฝึกหัดหน้า 12&#9;15/11/2569&#9;10&#9;Google Classroom"></textarea>
      <button class="btn small" style="margin-top:6px" onclick="wimpParse(textToRows($('wimpText').value), 'ข้อความที่วาง')">อ่านข้อความ</button></details>
    <h3 style="margin:14px 0 6px">นำเข้าไปที่วิชา / ห้อง <span class="muted small" style="font-weight:400">(เลือกหลายวิชาได้ = คัดลอกไปหลายห้องพร้อมกัน)</span></h3>
    <div class="checklist" style="max-height:170px">${db.courses.map(c => `<label class="check"><input type="checkbox" class="wimpCo" value="${esc(c.id)}" ${c.id === ui.courseId ? "checked" : ""} onchange="wimpRender()"> <span><b>${esc(courseLabel(c))}</b> <span class="muted small">${courseClasses(c).map(x => esc(x.name)).join(", ") || "ยังไม่มีห้อง"}</span></span></label>`).join("")}</div>
    <div id="wimpResult"></div>`, "นำเข้า", wimpApply, { wide: true });
  $("mok").disabled = true;
}
async function wimpFile(f) {
  if (!f) return;
  $("wimpResult").innerHTML = `<div class="note">⏳ กำลังอ่าน ${esc(f.name)} …</div>`;
  try { wimpParse(await readWorkFile(f), f.name); }
  catch (e) { console.error(e); $("wimpResult").innerHTML = `<div class="warning">⚠️ อ่านไฟล์ไม่สำเร็จ: ${esc(e.message || e)} — ลองบันทึกเป็น .xlsx หรือคัดลอกมาวางแทน</div>`; }
}
function wimpParse(rows, source) {
  const r = parseWorkRows(rows || []);
  wimp.list = r.list; wimp.guessed = r.guessed; wimp.source = source;
  if (!r.list.length) { $("wimpResult").innerHTML = `<div class="warning">⚠️ ไม่พบรายการงานใน${esc(source)} — ต้องมีอย่างน้อยคอลัมน์ “ชื่องาน” และ “คะแนนเต็ม” (ดูแม่แบบ Excel)</div>`; $("mok").disabled = true; return; }
  wimpRender();
}
/** แผนการนำเข้า: แต่ละงาน × แต่ละวิชาเป้าหมาย */
function wimpPlan() {
  const targets = [...document.querySelectorAll(".wimpCo:checked")].map(x => db.courses.find(c => c.id === x.value)).filter(Boolean);
  const seen = new Map();
  const rows = wimp.list.map(w => {
    const k = normTitle(w.title), dupInFile = seen.has(k); seen.set(k, true);
    const per = targets.map(co => {
      const old = db.items.find(i => i.courseId === co.id && normTitle(i.title) === k);
      let part = w.part, note = "";
      if (isThai(co) && part !== "collect" && !(co.scheme[part] > 0)) { note = `วิชานี้ไม่มี${PARTS[part].label} → ใส่เป็นคะแนนเก็บ`; part = "collect"; }
      const tooLow = old && db.marks.some(m => m.itemId === old.id && m.score > w.max);
      return { co, old, part, note, tooLow };
    });
    let status = "new";
    if (w.errors.length) status = "error";
    else if (dupInFile) status = "dupfile";
    else if (per.some(p => p.old)) status = wimp.dup === "update" ? "update" : "skip";
    return { w, per, status };
  });
  return { targets, rows };
}
function wimpRender() {
  const box = $("wimpResult"); if (!box || !wimp?.list.length) return;
  const P = wimpPlan(), cnt = s => P.rows.filter(r => r.status === s).length;
  const ok = P.rows.filter(r => r.status === "new" || r.status === "update").length;
  const pill = { new: ["p", "ใหม่"], update: ["leave", "อัปเดต"], skip: ["gray", "ข้าม (มีแล้ว)"], error: ["a", "ข้อมูลไม่ครบ"], dupfile: ["a", "ชื่อซ้ำในไฟล์"] };
  const anyOld = P.rows.some(r => r.per.some(p => p.old));
  box.innerHTML = `
    <div class="note">✅ พบ <b>${P.rows.length}</b> งาน จาก ${esc(wimp.source)}${wimp.guessed ? " (ไม่พบหัวคอลัมน์ — อ่านตามลำดับ ชื่องาน • รายละเอียด • กำหนดส่ง • คะแนนเต็ม • ช่องทาง)" : ""} • ใหม่ ${cnt("new")} • อัปเดต ${cnt("update")}${cnt("skip") ? ` • ข้าม ${cnt("skip")}` : ""}${cnt("error") + cnt("dupfile") ? ` • <span class="danger">มีปัญหา ${cnt("error") + cnt("dupfile")}</span>` : ""}
      ${P.targets.length ? ` → ${P.targets.length} วิชา (${P.targets.map(c => courseClasses(c).length).reduce((a, b) => a + b, 0)} ห้อง)` : ""}</div>
    ${anyOld ? `<div class="toolbar small" style="margin:6px 0">งานที่มีชื่อเดียวกันอยู่แล้ว:
      <label class="check"><input type="radio" name="wimpDup" value="update" ${wimp.dup === "update" ? "checked" : ""} onchange="wimp.dup='update';wimpRender()"> อัปเดตรายละเอียด/วันส่ง/คะแนนเต็ม (คะแนนนักเรียนเดิมยังอยู่)</label>
      <label class="check"><input type="radio" name="wimpDup" value="skip" ${wimp.dup === "skip" ? "checked" : ""} onchange="wimp.dup='skip';wimpRender()"> ข้าม ไม่แก้ไข</label></div>` : ""}
    ${P.targets.length ? "" : `<div class="warning">เลือกวิชา/ห้องที่จะนำเข้าอย่างน้อย 1 รายการ</div>`}
    <div class="table-wrap" style="max-height:330px"><table class="table"><thead><tr><th>สถานะ</th><th>ลำดับ</th><th>ชื่องาน</th><th>ประเภท</th><th>เต็ม</th><th>กำหนดส่ง</th><th>ช่องทาง</th><th>รายละเอียด</th></tr></thead><tbody>
    ${P.rows.map(({ w, per, status }) => {
      const notes = [...w.errors, ...(status === "dupfile" ? ["ชื่อซ้ำกับแถวก่อนหน้า — ข้าม"] : []), ...per.filter(p => p.note).map(p => p.note), ...per.filter(p => p.tooLow && status === "update").map(p => `มีนักเรียนได้เกิน ${w.max} ใน ${courseLabel(p.co)} — จะคงคะแนนเต็มเดิม`)];
      return `<tr class="${status === "error" || status === "dupfile" ? "rowbad" : ""}"><td><span class="pill ${pill[status][0]}">${pill[status][1]}</span></td><td>${w.order ?? "auto"}</td>
        <td><b>${esc(w.title || "—")}</b>${notes.length ? `<div class="small danger">${notes.map(esc).join(" • ")}</div>` : ""}</td>
        <td class="small">${PARTS[w.part].short}</td><td>${w.max > 0 ? fmtNum(w.max) : "—"}</td>
        <td class="small">${w.due ? fmtDate(w.due) : w.due === "" ? '<span class="muted">ในห้อง</span>' : `<span class="danger">${esc(w.dueRaw)}</span>`}</td>
        <td class="small">${esc(w.channel || "—")}</td><td class="small muted">${esc(w.detail.slice(0, 60))}${w.detail.length > 60 ? "…" : ""}</td></tr>`;
    }).join("")}</tbody></table></div>
    <p class="muted small">ไม่นำเข้าคะแนนของนักเรียน • งานจะมีให้ทุกห้องของวิชาที่เลือก • ทำผิดกด “เลิกทำ” ได้</p>`;
  $("mok").disabled = !(ok && P.targets.length);
  $("mok").textContent = ok ? `นำเข้า ${ok} งาน` : "นำเข้า";
}
function wimpApply() {
  const P = wimpPlan();
  const go = P.rows.filter(r => r.status === "new" || r.status === "update");
  if (!go.length || !P.targets.length) return;
  checkpoint(`นำเข้างาน ${go.length} รายการ`);
  let created = 0, updated = 0;
  P.targets.forEach(co => {
    const nextOrder = {};
    const bump = p => (nextOrder[p] = (nextOrder[p] ?? Math.max(0, ...db.items.filter(i => i.courseId === co.id && partOf(i) === p).map(i => i.order || 0))) + 1);
    go.forEach(({ w, per }) => {
      const x = per.find(p => p.co.id === co.id);
      const data = { title: w.title, detail: w.detail, due: w.due || "", channel: w.channel };
      if (x.old) {
        if (wimp.dup !== "update") return;
        Object.assign(x.old, data);
        if (!x.tooLow) x.old.max = w.max;
        if (isThai(co)) { x.old.part = x.part; if (w.order) x.old.order = w.order; }
        updated++;
      } else {
        const order = w.order || bump(x.part);
        if (w.order) nextOrder[x.part] = Math.max(nextOrder[x.part] ?? 0, w.order);
        db.items.push({ id: uid(), courseId: co.id, ...data, max: w.max, weight: 1, part: x.part, order });
        created++;
      }
    });
  });
  save(); closeModal(); workPage();
  offerUndo(`นำเข้างานแล้ว: ใหม่ ${created}${updated ? ` • อัปเดต ${updated}` : ""} (${P.targets.length} วิชา)`);
}

/* ---------- แม่แบบ / ส่งออกรายการงาน (นำกลับเข้าได้ทันที) ---------- */
async function writeWorkBook(rows, name) {
  await loadScript("lib/xlsx.full.min.js");
  const ws = XLSX.utils.aoa_to_sheet([WORK_COLS, ...rows], { cellDates: true });
  ws["!cols"] = [6, 32, 46, 13, 10, 20, 12].map(w => ({ wch: w }));
  for (let r = 1; r <= rows.length; r++) { const c = ws[XLSX.utils.encode_cell({ r, c: 3 })]; if (c && c.t === "d") c.z = "d/m/yyyy"; }
  const help = XLSX.utils.aoa_to_sheet([["วิธีกรอก (แผ่นงานนี้ระบบไม่อ่าน)"], [], ["ชื่องาน", "จำเป็น • ชื่อซ้ำกับงานที่มีอยู่ = อัปเดตงานเดิม"], ["คะแนนเต็ม", "จำเป็น • ตัวเลข"], ["กำหนดส่ง", "วัน/เดือน/ปี เช่น 15/11/2569 หรือ 15/11/2026 หรือ 15 พ.ย. 69 • เว้นว่าง = กิจกรรม/สอบในห้อง"],
    ["รายละเอียด/คำสั่งงาน", "ไม่บังคับ • นักเรียนเห็นในรายงานงานค้าง"], ["ช่องทางส่งงาน", "ไม่บังคับ เช่น Google Classroom / ส่งในห้อง / สมุด"], ["ประเภท", "เก็บ / กลางภาค / ปลายภาค (เว้นว่าง = เก็บ)"], ["ลำดับ", "ไม่บังคับ • เลขข้อในแบบบันทึกคะแนน (เว้นว่าง = ต่อท้าย)"]]);
  help["!cols"] = [{ wch: 22 }, { wch: 80 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "รายการงาน");
  XLSX.utils.book_append_sheet(wb, help, "วิธีกรอก");
  XLSX.writeFile(wb, name);
}
const dueDate = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
function workTemplate() {
  const t = new Date(), d = n => new Date(t.getFullYear(), t.getMonth(), t.getDate() + n);
  writeWorkBook([
    [1, "Unit 1 Worksheet", "ทำแบบฝึกหัดหน้า 12–13 ข้อ 1–10", d(7), 10, "Google Classroom", "เก็บ"],
    [2, "Unit 1 Speaking: Introduce Yourself", "พูดแนะนำตัว 1 นาที อัดคลิปส่ง", d(14), 10, "LINE กลุ่ม", "เก็บ"],
    [3, "Quiz Unit 1", "สอบย่อยในคาบ", "", 20, "ในห้อง", "เก็บ"],
    ["", "สอบปลายภาค", "", "", 20, "", "ปลายภาค"]
  ], "work-template.xlsx").catch(e => toast("สร้างแม่แบบไม่สำเร็จ: " + e.message));
}
function exportWorks(courseId = ui.courseId) {
  const co = db.courses.find(c => c.id === courseId);
  const rows = courseItems(courseId).map(i => [i.order || "", i.title, i.detail || "", dueDate(i.due), i.max, i.channel || "", PARTS[partOf(i)].short]);
  writeWorkBook(rows, stampName(`works_${String(co?.code || "course").replace(/[^\w]/g, "") || "course"}_term${db.term.semester}-${db.term.year}`, "xlsx"))
    .then(() => toast(`ดาวน์โหลดรายการงาน ${rows.length} รายการ — แก้ไขแล้วนำเข้ากลับ หรือนำไปใช้กับวิชาอื่นได้`))
    .catch(e => toast("ส่งออกไม่สำเร็จ: " + e.message));
}

/* ---------- คัดลอกงานหลายรายการไปวิชา/ห้องอื่น ---------- */
function copyWorks(preselect = null) {
  if (ui.archive) return toast("โหมดดูย้อนหลังแก้ไขไม่ได้");
  const items = courseItems(), others = db.courses.filter(c => c.id !== ui.courseId);
  if (!items.length) return toast("วิชานี้ยังไม่มีงาน");
  if (!others.length) return toast("ยังไม่มีวิชาอื่น — เพิ่มวิชา/ห้องได้ที่เมนู ชั้น/ห้อง/นักเรียน");
  const pre = preselect ? new Set([preselect]) : null;
  modal(`📄 คัดลอกงานไปวิชา/ห้องอื่น`, `
    <p class="muted small" style="margin-top:0">คัดลอกเฉพาะ <b>ชื่องาน รายละเอียด กำหนดส่ง คะแนนเต็ม ช่องทาง ประเภท</b> — ไม่คัดลอกคะแนนนักเรียน • งานจะมีให้ทุกห้องของวิชาปลายทาง</p>
    <div class="two-col">
      <div><h3 style="margin:6px 0">1. เลือกงาน <label class="check small" style="display:inline-flex;margin-left:8px"><input type="checkbox" ${pre ? "" : "checked"} onchange="document.querySelectorAll('.cpIt').forEach(x=>x.checked=this.checked);cpCount()"> ทั้งหมด</label></h3>
        <div class="checklist">${items.map(i => `<label class="check"><input type="checkbox" class="cpIt" value="${i.id}" ${!pre || pre.has(i.id) ? "checked" : ""} onchange="cpCount()"> <span>${esc(i.title)} <span class="muted small">• เต็ม ${fmtNum(i.max)}${i.due ? " • ส่ง " + fmtDate(i.due) : " • ในห้อง"}</span></span></label>`).join("")}</div></div>
      <div><h3 style="margin:6px 0">2. ไปที่วิชา / ห้อง</h3>
        <div class="checklist">${others.map(c => `<label class="check"><input type="checkbox" class="cpCo" value="${esc(c.id)}" onchange="cpCount()"> <span><b>${esc(courseLabel(c))}</b><br><span class="muted small">${courseClasses(c).map(x => esc(x.name)).join(", ") || "ยังไม่มีห้อง"}</span></span></label>`).join("")}</div>
        <label class="check small" style="margin-top:8px"><input type="checkbox" id="cpUpd"> ถ้ามีงานชื่อเดียวกันอยู่แล้ว ให้อัปเดตรายละเอียด (ปกติ = ข้าม)</label></div>
    </div><div id="cpInfo" class="note" style="margin-top:10px"></div>`, "คัดลอก", copyWorksApply, { wide: true });
  cpCount();
}
function cpCount() {
  const n = document.querySelectorAll(".cpIt:checked").length, cos = [...document.querySelectorAll(".cpCo:checked")].map(x => db.courses.find(c => c.id === x.value));
  const rooms = cos.reduce((a, c) => a + courseClasses(c).length, 0);
  $("cpInfo").innerHTML = n && cos.length ? `จะคัดลอก <b>${n}</b> งาน ไป <b>${cos.length}</b> วิชา (${rooms} ห้อง)` : "เลือกงานและวิชาปลายทาง";
  $("mok").disabled = !(n && cos.length);
}
function copyWorksApply() {
  const ids = new Set([...document.querySelectorAll(".cpIt:checked")].map(x => +x.value));
  const targets = [...document.querySelectorAll(".cpCo:checked")].map(x => db.courses.find(c => c.id === x.value)).filter(Boolean);
  const upd = $("cpUpd").checked, items = courseItems().filter(i => ids.has(i.id));
  if (!items.length || !targets.length) return;
  checkpoint(`คัดลอกงาน ${items.length} รายการ`);
  let created = 0, updated = 0, skipped = 0;
  targets.forEach(co => {
    const top = {};
    items.forEach(it => {
      let part = partOf(it);
      if (isThai(co) && part !== "collect" && !(co.scheme[part] > 0)) part = "collect";
      const old = db.items.find(i => i.courseId === co.id && normTitle(i.title) === normTitle(it.title));
      const data = { title: it.title, detail: it.detail || "", due: it.due || "", channel: it.channel || "" };
      if (old) {
        if (!upd) { skipped++; return; }
        Object.assign(old, data);
        if (!db.marks.some(m => m.itemId === old.id && m.score > it.max)) old.max = it.max;
        updated++; return;
      }
      top[part] ??= Math.max(0, ...db.items.filter(i => i.courseId === co.id && partOf(i) === part).map(i => i.order || 0));
      db.items.push({ id: uid(), courseId: co.id, ...data, max: it.max, weight: it.weight || 1, part, order: ++top[part] });
      created++;
    });
  });
  save(); closeModal(); workPage();
  offerUndo(`คัดลอกแล้ว: ใหม่ ${created}${updated ? ` • อัปเดต ${updated}` : ""}${skipped ? ` • ข้าม ${skipped} (มีอยู่แล้ว)` : ""} → ${targets.length} วิชา`);
}
