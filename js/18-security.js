"use strict";
/* =============================================================
   รหัสครู (PIN) และระบบ "ลืมรหัส"
   วิธีกู้คืน 2 แบบ (ทำงานในเครื่อง ไม่ต้องมีเซิร์ฟเวอร์):
     1) รหัสกู้คืน 12 ตัวอักษร — พิมพ์เก็บ / ดาวน์โหลด / ส่งเข้าอีเมลตัวเอง (ใช้ได้ครั้งเดียว)
     2) คำถามกันลืม — ตอบถูกแล้วปลดล็อก
   เก็บเฉพาะ "ค่าแฮช" ของรหัสกู้คืนและคำตอบ ไม่เก็บตัวจริง
   ข้อมูลอยู่ที่ db.security = { email, salt, codeHash, codeCreated, question, answerHash }
   ============================================================= */

const SEC_QUESTIONS = [
  "ชื่อโรงเรียนประถมที่ครูเคยเรียน",
  "ชื่อสัตว์เลี้ยงตัวแรก",
  "ชื่อเล่นของเพื่อนสนิทสมัยเด็ก",
  "จังหวัดที่เกิด",
  "เมนูอาหารที่ชอบที่สุด",
  "ชื่อครูประจำชั้นที่ประทับใจที่สุด"
];
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ไม่มี I, L, O, 0, 1 ที่สับสนง่าย

