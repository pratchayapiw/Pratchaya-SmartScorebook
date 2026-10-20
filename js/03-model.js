"use strict";
/* =============================================================
   ค้นหาข้อมูลและการคำนวณ
   อ่านข้อมูลจาก db (ไม่แก้ไข DOM) และคำนวณคะแนน/สถานะ/จิตพิสัย/การมาเรียน
   ============================================================= */
/* ---------- ค้นหาข้อมูล ---------- */
const cls = id => db.classes.find(c => c.id === id);
const level = id => db.levels.find(l => l.id === id);
const levelClasses = lid => db.classes.filter(c => c.levelId === lid).sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
const course = id => db.courses.find(c => c.id === id);
const curCourse = () => course(ui.courseId);
const courseClasses = (co = curCourse()) => (co?.classIds || []).map(cls).filter(Boolean);
const coursesOfClass = classId => db.courses.filter(c => c.classIds.includes(classId));
/* งานของวิชา เรียงตาม ส่วนของคะแนน (เก็บ → กลางภาค → ปลายภาค) แล้วตามลำดับที่ (เลขข้อ) */
const courseItems = (courseId = ui.courseId) => db.items.filter(i => i.courseId === courseId)
  .sort((a, b) => PART_ORDER.indexOf(partOf(a)) - PART_ORDER.indexOf(partOf(b)) || (a.order || 0) - (b.order || 0) || a.id - b.id);
const isThai = (co = curCourse()) => co?.scheme?.type === "thai";
/** ส่วนของคะแนนที่งานนี้อยู่ (งานที่ไม่ได้ระบุ = คะแนนเก็บ) */
const partOf = it => PARTS[it?.part] ? it.part : "collect";
const roster = (classId = ui.classId) => db.students
  .filter(s => s.classId === classId)
  .sort((a, b) => a.no - b.no || a.name.localeCompare(b.name, "th"));
const getMark = (sid, iid) => { ensureIdx(); return idx.mark.get(sid + "|" + iid); };
const attOf = (sid, date, co = ui.courseId) => { ensureIdx(); return idx.att.get(sid + "|" + co + "|" + date); };
const behOf = (sid, co = ui.courseId) => { ensureIdx(); return idx.behBy.get(sid + "|" + co) || []; };
const curItem = () => db.items.find(a => a.id === ui.itemId && a.courseId === ui.courseId);
function ensureMark(sid, iid) {
  let m = getMark(sid, iid);
  if (!m) {
    m = { studentId: sid, itemId: iid, score: null, handedIn: false, submittedAt: null, lateDaysOverride: null, excused: false };
    db.marks.push(m);
    idx.mark.set(sid + "|" + iid, m);
  }
  return m;
}
/* เลือกวิชา/ห้องให้ถูกต้องเสมอ (ห้องต้องอยู่ในวิชาที่เลือก) */
function fixSelection() {
  if (!curCourse()) ui.courseId = db.courses[0]?.id;
  const rooms = courseClasses();
  if (!rooms.some(c => c.id === ui.classId)) ui.classId = rooms[0]?.id ?? null;
}

/* =============================================================
   การคำนวณ
   ============================================================= */
function calcLate(raw, days, excused = false, st = db.settings) {
  const late = excused ? 0 : Math.max(0, days - st.lateGraceDays);
  const rate = round2(Math.min(st.maxLateDeduct, late * st.lateDeductPerDay));
  const net = Math.max(0, round2(raw * (1 - rate / 100)));
  return { late, rate, net };
}

/* สถานะงาน 1 ชิ้นของนักเรียน 1 คน
   - มีคะแนน          → ส่งแล้ว / ส่งช้า
   - ส่งแล้วแต่ไม่มีคะแนน → รอตรวจ
   - ไม่มีคะแนน + ยังไม่ถึงกำหนด → ยังไม่ถึงกำหนด
   - ไม่มีคะแนน + เลยกำหนด หรือไม่มีกำหนดส่ง → ค้างส่ง            */
function markInfo(m, it, today = todayStr()) {
  const score = m?.score ?? null;
  const handed = score !== null || !!(m && (m.handedIn || m.submittedAt));
  let days = 0;
  if (it.due && handed) {
    if (m?.lateDaysOverride != null) days = m.lateDaysOverride;
    else if (m?.submittedAt) days = Math.max(0, dayDiff(it.due, m.submittedAt));
  }
  let status;
  if (score !== null) status = days > 0 ? "late" : "done";
  else if (handed) status = "waiting";
  else if (it.due && today <= it.due) status = "pending";
  else status = "missing";
  const calc = score === null ? null : (it.due ? calcLate(score, days, !!m?.excused) : { late: 0, rate: 0, net: score });
  const overdueDays = status === "missing" && it.due ? Math.max(0, dayDiff(it.due, today)) : 0;
  return { handed, days, status, raw: score, calc, net: calc ? calc.net : null, pct: calc ? pct(calc.net, it.max) : null, overdueDays };
}

