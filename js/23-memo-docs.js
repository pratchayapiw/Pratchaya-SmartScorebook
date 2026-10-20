"use strict";
/* =============================================================
   ไฟล์บันทึกข้อความตาม “ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ” (แบบบันทึกข้อความ)
   ใช้ค่ากลางชุดเดียว (SB) กับทุกรูปแบบ: หน้าจอ • พิมพ์ • PDF • Word • Excel
   ============================================================= */

/** ค่ามาตรฐานงานสารบรรณ (หน่วย: มม. / พอยต์) */
const SB = {
  page: { w: 210, h: 297 },
  margin: { top: 15, right: 20, bottom: 20, left: 30 }, // ขอบบน 1.5 • ขวา 2 • ล่าง 2 • ซ้าย 3 ซม.
  textW: 160,                                          // พื้นที่พิมพ์กว้าง 16 ซม.
  garudaH: 15,                                         // ครุฑบันทึกข้อความสูง 1.5 ซม.
  font: "TH SarabunIT๙",
  pt: { title: 29, label: 20, text: 16, table: 16, head: 14, grid: 14, pageNo: 16 }, // หัวตาราง 14 ตัวหนา (ช่องแคบ) • เนื้อความในตาราง 16
  titleLine: 35,                                       // “บันทึกข้อความ” ระยะบรรทัดแน่นอน 35 พ.
  indent: 25                                           // ย่อหน้า 2.5 ซม.
};
/** ความกว้างคอลัมน์ตาราง (ซม.) รวม 16 ซม. พอดีพื้นที่พิมพ์ */
const MEMO_COLS = { zero: [1.6, 5.0, 2.0, 1.8, 5.6], r: [1.6, 5.0, 2.0, 1.8, 5.6], ms: [1.5, 4.1, 1.7, 1.1, 1.1, 1.1, 1.8, 1.8, 1.8] };
const MS_HEAD = { c1: "ลำดับ\nที่", c7: "รวมเวลา\nที่ไม่มา\nเรียน/\nครั้ง", c8: "รวมเวลา\nที่มา\nเรียน/\nครั้ง", c9: "ร้อยละ\nของการ\nมาเรียน" };
const brHTML = s => esc(s).replace(/\n/g, "<br>");

/** ข้อความช่องความเห็น 4 ช่อง (ตามแบบฟอร์มโรงเรียน) */
function memoGrid(D) {
  const c = D.cfg;
  return [
    ["ความคิดเห็นหัวหน้ากลุ่มสาระการเรียนรู้", c.groupHead, "หัวหน้ากลุ่มสาระการเรียนรู้" + (D.co.group || "..........................")],
    ["ความคิดเห็นหัวหน้างานวัดและประเมินผลการศึกษา", c.measureHead, "หัวหน้างานวัดและประเมินผลการศึกษา"],
    ["ความคิดเห็นรองผู้อำนวยการกลุ่มบริหารวิชาการ", c.deputy, "รองผู้อำนวยการกลุ่มบริหารวิชาการ"],
    ["ความคิดเห็นผู้อำนวยการโรงเรียน", c.director, c.directorTitle]
  ];
}
const NAME_BLANK = "................................................";

/* =============================================================
   1) หน้ากระดาษ HTML (ตัวอย่างบนจอ • พิมพ์ • ต้นฉบับ PDF)
   ============================================================= */