/** แฮชแบบซิงก์ (cyrb53 สองรอบ) — พอสำหรับกันการเปิดดูในเครื่อง ใช้ได้ทั้ง file:// และ https */
function hashSecret(text, salt = db.security.salt) {
  const h = (str, seed) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  };
  let out = salt + "|" + text;
  for (let i = 0; i < 2000; i++) out = h(out, i) + h(out, i * 7 + 3); // วนหลายรอบให้เดายากขึ้น
  return out;
}
const normCode = s => toArabic(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const normAnswer = s => toArabic(s).toLowerCase().replace(/\s+/g, "").replace(/[.,'"!?]/g, "");
const hasCode = () => !!db.security.codeHash;
const hasQuestion = () => !!(db.security.question && db.security.answerHash);
const hasRecovery = () => hasCode() || hasQuestion();

function genRecoveryCode() {
  const buf = new Uint32Array(12);
  (window.crypto || window.msCrypto).getRandomValues(buf);
  const raw = [...buf].map(n => CODE_CHARS[n % CODE_CHARS.length]).join("");
  return raw.match(/.{4}/g).join("-");
}

/* ---------- ส่วนในหน้าตั้งค่า ---------- */
function securitySection() {
  const s = db.security, pinSet = !!db.settings.teacherPin;
  const row = (ok, icon, title, desc, btn) => `<div class="secrow ${ok ? "ok" : ""}"><span class="secicon">${ok ? "✅" : icon}</span><div class="grow"><b>${title}</b><div class="muted small">${desc}</div></div>${btn}</div>`;
  return `<div class="secbox">
    <div class="section-head" style="margin-bottom:6px"><h3 style="margin:0">🔐 กันลืมรหัสครู</h3>${pinSet && !hasRecovery() ? '<span class="pill a">ยังไม่มีวิธีกู้คืน!</span>' : ""}</div>
    ${row(hasCode(), "🔑", "รหัสกู้คืน (แนะนำ)", hasCode() ? `สร้างเมื่อ ${fmtDateTime(s.codeCreated)} • ใช้ได้ครั้งเดียว — ถ้าหาไม่เจอให้สร้างใหม่` : "รหัส 12 ตัวอักษรสำหรับปลดล็อกเมื่อลืม PIN — พิมพ์ / ดาวน์โหลด / ส่งเข้าอีเมลเก็บไว้", `<button type="button" class="btn small" onclick="showNewRecoveryCode()">${hasCode() ? "สร้างใหม่" : "สร้างรหัสกู้คืน"}</button>`)}
    ${row(hasQuestion(), "❓", "คำถามกันลืม", hasQuestion() ? `คำถาม: “${esc(s.question)}”` : "ตอบคำถามที่ตั้งไว้เพื่อปลดล็อก", `<button type="button" class="btn small" onclick="setSecurityQuestion()">${hasQuestion() ? "เปลี่ยน" : "ตั้งคำถาม"}</button>`)}
    <label class="secmail">📧 อีเมลของครู (สำหรับส่งรหัสกู้คืนเข้าอีเมลตัวเองเก็บไว้)<input class="input" id="sEmail" type="email" value="${esc(s.email)}" placeholder="teacher@school.ac.th" autocomplete="email"></label>
    <p class="muted small" style="margin:6px 0 0">ระบบนี้ทำงานในเบราว์เซอร์ จึงส่งอีเมลอัตโนมัติไม่ได้ — ปุ่ม “ส่งเข้าอีเมล” จะเปิดแอปอีเมลพร้อมรหัสให้ครูกดส่งถึงตัวเอง</p>
  </div>`;
}

/** สร้างรหัสกู้คืนใหม่ แสดงครั้งเดียว พร้อมปุ่มเก็บรักษา */
function showNewRecoveryCode() {
  const code = genRecoveryCode(), created = new Date().toISOString();
  // รหัสใหม่จะมีผลเมื่อกด "เสร็จสิ้น" เท่านั้น — กดยกเลิก รหัสเดิมยังใช้ได้
  const email = db.security.email || $("sEmail")?.value.trim() || "";
  const subject = `รหัสกู้คืน Smart Scorebook — ${db.school}`;
  const body = `รหัสกู้คืนสำหรับปลดล็อกหน้าครู (เมื่อลืม PIN)\n\n${code}\n\nระบบ: ${db.appTitle} • ${db.school}\nสร้างเมื่อ: ${fmtDateTime(created)}\nวิธีใช้: หน้าใส่รหัสครู → “ลืมรหัส?” → ใส่รหัสนี้\n(ใช้ได้ครั้งเดียว)`;
  ui.lastCode = { code, body, created };
  modal("🔑 รหัสกู้คืนของครู", `
    <p>เก็บรหัสนี้ไว้ในที่ปลอดภัย <b>ระบบจะแสดงรหัสนี้เพียงครั้งเดียว</b></p>
    <div class="codebox mono" id="codeBox">${code}</div>
    <div class="toolbar codebtns">
      <button class="btn" onclick="copyText(ui.lastCode.code,'คัดลอกรหัสแล้ว')">📋 คัดลอก</button>
      <button class="btn" onclick="printRecovery()">🖨️ พิมพ์</button>
      <button class="btn" onclick="download(stampName('recovery-code', 'txt'), ui.lastCode.body, 'text/plain;charset=utf-8')">⬇️ ดาวน์โหลด</button>
      <a class="btn" href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">📧 ส่งเข้าอีเมล${email ? "" : " (ใส่อีเมลเอง)"}</a>
    </div>
    <ul class="muted small"><li>ใช้ได้ <b>ครั้งเดียว</b> — ใช้แล้วให้สร้างใหม่ที่ ⚙️ ตั้งค่า</li><li>${hasCode() ? "เมื่อกด “เสร็จสิ้น” รหัสเก่าจะใช้ไม่ได้ทันที (กดยกเลิก = ใช้รหัสเก่าต่อ)" : "กด “เสร็จสิ้น” เพื่อเริ่มใช้รหัสนี้"}</li><li>ตัวพิมพ์เล็ก/ใหญ่ และขีด (-) ไม่มีผล</li></ul>
    <label class="check"><input type="checkbox" id="codeSaved" onchange="$('mok').disabled=!this.checked"> ฉันเก็บรหัสนี้ไว้แล้ว</label>`,
    "เสร็จสิ้น", () => {
      db.security.codeHash = hashSecret(normCode(code));
      db.security.codeCreated = created;
      save(); closeModal(); if (ui.page === "set") settingsPage(); toast("ตั้งรหัสกู้คืนเรียบร้อย ✓"); });
  $("mok").disabled = true;
}

function copyText(text, msg) {
  const done = () => toast(msg || "คัดลอกแล้ว");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => showCopyBox(text));
  else showCopyBox(text);
}

/** พิมพ์ใบรหัสกู้คืนผ่าน iframe ที่ซ่อนไว้ (ไม่โดนบล็อก popup) */
function printRecovery() {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.append(f);
  f.srcdoc = `<!doctype html><html lang="th"><meta charset="utf-8"><title>รหัสกู้คืน</title><body style="font-family:sans-serif;padding:30px">
    <h2 style="margin:0">🔑 รหัสกู้คืนหน้าครู</h2><p>${esc(db.appTitle)} • ${esc(db.school)}</p>
    <div style="font:700 30px monospace;letter-spacing:4px;border:2px dashed #555;padding:18px;text-align:center;margin:18px 0">${esc(ui.lastCode.code)}</div>
    <p>สร้างเมื่อ ${esc(fmtDateTime(ui.lastCode.created))}<br>วิธีใช้: หน้าใส่รหัสครู → “ลืมรหัส?” → ใส่รหัสนี้ (ใช้ได้ครั้งเดียว)</p>
    <p style="color:#a00">เก็บเอกสารนี้ไว้ในที่ปลอดภัย อย่าให้นักเรียนเห็น</p></body></html>`;
  f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); };
}

