"use strict";
/* =============================================================
   โหมดนักเรียน
   เข้าระบบด้วยรหัส 5 หลัก + เลขที่ • ผลการเรียน • งานค้าง • การมาเรียน • คำร้องแก้ไข
   ============================================================= */

/* =============================================================
   โหมดนักเรียน — รายงานงานค้างพร้อมรายละเอียด
   ============================================================= */
function student() {
  closeModal(); ui.view = "student"; armIdle(false);
  $("app").innerHTML = `<div class="login"><div class="loginbox">
    <div class="homelogo">${logoHTML("big")}</div><div class="org">${esc(db.school)}</div><h1>🎧 Student Mode</h1>
    <p class="muted">กรอก <b>รหัสนักเรียน 5 หลัก</b> และ <b>เลขที่</b> ของตัวเอง</p>
    <div class="form" style="text-align:left">
      <label>รหัสนักเรียน<input class="input mono loginin" id="ssid" placeholder="00000" inputmode="numeric" maxlength="5" autocomplete="off" oninput="this.value=toArabic(this.value).replace(/\D/g,'').slice(0,5);loginHint()"></label>
      <label>เลขที่<input class="input loginin" id="sno" type="number" min="1" max="99" inputmode="numeric" oninput="loginHint()"></label>
    </div>
    <div id="loginMsg" class="loginmsg" role="alert" aria-live="polite"></div>
    <div class="toolbar" style="justify-content:center;margin-top:16px"><button class="btn gray" onclick="home()">กลับ</button><button class="btn primary" id="loginBtn" onclick="studentLogin()">ดูผลการเรียน</button></div>
  </div></div>`;
  $("ssid").focus();
  $("ssid").onkeydown = e => { if (e.key === "Enter") $("sno").focus(); };
  $("sno").onkeydown = e => { if (e.key === "Enter") studentLogin(); };
}

function loginMsg(t, field) {
  const el = $("loginMsg"); if (!el) return;
  el.innerHTML = t ? `⚠️ ${t}` : "";
  el.className = "loginmsg" + (t ? " show" : "");
  ["ssid", "sno"].forEach(id => $(id)?.classList.toggle("bad", id === field || field === "both"));
}
function loginHint() { loginMsg(""); }

/* กันเดารหัส: ผิด 5 ครั้งติดกัน พัก 30 วินาที */
const loginGuard = { fails: 0, until: 0 };
function studentLogin() {
  const now = Date.now();
  if (now < loginGuard.until) return loginMsg(`กรอกผิดหลายครั้ง กรุณารอ ${Math.ceil((loginGuard.until - now) / 1000)} วินาที`, "both");
  const sidIn = toArabic($("ssid").value).replace(/\D/g, ""), noRaw = $("sno").value.trim(), no = +noRaw;
  if (!sidIn) return loginMsg("กรุณากรอกรหัสนักเรียน", "ssid");
  if (!SID_RE.test(sidIn)) return loginMsg("รหัสนักเรียนต้องเป็นตัวเลข 5 หลัก", "ssid");
  if (!noRaw || !(no > 0)) return loginMsg("กรุณากรอกเลขที่", "sno");
  const s = db.students.find(x => x.sid === sidIn);
  const fail = (t, f) => {
    loginGuard.fails++;
    if (loginGuard.fails >= 5) { loginGuard.until = Date.now() + 30000; loginGuard.fails = 0; t += " — กรอกผิด 5 ครั้ง ระบบพัก 30 วินาที"; }
    loginMsg(t, f);
  };
  if (!s) return fail("รหัสนักเรียนไม่ถูกต้อง — ไม่พบรหัสนี้ในระบบ กรุณาตรวจสอบรหัสอีกครั้ง", "ssid");
  if (s.no !== no) return fail("เลขที่ไม่ตรงกับรหัสนักเรียน — กรุณาตรวจสอบเลขที่ (หรือรหัสนักเรียน) อีกครั้ง", "sno");
  loginGuard.fails = 0;
  ui.viewCourse = null;
  studentDash(s.id);
}

/* เครื่องใช้ร่วมกัน: ออกจากระบบเองเมื่อไม่มีการใช้งาน 90 วินาที */
let idleTimer = null;
function armIdle(on) {
  clearTimeout(idleTimer);
  if (on) idleTimer = setTimeout(() => { if (ui.view === "studentDash" && !ui.viewFromTeacher) { student(); toast("ออกจากระบบอัตโนมัติเพื่อความเป็นส่วนตัว"); } }, 90000);
}
["pointerdown", "keydown", "scroll"].forEach(ev => window.addEventListener(ev, () => { if (ui.view === "studentDash" && !ui.viewFromTeacher) armIdle(true); }, { passive: true }));

