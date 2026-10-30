# WebLeaderboard

Veřejný žebříček hry **Mercenary**, voxelové taktické FPS. Hráči nahrávají výsledky přímo ze hry pod svým nickem a web ukazuje, kdo je nejlepší v každé kategorii.

**Web: https://webleaderboard.vercel.app**

## Co web umí

- **Módy**: záložky Classic, Annihilation, Endless a Story.
- **Filtry**: mapa, obtížnost a operátor. Story má vlastní dvě mise, ostatní módy čtyři mapy.
- **Top 100**: pořadí, nick, skóre, počet zabití, čas, operátor se zbraní, obtížnost a datum. První tři místa mají medaile.
- **Hledání hráče**: v aktuální tabulce podle nicku. Pořadí hráče se při hledání nemění.
- **Profil hráče**: po kliknutí na nick se ukážou všechny jeho rekordy.
- **Počítadlo**: v hlavičce je počet hráčů a záznamů.

Web je veřejný a nevyžaduje přihlášení. Jazykem je angličtina, stejně jako ve hře.

## Jak se hráč dostane na žebříček

1. Ve hře si zvolí nickname, a to po první dohrané misi nebo v Settings.
2. Dohraje misi nebo běh v Endless.
3. Hra výsledek nahraje a ukáže globální pořadí.
4. Výsledek se objeví na webu.

V Endless se hra na nick neptá, proto je potřeba ho nastavit předem v Settings.

## Pravidla žebříčku

- **Kategorie** je kombinace módu, mapy, operátora a obtížnosti.
- Jeden hráč může být ve všech kategoriích a v každé má jen svůj nejlepší výsledek. Horší pokus nic nepřepíše.
- Při filtru „All" u obtížnosti nebo operátora se může stejný nick objevit vícekrát, protože tabulka spojuje víc kategorií.
- Skóre v Classic, Annihilation a Story je 0 až 1000. V Endless je to 10 bodů za zabití bez horní hranice.
- Nick má 3 až 16 znaků a patří tomu, kdo ho použil první. Účty ani hesla neexistují.

## Technologie

React a Vite na Vercelu, data v Supabase. Každý `git push` do větve `main` nasadí novou verzi.

Lokální spuštění vyžaduje Node 20.19+ nebo 22.12+ a soubor `.env` podle `.env.example`:

```bash
npm install
npm run dev
```

## Omezení

- Výsledky posílá hra a dají se zfalšovat. Server zachytí jen nesmyslné hodnoty, podezřelé záznamy se mažou ručně.
- Kdo ztratí uložená data hry, přijde o svůj nick.

## Související projekt

Hra je v repozitáři `qves34/mercenary`.
