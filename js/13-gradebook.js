"use strict";
/* =============================================================
   หน้า: ตารางคะแนน
   มุมมองตาราง (แถว=นักเรียน, คอลัมน์=งาน) และมุมมองรายงาน (วันที่ส่ง/ส่งช้า)
   ============================================================= */

/* ---------- แท็บสลับมุมมอง ---------- */
function workTabs() {
  const A = curItem() || courseItems()[0];
  return `<div class="viewtabs noprint"><div class="seg tabs">
      <button class="${ui.workView !== "item" ? "on p" : ""}" onclick="ui.workView='grid';workPage()">📊 ทั้งห้อง (ตาราง)</button>
      <button class="${ui.workView === "item" ? "on p" : ""}" onclick="ui.workView='item';workPage()" ${A ? "" : "disabled"}>📝 ทีละงาน (วันที่ส่ง / ส่งช้า)</button></div>
    <button class="btn primary" onclick="editItem()">＋ สร้างงาน/กิจกรรม</button></div>`;
}

function gridPage() {
  const setup = needSetup();
  if (setup) return shell("ตารางคะแนน", setup, "work");
  const items = courseItems(), co = curCourse(), r = roster();
  if (!items.length) {
    return shell("ตารางคะแนน", `<div class="card empty">วิชา <b>${esc(courseLabel(co))}</b> ยังไม่มีงาน/คะแนน<br><span class="muted small">สร้างครั้งเดียว ใช้ได้ทุกห้องที่เรียนวิชานี้ (${courseClasses().map(c => esc(c.name)).join(", ")})</span><br><br><button class="btn primary" onclick="editItem()">＋ สร้างงาน/กิจกรรมแรก</button></div>`, "work");
  }
  const w = co.behaviorInTotal;
  shell("ตารางคะแนน", `
    ${workTabs()}
    <div class="card">
      <div class="section-head"><div><h2>📊 ${esc(cls(ui.classId)?.name || "")} • ${esc(courseLabel(co))}</h2>
        <div class="muted small">${r.length} คน • ${items.length} งาน/กิจกรรม • คลิก <b>หัวคอลัมน์</b> เพื่อดู/แก้ไขงาน • คลิก <b>ชื่อนักเรียน</b> เพื่อดูรายบุคคล</div></div>
        <div class="toolbar"><button class="btn green" onclick="exportCSV()">⬇️ Excel</button><button class="btn gray" onclick="window.print()">🖨️ พิมพ์</button></div></div>
      ${searchRow(`<div class="legend small"><span class="lg missing"></span>ค้างส่ง <span class="lg late"></span>ส่งช้า (หักแล้ว) <span class="lg waiting"></span>รอตรวจ <span class="lg pending"></span>ยังไม่ถึงกำหนด</div>`)}
      <div class="note noprint kbdnote">⌨️ พิมพ์คะแนนได้ทันที • <span class="kbd">Enter</span>/<span class="kbd">↓</span> ลงล่าง • <span class="kbd">Tab</span>/<span class="kbd">→</span> ไปขวา • คัดลอกหลายแถวหลายคอลัมน์จาก Excel แล้ววางได้ทั้งบล็อก • ช่องว่าง = ค้างส่ง</div>
      ${r.length ? `<div class="gridwrap"><table class="gbook">
        <thead>${gridHead(items, co)}</thead>
        <tbody>${r.map(s => `<tr id="gr-${s.id}" data-q="${rowQ(s)} ${s.sid}">${gridRow(s, items)}</tr>`).join("")}</tbody>
        <tfoot><tr id="gfoot">${gridFoot(items, r)}</tr></tfoot>
      </table></div>` : `<div class="empty">ยังไม่มีนักเรียนในห้องนี้</div>`}
    </div>`, "work");
}

