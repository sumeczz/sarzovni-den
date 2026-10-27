/**
 * Výchozí hodnoty tiskového centra.
 *
 * Nastavení stránky "Nastavení" je zapisuje do localStorage, protože tisková
 * stránka je společná pro rozšíření i PWA a v PWA není dostupné chrome.storage.
 * URL parametry mají vždy přednost před těmito výchozími hodnotami.
 */

export const PRINT_DEFAULTS_KEY = "sarzovni-den-print-defaults-v1";

export function readPrintDefaults() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRINT_DEFAULTS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

export function savePrintDefaults(values) {
  try {
    localStorage.setItem(PRINT_DEFAULTS_KEY, JSON.stringify(values));
    return true;
  } catch (error) {
    console.warn("Výchozí tiskové nastavení se nepodařilo uložit.", error);
    return false;
  }
}
