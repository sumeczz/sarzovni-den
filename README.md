
## Verze 1.3.1 – oprava vykreslení QR kódu

Opravena chyba, kvůli které se při výchozím hranatém vzhledu vykreslovalo pouze bílé pozadí. QR moduly se nyní zapisují do skutečné SVG geometrie. Stejný renderer používá náhled, PNG/SVG export, knihovna i hromadná výroba. Přidány testy výstupního SVG a ověření dekódování vyrenderovaného QR.

## Verze 1.3.0 – QR Studio jako doplněk

Hlavní popup nadále otevírá **Šaržovní den** a zachovává původní algoritmus. Z horní části popupu lze samostatně otevřít doplňkové QR Studio, které běží lokálně a obsahuje:

- QR kódy pro text, URL, Wi‑Fi, e-mail, telefon, SMS, kontakt a GPS;
- generátor Code 128 s náhledem a exportem SVG/PNG;
- úpravu velikosti, barev a úrovně korekce QR kódu;
- hromadné generování z řádků nebo vloženého sloupce z Excelu;
- export hromadného archu SVG, lokální knihovnu, vyhledávání a zálohu/import knihovny ve formátu JSON;
- offline zpracování bez odesílání obsahu na server.

Modul QR Studio má oddělenou knihovnu uložených položek v místním úložišti prohlížeče; není sloučena s historií šaržovního dne.

# Šaržovní den

Rozšíření pro Chrome a Edge. Zadáš **verzi plechu** (v SAPu se stejná hodnota označuje jako
*šarže dodavatele*), doplní se **den v roce** a **rok** a vznikne kód, který se dá zkopírovat,
vytisknout na štítek v milimetrech nebo uložit do historie.

Formát kódu:

```
12472A 273 6
└─┬─┘ │ └ poslední číslice roku (2026 → 6)
  │   └ den v roce vždy na tři místa (30. 9. 2026 → 273)
  └ verze plechu (v SAPu šarže dodavatele)
```

