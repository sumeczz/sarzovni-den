# Changelog

## 1.3.1 – 2026-10-19

- Opravena kritická chyba QR Studia: SVG moduly se nyní vykreslují jako skutečný prvek `<path>`; dříve byla výchozí varianta QR jen bílý čtverec.
- Oddělena konstrukce QR SVG do samostatného testovatelného modulu `js/qr-svg.js`.
- Doplněny testy výsledného SVG pro výchozí i zaoblený vzhled, barvy, velikost, čistou zónu, korekci, UTF-8 a příliš dlouhá data.
- Výstup QR byl vyrenderován do PNG a nezávisle dekódován z obrázku; běžná i zaoblená varianta vrací původní text.
- Oprava QR platí pro živý náhled, PNG/SVG export, knihovnu i hromadnou výrobu, které sdílejí stejný renderer.

## 1.3.0 – 2026-10-19

- Zachována hlavní role šaržovního dne a původní generování kódu.
- Přidáno samostatné QR Studio jako sekundární nástroj, nikoliv náhrada hlavního generátoru.
- QR generování pro text, URL, Wi‑Fi, e-mail, telefon, SMS, vCard kontakt a GPS souřadnice.
- Přidána hromadná výroba QR/Code 128 kódů z vložených řádků, export SVG archu a knihovna položek s importem/exportem JSON.
- Přidána nastavení velikosti, barev, čisté zóny a korekce QR; export SVG a PNG.
- Doplněny rychlé odkazy z hlavního popupu do QR Studia a skeneru.
- QR knihovna běží lokálně/offline; bez externích CDN.

# Změny

## 1.2.0

- Zachována původní funkce šaržovního dne jako hlavní a výchozí obrazovka.
- Vizuální přepracování hlavního panelu do tmavého, kontrastního rozhraní.
- Přidán sekundární generátor libovolného textu do Code 128 B s živým náhledem, kopírováním textu a exportem SVG.
- Původní výpočet, hromadné generování, tisk štítků a historie zůstávají zachovány.


