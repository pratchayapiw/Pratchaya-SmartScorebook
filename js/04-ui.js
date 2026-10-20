"use strict";
/* =============================================================
   ส่วนประกอบหน้าจอพื้นฐาน
   toast • modal • ยืนยัน/เลิกทำ • จับ error • ซิงก์หลายแท็บ • ช่องกรอกคะแนน • โลโก้
   ============================================================= */

/* ---------- UI พื้นฐาน ---------- */
let toastTimer = null, lastToastText = "";
function toast(t, ms = 2600, action = null) {
  lastToastText = t;
  document.querySelectorAll(".toast").forEach(e => e.remove());
  clearTimeout(toastTimer);
  const e = document.createElement("div");
  e.className = "toast"; e.setAttribute("role", "status");
  const span = document.createElement("span"); span.textContent = t; e.append(span);
  if (action) {
    const b = document.createElement("button");
    b.className = "toastbtn"; b.textContent = action.label;
    b.onclick = () => { e.remove(); action.fn(); };
    e.append(b);
  }
  document.body.append(e);
  toastTimer = setTimeout(() => e.remove(), ms);
}

/* สถานะการบันทึก (มุมขวาบนของหน้าครู) */
function renderSaveState() {
  const el = document.getElementById("saveState"); if (!el) return;
  if (saveState.ok) {
    el.className = "savestate ok";
    el.textContent = saveState.at ? "✓ บันทึกแล้ว " + saveState.at.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "✓ พร้อมใช้งาน";
    el.title = "ข้อมูลถูกบันทึกในเบราว์เซอร์เครื่องนี้";
  } else {
    el.className = "savestate bad";
    el.textContent = "⚠️ ยังไม่ได้บันทึก";
    el.title = saveState.error;
  }
}

/* วาดหน้าปัจจุบันใหม่ (ใช้หลังเลิกทำ/ข้อมูลเปลี่ยนจากแท็บอื่น) */
function rerender() {
  closeModal();
  if (ui.view === "teacher") teacher(ui.page, true);
  else if (ui.view === "studentDash" && ui.viewSid && db.students.some(s => s.id === ui.viewSid)) studentDash(ui.viewSid, ui.viewFromTeacher);
  else if (ui.view === "student") student();
  else home();
}

/* จับ error ทั้งระบบ: แจ้งผู้ใช้แบบเป็นมิตร ข้อมูลไม่หาย */
let lastErrAt = 0;
function reportError(err) {
  console.error(err);
  if (Date.now() - lastErrAt < 3000) return;
  lastErrAt = Date.now();
  toast("⚠️ เกิดข้อผิดพลาดบางอย่าง แต่ข้อมูลที่บันทึกแล้วยังอยู่ครบ — ลองกดใหม่อีกครั้ง", 5000, { label: "รีเฟรชหน้า", fn: () => location.reload() });
}
window.addEventListener("error", e => reportError(e.error || e.message));
window.addEventListener("unhandledrejection", e => reportError(e.reason));

/* ซิงก์ระหว่างแท็บ: ถ้าเปิดหลายแท็บ ข้อมูลจะไม่ทับกัน */
window.addEventListener("storage", e => {
  if (e.key !== KEY || e.newValue === null || ui.archive) return;
  try {
    const typing = document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
    db = migrate(JSON.parse(e.newValue));
    idx.dirty = true;
    fixSelection();
    if (!$("modal") && !typing) rerender();
    toast("🔄 ข้อมูลถูกอัปเดตจากอีกแท็บหนึ่ง", 3000);
  } catch (err) { reportError(err); }
});

