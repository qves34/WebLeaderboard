# WebLeaderboard

Veřejný žebříček pro hru **Mercenary** (voxelová taktická FPS v Godotu,
repo `qves34/mercenary`). Hráči z ní nahrávají výsledky pod nickname, web
ukazuje nejlepší běhy v každé kategorii.

Postavené na React + Vite, nasazuje se na Vercel přes `git push`. Data drží
Supabase (Postgres) - stejný stack jako `watchlist`.

## Co web umí

- **Kategorie**: záložky módů **Classic / Annihilation / Endless / Story**, pod
  nimi filtr mapy, obtížnosti (All / Easy / Normal / Hard) a operátora (All +
  tři operátoři). Mapy se přepínají podle módu - Story má své dvě mise, ostatní
  módy čtyři Mercenary mapy.
- **Tabulka top 100**: pořadí, nick, skóre (u mission módů `/ 1000`, Endless bez
  stropu), kills, čas, operátor se zbraní, obtížnost, datum. První tři místa
  mají medaile.
- **Hledání nicku** v aktuální kategorii - pořadí zůstává z plného seznamu.
- **Profil hráče**: klik na nick otevře přehled všech jeho rekordů napříč
  kategoriemi.
- **Jeden záznam na hráče a kategorii** - horší pokus best nepřepíše, takže
  jeden hráč nezaplní celou tabulku. Při filtru "All" na obtížnosti/operátorovi
  se stejný nick může objevit vícekrát (jeho best v každé podkategorii).
- Hlavička ukazuje počet hráčů a záznamů, patička má tlačítko Refresh.
- Bez přihlášení, jen čtení. UI je anglicky, stejně jako hra.

## Jak data tečou

```
Mercenary (Godot)  --POST rpc/submit_score-->  Supabase  <--SELECT scores--  web
```

- Hra volá funkci `submit_score()` s nickem, tajným tokenem a výsledkem. Funkce
  zvaliduje vstupy, ověří vlastnictví nicku (SHA-256 tokenu), ohlídá limit 1
  upload / 3 s a zapíše jen pokud je výsledek lepší než dosavadní best.
- Web čte tabulku `scores` anon klíčem. Tabulky nemají žádnou insert/update/
  delete policy - zápis jde jen přes tu funkci, mazání jen z dashboardu.
- Podrobnosti API, formát requestu a návrh GDScript kódu pro hru:
  **[docs/godot-integration.md](docs/godot-integration.md)**.

## Požadavky

**Node 20.19+ nebo 22.12+** (Vite 8). Ověř `node -v`.

Supabase projekt (zdarma, https://supabase.com):

1. Založ projekt (nebo použij stávající - tabulky mají vlastní jména
   `players`, `scores`, `player_profiles`, s watchlistem se netlučou).
2. **SQL Editor** - vlož a spusť `supabase/schema.sql`.
3. Volitelně spusť `supabase/seed.sql` - nahraje pár testovacích hráčů
   `test_*`, ať je na webu něco vidět. Smazání:
   `delete from public.players where nickname like 'test_%';`
4. **Settings → API** - zkopíruj Project URL a `anon` `public` klíč.

Vše dej do `.env` (viz `.env.example`):

```
VITE_SUPABASE_URL=https://tvuj-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=tvuj_anon_klic
```

`VITE_` proměnné skončí jako čitelný text v JS balíčku - proto jen `anon`
klíč, nikdy `service_role`.

## Lokální vývoj

```bash
npm install
npm run dev       # http://localhost:5173
npm run lint
npm run build     # výstup v dist/
```

Bez `.env` appka naběhne a místo tabulky ukáže návod na nastavení.

## Nasazení na Vercel

1. Vercel → Add New Project → import repozitáře `qves34/WebLeaderboard`.
   Framework Vite se detekuje sám (build `vite build`, output `dist`).
2. **Environment Variables**: `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Každý další `git push` do `main` nasadí novou verzi.

## Struktura

```
supabase/schema.sql       tabulky, RLS, funkce submit_score()
supabase/seed.sql         testovací data
docs/godot-integration.md co a jak přidat do hry
src/lib/game.js           zrcadlo konstant z GameSettings.gd (mapy, operátoři, módy)
src/lib/scores.js         dotazy do Supabase
src/hooks/                useLeaderboard, useStats
src/components/           Header, FilterBar, ScoreTable, PlayerModal, Footer
```

Když ve hře přibude mapa nebo operátor, stačí ho doplnit do `src/lib/game.js`.
Neznámé ID web nepoloží, jen ho zobrazí syrově (`new_map` místo názvu).

## Správa dat

Vše z Supabase dashboardu (Table Editor):

- **Smazat podezřelý záznam**: řádek v `scores`.
- **Zabanovat hráče**: řádek v `players` - jeho skóre se smažou kaskádou a nick
  se uvolní.
- **Přejmenovat hráče**: upravit `players.nickname`, `scores` se přepíšou
  kaskádou.
- **Reset po změně balancu**: záznamy mají `game_version`, jde podle ní mazat
  (`delete from scores where game_version < '0.2.0'`).

## Omezení (vědomě)

- Žádné účty. Nick patří tomu, kdo ho zabral první (token ve hře). Když hráč
  smaže savy, token ztratí a nick je pro něj pryč.
- Klient jde vždy zfalšovat. Server dělá jen hrubé meze (mission skóre ≤ 1000,
  endless ≤ kills × 10) a rate limit. Pro hobby projekt stačí, zbytek je ruční
  mazání v dashboardu.
