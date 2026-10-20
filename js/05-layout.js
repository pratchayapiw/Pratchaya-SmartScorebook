"use strict";
/* =============================================================
   โครงหน้าและการนำทาง
   หน้าแรก • เส้นทางหน้า (router) • แถบเมนู • ตัวเลือกห้องเรียน • ค้นหาในตาราง
   ============================================================= */

/* =============================================================
   หน้าแรก / โครงหน้าครู
   ============================================================= */
function home() {
  closeModal();
  ui.unlocked = false; ui.view = "home";
  armIdle(false);
  document.title = db.appTitle || DEFAULT_TITLE;
  $("app").innerHTML = `<div class="login"><div class="loginbox">
    <div class="homelogo">${logoHTML("big")}</div>
    <div class="org">${esc(db.school)}</div>
    <h1 class="apptitle">${esc(db.appTitle || DEFAULT_TITLE)}</h1>
    ${db.appSubtitle ? `<p class="muted">${esc(db.appSubtitle)}</p>` : ""}
    ${boot.notice ? `<div class="warning" style="margin-top:14px">${esc(boot.notice)}</div>` : ""}
    ${!store.ok ? `<div class="warning" style="margin-top:14px">⚠️ เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้ (อาจเปิดแบบส่วนตัว/Incognito) — ข้อมูลจะหายเมื่อปิดหน้า</div>` : ""}
    <div class="roles">
      <div class="role"><div class="emoji">👩‍🏫</div><h3>Teacher Dashboard</h3><p class="muted">จัดการงาน คะแนน เช็กชื่อ พฤติกรรม และสรุปเกรด</p><button class="btn primary" onclick="teacher()">${db.settings.teacherPin ? "🔒 " : ""}เข้าสู่ระบบครู</button></div>
      <div class="role"><div class="emoji">🎧</div><h3>Student Mode</h3><p class="muted">ดูคะแนน งานค้าง และจิตพิสัยของตัวเอง</p><button class="btn" onclick="student()">เข้าห้องเรียน</button></div>
    </div>
    <div class="muted small" style="margin-top:18px">เวอร์ชัน ${APP_VERSION}</div></div></div>`;
}

/* เส้นทางหน้า: คีย์ → ฟังก์ชันวาดหน้า */
const PAGES = () => ({ dash: dashPage, students: studentsPage, work: workPage, attend: attendPage, behavior: behaviorPage, report: reportPage, set: settingsPage });

/** เปิดหน้าครู  p = คีย์หน้า, keepScroll = คงตำแหน่งเลื่อนจอ (ใช้ตอนวาดหน้าเดิมซ้ำ) */
function teacher(p = "dash", keepScroll = false) {
  if (PAGE_ALIAS[p]) { ui.reportTab = PAGE_ALIAS[p][1]; p = PAGE_ALIAS[p][0]; }
  if (db.settings.teacherPin && !ui.unlocked) return askPin(p);
  fixSelection();
  if (p !== ui.page) ui.q = "";
  ui.page = p; ui.view = "teacher";
  const y = window.scrollY;
  try {
    (PAGES()[p] || dashPage)();
  } catch (err) {
    console.error(err);
    $("app").innerHTML = `<div class="login"><div class="loginbox"><div class="emoji" style="font-size:44px">🛠️</div><h2>หน้านี้แสดงผลไม่ได้</h2>
      <p class="muted">ข้อมูลที่บันทึกไว้ยังอยู่ครบ แนะนำให้ดาวน์โหลดไฟล์สำรองไว้ก่อน แล้วลองรีเฟรชหน้า</p>
      <p class="small muted">${esc(err && err.message)}</p>
      <div class="toolbar" style="justify-content:center"><button class="btn green" onclick="exportJSON()">⬇️ ดาวน์โหลดสำรองข้อมูล</button><button class="btn" onclick="location.reload()">🔄 รีเฟรช</button><button class="btn gray" onclick="ui.page='dash';home()">หน้าแรก</button></div></div></div>`;
    return;
  }
  window.scrollTo(0, keepScroll ? y : 0);
}

function askPin(p) {
  modal("🔒 รหัสครู", `<input class="input" id="pin" type="password" inputmode="numeric" placeholder="กรอกรหัส" style="width:100%" autocomplete="off">
    <div style="margin-top:10px;text-align:right"><button class="linkbtn" onclick="forgotPin('${p}')">ลืมรหัส?</button></div>`, "เข้าสู่ระบบ", () => {
    if ($("pin").value === db.settings.teacherPin) { ui.unlocked = true; closeModal(); teacher(p); }
    else { toast("รหัสไม่ถูกต้อง"); $("pin").select(); }
  });
}

/**
 * โครงหน้าครู: แถบเมนู + ส่วนหัว + เนื้อหา
 * @param {string} title   ชื่อหน้า
 * @param {string} content HTML เนื้อหา
 * @param {string} active  คีย์เมนูที่กำลังเปิด
 * @param {boolean} withPicker แสดงตัวเลือกห้องเรียนที่ส่วนหัวหรือไม่
 */
