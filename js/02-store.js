"use strict";
/* =============================================================
   ข้อมูลและการจัดเก็บ
   โครงสร้างข้อมูล • ย้ายข้อมูลรุ่นเก่า • ตรวจ/ซ่อมข้อมูล • localStorage • จุดบันทึก • เลิกทำ • ดัชนี
   ============================================================= */

/* ---------- โครงสร้างข้อมูล (db) — เก็บทั้งก้อนใน localStorage คีย์ KEY ----------
 * @typedef {Object} DB
 * @property {number}  version        รุ่นข้อมูล (DATA_VERSION)
 * @property {string}  school, teacher, appTitle, appSubtitle
 * @property {string}  logo           รูปโลโก้แบบ data URL (หรือ "")
 * @property {?string} lastBackup     วันที่สำรองล่าสุด YYYY-MM-DD
 * @property {Term} term             ภาคเรียนปัจจุบัน    {year (พ.ศ.), semester 1|2|3}
 * @property {Level[]} levels         ระดับชั้น            {id, name}
 * @property {Klass[]} classes        ห้องเรียน             {id, name, code, levelId}
 * @property {Course[]} courses       รายวิชา              {id, code, name, group(กลุ่มสาระ), classIds[], behaviorInTotal, scheme{type, collect, mid, final}}
 * @property {Student[]} students     นักเรียน             {id, no, sid(5 หลัก), name, classId}
 * @property {Item[]} items           งาน/กิจกรรม (ต่อวิชา) {id, courseId, title, detail, max, weight, due, channel, part(collect|mid|final), order}
 * @property {Mark[]} marks           คะแนน/การส่ง          {studentId, itemId, score, handedIn, submittedAt, lateDaysOverride, excused}
 * @property {Att[]} attendance       เช็กชื่อ (ต่อวิชา)     {date, studentId, courseId, status, note?}
 * @property {Beh[]} behaviors        หักคะแนนพฤติกรรม     {id, studentId, courseId, date, type, label, points, note}
 * @property {Req[]} requests         คำร้องแก้เช็กชื่อ      {id, studentId, courseId, date, current, wanted, note, createdAt, status}
 * @property {Object} settings        ดู DEFAULT_SETTINGS
 * @property {Object} security        กู้รหัสครู {email, salt, codeHash, codeCreated, question, answerHash} (ดู 18-security.js)
 *
 * กฎสำคัญ
 *  - ทุกครั้งที่โหลด/นำเข้า ข้อมูลผ่าน migrate() เสมอ → ข้อมูลเสีย/ซ้ำ/กำพร้าถูกซ่อมก่อนใช้งาน
 *  - แก้ db แล้วต้องเรียก save() (save จะล้างดัชนี idx ให้อัตโนมัติ)
 *  - การลบข้อมูลจำนวนมากให้ผ่าน confirmBox() ซึ่งสร้างจุดเลิกทำ + จุดบันทึกให้เอง
 */

/* ---------- ข้อมูลตั้งต้น ---------- */
function seed() {
  return {
    version: DATA_VERSION,
    school: "English Smart Classroom",
    appTitle: DEFAULT_TITLE, appSubtitle: DEFAULT_SUBTITLE, logo: "",
    teacher: "ครูผู้สอน", lastBackup: null,
    term: currentTermGuess(),
    courses: [{ id: "CRS1", code: "อ23101", name: "ภาษาอังกฤษ ม.3", group: "ภาษาต่างประเทศ", classIds: ["M3-1", "M3-2"], behaviorInTotal: 0, scheme: { ...DEFAULT_SCHEME } }],
    levels: [{ id: "L3", name: "ม.3" }],
    classes: [{ id: "M3-1", name: "ม.3/1", code: "ENG31", levelId: "L3" }, { id: "M3-2", name: "ม.3/2", code: "ENG32", levelId: "L3" }],
    students: [
      { id: 1, no: 1, sid: "10001", name: "กิตติ", classId: "M3-1" },
      { id: 2, no: 2, sid: "10002", name: "มินตรา", classId: "M3-1" },
      { id: 3, no: 3, sid: "10003", name: "ภัทร", classId: "M3-1" }
    ],
    items: [{ id: 1, courseId: "CRS1", title: "Speaking Quiz", detail: "พูดแนะนำตัวเอง 1 นาที", max: 10, weight: 1, due: "", channel: "สอบในห้อง", part: "collect", order: 1 }],
    marks: [], attendance: [], behaviors: [], requests: [],
    security: { email: "", salt: "", codeHash: "", codeCreated: "", question: "", answerHash: "" },
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  };
}

