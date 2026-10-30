-- Testovací data - ať má web co ukázat, než se do něj začne psát ze hry.
-- Spustit v SQL Editoru po schema.sql. Smazat pak jde jednoduše:
--   delete from public.players where nickname like 'test_%';
-- (scores se smažou kaskádou).
--
-- Vkládá se přímo do tabulek, ne přes submit_score(): SQL Editor spouští celý
-- skript v jedné transakci a rate limit (3 s na hráče) by druhý řádek téhož
-- hráče odmítl. Token všech testovacích hráčů je "seed-token-0000000000000000".

insert into public.players (nickname, token_hash) values
  ('test_hunk',    encode(extensions.digest('seed-token-0000000000000000', 'sha256'), 'hex')),
  ('test_leon',    encode(extensions.digest('seed-token-0000000000000000', 'sha256'), 'hex')),
  ('test_ada',     encode(extensions.digest('seed-token-0000000000000000', 'sha256'), 'hex')),
  ('test_krauser', encode(extensions.digest('seed-token-0000000000000000', 'sha256'), 'hex'))
on conflict (nickname) do nothing;

insert into public.scores (nickname, mode, map_id, operator_id, difficulty, score, kills, time_seconds, game_version) values
  ('test_hunk',    'classic',      'warehouse',    'alpha_captain',   1, 912,  8,   71.4,  '0.1.0'),
  ('test_leon',    'classic',      'warehouse',    'alpha_captain',   1, 865,  8,   88.0,  '0.1.0'),
  ('test_ada',     'classic',      'warehouse',    'ak_operator',     1, 790,  7,   95.2,  '0.1.0'),
  ('test_krauser', 'classic',      'warehouse',    'deagle_operator', 2, 744,  8,   102.9, '0.1.0'),
  ('test_hunk',    'classic',      'warehouse',    'alpha_captain',   2, 701,  8,   110.0, '0.1.0'),
  ('test_leon',    'classic',      'office',       'alpha_captain',   1, 833,  10,  150.5, '0.1.0'),
  ('test_ada',     'annihilation', 'cellar',       'ak_operator',     1, 958,  12,  160.0, '0.1.0'),
  ('test_hunk',    'endless',      'cellar',       'alpha_captain',   1, 1240, 124, 412.0, '0.1.0'),
  ('test_krauser', 'endless',      'cellar',       'deagle_operator', 1, 870,  87,  301.3, '0.1.0'),
  ('test_leon',    'endless',      'cellar',       'ak_operator',     2, 560,  56,  240.0, '0.1.0'),
  ('test_hunk',    'story',        'aegis_side_1', 'alpha_captain',   1, 884,  9,   120.7, '0.1.0'),
  ('test_ada',     'story',        'aegis_side_2', 'alpha_captain',   1, 812,  9,   139.9, '0.1.0')
on conflict on constraint scores_one_per_category do nothing;

-- Ukázka, že horší pokus přes API best nepřepíše - vrátí status not_better.
select public.submit_score('test_hunk', 'seed-token-0000000000000000', 'classic', 'warehouse', 'alpha_captain', 1, 500, 5, 150.0, '0.1.0');