function shell(title, content, active, withPicker = true) {
  const warn = [boot.notice, !store.ok ? "เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้ (อาจเปิดแบบส่วนตัว/Incognito) — ข้อมูลจะหายเมื่อปิดหน้า กรุณาเปิดในหน้าต่างปกติ" : ""].filter(Boolean);
  const navBtn = ([k, i, t, short]) => `<button class="${active === k ? "active" : ""}" onclick="teacher('${k}')" title="${t}" aria-current="${active === k ? "page" : "false"}"><span class="ni">${i}</span><span class="nl">${t}</span><span class="ns">${short}</span>${k === "attend" && openRequests().length ? '<i class="dot"></i>' : ""}</button>`;
  $("app").innerHTML = `<div class="app">
    <aside class="side">
      <div class="brand">${logoHTML()}<span>${esc(db.appTitle || DEFAULT_TITLE)}</span></div>
      <nav class="nav" aria-label="เมนูหลัก">${NAV.map(g => `<div class="navgroup"><div class="navlabel">${g.group}</div>${g.items.map(navBtn).join("")}</div>`).join("")}</nav>
      <div class="nav side-foot">
        <button onclick="undo()" title="เลิกทำ" ${undoStack.length ? "" : "disabled"}><span class="ni">↩️</span><span class="nl">เลิกทำ${undoStack.length ? ` (${undoStack.length})` : ""}</span></button>
        <button onclick="home()" title="ออก"><span class="ni">🚪</span><span class="nl">ออก / หน้าหลัก</span></button>
      </div>
    </aside>
    <main class="main">
      <header class="top">
        <div class="toptitle"><h1>${title}</h1><div class="muted small">${esc(db.school)} • ${esc(db.teacher)} • <b>${termLabel(db.term)}</b></div></div>
        <div class="topright">
          <span id="saveState" class="savestate"></span>
          ${withPicker ? classPicker() : ""}
          <div class="mobtools"><button class="icon" onclick="undo()" title="เลิกทำ" ${undoStack.length ? "" : "disabled"}>↩️</button><button class="icon" onclick="home()" title="ออก">🚪</button></div>
        </div>
      </header>
      ${archiveBanner()}
      ${warn.map(w => `<div class="warning" style="margin-bottom:14px">${esc(w)}</div>`).join("")}
      ${content}
    </main></div>`;
  ui.view = "teacher";
  renderSaveState();
  applySearch();
}

/** ตัวเลือก "ห้องเรียน" ช่องเดียว (รวมวิชา + ห้อง) จัดกลุ่มตามรายวิชา */
function classPicker() {
  return `<label class="classpick"><span class="muted small">ห้องเรียน</span><select class="input" onchange="pickClass(this.value)" aria-label="เลือกห้องเรียน">${db.courses.map(co => {
    const rooms = courseClasses(co);
    return `<optgroup label="${esc(courseLabel(co))}">${rooms.length
      ? rooms.map(c => `<option value="${esc(co.id)}|${esc(c.id)}" ${co.id === ui.courseId && c.id === ui.classId ? "selected" : ""}>${esc(c.name)} • ${esc(co.name)} (${roster(c.id).length} คน)</option>`).join("")
      : `<option value="${esc(co.id)}|" ${co.id === ui.courseId ? "selected" : ""}>— ยังไม่ได้เลือกห้อง —</option>`}</optgroup>`;
  }).join("")}</select></label>`;
}
function pickClass(v) {
  const [co, c] = v.split("|");
  ui.courseId = co; ui.classId = c || null; ui.itemId = null;
  fixSelection(); teacher(ui.page);
}
const courseLabel = c => (c.code ? c.code + " " : "") + c.name;

/* แสดงแทนเนื้อหาเมื่อวิชายังไม่มีห้อง/ห้องยังไม่มีนักเรียน */
function needSetup() {
  if (!courseClasses().length) return `<div class="card empty">วิชา <b>${esc(curCourse()?.name || "")}</b> ยังไม่ได้เลือกห้องที่สอน<br><br><button class="btn primary" onclick="editCourse('${ui.courseId}')">เลือกห้องที่สอนวิชานี้</button></div>`;
  return "";
}

/* ---------- ค้นหานักเรียนในตาราง ---------- */
const rowQ = s => esc((s.no + " " + s.name).toLowerCase());
function searchBox(ph = "🔍 ค้นหาชื่อ/เลขที่") {
  return `<input class="input search" type="search" placeholder="${ph}" value="${esc(ui.q)}" oninput="ui.q=this.value;applySearch()" aria-label="ค้นหานักเรียน">`;
}
const searchRow = (extra = "") => `<div class="toolbar searchrow">${searchBox()}<span id="searchInfo" class="muted small"></span>${extra}</div>`;
function applySearch() {
  const q = ui.q.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll("[data-q]").forEach(tr => {
    const hit = !q || tr.dataset.q.includes(q) || tr.dataset.q.split(" ")[0] === q;
    tr.hidden = !hit; if (hit) shown++;
  });
  const info = document.getElementById("searchInfo");
  if (info) info.textContent = q ? `พบ ${shown} คน` : "";
}

