"use strict";
/* =============================================================
   หน้า: รายงาน
   รายงานงานค้าง • สรุปผลการเรียน • ส่งออกไฟล์
   ============================================================= */

/** หน้ารายงาน: แท็บ งานค้าง • สรุปผลการเรียน • ส่งออกไฟล์ */
function reportPage() {
  const setup = needSetup();
  if (setup) return shell("รายงาน", setup, "report");
  const tab = ui.reportTab || "missing";
  const views = { missing: missingView, summary: summaryView, sheet: sheetView, memo: memoView, export: exportView };
  shell("รายงาน", `<div class="viewtabs noprint"><div class="seg tabs">
      <button class="${tab === "missing" ? "on p" : ""}" onclick="ui.reportTab='missing';reportPage()">${ico("missing", "tab")}งานค้าง</button>
      <button class="${tab === "summary" ? "on p" : ""}" onclick="ui.reportTab='summary';reportPage()">${ico("report", "tab")}สรุปผลการเรียน</button>
      <button class="${tab === "sheet" ? "on p" : ""}" onclick="ui.reportTab='sheet';reportPage()">${ico("scorebook", "tab")}แบบบันทึกคะแนน</button>
      <button class="${tab === "memo" ? "on p" : ""}" onclick="ui.reportTab='memo';reportPage()">${ico("memo", "tab")}บันทึกข้อความ</button>
      <button class="${tab === "export" ? "on p" : ""}" onclick="ui.reportTab='export';reportPage()">${ico("download", "tab")}ส่งออกไฟล์</button></div></div>
    ${(views[tab] || missingView)()}`, "report");
}

