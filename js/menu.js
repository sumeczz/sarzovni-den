/**
 * Sdílené navigační menu. Odkazy jsou relativní, aby fungovaly i na GitHub
 * Pages v podadresáři repozitáře, nikoli pouze na doméně uživatele.
 */
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.6V20h13V9.6"/><path d="M10 20v-5h4v5"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/></svg>',
  creator: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><path d="M13.5 20.5h3v-3h-3zM20.5 13.5v3M20.5 20.5h.01"/></svg>',
  import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 16.5V4M7.5 8.5 12 4l4.5 4.5M4 16v4.5h16V16"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 8.5v7M10.5 8.5v7M13.5 8.5v7M16.5 8.5v7"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 7h8.5M17 7h3.5M3.5 17h3M11.5 17h9"/><circle cx="14.5" cy="7" r="2.5"/><circle cx="8.5" cy="17" r="2.5"/></svg>',
  hamburger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

const EXTENSION_ITEMS = [
  { label: "Hlavní generátor", href: "popup.html", icon: "home" },
  { label: "Tiskové centrum", href: "print.html", icon: "print" },
  { label: "Creator štítků a QR", href: "creator.html", icon: "creator" },
  { label: "Import dat ze SAPu", href: "workbench.html?view=import", icon: "import" },
  { label: "Skenování kódu", href: "scan.html", icon: "scan" },
  { separator: true },
  { label: "Nastavení", href: "settings.html", icon: "settings" },
];
const WEB_ITEMS = [
  { label: "Úvod / Šaržovní den", href: "index.html", icon: "home" },
  { label: "Tiskové centrum", href: "print.html", icon: "print" },
  { label: "Návrhář štítků a QR Studio", href: "creator.html", icon: "creator" },
  { label: "Import SAP / Excel", href: "workbench.html?view=import", icon: "import" },
  { label: "Velký kód", href: "pwa/big.html", icon: "scan" },
  { separator: true },
  { label: "Nastavení", href: "settings.html", icon: "settings" },
];

const isExtension = Boolean(globalThis.chrome?.runtime?.id);
const items = isExtension ? EXTENSION_ITEMS : WEB_ITEMS;
const currentFile = (location.pathname.split("/").pop() || "index.html").toLowerCase();

function fileOf(href) {
  return href.split("?")[0].split("/").pop().toLowerCase();
}
function build() {
  const host = document.querySelector("[data-app-menu]");
  const root = document.createElement("div");
  root.className = "app-menu";
  if (!host) {
    root.classList.add("is-floating");
    document.body.append(root);
  } else host.append(root);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "app-menu-trigger";
  trigger.title = "Hlavní menu";
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = ICONS.hamburger + '<span class="sr-only">Hlavní menu</span>';

  const panel = document.createElement("nav");
  panel.className = "app-menu-panel";
  panel.setAttribute("aria-label", "Hlavní menu");
  panel.hidden = true;
  const title = document.createElement("p");
  title.className = "app-menu-title";
  title.textContent = "Hlavní menu";
  panel.append(title);

  for (const item of items) {
    if (item.separator) {
      const line = document.createElement("div");
      line.className = "app-menu-separator";
      panel.append(line);
      continue;
    }
    const link = document.createElement("a");
    link.className = "app-menu-item";
    link.href = item.href;
    link.innerHTML = (ICONS[item.icon] || "") + "<span>" + item.label + "</span>";
    if (fileOf(item.href) === currentFile) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
    link.addEventListener("click", close);
    panel.append(link);
  }

  root.append(trigger, panel);
  function open() {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    root.classList.add("is-open");
    (panel.querySelector(".is-active") || panel.querySelector("a"))?.focus();
  }
  function close() {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    root.classList.remove("is-open");
  }
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (panel.hidden) open();
    else close();
  });
  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
else build();
