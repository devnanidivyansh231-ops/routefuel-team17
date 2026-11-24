create table if not exists public.route_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  distance_1 double precision not null check (distance_1 > 0),
  distance_2 double precision not null check (distance_2 > 0),
  deadline_hours double precision not null check (deadline_hours > 0),
  min_speed double precision not null check (min_speed > 0),
  max_speed double precision not null check (max_speed > min_speed),
  speed_1 double precision not null check (speed_1 > 0),
  speed_2 double precision not null check (speed_2 > 0),
  fuel_units double precision not null check (fuel_units >= 0),
  equal_speed_fuel_units double precision check (equal_speed_fuel_units >= 0),
  savings_percent double precision,
  created_at timestamptz not null default now()
);

create index if not exists route_runs_user_created_idx
  on public.route_runs (user_id, created_at desc);

alter table public.route_runs enable row level security;

create policy "Users can read their own route runs"
  on public.route_runs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own route runs"
  on public.route_runs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.route_runs from anon, authenticated;
grant select, insert on public.route_runs to authenticated;
