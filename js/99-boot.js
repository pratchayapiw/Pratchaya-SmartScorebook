"use strict";
/* =============================================================
   เริ่มต้นระบบ
   ต้องโหลดเป็นไฟล์สุดท้าย
   ============================================================= */
/* ---------- เริ่มต้น ---------- */
fixSelection();
boot.needSid = db.students.length && db.students.every(s => !s.sid);
save();            // บันทึกข้อมูลที่ตรวจ/ซ่อมแล้ว
dailySnapshot();   // จุดบันทึกอัตโนมัติวันละ 1 ครั้ง
home();
if (boot.migratedFrom || boot.upgraded) toast("อัปเกรดข้อมูลเป็นเวอร์ชัน 6 เรียบร้อย", 6000);
else if (boot.needSid) toast("⚠️ เวอร์ชันใหม่: นักเรียนเข้าระบบด้วยรหัสนักเรียน 5 หลัก — กรุณาเพิ่มรหัสที่เมนู ชั้น/ห้อง/นักเรียน", 8000);

try { navigator.storage?.persist?.().catch(() => { }); } catch (e) { }

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { }));
}
