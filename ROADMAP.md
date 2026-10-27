# Plán rozvoje 1.1.0 → 2.0.0

Cílová verze **2.0.0** má udělat z rozšíření nástroj, kterým se na arch vytiskne najednou
celá série štítků a který se neztratí při přenosu na jiný počítač. Čitelnost čárových kódů
a bezpečnost dat zůstávají nepřekročitelné.

## Kde jsme: 1.1.0 (1. 10. 2026)

Rozšíření pro Chrome/Edge a **webová aplikace na mobil** (`pwa/`), obojí ze stejné logiky:
jeden kód ze zadané verze plechu (v SAPu šarže dodavatele), čárový kód Code 128, tisk
jednoho i více štítků v milimetrech s konfigurací přímo v panelu, více kódů najednou,
historie 50 záznamů. Bez závislostí, 55 testů, formát kódu je ustálený. PWA funguje
i bez signálu a jde přidat na plošku telefonu.

**Co v 1.1.0 chybí z pohledu denní práce:** data nejdou přenést jinam, tisk na arch
s rozvržením konkrétní role nemá předvolbu odsazení, rozsah verzí (řadu verzí po sobě)
nejde zadat, historie neumí vyexportovat a chybí sjednocené UI (panel tisku, více kódů
a historie jsou tři samostatné bloky). Historie rozšíření a PWA jsou navíc oddělené,
takže se mezi zařízeními nepropíše.

## Cíle pro 2.0.0

1. **Nepřijít o historii** – záloha a přenos dat mezi počítači a profily.
2. **Tisk na arch podle předlohy** – správné odsazení a rozměr štítků bez zbytečného vystřihování.
3. **Rozsah verzí** – vygenerovat celou řadu štítků jedním vstupem.
4. **Uspořádané UI** – popup, který se vejde a nepřeteče.
5. **Dát pod kontrolou** – schéma úložiště s číslem schématu a migrací, export do CSV pro vedení.

## Oblasti a priority

| # | Oblast | Popis | Priorita | Náročnost |
| --- | --- | --- | --- | --- |
| A | Záloha a přenos dat | export/import JSON, případně CSV, a verze schématu | P1 | S |
| B | Šablony tisku na A4 | předvolby rozvržení (2 × 7, 3 × 13, …) + odsazení X/Y v mm pro předtištěnou roli | P1 | M |
| C | Rozsah verzí (série štítků) | rozsah verzí (`12472A`–`12472Z`, 26 hodnot), počet kusů, přírůstek | P1 | M |
| D | Nové UI popupu | záložky *Jeden kód / Rozsah verzí / Historie* místo jedné dlouhé stránky | P1 | M |
| E | Vzestupné schéma 2 | `schema: 2`, automatická migrace dat z 1.x, oddělené nastavení | P1 | M |
| F | Historie | filtrování podle dne, seskupení po dnech, export CSV | P2 | S |
| G | Nastavení | výchozí šířka štítku, výchozí kusů, chování Enteru, zvýraznění | P2 | S |
| H | Sken jako vstup | načtení cizího kódu skenerem → doplní verzi do pole (dnes jde zadat ručně na stránce velkého kódu) | P2 | M |
| I | Tisk na role (ZPL/TSPL) | generátor tiskového kódu pro termoprintery | P2 | L |
| J | Kvalita kódu | eslint, pokrytí testy, e2e v jednom příkazu, typy (JSDoc → TS) | P2 | M |
| K | Sync přes účet Google | `chrome.storage.sync` pro více zařízení (kvóta, jen malá data) | P3 | S |
| L | Rychlý režim | další klávesové zkratky v popupu, Enter bez ukládání, poslední použité rozměry | P3 | S |
| M | PWA | **hotovo v 1.1.0** jako základ: mobilní UI a offline režim. Zbývá dotáhnout sdílenou historii mezi rozšířením a PWA (A) a případně sken kódů kamerou (viz H) | P2 | M |

Náročnost odhadem pro jednoho člověka: **S** = pár dní, **M** = týden, **L** = více týdnů.
Priority: **P1** = patří do 2.0.0, **P2** = naplánováno, **P3** = až po zjištění potřeby.

## Milníky

### 1.1.0 – drobnosti a odolnost (S)
- Opravy z provozu, zpřesnění hlášení v UI, sjednocení velikostí v `label.js`.
- **Hotovo, když:** žádné známé chyby z prvního měsíce provozu, testy zelené.
- **Hotovo (1. 10. 2026):** viz [CHANGELOG.md](CHANGELOG.md) – opravený Enter ve velkém
  kódu, prázdná tisková stránka, `hidden` atribut, ukládání panelu historie, desetinná
  čárka a předvolby štítku. Navíc přibyla mobilní PWA.

