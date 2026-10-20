"use strict";
/* =============================================================
   นำเข้ารายชื่อนักเรียน: Excel (.xlsx/.xls/.csv) • PDF • ข้อความ
   อ่านไฟล์ในเครื่องเท่านั้น ไม่มีการส่งข้อมูลออกไปภายนอก
   ============================================================= */
const toArabic = s => String(s ?? "").replace(/[๐-๙]/g, d => "๐๑๒๓๔๕๖๗๘๙".indexOf(d));
const _scripts = {};
function loadScript(src) {
  if (!_scripts[src]) _scripts[src] = new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok;
    s.onerror = () => { delete _scripts[src]; fail(new Error("โหลดไฟล์ " + src + " ไม่สำเร็จ")); };
    document.head.append(s);
  });
  return _scripts[src];
}

let imp = null; // ผลการวิเคราะห์ล่าสุด

function importStudents() {
  const c = cls(ui.manageClassId);
  imp = null;
  modal(`📥 นำเข้ารายชื่อนักเรียน → ${esc(c?.name || "")}`, `
    <div class="dropzone" id="dropzone">
      <div style="font-size:34px">📄</div>
      <b>ลากไฟล์มาวางที่นี่ หรือ <label class="linkbtn">เลือกไฟล์<input type="file" id="impFile" hidden accept=".xlsx,.xls,.csv,.pdf,.txt" onchange="impReadFile(this.files[0])"></label></b>
      <div class="muted small">รองรับ Excel (.xlsx .xls .csv) • PDF (ที่คัดลอกข้อความได้) • ไฟล์ข้อความ</div>
    </div>
    <details class="section" id="impTextBox"><summary><b>✏️ หรือวางรายชื่อเป็นข้อความ</b></summary>
      <textarea class="input" id="impText" rows="7" style="width:100%;margin-top:8px" placeholder="1&#9;10001&#9;เด็กชายกิตติ ใจดี&#10;2&#9;10002&#9;เด็กหญิงมินตรา รักเรียน&#10;(เลขที่ • รหัสนักเรียน 5 หลัก • ชื่อ-สกุล — ลำดับคอลัมน์สลับได้)"></textarea>
      <button class="btn" style="margin-top:6px" onclick="impParse(textToRows($('impText').value),'ข้อความ')">🔍 วิเคราะห์ข้อความ</button>
    </details>
    <div id="impResult" class="section"></div>
    <p class="muted small">💡 ระบบหา <b>เลขที่</b> • <b>รหัสนักเรียน 5 หลัก</b> • <b>ชื่อ-สกุล</b> (รวมคำนำหน้า) และ <b>ห้อง</b> (ถ้ามี) ให้อัตโนมัติ • นักเรียนที่มีอยู่แล้วจะถูกอัปเดต ไม่ซ้ำ • <button class="linkbtn small" onclick="downloadTemplate()">ดาวน์โหลดแม่แบบ Excel</button></p>`,
    "นำเข้า", impCommit);
  const dz = $("dropzone");
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("over"); }));
  dz.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) impReadFile(f); });
  $("mok").disabled = true;
}

function downloadTemplate() {
  const rows = [["เลขที่", "รหัสนักเรียน", "คำนำหน้า", "ชื่อ", "นามสกุล", "ห้อง"], [1, "10001", "เด็กชาย", "กิตติ", "ใจดี", cls(ui.manageClassId)?.name || "ม.1/1"], [2, "10002", "เด็กหญิง", "มินตรา", "รักเรียน", cls(ui.manageClassId)?.name || "ม.1/1"]];
  download("student-template.csv", toCSV(rows), "text/csv;charset=utf-8");
}

async function impReadFile(f) {
  if (!f) return;
  const box = $("impResult");
  box.innerHTML = `<div class="note">⏳ กำลังอ่าน ${esc(f.name)} …</div>`;
  try {
    const ext = f.name.split(".").pop().toLowerCase();
    let rows;
    if (["xlsx", "xls", "xlsm", "ods"].includes(ext)) rows = await readExcel(f);
    else if (ext === "csv") rows = await readExcel(f).catch(async () => textToRows(await f.text()));
    else if (ext === "pdf") rows = await readPdf(f);
    else rows = textToRows(await f.text());
    impParse(rows, f.name);
  } catch (err) {
    console.error(err);
    box.innerHTML = `<div class="warning">⚠️ อ่านไฟล์ไม่สำเร็จ: ${esc(err.message || err)}<br><span class="small">ถ้าเป็น PDF ที่สแกนเป็นรูปภาพ ระบบอ่านตัวอักษรไม่ได้ — ให้คัดลอกรายชื่อจาก Excel แล้ววางในช่องข้อความแทน</span></div>`;
  }
}