function memoPaperHTML(D, T) {
  const cfg = D.cfg, x = s => esc(thaiDigits(s)), ms = D.type === "ms";
  const cols = `<colgroup>${MEMO_COLS[D.type].map(w => `<col style="width:${w}cm">`).join("")}</colgroup>`;
  const field = (label, val) => `<span class="mlab">${label}</span><span class="mval">${x(val || "")}</span>`;
  const head = ms
    ? `<tr><th rowspan="2">${brHTML(MS_HEAD.c1)}</th><th rowspan="2">ชื่อ - สกุล</th><th rowspan="2">ชั้น</th><th colspan="3">สาเหตุที่<br>ไม่มาเรียน</th><th rowspan="2">${brHTML(MS_HEAD.c7)}</th><th rowspan="2">${brHTML(MS_HEAD.c8)}</th><th rowspan="2">${brHTML(MS_HEAD.c9)}</th></tr><tr><th>ป่วย</th><th>ลา</th><th>ขาด</th></tr>`
    : `<tr>${T.head.map(h => `<th>${brHTML(h)}</th>`).join("")}</tr>`;
  const body = T.rows.length
    ? T.rows.map(r => `<tr>${r.map((v, j) => `<td class="${j === 1 || (!ms && j === 4) ? "ml" : ""}">${x(v)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${T.head.length}">— ไม่มี —</td></tr>`;
  const grid = memoGrid(D).map(([t, n, r]) => `<td><div>${x(t)}</div><div class="mdots"></div><div class="mdots"></div><div class="mgap"></div><div class="mc">(${n ? x(n) : NAME_BLANK})</div><div class="mc">${x(r)}</div></td>`);
  return `<div class="memopaper">
    <div class="mhead"><img src="img/garuda.png" class="garuda" alt="ตราครุฑ"><div class="mtitle">บันทึกข้อความ</div></div>
    <div class="mf">${field("ส่วนราชการ", cfg.agency)}</div>
    <div class="mf"><div class="mf mhalf">${field("ที่", cfg.docNo)}</div><div class="mf mrest">${field("วันที่", thaiLongDate(D.date))}</div></div>
    <div class="mf">${field("เรื่อง", T.subject)}</div>
    <p class="mto">เรียน&nbsp;&nbsp;${x(cfg.directorTitle)}</p>
    <p class="mbody">${x(T.body)}</p>
    <table class="mtable ${D.type}">${cols}<thead>${head}</thead><tbody>${body}</tbody></table>
    <div class="mend">
      ${T.follow ? `<p class="mpara">โดยข้าพเจ้าได้ติดตามและตักเตือนมาโดยตลอด ตามหลักฐานที่แนบมานี้</p>` : ""}
      <p class="mpara mclose">จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุมัติ</p>
      <div class="msig"><div class="msigspace"></div><div>(${x(T.teacher)})</div><div>ครูประจำวิชา</div></div>
    </div>
    <table class="mgrid"><colgroup><col style="width:8cm"><col style="width:8cm"></colgroup><tbody><tr>${grid[0]}${grid[1]}</tr><tr>${grid[2]}${grid[3]}</tr></tbody></table>
  </div>`;
}

/* ---------- พิมพ์จากเบราว์เซอร์ (เลขหน้าไทยกึ่งกลางด้านบน ตั้งแต่หน้า ๒) ---------- */
async function printMemo() {
  const src = document.querySelector(".memopreview .memopaper"); if (!src) return;
  await memoFontsReady();
  $("memoPrint")?.remove();
  const box = document.createElement("div"); box.id = "memoPrint"; box.append(src.cloneNode(true)); document.body.append(box);
  document.body.classList.add("printing-memo");
  const m = SB.margin, pg = document.createElement("style"); pg.id = "memoPage";
  pg.textContent = `@page { size: A4 portrait; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
      @top-center { content: "- " counter(page, thai) " -"; font-family: MemoTH, "${SB.font}"; font-size: ${SB.pt.pageNo}pt; vertical-align: bottom } }
    @page :first { @top-center { content: none } }`;
  document.head.append(pg);
  const done = () => { document.body.classList.remove("printing-memo"); $("memoPage")?.remove(); $("memoPrint")?.remove(); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  const img = box.querySelector("img");
  if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 3000); });
  window.print();
}

