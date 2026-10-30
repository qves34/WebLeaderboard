-- Mercenary leaderboard - schéma pro Supabase.
-- Spustit v Supabase -> SQL Editor (jednorázově, na nově založeném projektu).
--
-- Model:
--   players  - nickname + hash tajného tokenu, který si hra vygeneruje při
--              prvním uploadu. Kdo nick zabere první, ten ho má; další upload
--              pod stejným nickem musí přinést stejný token.
--   scores   - jeden řádek = nejlepší výsledek hráče v kategorii
--              (mód + mapa + operátor + obtížnost). Horší pokus řádek nepřepíše.
--
-- Web čte scores (a view player_profiles) přes anon klíč. Zápis jde výhradně
-- přes funkci submit_score() - tabulky samy insert/update/delete přes API
-- nedovolí, takže klient nemůže podstrčit cizí nick ani smazat cizí skóre.

-- pgcrypto kvůli digest() - Supabase ho drží ve schématu extensions.
create extension if not exists pgcrypto with schema extensions;

-- Hráči ---------------------------------------------------------------------

create table public.players (
  nickname text primary key,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_submit_at timestamptz,
  constraint players_nickname_format check (nickname ~ '^[A-Za-z0-9_]{3,16}$')
);

-- Nick je unikátní bez ohledu na velikost písmen ("Hunk" a "hunk" je tentýž).
create unique index players_nickname_lower_idx on public.players (lower(nickname));

alter table public.players enable row level security;
-- Žádná policy = anon nevidí ani token_hash, ani nic jiného. Co web potřebuje,
-- dostane přes view níže.

-- View bez token_hash - security_invoker=false (výchozí), takže běží s právy
-- vlastníka a RLS na players obejde. Web z něj bere jen počet hráčů.
create view public.player_profiles as
  select nickname, created_at
  from public.players;

grant select on public.player_profiles to anon, authenticated;

-- Skóre ---------------------------------------------------------------------

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null references public.players (nickname) on delete cascade on update cascade,
  mode text not null check (mode in ('classic', 'annihilation', 'endless', 'story')),
  map_id text not null check (map_id ~ '^[a-z0-9_]{1,40}$'),
  operator_id text not null check (operator_id ~ '^[a-z0-9_]{1,40}$'),
  difficulty smallint not null check (difficulty between 0 and 2),
  score integer not null check (score >= 0),
  kills integer not null default 0 check (kills >= 0),
  time_seconds numeric(10, 2) not null default 0 check (time_seconds >= 0),
  game_version text not null default '' check (length(game_version) <= 32),
  created_at timestamptz not null default now(),
  constraint scores_one_per_category unique (nickname, mode, map_id, operator_id, difficulty)
);

-- Dotaz webu: WHERE mode, map_id [, difficulty, operator_id] ORDER BY score DESC.
create index scores_category_idx
  on public.scores (mode, map_id, difficulty, operator_id, score desc, created_at);

create index scores_nickname_idx on public.scores (nickname);

alter table public.scores enable row level security;

-- Čtení je veřejné - leaderboard nemá přihlášení.
create policy "public read scores"
  on public.scores for select
  using (true);

-- Žádná insert/update/delete policy: zápis jen přes submit_score() níže
-- (security definer), mazání jen z dashboardu / service_role.

-- Odeslání výsledku ---------------------------------------------------------
--
-- Volá hra: POST {SUPABASE_URL}/rest/v1/rpc/submit_score s anon klíčem.
-- Vrací {"status": "inserted" | "improved" | "not_better", "nickname": ...,
--        "rank": <pořadí v přesné kategorii mód+mapa+operátor+obtížnost>}
-- Chyby vyhazuje jako exception s krátkým kódem (invalid_nickname,
-- invalid_token, nickname_taken, rate_limited, invalid_mode, invalid_map,
-- invalid_operator, invalid_difficulty, invalid_score) - PostgREST je vrátí
-- jako HTTP 400 s {"message": "<kód>"}.