async function readExcel(f) {
  await loadScript("lib/xlsx.full.min.js");
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
  const rows = [];
  wb.SheetNames.forEach(n => {
    XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: "" }).forEach(r => rows.push(r.map(v => String(v ?? "").trim())));
  });
  return rows;
}

async function readPdf(f) {
  await loadScript("lib/pdf.min.js");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  const rows = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const lines = [];
    tc.items.filter(it => it.str && it.str.trim()).forEach(it => {
      const y = it.transform[5], x = it.transform[4];
      let L = lines.find(l => Math.abs(l.y - y) < 3);
      if (!L) { L = { y, parts: [] }; lines.push(L); }
      L.parts.push({ x, w: it.width || 0, s: it.str });
    });
    lines.sort((a, b) => b.y - a.y).forEach(L => {
      L.parts.sort((a, b) => a.x - b.x);
      const cells = []; let cur = "", end = null;
      L.parts.forEach(pt => {
        if (end !== null && pt.x - end > 12) { cells.push(cur.trim()); cur = ""; }
        else if (end !== null && pt.x - end > 1.5) cur += " ";
        cur += pt.s; end = pt.x + pt.w;
      });
      cells.push(cur.trim());
      rows.push(cells.filter(Boolean));
    });
  }
  if (!rows.some(r => r.join("").trim())) throw new Error("ไม่พบข้อความใน PDF (อาจเป็นไฟล์สแกน)");
  return rows;
}

function textToRows(t) {
  return String(t).split(/\r?\n/).map(l => {
    if (l.includes("\t")) return l.split("\t");
    if (/,/.test(l) && !/[ก-๙]\s*,\s*[ก-๙]/.test(l)) return l.split(",").map(x => x.replace(/^"|"$/g, ""));
    return l.split(/\s{2,}/);
  }).map(r => r.map(x => x.trim())).filter(r => r.some(Boolean));
}

/* ---------- วิเคราะห์แถว → รายชื่อ ---------- */
const H = {
  no: /^(เลขที่|ที่|ลำดับ|ลำดับที่|no\.?|number|#)$/i,
  sid: /(รหัส|เลขประจำตัว|student\s*id|^id$|^code$)/i,
  full: /(ชื่อ\s*[-–]?\s*(นาม)?สกุล|ชื่อ\s*[-–]\s*นามสกุล|full\s*name|^name$)/i,
  prefix: /(คำนำหน้า|prefix|title)/i,
  first: /^(ชื่อ|first\s*name|given\s*name)$/i,
  last: /^(นามสกุล|สกุล|last\s*name|surname|family\s*name)$/i,
  room: /^(ห้อง|ชั้น|ชั้น\/ห้อง|ห้องเรียน|room|class)$/i
};
const ROOM_RE = /^(ม\.?|M\.?)?\s*\d{1,2}\s*\/\s*\d{1,2}$/i;
const PREFIXES = /^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นาย|นางสาว|น\.ส\.|นาง|Mr\.?|Ms\.?|Miss|Mrs\.?)/;

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const map = {};
    rows[i].forEach((c, j) => {
      const t = String(c).replace(/\s+/g, " ").trim();
      if (!t) return;
      if (H.full.test(t) && map.full === undefined) map.full = j;
      else if (H.no.test(t) && map.no === undefined) map.no = j;
      else if (H.sid.test(t) && map.sid === undefined) map.sid = j;
      else if (H.prefix.test(t) && map.prefix === undefined) map.prefix = j;
      else if (H.last.test(t) && map.last === undefined) map.last = j;
      else if (H.first.test(t) && map.first === undefined) map.first = j;
      else if (H.room.test(t) && map.room === undefined) map.room = j;
    });
    if ((map.full !== undefined || map.first !== undefined) && (map.no !== undefined || map.sid !== undefined)) return { at: i, map };
  }
  return null;
}

function cleanName(s) {
  return toArabic(s).replace(/[|•]/g, " ").replace(/\s+/g, " ").trim();
}