/* ---------- ตัวช่วยดาวน์โหลด ---------- */
function memoFileName(type, ext) {
  const D = memoData(type), code = String(D.co.code || "").replace(/[^\w]/g, "") || "course";
  const room = ui.memoScope === "room" ? "-" + fileSafe(cls(ui.classId)) : "";
  return stampName(`memo-${type}-${code}${room}_term${db.term.semester}-${db.term.year}`, ext);
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function busy(btnId, label, fn) {
  const b = $(btnId), old = b?.innerHTML;
  if (b) { b.disabled = true; b.innerHTML = "⏳ " + label; }
  try { await fn(); } finally { if (b && document.body.contains(b)) { b.disabled = false; b.innerHTML = old; } }
}
async function memoFontsReady() {
  await Promise.all([`400 ${SB.pt.text}pt MemoTH`, `700 ${SB.pt.text}pt MemoTH`].map(f => document.fonts.load(f, "กข๑"))).catch(() => {});
  await document.fonts.ready;
}
async function garudaBase64() {
  const blob = await (await fetch("img/garuda.png")).blob();
  return new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
}

/* =============================================================
   2) PDF — ถ่ายภาพหน้ากระดาษความละเอียดสูง (ภาษาไทยถูกต้อง) แล้วแบ่งหน้าตามระเบียบ
      หน้า ๑ ไม่มีเลขหน้า • หน้า ๒ ขึ้นไป: “- ๒ -” กึ่งกลางด้านบน + หัวตารางซ้ำ • ไม่ตัดกลางแถว
   ============================================================= */
async function buildMemoPdf(D, T) {
  await Promise.all([loadScript("lib/html2canvas.min.js"), loadScript("lib/jspdf.umd.min.js")]);
  await memoFontsReady();
  $("memoPdfBox")?.remove();
  const box = document.createElement("div"); box.id = "memoPdfBox"; box.innerHTML = memoPaperHTML(D, T); document.body.append(box);
  try {
    const paper = box.firstElementChild;
    const img = paper.querySelector("img"); if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; });
    const W = paper.offsetWidth, mm = W / SB.page.w, top0 = paper.getBoundingClientRect().top;
    const yOf = el => el.getBoundingClientRect().bottom - top0;
    const pageNoH = 12;                                   // แถบเลขหน้า (มม.) เหนือเนื้อความหน้า ๒ ขึ้นไป
    const room1 = (SB.page.h - SB.margin.bottom) * mm;    // หน้า ๑ เริ่มที่ขอบกระดาษ (ภาพรวมขอบบนแล้ว)
    const roomN = (SB.page.h - SB.margin.top - pageNoH - SB.margin.bottom) * mm;
    // จุดตัดหน้าที่อนุญาต: ท้ายแต่ละส่วน • ท้ายแถวตาราง • ท้ายแถวช่องความเห็น (ส่วนลงนามไม่แยกจากคำลงท้าย)
    const cuts = new Set();
    [...paper.children].forEach(el => {
      if (el.matches(".mtable")) el.querySelectorAll("thead, tbody tr").forEach(r => cuts.add(yOf(r)));
      if (el.matches(".mgrid")) el.querySelectorAll("tr").forEach(r => cuts.add(yOf(r)));
      cuts.add(yOf(el));
    });
    const end = yOf(paper.lastElementChild) + 4;
    const points = [...cuts].filter(y => y > 0 && y <= end).sort((a, b) => a - b);
    const tb = paper.querySelector(".mtable"), th = tb.querySelector("thead");
    const hTop = th.getBoundingClientRect().top - top0, hBot = yOf(th), tBot = yOf(tb), hh = hBot - hTop;
    const inTable = y => y >= hBot - 1 && y < tBot - 1;
    const pages = []; let y = 0;
    while (y < end - 1) {
      const first = !pages.length, rep = !first && inTable(y);
      const room = (first ? room1 : roomN) - (rep ? hh : 0);
      let next = end - y <= room ? end : points.filter(p => p > y && p - y <= room).pop();
      if (next === undefined) next = Math.min(end, y + room);
      pages.push([y, next, rep]); y = next;
    }
    const scale = 3;
    const canvas = await html2canvas(paper, { scale, backgroundColor: "#ffffff", logging: false, windowWidth: W + 40 });
    const slice = (a, b) => {
      const c = document.createElement("canvas"); c.width = canvas.width; c.height = Math.max(1, Math.ceil((b - a) * scale));
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(canvas, 0, Math.floor(a * scale), c.width, c.height, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.9);
    };
    const pageNo = n => { // “- ๒ -” ด้วยฟอนต์เดียวกับเอกสาร
      const c = document.createElement("canvas"), px = SB.pt.pageNo * 96 / 72 * scale;
      c.width = Math.round(60 * mm * scale); c.height = Math.round(px * 1.6);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = "#000"; g.font = `${px}px MemoTH, "${SB.font}"`; g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.fillText(`- ${thaiDigits(n)} -`, c.width / 2, px * 1.15);
      return { src: c.toDataURL("image/png"), w: c.width / scale / mm, h: c.height / scale / mm };
    };
    const pdf = new jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const headImg = slice(hTop, hBot);
    pages.forEach(([a, b, rep], i) => {
      if (i) pdf.addPage();
      let yOff = 0;
      if (i) {
        const n = pageNo(i + 1);
        pdf.addImage(n.src, "PNG", (SB.page.w - n.w) / 2, SB.margin.top - n.h * 0.55, n.w, n.h);
        yOff = SB.margin.top + pageNoH - (a > 0 ? 0 : SB.margin.top);
      }
      if (rep) { pdf.addImage(headImg, "JPEG", 0, yOff, SB.page.w, hh / mm, undefined, "FAST"); yOff += hh / mm; }
      pdf.addImage(slice(a, b), "JPEG", 0, yOff, SB.page.w, (b - a) / mm, undefined, "FAST");
    });
    pdf.setProperties({ title: T.subject, author: T.teacher, subject: "บันทึกข้อความ", creator: "Smart Scorebook" });
    return pdf.output("blob");
  } finally { box.remove(); }
}
async function downloadMemoPdf() {
  const type = ui.memoType || "zero";
  await busy("memoPdfBtn", "กำลังสร้าง PDF…", async () => {
    try { const D = memoData(type); saveBlob(await buildMemoPdf(D, memoTexts(D)), memoFileName(type, "pdf")); toast("ดาวน์โหลด PDF แล้ว — พิมพ์หรือส่งไฟล์ได้ทันที"); }
    catch (e) { console.error(e); toast("สร้าง PDF ไม่สำเร็จ — ใช้ปุ่มพิมพ์ แล้วเลือก “บันทึกเป็น PDF” แทนได้", 6000); }
  });
}

