"use strict";
/* =============================================================
   พฤติกรรม / จิตพิสัย — เลือกได้หลายพฤติกรรม และหักได้หลายคนพร้อมกัน
   ============================================================= */
function behaviorPage() {
  const setup = needSetup();
  if (setup) return shell("พฤติกรรมและจิตพิสัย", setup, "behavior");
  const types = db.settings.behaviorTypes, r = roster(), full = db.settings.behaviorFull;
  ui.behSel = (ui.behSel || []).filter(id => types.some(t => t.id === id));
  const sel = types.filter(t => ui.behSel.includes(t.id)), selPts = sel.reduce((a, t) => a + t.points, 0);
  const todayCount = db.behaviors.filter(b => b.courseId === ui.courseId && b.date === ui.behDate && r.some(s => s.id === b.studentId)).length;
  shell("พฤติกรรมและจิตพิสัย", `
    <div class="card">
      <div class="section-head"><h2>1️⃣ เลือกพฤติกรรม <span class="muted small">(เลือกได้หลายข้อ)</span></h2><div class="toolbar"><button class="btn small gray" onclick="ui.behSel=[];behaviorPage()">ล้างที่เลือก</button><button class="btn small gray" onclick="teacher('set');setTimeout(()=>$('behSettings')?.scrollIntoView(),50)">⚙️ แก้ไขรายการ</button></div></div>
      <div class="behtypes">${types.map(t => `<button class="behtype ${ui.behSel.includes(t.id) ? "on" : ""}" onclick="toggleBehType('${t.id}')" aria-pressed="${ui.behSel.includes(t.id)}"><span class="bcheck">${ui.behSel.includes(t.id) ? "✓" : ""}</span><span class="bicon">${esc(t.icon || "⚠️")}</span><span>${esc(t.label)}</span><b>−${fmtNum(t.points)}</b></button>`).join("") || `<div class="empty">ยังไม่มีรายการพฤติกรรม</div>`}</div>
      <div class="toolbar" style="margin-top:12px"><span class="muted">วันที่</span><input class="input" type="date" value="${ui.behDate}" onchange="ui.behDate=this.value||todayStr();behaviorPage()"><button class="btn small gray" onclick="ui.behDate=todayStr();behaviorPage()">วันนี้</button>
        <input class="input" id="behNote" placeholder="หมายเหตุ (ไม่บังคับ)" style="flex:1;min-width:180px"></div>
      <div class="selsum ${sel.length ? "on" : ""}">${sel.length ? `กำลังบันทึก <b>${sel.length} พฤติกรรม</b>: ${sel.map(t => esc(t.label)).join(" + ")} = <b class="danger">−${fmtNum(selPts)} คะแนน</b> ต่อคน` : "ยังไม่ได้เลือกพฤติกรรม — แตะเพื่อเลือก (เลือกได้มากกว่า 1 ข้อ)"}</div>
    </div>
    <div class="section card">
      <div class="section-head"><div><h2>2️⃣ กด “หัก” ที่ชื่อนักเรียน หรือติ๊กหลายคนแล้วหักพร้อมกัน</h2><div class="muted small">จิตพิสัยเต็ม ${full} คะแนน • วันนี้บันทึกแล้ว ${todayCount} รายการ</div></div>
        <div class="toolbar"><button class="btn red" id="bulkBeh" onclick="bulkBeh()" ${sel.length ? "" : "disabled"}>− หักทุกคนที่ติ๊ก (<span id="bulkN">0</span>)</button><button class="btn gray" onclick="exportBehCSV()">⬇️ ส่งออกจิตพิสัย</button></div></div>
      ${searchRow()}
      ${r.length ? `<div class="table-wrap"><table class="table"><thead><tr><th><input type="checkbox" aria-label="เลือกทั้งหมด" onchange="document.querySelectorAll('.behpick').forEach(x=>{if(!x.closest('tr').hidden)x.checked=this.checked});updBulkN()"></th><th>นักเรียน</th><th></th><th>บันทึกวันที่เลือก</th><th>จิตพิสัย</th><th></th></tr></thead><tbody>
        ${r.map(s => `<tr id="bh-${s.id}" data-q="${rowQ(s)} ${s.sid}">${behRow(s)}</tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">ยังไม่มีนักเรียนในห้องนี้</div>`}
      <p class="muted small">คลิก × ที่รายการเพื่อยกเลิก • 📜 ดูประวัติทั้งภาค • คะแนนจิตพิสัย = ${full} − คะแนนที่ถูกหักทั้งภาค</p>
    </div>`, "behavior");
}
function toggleBehType(id) {
  ui.behSel = ui.behSel.includes(id) ? ui.behSel.filter(x => x !== id) : [...ui.behSel, id];
  const checked = [...document.querySelectorAll(".behpick:checked")].map(x => +x.value), note = $("behNote")?.value || "", y = window.scrollY;
  behaviorPage();
  checked.forEach(id => { const x = document.querySelector(`.behpick[value="${id}"]`); if (x) x.checked = true; });
  if ($("behNote")) $("behNote").value = note;
  updBulkN(); window.scrollTo(0, y);
}
function updBulkN() { const n = document.querySelectorAll(".behpick:checked").length; if ($("bulkN")) $("bulkN").textContent = n; }

function behRow(s) {
  const b = behaviorResult(s.id, ui.courseId);
  const today = b.list.filter(x => x.date === ui.behDate);
  const col = b.pct >= 80 ? "p" : b.pct >= 60 ? "l" : "a";
  return `<td><input type="checkbox" class="behpick" value="${s.id}" onchange="updBulkN()" aria-label="เลือก ${esc(s.name)}"></td>
    <td class="nowrap"><button class="linkbtn plain namebtn" onclick="studentDash(${s.id},true)">${s.no}. ${esc(s.name)}</button></td>
    <td><button class="btn small red" onclick="addBeh(${s.id})" ${ui.behSel?.length ? "" : "disabled"}>− หัก</button></td>
    <td>${today.length ? today.map(x => `<span class="behchip" title="${esc(x.note)}">${esc(typeIcon(x.type))} ${esc(x.label)} −${fmtNum(x.points)}<button onclick="delBeh(${x.id})" aria-label="ยกเลิก">×</button></span>`).join("") : '<span class="muted">—</span>'}</td>
    <td class="nowrap"><span class="pill ${col}">${fmtNum(b.score)}/${b.full}</span> <span class="muted small">${b.count ? `(${b.count} ครั้ง)` : ""}</span></td>
    <td><button class="icon" onclick="behHistory(${s.id})" title="ประวัติ">📜</button></td>`;
}
const typeIcon = id => db.settings.behaviorTypes.find(t => t.id === id)?.icon || "⚠️";

function makeBehRecords(sid) {
  const note = $("behNote")?.value.trim() || "";
  return db.settings.behaviorTypes.filter(t => ui.behSel.includes(t.id)).map(T => ({ id: uid(), studentId: sid, courseId: ui.courseId, date: ui.behDate, type: T.id, label: T.label, points: T.points, note }));
}
function addBeh(sid) {
  if (!ui.behSel?.length) return toast("เลือกพฤติกรรมก่อน");
  const recs = makeBehRecords(sid);
  db.behaviors.push(...recs);
  save();
  const s = db.students.find(x => x.id === sid);
  const row = $("bh-" + sid), wasChecked = row?.querySelector(".behpick")?.checked;
  if (row) { row.innerHTML = behRow(s); if (wasChecked) row.querySelector(".behpick").checked = true; }
  const ids = recs.map(r => r.id);
  toast(`${s.name}: ${recs.map(r => r.label).join(" + ")} −${fmtNum(recs.reduce((a, r) => a + r.points, 0))}`, 6000, { label: "↩️ ยกเลิก", fn: () => { db.behaviors = db.behaviors.filter(b => !ids.includes(b.id)); save(); const rw = $("bh-" + sid); if (rw) rw.innerHTML = behRow(s); toast("ยกเลิกแล้ว"); } });
}
function bulkBeh() {
  const ids = [...document.querySelectorAll(".behpick:checked")].map(x => +x.value);
  if (!ids.length) return toast("ติ๊กเลือกนักเรียนก่อน");
  if (!ui.behSel?.length) return toast("เลือกพฤติกรรมก่อน");
  checkpoint("หักคะแนนพฤติกรรมหลายคน");
  let n = 0;
  ids.forEach(sid => { const recs = makeBehRecords(sid); db.behaviors.push(...recs); n += recs.length; });
  save(); behaviorPage(); offerUndo(`หักคะแนน ${ids.length} คน (${n} รายการ)`);
}

function delBeh(id, silent = false) {
  const b = db.behaviors.find(x => x.id === id); if (!b) return;
  db.behaviors = db.behaviors.filter(x => x.id !== id);
  save();
  const row = $("bh-" + b.studentId);
  if (row) row.innerHTML = behRow(db.students.find(x => x.id === b.studentId));
  if ($("modal")) behHistory(b.studentId);
  if (!silent) toast("ยกเลิกการหักคะแนนแล้ว");
}

function behHistory(sid) {
  const s = db.students.find(x => x.id === sid), b = behaviorResult(sid, ui.courseId);
  const list = [...b.list].sort((a, c) => c.date.localeCompare(a.date));
  modal(`📜 ${esc(s.name)} — จิตพิสัย ${fmtNum(b.score)}/${b.full}`, list.length
    ? list.map(x => `<div class="listrow"><div><b>${esc(typeIcon(x.type))} ${esc(x.label)}</b> <span class="danger">−${fmtNum(x.points)}</span><div class="muted small">${fmtDate(x.date)}${x.note ? " • " + esc(x.note) : ""}</div></div><button class="btn small gray" onclick="delBeh(${x.id})">ยกเลิก</button></div>`).join("")
    : `<div class="empty">ยังไม่เคยถูกหักคะแนน 🎉</div>`, null);
}