function parseRosterRows(rows) {
  rows = rows.map(r => r.map(c => toArabic(c)));
  const hd = findHeader(rows), people = [];
  if (hd) {
    const m = hd.map, get = (r, k) => m[k] === undefined ? "" : String(r[m[k]] ?? "").trim();
    rows.slice(hd.at + 1).forEach(r => {
      if (findHeader([r])) return; // หัวตารางซ้ำ (เช่น หน้าใหม่ใน PDF)
      const name = cleanName(m.full !== undefined ? get(r, "full") : [get(r, "prefix"), get(r, "first"), get(r, "last")].filter(Boolean).join(" ").replace(/^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|น\.ส\.)\s+/, "$1"));
      const sid = get(r, "sid").replace(/\D/g, ""), no = parseInt(get(r, "no"), 10);
      if (!/[ก-๙A-Za-z]{2,}/.test(name)) return;
      people.push({ no: no > 0 && no < 1000 ? no : null, sid, name, room: get(r, "room").replace(/\s+/g, "") });
    });
    return { people, mode: "หัวตาราง" };
  }
  rows.forEach(r => {
    const tokens = r.join(" ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    let sid = "", no = null, room = "";
    const rest = [];
    tokens.forEach(t => {
      const bare = t.replace(/[.)]$/, "");
      if (!sid && /^\d{5}$/.test(bare)) sid = bare;
      else if (no === null && !rest.length && /^\d{1,3}$/.test(bare) && +bare > 0) no = +bare;
      else if (!room && ROOM_RE.test(t)) room = t.replace(/\s+/g, "");
      else if (/^\d+$/.test(bare)) { /* ตัวเลขอื่นๆ ข้าม */ }
      else rest.push(t);
    });
    const name = cleanName(rest.join(" "));
    if (!/[ก-๙A-Za-z]{2,}/.test(name)) return;
    if (!sid && no === null && /(ชื่อ|รายชื่อ|เลขที่|โรงเรียน|ภาคเรียน|ปีการศึกษา|หน้า\s*\d)/.test(name)) return; // บรรทัดหัวเรื่อง
    people.push({ no, sid, name, room });
  });
  return { people, mode: "อัตโนมัติ" };
}

const normRoom = s => toArabic(s).replace(/\s+/g, "").replace(/^(ม\.?|M\.?)/i, "").toLowerCase();

function impParse(rows, source) {
  const box = $("impResult");
  const { people, mode } = parseRosterRows(rows);
  if (!people.length) {
    box.innerHTML = `<div class="warning">⚠️ ไม่พบรายชื่อนักเรียนใน${esc(source)} — ตรวจสอบว่ามีคอลัมน์ชื่อ-สกุล หรือลองวางเป็นข้อความ</div>`;
    $("mok").disabled = true; return;
  }
  const target = cls(ui.manageClassId);
  const rooms = [...new Set(people.map(p => p.room).filter(Boolean))];
  const multiRoom = rooms.length > 1 || (rooms.length === 1 && normRoom(rooms[0]) !== normRoom(target.name));
  imp = { people, source, mode, rooms, multiRoom };
  impRender();
}

/* จัดนักเรียนเข้าห้อง + ตรวจรายการซ้ำ/ผิดรูปแบบ */
function impPlan() {
  const byRoom = imp.multiRoom && ($("impByRoom")?.checked ?? true);
  const replace = $("impReplace")?.checked;
  const seenSid = new Set(), seenNo = new Set(), next = {};
  return imp.people.map(p => {
    let classId = ui.manageClassId, roomName = cls(classId).name, newRoom = false;
    if (byRoom && p.room) {
      const k = db.classes.find(c => normRoom(c.name) === normRoom(p.room));
      if (k) { classId = k.id; roomName = k.name; } else { classId = "new:" + p.room; roomName = p.room; newRoom = true; }
    }
    const row = { ...p, classId, roomName, newRoom, status: "new", reason: "" };
    if (row.sid && !SID_RE.test(row.sid)) { row.reason = `รหัส “${row.sid}” ไม่ใช่ 5 หลัก — นำเข้าโดยไม่ใส่รหัส`; row.sid = ""; }
    if (row.sid && seenSid.has(row.sid)) { row.status = "skip"; row.reason = "รหัสซ้ำในไฟล์"; return row; }
    if (row.sid) seenSid.add(row.sid);
    if (row.no === null) {
      next[classId] ??= Math.max(0, ...(replace ? [] : roster(classId).map(x => x.no)), ...imp.people.filter(q => q.no && (q.classId ?? classId) === classId).map(q => q.no)) + 1;
      row.no = next[classId]++;
    }
    const key = classId + "|" + row.no;
    if (seenNo.has(key)) { row.status = "skip"; row.reason = `เลขที่ ${row.no} ซ้ำในไฟล์`; return row; }
    seenNo.add(key);
    if (!replace || byRoom) {
      const bySid = row.sid && db.students.find(s => s.sid === row.sid);
      const byNo = !newRoom && db.students.find(s => s.classId === classId && s.no === row.no);
      if (bySid) { row.status = bySid.classId !== classId ? "move" : "update"; row.existing = bySid.id; }
      else if (byNo && !(replace && classId === ui.manageClassId)) { row.status = "update"; row.existing = byNo.id; }
    }
    return row;
  });
}

