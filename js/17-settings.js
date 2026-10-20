"use strict";
/* =============================================================
   หน้า: ตั้งค่า
   
   ============================================================= */

/* ---------- ตั้งค่า ---------- */
/* หมวดของหน้าตั้งค่า (ใช้ทำเมนูลัดด้านบน) */
const SET_SECTIONS = [["setGeneral", "🏫 ทั่วไป"], ["setBrand", "🎨 หน้าแรก/โลโก้"], ["setLate", "⏰ ส่งช้า"], ["setGrade", "🧮 คะแนน/เกรด"], ["setAtt", "✅ เช็กชื่อ"], ["behSettings", "⭐ พฤติกรรม"], ["setTerm", "🎓 ภาคเรียน"], ["setData", "💾 ข้อมูล/สำรอง"]];

/* การตั้งค่าบันทึกอัตโนมัติทุกครั้งที่เปลี่ยนค่า (event "change" ที่ #setform) */
function settingsPage() {
  const st = db.settings;
  shell("ตั้งค่า", `
    <nav class="subnav noprint" aria-label="หมวดการตั้งค่า">${SET_SECTIONS.map(([id, t]) => `<button onclick="$('${id}').scrollIntoView({behavior:'smooth',block:'start'})">${t}</button>`).join("")}<span class="autosave muted small">💾 บันทึกอัตโนมัติเมื่อแก้ไข</span></nav>
    <div id="setform" onchange="saveSettings(true)">
    <div class="card" id="setGeneral">
      <div class="section-head"><h2>🏫 ข้อมูลทั่วไป</h2></div>
      <div class="form">
        <label>ชื่อโรงเรียน/ห้องเรียน<input class="input" id="sSchool" value="${esc(db.school)}"></label>
        <label>ชื่อครู<input class="input" id="sTeacher" value="${esc(db.teacher)}"></label>
        <label>รหัสครู (PIN) — เว้นว่าง = ไม่ล็อก<input class="input" id="sPin" type="password" inputmode="numeric" value="${esc(st.teacherPin)}" autocomplete="new-password"></label>
      </div>
      <p class="muted small">PIN ช่วยกันนักเรียนกดเข้าหน้าครูเมื่อใช้เครื่องร่วมกัน (ไม่ใช่ระบบรักษาความปลอดภัยเต็มรูปแบบ)</p>
      ${securitySection()}
    </div>
    <div class="section card" id="setBrand">
      <div class="section-head"><h2>🎨 หน้าแรกและโลโก้หน่วยงาน</h2><button class="btn gray small" onclick="saveSettings(true);home()">👁️ ดูหน้าแรก</button></div>
      <div class="brandset">
        <div class="logobox" id="logoPreview">${logoHTML("big")}</div>
        <div class="form" style="flex:1">
          <label class="full">ชื่อหัวข้อหน้าแรก<input class="input" id="sTitle" value="${esc(db.appTitle)}" placeholder="${DEFAULT_TITLE}"></label>
          <label class="full">ข้อความใต้หัวข้อ (เว้นว่างได้)<input class="input" id="sSubtitle" value="${esc(db.appSubtitle)}" placeholder="${DEFAULT_SUBTITLE}"></label>
          <div class="full toolbar">
            <label class="btn">🖼️ อัปโหลดโลโก้<input type="file" accept="image/*" hidden onchange="uploadLogo(this)"></label>
            ${db.logo ? `<button class="btn red" onclick="removeLogo()">ลบโลโก้</button>` : ""}
          </div>
        </div>
      </div>
      <p class="muted small">ชื่อโรงเรียนด้านบนจะแสดงเหนือหัวข้อในหน้าแรก • แนะนำโลโก้พื้นหลังโปร่งใส (.png) ระบบย่อขนาดให้อัตโนมัติ • ถ้าจะให้โลโก้ขึ้นทุกเครื่องที่เปิดเว็บ ให้ตั้งชื่อไฟล์ว่า <b>logo.png</b> แล้ววางไว้ในโฟลเดอร์เดียวกับ index.html ก่อนอัปโหลดขึ้น Netlify</p>
    </div>
    <div class="section card" id="setLate">
      <div class="section-head"><h2>⏰ กติกาการส่งงานช้า</h2><span class="pill leave">ใช้กับงานที่มีกำหนดส่ง</span></div>
      <div class="form three">
        <label>อนุโลม (วัน)<input class="input" id="grace" type="number" min="0" step="1" value="${st.lateGraceDays}" oninput="previewLate()"></label>
        <label>หักต่อวัน (%)<input class="input" id="deduct" type="number" min="0" max="100" step="0.1" value="${st.lateDeductPerDay}" oninput="previewLate()"></label>
        <label>หักสูงสุด (%)<input class="input" id="cap" type="number" min="0" max="100" step="0.1" value="${st.maxLateDeduct}" oninput="previewLate()"></label>
      </div>
      <div class="note" style="margin-top:12px">สูตร: คะแนนสุทธิ = คะแนนที่ครูให้ × (1 − อัตราหัก)<br>อัตราหัก = น้อยกว่าระหว่าง “หักสูงสุด” กับ (วันที่ส่งช้า − วันอนุโลม) × หักต่อวัน</div>
      <div class="table-wrap"><table class="table"><thead><tr><th>ส่งช้า</th><th>นับหัก</th><th>อัตราหัก</th><th>ตัวอย่าง: ครูให้ 8/10</th></tr></thead><tbody id="latePreview"></tbody></table></div>
    </div>
    <div class="section card" id="setGrade">
      <div class="section-head"><h2>🧮 การรวมคะแนนและเกรด</h2></div>
      <label class="check"><input type="radio" name="tm" value="points" ${st.totalMode !== "weighted" ? "checked" : ""}> รวมคะแนนดิบ ÷ คะแนนเต็มรวม (งานที่คะแนนเต็มมากมีผลมาก)</label>
      <label class="check"><input type="radio" name="tm" value="weighted" ${st.totalMode === "weighted" ? "checked" : ""}> เฉลี่ย % ถ่วงน้ำหนัก (ใช้ “น้ำหนัก” ของแต่ละกิจกรรม/งาน)</label>
      <label class="check"><input type="checkbox" id="miss" ${st.missingAsZero ? "checked" : ""}> นับงานค้าง (ช่องคะแนนว่าง) เป็น 0 — แนะนำให้เปิดตอนสรุปปลายภาค</label>
      <div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>คะแนน %</th>${GRADE_SCALE.map(([m]) => `<th>${m}+</th>`).join("")}</tr></thead><tbody><tr><td>เกรด</td>${GRADE_SCALE.map(([, g]) => `<td><b>${g}</b></td>`).join("")}</tr></tbody></table></div>
    </div>
    <div class="section card" id="setAtt">
      <div class="section-head"><h2>✅ การเช็กชื่อ</h2></div>
      <div class="form three"><label>เวลาเรียนขั้นต่ำ (%)<input class="input" id="attmin" type="number" min="0" max="100" step="1" value="${st.attendanceMin}"></label></div>
      <p class="muted small">นักเรียนที่มาเรียน (มา + สาย) ต่ำกว่าเกณฑ์นี้ จะถูกแจ้งเตือน “เสี่ยง มส.” ในหน้าเช็กชื่อและหน้าของนักเรียน (ประเมินเมื่อเช็กชื่อแล้วอย่างน้อย 3 คาบ)</p>
    </div>
    <div class="section card" id="behSettings">
      <div class="section-head"><h2>⭐ พฤติกรรมและจิตพิสัย</h2><span class="muted small">ทุกคนเริ่มที่คะแนนเต็ม แล้วหักตามพฤติกรรมที่บันทึก</span></div>
      <div class="form three"><label>คะแนนจิตพิสัยเต็ม<input class="input" id="bfull" type="number" min="1" step="1" value="${st.behaviorFull}"></label></div>
      <div id="behTypesBox" style="margin-top:12px">${st.behaviorTypes.map(behTypeRow).join("")}</div>
      <button class="btn" style="margin-top:8px" onclick="$('behTypesBox').insertAdjacentHTML('beforeend', behTypeRow({id:'b'+uid(),icon:'⚠️',label:'',points:2}))">＋ เพิ่มพฤติกรรม</button>
      <p class="muted small">การแก้ไขชื่อ/คะแนนจะใช้กับการบันทึกครั้งต่อไป (รายการที่บันทึกไปแล้วคงค่าเดิม) • การนำจิตพิสัยไปคิดในเกรด ตั้งได้ที่ “แก้ไขรายวิชา”</p>
    </div>
    ${termSection()}
    </div>
    <div class="section card" id="setData">
      <div class="section-head"><h2>💾 สำรอง / กู้คืนข้อมูล</h2><span class="muted small">สำรองล่าสุด: ${db.lastBackup ? fmtDate(db.lastBackup) : "ยังไม่เคย"}</span></div>
      <p class="muted">ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ถ้าล้างประวัติเบราว์เซอร์หรือเปลี่ยนเครื่อง ข้อมูลจะหาย ควรสำรองเป็นไฟล์ทุกสัปดาห์ และใช้ไฟล์นี้ย้ายข้อมูลไปเครื่องอื่นได้</p>
      <div class="toolbar">
        <button class="btn green" onclick="exportJSON()">⬇️ สำรองข้อมูล (.json)</button>
        <label class="btn">⬆️ กู้คืนจากไฟล์<input type="file" accept=".json,application/json" hidden onchange="importJSON(this)"></label>
        <button class="btn red" onclick="resetAll()">🗑️ ล้างข้อมูลทั้งหมด</button>
      </div>
      ${storageInfo()}
    </div>
    <div class="section card">
      <div class="section-head"><h2>🕘 จุดบันทึกอัตโนมัติ</h2><span class="muted small">ระบบเก็บให้เองวันละครั้ง และก่อนการลบ/ล้างข้อมูลทุกครั้ง</span></div>
      ${snapshotList()}
    </div>
    <p class="muted small center" style="margin-top:18px">Smart Scorebook เวอร์ชัน <b>${APP_VERSION}</b> • ออกรุ่นเมื่อ ${fmtDateTime(APP_RELEASED)}<br>รูปแบบเวอร์ชัน: วัน.เดือน.ปี.ชั่วโมง.นาที ที่อัปเดต</p>`, "set", false);
  previewLate();
}

