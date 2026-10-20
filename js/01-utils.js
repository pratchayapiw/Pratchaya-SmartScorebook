"use strict";
/* =============================================================
   เครื่องมือทั่วไป
   ฟังก์ชันช่วยที่ไม่ขึ้นกับข้อมูล: escape HTML, ตัวเลข, วันที่, เกรด
   ============================================================= */
/* ---------- เครื่องมือทั่วไป ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
const escBr = s => esc(s).replace(/\n/g, "<br>");
/** ตราเวลาแบบจุด วัน.เดือน.ปี(พ.ศ.).ชั่วโมง.นาที — ใช้กับชื่อไฟล์ที่ดาวน์โหลด เช่น 20.10.2569.13.20 */
function dotStamp(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear() + 543}.${p(d.getHours())}.${p(d.getMinutes())}`;
}
/** ชื่อไฟล์มาตรฐาน: ชื่อ_วัน.เดือน.ปี.ชั่วโมง.นาที.นามสกุลไฟล์ */
const stampName = (base, ext) => `${base}_${dotStamp()}.${ext}`;
/** ไอคอนของระบบ (img/icons/*.webp — ออกแบบโดยครู) */
const ico = (name, cls = "") => `<img class="ico ${cls}" src="img/icons/${name}.webp" alt="" aria-hidden="true" draggable="false">`;
let _uidN = 0;
const uid = () => Date.now() * 1000 + (_uidN++ % 1000);
const round1 = n => Math.round(n * 10) / 10;
const round2 = n => Math.round(n * 100) / 100;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const pct = (a, b) => b ? round1(a / b * 100) : 0;
const num = v => (v === "" || v === null || v === undefined || isNaN(+v)) ? null : +v;
const fmtNum = n => String(round2(n));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SID_RE = /^\d{5}$/;
/* เดาระดับชั้นจากชื่อห้อง: "ม.3/1" → "ม.3", "M.2/4" → "M.2", อื่นๆ → "ทั่วไป" */
function guessLevel(name) {
  const m = String(name).match(/^(.*?)[\/\-](\s*\d+)\s*$/);
  return (m && m[1].trim()) || "ทั่วไป";
}
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const str = (v, fb = "") => (v === null || v === undefined) ? fb : String(v).trim();
const posNum = (v, fb) => { const n = +v; return Number.isFinite(n) && n > 0 ? n : fb; };
function todayStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function dayDiff(from, to) { return Math.round((Date.parse(to) - Date.parse(from)) / 86400000); }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return isNaN(d) ? s : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
/** ภาคเรียนโดยประมาณจากวันที่: พ.ค.–ต.ค. = ภาค 1, พ.ย.–มี.ค. = ภาค 2 (ปีการศึกษาเริ่ม พ.ค.) */
function currentTermGuess(d = new Date()) {
  const m = d.getMonth() + 1, be = d.getFullYear() + 543;
  if (m >= 5 && m <= 10) return { year: be, semester: 1 };
  return { year: m >= 11 ? be : be - 1, semester: 2 };
}
const termLabel = t => `ภาคเรียนที่ ${t.semester}/${t.year}`;
/** "ม.5" → "มัธยมศึกษาปีที่ 5", "ป.6" → "ประถมศึกษาปีที่ 6" */
function levelFull(name) {
  const m = String(name || "").match(/^(ม|ป|อ)\.?\s*(\d+)/);
  if (!m) return String(name || "");
  return ({ ม: "มัธยมศึกษาปีที่ ", ป: "ประถมศึกษาปีที่ ", อ: "อนุบาลปีที่ " })[m[1]] + m[2];
}
/** สีระดับคะแนนรวม (เหมือนแบบบันทึกของโรงเรียน): <50 แดง • 50–69 เหลือง • 70–79 เขียว • ≥80 ฟ้า */
const bandCls = p => p === null || p === undefined ? "" : p < 50 ? "band-f" : p < 70 ? "band-c" : p < 80 ? "band-b" : "band-a";

function gradeOf(p) {
  if (p === null || p === undefined) return "—";
  for (const [min, g] of GRADE_SCALE) if (p >= min) return g;
  return "0";
}
function gradeCls(g) { return g === "—" ? "gray" : +g >= 3 ? "p" : +g >= 2 ? "leave" : +g >= 1 ? "l" : "a"; }

