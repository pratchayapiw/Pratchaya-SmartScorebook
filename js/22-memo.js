"use strict";
/* =============================================================
   บันทึกข้อความส่งงานวัดผล: ผลการเรียน “0” • “ร” • “มส” (ไม่มีสิทธิ์สอบ)
   - ดึงรายชื่อ + เหตุผลจากคะแนน/การเช็กชื่อในระบบให้อัตโนมัติ (แก้ไขได้)
   - แสดงตัวอย่างหน้าตาเหมือนแบบฟอร์มจริง → พิมพ์ได้ทันที
   - ดาวน์โหลด Word (.docx) โดยเติมข้อมูลลงไฟล์แม่แบบของโรงเรียน (21-memo-templates.js)
   ============================================================= */

const MEMO_TYPES = {
  zero: { label: "ผลการเรียน “0”", short: "0", icon: "0️⃣", desc: "คะแนนรวมต่ำกว่า 50%" },
  r: { label: "ผลการเรียน “ร”", short: "ร", icon: "⏳", desc: "รอการตัดสิน คะแนนไม่ครบ" },
  ms: { label: "ไม่มีสิทธิ์สอบ “มส”", short: "มส", icon: "🚫", desc: "เวลาเรียนไม่ถึงเกณฑ์" }
};
const MEMO_DEFAULTS = {
  agency: "โรงเรียนวรราชาทินัดดามาตุวิทยา สพม.ปทุมธานี",
  schoolName: "โรงเรียนวรราชาทินัดดามาตุวิทยา",
  teacherFull: "", groupHead: "",
  measureHead: "นางสาวกิติยา นวลอินทร์",
  deputy: "นางสาวพรรณิดา อุทธา",
  director: "นายธัชวรรธน์ เจริญภิรมย์บวร",
  directorTitle: "ผู้อำนวยการโรงเรียนวรราชาทินัดดามาตุวิทยา",
  docNo: ""
};
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const thaiDigits = s => String(s).replace(/\d/g, d => "๐๑๒๓๔๕๖๗๘๙"[d]);
function thaiLongDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? "" : `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
const memoCfg = () => ({ ...MEMO_DEFAULTS, ...(db.memo || {}) });

/* ---------- ข้อมูลการมาเรียนแยก ป่วย / ลา / ขาด ----------
   ป่วย = “ลา” ที่หมายเหตุมีคำว่า “ป่วย” • ขาด = ขาด + หนีเรียน • มาเรียน = มา + สาย */
function attBreakdown(sid, coId) {
  ensureIdx();
  const recs = idx.attBy.get(sid + "|" + coId) || [];
  const c = { sick: 0, leave: 0, absent: 0, came: 0 };
  recs.forEach(x => {
    if (x.status === "present" || x.status === "late") c.came++;
    else if (x.status === "leave") (/ป่วย/.test(x.note || "") ? c.sick++ : c.leave++);
    else c.absent++;
  });
  const n = recs.length, miss = c.sick + c.leave + c.absent;
  return { ...c, miss, n, pct: n ? round2(c.came / n * 100) : null };
}

/* ---------- รายชื่อผู้เข้าเกณฑ์ ---------- */
function memoScopeClasses() {
  return ui.memoScope === "room" ? [cls(ui.classId)].filter(Boolean) : courseClasses();
}
function memoAuto(type, s, res, att) {
  const min = db.settings.attendanceMin;
  if (type === "zero") return !res.special && res.total !== null && res.total < 50;
  if (type === "r") return res.special === "ร";
  if (type === "ms") return att.n > 0 && att.pct < min;
  return false;
}
function memoReason(type, s, res, att) {
  const co = curCourse();
  const miss = (res.missing || []).filter(it => !isThai(co) || partOf(it) === "collect"); // สอบที่ขาดเขียนแยกไว้แล้ว
  const list = miss.slice(0, 3).map(i => i.title).join(", ") + (miss.length > 3 ? ` และอีก ${miss.length - 3} ชิ้น` : "");
  const score = isThai(co) && res.pointsMax ? `คะแนนรวม ${fmtNum(res.points)}/${res.pointsMax}` : res.total !== null ? `คะแนนรวม ${res.total}%` : "";
  if (type === "zero") return [score + " ต่ำกว่าเกณฑ์", miss.length ? `ค้างส่งงาน ${miss.length} ชิ้น (${list})` : ""].filter(Boolean).join(" • ");
  if (type === "r") {
    const exams = isThai(co) ? PART_ORDER.filter(p => p !== "collect" && res.parts?.[p]?.n && res.parts[p].missing).map(p => "ไม่ได้" + PARTS[p].label) : [];
    return [...exams, miss.length ? `ค้างส่งงาน ${miss.length} ชิ้น (${list})` : ""].filter(Boolean).join(" • ") || "ข้อมูลคะแนนไม่ครบถ้วน";
  }
  return "";
}
const memoKey = (type, sid) => `${ui.courseId}|${type}|${sid}`;

/** รวบรวมข้อมูลของบันทึกข้อความ 1 ฉบับ */
function memoData(type) {
  const co = curCourse(), rooms = memoScopeClasses();
  const people = [];
  rooms.forEach(c => roster(c.id).forEach(s => {
    const res = studentResult(s.id, co.id), att = attBreakdown(s.id, co.id);
    people.push({ s, c, res, att, auto: memoAuto(type, s, res, att) });
  }));
  ui.memoPick ??= {};
  const pk = ui.courseId + "|" + type + "|" + (ui.memoScope || "course");
  if (!ui.memoPick[pk]) ui.memoPick[pk] = people.filter(p => p.auto).map(p => p.s.id);
  const picked = new Set(ui.memoPick[pk]);
  const rows = people.filter(p => picked.has(p.s.id)).map(p => ({
    ...p,
    reason: (db.memoNotes || {})[memoKey(type, p.s.id)] ?? memoReason(type, p.s, p.res, p.att),
    customReason: (db.memoNotes || {})[memoKey(type, p.s.id)] !== undefined,
    score: isThai(co) && p.res.pointsMax ? fmtNum(p.res.points) : p.res.total !== null ? p.res.total + "%" : "-"
  }));
  const levels = [...new Set(rooms.map(c => (level(c.levelId)?.name || "").replace(/^[^\d]*/, "")))].filter(Boolean);
  return { type, co, rooms, people, pk, rows, levels, cfg: memoCfg(), date: ui.memoDate || todayStr() };
}

/* ---------- ข้อความในเอกสาร (ใช้ร่วมกันทั้งหน้าจอและ Word) ---------- */
function memoTexts(D) {
  const { co, cfg } = D, t = db.term, teacher = cfg.teacherFull || db.teacher;
  const lvl = D.levels.length ? D.levels.join(", ") : "-";
  const law = `ตามระเบียบการวัดและประเมินผลการเรียน หลักสูตรการศึกษาขั้นพื้นฐาน พุทธศักราช 2551 (ฉบับปรับปรุง 2560) ${cfg.schoolName}`;
  const subject = {
    zero: `รายงานชื่อนักเรียนที่ขออนุมัติผลการเรียน “0” ภาคเรียนที่ ${t.semester} ปีการศึกษา ${t.year}`,
    r: `รายงานชื่อนักเรียนที่ขออนุมัติผลการเรียน “ร” ภาคเรียนที่ ${t.semester} ปีการศึกษา ${t.year}`,
    ms: `รายงานชื่อนักเรียนที่ไม่มีสิทธิ์สอบปลายภาคเรียน ภาคเรียนที่ ${t.semester} ปีการศึกษา ${t.year}`
  }[D.type];
  const body = {
    zero: `${law} กรณีที่ผู้เรียนจะได้ผลการเรียน “0” เพราะคะแนนต่ำกว่า 50 คะแนน บัดนี้ ข้าพเจ้า ${teacher} ได้สำรวจนักเรียนในรายวิชา${co.name} รหัสวิชา ${co.code || "-"} ชั้นมัธยมศึกษาปีที่ ${lvl} ปรากฏว่ามีนักเรียนที่มีคะแนนต่ำกว่า 50 คะแนน ดังรายชื่อต่อไปนี้`,
    r: `${law} กรณีที่ผู้เรียนจะได้ผลการเรียน “ร” เพราะรอการตัดสินผลการเรียนเนื่องจากข้อมูลคะแนนในรายวิชานั้นไม่ครบถ้วน บัดนี้ ข้าพเจ้า ${teacher} ได้สำรวจนักเรียนในรายวิชา${co.name} รหัสวิชา ${co.code || "-"} ชั้นมัธยมศึกษาปีที่ ${lvl} ปรากฏว่ามีนักเรียนที่รอการตัดสินผลการเรียนเนื่องจากข้อมูลคะแนนในรายวิชานั้นไม่ครบถ้วน ดังรายชื่อต่อไปนี้`,
    ms: `จากการสำรวจรายวิชา${co.name} รหัสวิชา ${co.code || "-"} จำนวน ${(+co.credits || 1).toFixed(1)} หน่วยการเรียนรู้ ประจำภาคเรียนที่ ${t.semester} ปีการศึกษา ${t.year} นักเรียนที่มีเวลาเรียนไม่ถึง ${db.settings.attendanceMin}% ของเวลาเรียนทั้งหมด มีจำนวนทั้งสิ้น ${D.rows.length} คน ดังรายชื่อดังต่อไปนี้`
  }[D.type];
  const head = D.type === "ms" ? ["ลำดับที่", "ชื่อ - สกุล", "ชั้น", "ป่วย", "ลา", "ขาด", "รวมเวลาที่ไม่มาเรียน/ครั้ง", "รวมเวลาที่มาเรียน/ครั้ง", "ร้อยละของการมาเรียน"]
    : ["ลำดับ\nที่", "ชื่อ - สกุล", "ระดับชั้น/\nห้อง", "คะแนน\nรวม", `หมายเหตุ\n(เหตุผลที่ได้รับผลการเรียน “${MEMO_TYPES[D.type].short}”)`];
  const rows = D.rows.map((p, i) => D.type === "ms"
    ? [i + 1, p.s.name, p.c.name, p.att.sick, p.att.leave, p.att.absent, p.att.miss, p.att.came, p.att.pct === null ? "-" : fmtNum(p.att.pct)]
    : [i + 1, p.s.name, p.c.name, p.score, p.reason]);
  return { subject, body, head, rows, teacher, follow: D.type !== "ms" };
}

/* ---------- หน้า: รายงาน → บันทึกข้อความ ---------- */
function memoView() {
  const type = ui.memoType || "zero", D = memoData(type), T = memoTexts(D), cfg = D.cfg;
  const counts = Object.keys(MEMO_TYPES).map(k => { const d = memoData(k); return [k, d.people.filter(p => p.auto).length]; });
  const others = D.people.filter(p => !D.rows.some(r => r.s.id === p.s.id));
  const multi = courseClasses().length > 1;
  return `<div class="card noprint">
    <div class="section-head"><div><h2 class="withico">${ico("memo", "h")}บันทึกข้อความส่งงานวัดผล</h2><div class="muted small">ตามแบบฟอร์มของโรงเรียน • ระบบเลือกรายชื่อและเขียนเหตุผลให้จากข้อมูลคะแนน/การเช็กชื่อ แก้ไขได้ทุกช่อง</div></div>
      <button class="btn gray small" onclick="memoSettings()">✍️ ผู้ลงนาม / ข้อมูลหนังสือ</button></div>
    <div class="memotypes">${counts.map(([k, n]) => `<button class="memotype ${k === type ? "on" : ""}" onclick="ui.memoType='${k}';reportPage()"><span class="mi">${MEMO_TYPES[k].icon}</span><b>${MEMO_TYPES[k].label}</b><span class="muted small">${MEMO_TYPES[k].desc}</span><span class="pill ${n ? "a" : "p"}">${n} คน</span></button>`).join("")}</div>
    <div class="toolbar" style="margin-top:12px">
      ${multi ? `<div class="seg tabs"><button class="${ui.memoScope !== "room" ? "on p" : ""}" onclick="ui.memoScope='course';reportPage()">ทุกห้องในวิชานี้ (${courseClasses().map(c => esc(c.name)).join(", ")})</button><button class="${ui.memoScope === "room" ? "on p" : ""}" onclick="ui.memoScope='room';reportPage()">เฉพาะ ${esc(cls(ui.classId)?.name || "")}</button></div>` : ""}
      <label class="inline small">ที่ <input class="input" style="width:150px" value="${esc(cfg.docNo)}" placeholder="เลขที่หนังสือ (ถ้ามี)" onchange="setMemoCfg('docNo',this.value)"></label>
      <label class="inline small">วันที่ <input class="input" type="date" value="${D.date}" onchange="ui.memoDate=this.value;reportPage()"></label>
    </div>
  </div>

  <div class="section card noprint">
    <div class="section-head"><h2>${MEMO_TYPES[type].icon} รายชื่อในบันทึก (${D.rows.length} คน)</h2>
      <div class="toolbar">${others.length ? `<select class="input" onchange="if(this.value)memoAdd(+this.value)"><option value="">＋ เพิ่มนักเรียนคนอื่น…</option>${others.map(p => `<option value="${p.s.id}">${esc(p.c.name)} เลขที่ ${p.s.no} ${esc(p.s.name)}${p.auto ? " (เข้าเกณฑ์)" : ""}</option>`).join("")}</select>` : ""}
        <button class="btn gray small" onclick="memoResetPicks()">↺ เลือกใหม่ตามเกณฑ์</button></div></div>
    ${D.rows.length ? `<div class="table-wrap"><table class="table memotable"><thead><tr><th></th>${T.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
      ${D.rows.map((p, i) => `<tr><td><button class="icon" title="เอาออก" onclick="memoRemove(${p.s.id})">✕</button></td>${T.rows[i].map((v, j) => {
        if (type !== "ms" && j === 4) return `<td class="reasoncell"><textarea class="input" rows="2" onchange="setMemoReason(${p.s.id},this.value)">${esc(v)}</textarea>${p.customReason ? `<button class="linkbtn small" onclick="setMemoReason(${p.s.id},null)">ใช้ข้อความอัตโนมัติ</button>` : ""}</td>`;
        return `<td class="${j === 1 ? "" : "center"}">${j === 1 ? `<button class="linkbtn plain namebtn" onclick="studentDash(${p.s.id},true)">${esc(v)}</button>` : esc(v)}</td>`;
      }).join("")}</tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">🎉 ไม่มีนักเรียนที่เข้าเกณฑ์${MEMO_TYPES[type].label} — ถ้าต้องการรายงานคนอื่น เลือกจาก “＋ เพิ่มนักเรียนคนอื่น”</div>`}
    ${type === "ms" ? `<p class="muted small">นับจากการเช็กชื่อในระบบ: <b>ป่วย</b> = “ลา” ที่หมายเหตุมีคำว่า “ป่วย” • <b>ขาด</b> = ขาด + หนีเรียน • <b>มาเรียน</b> = มา + สาย • เกณฑ์ ${db.settings.attendanceMin}%</p>` : ""}
    <div class="memodl" style="margin-top:12px"><b class="small">ดาวน์โหลดพร้อมพิมพ์/ส่งงานวัดผล:</b>
      <button class="btn red" id="memoPdfBtn" onclick="downloadMemoPdf()">📕 PDF</button>
      <button class="btn green" id="memoXlsxBtn" onclick="downloadMemoXlsx()">📗 Excel (.xlsx)</button>
      <button class="btn primary" onclick="downloadMemoDocx()">📘 Word (.docx)</button>
      <button class="btn gray" onclick="printMemo()">🖨️ พิมพ์</button></div>
    <p class="muted small">ทุกไฟล์จัดรูปแบบตามระเบียบงานสารบรรณ: กระดาษ A4 • ขอบบน 1.5 ซม. ซ้าย 3 ซม. ขวา 2 ซม. ล่าง 2 ซม. • ครุฑสูง 1.5 ซม. • TH SarabunIT๙ 16 พอยต์ (“บันทึกข้อความ” 29 • หัวข้อ 20 ตัวหนา) • ย่อหน้า 2.5 ซม. • เลขไทย • เลขหน้ากึ่งกลางด้านบนตั้งแต่หน้า ๒</p>
  </div>

  <div class="section memopreview"><div class="muted small noprint" style="margin-bottom:6px">ตัวอย่างก่อนพิมพ์ (ขนาด A4 จริง)</div>${memoPaperHTML(D, T)}</div>`;
}

/* ---------- การแก้ไขรายการ ---------- */
function memoPicks() { const D = memoData(ui.memoType || "zero"); return { D, list: ui.memoPick[D.pk] }; }
function memoAdd(sid) { const { list } = memoPicks(); if (!list.includes(sid)) list.push(sid); reportPage(); }
function memoRemove(sid) { const { D } = memoPicks(); ui.memoPick[D.pk] = ui.memoPick[D.pk].filter(x => x !== sid); reportPage(); }
function memoResetPicks() { const { D } = memoPicks(); delete ui.memoPick[D.pk]; reportPage(); }
function setMemoReason(sid, text) {
  db.memoNotes ||= {};
  const k = memoKey(ui.memoType || "zero", sid);
  if (text === null) delete db.memoNotes[k]; else db.memoNotes[k] = String(text).slice(0, 300);
  save(); if (text === null) reportPage();
}
function setMemoCfg(k, v) { db.memo = { ...memoCfg(), [k]: String(v).trim() }; save(); }

function memoSettings() {
  const c = memoCfg();
  const f = (k, label, ph = "") => `<label class="full">${label}<input class="input" id="mc_${k}" value="${esc(c[k])}" placeholder="${esc(ph)}"></label>`;
  modal("✍️ ข้อมูลหนังสือและผู้ลงนาม", `<div class="form">
    ${f("agency", "ส่วนราชการ")}
    ${f("schoolName", "ชื่อโรงเรียน (ในเนื้อความ)")}
    ${f("teacherFull", "ชื่อ-สกุลครูประจำวิชา (ลงนาม)", db.teacher)}
    ${f("groupHead", "ชื่อหัวหน้ากลุ่มสาระการเรียนรู้", "เว้นว่าง = ช่องจุดให้เขียนเอง")}
    ${f("measureHead", "หัวหน้างานวัดและประเมินผลการศึกษา")}
    ${f("deputy", "รองผู้อำนวยการกลุ่มบริหารวิชาการ")}
    ${f("director", "ผู้อำนวยการโรงเรียน")}
    ${f("directorTitle", "ตำแหน่งผู้อำนวยการ (ใช้ในช่อง “เรียน” ด้วย)")}
    <label>หน่วยกิตของวิชา ${esc(curCourse().code)} (ใช้ในบันทึก มส)<input class="input" id="mc_credits" type="number" min="0" step="0.5" value="${+curCourse().credits || 1}"></label>
  </div><p class="muted small">ค่าเริ่มต้นนำมาจากแบบฟอร์มของโรงเรียนที่ครูส่งมา • ชื่อกลุ่มสาระใช้จากหน้าแก้ไขรายวิชา (${esc(curCourse().group || "-")})</p>`, "บันทึก", () => {
    const n = {};
    Object.keys(MEMO_DEFAULTS).filter(k => k !== "docNo").forEach(k => { n[k] = $("mc_" + k).value.trim(); });
    db.memo = { ...memoCfg(), ...n };
    curCourse().credits = Math.max(0, +$("mc_credits").value || 1);
    save(); closeModal(); reportPage(); toast("บันทึกข้อมูลผู้ลงนามแล้ว");
  });
}

