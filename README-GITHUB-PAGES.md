# Šaržovní den – mobilní webová aplikace

Aplikace je statická (HTML, CSS a JavaScript). Nepotřebuje server, databázi ani API klíč a lze ji hostovat na GitHub Pages.

## Publikace na GitHub Pages

1. Vytvoř nový GitHub repozitář (nebo použij stávající).
2. Nahraj **obsah této složky** přímo do kořene repozitáře: například `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/`, `pwa/`, `icons/` a `.github/`. Nenahrávej jen obalovou složku `addon_smcz`.
3. V repozitáři otevři **Settings → Pages** a jako zdroj nasazení vyber **GitHub Actions**.
4. Proveď commit do větve `main` (workflow podporuje také `master`). V části **Actions** sleduj běh `Deploy static web app to GitHub Pages`.
5. Po úspěšném nasazení otevři adresu uvedenou v prostředí `github-pages`, typicky `https://UZIVATEL.github.io/REPO/`.

Všechny odkazy a registrace service workeru používají relativní cesty, takže fungují i v podadresáři projektového repozitáře.

## Přidání na mobilní plochu

- **Android / Chrome:** otevři nasazenou adresu, potom nabídka ⋮ → *Instalovat aplikaci* nebo *Přidat na plochu*.
- **iPhone / Safari:** otevři adresu, tlačítko Sdílet → *Přidat na plochu*.

Po prvním online načtení service worker přednačte hlavní obrazovku, tisk, QR Studio, import a návrhář štítků. Prohlížeč může podle volného úložiště některé soubory odstranit; první otevření všech nástrojů je proto vhodné provést ještě online.

## Dostupné nástroje

- **Šaržovní den:** generování kódu z verze / šarže dodavatele (LICHA), Code 128, kopírování, historie, hromadné kódy a tisk.
- **Tiskové centrum:** rozměry štítku v milimetrech, pozice prvků, náhled archu a tisk přes dialog prohlížeče.
- **QR & čárové kódy:** QR pro text, URL, Wi‑Fi, e-mail, telefon, SMS, kontakt a GPS; Code 128 a GS1-128.
- **Import SAP / Excel:** vložení tabulky nebo načtení CSV/TSV/TXT/XLSX/XLSM, mapování polí, návrh štítků a předtisková kontrola.
- **Nastavení:** výchozí generování, rozměry štítku a historie.

## Důležité provozní poznámky

- Data ukládá prohlížeč do `localStorage`. Historie a šablony se automaticky nesynchronizují mezi telefony nebo počítači; smaže-li se úložiště webu, lokální data mohou být ztracena. Historii lze z hlavní stránky exportovat do CSV.
- Import SAP/Excel se provádí v zařízení. Aplikace se nepřipojuje přímo k SAPu.
- Tisk na skutečný štítek ověř nejprve zkušebním výtiskem a skenerem. Ovladač, měřítko a možnosti tiskárny závisí na zařízení a prohlížeči. Přímý tisk na Zebra/Argox přes USB z webové stránky není zaručen.
- Když se po nové verzi stále zobrazuje stará aplikace, obnov stránku a případně vymaž cache / data webu. Verze service workeru je řízena `CACHE_VERSION` v `sw.js`.
- Tato pracovní kopie nemá nakonfigurovaný Git vzdálený repozitář; soubory se po této úpravě automaticky nenahrávají na GitHub.