/* ---------- แปลงข้อมูลรุ่นเก่า (V2/V3/V4) → โครงสร้างรายวิชา (V5+) ----------
   - "วิชา" เดิม (db.subject) กลายเป็นรายวิชา 1 วิชา ที่ครอบคลุมทุกห้อง
   - คะแนนกิจกรรม + งาน รวมเป็น "งาน/คะแนน" ชุดเดียว                */
function upgradeOld(d) {
  const courseId = "CRS1";
  const classes = Array.isArray(d.classes) ? d.classes.filter(isObj) : [];
  const course = { id: courseId, code: "", name: str(d.subject) || "รายวิชาของฉัน", classIds: classes.map(c => str(c.id)), behaviorInTotal: 0 };
  const items = [], marks = [];
  const used = new Set(), qMap = new Map(), wMap = new Map();
  const newId = v => { let n = +v; if (!Number.isFinite(n) || used.has(n)) n = uid(); used.add(n); return n; };
  (Array.isArray(d.assessments) ? d.assessments : []).filter(isObj).forEach(a => {
    const id = newId(a.id); qMap.set(String(a.id), id);
    items.push({ id, courseId, title: a.name, detail: "", max: a.max, weight: a.weight, due: "", channel: "" });
  });
  (Array.isArray(d.assignments) ? d.assignments : []).filter(isObj).forEach(a => {
    const id = newId(a.id); wMap.set(String(a.id), id);
    items.push({ id, courseId, title: a.title, detail: a.detail, max: a.max, weight: a.weight, due: a.due, channel: a.channel });
  });
  (Array.isArray(d.scores) ? d.scores : []).filter(isObj).forEach(x => {
    const it = qMap.get(String(x.assessmentId));
    if (it !== undefined) marks.push({ studentId: x.studentId, itemId: it, score: x.score ?? x.rawScore });
  });
  const v2 = !(+d.version >= 3);
  (Array.isArray(d.submissions) ? d.submissions : []).filter(isObj).forEach(q => {
    const it = wMap.get(String(q.assignmentId)); if (it === undefined) return;
    if (v2) {
      const handed = q.status === "submitted" || q.status === "late";
      marks.push({ studentId: q.studentId, itemId: it, score: q.teacherScore, handedIn: handed, lateDaysOverride: handed && +q.lateDays > 0 ? +q.lateDays : null });
    } else {
      marks.push({ studentId: q.studentId, itemId: it, score: q.teacherScore, handedIn: q.handedIn, submittedAt: q.submittedAt, lateDaysOverride: q.lateDaysOverride, excused: q.excused });
    }
  });
  const attendance = (Array.isArray(d.attendance) ? d.attendance : []).filter(isObj).map(x => ({ ...x, courseId }));
  return { ...d, version: 5, courses: [course], items, marks, attendance, behaviors: [] };
}

