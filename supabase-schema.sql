-- Habits table
create table if not exists habits (
  id text primary key,
  name text not null,
  completed boolean default false,
  updated_at timestamptz default now()
);

-- Goals table
create table if not exists goals (
  id text primary key,
  current numeric not null default 0,
  updated_at timestamptz default now()
);

-- Chat history table
create table if not exists chat_messages (
  id bigserial primary key,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

-- IRA funds table
create table if not exists ira_funds (
  symbol text primary key,
  name text not null,
  nav numeric not null default 0,
  chg numeric not null default 0,
  value numeric not null default 0,
  shares numeric not null default 0
);

-- Bills table
create table if not exists bills (
  name text primary key,
  amt numeric not null default 0,
  due integer not null default 1
);

-- Disable RLS for personal use (single user app)
alter table habits disable row level security;
alter table goals disable row level security;
alter table chat_messages disable row level security;
alter table ira_funds disable row level security;
alter table bills disable row level security;