function storageInfo() {
  if (!store.ok) return `<div class="warning" style="margin-top:12px">⚠️ เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้</div>`;
  let used = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); used += (k.length + (localStorage.getItem(k) || "").length) * 2; } } catch (e) { }
  const cap = 5 * 1024 * 1024, p = Math.min(100, used / cap * 100);
  const size = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.ceil(n / 1024) + " KB";
  return `<div style="margin-top:14px"><div class="muted small">พื้นที่ที่ใช้ในเบราว์เซอร์ประมาณ ${size(used)} จาก ~5 MB${db.logo ? ` (โลโก้ ${size(db.logo.length * 2)})` : ""}</div>
    <div class="progress" style="margin-top:6px"><span style="width:${p}%;${p > 80 ? "background:#dc2626" : ""}"></span></div></div>`;
}

function snapshotList() {
  const list = getSnapshots();
  if (!list.length) return `<div class="empty">ยังไม่มีจุดบันทึก</div>`;
  return list.map((x, i) => {
    let info = "";
    try { const d = JSON.parse(x.data); info = `${d.students?.length ?? 0} นักเรียน • ${d.marks?.length ?? ((d.scores?.length ?? 0) + (d.submissions?.length ?? 0))} คะแนน/งาน${d.version < 5 ? " (รุ่นเก่า)" : ""}`; } catch (e) { info = "ข้อมูลเสีย"; }
    return `<div class="listrow"><div><b>${fmtDateTime(x.t)}</b> <span class="pill gray">${esc(x.label)}</span><div class="muted small">${info}</div></div><button class="btn small gray" onclick="restoreSnapshot(${i})">กู้คืนจุดนี้</button></div>`;
  }).join("");
}