function studentDash(sid, fromTeacher = false) {
  const s = db.students.find(x => x.id === sid); if (!s) return;
  const c = cls(s.classId), st = db.settings;
  const myCourses = coursesOfClass(s.classId);
  let coId = ui.viewSid === sid && myCourses.some(x => x.id === ui.viewCourse) ? ui.viewCourse : null;
  if (!coId) coId = fromTeacher && myCourses.some(x => x.id === ui.courseId) ? ui.courseId : myCourses[0]?.id;
  ui.view = "studentDash"; ui.viewSid = sid; ui.viewFromTeacher = fromTeacher; ui.viewCourse = coId;
  const co = course(coId);
  const head = `<div class="printhead">${logoHTML()}<div><b>${esc(db.school)}</b><div class="small">รายงานผลการเรียน${co ? " " + esc(courseLabel(co)) : ""} • ${esc(db.teacher)} • พิมพ์วันที่ ${fmtDate(todayStr())}</div></div></div>
    <div class="top"><div><h1>🎧 ${esc(s.name)}</h1><div class="muted">${esc(c?.name || "")} • เลขที่ ${s.no}${fromTeacher ? " • (มุมมองนักเรียน)" : ""}</div></div>
      <div class="toolbar noprint">${fromTeacher ? `<button class="btn gray" onclick="window.print()">🖨️ พิมพ์รายงาน</button>` : ""}<button class="btn gray" onclick="${fromTeacher ? "teacher(ui.page)" : "student()"}">← ${fromTeacher ? "กลับ" : "ออกจากระบบ"}</button></div></div>
    ${myCourses.length > 1 ? `<div class="seg tabs noprint" style="margin-bottom:14px">${myCourses.map(x => `<button class="${x.id === coId ? "on p" : ""}" onclick="ui.viewCourse='${x.id}';studentDash(${sid},${fromTeacher})">${esc(courseLabel(x))}</button>`).join("")}</div>` : ""}`;

  if (!co) {
    $("app").innerHTML = `<div class="studentview">${head}<div class="card empty">ห้องนี้ยังไม่มีรายวิชา</div></div>`;
    armIdle(!fromTeacher); return;
  }

  const res = studentResult(sid, coId), att = attSummary(sid, coId), today = todayStr();
  const all = courseItems(coId).map(it => ({ it, i: markInfo(getMark(sid, it.id), it, today) }));
  const upcoming = all.filter(x => x.i.status === "pending");
  const waiting = all.filter(x => x.i.status === "waiting");
  const graded = all.filter(x => x.i.net !== null);
  const beh = res.beh;

  $("app").innerHTML = `<div class="studentview">${head}
    <div class="grid">
      ${isThai(co) ? stat("คะแนนเก็บ", res.parts.collect.pts !== null ? `${res.parts.collect.pts}/${co.scheme.collect}` : "—", PART_ORDER.filter(p => p !== "collect" && co.scheme[p]).map(p => `${PARTS[p].short} ${res.parts[p].n ? (res.parts[p].missing ? "ขาดสอบ" : fmtNum(res.parts[p].pts) + "/" + co.scheme[p]) : "ยังไม่สอบ"}`).join(" • ")) : stat("คะแนนงาน", res.academic !== null ? res.academic + "%" : "—", res.count ? `จาก ${res.count} รายการที่มีคะแนน` : "ยังไม่มีคะแนน")}
      ${stat("เกรด (ประมาณการ)", res.gradeLabel, res.special === "ร" ? "ยังไม่มีคะแนนสอบ" : res.special === "มส" ? "เวลาเรียนไม่ถึงเกณฑ์" : isThai(co) && res.pointsMax ? `คะแนนรวม ${fmtNum(res.points)}/${res.pointsMax}` : co.behaviorInTotal ? `รวมจิตพิสัย ${co.behaviorInTotal}%` : "", res.special ? "danger" : "")}
      ${stat("งานค้าง", res.pending, res.pending ? "ต้องส่งด่วน" : "ไม่มีงานค้าง 🎉", res.pending ? "danger" : "")}
      ${stat("จิตพิสัย", `${fmtNum(beh.score)}/${beh.full}`, `${beh.pct}%`, beh.pct < 80 ? "danger" : "")}
    </div>

    <div class="section card ${res.pending ? "misscard" : ""}">
      <div class="section-head"><h2>${res.pending ? `🚨 งานที่ยังไม่ส่ง (${res.pending} งาน)` : "✅ ไม่มีงานค้าง"}</h2>${res.pending && co ? `<span class="muted small">${esc(courseLabel(co))}</span>` : ""}</div>
      ${res.pending ? `<p class="small" style="margin-top:0">ช่องคะแนนของงานเหล่านี้ยังว่าง แปลว่าครูยังไม่ได้รับงาน รีบทำและส่งให้ครบนะ${st.lateDeductPerDay ? ` — งานที่ส่งช้าจะถูกหัก ${st.lateDeductPerDay}% ต่อวัน${st.lateGraceDays ? ` (อนุโลม ${st.lateGraceDays} วัน)` : ""} สูงสุด ${st.maxLateDeduct}%` : ""}</p>
        <ol class="misslist big">${res.missing.map(it => missItemHTML(it, today)).join("")}</ol>` : `<p class="muted">เก่งมาก! ส่งงานครบทุกชิ้นแล้ว</p>`}
    </div>

    ${upcoming.length ? `<div class="section card"><h2>📅 งานที่กำลังจะถึงกำหนดส่ง</h2>
      ${upcoming.map(({ it }) => { const left = dayDiff(today, it.due); return `<div class="listrow"><div><b>${esc(it.title)}</b> <span class="pill gray">${left === 0 ? "ส่งวันนี้!" : `อีก ${left} วัน`}</span><div class="muted small">กำหนดส่ง ${fmtDate(it.due)} • เต็ม ${it.max}${it.channel ? " • ส่งทาง " + esc(it.channel) : ""}</div>${it.detail ? `<div class="detailbox small">${escBr(it.detail)}</div>` : ""}</div></div>`; }).join("")}
    </div>` : ""}

    ${waiting.length ? `<div class="section card"><h2>⏳ ส่งแล้ว รอครูตรวจ</h2>${waiting.map(({ it }) => `<div class="listrow"><b>${esc(it.title)}</b><span class="pill leave">รอตรวจ</span></div>`).join("")}</div>` : ""}

    <div class="section card"><h2>📊 คะแนนที่ได้</h2>
      ${graded.length ? graded.map(({ it, i }) => `<div class="listrow"><div style="flex:1"><b>${esc(it.title)}</b> <span class="pill ${MARK[i.status].cls}">${MARK[i.status].label}</span>
        <div class="progress" style="margin-top:6px"><span style="width:${i.pct}%"></span></div>${i.calc.rate ? `<div class="small danger">ส่งช้า ${i.days} วัน หัก ${i.calc.rate}% (ได้ ${fmtNum(i.raw)} เหลือ ${fmtNum(i.net)})</div>` : ""}</div>
        <div class="right"><b>${fmtNum(i.net)}/${it.max}</b><div class="small muted">${i.pct}%</div></div></div>`).join("") : `<div class="empty">ยังไม่มีคะแนน</div>`}
    </div>

    <div class="section two">
      <div class="card"><h2>⭐ จิตพิสัย ${fmtNum(beh.score)}/${beh.full}</h2>
        <div class="progress" style="margin-bottom:10px"><span style="width:${beh.pct}%"></span></div>
        ${beh.list.length ? [...beh.list].sort((a, b) => b.date.localeCompare(a.date)).map(x => `<div class="listrow"><div>${esc(typeIcon(x.type))} ${esc(x.label)}<div class="muted small">${fmtDate(x.date)}${x.note ? " • " + esc(x.note) : ""}</div></div><span class="danger">−${fmtNum(x.points)}</span></div>`).join("") : `<div class="empty">ไม่เคยถูกหักคะแนน 🌟</div>`}
      </div>
      <div class="card"><h2>✅ การมาเรียน ${att.rate !== null ? att.rate + "%" : ""}</h2>
        ${att.n ? `<div class="attsum">${Object.entries(ATT).map(([k, v]) => `<div class="pill ${v.cls}">${v.label} ${att[k]}</div>`).join("")}</div>
          <div class="ratebar big"><span style="width:${att.rate}%" class="${att.rate < st.attendanceMin ? "bad" : ""}"></span></div>
          <p class="muted small">เช็กชื่อทั้งหมด ${att.n} ครั้ง (มา + สาย = มาเรียน) • เกณฑ์ขั้นต่ำ ${st.attendanceMin}%${att.rate < st.attendanceMin && att.n >= 3 ? ` <b class="danger">— ต่ำกว่าเกณฑ์ เสี่ยงไม่มีสิทธิ์สอบ (มส.)</b>` : ""}</p>` : `<div class="empty">ยังไม่มีข้อมูลการเช็กชื่อ</div>`}
      </div>
    </div>

    ${studentAttList(sid, coId, fromTeacher)}
  </div>`;
  window.scrollTo(0, 0);
  armIdle(!fromTeacher);
}

