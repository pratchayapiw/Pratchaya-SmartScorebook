"use strict";
/* =============================================================
   หน้า: ระดับชั้น / ห้อง / นักเรียน / รายวิชา
   
   ============================================================= */

/* =============================================================
   รายวิชา / ระดับชั้น / ห้องเรียน / นักเรียน
   ============================================================= */
function studentsPage() {
  if (!cls(ui.manageClassId)) ui.manageClassId = ui.classId || db.classes[0]?.id;
  const cid = ui.manageClassId, r = roster(cid), c = cls(cid);
  const noSid = r.filter(s => !s.sid).length;
  shell("ระดับชั้น ห้องเรียน และนักเรียน", `
    <div class="card">
      <div class="section-head"><h2>📚 รายวิชาที่สอน</h2><button class="btn primary" onclick="editCourse()">＋ เพิ่มรายวิชา</button></div>
      <div class="courselist">${db.courses.map(co => {
        const rooms = courseClasses(co), n = courseItems(co.id).length;
        return `<div class="coursecard ${co.id === ui.courseId ? "on" : ""}">
          <div><b>${esc(courseLabel(co))}</b><div class="muted small">${rooms.length ? rooms.map(x => esc(x.name)).join(", ") : '<span class="danger">ยังไม่ได้เลือกห้อง</span>'} • งาน ${n} ชิ้น • ${isThai(co) ? `เก็บ ${co.scheme.collect}${co.scheme.mid ? ` : กลางภาค ${co.scheme.mid}` : ""} : ปลายภาค ${co.scheme.final}` : "รวมคะแนนแบบง่าย"}${co.behaviorInTotal ? ` • จิตพิสัย ${co.behaviorInTotal}%` : ""}</div></div>
          <div class="toolbar"><button class="btn small gray" onclick="ui.courseId='${co.id}';fixSelection();teacher('work')">เปิดตารางคะแนน</button><button class="icon" onclick="editCourse('${co.id}')" title="แก้ไขวิชา">✏️</button></div></div>`;
      }).join("")}</div>
      <p class="muted small">💡 วิชาเดียวสอนได้หลายห้อง — งานที่สร้างในวิชา จะมีให้ <b>ทุกห้องในวิชานั้น</b> อัตโนมัติ</p>
    </div>

    <div class="section card">
      <div class="section-head"><h2>🏫 ระดับชั้นและห้องเรียน</h2>
        <div class="toolbar"><button class="btn" onclick="editLevel()">＋ ระดับชั้น</button><button class="btn" onclick="editClass()">＋ ห้องเรียน</button><button class="btn primary" onclick="batchRooms()">⚡ สร้างหลายห้องพร้อมกัน</button></div></div>
      <div class="levels">${db.levels.map(L => {
        const rooms = levelClasses(L.id), n = rooms.reduce((a, k) => a + roster(k.id).length, 0);
        return `<div class="levelrow"><div class="levelname"><b>${esc(L.name)}</b><span class="muted small">${rooms.length} ห้อง • ${n} คน</span><button class="icon" onclick="editLevel('${L.id}')" title="แก้ไขระดับชั้น">✏️</button></div>
          <div class="chips">${rooms.map(k => `<div class="chip ${k.id === cid ? "on" : ""}"><button class="linkbtn plain" onclick="ui.manageClassId='${k.id}';studentsPage()"><b>${esc(k.name)}</b> <span class="muted small">${roster(k.id).length} คน</span></button><button class="icon" onclick="editClass('${k.id}')" title="แก้ไขห้อง">✏️</button></div>`).join("")}
            <button class="chip addchip" onclick="editClass(null,'${L.id}')">＋ ห้อง</button></div></div>`;
      }).join("") || `<div class="empty">ยังไม่มีระดับชั้น</div>`}</div>
    </div>

    <div class="section card">
      <div class="section-head"><div><h2>👥 ${esc(c?.name || "")} (${r.length} คน)</h2><div class="muted small">ระดับชั้น ${esc(level(c?.levelId)?.name || "-")} • เรียนวิชา: ${coursesOfClass(cid).map(x => esc(courseLabel(x))).join(", ") || "—"}</div></div>
        <div class="toolbar">${searchBox()}<button class="btn" onclick="editStudent()">＋ เพิ่มทีละคน</button><button class="btn primary" onclick="importStudents()">📥 นำเข้ารายชื่อ (Excel / PDF / ข้อความ)</button></div></div>
      ${noSid ? `<div class="warning" style="margin-bottom:12px">⚠️ นักเรียน ${noSid} คนยังไม่มี <b>รหัสนักเรียน 5 หลัก</b> — จะเข้าระบบนักเรียนไม่ได้ (แก้ได้ที่ปุ่ม ✏️ หรือนำเข้ารายชื่อใหม่ ระบบจะอัปเดตรหัสตามเลขที่)</div>` : ""}
      ${r.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>เลขที่</th><th>รหัสนักเรียน</th><th>ชื่อ-สกุล</th><th></th></tr></thead><tbody>
        ${r.map(s => `<tr data-q="${rowQ(s)} ${s.sid}"><td>${s.no}</td><td>${s.sid ? `<span class="mono">${s.sid}</span>` : '<span class="pill a">ยังไม่มีรหัส</span>'}</td><td>${esc(s.name)}</td><td class="right nowrap"><button class="icon" onclick="studentDash(${s.id},true)" title="ดูรายบุคคล">👁️</button><button class="icon" onclick="editStudent(${s.id})" title="แก้ไข">✏️</button><button class="icon" onclick="delStudent(${s.id})" title="ลบ">🗑️</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">ยังไม่มีนักเรียนในห้องนี้ — กด “นำเข้ารายชื่อ” แล้วเลือกไฟล์ Excel / PDF หรือวางข้อความได้เลย</div>`}
    </div>`, "students", false);
}

/* ---------- ระดับชั้น ---------- */
function editLevel(id) {
  const L = id ? level(id) : null;
  modal(L ? "แก้ไขระดับชั้น" : "เพิ่มระดับชั้น", `<div class="form"><label class="full">ชื่อระดับชั้น<input class="input" id="lvn" value="${esc(L?.name || "")}" placeholder="เช่น ม.1"></label></div>
    ${L ? `<button class="btn red" style="margin-top:14px" onclick="delLevel('${L.id}')">🗑️ ลบระดับชั้นนี้</button>` : ""}`, "บันทึก", () => {
    const name = $("lvn").value.trim();
    if (!name) return toast("กรอกชื่อระดับชั้น");
    if (db.levels.some(x => x.name === name && x.id !== id)) return toast("มีระดับชั้นนี้แล้ว");
    if (L) L.name = name; else db.levels.push({ id: "L" + uid(), name });
    db.levels.sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
    save(); closeModal(); studentsPage(); toast("บันทึกระดับชั้นแล้ว");
  });
}
function delLevel(id) {
  const rooms = levelClasses(id);
  if (rooms.length) return toast(`ลบไม่ได้: ยังมี ${rooms.length} ห้องในระดับชั้นนี้ — ลบหรือย้ายห้องก่อน`);
  confirmBox(`ลบระดับชั้น <b>${esc(level(id).name)}</b>?`, () => { db.levels = db.levels.filter(l => l.id !== id); save(); studentsPage(); toast("ลบระดับชั้นแล้ว"); }, "ลบ");
}

/* สร้างหลายห้องพร้อมกัน เช่น ม.1 จำนวน 8 ห้อง → ม.1/1 ... ม.1/8 */
function batchRooms() {
  modal("⚡ สร้างหลายห้องพร้อมกัน", `<div class="form">
      <label>ระดับชั้น<input class="input" id="brl" placeholder="เช่น ม.1" list="lvlist"><datalist id="lvlist">${db.levels.map(l => `<option value="${esc(l.name)}">`).join("")}</datalist></label>
      <label>จำนวนห้อง<input class="input" id="brn" type="number" min="1" max="30" value="8"></label>
      <label class="full check"><input type="checkbox" id="brc" ${curCourse() ? "checked" : ""}> ให้ทุกห้องเรียนวิชา ${esc(curCourse() ? courseLabel(curCourse()) : "")}</label>
    </div><p class="muted small" id="brprev"></p>`, "สร้างห้อง", () => {
    const lname = $("brl").value.trim(), n = Math.floor(+$("brn").value);
    if (!lname || !(n >= 1 && n <= 30)) return toast("กรอกระดับชั้นและจำนวนห้อง (1–30)");
    let L = db.levels.find(l => l.name === lname);
    if (!L) { L = { id: "L" + uid(), name: lname }; db.levels.push(L); db.levels.sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true })); }
    let made = 0;
    for (let i = 1; i <= n; i++) {
      const name = `${lname}/${i}`;
      if (db.classes.some(c => c.name === name)) continue;
      const code = uniqueClassCode(name);
      const k = { id: "C" + uid(), name, code, levelId: L.id };
      db.classes.push(k); made++;
      if ($("brc").checked && curCourse()) curCourse().classIds.push(k.id);
    }
    fixSelection(); save(); closeModal(); studentsPage(); toast(made ? `สร้าง ${made} ห้องแล้ว` : "มีห้องเหล่านี้อยู่แล้ว");
  });
  const upd = () => { const l = $("brl").value.trim() || "ม.1", n = Math.min(30, Math.max(1, +$("brn").value || 1)); $("brprev").textContent = `จะสร้าง: ${l}/1${n > 1 ? ` … ${l}/${n}` : ""} (ห้องที่มีอยู่แล้วจะข้าม)`; };
  $("brl").oninput = upd; $("brn").oninput = upd; upd();
}
function uniqueClassCode(name) {
  let code = name.toUpperCase().replace(/[^\w฀-๿]/g, "") || "ROOM";
  while (db.classes.some(c => c.code === code)) code += "X";
  return code;
}

/* ---------- รายวิชา ---------- */
function roomPicker(cssClass, isChecked) {
  return db.levels.map(L => {
    const rooms = levelClasses(L.id);
    if (!rooms.length) return "";
    return `<div class="pickgroup"><div class="pickhead"><b>${esc(L.name)}</b> <button type="button" class="linkbtn small" onclick="this.closest('.pickgroup').querySelectorAll('input').forEach(x=>x.checked=true)">เลือกทั้งชั้น</button> <button type="button" class="linkbtn small" onclick="this.closest('.pickgroup').querySelectorAll('input').forEach(x=>x.checked=false)">ไม่เลือก</button></div>
      <div class="checkgrid">${rooms.map(c => `<label class="check"><input type="checkbox" class="${cssClass}" value="${esc(c.id)}" ${isChecked(c) ? "checked" : ""}> ${esc(c.name)}</label>`).join("")}</div></div>`;
  }).join("");
}

function editCourse(id) {
  const co = id ? course(id) : null;
  modal(co ? "แก้ไขรายวิชา" : "เพิ่มรายวิชา", `<div class="form">
      <label>รหัสวิชา<input class="input" id="coc" value="${esc(co?.code || "")}" placeholder="เช่น อ21101"></label>
      <label>ชื่อวิชา<input class="input" id="con" value="${esc(co?.name || "")}" placeholder="เช่น ภาษาอังกฤษ ม.1"></label>
      <label class="full">กลุ่มสาระการเรียนรู้ <span class="muted small" style="font-weight:400">(แสดงในหัวแบบบันทึกคะแนน)</span><input class="input" id="cog" value="${esc(co?.group ?? "ภาษาต่างประเทศ")}" list="cogList" placeholder="เช่น ภาษาต่างประเทศ">
        <datalist id="cogList">${["ภาษาไทย", "คณิตศาสตร์", "วิทยาศาสตร์และเทคโนโลยี", "สังคมศึกษา ศาสนา และวัฒนธรรม", "สุขศึกษาและพลศึกษา", "ศิลปะ", "การงานอาชีพ", "ภาษาต่างประเทศ"].map(g => `<option value="${g}">`).join("")}</datalist></label>
      <div class="full schemebox"><b class="small">โครงสร้างคะแนน</b>
        <label class="check"><input type="radio" name="cosch" value="thai" ${(co?.scheme?.type ?? "thai") === "thai" ? "checked" : ""} onchange="schemeToggle()"> แบบโรงเรียน: คะแนนเก็บ + สอบกลางภาค + สอบปลายภาค</label>
        <div class="form three" id="schemeNums">
          <label>คะแนนเก็บคิดเป็น<input class="input" id="sc1" type="number" min="0" step="1" value="${co?.scheme?.collect ?? DEFAULT_SCHEME.collect}" oninput="schemeSum()"></label>
          <label>สอบกลางภาค<input class="input" id="sc2" type="number" min="0" step="1" value="${co?.scheme?.mid ?? DEFAULT_SCHEME.mid}" oninput="schemeSum()"></label>
          <label>สอบปลายภาค<input class="input" id="sc3" type="number" min="0" step="1" value="${co?.scheme?.final ?? DEFAULT_SCHEME.final}" oninput="schemeSum()"></label>
        </div>
        <div class="small" id="schemeMsg"></div>
        <label class="check"><input type="radio" name="cosch" value="simple" ${co?.scheme?.type === "simple" ? "checked" : ""} onchange="schemeToggle()"> แบบง่าย: รวมคะแนนดิบทุกงานเป็นร้อยละ (แบบเดิม)</label>
      </div>
      <div class="full"><b class="small">ห้องที่เรียนวิชานี้</b>${roomPicker("coroom", c => co?.classIds.includes(c.id))}</div>
      <label class="full">นำคะแนนจิตพิสัยรวมในคะแนนรวม (%)<input class="input" id="cob" type="number" min="0" max="100" step="1" value="${co?.behaviorInTotal ?? 0}">
        <span class="muted small" style="font-weight:400">0 = แยกเป็นคะแนนจิตพิสัยต่างหาก (ไม่รวมในเกรด) • เช่น 10 = คะแนนงาน 90% + จิตพิสัย 10%</span></label>
    </div>${co ? `<button class="btn red" style="margin-top:14px" onclick="delCourse('${co.id}')">🗑️ ลบรายวิชานี้</button>` : ""}`, "บันทึก", () => {
    const name = $("con").value.trim(), code = $("coc").value.trim();
    const classIds = [...document.querySelectorAll(".coroom:checked")].map(x => x.value);
    const behaviorInTotal = clamp(+$("cob").value || 0, 0, 100);
    const scheme = { type: document.querySelector("input[name=cosch]:checked").value, collect: Math.max(0, +$("sc1").value || 0), mid: Math.max(0, +$("sc2").value || 0), final: Math.max(0, +$("sc3").value || 0) };
    if (!name) return toast("กรอกชื่อวิชา");
    if (scheme.type === "thai" && scheme.collect + scheme.mid + scheme.final <= 0) return toast("ตั้งสัดส่วนคะแนนอย่างน้อย 1 ส่วน");
    const group = $("cog").value.trim();
    if (co) Object.assign(co, { name, code, group, classIds, behaviorInTotal, scheme });
    else { const n = { id: "CRS" + uid(), code, name, group, classIds, behaviorInTotal, scheme }; db.courses.push(n); ui.courseId = n.id; }
    fixSelection(); save(); closeModal(); teacher(ui.page); toast("บันทึกรายวิชาแล้ว");
  });
  schemeToggle();
}

function schemeToggle() {
  const thai = document.querySelector("input[name=cosch]:checked")?.value === "thai";
  $("schemeNums").style.opacity = thai ? 1 : .4;
  $("schemeNums").querySelectorAll("input").forEach(x => { x.disabled = !thai; });
  schemeSum();
}
function schemeSum() {
  const el = $("schemeMsg"); if (!el) return;
  const t = (+$("sc1").value || 0) + (+$("sc2").value || 0) + (+$("sc3").value || 0);
  el.innerHTML = document.querySelector("input[name=cosch]:checked")?.value !== "thai" ? "" : t === 100 ? `✅ รวม ${t} คะแนน` : `<span class="danger">⚠️ รวม ${t} คะแนน (ปกติควรเท่ากับ 100)</span> — ใช้ได้ แต่เกรดจะคิดจากร้อยละของ ${t}`;
}

function delCourse(id) {
  if (db.courses.length <= 1) return toast("ต้องมีอย่างน้อย 1 รายวิชา");
  const co = course(id), items = new Set(courseItems(id).map(i => i.id));
  confirmBox(`ลบรายวิชา <b>${esc(courseLabel(co))}</b> พร้อมงาน ${items.size} ชิ้น คะแนน การเช็กชื่อ และพฤติกรรมของวิชานี้ทั้งหมด? (นักเรียนไม่ถูกลบ)`, () => {
    db.courses = db.courses.filter(c => c.id !== id);
    db.items = db.items.filter(i => i.courseId !== id);
    db.marks = db.marks.filter(m => !items.has(m.itemId));
    db.attendance = db.attendance.filter(a => a.courseId !== id);
    db.behaviors = db.behaviors.filter(b => b.courseId !== id);
    db.requests = db.requests.filter(b => b.courseId !== id);
    fixSelection(); save(); studentsPage(); toast("ลบรายวิชาแล้ว");
  }, "ลบรายวิชา");
}

/* ---------- ห้องเรียน ---------- */
function editClass(id, presetLevel) {
  const c = id ? cls(id) : null;
  const lv = c?.levelId || presetLevel || db.levels[0]?.id;
  modal(c ? "แก้ไขห้องเรียน" : "เพิ่มห้องเรียน", `<div class="form">
      <label>ระดับชั้น<select class="input" id="clv">${db.levels.map(l => `<option value="${esc(l.id)}" ${l.id === lv ? "selected" : ""}>${esc(l.name)}</option>`).join("")}<option value="__new">＋ ระดับชั้นใหม่…</option></select></label>
      <label>ชื่อห้อง<input class="input" id="cn" value="${esc(c?.name || "")}" placeholder="เช่น ม.2/3"></label>
      <label class="full" id="clvNewRow" hidden>ชื่อระดับชั้นใหม่<input class="input" id="clvNew" placeholder="เช่น ม.4"></label>
      <div class="full"><b class="small">ห้องนี้เรียนวิชา</b>
        <div class="checkgrid">${db.courses.map(co => `<label class="check"><input type="checkbox" class="clco" value="${esc(co.id)}" ${c ? (co.classIds.includes(c.id) ? "checked" : "") : (co.id === ui.courseId ? "checked" : "")}> ${esc(courseLabel(co))}</label>`).join("")}</div></div>
    </div>${c ? `<button class="btn red" style="margin-top:14px" onclick="delClass('${c.id}')">🗑️ ลบห้องนี้</button>` : ""}`, "บันทึก", () => {
    const name = $("cn").value.trim();
    if (!name) return toast("กรอกชื่อห้อง");
    if (db.classes.some(k => k.name === name && k.id !== id)) return toast("มีห้องชื่อนี้แล้ว");
    let levelId = $("clv").value;
    if (levelId === "__new") {
      const ln = $("clvNew").value.trim(); if (!ln) return toast("กรอกชื่อระดับชั้นใหม่");
      const ex = db.levels.find(l => l.name === ln);
      levelId = ex ? ex.id : ("L" + uid());
      if (!ex) { db.levels.push({ id: levelId, name: ln }); db.levels.sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true })); }
    }
    let target = c;
    if (c) Object.assign(c, { name, levelId });
    else { target = { id: "C" + uid(), name, code: uniqueClassCode(name), levelId }; db.classes.push(target); ui.manageClassId = target.id; }
    const picked = new Set([...document.querySelectorAll(".clco:checked")].map(x => x.value));
    db.courses.forEach(co => {
      const has = co.classIds.includes(target.id);
      if (picked.has(co.id) && !has) co.classIds.push(target.id);
      if (!picked.has(co.id) && has) co.classIds = co.classIds.filter(x => x !== target.id);
    });
    fixSelection(); save(); closeModal(); studentsPage(); toast("บันทึกห้องเรียนแล้ว");
  });
  $("clv").onchange = () => { $("clvNewRow").hidden = $("clv").value !== "__new"; };
  if (!db.levels.length) { $("clv").value = "__new"; $("clvNewRow").hidden = false; }
}

function removeStudentData(sid) {
  db.students = db.students.filter(s => s.id !== sid);
  db.marks = db.marks.filter(x => x.studentId !== sid);
  db.attendance = db.attendance.filter(x => x.studentId !== sid);
  db.behaviors = db.behaviors.filter(x => x.studentId !== sid);
  db.requests = db.requests.filter(x => x.studentId !== sid);
}

function delClass(id) {
  if (db.classes.length <= 1) return toast("ต้องมีอย่างน้อย 1 ห้อง");
  const list = roster(id);
  confirmBox(`ลบห้อง <b>${esc(cls(id).name)}</b> พร้อมนักเรียน ${list.length} คน และคะแนนทั้งหมดของห้องนี้?`, () => {
    list.forEach(s => removeStudentData(s.id));
    db.classes = db.classes.filter(k => k.id !== id);
    db.courses.forEach(co => { co.classIds = co.classIds.filter(x => x !== id); });
    ui.manageClassId = db.classes[0].id;
    fixSelection(); save(); studentsPage(); toast("ลบห้องแล้ว");
  }, "ลบห้อง");
}

/* ---------- นักเรียน ---------- */
function editStudent(id) {
  const s = id ? db.students.find(x => x.id === id) : null;
  const cid = s?.classId ?? ui.manageClassId;
  const nextNo = Math.max(0, ...roster(cid).map(x => x.no)) + 1;
  modal(s ? "แก้ไขนักเรียน" : "เพิ่มนักเรียน", `<div class="form">
      <label>เลขที่<input class="input" id="sno" type="number" min="1" value="${s?.no ?? nextNo}"></label>
      <label>รหัสนักเรียน (5 หลัก)<input class="input mono" id="ssid" inputmode="numeric" maxlength="5" value="${esc(s?.sid || "")}" placeholder="00000"></label>
      <label class="full">ชื่อ-สกุล<input class="input" id="snm" value="${esc(s?.name || "")}"></label>
      <label class="full">ห้อง<select class="input" id="scl">${db.levels.map(L => `<optgroup label="${esc(L.name)}">${levelClasses(L.id).map(c => `<option value="${esc(c.id)}" ${c.id === cid ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</optgroup>`).join("")}</select></label>
    </div>`, "บันทึก", () => {
    const no = +$("sno").value, name = $("snm").value.trim(), classId = $("scl").value, sid = toArabic($("ssid").value).replace(/\D/g, "");
    if (!name || !(no > 0)) return toast("กรอกเลขที่และชื่อให้ถูกต้อง");
    if (sid && !SID_RE.test(sid)) return toast("รหัสนักเรียนต้องเป็นตัวเลข 5 หลัก");
    if (sid && db.students.some(x => x.sid === sid && x.id !== id)) return toast(`รหัส ${sid} ซ้ำกับ ${db.students.find(x => x.sid === sid).name}`);
    if (db.students.some(x => x.classId === classId && x.no === no && x.id !== id)) return toast(`เลขที่ ${no} มีอยู่แล้วในห้องนี้`);
    if (s) Object.assign(s, { no, name, classId, sid });
    else db.students.push({ id: uid(), no, sid, name, classId });
    save(); closeModal(); studentsPage(); toast("บันทึกแล้ว");
  });
}

function delStudent(id) {
  const s = db.students.find(x => x.id === id);
  confirmBox(`ลบ <b>${esc(s.name)}</b> พร้อมคะแนน การเช็กชื่อ และพฤติกรรมทั้งหมด?`, () => {
    removeStudentData(id); save(); studentsPage(); toast("ลบนักเรียนแล้ว");
  }, "ลบ");
}