Stejná aplikace je i jako **webová aplikace na telefon** – viz [Prohlížečová verze
na mobil](#prohlížečová-verze-na-mobil).

Aktuální verze: **1.3.1** (viz [CHANGELOG.md](CHANGELOG.md), plán na další verze
v [ROADMAP.md](ROADMAP.md)).

## Obsah

- [Instalace](#instalace)
- [Použití](#použití)
- [Více kódů najednou](#více-kódů-najednou)
- [Tisk](#tisk)
- [Prohlížečová verze na mobil](#prohlížečová-verze-na-mobil)
- [Vývoj](#vývoj)
- [Ruční kontrola po instalaci](#ruční-kontrola-po-instalaci)
- [Poznámky k datům](#poznámky-k-datům)
- [Pojmy](#pojmy)
- [Omezení](#omezení)
- [Soubory](#soubory)

## Instalace

### Chrome
1. Otevři `chrome://extensions`
2. Vpravo nahoje zapni **Režim vývojáře**
3. Klikni na **Načíst nerozbalené rozšíření** a vyber tuto složku

### Edge
1. Otevři `edge://extensions`
2. Vlevo dole zapni **Režim vývojářů**
3. Klikni na **Načíst rozšíření** a vyber tuto složku

Rozšíření se objeví v liště jako ikona čárového kódu.

## Použití

| Akce | Výsledek |
| --- | --- |
| Napsat verzi plechu do pole | kód i čárový kód se přepíší hned |
| Enter v poli verze | zkopíruje kód a uloží záznam do historie |
| **Kopírovat kód** | kód do schránky |
| **Tisk** | otevře tiskovou stránku s náhledem štítku |
| **Velký kód** | otevře stránku s obrovským čárovým kódem (Enter = kopírovat, F = celá obrazovka, Esc = zavřít) |
| **Uložit** | uloží záznam do historie |
| Panel **Další generátor · Code 128** | vygeneruje čárový kód z libovolného podporovaného ASCII textu, zkopíruje text nebo stáhne SVG |
| Panel **Tisk štítku** | šířka štítku, předvolby rozměrů, kusů na kód, náhled rozměrů a varování |
| Verze v poli **Více kódů** | vygeneruje kódy pro všechny uvedené verze |
| **Kopírovat vše** | všechny kódy do schránky, každý na řádek |
| **Uložit vše** | všechny kódy do historie |
| **Tisk** u více kódů | otevře tisk se všemi kódy |
| Klik na řádek v historii | doplní verzi do pole |
| Hledání v historii | hledá v kódu a verzi, bez rozlišování velikosti písmen |

Při psaní se pole neupravuje, aby se kurzor neposouval proti psaní. Písmena se převedou na
velká a mezery se odstraní, až když z pole odejdeš (Enter nebo klik jinam); v adrese řádku
jsou mezitím velká písmena. Verze smí obsahovat jen písmena a číslice (max. 24 znaků),
protože jde přepsat do čárového kódu.

Historie drží 50 posledních kódů, hledáním se v ní dá najít kód i verze. Stav je
v `chrome.storage.local`, takže po restartu prohlížeče zůstává.

## Více kódů najednou

Do pole **Více kódů** napiš verze oddělené mezerou, čárkou, středníkem nebo řádkem:

```
12472A 12472B 90011C     →  12472A2736, 12472B2736, 90011C2736
```

Nepoužitelné verze (s pomlčkou, s diakritikou, příliš dlouhé) se přeskočí a ukážou
v řádku pod polem. Z byteků jde **Kopírovat vše** (kódy pod sebou na řádcích),
**Uložit vše** (všechny do historie, duplicitní kód se jen posune nahoru) nebo **Tisk**.

## Tisk

Rozměr štítku se nastavuje přímo v popupu v panelu **Tisk štítku** a zůstává uložený;
tisková stránka si ho jen přebírá z adresy a ukazuje náhled 1:1 s milimetrovým měřítkem
a čarami na vystřižení.

- **Šířka štítku** – předvolby 60, 50, 70, 100 a 125 mm, nebo libovolná hodnota
  20–200 mm. Výška se pokaždé dopočítá z délky kódu (pruhy + čitelný text), takže
  předvolba udává jen šířku. Když je kusů 2 a více, panel ukáže, kolik štítků se vejde
  na A4.
- **Kusů na kód** – kolik štítků se vytiskne z každého kódu (výchozí 1), tedy
  3 verze × 2 kusy = 6 štítků.
- Jeden štítek tiskne stránku přesně o velikosti štítku (`@page { size: 60mm 20.7mm }`),
  dva a více tiskne arch A4 s mřížkou štítků na výstřiž.
- **Varování** – pokud by při dané šířce vyšel příliš úzký modul, panel i tisková stránka
  to upozorní a nabídnou šířku, při které je kód spolehlivě čitelný.

V dialogu tisku vypni **hlavičku a patičku** a **měřítko nech na 100 %**. Při jednom
štítku vyjde stránka přesně o jeho velikosti (60 × 20,7 mm), takže se na běžné tiskárně
vytiskne doprostřed papíru a je nutné ho vystřihnout. U více štítků se tiskne celý arch A4
a štítky se vystřihnou podle vyznačených čar. Tiskárna na role (Zebra, Argox…) má vlastní
ovládání a štítky na ni tuhle stránkou tisknout nelze.

Rozměry vycházejí z `js/label.js`: šířka modulu nesmí klesnout pod 0,25 mm (ISO/IEC 15417),
doporučená je 0,33 mm a pruhy mají nejméně 6,35 mm. Písmo pod čárovým kódem se zmenší,
aby se do šířky štítku vešel i dlouhý kód.

## Prohlížečová verze na mobil

V `pwa/` je stejná aplikace jako běžná webová stránka, která se dá přidat na plošku telefonu
a funguje i bez signálu. Logika se nepoužívá dvakrát – čárový kód, den v roce, sestavení kódu
a rozměry štítku se přebírají z týchž souborů jako rozšíření (`js/core.js`, `js/code128.js`,
`js/label.js`, `js/storage.js`). Rozdíl je jen ten, že stav leží v `localStorage` místo
v `chrome.storage.local`.

### Spuštění

Aplikace potřebuje být dostupná přes `http://` nebo `https://` – soubor otevřený přímo
z disku (`file://`) prohlížeč kvůli service workeru nepustí. Klíčové je posloužit
**kořen repozitáře**, protože PWA si sahá i na `js/` a `print.html`:

```bash
npx serve .
# nebo
python -m http.server 8000
```

Pak otevři `http://localhost:8000/pwa/`.

### Na telefonu

1. Otevři adresu v prohlížeči telefonu.
2. **Android (Chrome):** ⋮ menu → *Přidat na plošku* / *Instalovat aplikaci*.
   **iOS (Safari):** Sdílet → *Přidat na plošku*.
3. Aplikace se otevře bez adresního řádku a po prvním načtení pracuje i bez signálu.

Aby to fungovalo i mimo vlastní síť, je potřeba ji někde vystavit – na firemní server,
statickém hostingu nebo přes tunel. `http://` z adresy `localhost` funguje jen na tom
počítači, ne na telefonu.

### Co umí a co ne

Stejně jako rozšíření: kód z verze, kopírování, velký kód, tisk štítků, více kódů,
historie 50 záznamů a přepočet dne v roce přes půlnoc. Na velkém kódu se kopíruje klepnutím,
protože mobilní telefon nemá klávesnici.

Jediné, co je jiné: **historie se ukládá do prohlížeče telefonu, ne do rozšíření**,
takže obě verze mají data odděleně. Přenos mezi zařízeními zatím neumíme (viz
[ROADMAP.md](ROADMAP.md), 1.2.0).

## Vývoj

Bez jakýchkoli závislostí, jen Node pro testy a generátor ikon.

```bash
npm test        # 55 jednotkových testů: den v roce, Code 128, štítky, historie, tisk
npm run icons   # přegeneruje icons/icon*.png
```

Testy pokrývají i standard: `tests/code128.test.mjs` kontroluje tabulku vzorů proti
kombinacím dovoleným ISO/IEC 15417, známé vektory, kontrolní součet i round-trip
(vygenerované pruhy se dekódují zpět na původní text). `tests/label.test.mjs` hlídá
mm rozměry štítku a varování na úzký modul, `tests/storage.test.mjs` práci s historií
a ukládáním přes `chrome.storage.local` včetně toho, že se pole `batch` (v SAPu jiný
údaj – dávka) do verze vůbec nepromítá.

Ruční kontrolu po instalaci najdeš níže v [Ruční kontrola po instalaci](#ruční-kontrola-po-instalaci).

### Verze a dokumentace

Číslo verze je v `manifest.json` i v `package.json` a musí být stejné. Při každém vydání:

1. zvýšit verzi v obou souborech,
2. doplnit záznam do [CHANGELOG.md](CHANGELOG.md),
3. zkontrolovat `README.md` (funkce, ovládání, soubory) a [ROADMAP.md](ROADMAP.md) (co je hotovo).

Změna formátu kódu nebo schématu úložiště znamená zvýšení hlavní verze.

Po každé změně kódu klikni v `chrome://extensions` na tlačítko ⟳ *Obnovit*, ať se načte
nová verze souborů.

### Vydání

```bash
npm test                 # 55 testů, musí být zelené
npm run icons            # jen když se mění ikony
```

Ruční kontrolu z [checklistu](#ruční-kontrola-po-instalaci) projdi na skutečném štítku
a fyzickou čtečkou.

## Ruční kontrola po instalaci

- [ ] Ikona se zobrazí v liště, popup se otevře a ukáže dnešní den v roce a rok
- [ ] Prázdné pole pod kódem ukáže „Zadej verzi plechu“
- [ ] Po zadání `12472A` se ukáže `12472A2736` a čárový kód
- [ ] Psaní písmen za číslicemi se nerozpadá (např. `0132FN` vyjde správně)
- [ ] Po odečtení pole se písmena převedou na velká
- [ ] **Kopírovat kód** vloží kód do schránky (lze vložit do Notepadu)
- [ ] **Uložit** přidá kód do historie
- [ ] Po zavření a znovuotevření popupu zůstane poslední verze, historie, rozměr štítku,
      kusů na kód i rozbalené panely
- [ ] Panel **Tisk štítku** se rozbalí, předvolby přepínají šířku a náhled přepočítá výšku
- [ ] V historii se dá vyhledat záznam podle kódu i verze
- [ ] **Více kódů**: `12472A 12472B 90011C` vygeneruje tři kódy
- [ ] **Kopírovat vše** vloží všechny kódy pod sebou na řádcích
- [ ] **Uložit vše** přidá všechny tři do historie
- [ ] **Velký kód** otevře velký čárový kód, který čtečka přečte
- [ ] Na otevřené stránce `scan.html` bez kódu v adrese funguje zadání verze + Enter
- [ ] **Esc** ve velkém kódu zavře kartu (ve fullscreenu nejdřív ukončí režim)
- [ ] Sken čtečkou vrací stejný kód, který je v nadpisu stránky
- [ ] Když popup zůstane otevřený přes půlnoc, kód se přepočítá na nový den
- [ ] **Tisk** jednoho kódu: v dialogu tisku je velikost stránky 60 × 20,7 mm (ne A4)
- [ ] **Tisk** tří kódů s 2 kusy: arch A4 s mřížkou a čarami na vystřižení
- [ ] Vytištěný štítek má čárový kód vysoký aspoň 6 mm a čtečka ho přečte
- [ ] U dlouhé verze (24 znaků) se objeví varování o úzkém modulu a tlačítko na zvětšení

## Poznámky k datům

Den v roce se počítá z kalendářních polí přes UTC, ne z uplynulých milisekund. Při přechodu
na letní čas i zpět je tak číslo stejné i těsně po půlnoci, kdy by jinak vyšlo o den
méně. `tests/core.test.mjs` to hlídá pro 31. 3. a 31. 10.

## Pojmy

| Pojem | Co znamená |
| --- | --- |
| **Verze** | pracovní název firmy; v SAPu **šarže dodavatele**. Tohle se píše do pole a do kódu. |
| **Šaržovní den** | název celého rozšíření a zároveň kód `verze + den v roce + rok`. |
| **Předmět / ID** | např. `469000371` číslo položky v SAPu. Rozšíření ho neřeší. |
| **Dávka / batch** | např. `1842523`, v SAPu **jiný údaj než verze**. Do tohoto kódu nepatří a nikdy se tu nepoužívá. |

Například u jednoho výrobku může být předmět `469000371`, dávka `1842523` a verze
`1852A2566` – do pole patří **verze**, z ní se sestaví kód `1852A2566273`.

## Omezení

- Data (historie, poslední verze a nastavení tisku) zůstávají jen v tomto prohlížeči, nic
  se nikam neodesílá. Přenos mezi počítači zatím není řešen – plánováno v
  [ROADMAP.md](ROADMAP.md) (1.2.0).
- Formát kódu (`verze + den v roce + rok`) je pevný. Změna by znamenala novou hlavní verzi
  a nové štítky.
- Verze musí tvořit číslice a velká písmena (Code 128 subset B); mezery se odstraní,
  diakritika neprojde.
- Tisk na tiskárnu na role není podporován.
- Změna času nebo data v počítači změní vypočtený den v roce (rozšíření používá lokální
  čas počítače).

## Soubory

```
manifest.json        MV3, jen oprávnění storage a clipboardWrite
package.json         verze 1.1.0, skripty `npm test` a `npm run icons`
popup.html/js/css    hlavní popup s panelem tisku a více kódů
print.html/js/css    tisk štítků v milimetrech (sdílený i s PWA)
scan.html/js/css     velký čárový kód pro čtečku
js/core.js           den v roce, sestavení kódů, validace verze, přepočet o půlnoci
js/code128.js        Code 128 (subset B) -> SVG
js/label.js          rozměry štítku v mm a mřížka na A4
js/storage.js        historie (čisté funkce sdílí i PWA)
pwa/index.html/js    mobilní webová aplikace
pwa/big.html/js      velký kód na mobil
pwa/store.js         historie v localStorage místo chrome.storage.local
pwa/manifest.webmanifest  popis instalovatelné aplikace
pwa/styles.css       styly pro mobil
sw.js                service worker pro offline režim (jen pro PWA)
css/                 styly pro popup, tisk a velký kód
icons/               ikony 16/32/48/128 px pro rozšíření, 192/512 px pro PWA
tools/make-icons.mjs generátor PNG ikon (zlib, bez závislostí)
tools/normalize-eol.mjs  přepis souboru na LF konce řádků
tests/               testy pro node --test
README.md            tento návod
CHANGELOG.md         změny jednotlivých verzí
ROADMAP.md           plán rozvoje 1.0.0 → 2.0.0
```

## Pracovní nástroje 1.4.0

Z hlavního okna otevři **Návrhář štítků + SAP import**. Doporučený postup:

1. Vlož tabulku přes Ctrl+C/Ctrl+V ze SAP GUI, Fiori nebo Excelu, případně načti CSV/TSV/TXT/XLSX/XLSM.
2. Zkontroluj automaticky rozpoznaná pole. Zejména ověř rozdíl mezi dodavatelskou šarží (LICHA / verze) a dávkou SAP (CHARG).
3. Namapuj neznámé sloupce ručně; všechny původní sloupce zůstávají dostupné jako proměnné `{{sap_nazev_sloupce}}`.
4. Uprav rozměr štítku a rozmístění prvků v milimetrech. Šablonu můžeš uložit lokálně pro pozdější použití.
5. Spusť předtiskovou kontrolu. Kritické chyby tisk blokují; upozornění lze potvrdit pouze po kontrole jejich významu.
6. Při tisku ověř v dialogu správnou tiskárnu, médium a měřítko 100 %.

Všechny vstupní soubory se zpracovávají lokálně. Rozšíření se samo nepřipojuje k SAP systému ani neodesílá data na server; importuje pouze tabulku, kterou uživatel vloží nebo vybere.