function behaviorResult(sid, courseId) {
  const list = behOf(sid, courseId), full = db.settings.behaviorFull;
  const lost = list.reduce((a, b) => a + b.points, 0);
  const score = Math.max(0, round2(full - lost));
  return { score, full, pct: pct(score, full), count: list.length, list };
}

/* ผลการเรียนของนักเรียน 1 คน ใน 1 วิชา */
function studentResult(sid, courseId = ui.courseId) {
  const st = db.settings, co = course(courseId), items = [];
  const missing = [], waiting = [];
  courseItems(courseId).forEach(it => {
    const i = markInfo(getMark(sid, it.id), it);
    if (i.status === "missing") missing.push(it);
    if (i.status === "waiting") waiting.push(it);
    if (i.net !== null) items.push({ got: i.net, max: it.max, pct: i.pct, weight: it.weight });
    else if (st.missingAsZero && i.status === "missing") items.push({ got: 0, max: it.max, pct: 0, weight: it.weight });
  });
  let academic = null;
  if (items.length) {
    if (st.totalMode === "weighted") {
      const W = items.reduce((s, i) => s + i.weight, 0);
      academic = W ? round1(items.reduce((s, i) => s + i.pct * i.weight, 0) / W) : null;
    } else {
      academic = pct(items.reduce((s, i) => s + i.got, 0), items.reduce((s, i) => s + i.max, 0));
    }
  }
  const beh = behaviorResult(sid, courseId);
  const w = co?.behaviorInTotal || 0;
  if (isThai(co)) return thaiResult(sid, co, { missing, waiting, beh, w });
  const total = academic === null ? null : (w ? round1(academic * (100 - w) / 100 + beh.pct * w / 100) : academic);
  return { academic, total, grade: gradeOf(total), gradeLabel: total === null ? "—" : gradeOf(total), special: null, pending: missing.length, missing, waiting, count: items.length, beh };
}

/**
 * ผลการเรียนแบบโรงเรียน: คะแนนเก็บ (แปลงสัดส่วน) + กลางภาค + ปลายภาค
 *  - งานที่ยังไม่ถึงกำหนดส่ง ไม่นับในคะแนนเต็ม (ระหว่างภาคจึงไม่ต่ำเกินจริง)
 *  - งานค้าง/ไม่มีคะแนน นับเป็น 0 (เหมือนแบบบันทึกคะแนนกระดาษ)
 *  - ร = มีการสอบกลางภาค/ปลายภาคแล้วแต่ยังไม่มีคะแนน • มส = เวลาเรียนต่ำกว่าเกณฑ์ (เช็กชื่อ ≥ 5 คาบ)
 */
function thaiResult(sid, co, extra) {
  const sc = co.scheme, parts = {};
  PART_ORDER.forEach(p => { parts[p] = { got: 0, max: 0, n: 0, full: sc[p], pts: null, missing: 0 }; });
  courseItems(co.id).forEach(it => {
    const i = markInfo(getMark(sid, it.id), it), P = parts[partOf(it)];
    if (i.status === "pending") return;
    P.max += it.max; P.n++;
    if (i.net !== null) P.got += i.net; else P.missing++;
  });
  let points = 0, pointsMax = 0;
  PART_ORDER.forEach(p => {
    const P = parts[p];
    if (!P.max || !P.full) return;
    P.pts = Math.round(P.got / P.max * P.full * 100) / 100;
    if (p === "collect") P.pts = Math.round(P.pts); // แปลงคะแนนเก็บเป็นจำนวนเต็ม (เหมือนช่อง "คิดเป็น")
    points += P.pts; pointsMax += P.full;
  });
  const academic = pointsMax ? round1(points / pointsMax * 100) : null;
  const total = academic === null ? null : (extra.w ? round1(academic * (100 - extra.w) / 100 + extra.beh.pct * extra.w / 100) : academic);
  const att = attSummary(sid, co.id);
  let special = null;
  if (att.n >= 5 && att.rate < db.settings.attendanceMin) special = "มส";
  else if ((parts.mid.n && parts.mid.missing) || (parts.final.n && parts.final.missing)) special = "ร";
  const grade = gradeOf(total);
  return { academic, total, grade, gradeLabel: special || (total === null ? "—" : grade), special, parts, points: round2(points), pointsMax,
    fullMax: sc.collect + sc.mid + sc.final, pending: extra.missing.length, missing: extra.missing, waiting: extra.waiting, count: PART_ORDER.reduce((a, p) => a + parts[p].n, 0), beh: extra.beh };
}

function attSummary(sid, courseId = ui.courseId) {
  const c = { present: 0, late: 0, leave: 0, absent: 0, skip: 0 };
  ensureIdx();
  const rec = (idx.attBy.get(sid + "|" + courseId) || []).filter(x => c[x.status] !== undefined);
  rec.forEach(r => c[r.status]++);
  return { ...c, n: rec.length, rate: rec.length ? pct(c.present + c.late, rec.length) : null };
}

function lateRuleText(st = db.settings) {
  return `กติกาส่งช้า: อนุโลม ${st.lateGraceDays} วัน • หัก ${st.lateDeductPerDay}%/วัน • หักสูงสุด ${st.maxLateDeduct}%`;
}
