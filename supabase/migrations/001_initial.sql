create table if not exists groups (
  id text primary key,
  name text not null,
  url text not null unique,
  category text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tasks (
  id text primary key,
  type text not null default 'post',
  status text not null default 'pending',
  group_ids jsonb not null default '[]'::jsonb,
  text_content text default '',
  media_paths jsonb default '[]'::jsonb,
  scheduled_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz default now(),
  retries integer default 0,
  max_retries integer default 3,
  error text
);

create table if not exists history (
  id text primary key,
  task_id text,
  group_id text,
  group_name text default '',
  status text not null default 'done',
  text_content text default '',
  media_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists media (
  id text primary key,
  original_name text not null,
  file_name text not null,
  file_path text not null,
  mime_type text default '',
  file_size integer default 0,
  width integer,
  height integer,
  compressed integer default 0,
  created_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value text not null
);