/* ---------- ตรวจและซ่อมข้อมูลทุกครั้งที่โหลด/นำเข้า ---------- */
function migrate(input) {
  const s = seed();
  let d = isObj(input) ? input : s;
  if (!(+d.version >= 5)) d = upgradeOld(d);

  const out = {
    version: DATA_VERSION,
    school: str(d.school, s.school) || s.school,
    appTitle: str(d.appTitle, s.appTitle) || s.appTitle,
    appSubtitle: str(d.appSubtitle ?? s.appSubtitle),
    logo: typeof d.logo === "string" && d.logo.startsWith("data:image/") ? d.logo : "",
    teacher: str(d.teacher, s.teacher) || s.teacher,
    lastBackup: typeof d.lastBackup === "string" && DATE_RE.test(d.lastBackup) ? d.lastBackup : null
  };
  const arr = k => Array.isArray(d[k]) ? d[k].filter(isObj) : [];
  const numId = (v, used) => { let n = +v; if (!Number.isFinite(n) || v === "" || v === null || used.has(n)) n = uid(); used.add(n); return n; };
  const strId = (v, used, prefix) => { let id = str(v); if (!/^[\w-]{1,40}$/.test(id) || used.has(id)) id = prefix + uid(); used.add(id); return id; };

  // ภาคเรียน/ปีการศึกษาปัจจุบัน
  const tm = isObj(d.term) ? d.term : currentTermGuess();
  out.term = { year: clamp(Math.floor(+tm.year) || currentTermGuess().year, 2400, 2800), semester: [1, 2, 3].includes(+tm.semester) ? +tm.semester : 1 };

  // ระดับชั้น
  const levelMap = new Map(), usedL = new Set();
  out.levels = arr("levels").map(l => { const id = strId(l.id, usedL, "L"); levelMap.set(str(l.id), id); return { id, name: str(l.name) || "ระดับชั้น" }; });
  const levelByName = name => {
    let L = out.levels.find(x => x.name === name);
    if (!L) { L = { id: strId("", usedL, "L"), name }; out.levels.push(L); }
    return L.id;
  };

  // ห้องเรียน (ห้องเก่าที่ไม่มีระดับชั้น → เดาจากชื่อ เช่น "ม.3/1" → "ม.3")
  const classMap = new Map(), usedC = new Set(), usedCode = new Set();
  out.classes = arr("classes").map(c => {
    const id = strId(c.id, usedC, "C"); classMap.set(str(c.id), id);
    const name = str(c.name) || id;
    let code = (str(c.code) || name).toUpperCase().replace(/\s+/g, "");
    while (usedCode.has(code)) code += "X";
    usedCode.add(code);
    let levelId = levelMap.get(str(c.levelId));
    if (!levelId) levelId = levelByName(guessLevel(name));
    return { id, name, code, levelId };
  });
  if (!out.classes.length) { out.classes = s.classes; if (!out.levels.length) out.levels = s.levels; out.classes.forEach(c => { if (!out.levels.some(l => l.id === c.levelId)) c.levelId = levelByName(guessLevel(c.name)); }); }
  out.levels.sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
  const classIds = new Set(out.classes.map(c => c.id));

  // รายวิชา
  const courseMap = new Map(), usedCo = new Set();
  out.courses = arr("courses").map(c => {
    const id = strId(c.id, usedCo, "CRS"); courseMap.set(str(c.id), id);
    const cl = [...new Set((Array.isArray(c.classIds) ? c.classIds : []).map(x => classMap.get(str(x)) ?? str(x)).filter(x => classIds.has(x)))];
    // ข้อมูลก่อน V8 ใช้วิธีรวมแบบเดิม (simple) เพื่อให้ผลการเรียนเดิมไม่เปลี่ยน
    const sc = isObj(c.scheme) ? c.scheme : { type: "simple", collect: 80, mid: 0, final: 20 };
    const nz = (v, fb) => Number.isFinite(+v) && +v >= 0 ? Math.min(1000, +v) : fb;
    const scheme = { type: sc.type === "thai" ? "thai" : "simple", collect: nz(sc.collect, 80), mid: nz(sc.mid, 0), final: nz(sc.final, 20) };
    if (scheme.type === "thai" && scheme.collect + scheme.mid + scheme.final <= 0) scheme.collect = 100;
    return { id, code: str(c.code), name: str(c.name) || "รายวิชา", group: str(c.group), classIds: cl, behaviorInTotal: clamp(+c.behaviorInTotal || 0, 0, 100), scheme, credits: Number.isFinite(+c.credits) && +c.credits > 0 ? Math.min(10, +c.credits) : 1 };
  });
  if (!out.courses.length) out.courses = [{ id: "CRS1", code: "", name: "รายวิชาของฉัน", classIds: [...classIds], behaviorInTotal: 0 }];
  const courseIds = new Set(out.courses.map(c => c.id));
  const courseOf = v => { const id = courseMap.get(str(v)) ?? str(v); return courseIds.has(id) ? id : null; };

  // นักเรียน (รหัสนักเรียน 5 หลัก ต้องไม่ซ้ำกัน)
  const usedS = new Set(), sMap = new Map(), usedSid = new Set();
  out.students = arr("students").map(x => {
    const id = numId(x.id, usedS); sMap.set(String(x.id), id);
    let classId = classMap.get(str(x.classId)) ?? str(x.classId);
    if (!classIds.has(classId)) classId = out.classes[0].id;
    let sid = str(x.sid).replace(/\D/g, "");
    if (!SID_RE.test(sid) || usedSid.has(sid)) sid = "";
    if (sid) usedSid.add(sid);
    return { id, no: Math.max(0, Math.floor(+x.no || 0)), sid, name: str(x.name) || "(ไม่มีชื่อ)", classId };
  });
  const sid = v => sMap.get(String(v));

  // งาน/คะแนน
  const usedI = new Set(), iMap = new Map();
  out.items = [];
  arr("items").forEach(a => {
    const courseId = courseOf(a.courseId) ?? out.courses[0].id;
    const id = numId(a.id, usedI); iMap.set(String(a.id), id);
    out.items.push({ id, courseId, title: str(a.title) || "งาน", detail: str(a.detail), max: posNum(a.max, 10), weight: posNum(a.weight, 1), due: DATE_RE.test(str(a.due)) ? str(a.due) : "", channel: str(a.channel),
      part: PARTS[a.part] ? a.part : "collect", order: Number.isFinite(+a.order) && +a.order > 0 ? +a.order : 0 });
  });
  // ลำดับที่ (เลขข้อในแบบบันทึกคะแนน) — ข้อมูลเก่าไม่มี ให้เรียงตามลำดับที่สร้าง
  const seq = {};
  out.items.slice().sort((a, b) => (a.order || 1e9) - (b.order || 1e9) || a.id - b.id).forEach(it => {
    const k = it.courseId + "|" + it.part; seq[k] = (seq[k] || 0) + 1;
    if (!it.order) it.order = seq[k]; else seq[k] = Math.max(seq[k], it.order);
  });
  const maxOf = new Map(out.items.map(a => [a.id, a.max]));

  // คะแนน/การส่งงาน (1 นักเรียน × 1 งาน = 1 รายการ)
  const mk = new Map();
  arr("marks").forEach(m => {
    const st = sid(m.studentId), it = iMap.get(String(m.itemId));
    if (st === undefined || it === undefined) return;
    const score = num(m.score), lo = m.lateDaysOverride;
    const r = {
      studentId: st, itemId: it,
      score: score === null ? null : clamp(score, 0, maxOf.get(it)),
      handedIn: !!m.handedIn,
      submittedAt: DATE_RE.test(str(m.submittedAt)) ? str(m.submittedAt) : null,
      lateDaysOverride: lo === null || lo === undefined || lo === "" || !Number.isFinite(+lo) ? null : Math.max(0, Math.floor(+lo)),
      excused: !!m.excused
    };
    if (r.score === null && !r.handedIn && !r.submittedAt) return; // รายการว่าง ไม่ต้องเก็บ
    mk.set(st + "|" + it, r);
  });
  out.marks = [...mk.values()];

  // เช็กชื่อ (ต่อวิชา)
  const at = new Map();
  arr("attendance").forEach(x => {
    const st = sid(x.studentId), date = str(x.date), co = courseOf(x.courseId) ?? out.courses[0].id;
    if (st === undefined || !DATE_RE.test(date) || !ATT[x.status]) return;
    const rec = { date, studentId: st, courseId: co, status: x.status };
    if (str(x.note)) rec.note = str(x.note).slice(0, 200);
    at.set(st + "|" + co + "|" + date, rec);
  });
  out.attendance = [...at.values()];

  // ตั้งค่า
  const ss = isObj(d.settings) ? d.settings : {};
  const types = (Array.isArray(ss.behaviorTypes) ? ss.behaviorTypes : DEFAULT_BEHAVIORS).filter(isObj);
  const usedB = new Set();
  out.settings = {
    lateGraceDays: Math.max(0, Math.floor(+ss.lateGraceDays || 0)),
    lateDeductPerDay: clamp(Number.isFinite(+ss.lateDeductPerDay) ? +ss.lateDeductPerDay : DEFAULT_SETTINGS.lateDeductPerDay, 0, 100),
    maxLateDeduct: clamp(Number.isFinite(+ss.maxLateDeduct) ? +ss.maxLateDeduct : DEFAULT_SETTINGS.maxLateDeduct, 0, 100),
    missingAsZero: !!ss.missingAsZero,
    totalMode: ss.totalMode === "weighted" ? "weighted" : "points",
    teacherPin: str(ss.teacherPin),
    behaviorFull: posNum(ss.behaviorFull, 100),
    attendanceMin: clamp(Number.isFinite(+ss.attendanceMin) && ss.attendanceMin !== "" && ss.attendanceMin !== null ? +ss.attendanceMin : 80, 0, 100),
    behaviorTypes: types.map(t => ({ id: strId(t.id, usedB, "b"), label: str(t.label) || "พฤติกรรม", icon: str(t.icon).slice(0, 4), points: posNum(t.points, 2) }))
  };

  // พฤติกรรม
  const usedBh = new Set();
  out.behaviors = [];
  arr("behaviors").forEach(b => {
    const st = sid(b.studentId), co = courseOf(b.courseId);
    if (st === undefined || !co || !DATE_RE.test(str(b.date))) return;
    out.behaviors.push({ id: numId(b.id, usedBh), studentId: st, courseId: co, date: str(b.date), type: str(b.type), label: str(b.label) || "พฤติกรรม", points: posNum(b.points, 2), note: str(b.note) });
  });

  // กู้รหัสครู (เก็บเฉพาะค่าแฮช)
  const sec = isObj(d.security) ? d.security : {};
  const hex = v => /^[0-9a-f]{16,}$/.test(str(v)) ? str(v) : "";
  out.security = {
    email: str(sec.email).slice(0, 120),
    salt: /^[\w-]{8,64}$/.test(str(sec.salt)) ? str(sec.salt) : Math.random().toString(36).slice(2) + Date.now().toString(36),
    codeHash: hex(sec.codeHash),
    codeCreated: hex(sec.codeHash) ? str(sec.codeCreated) : "",
    question: str(sec.question).slice(0, 150),
    answerHash: hex(sec.answerHash)
  };
  if (!out.security.question) out.security.answerHash = "";

  // คำร้องขอแก้ไขการเช็กชื่อจากนักเรียน
  const usedR = new Set();
  out.requests = [];
  arr("requests").forEach(r => {
    const st = sid(r.studentId), co = courseOf(r.courseId);
    if (st === undefined || !co || !DATE_RE.test(str(r.date))) return;
    out.requests.push({ id: numId(r.id, usedR), studentId: st, courseId: co, date: str(r.date), current: ATT[r.current] ? r.current : "", wanted: ATT[r.wanted] ? r.wanted : "", note: str(r.note).slice(0, 300), createdAt: str(r.createdAt) || new Date().toISOString(), status: ["open", "done", "rejected"].includes(r.status) ? r.status : "open" });
  });
  // บันทึกข้อความ (V8.1): ข้อมูลผู้ลงนาม + เหตุผลที่ครูแก้เอง
  const mm = isObj(d.memo) ? d.memo : {};
  out.memo = {};
  Object.keys(mm).forEach(k => { if (/^[a-zA-Z]{2,20}$/.test(k) && typeof mm[k] === "string") out.memo[k] = mm[k].slice(0, 200); });
  out.memoNotes = {};
  if (isObj(d.memoNotes)) Object.keys(d.memoNotes).forEach(k => { if (typeof d.memoNotes[k] === "string" && k.length < 80) out.memoNotes[k] = d.memoNotes[k].slice(0, 300); });
  return out;
}

