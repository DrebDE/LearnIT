-- Run once in Supabase Dashboard > SQL Editor to enable account-scoped deck sync.
create table if not exists public.learnit_decks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  deck_title text not null,
  field text not null default 'Health sciences',
  saved_at timestamptz not null default now(),
  source text not null default '',
  reviewer text not null,
  plain_language text not null,
  missing_topics jsonb not null default '[]'::jsonb,
  flashcards jsonb not null default '[]'::jsonb,
  hard_quiz jsonb not null default '[]'::jsonb,
  known_cards jsonb not null default '[]'::jsonb
);

create index if not exists learnit_decks_user_saved_idx
  on public.learnit_decks (user_id, saved_at desc);

alter table public.learnit_decks enable row level security;

grant select, insert, update, delete on public.learnit_decks to authenticated;

drop policy if exists "Users can read their own LearnIT decks" on public.learnit_decks;
create policy "Users can read their own LearnIT decks"
  on public.learnit_decks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own LearnIT decks" on public.learnit_decks;
create policy "Users can create their own LearnIT decks"
  on public.learnit_decks for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own LearnIT decks" on public.learnit_decks;
create policy "Users can update their own LearnIT decks"
  on public.learnit_decks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own LearnIT decks" on public.learnit_decks;
create policy "Users can delete their own LearnIT decks"
  on public.learnit_decks for delete to authenticated
  using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';