function restoreSnapshot(i) {
  const x = getSnapshots()[i]; if (!x) return;
  confirmBox(`ย้อนข้อมูลกลับไปเป็นเมื่อ <b>${fmtDateTime(x.t)}</b>? (ข้อมูลปัจจุบันจะถูกเก็บเป็นจุดบันทึกไว้ก่อน)`, () => {
    const logo = db.logo;
    db = migrate(JSON.parse(x.data)); db.logo = logo;
    fixSelection();
    save(); settingsPage(); toast("ย้อนข้อมูลเรียบร้อย");
  }, "ย้อนข้อมูล");
}

function readLateInputs() {
  return {
    ...db.settings,
    lateGraceDays: Math.max(0, Math.floor(+$("grace").value || 0)),
    lateDeductPerDay: clamp(+$("deduct").value || 0, 0, 100),
    maxLateDeduct: clamp(+$("cap").value || 0, 0, 100)
  };
}

function previewLate() {
  const st = readLateInputs();
  $("latePreview").innerHTML = [0, 1, 2, 3, 5, 10].map(days => {
    const x = calcLate(8, days, false, st);
    return `<tr><td>${days} วัน</td><td>${x.late} วัน</td><td>${x.rate}%</td><td><b>${x.net.toFixed(2)}/10</b> (${pct(x.net, 10)}%)</td></tr>`;
  }).join("");
}