function setSecurityQuestion() {
  const cur = db.security.question;
  const isPreset = !cur || SEC_QUESTIONS.includes(cur);
  modal("❓ ตั้งคำถามกันลืม", `<div class="form">
      <label class="full">คำถาม<select class="input" id="sq" onchange="$('sqCustomRow').hidden=this.value!=='__c'">${SEC_QUESTIONS.map(q => `<option ${q === cur ? "selected" : ""}>${esc(q)}</option>`).join("")}<option value="__c" ${!isPreset ? "selected" : ""}>✏️ ตั้งคำถามเอง…</option></select></label>
      <label class="full" id="sqCustomRow" ${isPreset ? "hidden" : ""}>คำถามของครู<input class="input" id="sqc" maxlength="150" value="${isPreset ? "" : esc(cur)}"></label>
      <label>คำตอบ<input class="input" id="sa1" type="password" autocomplete="off"></label>
      <label>พิมพ์คำตอบอีกครั้ง<input class="input" id="sa2" type="password" autocomplete="off"></label>
    </div><p class="muted small">ไม่สนใจช่องว่างและตัวพิมพ์เล็ก/ใหญ่ • เลือกคำถามที่นักเรียนเดาไม่ได้ • คำตอบเก็บแบบเข้ารหัส ครูดูย้อนหลังไม่ได้</p>`, "บันทึก", () => {
    const q = $("sq").value === "__c" ? $("sqc").value.trim() : $("sq").value;
    const a1 = normAnswer($("sa1").value), a2 = normAnswer($("sa2").value);
    if (!q) return toast("กรอกคำถาม");
    if (a1.length < 2) return toast("คำตอบสั้นเกินไป");
    if (a1 !== a2) return toast("คำตอบทั้งสองช่องไม่ตรงกัน");
    db.security.question = q;
    db.security.answerHash = hashSecret(a1);
    save(); closeModal(); if (ui.page === "set") settingsPage(); toast("ตั้งคำถามกันลืมแล้ว ✓");
  });
}

/* ---------- หน้าลืมรหัส ---------- */
const recoverGuard = { fails: 0, until: 0 };
function forgotPin(nextPage) {
  const q = hasQuestion();
  if (!hasRecovery()) {
    modal("ลืมรหัสครู", `<p>ยังไม่ได้ตั้งวิธีกู้คืนไว้ (รหัสกู้คืน / คำถามกันลืม)</p>
      <p class="muted small">วิธีสุดท้ายบนคอมพิวเตอร์: กด <span class="kbd">F12</span> → แท็บ Console → พิมพ์ <code>db.settings.teacherPin=""; save()</code> แล้วกด Enter จากนั้นรีเฟรชหน้า</p>
      <p class="muted small">หลังเข้าได้แล้ว แนะนำให้ตั้ง “รหัสกู้คืน” ที่ ⚙️ ตั้งค่า → ทั่วไป</p>`, "← กลับไปใส่รหัส", () => askPin(nextPage));
    return;
  }
  modal("🔓 ลืมรหัสครู", `
    ${hasCode() ? `<div class="recbox"><b>🔑 ใช้รหัสกู้คืน</b><input class="input mono" id="rcode" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" style="width:100%;margin-top:6px;letter-spacing:2px"></div>` : ""}
    ${hasCode() && q ? `<div class="ordiv"><span>หรือ</span></div>` : ""}
    ${q ? `<div class="recbox"><b>❓ ตอบคำถามกันลืม</b><div class="muted" style="margin:4px 0">${esc(db.security.question)}</div><input class="input" id="rans" type="password" placeholder="คำตอบ" autocomplete="off" style="width:100%"></div>` : ""}
    <div id="recMsg" class="loginmsg" role="alert"></div>`, "ปลดล็อก", () => tryRecover(nextPage));
  ($("rcode") || $("rans"))?.focus();
}

function tryRecover(nextPage) {
  const msg = t => { const el = $("recMsg"); el.textContent = "⚠️ " + t; el.className = "loginmsg show"; };
  if (Date.now() < recoverGuard.until) return msg(`ลองผิดหลายครั้ง กรุณารอ ${Math.ceil((recoverGuard.until - Date.now()) / 1000)} วินาที`);
  const code = $("rcode") ? normCode($("rcode").value) : "", ans = $("rans") ? normAnswer($("rans").value) : "";
  if (!code && !ans) return msg("กรอกรหัสกู้คืน หรือคำตอบ");
  let how = "";
  if (code && hasCode() && hashSecret(code) === db.security.codeHash) how = "code";
  else if (ans && hasQuestion() && hashSecret(ans) === db.security.answerHash) how = "question";
  if (!how) {
    recoverGuard.fails++;
    if (recoverGuard.fails >= 5) { recoverGuard.fails = 0; recoverGuard.until = Date.now() + 60000; return msg("ไม่ถูกต้อง 5 ครั้ง ระบบพัก 1 นาที"); }
    return msg(code && ans ? "รหัสกู้คืนและคำตอบไม่ถูกต้อง" : code ? "รหัสกู้คืนไม่ถูกต้อง" : "คำตอบไม่ถูกต้อง");
  }
  recoverGuard.fails = 0;
  db.settings.teacherPin = "";
  if (how === "code") { db.security.codeHash = ""; db.security.codeCreated = ""; } // ใช้ได้ครั้งเดียว
  save();
  ui.unlocked = true;
  closeModal();
  teacher("set");
  setTimeout(() => { $("setGeneral")?.scrollIntoView({ block: "start" }); $("sPin")?.focus(); }, 60);
  toast(how === "code" ? "ปลดล็อกแล้ว — ล้าง PIN เดิมแล้ว กรุณาตั้ง PIN ใหม่ และสร้างรหัสกู้คืนใหม่ (รหัสเดิมใช้แล้ว)" : "ปลดล็อกแล้ว — ล้าง PIN เดิมแล้ว กรุณาตั้ง PIN ใหม่", 8000);
}