/* ---------- สรุปผลการเรียน (อ่านอย่างเดียว สำหรับพิมพ์/ส่งออก) ---------- */
function summaryView() {
  const r = roster(), items = courseItems(), st = db.settings, co = curCourse(), w = co.behaviorInTotal;
  const rows = r.map(s => ({ s, res: studentResult(s.id), att: attSummary(s.id) }));
  const sorters = {
    no: (a, b) => a.s.no - b.s.no,
    high: (a, b) => (b.res.total ?? -1) - (a.res.total ?? -1) || a.s.no - b.s.no,
    low: (a, b) => (a.res.total ?? 101) - (b.res.total ?? 101) || a.s.no - b.s.no,
    pending: (a, b) => b.res.pending - a.res.pending || a.s.no - b.s.no,
    beh: (a, b) => a.res.beh.score - b.res.beh.score || a.s.no - b.s.no
  };
  rows.sort(sorters[ui.sumSort] || sorters.no);
  const tot = rows.map(x => x.res.total).filter(x => x !== null);
  const avg = tot.length ? round1(tot.reduce((a, b) => a + b, 0) / tot.length) : null;
  const dist = {}; GRADE_SCALE.forEach(([, g]) => { dist[g] = 0; });
  dist["ร"] = 0; dist["มส"] = 0;
  rows.forEach(x => { if (x.res.special) dist[x.res.special]++; else if (x.res.total !== null) dist[x.res.grade]++; });
  return `
    <div class="card">
      <div class="section-head"><h2>🏆 การกระจายเกรด • ${esc(cls(ui.classId)?.name || "")} • ${esc(courseLabel(co))}</h2><div class="toolbar noprint"><button class="btn green" onclick="exportCSV()">⬇️ Excel</button><button class="btn gray" onclick="window.print()">🖨️ พิมพ์</button></div></div>
      <div class="printhead">${logoHTML()}<div><b>${esc(db.school)}</b><div class="small">สรุปผลการเรียน ${esc(courseLabel(co))} • ${esc(cls(ui.classId)?.name || "")} • ${esc(db.teacher)} • ${fmtDate(todayStr())}</div></div></div>
      <div class="gradechips">${GRADE_SCALE.map(([min, g]) => `<div class="gchip"><div class="g">${g}</div><div class="muted small">${min}%+</div><b>${dist[g]} คน</b></div>`).join("")}${isThai(co) ? `<div class="gchip sp"><div class="g">ร</div><div class="muted small">ขาดสอบ</div><b>${dist["ร"]} คน</b></div><div class="gchip sp"><div class="g">มส</div><div class="muted small">เวลาเรียน &lt; ${db.settings.attendanceMin}%</div><b>${dist["มส"]} คน</b></div>` : ""}</div>
      <p class="muted small">วิธีรวม: ${isThai(co) ? `แบบโรงเรียน — คะแนนเก็บคิดเป็น ${co.scheme.collect}${co.scheme.mid ? ` + กลางภาค ${co.scheme.mid}` : ""} + ปลายภาค ${co.scheme.final} = ${co.scheme.collect + co.scheme.mid + co.scheme.final} (งานค้างนับ 0 • งานที่ยังไม่ถึงกำหนดยังไม่นับ)` : `${st.totalMode === "weighted" ? "เฉลี่ย % ถ่วงน้ำหนัก" : "รวมคะแนนดิบ ÷ คะแนนเต็มรวม"} • ${st.missingAsZero ? "งานค้างนับเป็น 0" : "นับเฉพาะงานที่มีคะแนนแล้ว"}`} • จิตพิสัย ${w ? `คิดเป็น ${w}% ของคะแนนรวม` : "แยกต่างหาก ไม่รวมในเกรด"} (เปลี่ยนได้ที่ ⚙️ ตั้งค่า / แก้ไขรายวิชา)</p>
    </div>
    <div class="section card">
      ${searchRow(`<label class="inline muted small">เรียงตาม <select class="input" onchange="ui.sumSort=this.value;reportPage()">${[["no", "เลขที่"], ["high", "คะแนนมาก → น้อย"], ["low", "คะแนนน้อย → มาก"], ["pending", "งานค้างมากสุด"], ["beh", "จิตพิสัยน้อยสุด"]].map(([k, t]) => `<option value="${k}" ${ui.sumSort === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        ${avg !== null ? `<span class="pill leave">เฉลี่ยห้อง ${avg}% • ต่ำสุด ${Math.min(...tot)}% • สูงสุด ${Math.max(...tot)}%</span>` : ""}`)}
      ${r.length ? `<div class="gridwrap"><table class="gbook sumtable"><thead><tr><th class="stick c1">เลขที่</th><th class="stick c2">ชื่อ-สกุล</th>${items.map(i => `<th class="ihead" title="${esc(i.title)}"><div class="ititle">${isThai(co) && partOf(i) !== "collect" ? PARTS[partOf(i)].icon + " " : ""}${esc(i.title)}</div><div class="muted small">/${fmtNum(i.max)}</div></th>`).join("")}${totHeads(co)}<th class="tot">มาเรียน</th><th class="tot">หนี</th></tr></thead><tbody>
      ${rows.map(({ s, res, att }) => `<tr data-q="${rowQ(s)} ${s.sid}"><td class="stick c1">${s.no}</td><td class="stick c2"><button class="linkbtn plain namebtn" onclick="studentDash(${s.id},true)">${esc(s.name)}</button></td>${items.map(i => {
        const x = markInfo(getMark(s.id, i.id), i);
        if (x.net === null) return x.status === "missing" ? `<td class="cell missing">ค้าง</td>` : x.status === "waiting" ? `<td class="cell waiting small">รอตรวจ</td>` : `<td class="cell muted">—</td>`;
        return `<td class="cell ${x.calc?.rate ? "late" : ""}">${fmtNum(x.net)}${x.calc?.rate ? `<sup title="หักส่งช้า ${x.calc.rate}%">*</sup>` : ""}</td>`;
      }).join("")}${resultTotCells(res, co)}<td class="tot ${att.rate !== null && att.rate < db.settings.attendanceMin ? "danger" : ""}">${att.rate !== null ? att.rate + "%" : "—"}</td><td class="tot">${att.skip ? `<b class="danger">${att.skip}</b>` : "0"}</td></tr>`).join("")}
    </tbody></table></div><p class="muted small">📌 = งานมีกำหนดส่ง • 📊 = กิจกรรม/สอบในห้อง • * = ถูกหักคะแนนส่งช้า • คลิกชื่อเพื่อดูรายงานนักเรียน</p>` : `<div class="empty">ยังไม่มีนักเรียนในห้องนี้</div>`}</div>`;
}

/* ---------- งานค้างทั้งห้อง — พิมพ์ติดบอร์ด / คัดลอกส่ง LINE ---------- */
function missingView() {
  const r = roster(), items = courseItems(), co = curCourse(), c = cls(ui.classId);
  const view = ui.missView || "student";
  const rows = r.map(s => ({ s, res: studentResult(s.id) })).filter(x => x.res.pending);
  const byItem = items.map(it => ({ it, who: r.filter(s => markInfo(getMark(s.id, it.id), it).status === "missing") })).filter(x => x.who.length);
  const total = rows.reduce((a, x) => a + x.res.pending, 0);
  return `
    <div class="card">
      <div class="section-head"><div><h2>📋 งานค้าง • ${esc(c?.name || "")} • ${esc(courseLabel(co))}</h2><div class="muted small">ข้อมูล ณ ${fmtDate(todayStr())} • ค้างรวม ${total} งาน จากนักเรียน ${rows.length}/${r.length} คน</div></div>
        <div class="toolbar"><div class="seg tabs"><button class="${view === "student" ? "on p" : ""}" onclick="ui.missView='student';reportPage()">รายนักเรียน</button><button class="${view === "item" ? "on p" : ""}" onclick="ui.missView='item';reportPage()">รายชิ้นงาน</button></div>
          <button class="btn green" onclick="copyMissingText()">📋 คัดลอกข้อความ (ส่ง LINE)</button><button class="btn gray" onclick="window.print()">🖨️ พิมพ์</button></div></div>
      <div class="note noprint">นับเป็น “ค้าง” เมื่อ <b>ช่องคะแนนว่าง</b> และยังไม่ได้ทำเครื่องหมายว่าส่งแล้ว — งานที่มีกำหนดส่งจะนับเมื่อเลยกำหนดแล้วเท่านั้น</div>
      <div class="printhead">${logoHTML()}<div><b>${esc(db.school)}</b><div class="small">รายงานงานค้าง ${esc(courseLabel(co))} • ${esc(c?.name || "")} • ${esc(db.teacher)} • ${fmtDate(todayStr())}</div></div></div>
      ${view === "student"
        ? (rows.length ? searchRow() + rows.map(({ s, res }) => `<div class="missrow" data-q="${rowQ(s)}"><div class="misshead"><b>${s.no}. ${esc(s.name)}</b> <span class="pill a">ค้าง ${res.pending} งาน</span></div>
            <ol class="misslist">${res.missing.map(it => missItemHTML(it)).join("")}</ol></div>`).join("") : `<div class="empty">🎉 ไม่มีงานค้างในห้องนี้</div>`)
        : (byItem.length ? byItem.map(({ it, who }) => `<div class="missrow"><div class="misshead"><b>${esc(it.title)}</b> <span class="pill a">ค้าง ${who.length}/${r.length} คน</span> <span class="muted small">${it.due ? "กำหนดส่ง " + fmtDate(it.due) : "กิจกรรมในห้อง"} • เต็ม ${it.max}</span></div>
            ${it.detail ? `<div class="detailbox">${escBr(it.detail)}</div>` : ""}<div class="namechips">${who.map(s => `<span class="namechip">${s.no}. ${esc(s.name)}</span>`).join("")}</div></div>`).join("") : `<div class="empty">🎉 ไม่มีงานค้างในห้องนี้</div>`)}
    </div>`;
}

/* ---------- ศูนย์รวมการส่งออกไฟล์ ---------- */
function exportView() {
  const c = cls(ui.classId), co = curCourse();
  const card = (icon, title, desc, btn, fn) => `<div class="expcard"><div class="ei">${icon}</div><div class="grow"><b>${title}</b><div class="muted small">${desc}</div></div><button class="btn ${fn === "exportJSON()" ? "green" : ""}" onclick="${fn}">${btn}</button></div>`;
  return `<div class="card">
    <div class="section-head"><div><h2>⬇️ ส่งออกไฟล์ • ${esc(c?.name || "")} • ${esc(courseLabel(co))}</h2><div class="muted small">ไฟล์ .csv เปิดด้วย Excel / Google Sheets ได้ ภาษาไทยไม่เพี้ยน</div></div></div>
    <div class="explist">
      ${isThai(co) ? card("📄", "แบบบันทึกคะแนน (.xlsx)", "รูปแบบเดียวกับแบบฟอร์มของโรงเรียน มีสูตรรวมคะแนนเก็บ / คิดเป็น / รวม / เกรด", "⬇️ Excel", "exportSheetXLSX()") : ""}
      ${card("📊", "คะแนนทุกงาน + คะแนนรวม + เกรด", "หนึ่งแถวต่อนักเรียน รวมจิตพิสัย การมาเรียน และจำนวนงานค้าง", "⬇️ CSV", "exportCSV()")}
      ${card("✅", "บันทึกเวลาเรียน", "ทุกวันที่เช็กชื่อ (ม/ส/ล/ข/น) พร้อมสรุปและร้อยละ", "⬇️ CSV", "exportAttCSV()")}
      ${card("⭐", "คะแนนจิตพิสัย", "จำนวนครั้งแต่ละพฤติกรรม คะแนนที่ถูกหัก และร้อยละ", "⬇️ CSV", "exportBehCSV()")}
      ${card("📋", "ข้อความงานค้าง", "สำหรับวางใน LINE กลุ่มห้อง", "📋 คัดลอก", "copyMissingText()")}
      ${card("💾", "สำรองข้อมูลทั้งหมด (ทุกวิชา ทุกห้อง)", `ไฟล์ .json สำหรับกู้คืน/ย้ายเครื่อง • สำรองล่าสุด ${db.lastBackup ? fmtDate(db.lastBackup) : "ยังไม่เคย"}`, "⬇️ สำรอง", "exportJSON()")}
    </div></div>`;
}

function missItemHTML(it, today = todayStr()) {
  const late = it.due ? Math.max(0, dayDiff(it.due, today)) : 0;
  return `<li><b>${esc(it.title)}</b> <span class="muted small">(เต็ม ${it.max})</span>
    <div class="small muted">${it.due ? `กำหนดส่ง ${fmtDate(it.due)}${late ? ` • <span class="danger">เลยกำหนด ${late} วัน</span>` : ""}` : "กิจกรรม/สอบในห้อง"}${it.channel ? ` • ส่งทาง ${esc(it.channel)}` : ""}</div>
    ${it.detail ? `<div class="detailbox small">${escBr(it.detail)}</div>` : ""}</li>`;
}

function copyMissingText() {
  const r = roster(), co = curCourse(), c = cls(ui.classId);
  const lines = [`📋 งานค้าง ${courseLabel(co)} ${c?.name || ""} (ข้อมูล ณ ${fmtDate(todayStr())})`, ""];
  let n = 0;
  r.forEach(s => {
    const res = studentResult(s.id);
    if (!res.pending) return;
    n++;
    lines.push(`${s.no}. ${s.name} — ค้าง ${res.pending} งาน`);
    res.missing.forEach(it => lines.push(`   • ${it.title}${it.due ? ` (ส่ง ${fmtDate(it.due)})` : ""}${it.channel ? ` ส่งทาง ${it.channel}` : ""}`));
  });
  if (!n) lines.push("🎉 ไม่มีงานค้าง");
  else lines.push("", "ตรวจสอบรายละเอียดงานได้ที่ Student Mode (รหัสห้อง + เลขที่)");
  const text = lines.join("\n");
  const done = () => toast("คัดลอกแล้ว — วางใน LINE ได้เลย");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => showCopyBox(text));
  else showCopyBox(text);
}
function showCopyBox(text) {
  modal("คัดลอกข้อความ", `<textarea class="input" rows="14" style="width:100%" readonly onfocus="this.select()">${esc(text)}</textarea><p class="muted small">กดค้างที่ข้อความ → เลือกทั้งหมด → คัดลอก</p>`, null);
}

/* ---------- ส่งออก CSV ---------- */
function toCSV(rows) {
  const cell = v => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t) && isNaN(+t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
  return "﻿" + rows.map(r => r.map(cell).join(",")).join("\r\n");
}
const fileSafe = c => String(c?.code || "").replace(/[^A-Za-z0-9_-]/g, "") || ("room" + String(c?.name || "").replace(/\D+/g, "-").replace(/^-|-$/g, "")) || "class";

function exportCSV() {
  const r = roster(), items = courseItems(), c = cls(ui.classId), co = curCourse();
  const thai = isThai(co), sc = co.scheme;
  const head = ["เลขที่", "ชื่อ-สกุล", ...items.map(i => `${i.title} (${i.max})`),
    ...(thai ? ["คะแนนเก็บ (ดิบ)", `คิดเป็น (${sc.collect})`, ...(sc.mid ? [`กลางภาค (${sc.mid})`] : []), ...(sc.final ? [`ปลายภาค (${sc.final})`] : []), `รวม (${sc.collect + sc.mid + sc.final})`] : ["คะแนนงาน %"]),
    `จิตพิสัย (${db.settings.behaviorFull})`, "จิตพิสัย %", "รวม %", "เกรด", "งานค้าง", "มาเรียน %", "หนีเรียน"];
  const rows = r.map(s => {
    const res = studentResult(s.id), att = attSummary(s.id);
    return [s.no, s.name, ...items.map(i => { const x = markInfo(getMark(s.id, i.id), i); return x.net === null ? (x.status === "missing" ? "ค้าง" : "") : round2(x.net); }),
      ...(thai ? [round2(res.parts.collect.got), res.parts.collect.pts ?? "", ...(sc.mid ? [res.parts.mid.pts ?? ""] : []), ...(sc.final ? [res.parts.final.pts ?? ""] : []), res.points] : [res.academic ?? ""]),
      res.beh.score, res.beh.pct, res.total ?? "", res.gradeLabel === "—" ? "" : res.gradeLabel, res.pending, att.rate ?? "", att.skip];
  });
  download(stampName(`scores_${fileSafe(c)}`, "csv"), toCSV([[`${courseLabel(co)} • ${c?.name || ""}`], head, ...rows]), "text/csv;charset=utf-8");
  toast("ส่งออกไฟล์ CSV แล้ว (เปิดด้วย Excel ได้)");
}

function exportAttCSV() {
  const r = roster(), c = cls(ui.classId), ids = new Set(r.map(s => s.id));
  const dates = [...new Set(db.attendance.filter(x => ids.has(x.studentId) && x.courseId === ui.courseId).map(x => x.date))].sort();
  if (!dates.length) return toast("ห้องนี้ยังไม่มีข้อมูลเช็กชื่อในวิชานี้");
  const head = ["เลขที่", "ชื่อ-สกุล", ...dates, "มา", "สาย", "ลา", "ขาด", "หนีเรียน", "มาเรียน %"];
  const rows = r.map(s => {
    const a = attSummary(s.id);
    return [s.no, s.name, ...dates.map(d => ATT[attOf(s.id, d)?.status]?.short || ""), a.present, a.late, a.leave, a.absent, a.skip, a.rate ?? ""];
  });
  download(stampName(`attendance_${fileSafe(c)}`, "csv"), toCSV([[courseLabel(curCourse()) + " • " + (c?.name || "")], head, ...rows, [], ["ม = มา, ส = สาย, ล = ลา, ข = ขาด (ไม่แจ้งลา), น = หนีเรียน (มาโรงเรียนแต่ไม่เข้าเรียน)"]]), "text/csv;charset=utf-8");
  toast(`ส่งออกการเช็กชื่อ ${dates.length} วันแล้ว`);
}

function exportBehCSV() {
  const r = roster(), c = cls(ui.classId), types = db.settings.behaviorTypes;
  const head = ["เลขที่", "ชื่อ-สกุล", ...types.map(t => `${t.label} (ครั้ง)`), "หักรวม", `จิตพิสัย (${db.settings.behaviorFull})`, "ร้อยละ"];
  const rows = r.map(s => {
    const b = behaviorResult(s.id, ui.courseId);
    return [s.no, s.name, ...types.map(t => b.list.filter(x => x.type === t.id).length), round2(b.full - b.score), b.score, b.pct];
  });
  download(stampName(`behavior_${fileSafe(c)}`, "csv"), toCSV([[courseLabel(curCourse()) + " • " + (c?.name || "")], head, ...rows]), "text/csv;charset=utf-8");
  toast("ส่งออกคะแนนจิตพิสัยแล้ว");
}

/* =============================================================
   แบบบันทึกคะแนน (รูปแบบเดียวกับแบบฟอร์มของโรงเรียน)
   เลขที่ | ชื่อ | คะแนนเก็บ 1..n | รวมเก็บ | คิดเป็น | กลางภาค | ปลายภาค | รวม | เกรด
   ============================================================= */
function sheetModel() {
  const co = curCourse(), c = cls(ui.classId), items = courseItems(), sc = co.scheme;
  const collect = items.filter(i => partOf(i) === "collect");
  const rawMax = collect.reduce((a, i) => a + i.max, 0);
  const lv = level(c?.levelId);
  const title = `แบบบันทึกคะแนน รายวิชา ${co.group || ""} (${co.name}${c ? " " + c.name : ""}) รหัสวิชา ${co.code || "-"}`.replace(/\s+/g, " ");
  const sub = `${db.school} ชั้น${levelFull(lv?.name || "")} ภาคเรียนที่ ${db.term.semester} ปีการศึกษา ${db.term.year}`;
  return { co, c, items, sc, collect, rawMax, title, sub, thai: isThai(co) };
}

function sheetView() {
  const M = sheetModel(), r = roster(), { co, sc, collect } = M;
  if (!M.thai) return `<div class="card empty">แบบบันทึกคะแนนใช้กับรายวิชาที่ตั้งโครงสร้างคะแนน “แบบโรงเรียน”<br><br><button class="btn primary" onclick="editCourse('${co.id}')">ตั้งค่าโครงสร้างคะแนนของวิชานี้</button></div>`;
  const parts = PART_ORDER.filter(p => p !== "collect" && sc[p]);
  return `<div class="card">
    <div class="section-head noprint"><div><h2>📄 แบบบันทึกคะแนน</h2><div class="muted small">รูปแบบเดียวกับแบบฟอร์มของโรงเรียน • พิมพ์ A4 แนวนอน • ไฟล์ Excel มีสูตรคำนวณ แก้ต่อใน Excel / Google Sheets ได้</div></div>
      <div class="toolbar"><button class="btn green" onclick="exportSheetXLSX()">⬇️ Excel (.xlsx)</button><button class="btn gray" onclick="window.print()">🖨️ พิมพ์</button></div></div>
    <div class="offhead"><b>${esc(M.title)}</b><b>${esc(M.sub)}</b></div>
    <div class="gridwrap"><table class="offsheet">
      <thead>
        <tr><th rowspan="4" class="o-no">เลขที่</th><th rowspan="4" class="o-name">ชื่อ - นามสกุล</th>
          ${collect.length ? `<th colspan="${collect.length}" class="o-grp">คะแนนเก็บ</th>` : ""}
          <th rowspan="3" class="o-sum">คะแนน<br>เก็บ</th><th rowspan="3" class="o-sum">คิดเป็น<br>(คะแนน)</th>
          ${parts.map(p => `<th rowspan="3" class="o-sum">${PARTS[p].short}</th>`).join("")}
          <th rowspan="3" class="o-tot">รวม</th><th rowspan="4" class="o-grade">เกรด</th></tr>
        <tr>${collect.map(i => `<th>${i.order}</th>`).join("")}</tr>
        <tr>${collect.map(() => `<th class="o-full">เต็ม</th>`).join("")}</tr>
        <tr>${collect.map(i => `<th class="o-max">${fmtNum(i.max)}</th>`).join("")}<th class="o-max">${fmtNum(M.rawMax)}</th><th class="o-max">${sc.collect}</th>${parts.map(p => `<th class="o-max">${sc[p]}</th>`).join("")}<th class="o-max">${sc.collect + sc.mid + sc.final}</th></tr>
        <tr class="o-titles"><th></th><th></th>${collect.map(i => `<th><div class="vtext" title="${esc(i.title)}">${esc(i.title)}</div></th>`).join("")}<th></th><th></th>${parts.map(p => `<th><div class="vtext">${esc(courseItems().filter(i => partOf(i) === p).map(i => i.title).join(", ") || PARTS[p].label)}</div></th>`).join("")}<th></th><th></th></tr>
      </thead>
      <tbody>${r.map(s => {
        const res = studentResult(s.id), low = res.special || (res.total !== null && res.total < 50);
        return `<tr><td class="o-no ${low ? "o-low" : ""}">${s.no}</td><td class="o-name ${low ? "o-low" : ""}">${esc(s.name)}</td>
          ${collect.map(i => { const x = markInfo(getMark(s.id, i.id), i); return `<td class="${x.net === null ? (x.status === "pending" ? "" : "o-miss") : ""}">${x.net === null ? "" : fmtNum(x.net)}</td>`; }).join("")}
          <td class="${low ? "o-redtxt" : ""}">${fmtNum(res.parts.collect.got)}</td><td class="${low ? "o-redtxt" : ""}"><b>${res.parts.collect.pts ?? ""}</b></td>
          ${parts.map(p => `<td class="o-part ${res.parts[p].n && res.parts[p].missing ? "o-miss" : ""}">${res.parts[p].n && !res.parts[p].missing ? fmtNum(res.parts[p].pts) : ""}</td>`).join("")}
          <td class="o-tot ${bandCls(res.total)}"><b>${fmtNum(res.points)}</b></td><td><b>${res.gradeLabel}</b></td></tr>`;
      }).join("")}</tbody>
    </table></div>
    <p class="muted small noprint">ช่องสีชมพู = ยังไม่มีคะแนน (ค้างส่ง) • ชื่อสีแดง = คะแนนรวมต่ำกว่า 50% หรือ ร/มส • สีช่องรวม: <span class="band-f lgx">&lt;50</span> <span class="band-c lgx">50–69</span> <span class="band-b lgx">70–79</span> <span class="band-a lgx">≥80</span> (คิดจากร้อยละ)</p>
  </div>`;
}

/** ส่งออก .xlsx ตามแบบฟอร์ม พร้อมสูตร SUM / ROUND / เกรด ให้แก้ต่อใน Excel ได้ */
async function exportSheetXLSX() {
  try { await loadScript("lib/xlsx.full.min.js"); } catch (e) { return toast("โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ"); }
  const M = sheetModel(), r = roster(), { sc, collect } = M;
  const parts = PART_ORDER.filter(p => p !== "collect" && sc[p]);
  const A = XLSX.utils.encode_cell, col = XLSX.utils.encode_col;
  const n = collect.length, cRaw = 2 + n, cScaled = cRaw + 1, cParts = parts.map((_, i) => cScaled + 1 + i), cTot = cScaled + 1 + parts.length, cGrade = cTot + 1;
  const last = cGrade, ws = {}, set = (rr, cc, v, f) => { const cell = typeof v === "number" ? { t: "n", v } : { t: "s", v: String(v ?? "") }; if (f) cell.f = f; ws[A({ r: rr, c: cc })] = cell; };
  set(0, 0, M.title); set(1, 0, M.sub);
  // หัวตาราง (แถว 4–8 ใน Excel = index 3–7)
  set(3, 0, "เลขที่"); set(3, 1, "ชื่อ - นามสกุล");
  if (n) set(3, 2, "คะแนนเก็บ");
  set(3, cRaw, "คะแนนเก็บ"); set(3, cScaled, "คิดเป็น (คะแนน)"); parts.forEach((p, i) => set(3, cParts[i], PARTS[p].short)); set(3, cTot, "รวม"); set(3, cGrade, "เกรด");
  collect.forEach((it, i) => { set(4, 2 + i, it.order); set(5, 2 + i, "เต็ม"); set(6, 2 + i, it.max); set(7, 2 + i, it.title); });
  set(5, cRaw, "เต็ม"); set(5, cScaled, "เต็ม"); parts.forEach((p, i) => set(5, cParts[i], "เต็ม")); set(5, cTot, "เต็ม");
  const rawMaxRef = `$${col(cRaw)}$7`, totMaxRef = `$${col(cTot)}$7`;
  set(6, cRaw, M.rawMax, n ? `SUM(${col(2)}7:${col(1 + n)}7)` : null); set(6, cScaled, sc.collect);
  parts.forEach((p, i) => set(6, cParts[i], sc[p]));
  set(6, cTot, sc.collect + sc.mid + sc.final, `${col(cScaled)}7${parts.map((_, i) => "+" + col(cParts[i]) + "7").join("")}`);
  parts.forEach((p, i) => set(7, cParts[i], courseItems().filter(x => partOf(x) === p).map(x => x.title).join(", ")));
  // เกรด: สูตรเดียวกับระบบ (ร้อยละของคะแนนรวม)
  const gradeF = ref => GRADE_SCALE.slice(0, -1).reduceRight((acc, [min, g]) => `IF(${ref}>=${min},${g},${acc})`, "0");
  r.forEach((s, k) => {
    const rr = 8 + k, xr = rr + 1, res = studentResult(s.id);
    set(rr, 0, s.no); set(rr, 1, s.name);
    collect.forEach((it, i) => { const x = markInfo(getMark(s.id, it.id), it); if (x.net !== null) set(rr, 2 + i, round2(x.net)); });
    set(rr, cRaw, round2(res.parts.collect.got), n ? `SUM(${col(2)}${xr}:${col(1 + n)}${xr})` : null);
    set(rr, cScaled, res.parts.collect.pts ?? 0, `IF(${rawMaxRef}=0,0,ROUND(${col(cRaw)}${xr}/${rawMaxRef}*${col(cScaled)}$7,0))`);
    parts.forEach((p, i) => { const P = res.parts[p]; if (P.n) set(rr, cParts[i], P.missing ? 0 : round2(P.pts)); });
    set(rr, cTot, round2(res.points), `${col(cScaled)}${xr}${parts.map((_, i) => "+" + col(cParts[i]) + xr).join("")}`);
    if (res.special) set(rr, cGrade, res.special);
    else set(rr, cGrade, res.total === null ? 0 : +res.grade, gradeF(`${col(cTot)}${xr}/${totMaxRef}*100`));
  });
  const lastRow = 8 + r.length - 1;
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(lastRow, 7), c: last } });
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: last } }, { s: { r: 1, c: 0 }, e: { r: 1, c: last } },
    { s: { r: 3, c: 0 }, e: { r: 7, c: 0 } }, { s: { r: 3, c: 1 }, e: { r: 7, c: 1 } },
    ...(n > 1 ? [{ s: { r: 3, c: 2 }, e: { r: 3, c: 1 + n } }] : []),
    { s: { r: 3, c: cGrade }, e: { r: 7, c: cGrade } }
  ];
  ws["!cols"] = [{ wch: 6 }, { wch: 28 }, ...collect.map(() => ({ wch: 6 })), { wch: 9 }, { wch: 10 }, ...parts.map(() => ({ wch: 9 })), { wch: 8 }, { wch: 6 }];
  ws["!rows"] = [{ hpt: 22 }, { hpt: 22 }, {}, {}, {}, {}, {}, { hpt: 90 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (M.c?.name || "คะแนน").replace(/[\\/?*[\]:]/g, "-").slice(0, 31));
  XLSX.writeFile(wb, stampName(`scoresheet_${fileSafe(M.c)}_term${db.term.semester}-${db.term.year}`, "xlsx"));
  toast("ส่งออกแบบบันทึกคะแนน (.xlsx) แล้ว — มีสูตรคำนวณในไฟล์");
}