function behTypeRow(t) {
  return `<div class="behedit" data-id="${esc(t.id)}"><input class="input bi" value="${esc(t.icon)}" maxlength="4" aria-label="ไอคอน" style="width:60px;text-align:center"><input class="input bl" value="${esc(t.label)}" placeholder="เช่น ไม่ตั้งใจเรียน" style="flex:1"><label class="inline small">หัก<input class="input bp tiny" type="number" min="0.5" step="0.5" value="${t.points}">คะแนน</label><button class="icon" onclick="this.parentElement.remove();saveSettings(true)" title="ลบ">🗑️</button></div>`;
}
function readBehTypes() {
  return [...document.querySelectorAll(".behedit")].map(r => ({
    id: r.dataset.id, icon: r.querySelector(".bi").value.trim(), label: r.querySelector(".bl").value.trim(), points: +r.querySelector(".bp").value || 2
  })).filter(t => t.label);
}

/** อ่านค่าจากฟอร์มตั้งค่าแล้วบันทึก  quiet = บันทึกอัตโนมัติ (ไม่วาดหน้าใหม่ ช่องที่กำลังพิมพ์ไม่หลุด) */
function saveSettings(quiet = false) {
  // บันทึกเฉพาะตอนหน้าตั้งค่ายังเปิดอยู่ (กันเหตุการณ์ change ที่เกิดตอนออกจากหน้า เช่นกด "ออก" ทันทีหลังพิมพ์)
  if (!$("sPin") || ui.view !== "teacher" || ui.page !== "set") return;
  const pin = $("sPin").value.trim(), prevPin = db.settings.teacherPin;
  if ($("sEmail")) db.security.email = $("sEmail").value.trim();
  if ($("tmY") && +$("tmY").value >= 2400 && +$("tmY").value <= 2800) db.term = { year: Math.floor(+$("tmY").value), semester: +$("tmS").value };
  db.school = $("sSchool").value.trim() || "Smart Classroom";
  db.teacher = $("sTeacher").value.trim() || "ครูผู้สอน";
  db.appTitle = $("sTitle").value.trim() || DEFAULT_TITLE;
  db.appSubtitle = $("sSubtitle").value.trim();
  db.settings = {
    ...readLateInputs(),
    missingAsZero: $("miss").checked,
    totalMode: document.querySelector("input[name=tm]:checked")?.value || "points",
    teacherPin: pin,
    behaviorFull: Math.max(1, +$("bfull").value || 100),
    attendanceMin: clamp(Number.isFinite(+$("attmin").value) && $("attmin").value !== "" ? +$("attmin").value : 80, 0, 100),
    behaviorTypes: readBehTypes()
  };
  if (pin && pin !== prevPin) ui.unlocked = true; // เพิ่งตั้ง/เปลี่ยน PIN เอง → ไม่ต้องใส่ซ้ำในรอบนี้
  save();
  // ตั้ง PIN ครั้งแรกแต่ยังไม่มีวิธีกู้คืน → พาไปสร้างรหัสกู้คืนทันที
  if (pin && !prevPin && !hasRecovery()) { setTimeout(showNewRecoveryCode, 300); return; }
  if (quiet) { previewLate(); toast("✓ บันทึกการตั้งค่าแล้ว", 1500); }
  else { settingsPage(); toast("บันทึกการตั้งค่าแล้ว"); }
}