/* =============================================================
   3) Word (.docx) — สร้างเอกสารใหม่ทั้งฉบับตามค่ามาตรฐาน (ไม่อิงไฟล์ที่ตั้งค่ากระดาษ Letter)
   ============================================================= */
const xe = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const twip = mm => Math.round(mm / 25.4 * 1440);
const hp = pt => Math.round(pt * 2); // half-points
function wR(text, o = {}) {
  const sz = hp(o.pt || SB.pt.text);
  const t = text !== "" && text != null ? String(text).split("\n").map(x => `<w:t xml:space="preserve">${xe(thaiDigits(x))}</w:t>`).join("<w:br/>") : "";
  return `<w:r><w:rPr>${o.b ? "<w:b/><w:bCs/>" : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>${o.tab ? "<w:tab/>" : ""}${t}</w:r>`;
}
function wP(runs, o = {}) {
  const sp = `<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}"${o.line ? ` w:line="${o.line}" w:lineRule="${o.rule || "exact"}"` : ""}/>`;
  const ind = o.first || o.left || o.right ? `<w:ind${o.left ? ` w:left="${o.left}"` : ""}${o.right ? ` w:right="${o.right}"` : ""}${o.first ? ` w:firstLine="${o.first}"` : ""}/>` : "";
  const tabs = o.tabs ? `<w:tabs>${o.tabs.map(t => `<w:tab w:val="${t.val}" w:leader="${t.leader || "none"}" w:pos="${t.pos}"/>`).join("")}</w:tabs>` : "";
  return `<w:p><w:pPr>${o.keepNext ? "<w:keepNext/>" : ""}${o.keepLines ? "<w:keepLines/>" : ""}${tabs}${sp}${ind}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ""}</w:pPr>${runs}</w:p>`;
}
function wCell(wTw, paras, o = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${wTw}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ""}${o.vm ? `<w:vMerge${o.vm === "restart" ? ' w:val="restart"' : ""}/>` : ""}<w:vAlign w:val="${o.v || "center"}"/></w:tcPr>${paras || wP("")}</w:tc>`;
}
function wTable(widthsTw, rowsXml, o = {}) {
  const b = o.noBorder ? "nil" : "single";
  const bd = ["top", "left", "bottom", "right", "insideH", "insideV"].map(k => `<w:${k} w:val="${b}" w:sz="4" w:space="0" w:color="000000"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${widthsTw.reduce((a, c) => a + c, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${bd}</w:tblBorders><w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widthsTw.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rowsXml}</w:tbl>`;
}
const wTr = (cells, o = {}) => `<w:tr><w:trPr><w:cantSplit/>${o.header ? "<w:tblHeader/>" : ""}</w:trPr>${cells}</w:tr>`;

async function buildMemoDocx(D, T) {
  await loadScript("lib/jszip.min.js");
  const cfg = D.cfg, ms = D.type === "ms", tw = twip(SB.textW), half = Math.round(tw / 2), first = twip(SB.indent);
  const gW = 125, gH = 119, cy = 540000, cx = Math.round(cy * gW / gH); // ครุฑสูง 1.5 ซม. (EMU)
  const garuda = `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251659264" behindDoc="0" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${SB.margin.top * 36000}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="ตราครุฑ"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="garuda.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdGaruda"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
  const lab = t => wR(t, { b: true, pt: SB.pt.label });
  const dotTo = pos => ({ val: pos === tw ? "right" : "left", leader: "dot", pos });
  const parts = [];
  // ส่วนหัว
  parts.push(wP(garuda + wR("บันทึกข้อความ", { b: true, pt: SB.pt.title }), { jc: "center", line: SB.titleLine * 20, rule: "exact" }));
  parts.push(wP(lab("ส่วนราชการ") + wR("  " + cfg.agency) + wR("", { tab: true }), { tabs: [dotTo(tw)] }));
  parts.push(wP(lab("ที่") + wR("  " + (cfg.docNo || "")) + wR("", { tab: true }) + lab("วันที่") + wR("  " + thaiLongDate(D.date)) + wR("", { tab: true }), { tabs: [dotTo(half), dotTo(tw)] }));
  parts.push(wP(lab("เรื่อง") + wR("  " + T.subject) + wR("", { tab: true }), { tabs: [dotTo(tw)] }));
  parts.push(wP(wR("เรียน  " + cfg.directorTitle), { before: 120 }));
  parts.push(wP(wR(T.body), { before: 120, after: 120, first, jc: "thaiDistribute" }));
  // ตารางรายชื่อ
  const cw = MEMO_COLS[D.type].map(c => twip(c * 10));
  const hP = (t, pt = SB.pt.head) => wP(wR(t, { b: true, pt }), { jc: "center" });
  let rows = "";
  if (ms) {
    const sm = 13;
    rows += wTr(wCell(cw[0], hP(MS_HEAD.c1, sm), { vm: "restart" }) + wCell(cw[1], hP("ชื่อ - สกุล"), { vm: "restart" }) + wCell(cw[2], hP("ชั้น"), { vm: "restart" })
      + wCell(cw[3] + cw[4] + cw[5], hP("สาเหตุที่\nไม่มาเรียน", sm), { span: 3 })
      + wCell(cw[6], hP(MS_HEAD.c7, sm), { vm: "restart" }) + wCell(cw[7], hP(MS_HEAD.c8, sm), { vm: "restart" }) + wCell(cw[8], hP(MS_HEAD.c9, sm), { vm: "restart" }), { header: true });
    rows += wTr(wCell(cw[0], "", { vm: "cont" }) + wCell(cw[1], "", { vm: "cont" }) + wCell(cw[2], "", { vm: "cont" })
      + ["ป่วย", "ลา", "ขาด"].map((t, i) => wCell(cw[3 + i], hP(t, sm))).join("")
      + wCell(cw[6], "", { vm: "cont" }) + wCell(cw[7], "", { vm: "cont" }) + wCell(cw[8], "", { vm: "cont" }), { header: true });
  } else rows += wTr(T.head.map((h, i) => wCell(cw[i], hP(h))).join(""), { header: true });
  const data = T.rows.length ? T.rows : [["", "— ไม่มี —", ...Array(T.head.length - 2).fill("")]];
  data.forEach(vals => {
    rows += wTr(vals.map((v, j) => wCell(cw[j], wP(wR(String(v ?? "")), { jc: j === 1 || (!ms && j === 4) ? "left" : "center" }), { v: "top" })).join(""));
  });
  parts.push(wTable(cw, rows));
  // คำลงท้าย + ลงชื่อ (ไม่แยกหน้ากัน)
  if (T.follow) parts.push(wP(wR("โดยข้าพเจ้าได้ติดตามและตักเตือนมาโดยตลอด ตามหลักฐานที่แนบมานี้"), { before: 120, first, keepNext: true }));
  parts.push(wP(wR("จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุมัติ"), { before: 240, first, keepNext: true }));
  for (let i = 0; i < 3; i++) parts.push(wP("", { keepNext: true }));                 // เว้น 3 บรรทัดสำหรับลายมือชื่อ
  parts.push(wP(wR(`(${T.teacher})`), { left: half, jc: "center", keepNext: true }));
  parts.push(wP(wR("ครูประจำวิชา"), { left: half, jc: "center" }));
  // ช่องความเห็น 2 × 2
  parts.push(wP("", { line: 240, rule: "exact" }));
  const gp = (t, jc) => wP(wR(t, { pt: SB.pt.grid }), { jc, line: 340, rule: "exact" });
  const gCell = ([t, n, r]) => wCell(half, gp(t, "left") + gp("....................................................................", "left") + gp("....................................................................", "left") + gp("", "left") + gp(`(${n || NAME_BLANK})`, "center") + gp(r, "center"), { v: "top" });
  const G = memoGrid(D);
  parts.push(wTable([half, half], wTr(gCell(G[0]) + gCell(G[1])) + wTr(gCell(G[2]) + gCell(G[3]))));
  const m = SB.margin;
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:headerReference w:type="first" r:id="rIdHdr1"/><w:pgSz w:w="${twip(SB.page.w)}" w:h="${twip(SB.page.h)}"/><w:pgMar w:top="${twip(m.top)}" w:right="${twip(m.right)}" w:bottom="${twip(m.bottom)}" w:left="${twip(m.left)}" w:header="${twip(8)}" w:footer="${twip(10)}" w:gutter="0"/><w:titlePg/></w:sectPr>`;
  const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${parts.join("")}${sect}</w:body></w:document>`;
  const pageField = `<w:r><w:t xml:space="preserve">- </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>๒</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t xml:space="preserve"> -</w:t></w:r>`;
  const hdr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${pageField}</w:p></w:hdr>`;
  const hdr1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr></w:r></w:p></w:hdr>`;
  const F = xe(SB.font), sz = hp(SB.pt.text);
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:eastAsia="${F}" w:cs="${F}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="th-TH" w:eastAsia="en-US" w:bidi="th-TH"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:themeFontLang w:val="en-US" w:bidi="th-TH"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(T.subject)}</dc:title><dc:creator>${xe(T.teacher)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/><Relationship Id="rIdGaruda" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/garuda.png"/></Relationships>`);
  zip.file("word/document.xml", doc);
  zip.file("word/styles.xml", styles);
  zip.file("word/settings.xml", settings);
  zip.file("word/header1.xml", hdr);
  zip.file("word/header2.xml", hdr1);
  zip.file("word/media/garuda.png", await garudaBase64(), { base64: true });
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
async function downloadMemoDocx() {
  const type = ui.memoType || "zero";
  try { const D = memoData(type); saveBlob(await buildMemoDocx(D, memoTexts(D)), memoFileName(type, "docx")); toast("ดาวน์โหลดไฟล์ Word แล้ว — เปิดแก้ไข/พิมพ์ได้เลย"); }
  catch (e) { console.error(e); toast("สร้างไฟล์ Word ไม่สำเร็จ — ใช้ PDF หรือปุ่มพิมพ์แทนได้", 5000); }
}

/* =============================================================
   4) Excel (.xlsx) — A4 ขอบตามระเบียบ • ไม่ย่อขนาด (100%) • คอลัมน์รวม 16 ซม.
      เลขหน้าไทยด้านบนตั้งแต่หน้า ๒ • หัวตารางพิมพ์ซ้ำทุกหน้า
   ============================================================= */
async function buildMemoXlsx(D, T) {
  await loadScript("lib/exceljs.min.js");
  const cfg = D.cfg, ms = D.type === "ms", m = SB.margin, inch = mm => +(mm / 25.4).toFixed(3);
  const wb = new ExcelJS.Workbook(); wb.creator = T.teacher; wb.created = new Date();
  const ws = wb.addWorksheet(ms ? "มส" : "ผลการเรียน " + MEMO_TYPES[D.type].short, {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: false,
      margins: { left: inch(m.left), right: inch(m.right), top: inch(m.top), bottom: inch(m.bottom), header: inch(8), footer: inch(10) } },
    views: [{ showGridLines: false }],
    headerFooter: { differentFirst: true, firstHeader: "", oddHeader: `&C&"${SB.font},Regular"&${SB.pt.pageNo}- &P -` }
  });
  // ความกว้างคอลัมน์ Excel = (พิกเซล − 5) ÷ 7 เมื่อฟอนต์มาตรฐานของสมุดงานคือ Calibri 11
  const cm = MEMO_COLS[D.type], N = cm.length;
  // รวม 15.6 ซม. (เผื่อการปัดเศษของ Excel ไม่ให้ล้นขอบขวา) + “พอดีความกว้าง 1 หน้า” กันล้น — ถ้าพอดีอยู่แล้วจะพิมพ์ 100%
  ws.columns = cm.map(c => ({ width: +(((c * 0.975 / 2.54 * 96) - 5) / 7).toFixed(2) }));
  const F = (pt = SB.pt.text, b = false) => ({ name: SB.font, size: pt, bold: b });
  const thin = { style: "thin", color: { argb: "FF000000" } }, dot = { style: "dotted", color: { argb: "FF000000" } }, box = { top: thin, left: thin, bottom: thin, right: thin };
  const lineH = pt => Math.round(pt * 1.94 * 4) / 4;  // ระยะบรรทัดเดียวของ TH Sarabun
  const vis = t => String(t).replace(/[ัิ-ฺ็-๎]/g, "").length;
  // ประมาณจำนวนบรรทัด (เผื่อไว้มาก เพราะ Excel ไม่ปรับความสูงแถวที่รวมช่องให้เอง)
  const lines = (t, widthCm, pt = SB.pt.text) => { const n = Math.ceil(vis(t) * 0.53 * pt * 0.03528 / (widthCm * 0.9)); return Math.max(1, n > 2 ? n + 1 : n); };
  const T_ = s => thaiDigits(s);
  const INDENT = " ".repeat(13); // ≈ 2.5 ซม. ที่ 16 พอยต์
  let r = 0;
  const row = (h) => { r++; ws.getRow(r).height = h; return r; };
  const merged = (from, to, value, o = {}) => {
    ws.mergeCells(r, from, r, to);
    const c = ws.getCell(r, from); c.value = value;
    c.font = o.font || F(); c.alignment = { horizontal: o.align || "left", vertical: o.v || "bottom", wrapText: o.wrap !== false, shrinkToFit: !!o.shrink };
    if (o.dotted) for (let k = from; k <= to; k++) ws.getCell(r, k).border = { bottom: dot };
    return c;
  };
  const rich = (label, text) => ({ richText: [{ text: label + "  ", font: F(SB.pt.label, true) }, { text: T_(text), font: F() }] });
  // ส่วนหัว: ครุฑ 1.5 ซม. + “บันทึกข้อความ” 29 พอยต์
  row(lineH(SB.pt.title) * 0.75); merged(1, N, "บันทึกข้อความ", { font: F(SB.pt.title, true), align: "center", v: "bottom", wrap: false });
  try {
    const gid = wb.addImage({ base64: await garudaBase64(), extension: "png" });
    const hpx = SB.garudaH / 25.4 * 96;
    ws.addImage(gid, { tl: { col: 0, row: 0 }, ext: { width: Math.round(hpx * 125 / 119), height: Math.round(hpx) }, editAs: "absolute" });
  } catch (e) { /* ไม่มีรูปครุฑก็สร้างไฟล์ต่อได้ */ }
  const fieldRow = (label, text) => { row(lineH(SB.pt.label) * lines(label + "  " + text, SB.textW / 10)); merged(1, N, rich(label, text), { dotted: true }); };
  fieldRow("ส่วนราชการ", cfg.agency);
  row(lineH(SB.pt.label));
  const split = ms ? 3 : 2; // แบ่งครึ่งบรรทัด ที่ | วันที่ (≈ 8 ซม.)
  merged(1, split, rich("ที่", cfg.docNo || ""), { dotted: true, wrap: false });
  merged(split + 1, N, rich("วันที่", thaiLongDate(D.date)), { dotted: true, wrap: false });
  fieldRow("เรื่อง", T.subject);
  row(lineH(SB.pt.text) + 6); merged(1, N, "เรียน  " + T_(cfg.directorTitle));
  const bodyText = INDENT + T_(T.body);
  row(lineH(SB.pt.text) * lines(bodyText, SB.textW / 10) + 6); merged(1, N, bodyText, { v: "top" });
  row(6);
  // ตาราง
  const hdr = (rr, c, text, pt = SB.pt.head) => { const x = ws.getCell(rr, c); x.value = text; x.font = F(pt, true); x.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; };
  let headFrom = r + 1;
  if (ms) {
    const r1 = row(lineH(13) * 2.2), r2 = row(lineH(13) * 3.4), sm = 13;
    for (let c = 1; c <= N; c++) { ws.getCell(r1, c).border = box; ws.getCell(r2, c).border = box; }
    [[1, MS_HEAD.c1], [2, "ชื่อ - สกุล"], [3, "ชั้น"], [7, MS_HEAD.c7], [8, MS_HEAD.c8], [9, MS_HEAD.c9]].forEach(([c, t]) => { ws.mergeCells(r1, c, r2, c); hdr(r1, c, t, sm); });
    ws.mergeCells(r1, 4, r1, 6); hdr(r1, 4, "สาเหตุที่\nไม่มาเรียน", sm);
    ["ป่วย", "ลา", "ขาด"].forEach((t, i) => hdr(r2, 4 + i, t, sm));
  } else {
    row(lineH(SB.pt.head) * 1.1 * Math.max(...T.head.map((t, i) => t.split("\n").reduce((a, part) => a + lines(part, cm[i] - 0.15, SB.pt.head), 0))));
    T.head.forEach((t, i) => { hdr(r, i + 1, t); ws.getCell(r, i + 1).border = box; });
  }
  const headTo = r;
  const data = T.rows.length ? T.rows : [["", "— ไม่มี —", ...Array(N - 2).fill("")]];
  data.forEach(vals => {
    const n = Math.max(...vals.map((v, j) => lines(String(v ?? ""), cm[j] - 0.15)));
    row(lineH(SB.pt.table) * n);
    vals.forEach((v, j) => {
      const c = ws.getCell(r, j + 1); c.value = T_(v ?? ""); c.font = F(SB.pt.table); c.border = box;
      c.alignment = { horizontal: j === 1 || (!ms && j === 4) ? "left" : "center", vertical: "top", wrapText: true };
    });
  });
  if (data.length > 8) ws.pageSetup.printTitlesRow = `${headFrom}:${headTo}`; // รายชื่อยาว → หัวตารางพิมพ์ซ้ำทุกหน้า
  // คำลงท้าย + ลงชื่อ
  if (T.follow) { const t = INDENT + "โดยข้าพเจ้าได้ติดตามและตักเตือนมาโดยตลอด ตามหลักฐานที่แนบมานี้"; row(lineH(SB.pt.text) * lines(t, SB.textW / 10) + 6); merged(1, N, t); }
  row(lineH(SB.pt.text) + 12); merged(1, N, INDENT + "จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุมัติ");
  row(lineH(SB.pt.text) * 3);                                    // เว้น 3 บรรทัดสำหรับลายมือชื่อ
  const right = split + 1;
  row(lineH(SB.pt.text)); merged(right, N, `(${T_(T.teacher)})`, { align: "center", shrink: true, wrap: false });
  row(lineH(SB.pt.text)); merged(right, N, "ครูประจำวิชา", { align: "center" });
  row(12);
  // ช่องความเห็น 2 × 2
  const G = memoGrid(D), gh = lineH(SB.pt.grid) * 0.62;
  [[G[0], G[1]], [G[2], G[3]]].forEach(pair => {
    const lines6 = pair.map(([t, n, ro]) => [t, "....................................................................", "....................................................................", "", `(${n || NAME_BLANK})`, ro]);
    for (let k = 0; k < 6; k++) {
      row(k === 3 ? 10 : gh);
      [[1, split, 0], [split + 1, N, 1]].forEach(([a, b, s]) => {
        merged(a, b, T_(lines6[s][k]), { font: F(SB.pt.grid), align: k >= 4 ? "center" : "left", v: "middle", wrap: false, shrink: true });
        for (let col = a; col <= b; col++) {
          const bd = {};
          if (col === a) bd.left = thin;
          if (col === b) bd.right = thin;
          if (k === 0) bd.top = thin;
          if (k === 5) bd.bottom = thin;
          ws.getCell(r, col).border = bd;
        }
      });
    }
  });
  ws.pageSetup.printArea = `A1:${String.fromCharCode(64 + N)}${r}`;
  return new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
async function downloadMemoXlsx() {
  const type = ui.memoType || "zero";
  await busy("memoXlsxBtn", "กำลังสร้าง Excel…", async () => {
    try { const D = memoData(type); saveBlob(await buildMemoXlsx(D, memoTexts(D)), memoFileName(type, "xlsx")); toast("ดาวน์โหลด Excel แล้ว — ตั้งหน้า A4 ตามระเบียบไว้แล้ว"); }
    catch (e) { console.error(e); toast("สร้างไฟล์ Excel ไม่สำเร็จ — ใช้ PDF หรือ Word แทนได้", 6000); }
  });
}
