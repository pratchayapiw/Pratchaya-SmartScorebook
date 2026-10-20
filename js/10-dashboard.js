"use strict";
/* =============================================================
   หน้า: ภาพรวม
   ลำดับบนจอ: ทักทาย → ทางลัดงานประจำวัน → รายการตั้งค่า (ถ้ายังไม่ครบ)
              → ตัวเลขสำคัญ → การแจ้งเตือน → ต้องติดตาม / งานล่าสุด
   ============================================================= */

/** รายการตั้งค่าเริ่มต้น — แสดงจนกว่าจะครบ */
function setupSteps() {
  const r = roster();
  return [
    { done: db.courses.some(c => c.classIds.length), t: "สร้างรายวิชาและเลือกห้องที่สอน", go: "teacher('students')" },
    { done: r.length > 0, t: "นำเข้ารายชื่อนักเรียน (Excel / PDF / ข้อความ)", go: "ui.manageClassId=ui.classId;teacher('students')" },
    { done: r.length > 0 && r.every(s => s.sid), t: "ใส่รหัสนักเรียน 5 หลักให้ครบ (ใช้เข้าระบบนักเรียน)", go: "ui.manageClassId=ui.classId;teacher('students')" },
    { done: courseItems().length > 0, t: "สร้างงาน/กิจกรรมแรก", go: "teacher('work');setTimeout(editItem,50)" },
    { done: sessionDates().length > 0, t: "เช็กชื่อครั้งแรก", go: "ui.attView='day';teacher('attend')" },
    { done: !!db.lastBackup, t: "สำรองข้อมูลเป็นไฟล์", go: "exportJSON()" }
  ];
}

/** การแจ้งเตือนที่ต้องจัดการ (แสดงเป็นรายการเดียว ไม่ซ้อนหลายกล่อง) */
function dashAlerts() {
  const out = [], r = roster();
  const reqs = openRequests().length;
  if (reqs) out.push({ icon: "📨", t: `คำร้องขอแก้ไขการเช็กชื่อ ${reqs} รายการ`, act: "ตรวจสอบ", go: "ui.attView='req';teacher('attend')" });
  const noSid = r.filter(s => !s.sid).length;
  if (noSid && r.length) out.push({ icon: "🆔", t: `นักเรียน ${noSid} คนยังไม่มีรหัสนักเรียน`, act: "เพิ่มรหัส", go: "ui.manageClassId=ui.classId;teacher('students')" });
  const days = db.lastBackup ? dayDiff(db.lastBackup, todayStr()) : null;
  if (days === null || days >= 14) out.push({ icon: "💾", t: days === null ? "ยังไม่เคยสำรองข้อมูล (ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น)" : `ไม่ได้สำรองข้อมูลมา ${days} วัน`, act: "สำรองตอนนี้", go: "exportJSON()" });
  return out;
}

