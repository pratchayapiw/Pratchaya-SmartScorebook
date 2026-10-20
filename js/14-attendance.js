"use strict";
/* =============================================================
   ระบบเช็กชื่อ (มา / สาย / ลา / ขาด / หนีเรียน) — แยกตามวิชา
   มุมมอง: รายวัน • ตารางรายเดือน • เฝ้าระวัง • คำร้องแก้ไข
   ============================================================= */
const ATT_ORDER = ["present", "late", "leave", "absent", "skip"];
const openRequests = (co = ui.courseId, classId = ui.classId) => {
  const ids = new Set(roster(classId).map(s => s.id));
  return db.requests.filter(r => r.status === "open" && r.courseId === co && ids.has(r.studentId));
};
/* วันที่มีการเช็กชื่อ (คาบเรียน) ของห้อง+วิชานี้ */
function sessionDates(co = ui.courseId, classId = ui.classId) {
  const ids = new Set(roster(classId).map(s => s.id));
  return [...new Set(db.attendance.filter(a => a.courseId === co && ids.has(a.studentId)).map(a => a.date))].sort();
}

/* วิเคราะห์การมาเรียนรายคน → ธงเตือน */
function attInsight(sid, co = ui.courseId) {
  ensureIdx();
  const recs = (idx.attBy.get(sid + "|" + co) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const a = attSummary(sid, co), min = db.settings.attendanceMin, flags = [];
  let streak = 0;
  for (let i = recs.length - 1; i >= 0 && (recs[i].status === "absent" || recs[i].status === "skip"); i--) streak++;
  let level = 0;
  if (a.n >= 3 && a.rate < min) { flags.push({ lv: 3, t: `เวลาเรียน ${a.rate}% ต่ำกว่า ${min}% (เสี่ยง มส.)` }); }
  else if (a.n >= 5 && a.rate < min + 5 && a.rate > min) flags.push({ lv: 1, t: `เวลาเรียน ${a.rate}% ใกล้เกณฑ์ ${min}%` });
  if (streak >= 2) flags.push({ lv: 3, t: `ขาด/หนีติดต่อกัน ${streak} ครั้งล่าสุด` });
  if (a.skip >= 2) flags.push({ lv: 2, t: `หนีเรียน ${a.skip} ครั้ง` });
  if (a.late >= 3) flags.push({ lv: 1, t: `มาสาย ${a.late} ครั้ง` });
  flags.forEach(f => { level = Math.max(level, f.lv); });
  return { ...a, streak, flags, level };
}

function attendPage() {
  const setup = needSetup();
  if (setup) return shell("เช็กชื่อ", setup, "attend");
  const v = ui.attView || "day";
  const watchN = roster().filter(s => attInsight(s.id).level >= 2).length, reqN = openRequests().length;
  const tabs = `<div class="viewtabs noprint"><div class="seg tabs">
      <button class="${v === "day" ? "on p" : ""}" onclick="ui.attView='day';attendPage()">📋 เช็กชื่อรายวัน</button>
      <button class="${v === "month" ? "on p" : ""}" onclick="ui.attView='month';attendPage()">🗓️ ตารางรายเดือน</button>
      <button class="${v === "watch" ? "on p" : ""}" onclick="ui.attView='watch';attendPage()">⚠️ เฝ้าระวัง${watchN ? ` <span class="badge">${watchN}</span>` : ""}</button>
      <button class="${v === "req" ? "on p" : ""}" onclick="ui.attView='req';attendPage()">📨 คำร้องแก้ไข${reqN ? ` <span class="badge">${reqN}</span>` : ""}</button></div>
    <button class="btn gray" onclick="exportAttCSV()">⬇️ ส่งออก CSV</button></div>`;
  const body = v === "month" ? attMonthView() : v === "watch" ? attWatchView() : v === "req" ? attReqView() : attDayView();
  shell("เช็กชื่อ", tabs + body, "attend");
  if (v === "day") { updateAttStat(); focusAttRow(); }
}

/* ---------- รายวัน ---------- */
function attDayView() {
  const r = roster(), d = ui.attDate, dates = sessionDates();
  const n = dates.indexOf(d), sessionNo = n >= 0 ? n + 1 : dates.filter(x => x < d).length + 1;
  const isNew = n < 0;
  return `
    <div class="card attbar">
      <div class="datenav"><button class="btn gray" onclick="shiftAttDate(-1)" aria-label="วันก่อน">◀</button>
        <input class="input" type="date" value="${d}" onchange="ui.attDate=this.value||todayStr();attendPage()">
        <button class="btn gray" onclick="shiftAttDate(1)" aria-label="วันถัดไป">▶</button>
        <button class="btn small gray" onclick="ui.attDate=todayStr();attendPage()">วันนี้</button></div>
      <div class="sessioninfo"><b>${new Date(d + "T00:00:00").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</b>
        <span class="muted small">${isNew ? `คาบใหม่ (ครั้งที่ ${sessionNo})` : `คาบที่ ${sessionNo} จาก ${dates.length} คาบที่เช็กแล้ว`} • ${esc(cls(ui.classId)?.name || "")} • ${esc(curCourse().name)}</span></div>
      <div class="toolbar"><button class="btn green" onclick="markAllPresent()">✓ คนที่เหลือ “มา” ทั้งหมด</button><button class="btn red" onclick="clearAtt()">ล้างวันนี้</button></div>
    </div>
    <div class="section card">
      <div id="attStat"></div>
      ${searchRow(`<span class="muted small kbdhint">⌨️ คลิกแถวแล้วกด <span class="kbd">1</span> มา <span class="kbd">2</span> สาย <span class="kbd">3</span> ลา <span class="kbd">4</span> ขาด <span class="kbd">5</span> หนี • <span class="kbd">↑</span><span class="kbd">↓</span> เลื่อน • <span class="kbd">0</span> ลบ</span>`)}
      ${r.length ? `<div class="table-wrap"><table class="table atttable"><thead><tr><th>เลขที่</th><th>นักเรียน</th><th>สถานะวันนี้</th><th>หมายเหตุ</th><th>สถิติทั้งภาค</th></tr></thead><tbody>
        ${r.map(s => `<tr id="ar-${s.id}" data-sid="${s.id}" data-q="${rowQ(s)} ${s.sid}" tabindex="0" onkeydown="attKey(event,this)" onclick="ui.attFocus=${s.id};this.focus({preventScroll:true})">${attRow(s)}</tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">ยังไม่มีนักเรียนในห้องนี้</div>`}
      <div class="attlegend small muted">${Object.entries(ATT).map(([k, v]) => `<span><span class="pill ${v.cls}">${v.label}</span> ${v.tip || (k === "late" ? "นับเป็นมาเรียน" : k === "present" ? "" : "แจ้งลาแล้ว")}</span>`).join("")}</div>
    </div>`;
}

function attRow(s) {
  const x = attOf(s.id, ui.attDate), ins = attInsight(s.id);
  const top = ins.flags.filter(f => f.lv >= 2).sort((a, b) => b.lv - a.lv)[0]; // แถวรายวันแสดงเฉพาะเรื่องสำคัญ
  return `<td>${s.no}</td>
    <td><button class="linkbtn plain namebtn" onclick="event.stopPropagation();studentDash(${s.id},true)">${esc(s.name)}</button>${top ? `<div class="flag lv${top.lv}" title="${esc(ins.flags.map(f => f.t).join("\n"))}">${top.lv === 3 ? "🔴" : top.lv === 2 ? "🟠" : "🟡"} ${esc(top.t)}${ins.flags.length > 1 ? ` +${ins.flags.length - 1}` : ""}</div>` : ""}</td>
    <td>${attButtons(s.id)}</td>
    <td>${x ? `<button class="notebtn ${x.note ? "has" : ""}" onclick="event.stopPropagation();attNote(${s.id})" title="${esc(x.note || "เพิ่มหมายเหตุ")}">${x.note ? "📝 " + esc(x.note.slice(0, 24)) + (x.note.length > 24 ? "…" : "") : "＋ หมายเหตุ"}</button>` : '<span class="muted small">—</span>'}</td>
    <td class="small">${ins.n ? `<div class="ratebar" title="มาเรียน ${ins.rate}%"><span style="width:${ins.rate}%" class="${ins.rate < db.settings.attendanceMin ? "bad" : ""}"></span></div><span class="${ins.rate < db.settings.attendanceMin ? "danger" : "muted"}">${ins.rate}%</span> <span class="muted">(ม${ins.present} ส${ins.late} ล${ins.leave} ข${ins.absent}${ins.skip ? ` <b class="danger">น${ins.skip}</b>` : ""})</span>` : '<span class="muted">—</span>'}</td>`;
}

function attButtons(sid) {
  const cur = attOf(sid, ui.attDate)?.status;
  return `<div class="seg attseg">${ATT_ORDER.map((k, i) => { const v = ATT[k]; return `<button class="${v.cls}${cur === k ? " on" : ""}" onclick="setAtt(${sid},'${k}')" title="${v.label}${v.tip ? " — " + v.tip : ""} (ปุ่ม ${i + 1})">${v.label}</button>`; }).join("")}</div>`;
}

function setAtt(sid, st, toggle = true) {
  const d = ui.attDate, co = ui.courseId;
  const i = db.attendance.findIndex(x => x.studentId === sid && x.date === d && x.courseId === co);
  if (i >= 0 && db.attendance[i].status === st && toggle) db.attendance.splice(i, 1);
  else if (i >= 0) db.attendance[i].status = st;
  else if (st) db.attendance.push({ date: d, studentId: sid, courseId: co, status: st });
  save();
  const tr = $("ar-" + sid), s = db.students.find(x => x.id === sid);
  if (tr && s) tr.innerHTML = attRow(s);
  updateAttStat();
}

function attNote(sid) {
  const x = attOf(sid, ui.attDate); if (!x) return;
  const s = db.students.find(k => k.id === sid);
  modal(`หมายเหตุ • ${esc(s.name)} • ${fmtDate(ui.attDate)}`, `<p class="muted small">สถานะ: <b>${ATT[x.status].label}</b> — เช่น “ลาป่วย มีใบรับรองแพทย์”, “ไปแข่งขันกีฬา”, “ผู้ปกครองโทรแจ้ง”</p>
    <input class="input" id="attNoteIn" style="width:100%" maxlength="200" value="${esc(x.note || "")}">
    <div class="chips" style="margin-top:8px">${["ลาป่วย", "ลากิจ", "ผู้ปกครองแจ้ง", "ไปกิจกรรมโรงเรียน", "มีใบรับรองแพทย์"].map(t => `<button class="chip" onclick="$('attNoteIn').value=this.textContent">${t}</button>`).join("")}</div>`, "บันทึก", () => {
    const t = $("attNoteIn").value.trim();
    if (t) x.note = t; else delete x.note;
    save(); closeModal(); const tr = $("ar-" + sid); if (tr) tr.innerHTML = attRow(s); toast("บันทึกหมายเหตุแล้ว");
  });
}

function attKey(ev, tr) {
  const sid = +tr.dataset.sid;
  const k = ev.key;
  if (/^[1-5]$/.test(k)) { ev.preventDefault(); setAtt(sid, ATT_ORDER[+k - 1], false); moveAttRow(tr, 1); }
  else if (k === "0" || k === "Delete" || k === "Backspace") { ev.preventDefault(); const x = attOf(sid, ui.attDate); if (x) setAtt(sid, x.status, true); $("ar-" + sid)?.focus(); }
  else if (k === "ArrowDown") { ev.preventDefault(); moveAttRow(tr, 1); }
  else if (k === "ArrowUp") { ev.preventDefault(); moveAttRow(tr, -1); }
}
function moveAttRow(tr, d) {
  const rows = [...document.querySelectorAll(".atttable tbody tr")].filter(x => !x.hidden);
  const cur = rows.indexOf($("ar-" + tr.dataset.sid));
  const n = rows[cur + d] || rows[cur];
  if (n) { n.focus(); ui.attFocus = +n.dataset.sid; n.scrollIntoView({ block: "nearest" }); }
}
function focusAttRow() {
  if (!ui.attFocus) return;
  const tr = $("ar-" + ui.attFocus); if (tr) tr.focus({ preventScroll: true });
}
function shiftAttDate(n) {
  const d = new Date(ui.attDate + "T00:00:00");
  do { d.setDate(d.getDate() + n); } while (d.getDay() === 0 || d.getDay() === 6); // ข้ามเสาร์-อาทิตย์
  ui.attDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  attendPage();
}

function updateAttStat() {
  const el = $("attStat"); if (!el) return;
  const r = roster(), c = { present: 0, late: 0, leave: 0, absent: 0, skip: 0 };
  let n = 0;
  r.forEach(s => { const x = attOf(s.id, ui.attDate); if (x && c[x.status] !== undefined) { c[x.status]++; n++; } });
  const here = c.present + c.late;
  el.innerHTML = `<div class="attsumbar">
      <div class="attbig"><div class="num">${here}<span class="muted">/${r.length}</span></div><div class="muted small">มาเรียน • เช็กแล้ว ${n}/${r.length}${n < r.length ? ` <span class="danger">(ยังไม่เช็ก ${r.length - n})</span>` : " ✓"}</div></div>
      <div class="stack">${ATT_ORDER.map(k => c[k] ? `<span class="${ATT[k].cls}" style="flex:${c[k]}" title="${ATT[k].label} ${c[k]}">${c[k]}</span>` : "").join("")}${r.length - n ? `<span class="none" style="flex:${r.length - n}" title="ยังไม่เช็ก">${r.length - n}</span>` : ""}</div>
      <div class="pills">${ATT_ORDER.map(k => `<span class="pill ${ATT[k].cls}">${ATT[k].label} ${c[k]}</span>`).join(" ")}</div></div>`;
}

function markAllPresent() {
  const left = roster().filter(s => !attOf(s.id, ui.attDate));
  if (!left.length) return toast("เช็กชื่อครบทุกคนแล้ว");
  checkpoint("เช็กชื่อ “มา” ทั้งหมด");
  left.forEach(s => db.attendance.push({ date: ui.attDate, studentId: s.id, courseId: ui.courseId, status: "present" }));
  save(); attendPage(); offerUndo(`บันทึก “มา” ${left.length} คน`);
}
function clearAtt() {
  const ids = new Set(roster().map(s => s.id));
  confirmBox(`ล้างการเช็กชื่อวันที่ ${fmtDate(ui.attDate)} ของห้องนี้ (วิชานี้)?`, () => {
    db.attendance = db.attendance.filter(x => !(x.date === ui.attDate && x.courseId === ui.courseId && ids.has(x.studentId)));
    save(); attendPage(); toast("ล้างการเช็กชื่อแล้ว");
  }, "ล้าง");
}

/* ---------- ตารางรายเดือน ---------- */
function attMonthView() {
  const m = ui.attMonth || ui.attDate.slice(0, 7);
  ui.attMonth = m;
  const r = roster(), today = todayStr();
  let dates = sessionDates().filter(d => d.startsWith(m));
  if (today.startsWith(m) && !dates.includes(today)) dates.push(today);
  if (ui.attDate.startsWith(m) && !dates.includes(ui.attDate)) dates.push(ui.attDate);
  dates = [...new Set(dates)].sort();
  const title = new Date(m + "-01T00:00:00").toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  const min = db.settings.attendanceMin;
  return `<div class="card">
    <div class="section-head"><div class="datenav"><button class="btn gray" onclick="shiftAttMonth(-1)">◀</button><h2 style="margin:0 8px">🗓️ ${title}</h2><button class="btn gray" onclick="shiftAttMonth(1)">▶</button></div>
      <div class="toolbar noprint"><span class="muted small">คลิกช่องเพื่อเปลี่ยนสถานะ • คลิกวันที่เพื่อเช็กรายวัน</span><button class="btn gray" onclick="window.print()">🖨️ พิมพ์</button></div></div>
    <div class="printhead">${logoHTML()}<div><b>${esc(db.school)}</b><div class="small">บันทึกเวลาเรียน ${esc(courseLabel(curCourse()))} • ${esc(cls(ui.classId)?.name || "")} • ${title} • ${esc(db.teacher)}</div></div></div>
    ${r.length ? `<div class="gridwrap"><table class="gbook attgrid">
      <thead><tr><th class="stick c1">เลขที่</th><th class="stick c2">ชื่อ-สกุล</th>
        ${dates.map(d => { const dt = new Date(d + "T00:00:00"); return `<th class="dcol ${d === today ? "today" : ""}" onclick="ui.attDate='${d}';ui.attView='day';attendPage()" title="เช็กชื่อ ${fmtDate(d)}"><div>${dt.getDate()}</div><div class="muted small">${dt.toLocaleDateString("th-TH", { weekday: "short" })}</div></th>`; }).join("")}
        ${ATT_ORDER.map(k => `<th class="tot">${ATT[k].short}</th>`).join("")}<th class="tot">% ทั้งภาค</th></tr></thead>
      <tbody>${r.map(s => {
        const ins = attInsight(s.id), mc = { present: 0, late: 0, leave: 0, absent: 0, skip: 0 };
        const cells = dates.map(d => { const x = attOf(s.id, d); if (x) mc[x.status]++; return `<td class="ac ${x ? ATT[x.status].cls : "empty"}" onclick="cycleAtt(${s.id},'${d}')" title="${fmtDate(d)}${x ? " • " + ATT[x.status].label : " • ยังไม่เช็ก"}${x?.note ? " • " + esc(x.note) : ""}">${x ? ATT[x.status].short : "·"}${x?.note ? "<i></i>" : ""}</td>`; }).join("");
        return `<tr data-q="${rowQ(s)} ${s.sid}"><td class="stick c1">${s.no}</td><td class="stick c2"><button class="linkbtn plain namebtn" onclick="studentDash(${s.id},true)">${esc(s.name)}</button>${ins.level >= 2 ? ' <span title="' + esc(ins.flags.map(f => f.t).join("\n")) + '">' + (ins.level === 3 ? "🔴" : "🟠") + "</span>" : ""}</td>${cells}
          ${ATT_ORDER.map(k => `<td class="tot">${mc[k] || ""}</td>`).join("")}<td class="tot ${ins.rate !== null && ins.rate < min ? "danger" : ""}"><b>${ins.rate ?? "—"}${ins.rate !== null ? "%" : ""}</b></td></tr>`;
      }).join("")}</tbody></table></div>
      <p class="muted small">${ATT_ORDER.map(k => `${ATT[k].short} = ${ATT[k].label}`).join(" • ")} • ช่องมีจุดมุม = มีหมายเหตุ • % ทั้งภาค = (มา + สาย) ÷ ครั้งที่เช็ก • เกณฑ์ขั้นต่ำ ${min}%</p>` : `<div class="empty">ยังไม่มีนักเรียนในห้องนี้</div>`}
  </div>`;
}
function shiftAttMonth(n) {
  const [y, mo] = (ui.attMonth || ui.attDate.slice(0, 7)).split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  ui.attMonth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  attendPage();
}
function cycleAtt(sid, date) {
  const co = ui.courseId, i = db.attendance.findIndex(x => x.studentId === sid && x.date === date && x.courseId === co);
  const cur = i >= 0 ? db.attendance[i].status : null;
  const next = cur === null ? "present" : ATT_ORDER[ATT_ORDER.indexOf(cur) + 1] || null;
  if (next === null) db.attendance.splice(i, 1);
  else if (i >= 0) db.attendance[i].status = next;
  else db.attendance.push({ date, studentId: sid, courseId: co, status: next });
  save(); teacher("attend", true);
}

/* ---------- เฝ้าระวัง ---------- */
function attWatchView() {
  const list = roster().map(s => ({ s, ins: attInsight(s.id) })).filter(x => x.ins.flags.length).sort((a, b) => b.ins.level - a.ins.level || (a.ins.rate ?? 101) - (b.ins.rate ?? 101));
  const min = db.settings.attendanceMin, n = sessionDates().length;
  return `<div class="card">
    <div class="section-head"><div><h2>⚠️ นักเรียนที่ต้องเฝ้าระวัง</h2><div class="muted small">เช็กชื่อแล้ว ${n} คาบ • เกณฑ์เวลาเรียนขั้นต่ำ ${min}% (ปรับได้ที่ ⚙️ ตั้งค่า)</div></div></div>
    ${list.length ? list.map(({ s, ins }) => `<div class="watchrow lv${ins.level}" data-q="${rowQ(s)}"><div><b>${s.no}. ${esc(s.name)}</b> <span class="muted small">มาเรียน ${ins.rate ?? "—"}% • ม${ins.present} ส${ins.late} ล${ins.leave} ข${ins.absent} น${ins.skip}</span>
      <ul>${ins.flags.sort((a, b) => b.lv - a.lv).map(f => `<li>${f.lv === 3 ? "🔴" : f.lv === 2 ? "🟠" : "🟡"} ${esc(f.t)}</li>`).join("")}</ul></div>
      <button class="btn small gray" onclick="studentDash(${s.id},true)">ดูรายบุคคล</button></div>`).join("") : `<div class="empty">🎉 ไม่มีนักเรียนที่ต้องเฝ้าระวัง</div>`}
    <p class="muted small">🔴 เวลาเรียนต่ำกว่าเกณฑ์ หรือขาด/หนีติดต่อกัน ≥ 2 ครั้ง • 🟠 หนีเรียน ≥ 2 ครั้ง • 🟡 ใกล้เกณฑ์ หรือมาสาย ≥ 3 ครั้ง (ประเมินเมื่อเช็กชื่อแล้วอย่างน้อย 3 คาบ) • ตัวเลขบนแท็บนับเฉพาะ 🔴🟠</p>
  </div>`;
}

/* ---------- คำร้องขอแก้ไขจากนักเรียน ---------- */
function attReqView() {
  const ids = new Set(roster().map(s => s.id));
  const all = db.requests.filter(r => r.courseId === ui.courseId && ids.has(r.studentId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = all.filter(r => r.status === "open"), done = all.filter(r => r.status !== "open").slice(0, 20);
  const nm = id => db.students.find(s => s.id === id);
  const row = r => { const s = nm(r.studentId), cur = attOf(r.studentId, r.date, r.courseId)?.status; return `<div class="reqrow ${r.status}"><div>
      <b>${s.no}. ${esc(s.name)}</b> <span class="muted small">ส่งเมื่อ ${fmtDateTime(r.createdAt)}</span>
      <div>วันที่ <b>${fmtDate(r.date)}</b>: ครูบันทึก <span class="pill ${ATT[cur]?.cls || "gray"}">${ATT[cur]?.label || "ไม่มีข้อมูล"}</span> → นักเรียนแจ้งว่า <span class="pill ${ATT[r.wanted]?.cls || "gray"}">${ATT[r.wanted]?.label || "-"}</span></div>
      ${r.note ? `<div class="detailbox small">${esc(r.note)}</div>` : ""}</div>
      ${r.status === "open" ? `<div class="toolbar"><button class="btn small green" onclick="resolveReq(${r.id},true)">✓ แก้ไขตามคำร้อง</button><button class="btn small gray" onclick="resolveReq(${r.id},false)">✗ ไม่แก้ไข</button></div>` : `<span class="pill ${r.status === "done" ? "p" : "gray"}">${r.status === "done" ? "แก้ไขแล้ว" : "ไม่แก้ไข"}</span>`}</div>`; };
  return `<div class="card"><div class="section-head"><div><h2>📨 คำร้องขอแก้ไขการเช็กชื่อ</h2><div class="muted small">นักเรียนส่งคำร้องจาก Student Mode เมื่อเห็นว่าครูบันทึกผิด</div></div></div>
    ${open.length ? open.map(row).join("") : `<div class="empty">ไม่มีคำร้องที่รอดำเนินการ</div>`}
    ${done.length ? `<details class="section"><summary class="muted">ประวัติคำร้อง (${done.length})</summary>${done.map(row).join("")}</details>` : ""}</div>`;
}
function resolveReq(id, accept) {
  const r = db.requests.find(x => x.id === id); if (!r) return;
  if (accept && r.wanted) {
    const i = db.attendance.findIndex(x => x.studentId === r.studentId && x.date === r.date && x.courseId === r.courseId);
    if (i >= 0) db.attendance[i].status = r.wanted;
    else db.attendance.push({ date: r.date, studentId: r.studentId, courseId: r.courseId, status: r.wanted });
  }
  r.status = accept ? "done" : "rejected";
  save(); attendPage(); toast(accept ? "แก้ไขการเช็กชื่อตามคำร้องแล้ว" : "บันทึกว่าไม่แก้ไขแล้ว");
}

