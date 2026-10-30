# WebLeaderboard - dokumentace

Kompletní popis toho, co leaderboard dělá, jak funguje uvnitř a jak se na něj
napojí hra Mercenary. README je rychlý start, tohle je referenční text.

Stav k 30. 10. 2026: **web a databázové schéma jsou hotové**, napojení ve hře
je navržené (kapitola 9), ale **do repozitáře `mercenary` zatím nic
přidáno nebylo**.

---

## Obsah

1. [Co to je a proč](#1-co-to-je-a-proč)
2. [Architektura](#2-architektura)
3. [Základní pojmy](#3-základní-pojmy)
4. [Jak to vidí hráč](#4-jak-to-vidí-hráč)
5. [Datový model](#5-datový-model)
6. [API](#6-api)
7. [Bezpečnostní model](#7-bezpečnostní-model)
8. [Skórování - odkud se berou čísla](#8-skórování---odkud-se-berou-čísla)
9. [Napojení hry krok za krokem](#9-napojení-hry-krok-za-krokem)
10. [Webová aplikace](#10-webová-aplikace)
11. [Nasazení a provoz](#11-nasazení-a-provoz)
12. [Správa a moderace](#12-správa-a-moderace)
13. [Okrajové případy a FAQ](#13-okrajové-případy-a-faq)
14. [Co by šlo dál](#14-co-by-šlo-dál)

---

## 1. Co to je a proč

Mercenary (repo `qves34/mercenary`, Godot 4.7) má od commitu z 1. 9. 2026
lokální high score systém: nejlepší skóre za mapu v mission módech a nejlepší
skóre za mapu + operátora v Endless. Všechno sedí v `user://*.cfg` na disku
hráče a nikdo jiný ho nevidí.

WebLeaderboard k tomu přidává **veřejný žebříček**: hráč si ve hře nastaví
nickname, hra po každé dohrané misi pošle výsledek na server a na webu je
vidět, kdo je v které kategorii nejlepší.

### Cíle

- Hráč bez jakékoli registrace zadá nick a jeho výsledky se začnou objevovat
  na webu.
- Web ukazuje smysluplné kategorie - Easy se nemíchá s Hard, MP5 s Deaglem.
- Jeden hráč nemůže zaplnit celou tabulku svými pokusy.
- Nulová údržba serveru: Supabase + Vercel, obojí zdarma a bez vlastního VPS.
- Hra zůstane hratelná offline - upload je bonus, když selže, nic se nerozbije.

### Ne-cíle (vědomě)

- **Žádné účty, hesla ani e-maily.** Nick drží tajný token uložený ve hře.
- **Žádný skutečný anti-cheat.** Klient je v rukou hráče a jde vždy zfalšovat.
  Server dělá hrubé meze a rate limit, zbytek je ruční mazání.
- **Žádný replay, žádné ověření běhu.** Posílá se jen výsledek, ne průběh.
- Žádná historie pokusů - server drží jen best per kategorie.

---

## 2. Architektura

```
┌──────────────────┐   POST /rest/v1/rpc/submit_score   ┌──────────────────────┐
│  Mercenary       │ ─────────────────────────────────▶ │  Supabase (Postgres) │
│  (Godot 4.7)     │   anon key, JSON body              │                      │
│                  │ ◀───────────────────────────────── │  players, scores     │
│  Leaderboard.gd  │   {status, best, rank}             │  submit_score()      │
└──────────────────┘                                    │  RLS: read-only API  │
                                                        └──────────┬───────────┘
                                                                   │ SELECT scores
                                                                   │ anon key
                                                        ┌──────────▼───────────┐
                                                        │  Web (React + Vite)  │
                                                        │  Vercel, statický    │
                                                        │  build, bez backendu │
                                                        └──────────────────────┘
```

Tři části, každá s jasnou rolí:

| Část | Kde běží | Co dělá | Co nedělá |
|---|---|---|---|
| **Hra** | PC hráče | Počítá skóre, drží nick + token, posílá výsledek | Nečte žebříček (zatím), nerozhoduje o pořadí |
| **Supabase** | cloud | Validuje, ukládá, hlídá vlastnictví nicku a rate limit, počítá pořadí | Neví nic o hře mimo to, co dostane v requestu |
| **Web** | Vercel (statické soubory) + prohlížeč | Čte a zobrazuje, filtruje, hledá | Nic nezapisuje, nemá přihlášení |

Není tu žádný vlastní backend. Všechna logika zápisu je v jedné Postgres
funkci `submit_score()`, kterou Supabase vystaví jako HTTP endpoint přes
PostgREST. Web i hra mluví přímo s ní, oba stejným veřejným `anon` klíčem.

---

## 3. Základní pojmy

### Kategorie

Kategorie je čtveřice **mód + mapa + operátor + obtížnost**. Žebříček je vždy
za jednu kategorii, nebo za sjednocení kategorií (filtr "All" na webu).

| Pole | Hodnoty | Odkud ve hře |
|---|---|---|
| `mode` | `classic`, `annihilation`, `endless`, `story` | `GameSettings.game_mode` + `GameSettings.mission_mode` |
| `map_id` | `warehouse`, `office`, `cellar`, `aegis_second_building` (Mercenary); `aegis_side_1`, `aegis_side_2` (Story) | `GameSettings.map_id` - klíč z `GameSettings.MAPS` |
| `operator_id` | `alpha_captain`, `ak_operator`, `deagle_operator` | `GameSettings.mercenary_id` - klíč z `GameSettings.OPERATORS` |
| `difficulty` | `0` Easy, `1` Normal, `2` Hard | `GameSettings.difficulty` |

Mód se odvozuje takto: je-li `game_mode == "story"`, je to `story`; jinak se
`mission_mode` (0/1/2) přeloží na `classic`/`annihilation`/`endless`.

Proč čtveřice a ne jen mapa jako v lokálním `best_scores.cfg`: na lokálním
disku stačí "moje nejlepší na Warehouse". Ve veřejné tabulce by ale Easy +
MP5 soutěžilo s Hard + Deagle a tabulka by ztratila smysl. Lokální systém se
kvůli tomu měnit nemusí - jen se na server posílá víc údajů, než se ukládá
lokálně.

### Záznam

Jeden řádek v tabulce `scores` = **nejlepší výsledek jednoho hráče v jedné
kategorii**. Horší pokus řádek nepřepíše, lepší ho nahradí (včetně kills,
času a data). Hráč tedy má v každé kategorii nejvýš jeden řádek.

### Hráč, nick, token

- **Nick**: 3-16 znaků, jen `A-Z`, `a-z`, `0-9` a `_`. Unikátní bez ohledu
  na velikost písmen (`Hunk` a `hunk` je tentýž hráč, ukládá se v podobě,
  v jaké ho hráč zadal poprvé).
- **Token**: náhodný řetězec (24 bajtů hex = 48 znaků), který si hra vygeneruje
  při prvním uploadu a uloží do `user://settings.cfg`. Server si u nicku pamatuje
  jen jeho SHA-256. Každý další upload pod tím nickem musí přinést tentýž token.
- Hráč je tedy "ten, kdo má token". Nick zabere, kdo ho pošle první.

---

## 4. Jak to vidí hráč

### Poprvé

1. Dohraje misi. Objeví se obrazovka výsledků se skóre (jako dnes).
2. Protože nick ještě není nastavený, hra ukáže jednorázový dialog
   *"Enter a nickname to join the global leaderboard"* s políčkem a tlačítky
   **Join** / **Skip**.
3. **Join**: hra zvaliduje nick, vygeneruje token, uloží obojí do settings a
   pošle výsledek. Pod skóre se objeví *"Global rank: #7"* (nebo chyba, viz
   níže).
4. **Skip**: hra nastaví `upload_scores = false` a už se neptá. Zapnout to jde
   kdykoli v Settings.

### Potom

- Každá dohraná mise (i Endless po smrti) se pošle automaticky. Hráč nic
  nemačká.
- Odpověď serveru se promítne do obrazovky výsledků:
  - `inserted` → *"Global rank: #N"* (první výsledek v té kategorii)
  - `improved` → *"New global best! Rank: #N"*
  - `not_better` → *"Global best: X (rank #N)"*
  - chyba sítě → *"Leaderboard unavailable"* (tiše, bez blokování)
  - `nickname_taken` → *"Nickname is taken - change it in Settings"*
- V Settings menu jsou dvě nové položky: **Nickname** (text) a **Upload
  scores** (On/Off).

### Na webu

Otevře web, klikne na záložku módu, vybere mapu, případně zúží obtížnost a
operátora, a vidí top 100. Do políčka *Player* napíše svůj nick a vidí, kde
je. Klik na libovolný nick otevře přehled všech rekordů toho hráče.

---

## 5. Datový model

Celé schéma je v `supabase/schema.sql`. Spouští se jednou v Supabase SQL
Editoru.

### Tabulka `players`

| Sloupec | Typ | Popis |
|---|---|---|
| `nickname` | `text` PK | 3-16 znaků, `^[A-Za-z0-9_]{3,16}$` (CHECK constraint) |
| `token_hash` | `text` | SHA-256 tokenu, hex. Nikdy se nevrací přes API |
| `created_at` | `timestamptz` | kdy nick vznikl |
| `last_submit_at` | `timestamptz` | pro rate limit |

Unikátní index `players_nickname_lower_idx` na `lower(nickname)` - case-insensitive
unikátnost.

**RLS zapnuté, žádná policy** → přes API tabulku nikdo nevidí (ani `anon`, ani
`authenticated`). Token hash tak nemůže uniknout.

### View `player_profiles`

```sql
select nickname, created_at from players
```

Bez `token_hash`. Běží s právy vlastníka (výchozí `security_invoker = false`),
takže RLS na `players` obchází - záměrně. Web z něj bere jen `count` do hlavičky.
Supabase linter na to upozorní jako na "security definer view", to je v pořádku.

### Tabulka `scores`

| Sloupec | Typ | Popis |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `nickname` | `text` FK → `players` | `on delete cascade on update cascade` |
| `mode` | `text` | CHECK in (`classic`, `annihilation`, `endless`, `story`) |
| `map_id` | `text` | CHECK `^[a-z0-9_]{1,40}$` - záměrně ne výčet, nová mapa ve hře nesmí rozbít upload |
| `operator_id` | `text` | CHECK `^[a-z0-9_]{1,40}$` - totéž |
| `difficulty` | `smallint` | CHECK 0-2 |
| `score` | `integer` | ≥ 0 |
| `kills` | `integer` | ≥ 0 |
| `time_seconds` | `numeric(10,2)` | ≥ 0; u mission módů čas mise, u Endless doba přežití |
| `game_version` | `text` | max 32 znaků, posílá hra (`Leaderboard.GAME_VERSION`) |
| `created_at` | `timestamptz` | kdy vznikl / byl naposledy přepsán lepším |

Constraint `scores_one_per_category UNIQUE (nickname, mode, map_id, operator_id, difficulty)`
je to, co drží "jeden best na hráče a kategorii".

Indexy:

- `scores_category_idx (mode, map_id, difficulty, operator_id, score desc, created_at)` -
  přesně pořadí sloupců, jak web filtruje a řadí.
- `scores_nickname_idx (nickname)` - profil hráče.

**RLS zapnuté, jediná policy: `select using (true)`** → veřejné čtení, žádný
insert/update/delete přes API.

### Funkce `submit_score()`

`security definer`, `search_path = public, extensions`. Jediná cesta, jak do
`players` a `scores` zapsat. Detail v kapitole 6.

### Proč ne jedna tabulka

Token by musel být v každém řádku skóre, nebo by se musel hlídat zvlášť.
Oddělení hráče a skóre dává zadarmo: ban (smazat hráče = kaskádou smazat skóre),
rename (změnit nick = kaskádou přepsat skóre), rate limit per hráč a počet hráčů
do hlavičky.

---

## 6. API

Supabase vystavuje tabulky a funkce přes PostgREST na
`https://<projekt>.supabase.co/rest/v1/`. Každý request nese hlavičky
`apikey: <anon>` a `Authorization: Bearer <anon>`.

### 6.1 Zápis: `POST /rest/v1/rpc/submit_score`

Request body (JSON, názvy parametrů s prefixem `p_` jsou dané funkcí):

```json
{
  "p_nickname": "Hunk",
  "p_token": "3f9c1a…(48 hex znaků)",
  "p_mode": "classic",
  "p_map_id": "warehouse",
  "p_operator_id": "alpha_captain",
  "p_difficulty": 1,
  "p_score": 912,
  "p_kills": 8,
  "p_time_seconds": 71.4,
  "p_game_version": "0.1.0"
}
```

`p_kills`, `p_time_seconds` a `p_game_version` jsou nepovinné (default 0 / 0 / "").

Co funkce udělá, v tomto pořadí:

1. **Validace vstupů** - nick regexem, token 16-128 znaků, mód z výčtu, map/operator
   regexem, obtížnost 0-2, skóre/kills/čas nezáporné.
2. **Hrubé meze skóre**: mission módy ≤ 1000, Endless ≤ `kills × 10`
   (`ENDLESS_KILL_SCORE` v `Main.gd`). Není to anti-cheat, jen pojistka proti
   nesmyslům typu 2 147 483 647.
3. **Hráč**: `select … for update` podle `lower(nickname)`.
   - Neexistuje → založí se s hashem tokenu.
   - Existuje a hash sedí → zkontroluje rate limit (3 s od posledního uploadu),
     aktualizuje `last_submit_at`.
   - Existuje a hash nesedí → `nickname_taken`.
4. **Best v kategorii**: najde stávající řádek pro čtveřici.
   - Není → insert, `status = "inserted"`.
   - Je a nové skóre je vyšší → update všech polí + `created_at = now()`,
     `status = "improved"`.
   - Jinak → nic, `status = "not_better"`.
5. **Pořadí**: `count(*) + 1` řádků ve stejné přesné kategorii se skóre
   vyšším než hráčův best. Remízy sdílejí místo.

Odpověď `200 OK`:

```json
{ "status": "improved", "nickname": "Hunk", "best": 912, "rank": 3 }
```

`nickname` v odpovědi je kanonická podoba (jak byl nick zadaný poprvé) - hra
si ho může přepsat, aby se v Settings ukazoval stejně jako na webu.

Chyba `400 Bad Request`:

```json
{ "code": "P0001", "message": "nickname_taken", "details": null, "hint": null }
```

| `message` | Kdy | Co s tím ve hře |
|---|---|---|
| `invalid_nickname` | nick neprošel regexem | nemělo by nastat, hra validuje stejně |
| `invalid_token` | token chybí / špatná délka | nemělo by nastat |
| `nickname_taken` | nick existuje s jiným tokenem | říct hráči, ať si zvolí jiný |
| `rate_limited` | < 3 s od posledního uploadu téhož hráče | tiše ignorovat, nebo zkusit za pár sekund |
| `invalid_mode` / `invalid_map` / `invalid_operator` / `invalid_difficulty` | mimo výčet/regex | chyba v kódu hry |
| `invalid_score` | záporné nebo nad mezí | chyba v kódu hry, nebo pokus o podvod |

Jiné HTTP kódy: `401`/`403` = špatný anon klíč nebo chybějící grant,
`404` = funkce neexistuje (schema nebylo spuštěno), `5xx` = Supabase.

Ruční test z příkazové řádky:

```bash
curl -X POST "https://PROJEKT.supabase.co/rest/v1/rpc/submit_score" \
  -H "apikey: ANON" -H "Authorization: Bearer ANON" \
  -H "Content-Type: application/json" \
  -d '{"p_nickname":"Hunk","p_token":"test-token-0000000000000000","p_mode":"classic","p_map_id":"warehouse","p_operator_id":"alpha_captain","p_difficulty":1,"p_score":912,"p_kills":8,"p_time_seconds":71.4,"p_game_version":"0.1.0"}'
```

### 6.2 Čtení: `GET /rest/v1/scores`

Web používá `supabase-js`, které tyhle URL skládá samo. Pro představu, co
reálně odchází:

```
GET /rest/v1/scores
    ?select=id,nickname,mode,map_id,operator_id,difficulty,score,kills,time_seconds,game_version,created_at
    &mode=eq.classic
    &map_id=eq.warehouse
    &difficulty=eq.1          (jen když není "All")
    &operator_id=eq.alpha_captain   (jen když není "All")
    &order=score.desc,created_at.asc
    &limit=100
```

Profil hráče: `?nickname=eq.Hunk&order=mode,map_id,difficulty,operator_id`.

Počty do hlavičky: `HEAD /rest/v1/player_profiles?select=nickname` a
`HEAD /rest/v1/scores?select=id` s hlavičkou `Prefer: count=exact`.

Stejné dotazy může v budoucnu volat i hra, kdyby měla žebříček zobrazovat
přímo v menu (viz kapitola 14).

---

## 7. Bezpečnostní model

### Co chrání

| Hrozba | Obrana |
|---|---|
| Někdo zapíše skóre pod cizím nickem | token → hash; bez tokenu je `nickname_taken` |
| Někdo smaže nebo přepíše cizí skóre | tabulky nemají insert/update/delete policy; jediný zápis je přes funkci, která sahá jen na řádky vlastníka tokenu |
| Únik tokenů z DB | ukládá se jen SHA-256, `players` není přes API čitelná vůbec |
| Spam tisíců requestů | 3 s rate limit per hráč; Supabase má navíc vlastní limity na projekt |
| Nesmyslné hodnoty | CHECK constrainty + validace ve funkci |
| Zneužití anon klíče z binárky hry | anon klíč umí jen to, co RLS dovolí: číst `scores`, `player_profiles` a volat `submit_score`. Nic víc |

### Co nechrání

- **Falešné skóre v mezích.** Kdokoli, kdo si přečte anon klíč z binárky
  (nebo odposlechne request), může poslat `p_score: 1000` pro Classic nebo
  `kills: 99999, score: 999990` pro Endless. Řešení je ruční mazání
  (kapitola 12). Kdyby to začalo být problém, viz kapitola 14.
- **Ztráta tokenu.** Smazané savy = ztracený nick. Bez účtů to jinak nejde.
- **Hezké nicky.** Vulgární nick nikdo nefiltruje. Mazání ručně.

### Proč `security definer`

Funkce musí zapisovat do tabulek, do kterých `anon` zapisovat nesmí. Proto
běží s právy svého vlastníka (`postgres`), ne volajícího. Aby to nešlo
zneužít, má pevně nastavený `search_path` (nikdo nemůže podstrčit vlastní
`digest()`), všechny vstupy validuje a nikdy nevrací nic z `players` kromě
kanonického nicku.

---

## 8. Skórování - odkud se berou čísla

Leaderboard skóre nepočítá, jen přijímá to, co hra spočítá dnes. Pro úplnost,
jak čísla vznikají (`GameSettings.gd` a `Main.gd` ve stavu z 1. 9. 2026):

### Mission módy (Classic, Annihilation, Story)

```
kill_ratio   = kills / total_enemies              (0-1)
damage_ratio = 1 - damage_taken / max_health      (0-1)
time_ratio   = par_time / elapsed_seconds         (0-1, strop 1)

score = round(500 × kill_ratio + 350 × damage_ratio + 150 × time_ratio)   → 0-1000
```

`par_time_seconds` je per mapa (Warehouse 90 s, Office 180 s, Cellar 200 s,
Aegis Second Building 150 s, Story mise 150 s). Na server jde `score`,
`kills` a `elapsed_seconds`.

### Endless

```
score = kills × ENDLESS_KILL_SCORE   (= 10)
```

Na server jde `endless_score`, `kills` a doba přežití. Proto server hlídá
`score ≤ kills × 10` - při téhle rovnici to platí vždy. **Pokud se vzorec ve hře
změní** (bonusy za vlny, kombo), je potřeba upravit nebo zrušit tu mez v
`submit_score()`.

### Verze hry

`game_version` je informativní. Až se změní váhy nebo par time, staré
výsledky nejsou srovnatelné s novými. Web je zatím nerozlišuje; záznamy ale
jdou podle verze hromadně smazat nebo později filtrovat.

---

## 9. Napojení hry krok za krokem

Všechny změny jsou v repu `mercenary`. Odhad: 150-200 řádků GDScriptu a dvě
úpravy scén. Pořadí je zvolené tak, aby šlo po každém kroku hru spustit.

### Krok 1: nastavení v `GameSettings.gd`

Tři nové proměnné vedle hlasitosti a jejich persistence:

```gdscript
const NICKNAME_PATTERN := "^[A-Za-z0-9_]{3,16}$"

var nickname: String = ""
var upload_scores: bool = true
var leaderboard_token: String = ""
```

V `_load_settings()`:

```gdscript
	nickname = config.get_value(SETTINGS_SECTION, "nickname", "")
	upload_scores = config.get_value(SETTINGS_SECTION, "upload_scores", true)
	leaderboard_token = config.get_value(SETTINGS_SECTION, "leaderboard_token", "")
```

V `_save_settings()`:

```gdscript
	config.set_value(SETTINGS_SECTION, "nickname", nickname)
	config.set_value(SETTINGS_SECTION, "upload_scores", upload_scores)
	config.set_value(SETTINGS_SECTION, "leaderboard_token", leaderboard_token)
```

Settery a pomocné funkce:

```gdscript
static func is_valid_nickname(value: String) -> bool:
	var re := RegEx.new()
	re.compile(NICKNAME_PATTERN)
	return re.search(value) != null

func set_nickname(value: String) -> bool:
	if not is_valid_nickname(value):
		return false
	nickname = value
	_save_settings()
	return true

func set_upload_scores(enabled: bool) -> void:
	upload_scores = enabled
	_save_settings()

# Token vzniká líně - až při prvním uploadu, ne při instalaci.
func get_or_create_leaderboard_token() -> String:
	if leaderboard_token == "":
		leaderboard_token = Crypto.new().generate_random_bytes(24).hex_encode()
		_save_settings()
	return leaderboard_token

func leaderboard_mode_id() -> String:
	if game_mode == GAME_MODE_STORY:
		return "story"
	return ["classic", "annihilation", "endless"][mission_mode]
```

### Krok 2: autoload `scripts/Leaderboard.gd`

Nový soubor, zaregistrovat v `project.godot` **za** `GameSettings`:

```ini
[autoload]
Audio="*res://scripts/Audio.gd"
GameSettings="*res://scripts/GameSettings.gd"
Leaderboard="*res://scripts/Leaderboard.gd"
```

```gdscript
extends Node

# Anon klíč smí být v binárce - umí jen číst skóre a volat submit_score().
const SUPABASE_URL := "https://TVUJ-PROJEKT.supabase.co"
const SUPABASE_ANON_KEY := "eyJ..."
const GAME_VERSION := "0.1.0"

## {"status": "inserted"|"improved"|"not_better", "nickname": String, "best": int, "rank": int}
signal submitted(result: Dictionary)
## Kód ze serveru (nickname_taken, rate_limited, ...) nebo "network" / "busy".
signal failed(code: String)

var _http: HTTPRequest

func _ready() -> void:
	_http = HTTPRequest.new()
	_http.timeout = 10.0
	add_child(_http)
	_http.request_completed.connect(_on_request_completed)

func is_enabled() -> bool:
	return GameSettings.upload_scores and GameSettings.nickname != ""

## Pošle výsledek aktuálně nastavené kategorie (GameSettings.map_id atd.).
## Volat hned po dohrání, dokud se GameSettings nezmění.
func submit(score: int, kills: int, elapsed_seconds: float) -> void:
	if not is_enabled():
		return
	if _http.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		failed.emit("busy")
		return
	var body := {
		"p_nickname": GameSettings.nickname,
		"p_token": GameSettings.get_or_create_leaderboard_token(),
		"p_mode": GameSettings.leaderboard_mode_id(),
		"p_map_id": GameSettings.map_id,
		"p_operator_id": GameSettings.mercenary_id,
		"p_difficulty": GameSettings.difficulty,
		"p_score": score,
		"p_kills": kills,
		"p_time_seconds": snappedf(elapsed_seconds, 0.01),
		"p_game_version": GAME_VERSION,
	}
	var headers := PackedStringArray([
		"apikey: " + SUPABASE_ANON_KEY,
		"Authorization: Bearer " + SUPABASE_ANON_KEY,
		"Content-Type: application/json",
	])
	var err := _http.request(
		SUPABASE_URL + "/rest/v1/rpc/submit_score",
		headers, HTTPClient.METHOD_POST, JSON.stringify(body))
	if err != OK:
		failed.emit("network")

func _on_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS:
		failed.emit("network")
		return
	var parsed = JSON.parse_string(body.get_string_from_utf8())
	if response_code == 200 and parsed is Dictionary:
		# Server vrací kanonický nick (velikost písmen z prvního uploadu).
		if parsed.get("nickname", "") != GameSettings.nickname:
			GameSettings.set_nickname(String(parsed["nickname"]))
		submitted.emit(parsed)
	elif parsed is Dictionary and parsed.has("message"):
		failed.emit(String(parsed["message"]))
	else:
		failed.emit("http_%d" % response_code)
```

Poznámky:

- `HTTPRequest` je node, proto autoload a ne statická funkce. Jeden request
  najednou stačí - mise se nedohrávají dvakrát za sekundu.
- Timeout 10 s: když Supabase neodpoví, hráč nečeká věčně a obrazovka
  výsledků funguje dál.
- Žádné opakování při chybě. Výsledek se prostě nenahraje, lokální best
  zůstane. Další mise se pošle normálně.
- Hodnoty do `body` se berou v okamžiku volání. `MissionResults` i endless
  game-over se volají, dokud `GameSettings.map_id` atd. ještě odpovídají
  právě dohrané misi - to je důležité, protože `_on_next_mission_pressed()`
  v `MissionResults.gd` mění `map_id` na další misi.

### Krok 3: volání z obrazovky výsledků

`MissionResults.gd`, v `show_results()` hned za výpočtem skóre:

```gdscript
	var score := GameSettings.calculate_mission_score(kills, total_enemies, damage_taken, max_health, elapsed_seconds)
	score_label.text = "SCORE: %d / 1000" % score

	if GameSettings.try_update_best_score(map_id, score):
		best_label.text = "NEW BEST SCORE!"
	else:
		best_label.text = "Best: %d / 1000" % GameSettings.get_best_score(map_id)

	_submit_to_leaderboard(score, kills, elapsed_seconds)
```

a nové funkce v témže souboru (plus `global_label: Label` ve scéně pod
`Best`):

```gdscript
func _submit_to_leaderboard(score: int, kills: int, elapsed_seconds: float) -> void:
	global_label.text = ""
	if not GameSettings.upload_scores:
		return
	if GameSettings.nickname == "":
		_ask_for_nickname(score, kills, elapsed_seconds)
		return
	global_label.text = "Uploading…"
	Leaderboard.submitted.connect(_on_leaderboard_submitted, CONNECT_ONE_SHOT)
	Leaderboard.failed.connect(_on_leaderboard_failed, CONNECT_ONE_SHOT)
	Leaderboard.submit(score, kills, elapsed_seconds)

func _on_leaderboard_submitted(result: Dictionary) -> void:
	Leaderboard.failed.disconnect(_on_leaderboard_failed)
	match String(result.get("status", "")):
		"improved": global_label.text = "NEW GLOBAL BEST! Rank #%d" % int(result.get("rank", 0))
		"inserted": global_label.text = "Global rank: #%d" % int(result.get("rank", 0))
		_: global_label.text = "Global best: %d (rank #%d)" % [int(result.get("best", 0)), int(result.get("rank", 0))]

func _on_leaderboard_failed(code: String) -> void:
	Leaderboard.submitted.disconnect(_on_leaderboard_submitted)
	match code:
		"nickname_taken": global_label.text = "Nickname taken - change it in Settings"
		"rate_limited", "busy": global_label.text = ""
		_: global_label.text = "Leaderboard unavailable"
```

`CONNECT_ONE_SHOT` + ruční disconnect druhého signálu zajistí, že se handlery
nehromadí mezi misemi (autoload žije celou dobu, `MissionResults` ne).

### Krok 4: volání z Endless game-over

`Main.gd`, `_on_player_died()`, větev `objective_type == "endless"`. Endless
nemá `MissionResults`, výsledek se píše do HUD zprávy:

```gdscript
	if objective_type == "endless":
		Audio.stop_endless_music()
		var elapsed_seconds := (Time.get_ticks_msec() - mission_start_msec) / 1000.0
		var is_new_best := GameSettings.try_update_endless_best_score(GameSettings.map_id, GameSettings.mercenary_id, endless_score)
		var best_line := "NEW BEST SCORE!" if is_new_best else "Best: %d" % GameSettings.get_endless_best_score(GameSettings.map_id, GameSettings.mercenary_id)
		hud.show_message("MISSION FAILED\nScore: %d - Kills: %d\n%s\nPress R to restart" % [endless_score, kills, best_line])
		if Leaderboard.is_enabled():
			Leaderboard.submitted.connect(func(r): hud.show_message("MISSION FAILED\nScore: %d - Kills: %d\n%s\nGlobal rank: #%d\nPress R to restart" % [endless_score, kills, best_line, int(r.get("rank", 0))]), CONNECT_ONE_SHOT)
			Leaderboard.submit(endless_score, kills, elapsed_seconds)
```

(`mission_start_msec` v `Main.gd` už existuje, používá ho `_complete_mission()`.)

Kdo nemá nick nastavený, v Endless dialog nedostane - ten se ukáže až po
první mission misi. Zjednodušení; jde to změnit.

### Krok 5: Settings menu

`SettingsMenu.tscn` dostane dva nové řádky ve stejném stylu jako ostatní:

- **Nickname**: `LineEdit` (`max_length = 16`) + label se stavem. Při
  `text_submitted` nebo `focus_exited` zavolat `GameSettings.set_nickname()`;
  když vrátí `false`, zobrazit "3-16 letters, digits or _" a vrátit původní
  hodnotu.
- **Upload scores**: řádek s `<` `>` jako Fullscreen, přepíná
  `GameSettings.set_upload_scores()`.

V `SettingsMenu.gd` to je ~25 řádků podle vzoru `_on_fullscreen_step` /
`_update_fullscreen_display`.

Pozor na vstup: `LineEdit` ve fullscreen hře chytá klávesy. Settings menu se
otevírá i z pauzy ve hře (`PauseMenu`), takže při fokusu v políčku nesmí `W`
hýbat postavou - `get_tree().paused = true` už to řeší, protože Player má
výchozí `process_mode`.

### Krok 6: dialog pro první nick

Nová scéna `scenes/NicknameDialog.tscn` (CanvasLayer, `process_mode =
PROCESS_MODE_ALWAYS` jako ostatní overlaye): titulek, `LineEdit`, chybový
label, tlačítka **Join** a **Skip**. Signál `finished(joined: bool)`.

Z `MissionResults._ask_for_nickname()`:

```gdscript
func _ask_for_nickname(score: int, kills: int, elapsed_seconds: float) -> void:
	var dialog: CanvasLayer = NICKNAME_DIALOG_SCENE.instantiate()
	add_child(dialog)
	dialog.finished.connect(func(joined: bool):
		if joined:
			_submit_to_leaderboard(score, kills, elapsed_seconds)
		else:
			GameSettings.set_upload_scores(false)
	)
```

Skip vypne upload natrvalo (do zapnutí v Settings). Jinak by se dialog
ukazoval po každé misi, což otravuje.

### Krok 7: test

1. Spustit `supabase/schema.sql` (pokud ještě nebylo), vyplnit URL a anon klíč
   do `Leaderboard.gd`.
2. F5, dohrát Warehouse na Normal. Dialog → nick → "Global rank: #1".
3. Otevřít web, Classic / Warehouse: řádek je tam.
4. Dohrát znovu s horším výsledkem → "Global best: X (rank #1)", na webu beze změny.
5. Dohrát lépe → "NEW GLOBAL BEST!", na webu nové skóre a datum.
6. V Supabase Table Editoru změnit `token_hash` hráče na cokoli → další upload
   dá "Nickname taken".
7. Odpojit síť → "Leaderboard unavailable", hra jede dál.
8. Endless na Cellar, umřít → HUD ukáže global rank.

### Krok 8: export

Export šablona musí mít povolený síťový přístup (výchozí ano). Na Windows
exportu nic dalšího. Kdyby se někdy dělal web export (HTML5), CORS: Supabase
povoluje `*`, takže taky nic.

### Co ve hře **neměnit**

- Lokální `best_scores.cfg` a `endless_best_scores.cfg` zůstávají. Fungují
  offline a High Scores menu je používá.
- `calculate_mission_score()` - server počítá s tím, že výsledek je 0-1000.

---

## 10. Webová aplikace

### Technologie

React 19, Vite 8, `@supabase/supabase-js` 2. Bez routeru, bez stavové
knihovny, bez UI frameworku - jeden CSS soubor. Lint `oxlint`. Fonty z Google
Fonts: Silkscreen (pixel titulky), Inter Tight (text), JetBrains Mono (čísla).

### Struktura

```
index.html                     fonty, meta, #root
src/main.jsx                   mount
src/App.jsx                    stav filtrů, hledání, vybraný hráč; skládá komponenty
src/index.css                  vše vizuální; proměnné v :root
src/lib/supabaseClient.js      createClient, isConfigured
src/lib/game.js                MODES, MAPS, OPERATORS, DIFFICULTIES + helpery názvů
src/lib/scores.js              fetchLeaderboard, fetchPlayerScores, fetchStats
src/lib/format.js              čas mm:ss, datum, tisíce
src/hooks/useLeaderboard.js    načtení + stav loading/error
src/hooks/useStats.js          počty do hlavičky
src/components/Header.jsx      logo, titulek, počty
src/components/FilterBar.jsx   záložky módů, chipy mapa/obtížnost/operátor, hledání
src/components/ScoreTable.jsx  tabulka, medaile, prázdný/chybový stav
src/components/PlayerModal.jsx profil hráče
src/components/SetupNotice.jsx návod, když chybí .env
src/components/Footer.jsx      čas načtení, Refresh
```

### Chování

- **Filtry** jsou stav v `App.jsx`: `{ mode, mapId, difficulty, operatorId }`.
  Výchozí Classic / Warehouse / All / All. Při změně módu se zkontroluje, že
  mapa v novém módu existuje, jinak se vezme první (Story má jiné mapy).
- **Načtení** dělá `useLeaderboard`. Klíč = filtry + číslo verze (Refresh ho
  zvýší). Pokud klíč posledního výsledku nesedí s aktuálním, je `loading`.
  Staré řádky zůstávají ztlumené, dokud nepřijdou nové - žádné bliknutí
  prázdné tabulky.
- **Pořadí** se přiděluje až v `App.jsx` z plného seznamu (`index + 1`).
  Hledání nicku pak filtruje už očíslované řádky, takže hráč na 37. místě
  vidí "37" i když je ve výsledku sám.
- **"All"** u obtížnosti/operátora znamená sjednocení podkategorií. Stejný
  nick se může objevit vícekrát (best v Easy i v Hard). Je to záměr a hint
  nad filtry to říká. Kdyby to vadilo, dá se udělat dedup per nick na klientu.
- **Limit 100** řádků. Víc nemá na jedné obrazovce smysl; stránkování není.
- **Profil hráče**: modal, zavírá se Esc nebo klikem mimo. Výsledek je
  svázaný s nickem, při otevření jiného hráče se starý nezobrazí.
- **Bez `.env`**: `isConfigured = false`, web ukáže `SetupNotice` a nic
  nevolá. Užitečné pro první `npm run dev`.
- **Chyba Supabase**: červený box s textem chyby, tabulka se nevykreslí.

### Přidání mapy / operátora / módu

Nic ve schématu se nemění (sloupce jsou volný text s regexem). Na webu:

- Mapa: `MAPS` v `src/lib/game.js` + zařadit do `MERCENARY_MAPS` nebo
  `STORY_MAPS`.
- Operátor: `OPERATORS` + `OPERATOR_ORDER`.
- Mód: `MODES` + rozšířit CHECK constraint `scores.mode` v DB
  (`alter table scores drop constraint scores_mode_check; alter table scores add constraint … check (mode in (...))`)
  a výčet v `submit_score()`.

Neznámé ID web nespadne, zobrazí ho syrově (`new_map`). Takže hra může dostat
novou mapu dřív, než se web aktualizuje.

### Vzhled

Tmavé téma jen; paleta z hry (`default_clear_color` 0.02/0.02/0.03, zlatá
0.9/0.85/0.2 z High Scores). Jemná mřížka v pozadí odkazuje na voxely.
Všechno v CSS proměnných v `:root` - změna barvy = jeden řádek. Responzivní:
na mobilu se tabulka posouvá vodorovně, sloupec data a zbraň se schovají.

---

## 11. Nasazení a provoz

### Supabase

1. Projekt (klidně stejný jako watchlist - jména tabulek se nepletou).
2. SQL Editor → `supabase/schema.sql` → Run. Má proběhnout bez chyby; pokud
   hlásí `digest does not exist`, chybí pgcrypto - první řádek skriptu ho
   instaluje do schématu `extensions`, kde ho Supabase čeká.
3. Volitelně `supabase/seed.sql` (12 testovacích záznamů, hráči `test_*`).
4. Settings → API: Project URL + anon key.

Žádný Auth provider, žádný Storage, žádný Realtime. Free tier (500 MB DB,
5 GB egress/měsíc) stačí na stovky tisíc záznamů.

### Vercel

Import repa `qves34/WebLeaderboard`, framework Vite (detekuje sám), env
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Každý push do `main` = nový
deploy. Preview deploy pro branch automaticky.

Alternativy, kdyby Vercel nevyhovoval: Netlify, Cloudflare Pages, GitHub
Pages - je to statický build, stačí `npm run build` a nahrát `dist/`.

### Lokálně

```bash
cp .env.example .env     # doplnit URL + klíč
npm install
npm run dev              # http://localhost:5173
npm run lint
npm run build && npm run preview
```

Node 20.19+ nebo 22.12+ (Vite 8 na starším neběží).

### Co sledovat

- Supabase dashboard → Database → Query Performance, kdyby web začal být
  pomalý (nemělo by - dotazy jedou přes `scores_category_idx`).
- Supabase → Logs → API, když hra hlásí chyby uploadu.
- Vercel → Deployments, když web neběží po pushi (typicky chybějící env).

---

## 12. Správa a moderace

Vše z Supabase Table Editoru nebo SQL Editoru. Service role / dashboard RLS
obchází, takže delete a update tam fungují.

| Úkon | Jak |
|---|---|
| Smazat podezřelé skóre | `scores` → řádek → Delete. Hráč zůstane, může poslat nový |
| Smazat hráče + všechna skóre (ban) | `players` → řádek → Delete. Kaskáda smaže `scores`. Nick se uvolní - kdokoli (i on) ho může znovu zabrat |
| Přejmenovat hráče | `update players set nickname = 'Novy' where nickname = 'Stary'` - `scores` se přepíšou kaskádou |
| Hráč ztratil token, chce nick zpět | smazat jeho řádek v `players` (ztratí rekordy), hra ho při dalším uploadu založí znovu s novým tokenem. Nebo mu nastavit `token_hash = encode(extensions.digest('jeho-novy-token', 'sha256'), 'hex')`, pokud token pošle |
| Reset po změně balancu | `delete from scores where game_version <> '0.2.0'`, nebo všechno: `truncate scores` |
| Smazat testovací data | `delete from players where nickname like 'test_%'` |
| Změnit limit skóre | upravit `submit_score()` a znovu spustit `create or replace function …` část skriptu |

Zatím není žádné admin UI na webu. Pokud bude moderace častá, dá se přidat
stránka chráněná Supabase Auth (jako ve watchlistu) s tlačítkem Delete - RLS
policy pro delete by pak měla podmínku na konkrétní `auth.uid()`.

---

## 13. Okrajové případy a FAQ

**Dva hráči na jednom PC.** Sdílejí `user://settings.cfg`, tedy jeden nick a
token. Řešení: přepsat nick v Settings - token zůstane stejný, server nový
nick založí s týmž hashem. Oba nicky pak "vlastní" tatáž instalace. Funguje,
jen to není hezké.

**Stejný hráč na dvou PC.** Dva tokeny, jeden nick → druhé PC dostane
`nickname_taken`. Workaround: ručně zkopírovat `leaderboard_token` z
`settings.cfg` (Windows: `%APPDATA%\Godot\app_userdata\Mercenary\settings.cfg`).
Správné řešení by byly účty, což je mimo záměr.

**Hráč změní nick v Settings.** Server ho vidí jako nového hráče. Staré rekordy
zůstanou pod starým nickem (a token je stejný, takže je nikdo jiný nepřepíše).
Chce-li je převést, viz "Přejmenovat hráče" v kapitole 12.

**Remízy.** Dva hráči se stejným skóre mají stejný `rank` ze serveru; na webu
rozhoduje `created_at` (dřívější výš). Web ukazuje pořadí 1, 2, 3 bez
sdílených míst - drobná nekonzistence, zatím nevadí.

**Upload během přepnutí mise.** `Leaderboard.submit()` čte `GameSettings` v
okamžiku volání, ne po odpovědi. `_on_next_mission_pressed()` v
`MissionResults` změní `map_id` až po kliknutí hráče, tedy po odeslání. OK.

**Hra bez sítě.** `HTTPRequest` vrátí chybu, `failed("network")`, label
"Leaderboard unavailable". Žádný retry, žádná fronta. Výsledek propadne. Pokud
by to vadilo, viz kapitola 14 (offline fronta).

**Hodiny hráče.** `created_at` nastavuje server (`now()`), čas hráčova PC se
nepoužívá.

**Diakritika v nicku.** Nejde, regex povoluje jen ASCII. Vědomě - jednoduché
URL, žádné problémy s unicode normalizací.

**Co když Supabase projekt zanikne.** Free tier projekty se po týdnu
nečinnosti pozastavují (API vrací 5xx), po obnovení v dashboardu běží dál.
Hra to přežije (unavailable), web ukáže chybu.

**Proč se posílá i horší výsledek.** Protože lokální best je klíčovaný jinak
(jen mapa) než serverový (čtveřice). Hráč může mít lokální best 900 z Normal,
odehraje 700 na Hard - lokálně to best není, ale v kategorii Hard na serveru
klidně ano. Server si "je to lepší?" rozhodne sám.

---

## 14. Co by šlo dál

Seřazeno podle užitku / pracnosti.

1. **Žebříček přímo ve hře.** High Scores menu by vedle lokálních bestů
   ukázalo top 10 ze serveru - jeden `GET /rest/v1/scores?…` navíc. Nejvíc
   viditelné pro hráče.
2. **Sdílené pořadí (remízy)** na webu stejně jako na serveru.
3. **Celkové pořadí hráčů** - součet bestů přes kategorie, nebo počet prvních
   míst. Na serveru jako view, na webu nová záložka "Overall".
4. **Filtr podle verze hry** na webu, až bude víc než jedna.
5. **Offline fronta** ve hře: neodeslané výsledky do `user://pending.cfg`,
   odeslat při dalším startu.
6. **Podpis requestu** tajným klíčem v binárce (HMAC přes body). Zvedne laťku
   pro podvádění z "přečíst anon klíč" na "rozebrat binárku". Server by
   ověřoval v `submit_score()`. Pořád obejitelné, ale ne z curl.
7. **Admin stránka** s mazáním (Supabase Auth + delete policy pro jedno UID).
8. **Realtime**: Supabase Realtime na `scores` a web se obnoví sám, když
   někdo nahraje. Watchlist to už používá pro žádosti o přátelství.
9. **Náhledy map** z `resources/map_previews/` ve hře jako pozadí záložek.

---

*Verze dokumentu: 1.0, 30. 10. 2026. Odpovídá commitu, který přidal webovou
aplikaci a schéma. Při změně schématu nebo API aktualizovat kapitoly 5, 6 a 9.*