/* ---------- การจัดเก็บ (localStorage) แบบปลอดภัย ---------- */
const store = {
  ok: (() => { try { const k = "__sb_test"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return true; } catch (e) { return false; } })(),
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { localStorage.setItem(k, v); },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};
function readJSON(k) { const t = store.get(k); if (!t) return null; try { return JSON.parse(t); } catch (e) { return { __broken: t }; } }

const boot = { notice: "", migratedFrom: "" };
function load() {
  let d = readJSON(KEY);
  if (d?.__broken) {
    try { store.set(KEY + "_broken_" + Date.now(), d.__broken); } catch (e) { }
    const snap = getSnapshots()[0];
    boot.notice = snap ? `⚠️ ข้อมูลหลักเสียหาย ระบบกู้คืนจากจุดบันทึกอัตโนมัติ (${fmtDateTime(snap.t)}) ให้แล้ว` : "⚠️ ข้อมูลหลักเสียหาย และไม่พบจุดบันทึกอัตโนมัติ — กรุณากู้คืนจากไฟล์สำรอง";
    d = snap ? JSON.parse(snap.data) : null;
  }
  if (!d) for (const k of OLD_KEYS) { const o = readJSON(k); if (o && !o.__broken) { d = o; boot.migratedFrom = k; break; } }
  if (d && !(+d.version >= 5)) {
    boot.upgraded = true;
    // เก็บข้อมูลรุ่นเก่าไว้ 1 ชุดก่อนอัปเกรด (กู้คืนได้ถ้าจำเป็น)
    try { if (!store.get(KEY + "_pre_v5")) store.set(KEY + "_pre_v5", JSON.stringify(d)); } catch (e) { }
  }
  return migrate(d || seed());
}

