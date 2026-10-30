-- Testovací data - ať má web co ukázat, než se do něj začne psát ze hry.
-- Spustit v SQL Editoru po schema.sql. Smazat pak jde jednoduše:
--   delete from public.players where nickname like 'test_%';
-- (scores se smažou kaskádou).
--
-- Token je pro všechny testovací hráče "seed-token-0000000000000000".

select public.submit_score('test_hunk',   'seed-token-0000000000000000', 'classic', 'warehouse', 'alpha_captain',   1, 912, 8, 71.4, '0.1.0');
select public.submit_score('test_leon',   'seed-token-0000000000000000', 'classic', 'warehouse', 'alpha_captain',   1, 865, 8, 88.0, '0.1.0');
select public.submit_score('test_ada',    'seed-token-0000000000000000', 'classic', 'warehouse', 'ak_operator',     1, 790, 7, 95.2, '0.1.0');
select public.submit_score('test_krauser','seed-token-0000000000000000', 'classic', 'warehouse', 'deagle_operator', 2, 744, 8, 102.9, '0.1.0');
select public.submit_score('test_hunk',   'seed-token-0000000000000000', 'classic', 'warehouse', 'alpha_captain',   2, 701, 8, 110.0, '0.1.0');
select public.submit_score('test_leon',   'seed-token-0000000000000000', 'classic', 'office',    'alpha_captain',   1, 833, 10, 150.5, '0.1.0');
select public.submit_score('test_ada',    'seed-token-0000000000000000', 'annihilation', 'cellar', 'ak_operator',   1, 958, 12, 160.0, '0.1.0');
select public.submit_score('test_hunk',   'seed-token-0000000000000000', 'endless', 'cellar', 'alpha_captain',      1, 1240, 124, 412.0, '0.1.0');
select public.submit_score('test_krauser','seed-token-0000000000000000', 'endless', 'cellar', 'deagle_operator',    1, 870, 87, 301.3, '0.1.0');
select public.submit_score('test_leon',   'seed-token-0000000000000000', 'endless', 'cellar', 'ak_operator',        2, 560, 56, 240.0, '0.1.0');
select public.submit_score('test_hunk',   'seed-token-0000000000000000', 'story', 'aegis_side_1', 'alpha_captain',  1, 884, 9, 120.7, '0.1.0');
select public.submit_score('test_ada',    'seed-token-0000000000000000', 'story', 'aegis_side_2', 'alpha_captain',  1, 812, 9, 139.9, '0.1.0');

-- Horší pokus best nepřepíše - vrátí status not_better:
select public.submit_score('test_hunk',   'seed-token-0000000000000000', 'classic', 'warehouse', 'alpha_captain',   1, 500, 5, 150.0, '0.1.0');
