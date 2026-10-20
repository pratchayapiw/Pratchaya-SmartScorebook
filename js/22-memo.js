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
    : ["ลำดับที่", "ชื่อ - สกุล", "ระดับชั้น/ห้อง", "คะแนนรวม", `หมายเหตุ (เหตุผลที่ได้รับผลการเรียน “${MEMO_TYPES[D.type].short}”)`];
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
    <div class="section-head"><div><h2>📨 บันทึกข้อความส่งงานวัดผล</h2><div class="muted small">ตามแบบฟอร์มของโรงเรียน • ระบบเลือกรายชื่อและเขียนเหตุผลให้จากข้อมูลคะแนน/การเช็กชื่อ แก้ไขได้ทุกช่อง</div></div>
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
    <p class="muted small">PDF = หน้าตาตรงตามตัวอย่างด้านล่าง ส่งไฟล์/พิมพ์ได้ทันที • Excel และ Word = ตามแบบฟอร์มโรงเรียน ตั้งหน้ากระดาษ A4 ไว้แล้ว แก้ไขต่อได้</p>
  </div>

  <div class="section memopreview"><div class="muted small noprint" style="margin-bottom:6px">ตัวอย่างก่อนพิมพ์ (A4)</div>${memoPaperHTML(D, T)}</div>`;
}

/** หน้ากระดาษ A4 หน้าตาเหมือนแบบฟอร์ม */
function memoPaperHTML(D, T) {
  const cfg = D.cfg, x = s => esc(thaiDigits(s));
  const sig = (title, name, role) => `<div class="mcell"><div>${title}</div><div class="dots">..........................................................................................</div><div class="dots">..........................................................................................</div>
    <div class="msign">ลงชื่อ</div><div class="mname">(${name ? x(name) : "..............................................."})</div><div class="mrole">${x(role)}</div></div>`;
  return `<div class="memopaper">
    <div class="mtitle"><img src="img/garuda.png" alt="ครุฑ" class="garuda"><span>บันทึกข้อความ</span></div>
    <div class="mline"><b>ส่วนราชการ</b> ${x(cfg.agency)}</div>
    <div class="mline two"><span><b>ที่</b> ${x(cfg.docNo)}</span><span><b>วันที่</b> ${x(thaiLongDate(D.date))}</span></div>
    <div class="mline subj"><b>เรื่อง</b>&nbsp; ${x(T.subject)}</div>
    <div class="mline">เรียน ${x(cfg.directorTitle)}</div>
    <p class="mbody">${x(T.body)}</p>
    <table class="mtable ${D.type}"><thead>${D.type === "ms"
      ? `<tr><th rowspan="2">ลำดับ<br>ที่</th><th rowspan="2">ชื่อ - สกุล</th><th rowspan="2">ชั้น</th><th colspan="3">สาเหตุที่ไม่มาเรียน</th><th rowspan="2">รวมเวลา<br>ที่ไม่มา<br>เรียน/ครั้ง</th><th rowspan="2">รวมเวลา<br>ที่มา<br>เรียน/ครั้ง</th><th rowspan="2">ร้อยละ<br>ของการ<br>มาเรียน</th></tr><tr><th>ป่วย</th><th>ลา</th><th>ขาด</th></tr>`
      : `<tr><th>ลำดับ<br>ที่</th><th>ชื่อ - สกุล</th><th>ระดับชั้น/<br>ห้อง</th><th>คะแนน<br>รวม</th><th>หมายเหตุ<br>(เหตุผลที่ได้รับผลการเรียน “${MEMO_TYPES[D.type].short}”)</th></tr>`}</thead>
      <tbody>${T.rows.length ? T.rows.map(r => `<tr>${r.map((v, j) => `<td class="${j === 1 || (D.type !== "ms" && j === 4) ? "ml" : ""}">${x(v)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${T.head.length}">— ไม่มี —</td></tr>`}</tbody></table>
    ${T.follow ? `<p class="mclose">โดยข้าพเจ้าได้ติดตามและตักเตือนมาโดยตลอด ตามหลักฐานที่แนบมานี้</p>` : ""}
    <p class="mclose">จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุมัติ</p>
    <div class="mteacher"><div>ลงชื่อ.................................ครูประจำวิชา</div><div>(${x(T.teacher)})</div></div>
    <div class="msigs">
      ${sig("ความคิดเห็นหัวหน้ากลุ่มสาระการเรียนรู้", cfg.groupHead, "หัวหน้ากลุ่มสาระการเรียนรู้" + (D.co.group || "............................."))}
      ${sig("ความคิดเห็นหัวหน้างานวัดและประเมินผลการศึกษา", cfg.measureHead, "หัวหน้างานวัดและประเมินผลการศึกษา")}
      ${sig("ความคิดเห็นรองผู้อำนวยการกลุ่มบริหารวิชาการ", cfg.deputy, "รองผู้อำนวยการกลุ่มบริหารวิชาการ")}
      ${sig("ความคิดเห็นผู้อำนวยการโรงเรียน", cfg.director, cfg.directorTitle)}
    </div>
  </div>`;
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

/* ---------- พิมพ์ ---------- */
function printMemo() {
  const src = document.querySelector(".memopaper"); if (!src) return;
  $("memoPrint")?.remove();
  const box = document.createElement("div"); box.id = "memoPrint"; box.append(src.cloneNode(true)); document.body.append(box);
  document.body.classList.add("printing-memo");
  const pg = document.createElement("style"); pg.id = "memoPage";
  pg.textContent = "@page { size: A4 portrait; margin: 15mm 18mm 12mm 25mm }";
  document.head.append(pg);
  const done = () => { document.body.classList.remove("printing-memo"); $("memoPage")?.remove(); $("memoPrint")?.remove(); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}

/* ---------- Word (.docx) จากแม่แบบของโรงเรียน ---------- */
const WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XMLNS = "http://www.w3.org/XML/1998/namespace";
const wkids = (n, name) => [...n.childNodes].filter(c => c.localName === name);
const wtext = n => [...n.getElementsByTagNameNS(WNS, "t")].map(t => t.textContent).join("");

/** แทนข้อความทั้งย่อหน้า: คงรูปแบบย่อหน้า (pPr) และรูปแบบตัวอักษรของ run แรก • "\t" = แท็บ */
function wSetPara(doc, p, text) {
  const pPr = wkids(p, "pPr")[0];
  const firstRun = wkids(p, "r")[0];
  const rPr = firstRun ? wkids(firstRun, "rPr")[0] : null;
  [...p.childNodes].forEach(n => { if (n !== pPr) p.removeChild(n); });
  String(text).split("\t").forEach((part, i) => {
    const r = doc.createElementNS(WNS, "w:r");
    if (rPr) r.appendChild(rPr.cloneNode(true));
    if (i > 0) r.appendChild(doc.createElementNS(WNS, "w:tab"));
    if (part) { const t = doc.createElementNS(WNS, "w:t"); t.setAttributeNS(XMLNS, "xml:space", "preserve"); t.textContent = part; r.appendChild(t); }
    p.appendChild(r);
  });
}

async function buildMemoDocx(D, T) {
  await loadScript("lib/jszip.min.js");
  if (typeof MEMO_TEMPLATES === "undefined") await loadScript("js/21-memo-templates.js");
  const zip = await JSZip.loadAsync(MEMO_TEMPLATES[D.type], { base64: true });
  const doc = new DOMParser().parseFromString(await zip.file("word/document.xml").async("string"), "application/xml");
  const body = doc.getElementsByTagNameNS(WNS, "body")[0];
  const blocks = [...body.childNodes].filter(n => n.localName === "p" || n.localName === "tbl");
  const paras = blocks.filter(n => n.localName === "p"), tbls = blocks.filter(n => n.localName === "tbl");
  const cfg = D.cfg, lead = s => (s.match(/^\s*/) || [""])[0];

  const pAgency = paras.find(p => wtext(p).trim().startsWith("ส่วนราชการ"));
  if (pAgency) wSetPara(doc, pAgency, `ส่วนราชการ ${cfg.agency}`);
  const pNo = paras.find(p => /^ที่\s/.test(wtext(p).trim() + " "));
  if (pNo) wSetPara(doc, pNo, `ที่ ${cfg.docNo || ""}\t\t\t\tวันที่ ${thaiLongDate(D.date)}`);
  const pSubj = paras.find(p => wtext(p).trim().startsWith("เรื่อง"));
  if (pSubj) wSetPara(doc, pSubj, `เรื่อง  ${T.subject}`);
  const pTo = paras.find(p => wtext(p).trim().startsWith("เรียน"));
  if (pTo) wSetPara(doc, pTo, `เรียน ${cfg.directorTitle}`);
  const iTo = blocks.indexOf(pTo);
  const pBody = blocks.slice(iTo + 1).find(n => n.localName === "p" && wtext(n).length > 60);
  if (pBody) wSetPara(doc, pBody, lead(wtext(pBody)) + T.body);
  const pName = paras.find(p => /^\s*\(\.{5,}\)\s*$/.test(wtext(p)));
  if (pName) wSetPara(doc, pName, lead(wtext(pName)) + `(${T.teacher})`);

  // ตารางรายชื่อ: เก็บหัวตาราง ใช้แถวว่างแถวแรกเป็นแม่แบบ แล้วสร้างแถวตามจำนวนนักเรียน
  const tbl = tbls[0], rows = wkids(tbl, "tr");
  const dataStart = rows.findIndex(r => !wtext(r).trim());
  const tmpl = rows[dataStart];
  rows.slice(dataStart).forEach(r => tbl.removeChild(r));
  const data = T.rows.length ? T.rows : [["", "— ไม่มี —", ...Array(T.head.length - 2).fill("")]];
  data.forEach(vals => {
    const tr = tmpl.cloneNode(true);
    wkids(tr, "tc").forEach((tc, j) => {
      const p = wkids(tc, "p")[0]; if (!p) return;
      wSetPara(doc, p, vals[j] ?? "");
      const left = j === 1 || (D.type !== "ms" && j === 4);
      let pPr = wkids(p, "pPr")[0];
      if (!pPr) { pPr = doc.createElementNS(WNS, "w:pPr"); p.insertBefore(pPr, p.firstChild); }
      wkids(pPr, "jc").forEach(n => pPr.removeChild(n));
      const jc = doc.createElementNS(WNS, "w:jc"); jc.setAttributeNS(WNS, "w:val", left ? "left" : "center");
      const after = wkids(pPr, "rPr")[0] || wkids(pPr, "sectPr")[0] || wkids(pPr, "pPrChange")[0] || null;
      pPr.insertBefore(jc, after);
    });
    tbl.appendChild(tr);
  });

  // ช่องลงนาม: แทนชื่อในวงเล็บตามลำดับ (หัวหน้ากลุ่มสาระ • หัวหน้างานวัดผล • รอง ผอ. • ผอ.)
  const sigT = tbls[1];
  if (sigT) {
    const names = [cfg.groupHead, cfg.measureHead, cfg.deputy, cfg.director];
    const ps = [...sigT.getElementsByTagNameNS(WNS, "p")];
    ps.filter(p => /^\s*\(.*\)\s*$/.test(wtext(p))).forEach((p, i) => { if (names[i]) wSetPara(doc, p, lead(wtext(p)) + `(${names[i]})`); });
    const pg = ps.find(p => wtext(p).trim().startsWith("หัวหน้ากลุ่มสาระการเรียนรู้") && !wtext(p).includes("ความคิดเห็น"));
    if (pg && D.co.group) wSetPara(doc, pg, lead(wtext(pg)) + "หัวหน้ากลุ่มสาระการเรียนรู้" + D.co.group);
    const pd = ps.find(p => wtext(p).trim().startsWith("ผู้อำนวยการโรงเรียน") && !wtext(p).includes("ความคิดเห็น"));
    if (pd) wSetPara(doc, pd, lead(wtext(pd)) + cfg.directorTitle);
  }
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

async function downloadMemoDocx() {
  const type = ui.memoType || "zero", D = memoData(type), T = memoTexts(D);
  try {
    saveBlob(await buildMemoDocx(D, T), memoFileName(type, "docx"));
    toast("ดาวน์โหลดไฟล์ Word แล้ว — เปิดแก้ไข/พิมพ์ได้เลย");
  } catch (e) { console.error(e); toast("สร้างไฟล์ Word ไม่สำเร็จ — ใช้ปุ่มพิมพ์แทนได้", 5000); }
}


/* ---------- ชื่อไฟล์ + ดาวน์โหลด blob ---------- */
function memoFileName(type, ext) {
  const D = memoData(type), code = String(D.co.code || "").replace(/[^\w]/g, "") || "course";
  const room = ui.memoScope === "room" ? "-" + fileSafe(cls(ui.classId)) : "";
  return `memo-${type}-${code}${room}-${db.term.year}-${db.term.semester}.${ext}`;
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function busy(btnId, label, fn) {
  const b = $(btnId), old = b?.innerHTML;
  if (b) { b.disabled = true; b.innerHTML = "⏳ " + label; }
  try { await fn(); } finally { if (b && document.body.contains(b)) { b.disabled = false; b.innerHTML = old; } }
}

/* ---------- PDF: ถ่ายภาพหน้ากระดาษความละเอียดสูง (ภาษาไทยถูกต้อง 100%) แบ่งหน้าตามแถว ---------- */
async function buildMemoPdf(D, T) {
  await Promise.all([loadScript("lib/html2canvas.min.js"), loadScript("lib/jspdf.umd.min.js")]);
  await Promise.all([document.fonts.load('400 20px MemoSarabun', "กข1"), document.fonts.load('700 20px MemoSarabun', "กข1")]).catch(() => {});
  $("memoPdfBox")?.remove();
  const box = document.createElement("div"); box.id = "memoPdfBox"; box.innerHTML = memoPaperHTML(D, T); document.body.append(box);
  try {
    const paper = box.firstElementChild;
    await document.fonts.ready;
    const img = paper.querySelector("img"); if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; });
    const W = paper.offsetWidth, mm = W / 210, pageH = 297 * mm, topM = 15 * mm, botM = 12 * mm;
    const top0 = paper.getBoundingClientRect().top;
    // จุดที่ตัดหน้าได้: ท้ายแต่ละส่วน และท้ายแต่ละแถวของตาราง (ไม่ตัดกลางแถว/กลางช่องลงนาม)
    const cuts = new Set();
    [...paper.children].forEach(el => {
      if (el.matches("table")) [...el.querySelectorAll("thead, tbody tr")].forEach(r => cuts.add(r.getBoundingClientRect().bottom - top0));
      if (el.matches(".msigs")) { const c = el.children[1]; if (c) cuts.add(c.getBoundingClientRect().bottom - top0); }
      cuts.add(el.getBoundingClientRect().bottom - top0);
    });
    const end = Math.min(paper.scrollHeight, (paper.lastElementChild?.getBoundingClientRect().bottom ?? 0) - top0 + 4), points = [...cuts].filter(y => y > 0 && y <= end).sort((a, b) => a - b);
    // หัวตาราง: พิมพ์ซ้ำทุกหน้าที่ตารางต่อจากหน้าก่อน
    const tb = paper.querySelector(".mtable"), th = tb?.querySelector("thead");
    const tTop = tb ? th.getBoundingClientRect().top - top0 : 0, hBot = tb ? th.getBoundingClientRect().bottom - top0 : 0, tBot = tb ? tb.getBoundingClientRect().bottom - top0 : 0;
    const hh = hBot - tTop, inTable = y => tb && y >= hBot - 1 && y < tBot - 1;
    const pages = []; let y = 0, first = true;
    while (y < end - 1) {
      const room = (first ? pageH - botM : pageH - topM - botM) - (!first && inTable(y) ? hh : 0);
      let next = points.filter(p => p > y && p - y <= room).pop();
      if (next === undefined) next = Math.min(end, y + room);
      if (end - y <= room) next = end;
      pages.push([y, next, !first && inTable(y)]); y = next; first = false;
    }
    const scale = 2.5;
    const canvas = await html2canvas(paper, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: W + 40 });
    const pdf = new jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const slice = (a, b) => {
      const c = document.createElement("canvas"); c.width = canvas.width; c.height = Math.max(1, Math.ceil((b - a) * scale));
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(canvas, 0, Math.floor(a * scale), c.width, c.height, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.88);
    };
    const headImg = tb ? slice(tTop, hBot) : null;
    pages.forEach(([a, b, rep], i) => {
      if (i) pdf.addPage();
      let yOff = i ? 15 : 0;
      if (rep) { pdf.addImage(headImg, "JPEG", 0, yOff, 210, hh / mm, undefined, "FAST"); yOff += hh / mm; }
      pdf.addImage(slice(a, b), "JPEG", 0, yOff, 210, (b - a) / mm, undefined, "FAST");
      if (pages.length > 1) { pdf.setFontSize(9); pdf.setTextColor(120); pdf.text(`${i + 1}/${pages.length}`, 200, 290, { align: "right" }); }
    });
    pdf.setProperties({ title: T.subject, author: T.teacher, creator: "Smart Scorebook" });
    return pdf.output("blob");
  } finally { box.remove(); }
}
async function downloadMemoPdf() {
  const type = ui.memoType || "zero";
  await busy("memoPdfBtn", "กำลังสร้าง PDF…", async () => {
    try { const D = memoData(type); saveBlob(await buildMemoPdf(D, memoTexts(D)), memoFileName(type, "pdf")); toast("ดาวน์โหลด PDF แล้ว — พิมพ์หรือส่งไฟล์ได้ทันที"); }
    catch (e) { console.error(e); toast("สร้าง PDF ไม่สำเร็จ — ใช้ปุ่มพิมพ์ แล้วเลือก “บันทึกเป็น PDF” แทนได้", 6000); }
  });
}

/* ---------- Excel: จัดหน้าตามแบบฟอร์ม (A4 แนวตั้ง พอดี 1 หน้ากว้าง) ---------- */
async function buildMemoXlsx(D, T) {
  await loadScript("lib/exceljs.min.js");
  const cfg = D.cfg, ms = D.type === "ms";
  const wb = new ExcelJS.Workbook(); wb.creator = "Smart Scorebook"; wb.created = new Date();
  const ws = wb.addWorksheet(MEMO_TYPES[D.type].short === "มส" ? "มส" : "ผลการเรียน " + MEMO_TYPES[D.type].short, {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      margins: { left: 0.9, right: 0.6, top: 0.55, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }]
  });
  const widths = ms ? [6.5, 27, 8, 6, 6, 6, 10.5, 10.5, 10.5] : [7.5, 28, 11, 9, 36];
  ws.columns = widths.map(w => ({ width: w }));
  const N = widths.length, L = n => String.fromCharCode(64 + n), half = ms ? 3 : 3;
  const FONT = "TH SarabunIT๙", f = (sz = 16, b = false) => ({ name: FONT, size: sz, bold: b });
  const thin = { style: "thin", color: { argb: "FF000000" } }, box = { top: thin, left: thin, bottom: thin, right: thin };
  const totalW = widths.reduce((a, b) => a + b, 0);
  // ประมาณจำนวนบรรทัด: ไม่นับสระ/วรรณยุกต์บน-ล่าง (ไม่กินที่ในแนวนอน) • ~1 ตัวอักษรต่อความกว้างคอลัมน์ 1 หน่วย
  const vis = t => String(t).replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, "").length;
  const rowsFor = (text, w, sz = 16) => Math.max(1, Math.ceil(vis(text) * (sz / 16) / (w * 0.95)));
  let r = 0;
  const line = (rich, opt = {}) => {
    r++; ws.mergeCells(r, 1, r, N);
    const c = ws.getCell(r, 1);
    c.value = typeof rich === "string" ? rich : { richText: rich };
    c.font = f(opt.size || 16, opt.bold); c.alignment = { vertical: "middle", horizontal: opt.align || "left", wrapText: true, indent: opt.indent || 0 };
    const plain = typeof rich === "string" ? rich : rich.map(x => x.text).join("");
    ws.getRow(r).height = opt.height || 22 * rowsFor(plain, totalW - (opt.indent || 0) * 2, opt.size || 16);
    if (opt.border) c.border = { bottom: thin };
    return c;
  };
  const B = t => ({ text: t, font: f(16, true) }), P = t => ({ text: t, font: f(16) });
  // ส่วนหัว + ครุฑ
  line("บันทึกข้อความ", { size: 29, bold: true, align: "center", height: 50 });
  try {
    const blob = await (await fetch("img/garuda.png")).blob();
    const b64 = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
    ws.addImage(wb.addImage({ base64: b64, extension: "png" }), { tl: { col: 0.1, row: 0.05 }, ext: { width: 56, height: 62 } });
  } catch (e) { /* ไม่มีรูปครุฑก็สร้างไฟล์ต่อได้ */ }
  line([B("ส่วนราชการ "), P(cfg.agency)]);
  line([B("ที่ "), P((cfg.docNo || "") + " ".repeat(Math.max(4, 40 - (cfg.docNo || "").length))), B("วันที่ "), P(thaiLongDate(D.date))]);
  line([B("เรื่อง "), P(T.subject)], { border: true });
  line(`เรียน ${cfg.directorTitle}`);
  line("            " + T.body);
  r++; // เว้นบรรทัด
  ws.getRow(r).height = 6;
  // ตาราง
  const hdr = (row, col, text, opt = {}) => { const c = ws.getCell(row, col); c.value = text; c.font = f(15, true); c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = box; return c; };
  if (ms) {
    const r1 = r + 1, r2 = r + 2;
    // ใส่กรอบก่อน แล้วค่อยรวมช่อง (เขียนค่าลงช่องย่อยของช่องที่รวมแล้วจะทับข้อความหลัก)
    for (let c = 1; c <= N; c++) { ws.getCell(r1, c).border = box; ws.getCell(r2, c).border = box; }
    [[1, "ลำดับที่"], [2, "ชื่อ - สกุล"], [3, "ชั้น"], [7, "รวมเวลาที่ไม่มาเรียน/ครั้ง"], [8, "รวมเวลาที่มาเรียน/ครั้ง"], [9, "ร้อยละของการมาเรียน"]].forEach(([c, t]) => { ws.mergeCells(r1, c, r2, c); hdr(r1, c, t); });
    ws.mergeCells(r1, 4, r1, 6); hdr(r1, 4, "สาเหตุที่ไม่มาเรียน");
    ["ป่วย", "ลา", "ขาด"].forEach((t, i) => hdr(r2, 4 + i, t));
    ws.getRow(r1).height = 30; ws.getRow(r2).height = 42; r = r2;
  } else {
    r++; T.head.forEach((t, i) => hdr(r, i + 1, t)); ws.getRow(r).height = 44;
  }
  const data = T.rows.length ? T.rows : [["", "— ไม่มี —", ...Array(N - 2).fill("")]];
  data.forEach(vals => {
    r++;
    vals.forEach((v, j) => {
      const c = ws.getCell(r, j + 1), num = typeof v === "number" || (/^\d+(\.\d+)?$/.test(String(v)) && j !== 1);
      c.value = num && v !== "" ? +v : v; c.font = f(16); c.border = box;
      c.alignment = { horizontal: j === 1 || (!ms && j === 4) ? "left" : "center", vertical: "middle", wrapText: true };
    });
    const longest = ms ? 1 : rowsFor(vals[4] || "", widths[4], 16);
    ws.getRow(r).height = Math.max(24, 22 * Math.max(longest, rowsFor(vals[1] || "", widths[1])));
  });
  r++; ws.getRow(r).height = 8;
  if (T.follow) line("            โดยข้าพเจ้าได้ติดตามและตักเตือนมาโดยตลอด ตามหลักฐานที่แนบมานี้");
  line("            จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุมัติ");
  r++; ws.getRow(r).height = 16;
  // ลงชื่อครูประจำวิชา (ครึ่งขวา)
  const right = (text) => { r++; ws.mergeCells(r, half + 1, r, N); const c = ws.getCell(r, half + 1); c.value = text; c.font = f(16); c.alignment = { horizontal: "center", shrinkToFit: true }; ws.getRow(r).height = 22; };
  right("ลงชื่อ.................................ครูประจำวิชา"); right(`(${T.teacher})`);
  r++; ws.getRow(r).height = 12;
  // ช่องความเห็น 2 × 2
  const sigBlock = (title, name, role) => [title, "......................................................................", "......................................................................", "", "ลงชื่อ", `(${name || "..............................................."})`, role];
  const grid = [[sigBlock("ความคิดเห็นหัวหน้ากลุ่มสาระการเรียนรู้", cfg.groupHead, "หัวหน้ากลุ่มสาระการเรียนรู้" + (D.co.group || "...................")), sigBlock("ความคิดเห็นหัวหน้างานวัดและประเมินผลการศึกษา", cfg.measureHead, "หัวหน้างานวัดและประเมินผลการศึกษา")],
    [sigBlock("ความคิดเห็นรองผู้อำนวยการกลุ่มบริหารวิชาการ", cfg.deputy, "รองผู้อำนวยการกลุ่มบริหารวิชาการ"), sigBlock("ความคิดเห็นผู้อำนวยการโรงเรียน", cfg.director, cfg.directorTitle)]];
  grid.forEach(pair => {
    const start = r + 1;
    pair[0].forEach((_, k) => {
      r++; ws.getRow(r).height = k === 3 ? 10 : 21;
      [[1, half], [half + 1, N]].forEach(([a, b], side) => {
        ws.mergeCells(r, a, r, b);
        const c = ws.getCell(r, a); c.value = pair[side][k]; c.font = f(15);
        c.alignment = { horizontal: k <= 2 ? "left" : "center", vertical: "middle", shrinkToFit: k === 0 || k >= 5 };
        const bd = { left: thin, right: thin };
        if (r === start) bd.top = thin;
        if (k === pair[0].length - 1) bd.bottom = thin;
        for (let col = a; col <= b; col++) ws.getCell(r, col).border = { ...bd, ...(col > a ? { left: undefined } : {}), ...(col < b ? { right: undefined } : {}) };
      });
    });
  });
  ws.pageSetup.printArea = `A1:${L(N)}${r}`;
  return new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
async function downloadMemoXlsx() {
  const type = ui.memoType || "zero";
  await busy("memoXlsxBtn", "กำลังสร้าง Excel…", async () => {
    try { const D = memoData(type); saveBlob(await buildMemoXlsx(D, memoTexts(D)), memoFileName(type, "xlsx")); toast("ดาวน์โหลด Excel แล้ว — ตั้งหน้า A4 พร้อมพิมพ์"); }
    catch (e) { console.error(e); toast("สร้างไฟล์ Excel ไม่สำเร็จ — ใช้ PDF หรือ Word แทนได้", 6000); }
  });
}
