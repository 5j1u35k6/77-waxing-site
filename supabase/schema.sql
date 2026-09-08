-- 77waxing first-edition data model
create extension if not exists pgcrypto;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  line_id text,
  visit_count integer not null default 0,
  default_deposit_required boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  duration_minutes integer not null default 90,
  price integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  service_id uuid references services(id),
  service_name_snapshot text not null,
  preferred_date date not null,
  preferred_time text not null,
  confirmed_at timestamptz,
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation','pending_payment','confirmed','completed','cancelled','no_show')),
  is_first_visit boolean not null default false,
  deposit_required boolean,
  deposit_amount integer,
  payment_status text not null default 'not_requested' check (payment_status in ('not_requested','pending','paid','refunded')),
  duration_minutes integer not null default 90,
  buffer_minutes integer not null default 30,
  slot_start timestamptz,
  slot_end timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe upgrades when the first schema has already been executed.
alter table services add column if not exists duration_minutes integer not null default 90;
alter table bookings add column if not exists duration_minutes integer not null default 90;
alter table bookings add column if not exists buffer_minutes integer not null default 30;
alter table bookings add column if not exists slot_start timestamptz;
alter table bookings add column if not exists slot_end timestamptz;

update services set duration_minutes = 90;

-- Existing bookings can be upgraded to the current 90 min service + 30 min turnover block.
update bookings
set slot_start = ((preferred_date::text || ' ' || left(preferred_time, 5))::timestamp at time zone 'Asia/Taipei')
where slot_start is null and preferred_time ~ '^\d{2}:\d{2}';

update bookings
set slot_end = slot_start + interval '120 minutes'
where slot_start is not null and slot_end is null;

create index if not exists bookings_customer_id_idx on bookings(customer_id);
create index if not exists bookings_preferred_date_idx on bookings(preferred_date);
create index if not exists bookings_status_idx on bookings(status);
create index if not exists bookings_slot_window_idx on bookings(slot_start, slot_end);

-- A pending request already occupies the window. When 77 confirms it, the UI hides the same window.
-- The database constraint prevents two active bookings from overlapping even if two guests submit at nearly the same time.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_no_active_overlap') then
    alter table bookings
      add constraint bookings_no_active_overlap
      exclude using gist (
        tstzrange(slot_start, slot_end, '[)') with &&
      )
      where (
        status in ('pending_confirmation', 'pending_payment', 'confirmed')
        and slot_start is not null
        and slot_end is not null
      );
  end if;
end $$;

-- Seed only service names supported by the current企劃. Prices remain null until 77 supplies the current menu.
insert into services (name, category, duration_minutes) values
  ('女性 VIO 私密處熱蠟', '女性熱蠟', 90),
  ('女性局部熱蠟', '女性熱蠟', 90),
  ('男士熱蠟', '男士熱蠟', 90),
  ('肌膚管理', '肌膚管理', 90),
  ('美胸保養', '美胸保養', 90),
  ('不確定，想先請 77 建議', '諮詢', 90)
on conflict (name) do update set duration_minutes = excluded.duration_minutes;
