-- Upgrade an existing 77waxing database so paper customer records can be migrated safely.

alter table customers alter column phone drop not null;
alter table customers add column if not exists email text;
alter table customers add column if not exists source text not null default 'online';
alter table customers add column if not exists legacy_ref text;
alter table customers add column if not exists paper_record_ref text;
alter table customers add column if not exists first_visit_date date;
alter table customers add column if not exists last_visit_date date;
alter table customers add column if not exists imported_at timestamptz;

create unique index if not exists customers_phone_unique_idx on customers(phone) where phone is not null and phone <> '';
create unique index if not exists customers_legacy_ref_unique_idx on customers(legacy_ref) where legacy_ref is not null and legacy_ref <> '';
create unique index if not exists customers_paper_record_ref_unique_idx on customers(paper_record_ref) where paper_record_ref is not null and paper_record_ref <> '';
create index if not exists customers_name_idx on customers(name);
create index if not exists customers_source_idx on customers(source);

create table if not exists customer_import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at timestamptz not null default now()
);