function dashPage() {
  const setup = needSetup();
  if (setup) return shell("ภาพรวม", setup, "dash");
  const r = roster(), t = todayStr(), co = curCourse(), c = cls(ui.classId);
  const res = r.map(s => ({ s, res: studentResult(s.id), ins: attInsight(s.id) }));
  const scored = res.filter(x => x.res.total !== null);
  const avg = scored.length ? round1(scored.reduce((a, x) => a + x.res.total, 0) / scored.length) : null;
  const missing = res.reduce((a, x) => a + x.res.pending, 0);
  const missingPeople = res.filter(x => x.res.pending).length;
  const att = r.map(s => attOf(s.id, t)).filter(Boolean);
  const here = att.filter(x => x.status === "present" || x.status === "late").length;
  const behAvg = r.length ? round1(res.reduce((a, x) => a + x.res.beh.pct, 0) / r.length) : null;
  const watch = res
    .map(x => ({ ...x, why: [x.res.pending ? `ค้าง ${x.res.pending} งาน` : "", x.res.total !== null && x.res.total < 50 ? `คะแนน ${x.res.total}%` : "", x.ins.level >= 2 ? x.ins.flags.sort((a, b) => b.lv - a.lv)[0].t : "", x.res.beh.pct < 80 ? `จิตพิสัย ${fmtNum(x.res.beh.score)}` : ""].filter(Boolean) }))
    .filter(x => x.why.length)
    .sort((a, b) => b.why.length - a.why.length || b.res.pending - a.res.pending);
  const items = courseItems();
  const recent = [...items.filter(a => a.due && a.due >= t), ...items.filter(a => !a.due || a.due < t).reverse()].slice(0, 5);
  const steps = setupSteps(), stepsLeft = steps.filter(x => !x.done).length;
  // เหลือแค่ขั้น "สำรองข้อมูล" → ไม่ต้องแสดงการ์ด (มีในรายการแจ้งเตือนแล้ว)
  const showSetup = stepsLeft > 1 || (stepsLeft === 1 && steps[steps.length - 1].done);
  const alerts = dashAlerts();
  const hour = new Date().getHours();

  shell("ภาพรวม", `
    <div class="greet"><div><b>${hour < 12 ? "สวัสดีตอนเช้า" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น"} ${esc(db.teacher)}</b> <span class="muted">• ${new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div>
      <div class="muted small">กำลังดู ${esc(c?.name || "")} • ${esc(courseLabel(co))}</div></div>

    <div class="quick">
      <button class="qbtn ${att.length === r.length && r.length ? "done" : ""}" onclick="ui.attView='day';ui.attDate=todayStr();teacher('attend')"><span class="qi">${ico("attend")}</span><b>เช็กชื่อวันนี้</b><span class="small">${att.length ? (att.length === r.length ? `ครบแล้ว • มา ${here}/${r.length}` : `เช็กแล้ว ${att.length}/${r.length}`) : "ยังไม่ได้เช็ก"}</span></button>
      <button class="qbtn" onclick="ui.workView='grid';teacher('work')"><span class="qi">${ico("scorebook")}</span><b>กรอกคะแนน</b><span class="small">${items.length} งาน/กิจกรรม</span></button>
      <button class="qbtn" onclick="teacher('behavior')"><span class="qi">${ico("behavior")}</span><b>บันทึกพฤติกรรม</b><span class="small">จิตพิสัยเฉลี่ย ${behAvg ?? "—"}%</span></button>
      <button class="qbtn ${missing ? "warn" : ""}" onclick="teacher('missing')"><span class="qi">${ico("missing")}</span><b>งานค้าง</b><span class="small">${missing ? `${missingPeople} คน • ${missing} งาน` : "ไม่มี 🎉"}</span></button>
    </div>

    ${showSetup ? `<div class="section card setup"><div class="section-head"><h2>🚀 เริ่มต้นใช้งาน <span class="muted small">(${steps.length - stepsLeft}/${steps.length})</span></h2></div>
      <div class="progress" style="margin-bottom:10px"><span style="width:${(steps.length - stepsLeft) / steps.length * 100}%"></span></div>
      ${steps.map(s => `<div class="step ${s.done ? "done" : ""}"><span class="sc">${s.done ? "✓" : ""}</span><span>${s.t}</span>${s.done ? "" : `<button class="btn small" onclick="${s.go}">ทำเลย →</button>`}</div>`).join("")}</div>` : ""}

    <div class="section grid">
      ${stat("นักเรียน", r.length, `${esc(c?.name || "")} • วิชานี้สอน ${courseClasses().length} ห้อง`)}
      ${stat("คะแนนเฉลี่ยห้อง", avg !== null ? avg + "%" : "—", avg !== null ? "ประมาณเกรด " + gradeOf(avg) : "ยังไม่มีคะแนน")}
      ${stat("งานค้างรวม", missing, missing ? `จากนักเรียน ${missingPeople} คน` : "ส่งครบทุกคน", missing ? "danger" : "")}
      ${stat("มาเรียนวันนี้", att.length ? `${here}/${r.length}` : "—", att.length ? `เช็กแล้ว ${att.length} คน` : "ยังไม่ได้เช็กชื่อ")}
    </div>

    ${alerts.length ? `<div class="section alerts">${alerts.map(a => `<div class="alert"><span>${a.icon}</span><span class="grow">${a.t}</span><button class="btn small" onclick="${a.go}">${a.act}</button></div>`).join("")}</div>` : ""}

    <div class="section two">
      <div class="card">
        <div class="section-head"><h2>🚩 ต้องติดตาม <span class="muted small">(${watch.length} คน)</span></h2>${watch.length > 6 ? `<button class="btn small gray" onclick="teacher('missing')">ดูทั้งหมด</button>` : ""}</div>
        ${watch.length ? watch.slice(0, 6).map(x => `<div class="listrow clickable" onclick="studentDash(${x.s.id},true)"><div><b>${x.s.no}. ${esc(x.s.name)}</b><div class="tags">${x.why.map(w => `<span class="tag">${esc(w)}</span>`).join("")}</div></div><span class="chev">›</span></div>`).join("") : `<div class="empty">🎉 ไม่มีนักเรียนที่ต้องติดตาม</div>`}
      </div>
      <div class="card">
        <div class="section-head"><h2>📝 งานล่าสุด</h2><button class="btn small gray" onclick="ui.workView='grid';teacher('work')">ตารางคะแนน</button></div>
        ${recent.length ? recent.map(a => { const infos = r.map(s => markInfo(getMark(s.id, a.id), a)); const got = infos.filter(i => i.raw !== null || i.handed).length, miss = infos.filter(i => i.status === "missing").length; return `<div class="listrow clickable" onclick="ui.itemId=${a.id};ui.workView='item';teacher('work')"><div style="flex:1"><b>${esc(a.title)}</b><div class="muted small">${a.due ? (a.due >= t ? `ส่ง ${fmtDate(a.due)} • อีก ${dayDiff(t, a.due)} วัน` : `ครบกำหนด ${fmtDate(a.due)}`) : "กิจกรรม/สอบในห้อง"} • ส่งแล้ว ${got}/${r.length}${miss ? ` • <span class="danger">ค้าง ${miss}</span>` : ""}</div><div class="progress thin"><span style="width:${r.length ? got / r.length * 100 : 0}%"></span></div></div><span class="chev">›</span></div>`; }).join("") : `<div class="empty">ยังไม่มีงาน — <button class="linkbtn" onclick="teacher('work');setTimeout(editItem,50)">สร้างงานแรก</button></div>`}
      </div>
    </div>`, "dash");
}