function uploadLogo(inp) {
  const f = inp.files[0]; inp.value = "";
  if (!f || !f.type.startsWith("image/")) return toast("กรุณาเลือกไฟล์รูปภาพ");
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 320, k = Math.min(1, MAX / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k) || 1; cv.height = Math.round(img.height * k) || 1;
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      db.logo = cv.toDataURL("image/png");
      if (db.logo.length > 400000) db.logo = cv.toDataURL("image/webp", 0.9);
      save(); refreshLogo(); toast("บันทึกโลโก้แล้ว");
    };
    img.onerror = () => toast("เปิดไฟล์รูปนี้ไม่ได้");
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}
function removeLogo() { db.logo = ""; save(); refreshLogo(); toast("ลบโลโก้แล้ว"); }
function refreshLogo() {
  // อัปเดตเฉพาะรูป ไม่รีเฟรชทั้งหน้า (ข้อความที่พิมพ์ไว้จะไม่หาย)
  const pv = $("logoPreview"); if (pv) pv.innerHTML = logoHTML("big");
  const br = document.querySelector(".brand"); if (br) br.firstElementChild.outerHTML = logoHTML();
  const tb = document.querySelector("#logoPreview + .form .toolbar");
  if (tb) tb.innerHTML = `<label class="btn">🖼️ อัปโหลดโลโก้<input type="file" accept="image/*" hidden onchange="uploadLogo(this)"></label>${db.logo ? `<button class="btn red" onclick="removeLogo()">ลบโลโก้</button>` : ""}`;
}

function exportJSON() {
  db.lastBackup = todayStr(); save();
  download(stampName("smart-scorebook-backup", "json"), JSON.stringify(db, null, 2), "application/json");
  toast("สำรองข้อมูลแล้ว — เก็บไฟล์ไว้ใน Google Drive ได้");
  if (ui.page === "set" && $("sPin")) settingsPage();
}

function importJSON(inp) {
  const f = inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    inp.value = "";
    let d, m;
    try {
      d = JSON.parse(String(rd.result).replace(/^\uFEFF/, ""));
      if (!d || !Array.isArray(d.students)) throw new Error();
      m = migrate(JSON.parse(JSON.stringify(d)));
    } catch (e) { toast("ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Smart Scorebook"); return; }
    confirmBox(`กู้คืนจากไฟล์ <b>${esc(f.name)}</b>?<br><span class="muted small">ในไฟล์มี ${m.courses.length} วิชา • ${m.classes.length} ห้อง • ${m.students.length} นักเรียน • ${m.items.length} งาน/กิจกรรม • เช็กชื่อ ${m.attendance.length} รายการ • พฤติกรรม ${m.behaviors.length} รายการ</span><br>ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด (เลิกทำได้)`, () => {
      db = m; ui.courseId = null; ui.itemId = null; fixSelection(); ui.unlocked = true;
      save(); settingsPage(); toast("กู้คืนข้อมูลเรียบร้อย");
    }, "กู้คืน");
  };
  rd.readAsText(f);
}

function resetAll() {
  confirmBox("ล้างข้อมูลทั้งหมด (ห้อง นักเรียน คะแนน งาน เช็กชื่อ) และเริ่มใหม่? <br><b>แนะนำให้สำรองข้อมูลก่อน</b>", () => {
    db = migrate(seed()); ui.courseId = null; ui.itemId = null; fixSelection();
    save(); home(); toast("ล้างข้อมูลแล้ว");
  }, "ล้างทั้งหมด");
}