function impRender() {
  const plan = impPlan(), cnt = k => plan.filter(p => p.status === k).length;
  const newRooms = [...new Set(plan.filter(p => p.newRoom).map(p => p.roomName))];
  const noSid = plan.filter(p => p.status !== "skip" && !p.sid).length;
  const tag = { new: '<span class="pill p">ใหม่</span>', update: '<span class="pill leave">อัปเดต</span>', move: '<span class="pill l">ย้ายห้อง</span>', skip: '<span class="pill a">ข้าม</span>' };
  $("impResult").innerHTML = `
    <div class="note">✅ พบ <b>${plan.length}</b> คน จาก ${esc(imp.source)} (อ่านแบบ${imp.mode}) • ใหม่ ${cnt("new")} • อัปเดต ${cnt("update")}${cnt("move") ? ` • ย้ายห้อง ${cnt("move")}` : ""}${cnt("skip") ? ` • <span class="danger">ข้าม ${cnt("skip")}</span>` : ""}${noSid ? ` • <span class="danger">ไม่มีรหัส ${noSid}</span>` : ""}</div>
    ${imp.multiRoom ? `<label class="check"><input type="checkbox" id="impByRoom" checked onchange="impRender()"> แยกเข้าห้องตามคอลัมน์ “ห้อง” ในไฟล์ (${imp.rooms.map(esc).join(", ")})${newRooms.length ? ` — <b>สร้างห้องใหม่ให้อัตโนมัติ: ${newRooms.map(esc).join(", ")}</b>` : ""}</label>` : ""}
    <label class="check"><input type="checkbox" id="impReplace" ${$("impReplace")?.checked ? "checked" : ""} onchange="impRender()"> ลบรายชื่อเดิมของห้อง ${esc(cls(ui.manageClassId).name)} ก่อน (คะแนนเดิมของห้องนี้จะหายด้วย)</label>
    <div class="table-wrap" style="max-height:320px"><table class="table"><thead><tr><th>สถานะ</th><th>ห้อง</th><th>เลขที่</th><th>รหัส</th><th>ชื่อ-สกุล</th></tr></thead><tbody>
      ${plan.map(p => `<tr class="${p.status === "skip" ? "muted" : ""}"><td>${tag[p.status]}${p.reason ? `<div class="small danger">${esc(p.reason)}</div>` : ""}</td><td>${esc(p.roomName)}${p.newRoom ? ' <span class="pill gray">ใหม่</span>' : ""}</td><td>${p.no}</td><td class="mono">${p.sid || '<span class="danger">—</span>'}</td><td>${esc(p.name)}</td></tr>`).join("")}
    </tbody></table></div>`;
  $("mok").disabled = !plan.some(p => p.status !== "skip");
  $("mok").textContent = `นำเข้า ${plan.filter(p => p.status !== "skip").length} คน`;
}

function impCommit() {
  if (!imp) return;
  const plan = impPlan().filter(p => p.status !== "skip");
  checkpoint("นำเข้ารายชื่อ");
  if ($("impReplace")?.checked) { snapshot("ก่อนแทนที่รายชื่อ"); roster(ui.manageClassId).forEach(s => removeStudentData(s.id)); }
  const made = {};
  let added = 0, updated = 0;
  plan.forEach(p => {
    let classId = p.classId;
    if (classId.startsWith("new:")) {
      if (!made[p.roomName]) {
        const ln = guessLevel(p.roomName);
        let L = db.levels.find(l => l.name === ln);
        if (!L) { L = { id: "L" + uid(), name: ln }; db.levels.push(L); }
        const k = { id: "C" + uid(), name: p.roomName, code: uniqueClassCode(p.roomName), levelId: L.id };
        db.classes.push(k);
        coursesOfClass(ui.manageClassId).forEach(co => co.classIds.push(k.id)); // ให้เรียนวิชาเดียวกับห้องต้นทาง
        made[p.roomName] = k.id;
      }
      classId = made[p.roomName];
    }
    const ex = p.existing && db.students.find(s => s.id === p.existing);
    if (ex) {
      // กันเลขที่ชนกันเมื่อย้ายห้อง
      const clash = db.students.find(s => s.id !== ex.id && s.classId === classId && s.no === p.no);
      if (clash) clash.no = Math.max(0, ...roster(classId).map(x => x.no)) + 1;
      Object.assign(ex, { name: p.name, no: p.no, classId, sid: p.sid || ex.sid });
      updated++;
    } else {
      const clashSid = p.sid && db.students.find(s => s.sid === p.sid);
      db.students.push({ id: uid(), no: p.no, sid: clashSid ? "" : p.sid, name: p.name, classId });
      added++;
    }
  });
  db.levels.sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
  fixSelection(); save(); closeModal(); studentsPage();
  offerUndo(`นำเข้าแล้ว: ใหม่ ${added} คน • อัปเดต ${updated} คน${Object.keys(made).length ? ` • สร้างห้อง ${Object.keys(made).length} ห้อง` : ""}`);
}
