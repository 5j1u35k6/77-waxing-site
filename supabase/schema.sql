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
  duration_minutes integer,
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
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_customer_id_idx on bookings(customer_id);
create index if not exists bookings_preferred_date_idx on bookings(preferred_date);
create index if not exists bookings_status_idx on bookings(status);

-- Seed only service names supported by the current企劃. Prices remain null until 77 supplies the current menu.
insert into services (name, category) values
  ('女性 VIO 私密處熱蠟', '女性熱蠟'),
  ('女性局部熱蠟', '女性熱蠟'),
  ('男士熱蠟', '男士熱蠟'),
  ('肌膚管理', '肌膚管理'),
  ('美胸保養', '美胸保養'),
  ('不確定，想先請 77 建議', '諮詢')
on conflict (name) do nothing;
