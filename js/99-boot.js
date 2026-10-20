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
if (boot.migratedFrom || boot.upgraded) toast("อัปเกรดข้อมูลจากรุ่นเก่าเรียบร้อย — ข้อมูลเดิมครบ", 6000);
else if (boot.needSid) toast("⚠️ เวอร์ชันใหม่: นักเรียนเข้าระบบด้วยรหัสนักเรียน 5 หลัก — กรุณาเพิ่มรหัสที่เมนู ชั้น/ห้อง/นักเรียน", 8000);

try { navigator.storage?.persist?.().catch(() => { }); } catch (e) { }

/* ---------- แจ้งการอัปเดตเวอร์ชัน ---------- */
(() => {
  const K = "smart_scorebook_seen_version", prev = store.get(K);
  if (prev && prev !== APP_VERSION && !boot.needSid) setTimeout(() => toast(`🎉 อัปเดตระบบเป็นเวอร์ชัน ${APP_VERSION} แล้ว (เดิม ${prev}) — ข้อมูลเดิมครบทุกอย่าง`, 6000), 600);
  try { store.set(K, APP_VERSION); } catch (e) { }
})();

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { }));
  // มีเวอร์ชันใหม่ขึ้นเว็บระหว่างเปิดหน้าอยู่ → ชวนรีเฟรช (ข้อมูลไม่หาย)
  navigator.serviceWorker.addEventListener?.("controllerchange", () => {
    if (hadController) toast("มีเวอร์ชันใหม่ของระบบ", 15000, { label: "โหลดใหม่", fn: () => location.reload() });
  });
}
