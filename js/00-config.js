/* =============================================================
   Smart Scorebook V8
   รายวิชา (สอนได้หลายห้อง) • งาน/คะแนน (ระบบเดียว) • ส่งช้า
   เช็กชื่อ (มี "หนีเรียน") • พฤติกรรม/จิตพิสัย • รายงานงานค้าง
   ข้อมูลทั้งหมดเก็บใน localStorage ของเบราว์เซอร์เครื่องนี้
   ============================================================= */

/* ---------- ค่าคงที่ ---------- */
const KEY = "smart_scorebook_v3";            // คงชื่อเดิม ข้อมูล V3/V4 ใช้ต่อได้ทันที
const OLD_KEYS = ["smart_scorebook_v2_settings"];
const SNAP_KEY = "smart_scorebook_snapshots";
const SNAP_MAX = 10;
const DATA_VERSION = 9;
/** เวอร์ชันระบบ = วัน.เดือน.ปี(พ.ศ.).ชั่วโมง.นาที ที่ออกรุ่น — เปลี่ยนพร้อม CACHE ใน sw.js ทุกครั้งที่อัปเดต */
const APP_VERSION = "20.10.2569.15.11";
const APP_RELEASED = "2026-10-20T15:11:00+07:00";
const DEFAULT_TITLE = "Smart Scorebook";
const DEFAULT_SUBTITLE = "ระบบคะแนน • งานค้าง • เช็กชื่อ • พฤติกรรม/จิตพิสัย • สรุปเกรด";
const DEFAULT_BEHAVIORS = [
  { id: "b1", label: "ไม่ตั้งใจเรียน", icon: "😴", points: 2 },
  { id: "b2", label: "กินขนมในห้อง", icon: "🍬", points: 2 },
  { id: "b3", label: "เล่นโทรศัพท์", icon: "📱", points: 2 },
  { id: "b4", label: "ไม่ส่งงานในคาบ", icon: "📝", points: 2 },
  { id: "b5", label: "คุย/รบกวนเพื่อน", icon: "💬", points: 2 },
  { id: "b6", label: "ไม่นำอุปกรณ์มา", icon: "🎒", points: 2 }
];
const DEFAULT_SETTINGS = {
  lateGraceDays: 0,      // อนุโลมกี่วัน
  lateDeductPerDay: 5,   // หักกี่ % ต่อวัน
  maxLateDeduct: 50,     // หักสูงสุดกี่ %
  missingAsZero: false,  // นับงานค้างเป็น 0
  totalMode: "points",   // points = รวมคะแนนดิบ, weighted = เฉลี่ย % ถ่วงน้ำหนัก
  teacherPin: "",
  behaviorFull: 100,     // คะแนนจิตพิสัยเต็ม
  attendanceMin: 80,     // เวลาเรียนขั้นต่ำ (%) ต่ำกว่านี้เสี่ยง มส.
  behaviorTypes: DEFAULT_BEHAVIORS
};
/* โครงสร้างคะแนนของรายวิชา
   thai   = คะแนนเก็บ (รวมดิบแล้วแปลงเป็น collect คะแนน) + กลางภาค + ปลายภาค  → รวมเต็ม collect+mid+final
   simple = รวมคะแนนดิบทุกงานเป็นร้อยละ (แบบเดิม V7) */
const DEFAULT_SCHEME = { type: "thai", collect: 80, mid: 0, final: 20 };
const PARTS = {
  collect: { label: "คะแนนเก็บ", short: "เก็บ", icon: "📝" },
  mid: { label: "สอบกลางภาค", short: "กลางภาค", icon: "📘" },
  final: { label: "สอบปลายภาค", short: "ปลายภาค", icon: "📕" }
};
const PART_ORDER = ["collect", "mid", "final"];
const GRADE_SCALE = [[80, "4"], [75, "3.5"], [70, "3"], [65, "2.5"], [60, "2"], [55, "1.5"], [50, "1"], [0, "0"]];
const ATT = {
  present: { label: "มา", short: "ม", cls: "p" },
  late: { label: "สาย", short: "ส", cls: "l" },
  leave: { label: "ลา", short: "ล", cls: "leave" },
  absent: { label: "ขาด", short: "ข", cls: "a", tip: "ไม่มาโรงเรียน/ไม่แจ้งลา" },
  skip: { label: "หนีเรียน", short: "น", cls: "skip", tip: "มาโรงเรียนแต่ไม่เข้าเรียน" }
};
const MARK = {
  done: { label: "ส่งแล้ว", cls: "p" },
  late: { label: "ส่งช้า", cls: "l" },
  waiting: { label: "รอตรวจ", cls: "leave" },
  pending: { label: "ยังไม่ถึงกำหนด", cls: "gray" },
  missing: { label: "ค้างส่ง", cls: "a" }
};
/* เมนูครู: [คีย์หน้า, ไอคอน, ชื่อเต็ม, ชื่อสั้น (แถบล่างบนมือถือ)] */
const NAV = [
  { group: "งานประจำวัน", items: [
    ["dash", "dash", "ภาพรวม", "ภาพรวม"],
    ["work", "scorebook", "ตารางคะแนน", "คะแนน"],
    ["attend", "attend", "เช็กชื่อ", "เช็กชื่อ"],
    ["behavior", "behavior", "พฤติกรรม/จิตพิสัย", "พฤติกรรม"],
    ["report", "report", "รายงาน", "รายงาน"]] },
  { group: "จัดการ", items: [
    ["students", "students", "ชั้น/ห้อง/นักเรียน", "นักเรียน"],
    ["set", "settings", "ตั้งค่า", "ตั้งค่า"]] }
];
/* ชื่อหน้าเก่า → หน้าใหม่ (ลิงก์/ปุ่มเดิมยังใช้ได้) */
const PAGE_ALIAS = { summary: ["report", "summary"], missing: ["report", "missing"] };

