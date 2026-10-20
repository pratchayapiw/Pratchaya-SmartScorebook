"use strict";
/* =============================================================
   ภาคเรียน: ปิดภาคเรียน → เริ่มภาคเรียนใหม่ • เก็บข้อมูลภาคเก่าไว้ดูย้อนหลัง
   - ข้อมูลภาคเก่าเก็บแยกที่ localStorage คีย์ ARCH_KEY (ไม่ทำให้การบันทึกปกติช้าลง)
   - โหมดดูย้อนหลัง = อ่านอย่างเดียว (save() ถูกปิด) จนกว่าจะกด "กลับภาคเรียนปัจจุบัน"
   ============================================================= */
const ARCH_KEY = "smart_scorebook_archives";

function getArchives() { const a = readJSON(ARCH_KEY); return Array.isArray(a) ? a.filter(x => x && x.id && typeof x.data === "string") : []; }
function writeArchives(list) { try { store.set(ARCH_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

/** เพิ่มเลขท้ายรหัสวิชา: อ32201 → อ32202 (ภาค 1 → 2) */
function bumpCode(code) {
  const m = String(code || "").match(/^(.*?)(\d)$/);
  return m ? m[1] + ((+m[2] + 1) % 10) : code;
}

/** หน้าต่างเริ่มภาคเรียนใหม่ */
function newTermWizard() {
  if (ui.archive) return toast("กรุณากลับภาคเรียนปัจจุบันก่อน");
  const t = db.term, next = t.semester >= 2 ? { year: t.year + 1, semester: 1 } : { year: t.year, semester: 2 };
  modal("🎓 ปิดภาคเรียน และเริ่มภาคเรียนใหม่", `
    <div class="termflow"><div class="tbox now"><div class="muted small">ปิด</div><b>${termLabel(t)}</b></div><div class="arrow">→</div><div class="tbox"><div class="muted small">เริ่ม</div><b>ภาคเรียนที่ <select class="input mini" id="ntS">${[1, 2, 3].map(n => `<option ${n === next.semester ? "selected" : ""}>${n}</option>`).join("")}</select> / <input class="input mini" id="ntY" type="number" value="${next.year}" style="width:90px"></b></div></div>
    <h3 style="margin:14px 0 6px">📚 รายวิชาในภาคเรียนใหม่</h3>
    <div class="table-wrap"><table class="table"><thead><tr><th>ใช้ต่อ</th><th>รหัสวิชาใหม่</th><th>ชื่อวิชา</th><th>ห้อง</th></tr></thead><tbody>
      ${db.courses.map(co => `<tr><td><input type="checkbox" class="ntKeep" data-id="${esc(co.id)}" checked></td><td><input class="input ntCode" data-id="${esc(co.id)}" value="${esc(bumpCode(co.code))}" style="width:110px"></td><td><input class="input ntName" data-id="${esc(co.id)}" value="${esc(co.name)}"></td><td class="small muted">${courseClasses(co).map(c => esc(c.name)).join(", ") || "-"}</td></tr>`).join("")}
    </tbody></table></div>
    <h3 style="margin:14px 0 6px">🧮 โครงสร้างคะแนนของภาคเรียนใหม่</h3>
    <div class="form three"><label>คะแนนเก็บคิดเป็น<input class="input" id="ntC" type="number" min="0" value="${isThai(db.courses[0]) ? db.courses[0].scheme.collect : DEFAULT_SCHEME.collect}"></label>
      <label>สอบกลางภาค<input class="input" id="ntM" type="number" min="0" value="${isThai(db.courses[0]) ? db.courses[0].scheme.mid : DEFAULT_SCHEME.mid}"></label>
      <label>สอบปลายภาค<input class="input" id="ntF" type="number" min="0" value="${isThai(db.courses[0]) ? db.courses[0].scheme.final : DEFAULT_SCHEME.final}"></label></div>
    <div class="ntsum">
      <div>✅ <b>คงไว้:</b> ระดับชั้น ห้องเรียน รายชื่อนักเรียน รหัสนักเรียน การตั้งค่า รายการพฤติกรรม โลโก้ รหัสครู</div>
      <div>🗂️ <b>ย้ายไปเก็บเป็น “${termLabel(t)}”:</b> งาน/คะแนน ${db.items.length} ชิ้น • เช็กชื่อ ${db.attendance.length} รายการ • พฤติกรรม ${db.behaviors.length} รายการ — เปิดดูย้อนหลังได้ที่ ⚙️ ตั้งค่า</div>
    </div>
    <label class="check"><input type="checkbox" id="ntBackup" checked> ดาวน์โหลดไฟล์สำรองของ${termLabel(t)}ไว้ก่อน (แนะนำมาก)</label>
    <label class="check"><input type="checkbox" id="ntSure" onchange="$('mok').disabled=!this.checked"> ฉันตรวจคะแนนและส่งผลการเรียน${termLabel(t)}เรียบร้อยแล้ว</label>`,
    "เริ่มภาคเรียนใหม่", () => startNewTerm());
  $("mok").disabled = true;
}

function startNewTerm() {
  const year = Math.floor(+$("ntY").value), semester = +$("ntS").value;
  if (!(year >= 2400 && year <= 2800)) return toast("ปีการศึกษาไม่ถูกต้อง (พ.ศ.)");
  if (year === db.term.year && semester === db.term.semester) return toast("ภาคเรียนใหม่ต้องไม่ซ้ำกับภาคเรียนปัจจุบัน");
  const keep = new Set([...document.querySelectorAll(".ntKeep:checked")].map(x => x.dataset.id));
  if (!keep.size) return toast("เลือกรายวิชาที่ใช้ต่ออย่างน้อย 1 วิชา");
  const codeOf = id => document.querySelector(`.ntCode[data-id="${id}"]`).value.trim();
  const nameOf = id => document.querySelector(`.ntName[data-id="${id}"]`).value.trim();
  const scheme = { type: "thai", collect: Math.max(0, +$("ntC").value || 0), mid: Math.max(0, +$("ntM").value || 0), final: Math.max(0, +$("ntF").value || 0) };
  if (scheme.collect + scheme.mid + scheme.final <= 0) return toast("ตั้งสัดส่วนคะแนนอย่างน้อย 1 ส่วน");
  const old = db.term;

  // 1) เก็บภาคเรียนเดิม
  if ($("ntBackup").checked) exportJSON();
  const entry = { id: "T" + uid(), year: old.year, semester: old.semester, label: termLabel(old), closedAt: new Date().toISOString(),
    summary: `${db.courses.map(c => c.code || c.name).join(", ")} • ${db.students.length} นักเรียน • ${db.items.length} งาน`, data: JSON.stringify({ ...db, logo: "" }) };
  const list = [entry, ...getArchives().filter(a => !(a.year === old.year && a.semester === old.semester))];
  if (!writeArchives(list)) {
    if (!confirm("พื้นที่ในเบราว์เซอร์ไม่พอสำหรับเก็บภาคเรียนเดิมไว้ดูย้อนหลัง\nข้อมูลภาคเดิมจะอยู่ในไฟล์สำรองที่ดาวน์โหลดเท่านั้น — ดำเนินการต่อหรือไม่?")) return;
  }
  checkpoint("เริ่ม" + termLabel({ year, semester }));
  snapshot("ก่อนเริ่มภาคเรียนใหม่");

  // 2) เริ่มภาคเรียนใหม่
  db.term = { year, semester };
  db.courses = db.courses.filter(c => keep.has(c.id)).map(c => ({ ...c, code: codeOf(c.id), name: nameOf(c.id) || c.name, scheme: { ...scheme } }));
  db.items = []; db.marks = []; db.attendance = []; db.behaviors = []; db.requests = [];
  ui.itemId = null; ui.attDate = todayStr(); ui.behDate = todayStr();
  fixSelection(); save(); closeModal();
  teacher("dash");
  offerUndo(`เริ่ม${termLabel(db.term)} แล้ว — ${termLabel(old)} ถูกเก็บไว้ดูย้อนหลัง`);
}

/* ---------- ดูข้อมูลภาคเรียนเก่า (อ่านอย่างเดียว) ---------- */
function openArchive(id) {
  const a = getArchives().find(x => x.id === id); if (!a) return toast("ไม่พบข้อมูล");
  ui.liveDb = JSON.stringify(db);
  ui.archive = { id: a.id, label: a.label };
  const logo = db.logo;
  db = migrate(JSON.parse(a.data)); db.logo = logo;
  idx.dirty = true; ui.courseId = null; ui.itemId = null; fixSelection();
  teacher("work");
  toast(`📚 กำลังดู ${a.label} (อ่านอย่างเดียว)`, 4000);
}
function closeArchive() {
  if (!ui.archive) return;
  db = migrate(JSON.parse(ui.liveDb)); ui.liveDb = null; ui.archive = null;
  idx.dirty = true; ui.courseId = null; ui.itemId = null; fixSelection();
  teacher("dash"); toast("กลับสู่ภาคเรียนปัจจุบันแล้ว");
}
function archiveBanner() {
  return ui.archive ? `<div class="archbar"><span>📚 กำลังดู <b>${esc(ui.archive.label)}</b> — อ่านอย่างเดียว แก้ไขไม่ได้</span><button class="btn small" onclick="closeArchive()">← กลับภาคเรียนปัจจุบัน</button></div>` : "";
}
function downloadArchive(id) {
  const a = getArchives().find(x => x.id === id); if (!a) return;
  download(stampName(`smart-scorebook-term${a.semester}-${a.year}`, "json"), a.data, "application/json");
}
function deleteArchive(id) {
  const a = getArchives().find(x => x.id === id); if (!a) return;
  confirmBox(`ลบข้อมูล <b>${esc(a.label)}</b> ที่เก็บไว้ในเครื่องนี้? (ควรดาวน์โหลดเก็บไว้ก่อน)`, () => {
    writeArchives(getArchives().filter(x => x.id !== id)); settingsPage(); toast("ลบแล้ว");
  }, "ลบ");
}

/** ส่วนในหน้าตั้งค่า */
function termSection() {
  const list = getArchives();
  return `<div class="section card" id="setTerm">
    <div class="section-head"><h2>🎓 ภาคเรียน / ปีการศึกษา</h2><span class="pill leave">ปัจจุบัน: ${termLabel(db.term)}</span></div>
    <div class="form three">
      <label>ภาคเรียนที่<select class="input" id="tmS">${[1, 2, 3].map(n => `<option ${n === db.term.semester ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>ปีการศึกษา (พ.ศ.)<input class="input" id="tmY" type="number" value="${db.term.year}"></label>
    </div>
    <p class="muted small">แก้ตรงนี้ = เปลี่ยนชื่อภาคเรียน (ข้อมูลไม่เปลี่ยน) • ถ้าจะขึ้นภาคเรียนใหม่ ให้กดปุ่มด้านล่าง ระบบจะเก็บข้อมูลภาคเดิมไว้ และล้างคะแนน/เช็กชื่อสำหรับภาคใหม่</p>
    <button class="btn primary" onclick="newTermWizard()" ${ui.archive ? "disabled" : ""}>🎓 ปิดภาคเรียนนี้ และเริ่มภาคเรียนใหม่</button>
    <h3 style="margin:18px 0 6px">🗂️ ภาคเรียนที่ผ่านมา</h3>
    ${list.length ? list.map(a => `<div class="listrow"><div><b>${esc(a.label)}</b><div class="muted small">${esc(a.summary || "")} • ปิดเมื่อ ${fmtDateTime(a.closedAt)}</div></div>
      <div class="toolbar"><button class="btn small" onclick="openArchive('${a.id}')">👁️ เปิดดู</button><button class="btn small gray" onclick="downloadArchive('${a.id}')">⬇️</button><button class="btn small red" onclick="deleteArchive('${a.id}')">🗑️</button></div></div>`).join("") : `<div class="empty">ยังไม่มีภาคเรียนที่ปิดไว้</div>`}
  </div>`;
}
