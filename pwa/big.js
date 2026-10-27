/**
 * Velký čárový kód v prohlížeči.
 *
 * Stejně jako v rozšíření, ale místo `chrome.tabs.remove` se karta zavírá
 * historií prohlížeče – na telefonu je to jediné, co jde spolehlivě udělat.
 */
import { buildCode, canEncode, getTodayInfo, normalizeVersion, validateVersion } from "../js/core.js";
import { renderCode128 } from "../js/code128.js";

const $ = (id) => document.getElementById(id);

const elements = {
  barcode: $("barcode"),
  code: $("code"),
  fallback: $("fallback"),
  version: $("version"),
};

let code = new URLSearchParams(location.search).get("code") ?? "";

function show(codeToShow) {
  code = codeToShow;
  const hasCode = code !== "" && canEncode(code);
  elements.fallback.hidden = hasCode;
  elements.code.textContent = code;
  document.title = hasCode ? code : "Velký čárový kód";

  if (hasCode) {
    renderCode128(elements.barcode, code, { barHeight: 70 });
  } else {
    elements.barcode.replaceChildren();
    elements.code.textContent = "";
    elements.version.focus();
  }
}

let copyTimer = null;

async function copyCode() {
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    elements.code.textContent = `${code}  ✓`;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      elements.code.textContent = code;
    }, 1200);
  } catch (error) {
    console.warn("Schránka není dostupná:", error);
  }
}

function goBack() {
  // když se stránka otevřela přímo, historie je prázdná a je nutné jít dozadu ručně
  if (history.length > 1) {
    history.back();
    return;
  }
  location.replace("index.html");
}

elements.fallback.addEventListener("submit", (event) => {
  event.preventDefault();
  const check = validateVersion(elements.version.value);
  if (check.ok) show(buildCode(check.value, getTodayInfo().date));
  elements.version.value = normalizeVersion(elements.version.value);
});

document.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    // ve fallbackovém formuláři má Enter odeslat verzi, ne kopírovat prázdný kód
    if (!elements.fallback.hidden) return;
    event.preventDefault();
    await copyCode();
  } else if (event.key === "Escape") {
    goBack();
  }
});

// na telefonu není klávesnice, kód se kopíruje klepnutím
elements.code.addEventListener("click", copyCode);

elements.fallback.addEventListener("click", (event) => {
  if (event.target === elements.barcode || event.target === elements.code) copyCode();
});

show(code);
