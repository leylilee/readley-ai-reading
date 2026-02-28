-- Run this in your Supabase project's SQL Editor (Dashboard > SQL Editor)

-- 1. Create the books table
create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.books enable row level security;

-- 3. Policy: users can only read their own books
create policy "Users can read own books"
  on public.books
  for select
  using (auth.uid() = user_id);

-- 4. Policy: users can insert their own books
create policy "Users can insert own books"
  on public.books
  for insert
  with check (auth.uid() = user_id);

-- 5. Policy: users can delete their own books
create policy "Users can delete own books"
  on public.books
  for delete
  using (auth.uid() = user_id);

-- 6. Index for fast per-user lookups
create index if not exists books_user_id_idx on public.books(user_id);