function modal(title, body, okText, onOk, opts = {}) {
  closeModal();
  document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="modal" onclick="if(event.target===this)closeModal()"><div class="modalbox" role="dialog" aria-modal="true"><div class="section-head"><h2>${title}</h2><button class="btn gray" onclick="closeModal()" aria-label="ปิด">×</button></div>${body}<div class="toolbar modalfoot"><button class="btn gray" onclick="closeModal()">${okText ? "ยกเลิก" : "ปิด"}</button>${okText ? `<button class="btn ${opts.danger ? "red" : "primary"}" id="mok">${okText}</button>` : ""}</div></div></div>`);
  if (okText) $("mok").onclick = onOk;
  $("modal").addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && okText) { e.preventDefault(); $("mok").click(); }
  });
  const f = document.querySelector("#modal .modalbox input:not([type=checkbox]), #modal .modalbox textarea");
  if (f) f.focus();
}
function closeModal() { document.getElementById("modal")?.remove(); }
/* ทุกการยืนยัน = การกระทำที่ลบ/เปลี่ยนข้อมูลมาก → สร้างจุดเลิกทำ + จุดบันทึกอัตโนมัติก่อนเสมอ */
function confirmBox(msg, onYes, okText = "ยืนยัน") {
  modal("ยืนยัน", `<p>${msg}</p>`, okText, () => {
    closeModal();
    const label = okText + ": " + msg.replace(/<[^>]+>/g, "").slice(0, 60);
    checkpoint(label); snapshot("ก่อน" + okText);
    onYes();
    offerUndo();
  }, { danger: true });
}
function offerUndo(msg) {
  toast(msg || lastToastText || "เรียบร้อย", 8000, { label: "↩️ เลิกทำ", fn: undo });
  const b = document.querySelector('.side-foot button[title="เลิกทำ"]');
  if (b) { b.disabled = false; b.querySelector("span").textContent = `เลิกทำ (${undoStack.length})`; }
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stat(label, value, sub = "", cls = "") {
  return `<div class="card stat"><div class="label">${label}</div><div class="num ${cls}">${value}</div><div class="sub">${sub}</div></div>`;
}

/* ตรวจคะแนนทันทีที่พิมพ์ (ใช้ data-max) */
function liveCheck(e) {
  const max = +e.dataset.max, v = num(e.value);
  const bad = (e.value !== "" && v === null) || (v !== null && (v < 0 || v > max));
  if (bad && !e.classList.contains("bad")) toast(v !== null && v > max ? `⚠️ เกินคะแนนเต็ม ${max} คะแนน` : "⚠️ คะแนนต้องไม่ติดลบ");
  e.classList.toggle("bad", bad);
  return !bad;
}
/* Enter / ลูกศร = เลื่อนไปช่องถัดไป */
function navKey(ev, e, sel) {
  if (!["Enter", "ArrowDown", "ArrowUp"].includes(ev.key)) return;
  ev.preventDefault();
  const all = visibleInputs(sel);
  const n = all[all.indexOf(e) + (ev.key === "ArrowUp" ? -1 : 1)];
  if (n) { n.focus(); n.select(); } else e.blur();
}
const visibleInputs = sel => [...document.querySelectorAll(sel)].filter(x => !x.closest("tr")?.hidden);
/* วางคะแนนหลายบรรทัดจาก Excel/Google Sheets → เติมลงช่องถัดๆ ไปตามลำดับ */
function pasteColumn(ev, e, sel) {
  const text = (ev.clipboardData || window.clipboardData)?.getData("text") || "";
  const vals = text.replace(/\r/g, "").split("\n").map(l => l.split("\t")[0].trim());
  while (vals.length && vals[vals.length - 1] === "") vals.pop();
  if (vals.length < 2) return; // ค่าเดียว ให้วางตามปกติ
  ev.preventDefault();
  checkpoint("วางคะแนนจาก Excel");
  const all = visibleInputs(sel), start = all.indexOf(e);
  let ok = 0, bad = 0;
  vals.forEach((v, i) => {
    const inp = all[start + i]; if (!inp) return;
    inp.value = v.replace(",", ".");
    if (v === "" || !liveCheck(inp)) { if (v !== "") bad++; return; }
    inp.dispatchEvent(new Event("change")); ok++;
  });
  const extra = Math.max(0, vals.length - (all.length - start));
  offerUndo(`วางคะแนน ${ok} คน${bad ? ` • ไม่ถูกต้อง ${bad} ช่อง (ไม่บันทึก)` : ""}${extra ? ` • เกินจำนวนนักเรียน ${extra} บรรทัด` : ""}`);
}
/* โลโก้หน่วยงาน: ใช้รูปที่อัปโหลดในตั้งค่า → ถ้าไม่มี ใช้ไฟล์ logo.png ในโฟลเดอร์ → ถ้าไม่มี ใช้ไอคอน 📚 */
function logoHTML(size = "") {
  return `<img class="orglogo ${size}" src="${esc(db.logo || "logo.png")}" alt="โลโก้ ${esc(db.school)}" onerror="logoFail(this)">`;
}
function logoFail(img) {
  const d = document.createElement("div");
  d.className = "logo appmark " + (img.classList.contains("big") ? "big" : "");
  d.innerHTML = ico("scorebook");
  img.replaceWith(d);
}
function flashSaved(e) { e.classList.add("saved"); setTimeout(() => e.classList.remove("saved"), 700); }

