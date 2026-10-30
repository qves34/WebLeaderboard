# Napojení hry (Godot 4.7)

Co se musí do Mercenary přidat, aby uměla posílat výsledky na leaderboard.
Tohle je návrh pro další krok - zatím **nic z toho ve hře není**.

## Kategorie

Jeden záznam = nejlepší výsledek hráče v kategorii. Kategorie je čtveřice:

| Pole | Hodnoty | Odkud ve hře |
|---|---|---|
| `mode` | `classic`, `annihilation`, `endless`, `story` | `GameSettings.game_mode` + `GameSettings.mission_mode` |
| `map_id` | klíč z `GameSettings.MAPS` | `GameSettings.map_id` |
| `operator_id` | klíč z `GameSettings.OPERATORS` | `GameSettings.mercenary_id` |
| `difficulty` | `0` Easy, `1` Normal, `2` Hard | `GameSettings.difficulty` |

Dnešní lokální `best_scores.cfg` je klíčované jen podle mapy (bez obtížnosti a
operátora) - lokální systém se měnit nemusí, na web se ale posílá plná čtveřice.

## Nickname a token

- Nick: 3-16 znaků, jen `A-Z a-z 0-9 _`. Server ho kontroluje regexem
  `^[A-Za-z0-9_]{3,16}$`, hra by měla totéž hlídat v políčku v Settings menu.
- Token: náhodný řetězec, vygenerovaný jednou při prvním uploadu a uložený do
  `user://settings.cfg`. Server si pamatuje jeho SHA-256 u nicku. Kdo nick
  zabral první, ten ho vlastní; cizí upload pod stejným nickem dostane
  `nickname_taken`. Když hráč token ztratí (smaže savy), nick je pryč -
  to je vědomý kompromis, žádné účty.
- Změna nicku v Settings = ze serveru nový hráč, staré rekordy zůstanou pod
  starým nickem. Přejmenování jde ručně v Supabase (update players, scores se
  přepíšou kaskádou díky `on update cascade`).

## Volání API

```
POST {SUPABASE_URL}/rest/v1/rpc/submit_score
apikey: {ANON_KEY}
Authorization: Bearer {ANON_KEY}
Content-Type: application/json

{
  "p_nickname": "Hunk",
  "p_token": "f3a9…",
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

Odpověď `200`:

```json
{ "status": "inserted" | "improved" | "not_better", "nickname": "Hunk", "best": 912, "rank": 3 }
```

Chyba `400` s `{"message": "<kód>"}`: `invalid_nickname`, `invalid_token`,
`nickname_taken`, `rate_limited` (víc než 1 upload za 3 s), `invalid_mode`,
`invalid_map`, `invalid_operator`, `invalid_difficulty`, `invalid_score`
(mission skóre > 1000, nebo endless skóre > kills × 10).

Anon klíč smí být ve hře natvrdo - umí jen číst skóre a volat `submit_score`,
nic jiného RLS nepustí.

## Návrh autoloadu `Leaderboard.gd`

Nový autoload (do `project.godot` za `GameSettings`). Volání z
`MissionResults.show_results()` a z endless game-over větve v `Main.gd`.

```gdscript
extends Node

const SUPABASE_URL := "https://TVUJ-PROJEKT.supabase.co"
const SUPABASE_ANON_KEY := "eyJ..."
const GAME_VERSION := "0.1.0"

signal submitted(result: Dictionary)   # {"status", "nickname", "best", "rank"}
signal failed(code: String)            # kód chyby ze serveru nebo "network"

var _http: HTTPRequest

func _ready() -> void:
	_http = HTTPRequest.new()
	_http.timeout = 10.0
	add_child(_http)
	_http.request_completed.connect(_on_request_completed)

func is_enabled() -> bool:
	return GameSettings.upload_scores and GameSettings.nickname != ""

func mode_id() -> String:
	if GameSettings.game_mode == GameSettings.GAME_MODE_STORY:
		return "story"
	return ["classic", "annihilation", "endless"][GameSettings.mission_mode]

func submit(score: int, kills: int, elapsed_seconds: float) -> void:
	if not is_enabled():
		return
	if _http.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		return  # předchozí request ještě běží
	var body := {
		"p_nickname": GameSettings.nickname,
		"p_token": GameSettings.get_or_create_leaderboard_token(),
		"p_mode": mode_id(),
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
	var err := _http.request(SUPABASE_URL + "/rest/v1/rpc/submit_score", headers, HTTPClient.METHOD_POST, JSON.stringify(body))
	if err != OK:
		failed.emit("network")

func _on_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS:
		failed.emit("network")
		return
	var parsed = JSON.parse_string(body.get_string_from_utf8())
	if response_code == 200 and parsed is Dictionary:
		submitted.emit(parsed)
	elif parsed is Dictionary and parsed.has("message"):
		failed.emit(String(parsed["message"]))
	else:
		failed.emit("http_%d" % response_code)
```

Do `GameSettings.gd` přibude:

```gdscript
var nickname: String = ""
var upload_scores: bool = true
var leaderboard_token: String = ""

func get_or_create_leaderboard_token() -> String:
	if leaderboard_token == "":
		leaderboard_token = Crypto.new().generate_random_bytes(24).hex_encode()
		_save_settings()
	return leaderboard_token
```

a tři klíče v `_load_settings()` / `_save_settings()` (`nickname`, `upload_scores`,
`leaderboard_token`) vedle hlasitosti.

## Kde to zavolat

- `MissionResults.show_results()` - hned po `calculate_mission_score()`:
  `Leaderboard.submit(score, kills, elapsed_seconds)`. Odpověď (`rank`) jde
  zobrazit pod "NEW BEST SCORE!" - např. "Global rank: #3".
- `Main.gd`, endless game-over větev (kolem `try_update_endless_best_score`):
  `Leaderboard.submit(endless_score, kills, elapsed)`.
- Posílat vždy, ne jen při lokálním rekordu - server si best drží sám a lokální
  cfg je klíčované jinak (bez obtížnosti), takže by se některé rekordy minuly.

## UI ve hře

- Settings menu: políčko Nickname (validace regexem, max 16 znaků) a přepínač
  "Upload scores to leaderboard".
- Při prvním výsledku bez nastaveného nicku: jednorázový dialog "Enter nickname
  to join the global leaderboard" s možností Skip (nastaví `upload_scores = false`).
- Pro Endless je `time_seconds` doba přežití; pro mission módy čas mise.
