alter table if exists paytabs_callbacks
  add column if not exists signature_header text,
  add column if not exists signature_computed text not null default '',
  add column if not exists signature_valid boolean not null default false,
  add column if not exists raw_body text not null default '';