create or replace function public.submit_score(
  p_nickname text,
  p_token text,
  p_mode text,
  p_map_id text,
  p_operator_id text,
  p_difficulty integer,
  p_score integer,
  p_kills integer default 0,
  p_time_seconds numeric default 0,
  p_game_version text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_player public.players%rowtype;
  v_existing public.scores%rowtype;
  v_status text;
  v_best integer;
  v_rank bigint;
begin
  -- Vstupy ------------------------------------------------------------------
  if p_nickname is null or p_nickname !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'invalid_nickname';
  end if;
  if p_token is null or length(p_token) < 16 or length(p_token) > 128 then
    raise exception 'invalid_token';
  end if;
  if p_mode is null or p_mode not in ('classic', 'annihilation', 'endless', 'story') then
    raise exception 'invalid_mode';
  end if;
  if p_map_id is null or p_map_id !~ '^[a-z0-9_]{1,40}$' then
    raise exception 'invalid_map';
  end if;
  if p_operator_id is null or p_operator_id !~ '^[a-z0-9_]{1,40}$' then
    raise exception 'invalid_operator';
  end if;
  if p_difficulty is null or p_difficulty not between 0 and 2 then
    raise exception 'invalid_difficulty';
  end if;
  if p_score is null or p_score < 0 or p_kills is null or p_kills < 0
     or p_time_seconds is null or p_time_seconds < 0 then
    raise exception 'invalid_score';
  end if;
  -- Hrubá kontrola proti nesmyslům - ne anti-cheat (klient jde vždy obejít),
  -- jen aby se do tabulky nedostalo 2^31. Mission módy mají strop 1000
  -- (calculate_mission_score), Endless je kills * ENDLESS_KILL_SCORE (10).
  if p_mode <> 'endless' and p_score > 1000 then
    raise exception 'invalid_score';
  end if;
  if p_mode = 'endless' and p_score > greatest(p_kills, 1) * 10 then
    raise exception 'invalid_score';
  end if;

  -- Hráč / vlastnictví nicku ---------------------------------------------------
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_player
  from public.players
  where lower(nickname) = lower(p_nickname)
  for update;

  if not found then
    insert into public.players (nickname, token_hash, last_submit_at)
    values (p_nickname, v_hash, now())
    returning * into v_player;
  elsif v_player.token_hash <> v_hash then
    raise exception 'nickname_taken';
  else
    if v_player.last_submit_at is not null
       and v_player.last_submit_at > now() - interval '3 seconds' then
      raise exception 'rate_limited';
    end if;
    update public.players set last_submit_at = now() where nickname = v_player.nickname;
  end if;

  -- Best v kategorii ------------------------------------------------------------
  select * into v_existing
  from public.scores
  where nickname = v_player.nickname
    and mode = p_mode and map_id = p_map_id
    and operator_id = p_operator_id and difficulty = p_difficulty;

  if not found then
    insert into public.scores (nickname, mode, map_id, operator_id, difficulty, score, kills, time_seconds, game_version)
    values (v_player.nickname, p_mode, p_map_id, p_operator_id, p_difficulty, p_score, p_kills, p_time_seconds, coalesce(p_game_version, ''));
    v_status := 'inserted';
    v_best := p_score;
  elsif p_score > v_existing.score then
    update public.scores
    set score = p_score, kills = p_kills, time_seconds = p_time_seconds,
        game_version = coalesce(p_game_version, ''), created_at = now()
    where id = v_existing.id;
    v_status := 'improved';
    v_best := p_score;
  else
    v_status := 'not_better';
    v_best := v_existing.score;
  end if;

  select count(*) + 1 into v_rank
  from public.scores
  where mode = p_mode and map_id = p_map_id
    and operator_id = p_operator_id and difficulty = p_difficulty
    and score > v_best;

  return jsonb_build_object(
    'status', v_status,
    'nickname', v_player.nickname,
    'best', v_best,
    'rank', v_rank
  );
end;
$$;

-- Funkci smí volat jen přes API (anon/authenticated), ne kdokoli v DB.
revoke all on function public.submit_score(text, text, text, text, text, integer, integer, integer, numeric, text) from public;
grant execute on function public.submit_score(text, text, text, text, text, integer, integer, integer, numeric, text) to anon, authenticated;
