# สมุดเก็บคะแนนอิเล็กทรอนิกส์
## ครูปรัชญา ทรงบรรพต

---

## ขั้นตอนที่ 1 — สร้าง Supabase (ฐานข้อมูล)

1. ไป https://supabase.com → สมัคร → New Project
2. ตั้งชื่อ: `gradebook-pratchaya` | Region: Singapore
3. ไปที่ **SQL Editor** → รัน SQL ด้านล่างทั้งหมด
4. ไปที่ **Settings → API** → คัดลอก **Project URL** และ **anon public key**

### SQL ที่ต้องรัน (ใน Supabase SQL Editor):

```sql
create table settings (
  id uuid default gen_random_uuid() primary key,
  academic_year text, semester text,
  updated_at timestamptz default now()
);
insert into settings (academic_year, semester) values ('2568', '1');

create table subjects (
  id uuid default gen_random_uuid() primary key,
  name text not null, code text,
  created_at timestamptz default now()
);

create table classrooms (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references subjects(id) on delete cascade,
  name text not null, level text, room_number text,
  created_at timestamptz default now()
);

create table assignments (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references subjects(id) on delete cascade,
  name text not null, max_score numeric not null, order_num int default 0,
  created_at timestamptz default now()
);

create table students (
  id uuid default gen_random_uuid() primary key,
  classroom_id uuid references classrooms(id) on delete cascade,
  number int, student_id text, name text not null,
  created_at timestamptz default now()
);

create table scores (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references students(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade,
  score numeric,
  updated_at timestamptz default now(),
  unique(student_id, assignment_id)
);

create table final_scores (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references students(id) on delete cascade unique,
  score numeric,
  updated_at timestamptz default now()
);

create table grade_settings (
  id uuid default gen_random_uuid() primary key,
  classroom_id uuid references classrooms(id) on delete cascade unique,
  collected_weight int default 80, final_weight int default 20,
  show_total bool default true, show_grade bool default true
);

alter table settings enable row level security;
alter table subjects enable row level security;
alter table classrooms enable row level security;
alter table assignments enable row level security;
alter table students enable row level security;
alter table scores enable row level security;
alter table final_scores enable row level security;
alter table grade_settings enable row level security;

create policy "public_all" on settings for all using (true) with check (true);
create policy "public_all" on subjects for all using (true) with check (true);
create policy "public_all" on classrooms for all using (true) with check (true);
create policy "public_all" on assignments for all using (true) with check (true);
create policy "public_all" on students for all using (true) with check (true);
create policy "public_all" on scores for all using (true) with check (true);
create policy "public_all" on final_scores for all using (true) with check (true);
create policy "public_all" on grade_settings for all using (true) with check (true);
```

---

## ขั้นตอนที่ 2 — Deploy บน Vercel

1. **อัปโหลด โค้ดไปที่ GitHub:**
   - ไป https://github.com → New Repository → ตั้งชื่อ `gradebook`
   - อัปโหลดโฟลเดอร์นี้ทั้งหมด

2. **เชื่อม Vercel:**
   - ไป https://vercel.com → สมัครด้วย GitHub
   - Add New Project → เลือก repo `gradebook`
   - Framework: **Vite**

3. **ตั้งค่า Environment Variables ใน Vercel:**
   - ไปที่ Settings → Environment Variables
   - เพิ่ม 2 ตัวนี้:
   ```
   VITE_SUPABASE_URL = https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIs...
   ```
   - กด Deploy

4. **ลิงก์ที่ได้:** `https://gradebook-xxx.vercel.app`
5. **หน้านักเรียน:** `https://gradebook-xxx.vercel.app/student`

---

## รหัสผ่านห้องเรียน (Logic)

ห้องเรียน → รหัสผ่าน:
- ม.1/1 → **101**
- ม.2/3 → **203**  
- ม.5/6 → **506**
- ม.6/2 → **602**

**อย่าบอกนักเรียนโดยตรง** — ครูแจ้งเป็นการส่วนตัวเท่านั้น

---

## ฟีเจอร์ทั้งหมด

✅ จัดการวิชา / งาน / ห้องเรียน / นักเรียน  
✅ อัปโหลดรายชื่อจาก Excel  
✅ กรอกคะแนน + Auto-save  
✅ ตรวจสอบคะแนนเกิน → แจ้งเตือนทันที  
✅ คำนวณสัดส่วน 80:20 (ปรับได้)  
✅ คำนวณเกรด 0.00–4.00 อัตโนมัติ  
✅ ซ่อน/แสดง คะแนนรวม และเกรด  
✅ Export Excel และ PDF  
✅ หน้านักเรียน + ระบบรหัสผ่านห้อง  
✅ ข้อมูลซิงค์ออนไลน์ทุกอุปกรณ์  
