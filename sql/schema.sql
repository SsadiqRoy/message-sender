create table public.ms_members(user_id uuid primary key references auth.users(id),name text not null,role text not null check(role in ('chief','admin')),active boolean not null default true);
create table public.ms_recipients(id uuid primary key default gen_random_uuid(),name text not null default '',email text unique,phone text unique,description text not null default '',created_at timestamptz not null default now(),check(email is not null or phone is not null));
create table public.ms_connections(id uuid primary key default gen_random_uuid(),label text not null,channel text not null check(channel in ('email','sms')),config jsonb not null default '{}',created_at timestamptz not null default now());
create table public.ms_messages(id uuid primary key default gen_random_uuid(),title text not null,channel text not null check(channel in ('email','sms')),created_at timestamptz not null default now());
create table public.ms_versions(id uuid primary key default gen_random_uuid(),message_id uuid not null references public.ms_messages(id),subject text not null default '',body text not null,recipient_ids uuid[] not null default '{}',connection_id uuid references public.ms_connections(id) on delete set null,attachments jsonb not null default '[]',created_at timestamptz not null default now());
create table public.ms_attempts(id uuid primary key default gen_random_uuid(),version_id uuid not null references public.ms_versions(id),recipient_id uuid not null references public.ms_recipients(id),destination text not null,status text not null check(status in ('sending','success','failed','unknown')),error text,request_key text not null unique,created_at timestamptz not null default now());
create index on public.ms_versions(message_id,created_at desc);
create index on public.ms_attempts(version_id);
create index on public.ms_attempts(recipient_id);
alter table public.ms_members enable row level security;
alter table public.ms_recipients enable row level security;
alter table public.ms_connections enable row level security;
alter table public.ms_messages enable row level security;
alter table public.ms_versions enable row level security;
alter table public.ms_attempts enable row level security;
-- All data access goes through authenticated, membership-checked server endpoints.
revoke all on public.ms_members,public.ms_recipients,public.ms_connections,public.ms_messages,public.ms_versions,public.ms_attempts from anon,authenticated;
grant all on public.ms_members,public.ms_recipients,public.ms_connections,public.ms_messages,public.ms_versions,public.ms_attempts to service_role;
