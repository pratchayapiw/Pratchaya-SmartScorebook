/* Smart Scorebook — Service Worker
   ออนไลน์: โหลดไฟล์ล่าสุดจากเว็บเสมอ (อัปเดตแอปแล้วเห็นทันที)
   ออฟไลน์: ใช้ไฟล์ที่เก็บไว้ในเครื่อง จึงเปิดใช้งานได้แม้ไม่มีอินเทอร์เน็ต
   หมายเหตุ: ข้อมูลคะแนนอยู่ใน localStorage ไม่ได้อยู่ในแคชนี้ */
const CACHE = "scorebook-v8.1.3";
const SHELL = ["./", "index.html", "style.css", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "js/00-config.js", "js/01-utils.js", "js/02-store.js", "js/03-model.js", "js/04-ui.js", "js/05-layout.js", "js/10-dashboard.js", "js/11-classes.js", "js/12-import.js", "js/13-gradebook.js", "js/14-attendance.js", "js/15-behavior.js", "js/16-reports.js", "js/17-settings.js", "js/18-security.js", "js/19-term.js", "js/20-student.js", "js/22-memo.js", "js/23-memo-docs.js", "js/99-boot.js", "img/garuda.png", "img/icons/attend.webp", "img/icons/behavior.webp", "img/icons/dash.webp", "img/icons/download.webp", "img/icons/memo.webp", "img/icons/missing.webp", "img/icons/report.webp", "img/icons/scorebook.webp", "img/icons/settings.webp", "img/icons/students.webp", "img/icons/teach.webp", "lib/jszip.min.js", "lib/html2canvas.min.js", "lib/jspdf.umd.min.js", "lib/exceljs.min.js", "fonts/THSarabunNew.woff", "fonts/THSarabunNew-Bold.woff"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("scorebook-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // ฟอนต์ Google: ใช้จากแคชก่อน (ไม่ค่อยเปลี่ยน)
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => hit)));
    return;
  }
  if (url.origin !== location.origin) return;

  // ไฟล์ของแอป: เน็ตก่อน → ถ้าไม่มีเน็ตใช้แคช
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