const saveState = { ok: true, at: null, error: "" };
function save() {
  idx.dirty = true;
  if (ui?.archive) { // โหมดดูภาคเรียนเก่า: ห้ามบันทึกทับข้อมูลปัจจุบัน
    if (!ui.archiveWarned) { ui.archiveWarned = true; toast("📚 โหมดดูย้อนหลัง — การแก้ไขจะไม่ถูกบันทึก", 4000); }
    return false;
  }
  if (!store.ok) { saveState.ok = false; saveState.error = "เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกข้อมูล (อาจเปิดแบบส่วนตัว/Incognito)"; renderSaveState(); return false; }
  const text = JSON.stringify(db);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      store.set(KEY, text);
      saveState.ok = true; saveState.at = new Date(); saveState.error = "";
      renderSaveState();
      return true;
    } catch (e) {
      const snaps = getSnapshots();
      if (!snaps.length) break;
      writeSnapshots(snaps.slice(0, Math.floor(snaps.length / 2)));
    }
  }
  saveState.ok = false;
  saveState.error = "พื้นที่บันทึกในเบราว์เซอร์เต็ม — กรุณาสำรองข้อมูลเป็นไฟล์ทันที และลองลบโลโก้/ข้อมูลเก่า";
  renderSaveState();
  toast("⚠️ " + saveState.error, 6000);
  return false;
}