/* ---------- หัวตาราง: แบบโรงเรียนมี 2 แถว (กลุ่ม คะแนนเก็บ/กลางภาค/ปลายภาค → รายการงาน) ---------- */
function itemTh(it, co) {
  const no = isThai(co) && partOf(it) === "collect" ? `<div class="ino">${it.order}</div>` : "";
  return `<th class="ihead" onclick="ui.itemId=${it.id};ui.workView='item';workPage()" title="${esc(it.title)}${it.detail ? "\n\n" + esc(it.detail) : ""}">${no}<div class="ititle">${isThai(co) ? "" : it.due ? "📌 " : "📊 "}${esc(it.title)}</div><div class="muted small">เต็ม ${fmtNum(it.max)}${it.due ? " • " + fmtDate(it.due) : ""}</div></th>`;
}
function totHeads(co) {
  const w = co.behaviorInTotal, sc = co.scheme;
  if (!isThai(co)) return `<th class="tot">คะแนนงาน</th><th class="tot">จิตพิสัย</th>${w ? '<th class="tot">รวม</th>' : ""}<th class="tot">เกรด</th><th class="tot">ค้าง</th>`;
  const rawMax = courseItems(co.id).filter(i => partOf(i) === "collect").reduce((a, i) => a + i.max, 0);
  return `<th class="tot">เก็บ<div class="muted small">/${fmtNum(rawMax)}</div></th><th class="tot">คิดเป็น<div class="muted small">/${sc.collect}</div></th>${sc.mid ? `<th class="tot">กลางภาค<div class="muted small">/${sc.mid}</div></th>` : ""}${sc.final ? `<th class="tot">ปลายภาค<div class="muted small">/${sc.final}</div></th>` : ""}<th class="tot total">รวม<div class="muted small">/${sc.collect + sc.mid + sc.final}</div></th><th class="tot">เกรด</th><th class="tot">จิตพิสัย</th><th class="tot">ค้าง</th>`;
}
function gridHead(items, co) {
  if (!isThai(co)) return `<tr><th class="stick c1">เลขที่</th><th class="stick c2">ชื่อ-สกุล</th>${items.map(it => itemTh(it, co)).join("")}${totHeads(co)}</tr>`;
  const groups = PART_ORDER.map(p => ({ p, list: items.filter(i => partOf(i) === p) })).filter(g => g.list.length);
  const tots = totHeads(co).replace(/<th class="tot/g, '<th rowspan="2" class="tot');
  return `<tr class="grp"><th rowspan="2" class="stick c1">เลขที่</th><th rowspan="2" class="stick c2">ชื่อ-สกุล</th>${groups.map(g => `<th colspan="${g.list.length}" class="grph g-${g.p}">${PARTS[g.p].icon} ${PARTS[g.p].label}${g.p === "collect" ? ` <span class="muted small">(เต็ม ${fmtNum(g.list.reduce((a, i) => a + i.max, 0))} → คิดเป็น ${co.scheme.collect})</span>` : ""}</th>`).join("")}${tots}</tr>
    <tr class="itm">${groups.map(g => g.list.map(it => itemTh(it, co)).join("")).join("")}</tr>`;
}

function gridCell(s, it) {
  const i = markInfo(getMark(s.id, it.id), it);
  const cls_ = i.raw !== null ? (i.calc?.rate ? "late" : "done") : i.status;
  const tip = i.status === "missing" ? "ค้างส่ง" + (i.overdueDays ? ` (เลยกำหนด ${i.overdueDays} วัน)` : "") : i.calc?.rate ? `ส่งช้า ${i.days} วัน หัก ${i.calc.rate}% → ${fmtNum(i.net)}` : MARK[i.status].label;
  return `<td class="gc ${cls_}" title="${esc(tip)}"><input class="gcell" inputmode="decimal" autocomplete="off" data-sid="${s.id}" data-iid="${it.id}" data-max="${it.max}" value="${i.raw ?? ""}" onfocus="this.select()" oninput="liveCheck(this)" onchange="gridSet(this)" onkeydown="gridKey(event,this)" onpaste="gridPaste(event,this)" aria-label="${esc(s.name)} • ${esc(it.title)}">${i.calc?.rate ? `<span class="netmark">${fmtNum(i.net)}</span>` : ""}</td>`;
}

function gridRow(s, items = courseItems()) {
  const co = curCourse(), res = studentResult(s.id), w = co.behaviorInTotal;
  const head = `<td class="stick c1">${s.no}</td><td class="stick c2 ${res.special || (res.total !== null && res.total < 50) ? "lowname" : ""}"><button class="linkbtn plain namebtn" onclick="studentDash(${s.id},true)">${esc(s.name)}</button></td>
    ${items.map(it => gridCell(s, it)).join("")}`;
  return head + resultTotCells(res, co);
}

/** ช่องสรุปท้ายแถว (ใช้ร่วมกันระหว่างตารางคะแนน และสรุปผลการเรียน) */
function resultTotCells(res, co) {
  const w = co.behaviorInTotal;
  if (isThai(co)) {
    const P = res.parts, sc = co.scheme;
    return `<td class="tot">${P.collect.max ? fmtNum(P.collect.got) : "—"}</td>
      <td class="tot"><b>${P.collect.pts ?? "—"}</b></td>
      ${sc.mid ? `<td class="tot">${P.mid.n ? (P.mid.missing ? '<span class="danger">ขาดสอบ</span>' : fmtNum(P.mid.pts)) : "—"}</td>` : ""}
      ${sc.final ? `<td class="tot">${P.final.n ? (P.final.missing ? '<span class="danger">ขาดสอบ</span>' : fmtNum(P.final.pts)) : "—"}</td>` : ""}
      <td class="tot total ${bandCls(res.total)}"><b>${res.points !== undefined && res.pointsMax ? fmtNum(res.points) : "—"}</b>${res.pointsMax && res.pointsMax < res.fullMax ? `<div class="small muted">จาก ${res.pointsMax}</div>` : ""}</td>
      <td class="tot">${res.total !== null || res.special ? `<span class="pill ${res.special ? "a" : gradeCls(res.grade)}">${res.gradeLabel}</span>` : "—"}</td>
      <td class="tot"><span class="pill ${res.beh.pct >= 80 ? "p" : res.beh.pct >= 60 ? "l" : "a"}">${fmtNum(res.beh.score)}</span></td>
      <td class="tot">${res.pending ? `<span class="danger"><b>${res.pending}</b></span>` : '<span class="muted">0</span>'}</td>`;
  }
  return `<td class="tot"><b>${res.academic !== null ? res.academic + "%" : "—"}</b></td>
    <td class="tot"><span class="pill ${res.beh.pct >= 80 ? "p" : res.beh.pct >= 60 ? "l" : "a"}">${fmtNum(res.beh.score)}</span></td>
    ${w ? `<td class="tot"><b>${res.total !== null ? res.total + "%" : "—"}</b></td>` : ""}
    <td class="tot">${res.total !== null ? `<span class="pill ${gradeCls(res.grade)}">${res.grade}</span>` : "—"}</td>
    <td class="tot">${res.pending ? `<span class="danger"><b>${res.pending}</b></span>` : '<span class="muted">0</span>'}</td>`;
}

function gridFoot(items, r) {
  return `<td class="stick c1"></td><td class="stick c2"><b>เฉลี่ยห้อง</b></td>${items.map(it => {
    const v = r.map(s => markInfo(getMark(s.id, it.id), it)).filter(i => i.net !== null).map(i => i.net);
    const miss = r.filter(s => markInfo(getMark(s.id, it.id), it).status === "missing").length;
    return `<td class="foot">${v.length ? fmtNum(v.reduce((a, b) => a + b, 0) / v.length) : "—"}${miss ? `<div class="small danger">ค้าง ${miss}</div>` : ""}</td>`;
  }).join("")}<td class="tot" colspan="${isThai() ? 6 + (curCourse().scheme.mid ? 1 : 0) + (curCourse().scheme.final ? 1 : 0) : curCourse().behaviorInTotal ? 5 : 4}"></td>`;
}

function gridSet(e) {
  const it = db.items.find(x => x.id === +e.dataset.iid), sid = +e.dataset.sid;
  if (!it) return;
  if (!liveCheck(e)) { toast(`ไม่บันทึก: คะแนนต้องอยู่ระหว่าง 0–${it.max}`); return; }
  const v = num(toArabic(e.value).trim());
  const m = ensureMark(sid, it.id);
  m.score = v;
  if (v !== null) m.handedIn = true;
  save();
  // รอให้โฟกัสย้ายไปช่องใหม่ก่อน แล้วค่อยวาดแถวใหม่ (ไม่ทำให้ช่องที่กำลังพิมพ์หลุด)
  const iid = e.dataset.iid;
  setTimeout(() => gridRefreshRow(sid, { dataset: { iid } }), 0);
}

/* วาดแถวใหม่ (ยอดรวม/สี) โดยไม่ทำให้ช่องที่กำลังพิมพ์หลุดโฟกัส */
function gridRefreshRow(sid, from) {
  const tr = $("gr-" + sid), s = db.students.find(x => x.id === sid);
  if (!tr || !s) return;
  const active = document.activeElement, activeKey = active?.classList?.contains("gcell") ? active.dataset.sid + "|" + active.dataset.iid : null;
  tr.innerHTML = gridRow(s);
  if (from) { const n = tr.querySelector(`.gcell[data-iid="${from.dataset.iid}"]`); if (n) flashSaved(n); }
  if (activeKey && activeKey.startsWith(sid + "|")) {
    const again = tr.querySelector(`.gcell[data-iid="${activeKey.split("|")[1]}"]`);
    if (again && again !== document.activeElement) again.focus();
  }
  const foot = $("gfoot"); if (foot) foot.innerHTML = gridFoot(courseItems(), roster());
}

function gridMove(e, dr, dc) {
  const td = e.closest("td"), tr = td.closest("tr");
  const rows = [...tr.parentElement.children].filter(x => !x.hidden);
  const ri = rows.indexOf(tr) + dr, cells = [...tr.querySelectorAll(".gcell")], ci = cells.indexOf(e) + dc;
  const row = rows[ri]; if (!row) return false;
  const target = row.querySelectorAll(".gcell")[ci];
  if (target) { target.focus(); return true; }
  return false;
}

function gridKey(ev, e) {
  const atStart = e.selectionStart === 0 && e.selectionEnd === 0, atEnd = e.selectionStart === e.value.length;
  const allSel = e.selectionStart === 0 && e.selectionEnd === e.value.length;
  if (ev.key === "Enter" || ev.key === "ArrowDown") { ev.preventDefault(); gridMove(e, ev.shiftKey && ev.key === "Enter" ? -1 : 1, 0); }
  else if (ev.key === "ArrowUp") { ev.preventDefault(); gridMove(e, -1, 0); }
  else if (ev.key === "ArrowRight" && (atEnd || allSel)) { ev.preventDefault(); gridMove(e, 0, 1); }
  else if (ev.key === "ArrowLeft" && (atStart || allSel)) { ev.preventDefault(); gridMove(e, 0, -1); }
  else if (ev.key === "Escape") { e.blur(); }
}

/* วางข้อมูลจาก Excel/Google Sheets ได้ทั้งบล็อก (หลายแถว × หลายคอลัมน์) */
function gridPaste(ev, e) {
  const text = (ev.clipboardData || window.clipboardData)?.getData("text") || "";
  const grid = text.replace(/\r/g, "").split("\n");
  while (grid.length && grid[grid.length - 1] === "") grid.pop();
  const data = grid.map(l => l.split("\t"));
  if (data.length < 2 && data[0]?.length < 2) return; // ค่าเดียว วางตามปกติ
  ev.preventDefault();
  checkpoint("วางคะแนนจาก Excel");
  const tr = e.closest("tr"), rows = [...tr.parentElement.children].filter(x => !x.hidden);
  const r0 = rows.indexOf(tr), c0 = [...tr.querySelectorAll(".gcell")].indexOf(e);
  const items = courseItems();
  let ok = 0, bad = 0;
  const touched = new Set();
  data.forEach((line, dr) => {
    const row = rows[r0 + dr]; if (!row) return;
    const sid = +row.id.replace("gr-", "");
    line.forEach((raw, dc) => {
      const it = items[c0 + dc]; if (!it) return;
      const v = toArabic(raw).trim().replace(",", ".");
      if (v === "") return;
      const n = num(v);
      if (n === null || n < 0 || n > it.max) { bad++; return; }
      const m = ensureMark(sid, it.id); m.score = n; m.handedIn = true; ok++;
      touched.add(sid);
    });
  });
  save();
  touched.forEach(sid => gridRefreshRow(sid));
  offerUndo(`วางคะแนน ${ok} ช่อง${bad ? ` • ข้าม ${bad} ช่องที่ไม่ถูกต้อง/เกินคะแนนเต็ม` : ""}`);
}

/* ---------- เส้นทางของหน้าตารางคะแนน ---------- */
function workPage() {
  return ui.workView === "item" ? itemPage() : gridPage();
}

/* มุมมองรายงาน: ส่งงาน/วันที่ส่ง/ส่งช้า/ยกเว้น ของงาน 1 ชิ้น */
function itemPage() {
  const setup = needSetup();
  if (setup) return shell("ตารางคะแนน", setup, "work");
  const list = courseItems(), co = curCourse();
  if (!list.length) {
    return shell("ตารางคะแนน", `<div class="card empty">วิชา <b>${esc(courseLabel(co))}</b> ยังไม่มีงาน/คะแนน<br><span class="muted small">สร้างครั้งเดียว ใช้ได้ทุกห้องที่เรียนวิชานี้ (${courseClasses().map(c => esc(c.name)).join(", ")})</span><br><br><button class="btn primary" onclick="editItem()">＋ สร้างงาน/กิจกรรมแรก</button></div>`, "work");
  }
  if (!curItem()) ui.itemId = (list.find(a => a.due && a.due >= todayStr()) || list[list.length - 1]).id;
  const A = curItem(), r = roster(), weighted = db.settings.totalMode === "weighted";
  const pos = list.findIndex(a => a.id === A.id);
  shell("ตารางคะแนน", `
    ${workTabs()}
    <div class="itembar card">
      <button class="btn gray" onclick="ui.itemId=${list[pos - 1]?.id ?? "null"};workPage()" ${pos > 0 ? "" : "disabled"} aria-label="งานก่อนหน้า">◀</button>
      <select class="input" onchange="ui.itemId=+this.value;workPage()" aria-label="เลือกงาน">${list.map((a, i) => { const miss = r.filter(s => markInfo(getMark(s.id, a.id), a).status === "missing").length; return `<option value="${a.id}" ${a.id === A.id ? "selected" : ""}>${i + 1}. ${esc(a.title)} — ${a.due ? "ส่ง " + fmtDate(a.due) : "ในห้อง"}${miss ? ` (ค้าง ${miss})` : ""}</option>`; }).join("")}</select>
      <button class="btn gray" onclick="ui.itemId=${list[pos + 1]?.id ?? "null"};workPage()" ${pos < list.length - 1 ? "" : "disabled"} aria-label="งานถัดไป">▶</button>
      <span class="muted small">งานที่ ${pos + 1} จาก ${list.length} • ใช้ร่วมกันทุกห้องในวิชานี้</span>
    </div>
    <div class="section card">
      <div class="section-head">
        <div><h2>${esc(A.title)} <span class="pill ${A.due ? "leave" : "gray"}">${A.due ? "มีกำหนดส่ง" : "กิจกรรม/สอบในห้อง"}</span></h2>
          <div class="muted small">${A.due ? `กำหนดส่ง ${fmtDate(A.due)} • ` : ""}เต็ม ${A.max}${weighted ? ` • น้ำหนัก ×${A.weight}` : ""}${A.channel ? " • " + esc(A.channel) : ""}</div>
          ${A.detail ? `<div class="detailbox">${escBr(A.detail)}</div>` : `<div class="muted small">ยังไม่มีรายละเอียดงาน — <button class="linkbtn small" onclick="editItem(${A.id})">เพิ่มรายละเอียด</button> (นักเรียนจะเห็นในรายงานงานค้าง)</div>`}</div>
        <div class="toolbar"><span id="workStat"></span><button class="btn gray" onclick="editItem(${A.id})">✏️ แก้ไข</button></div>
      </div>
      ${searchRow()}
      <div class="note">💾 บันทึกอัตโนมัติ • กด <span class="kbd">Enter</span> ไปคนถัดไป • วางคะแนนทั้งคอลัมน์จาก Excel ในช่องแรกได้ • <b>ช่องคะแนนว่าง = ค้างส่ง</b>${A.due ? "" : " (กิจกรรมไม่มีกำหนดส่ง)"}${A.due ? `<br>${lateRuleText()} • ใส่ “วันที่ส่ง” แล้วระบบนับวันช้าให้ • ติ๊ก “ยกเว้น” เมื่อมีเหตุจำเป็น` : ""}</div>
      ${r.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>นักเรียน</th><th>${A.due ? "วันที่ส่ง" : "การส่ง"}</th><th>สถานะ</th>${A.due ? "<th>ส่งช้า</th>" : ""}<th>คะแนน (เต็ม ${A.max})</th><th>คะแนนสุทธิ</th></tr></thead><tbody>${r.map(s => `<tr id="wr-${s.id}" data-q="${rowQ(s)}">${markRow(s, A)}</tr>`).join("")}</tbody></table></div>
      <div class="toolbar" style="margin-top:14px"><button class="btn gray" onclick="fillScores()">เติมคะแนนเต็มให้ช่องที่ว่าง</button><button class="btn red" onclick="clearScores()">ล้างคะแนนงานนี้ (เฉพาะห้องนี้)</button></div>` : `<div class="empty">ยังไม่มีนักเรียนในห้องนี้</div>`}
    </div>`, "work");
  updateWorkStat();
}

function markRow(s, A) {
  const m = getMark(s.id, A.id), i = markInfo(m, A), st = MARK[i.status];
  let sendCell, lateCell = "";
  if (A.due) {
    sendCell = `<div class="inline"><input class="input" type="date" value="${m?.submittedAt || ""}" onchange="setSubmitDate(${s.id},this.value)" aria-label="วันที่ส่ง"><button class="btn small gray" onclick="setSubmitDate(${s.id},todayStr())">วันนี้</button></div>`;
    if (i.handed && !m?.submittedAt) sendCell += `<div class="muted small">ส่งแล้ว (ไม่ระบุวัน)</div>`;
    lateCell = "<td>—</td>";
    if (i.handed) {
      lateCell = `<td>${m?.submittedAt ? `<b>${i.days}</b> วัน` : `<input class="input tiny" type="number" min="0" step="1" value="${i.days}" onchange="setLateOverride(${s.id},this.value)"> วัน`}
        <label class="check small"><input type="checkbox" ${m?.excused ? "checked" : ""} onchange="setExcused(${s.id},this.checked)"> ยกเว้น</label></td>`;
    } else if (i.overdueDays) lateCell = `<td class="danger small">เลยกำหนด ${i.overdueDays} วัน</td>`;
  } else {
    sendCell = `<label class="check small"><input type="checkbox" ${i.handed ? "checked" : ""} ${i.raw !== null ? "disabled" : ""} onchange="setHanded(${s.id},this.checked)"> ส่งแล้ว/ทำแล้ว</label>`;
  }
  const net = i.calc
    ? `<b>${fmtNum(i.calc.net)}/${A.max}</b> <span class="muted">(${i.pct}%)</span>${i.calc.rate ? `<div class="small danger">หักส่งช้า ${i.calc.rate}%</div>` : ""}`
    : "—";
  return `<td class="nowrap">${s.no}. ${esc(s.name)}</td><td>${sendCell}</td><td><span class="pill ${st.cls}">${st.label}</span></td>${lateCell}
    <td><input class="input score markin" type="number" inputmode="decimal" min="0" max="${A.max}" step="any" data-id="${s.id}" data-max="${A.max}" value="${i.raw ?? ""}" placeholder="—" oninput="liveCheck(this)" onchange="setScore(this)" onkeydown="navKey(event,this,'.markin')" onpaste="pasteColumn(event,this,'.markin')"></td><td>${net}</td>`;
}

function updateWorkRow(sid) {
  const s = db.students.find(x => x.id === sid), tr = $("wr-" + sid), A = curItem();
  if (s && tr && A) tr.innerHTML = markRow(s, A);
  updateWorkStat();
}

function updateWorkStat() {
  const el = $("workStat"), A = curItem(); if (!el || !A) return;
  const r = roster(), infos = r.map(s => markInfo(getMark(s.id, A.id), A));
  const c = k => infos.filter(i => i.status === k).length;
  const v = infos.filter(i => i.net !== null).map(i => i.net);
  el.innerHTML = `<span class="pill p">มีคะแนน ${v.length}/${infos.length}</span> ${c("late") ? `<span class="pill l">ช้า ${c("late")}</span>` : ""} ${c("waiting") ? `<span class="pill leave">รอตรวจ ${c("waiting")}</span>` : ""} ${c("missing") ? `<span class="pill a">ค้าง ${c("missing")}</span>` : ""} ${v.length ? `<span class="pill gray">เฉลี่ย ${fmtNum(v.reduce((a, b) => a + b, 0) / v.length)}</span>` : ""}`;
}

function setSubmitDate(sid, v) {
  const m = ensureMark(sid, curItem().id);
  m.submittedAt = v || null; m.handedIn = !!v; m.lateDaysOverride = null;
  if (!v) m.excused = false;
  save(); updateWorkRow(sid);
}
function setHanded(sid, checked) {
  const m = ensureMark(sid, curItem().id);
  m.handedIn = checked; save(); updateWorkRow(sid);
}
function setLateOverride(sid, v) {
  const m = ensureMark(sid, curItem().id);
  m.lateDaysOverride = Math.max(0, Math.floor(+v || 0));
  save(); updateWorkRow(sid);
}
function setExcused(sid, checked) {
  ensureMark(sid, curItem().id).excused = checked;
  save(); updateWorkRow(sid);
}
function setScore(e) {
  const A = curItem(), sid = +e.dataset.id, v = num(e.value);
  if (!liveCheck(e)) { toast(`ไม่บันทึก: คะแนนต้องอยู่ระหว่าง 0–${A.max}`); return; }
  const m = ensureMark(sid, A.id);
  m.score = v;
  if (v !== null) m.handedIn = true;
  save();
  // เก็บตำแหน่งโฟกัส (ถ้าผู้ใช้กด Tab/Enter ไปช่องถัดไปแล้ว)
  const next = document.activeElement;
  updateWorkRow(sid);
  const newInp = document.querySelector(`#wr-${sid} .markin`);
  if (newInp) flashSaved(newInp);
  if (next && next.isConnected) next.focus();
}

function fillScores() {
  const A = curItem(), empty = roster().filter(s => (getMark(s.id, A.id)?.score ?? null) === null);
  if (!empty.length) return toast("ทุกคนมีคะแนนแล้ว");
  confirmBox(`ให้คะแนนเต็ม ${A.max} กับนักเรียน ${empty.length} คนที่ยังว่างอยู่?`, () => {
    empty.forEach(s => { const m = ensureMark(s.id, A.id); m.score = A.max; m.handedIn = true; });
    save(); workPage(); toast("เติมคะแนนแล้ว");
  }, "เติมคะแนน");
}

function clearScores() {
  const A = curItem(), ids = new Set(roster().map(s => s.id));
  confirmBox(`ล้างคะแนนและการส่งงาน <b>${esc(A.title)}</b> ของห้อง ${esc(cls(ui.classId).name)} ทั้งหมด?`, () => {
    db.marks = db.marks.filter(x => !(x.itemId === A.id && ids.has(x.studentId)));
    save(); workPage(); toast("ล้างคะแนนแล้ว");
  }, "ล้าง");
}

function editItem(id) {
  const A = id ? db.items.find(a => a.id === id) : null, co = curCourse();
  const hasDue = A ? !!A.due : true, thai = isThai(co);
  const part = A?.part || ui.newPart || "collect";
  const nextOrder = p => Math.max(0, ...courseItems().filter(i => partOf(i) === p).map(i => i.order || 0)) + 1;
  modal(A ? "แก้ไขงาน/กิจกรรม" : "สร้างงาน/กิจกรรม", `
    <div class="note">📚 วิชา <b>${esc(courseLabel(co))}</b> — งานนี้จะมีให้ทุกห้อง: ${courseClasses().map(c => esc(c.name)).join(", ") || "-"}</div>
    ${thai ? `<div class="partpick">${PART_ORDER.filter(p => p === "collect" || co.scheme[p] > 0).map(p => `<label class="partopt"><input type="radio" name="wpart" value="${p}" ${p === part ? "checked" : ""} onchange="$('word').value=this.dataset.next" data-next="${A && (A.part || "collect") === p ? A.order : nextOrder(p)}"><span>${PARTS[p].icon} ${PARTS[p].label}<small>${p === "collect" ? `รวมแล้วคิดเป็น ${co.scheme.collect} คะแนน` : `คิดเป็น ${co.scheme[p]} คะแนน`}</small></span></label>`).join("")}</div>` : ""}
    <div class="form">
      ${thai ? `<label>ลำดับที่ (เลขข้อในแบบบันทึก)<input class="input" id="word" type="number" min="1" step="1" value="${A?.order ?? nextOrder(part)}"></label><div></div>` : ""}
      <label class="full">ชื่องาน/กิจกรรม<input class="input" id="wt" value="${esc(A?.title || "")}" placeholder="เช่น Unit 3 Writing: My Weekend"></label>
      <label class="full">รายละเอียด / คำสั่งงาน <span class="muted small" style="font-weight:400">(นักเรียนเห็นในรายงานงานค้าง)</span><textarea class="input" id="wd" rows="4" placeholder="เช่น เขียนเรียงความ 80–100 คำ เล่าเรื่องวันหยุด ใช้ Past Simple อย่างน้อย 5 ประโยค">${esc(A?.detail || "")}</textarea></label>
      <div class="full"><label class="check"><input type="radio" name="wtype" value="due" ${hasDue ? "checked" : ""} onchange="$('wdueRow').hidden=false"> มีกำหนดส่ง / วันสอบ (ก่อนถึงวันนั้นยังไม่นับคะแนน • ส่งช้าหักคะแนน)</label>
        <label class="check"><input type="radio" name="wtype" value="none" ${hasDue ? "" : "checked"} onchange="$('wdueRow').hidden=true"> กิจกรรม/สอบในห้อง (ไม่มีกำหนดส่ง)</label></div>
      <label id="wdueRow" ${hasDue ? "" : "hidden"}>กำหนดส่ง<input class="input" id="wdue" type="date" value="${A?.due || todayStr()}"></label>
      <label>คะแนนเต็ม<input class="input" id="wmax" type="number" min="0.5" step="any" value="${A?.max ?? ""}"></label>
      ${thai ? `<input type="hidden" id="ww" value="${A?.weight ?? 1}">` : `<label>น้ำหนัก (ตัวคูณ)<input class="input" id="ww" type="number" min="0.1" step="any" value="${A?.weight ?? 1}"></label>`}
      <label>ช่องทางส่งงาน<input class="input" id="wch" value="${esc(A?.channel || "")}" placeholder="Google Classroom / ส่งในห้อง / สมุด"></label>
    </div>
    ${A ? `<div class="toolbar" style="margin-top:14px"><button class="btn gray" onclick="copyItem(${A.id})">📄 คัดลอกไปวิชาอื่น</button><button class="btn red" onclick="delItem(${A.id})">🗑️ ลบงานนี้</button></div>` : ""}`, "บันทึก", () => {
    const title = $("wt").value.trim(), max = +$("wmax").value, weight = +$("ww").value || 1;
    const due = document.querySelector("input[name=wtype]:checked").value === "due" ? $("wdue").value : "";
    if (!title || !(max > 0)) return toast("กรอกชื่องานและคะแนนเต็ม");
    if (document.querySelector("input[name=wtype]:checked").value === "due" && !due) return toast("เลือกวันกำหนดส่ง");
    if (A && db.marks.some(m => m.itemId === A.id && m.score > max)) return toast(`มีนักเรียนได้เกิน ${max} อยู่แล้ว — แก้คะแนนก่อนลดคะแนนเต็ม`);
    const data = { title, detail: $("wd").value.trim(), due, max, weight, channel: $("wch").value.trim() };
    if (thai) { data.part = document.querySelector("input[name=wpart]:checked")?.value || "collect"; data.order = Math.max(1, Math.floor(+$("word").value) || 1); }
    if (A) Object.assign(A, data);
    else { const n = { id: uid(), courseId: ui.courseId, ...data }; db.items.push(n); ui.itemId = n.id; }
    save(); closeModal(); workPage(); toast(A ? "บันทึกงานแล้ว" : `สร้างงานให้ ${courseClasses().length} ห้องแล้ว`);
  });
}

function copyItem(id) {
  const A = db.items.find(a => a.id === id), others = db.courses.filter(c => c.id !== A.courseId);
  if (!others.length) return toast("ยังไม่มีวิชาอื่น — เพิ่มได้ที่เมนู วิชา/ห้อง/นักเรียน");
  modal("คัดลอกงานไปวิชาอื่น", `<p>คัดลอก <b>${esc(A.title)}</b> (ไม่รวมคะแนน) ไปยัง:</p>
    <div class="checkgrid">${others.map(c => `<label class="check"><input type="checkbox" class="cpco" value="${esc(c.id)}"> ${esc(courseLabel(c))}</label>`).join("")}</div>`, "คัดลอก", () => {
    const picked = [...document.querySelectorAll(".cpco:checked")].map(x => x.value);
    if (!picked.length) return toast("เลือกอย่างน้อย 1 วิชา");
    picked.forEach(cid => db.items.push({ ...A, id: uid(), courseId: cid }));
    save(); closeModal(); toast(`คัดลอกไป ${picked.length} วิชาแล้ว`);
  });
}

function delItem(id) {
  const A = db.items.find(a => a.id === id);
  confirmBox(`ลบ <b>${esc(A.title)}</b> พร้อมคะแนนของทุกห้องในวิชานี้?`, () => {
    db.items = db.items.filter(a => a.id !== id);
    db.marks = db.marks.filter(m => m.itemId !== id);
    save(); workPage(); toast("ลบงานแล้ว");
  }, "ลบ");
}
