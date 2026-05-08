-- schema.sql
-- Run this in your Supabase SQL Editor

-- 1. Profiles Table (Extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  role text check (role in ('admin', 'engineer')) not null,
  full_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS for profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- 2. Tasks Table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  site_id text not null,
  customer_name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  problem_description text not null,
  priority text check (priority in ('low', 'medium', 'high', 'critical')) not null default 'medium',
  assigned_to uuid references public.profiles(id) on delete set null,
  status text check (status in ('Assigned', 'Trip Start', 'In Progress', 'Completed', 'Leave Site')) not null default 'Assigned',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  started_at timestamp with time zone,
  reached_site_at timestamp with time zone,
  start_lat double precision,
  start_lng double precision,
  completed_at timestamp with time zone,
  left_site_at timestamp with time zone,
  end_lat double precision,
  end_lng double precision,
  work_notes text
);

-- Turn on RLS for tasks
alter table public.tasks enable row level security;

create policy "Admins can do everything on tasks" on tasks
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Engineers can view their assigned tasks" on tasks
  for select using (
    auth.uid() = assigned_to
  );

create policy "Engineers can update their assigned tasks" on tasks
  for update using (
    auth.uid() = assigned_to
  );

-- 3. Tracking Table (Real-time location)
create table public.tracking (
  id uuid default gen_random_uuid() primary key,
  engineer_id uuid references public.profiles(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS for tracking
alter table public.tracking enable row level security;

create policy "Admins can view all tracking data" on tracking
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Engineers can insert their own tracking data" on tracking
  for insert with check (
    auth.uid() = engineer_id
  );

-- 4. Set up realtime for tracking and tasks
alter publication supabase_realtime add table tracking;
alter publication supabase_realtime add table tasks;