/* ---------- จุดบันทึกอัตโนมัติ ---------- */
function getSnapshots() { const s = readJSON(SNAP_KEY); return Array.isArray(s) ? s.filter(x => x && x.t && typeof x.data === "string") : []; }
function writeSnapshots(list) { try { store.set(SNAP_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
function snapshot(label) {
  if (!store.ok) return;
  const copy = { ...db, logo: "" };
  const daily = label === "อัตโนมัติรายวัน";
  const old = getSnapshots();
  const same = old.filter(x => (x.label === "อัตโนมัติรายวัน") === daily).slice(0, SNAP_MAX / 2 - 1);
  const other = old.filter(x => (x.label === "อัตโนมัติรายวัน") !== daily);
  let list = [{ t: new Date().toISOString(), label, data: JSON.stringify(copy) }, ...same, ...other].sort((a, b) => b.t.localeCompare(a.t));
  while (list.length && !writeSnapshots(list)) list = list.slice(0, -1);
}
function dailySnapshot() {
  const last = getSnapshots().find(x => x.label === "อัตโนมัติรายวัน");
  if (!last || last.t.slice(0, 10) !== new Date().toISOString().slice(0, 10)) snapshot("อัตโนมัติรายวัน");
}

/* ---------- เลิกทำ (Undo) ---------- */
const undoStack = [];
function checkpoint(label) {
  undoStack.push({ label, data: JSON.stringify(db) });
  if (undoStack.length > 15) undoStack.shift();
}
function undo() {
  const u = undoStack.pop();
  if (!u) return toast("ไม่มีรายการให้เลิกทำ");
  db = migrate(JSON.parse(u.data));
  save();
  fixSelection();
  rerender();
  toast(`↩️ เลิกทำ “${u.label}” แล้ว`);
}

/* ---------- ดัชนีค้นหาเร็ว ---------- */
const idx = { dirty: true };
function ensureIdx() {
  if (!idx.dirty) return;
  idx.mark = new Map(db.marks.map(x => [x.studentId + "|" + x.itemId, x]));
  idx.att = new Map(db.attendance.map(x => [x.studentId + "|" + x.courseId + "|" + x.date, x]));
  idx.attBy = new Map(); idx.behBy = new Map();
  db.attendance.forEach(x => { const k = x.studentId + "|" + x.courseId; if (!idx.attBy.has(k)) idx.attBy.set(k, []); idx.attBy.get(k).push(x); });
  db.behaviors.forEach(x => { const k = x.studentId + "|" + x.courseId; if (!idx.behBy.has(k)) idx.behBy.set(k, []); idx.behBy.get(k).push(x); });
  idx.dirty = false;
}

let db;
try { db = load(); }
catch (e) { console.error(e); db = migrate(seed()); boot.notice = "⚠️ โหลดข้อมูลไม่สำเร็จ เริ่มต้นด้วยข้อมูลตัวอย่าง — กู้คืนได้ที่ ตั้งค่า → จุดบันทึกอัตโนมัติ"; }
const ui = { page: "dash", courseId: db.courses[0]?.id, classId: null, itemId: null, attDate: todayStr(), behDate: todayStr(), behType: null, unlocked: false, view: "home", q: "", sumSort: "no" };