Všechny významné změny tohoto rozšíření. Verze se řídí [semver](https://semver.org/lang/cs/):
`MAJOR.MINOR.PATCH`. Formát kódu (`verze + den v roce + poslední číslice roku`)
a způsob číslování šaržových dnů jsou závazné částí každé verze. Pojmy *verze*,
*šaržovní den* a *dávka* jsou vysvětlené v [README.md](README.md#pojmy).

## 1.1.0 – 1. 10. 2026

Prototyp rozšíření zůstává beze změny; přibyla **prohlížečová verze pro mobil** a drobnosti
opravené při prvním průchodu reálným použitím.

### Přidáno

- **Webová aplikace na mobil** v `pwa/` – stejný kód, tisk, více kódů a historie jako
  rozšíření, ale jde o běžnou stránku, která se přidá na plošku telefonu a pracuje
  i bez signálu (service worker). Logika se nepoužívá dvakrát: `js/core.js`,
  `js/code128.js`, `js/label.js` a čisté funkce z `js/storage.js` jsou sdílené,
  liší se jen UI a úložiště (`localStorage` místo `chrome.storage.local`).
- Service worker `sw.js` v kořeni repozitáře, aby jeho scope sahal i na stránku tisku.
- Ikony 192 a 512 px pro PWA, nakreslené jako maskable (obsah uvnitř bezpečného středu,
  aby se kód neusekl při kruhovém oříznutí na plošce).

### Opraveno

- **Enter na otevřené stránce `scan.html` bez kódu v adrese** udělal nic – zachytil ho
  globální klávesový posluchač a zrušil odeslání formuláře. Teď vygeneruje kód.
- **Prázdná tisková stránka** měla prázdné hlášení a aktivní tlačítko Tisk. Teď vysvětluje
  situaci a tisk je vypnutý. Předvolby šířky se vykreslí i v ručním režimu.
- Atribut `hidden` přestával působit na `.fallback` (třída s vlastním `display: flex`
  přebila výchozí `display: none`), takže formulář byl vidět i s hotovým kódem.
  V obou stylech je teď `[hidden] { display: none !important; }`.
- **Panel historie** se ukládal jako rozbalený/sbalený jen pro čtení, zápis chyběl;
  stav se proto nikdy neuložil.
- Desetinná tečka v českých hlášeních („123.8 mm") nahrazena čárkou, sjednoceno
  i s rozměry štítku.
- Předvolby štítku nesly výšku (`60 × 40`), která se ale nikdy nepoužila – výška se
  počítá z délky kódu. Názvy teď říkají jen šířku (`60 mm`).

### Změněné

- Název rozšíření v `chrome://extensions` a na liště je „Šaržovní den – verze, den v roce
  a tisk štítků" místo pracovního „Pomocník do práce (sklad)".

## 1.0.0 – 30. 9. 2026

První stabilní verze. Zadání: pracovník ve skladu přebírá ze SAPu verzi plechu, doplní se
den v roce a rok a vznikne kód, který se dá zkopírovat, vytisknout na štítek v milimetrech
nebo uložit do historie.

### Přidáno

- **Šaržovní den** v poli: verze plechu + den v roce na tři místa + poslední číslice roku
  (`12472A` + `273` + `6` → `12472A2736`).
- **Čárový kód Code 128** (subset B) vykreslený jako SVG, s tichými zónami 10 modulů,
  bez závislostí na knihovnách. Kód se přepíší hned během psaní.
- **Kopírování kódu** do schránky (Enter v poli nebo tlačítko).
- **Velký kód** – samostatná stránka s kódem přes celou obrazovku; Enter kopíruje,
  F přepíná celou obrazovku, **Esc zavírá kartu** (ve fullscreenu nejdřív ukončí režim).
- **Konfigurace tisku přímo v popupu** v panelu *Tisk štítku*: šířka štítku v milimetrech,
  předvolby 60 × 40, 50 × 30, 70 × 37, 100 × 50, 125 × 65 mm, kusů na kód a živý náhled
  rozměrů. Nastavení se pamatuje a při tisku se předá tiskové stránce.
- **Tisk štítků** v milimetrech (`@page { size: 60mm 20.7mm }` pro jeden kus, arch A4 s mřížkou
  pro dva a více). Varování při příliš úzkém modulu (< 0,25 mm) s návrhem čitelné šířky.
- **Více kódů najednou** – verze oddělené mezerou, čárkou, středníkem nebo řádkem,
  s tlačítky **Kopírovat vše**, **Uložit vše** a **Tisk**.
- **Historie** 50 posledních kódů v `chrome.storage.local` s hledáním bez rozlišování
  velikosti písmen, doplněním verze kliknutím a smazáním jednotlivých záznamů.
- **Přepočet o půlnoci** – otevřený popup sám přepočítá den v roce a kód.

### Opraveno

- Psaní písmen se již nepřesouvá: hodnota pole se při psaní nemění, velká písmena a odstranění
  mezer proběhne až po odečtení pole (dřív se kurzor posouval o znak zpět a písmena končila
  na špatném místě).
- Den v roce se počítá z kalendářních polí přes UTC. Dřív se počítalo z uplynulých milisekund,
  takže těsně po půlnoci v den po změně letního času vyšlo číslo o den menší.
- Generátor kódu počítá šířku včetně koncového 2modulového pruhu stopu.

### Změněné oproti návrhu

- **Konfigurace tisku je součástí panelu v popupu**, tisková stránka si ji jen přebírá
  z adresy a slouží k náhledu a vlastnímu tisku.
- Bez názvu položky: pracovník zadává pouze verzi plechu.
- Bez panelu s výběrem (datalist) i kalendáře – obojí bylo v beta verzi odstraněno.
- Data jsou vázaná na profil prohlížeče, přenos mezi zařízeními není řešen (plán 1.2.0).
- Tisk na tiskárnu na role (Zebra, Argox) není podporován, jde o běžný tisk přes prohlížeč.

### Poznámka k názvosloví

- Pole se v pracovním zápisu jmenuje **verze**, přestože stejnou hodnotu SAP označuje jako
  *šarži dodavatele*. **Dávka (SAP batch) je jiný údaj** a do tohoto kódu nepatří –
  v kódu ani v uložených datech se slovo `batch` nepoužívá a při čtení stavu se zahazuje,
  aby se nezaměnilo za verzi. Přehled pojmů je v [README.md](README.md#pojmy).

### Ověření

- 55 jednotkových testů (`npm test`) včetně kontroly tabulky Code 128 proti kombinacím
  dovoleným ISO/IEC 15417 a round-trip dekódování vygenerovaných pruhů.
- Ruční průchod nad načteným rozšířením v Chromu (headless přes CDP): popup, panel tisku,
  více kódů, historie, `chrome.storage.local`, velký kód, zavření karty přes Escape a
  tisk na A4.

## 1.4.0 — Profesionální štítky, SAP/Excel import a kontrola kvality

- Přidán samostatný pracovní postup: import dat → návrh štítku → předtisková kontrola.
- Návrhář podporuje vlastní rozměry v mm, přidávání/odebírání textových, QR a Code 128 prvků, přesné souřadnice, drag-and-drop náhled a uložené šablony v lokálním úložišti prohlížeče.
- SAP/Excel import podporuje vložené tabulky ze SAP GUI/Fiori a Excelu, TSV, CSV s čárkou/středníkem, textové výpisy s mezerami, UTF-8/Windows-1250 a moderní XLSX/XLSM (první list). Neznámé sloupce zůstávají dostupné jako vlastní proměnné `{{sap_nazev_sloupce}}`.
- Rozšířeno mapování běžných SAP polí včetně MATNR, MAKTX, LICHA, CHARG, WERKS, LGORT, LGNUM, LGTYP, LGPLA, MENGE, MEINS, VFDAT, EBELN, VBELN a BWART.
- Dávka SAP (CHARG) se nikdy automaticky nezaměňuje za dodavatelskou šarži/verzi (LICHA); nejednoznačné sloupce vyžadují kontrolu nebo ruční mapování.
- Předtisková kontrola ověřuje povinné hodnoty, duplicitní kódy, kódování Code 128, velikost modulů, QR obsah, rozměry, přesahy, překryvy a podezřele dlouhé texty. Kritické chyby tisk blokují.
- Přidány automatické testy importu a kontroly kvality. Všechna data zpracovává rozšíření lokálně.

### Omezení importu
- Starší binární `.xls` není podporováno; ulož ho jako CSV UTF-8 nebo vlož tabulku přes schránku.
- XLSX/XLSM čte první list. Hodnoty uložené v Excelu jako čísla nemohou vždy zachovat původní úvodní nuly; pro identifikátory je nejbezpečnější textový formát nebo vložení z tabulky.
- Textový výpis SAP s pevnými mezerami se parsuje orientačně; vždy ověř náhled a mapování před tiskem.
