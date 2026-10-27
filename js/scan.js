import { buildCode, canEncode, getTodayInfo, normalizeVersion, validateVersion } from "./core.js";
import { renderCode128 } from "./code128.js";

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
    console.error(error);
  }
}

/** Zavře kartu s velkým kódem; ve fullscreenu nejdřív ukončí režim. */
async function closeOrExitFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined) {
      await chrome.tabs.remove(tab.id);
      return;
    }
  } catch (error) {
    console.error(error);
  }
  window.close();
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
  } else if (event.key.toLowerCase() === "f") {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } else if (event.key === "Escape") {
    await closeOrExitFullscreen();
  }
});

show(code);