/* รายการวันที่ ขาด / ลา / มาสาย / หนีเรียน — ให้นักเรียนตรวจสอบและแจ้งครูได้ */
function studentAttList(sid, coId, fromTeacher) {
  ensureIdx();
  const recs = (idx.attBy.get(sid + "|" + coId) || []).filter(x => x.status !== "present").sort((a, b) => b.date.localeCompare(a.date));
  const reqs = db.requests.filter(r => r.studentId === sid && r.courseId === coId);
  const reqOf = d => reqs.filter(r => r.date === d).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const all = (idx.attBy.get(sid + "|" + coId) || []);
  return `<div class="section card">
    <div class="section-head"><div><h2>📅 วันที่ ขาด / ลา / มาสาย / หนีเรียน</h2><div class="muted small">ตรวจสอบว่าครูบันทึกถูกต้องหรือไม่ — ถ้าผิด กด “แจ้งครูแก้ไข”</div></div></div>
    ${recs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>วันที่</th><th>ครูบันทึกว่า</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>
      ${recs.map(x => { const rq = reqOf(x.date); return `<tr><td class="nowrap"><b>${new Date(x.date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</b></td>
        <td><span class="pill ${ATT[x.status].cls}">${ATT[x.status].label}</span></td><td class="small">${esc(x.note || "")}</td>
        <td class="right">${rq?.status === "open" ? `<span class="pill leave">ส่งคำร้องแล้ว รอครูตรวจ</span>` : rq?.status === "done" ? `<span class="pill p">ครูแก้ไขแล้ว</span>` : rq?.status === "rejected" ? `<span class="pill gray">ครูตรวจแล้ว ไม่แก้ไข</span>` : ""}
          ${rq?.status !== "open" ? `<button class="btn small gray noprint" onclick="requestFix(${sid},'${coId}','${x.date}',${fromTeacher})">แจ้งครูแก้ไข</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="empty">${all.length ? "🌟 มาเรียนตรงเวลาทุกครั้ง" : "ยังไม่มีข้อมูลการเช็กชื่อ"}</div>`}
    ${all.length ? `<p class="muted small noprint">ถ้าวันที่มาเรียนแต่ไม่อยู่ในรายการนี้ถูกบันทึกผิด หรือวันที่ขาดไม่ได้ถูกบันทึก <button class="linkbtn small" onclick="requestFix(${sid},'${coId}','',${fromTeacher})">แจ้งวันอื่น</button></p>` : ""}
  </div>`;
}

function requestFix(sid, coId, date, fromTeacher) {
  const cur = date ? attOf(sid, date, coId)?.status : "";
  modal("📨 แจ้งครูแก้ไขการเช็กชื่อ", `<div class="form">
      <label>วันที่<input class="input" type="date" id="rqd" value="${date || todayStr()}" max="${todayStr()}" ${date ? "readonly" : ""}></label>
      <label>ความจริงคือ<select class="input" id="rqw">${ATT_ORDER.map(k => `<option value="${k}" ${k === (cur === "present" ? "" : "present") ? "selected" : ""}>${ATT[k].label}</option>`).join("")}</select></label>
      <label class="full">เหตุผล / รายละเอียด<textarea class="input" id="rqn" rows="3" maxlength="300" placeholder="เช่น วันนั้นหนูมาเรียนแต่เข้าห้องช้า 5 นาที / ส่งใบลาป่วยให้ครูประจำชั้นแล้ว"></textarea></label>
    </div><p class="muted small">ครูจะเห็นคำร้องในเมนูเช็กชื่อ → คำร้องแก้ไข</p>`, "ส่งคำร้อง", () => {
    const d = $("rqd").value, wanted = $("rqw").value, note = $("rqn").value.trim();
    if (!DATE_RE.test(d)) return toast("เลือกวันที่");
    const now = attOf(sid, d, coId)?.status || "";
    if (now === wanted) return toast("สถานะที่เลือกตรงกับที่ครูบันทึกไว้แล้ว");
    if (!note) return toast("กรุณาเขียนเหตุผลสั้นๆ ให้ครู");
    db.requests.push({ id: uid(), studentId: sid, courseId: coId, date: d, current: now, wanted, note, createdAt: new Date().toISOString(), status: "open" });
    save(); closeModal(); studentDash(sid, fromTeacher); toast("ส่งคำร้องถึงครูแล้ว ✓", 4000);
  });
}