### 1.2.0 – zálohy a schéma (A, E, F)
- `chrome.storage.local` klíč `sklad` doplněn o `schema: 1`; čtení tolerantní k chybějícímu poli.
- **Export / import** JSON (celý stav) a **export historie do CSV** (`kod, verze, den, cas`).
- Formát stavu se popíše jedním modulem, který pracuje nad klíčem `sklad` v prohlížeči i
  v `chrome.storage.local`; export/import tak půjde použít v rozšíření i v PWA a data
  se přenesou i mezi nimi.
- Import s potvrzením a zálohou původních dat před přepsáním.
- **Hotovo, když:** export → vymazání dat → import vrátí stejnou historii, včetně starších
  záznamů z 1.0.0, a historie přenesená z PWA se zobrazí v rozšíření; testy migrace i importu.

### 1.3.0 – tisk podle předlohy (B, G)
- Předvolby rozvržení: počet sloupců a řádků na A4, rozměr štítku, **odsazení X/Y v milimetrech**
  pro předtištěnou roli, volitelná mezera na výstřiž.
- Uživatelské předvolby uložené ve stavu a dostupné na tiskové stránce i v popupu.
- **Hotovo, když:** vytištěný arch sedí do role čtečky, první štítek je ve správné
  vzdálenosti od okraje; na obrazovce je vidět, kde papír začíná.

### 1.4.0 – rozsah verzí a nové UI (C, D, H)
- **Vstup rozsahu verzí**: `12472A`–`12472Z`, `12472A` + 20 kusů, libovolný seznam jako v 1.0.0.
- Popup přejde na záložky; rozsah verzí má vlastní náhled prvních kódů a počet.
- Sken: skener v režimu klávesnice vyplní pole, kód se pozná a rozdělí na verzi a den.
- **Hotovo, když:** rozsah 26 verzí (`12472A`–`12472Z`) vygeneruje a vytiskne se na dva
  archy, historie rozliší sérii štítků od jednotlivého kódu.

### 2.0.0 – nové schéma a sjednocení (E, F, I, J)
- **Schéma 2:** záznam historie získá pole `rozsah` (např. `{ od: "12472A", do: "12472Z", kusy: 26 }`)
  — nikoli `dávka`, protože *dávka* je v SAPu jiný údaj (batch). Nastavení se oddělí od dat,
  stav dostane `schema: 2`. Migrace z 1.x proběhne automaticky a jen jednou.
- UI sjednocené: stejné zadávání kódu v popupu, na tiskové stránce i ve velkém kódu.
- Volitelný **ZPL/TSPL výstup** pro termoprintery (pokud se potvrdí potřeba).
- eslint, e2e testy spouštěné jedním příkazem (`npm run e2e`), cílené pokrytí testů
  na `label.js` a `code128.js`.
- **Hotovo, když:** `npm test` i `npm run e2e` zelené, dokumentace popisuje obě schémata
  a postup přenosu dat.

## Co bude dělat 2.0.0 nekompatibilním

- Nové schéma úložiště (`schema: 2`) – při návratu na 1.0.0 by se neznámá pole při
  prvním uložení ořízla a část informací by se ztratila.
- Rozsah verzí (série štítků) je v historii jeden záznam, ne N samostatných záznamů.
- Přejmenování částí UI (záložky) – zásadní změna vzhledu popupu.

Nezmění se: **formát kódu** (`verze + den v roce + poslední číslice roku`), symbologie
Code 128 subset B, výchozí rozměr štítku 60 mm a minimální šířka modulu 0,25 mm. Kdyby se
měnil formát kódu, patří to až do 3.0.0.

## Mimo plán (a proč)

- **Termoprinter přes USB z prohlížeče** – prohlížeč k němu nemá přístup; buď přes síť
  (viz I), nebo tisk přes běžnou tiskárnu a přímý tisk aplikací.
- **Evidence materiálu, příjemky, objednávky** – jiné agendy, jiné nástroje.
- **Přihlašování uživatelů a role** – data jsou lokální, sdílení vyžaduje server.
- **Změna formátu kódu** – viz výše, až 3.0.0.

## Otázky k rozhodnutí před 1.2.0

1. Stačí **ruční export/import JSON**, nebo je potřeba, aby se historie automaticky
   synchronizovala mezi více počítači?
2. Jaká konkrétní **role na A4** se používá (rozměr štítku, počet na arch, odsazení
   předtištěné předlohy)?
3. Je v provozu **tiskárna na role** (Zebra, Argox, Tally)? Pokud ano, připravím ZPL.
4. Kolik **zařízení a pracovníků** sdílí stejné kódy?
5. Má být rozšíření dostupné i **na telefonu** (třeba jen pro čtení kódů do skenovací aplikace)?
