export const LABEL_PRESETS = [
  { id: "zebra104", label: "Zebra 104 × 151,63 mm", widthMm: 104, heightMm: 151.63 },
  { id: "100x150", label: "Logistický 100 × 150 mm", widthMm: 100, heightMm: 150 },
  { id: "60x40", label: "Kompaktní 60 × 40 mm", widthMm: 60, heightMm: 40 },
  { id: "50x30", label: "Malý 50 × 30 mm", widthMm: 50, heightMm: 30 },
  { id: "a4", label: "A4 210 × 297 mm", widthMm: 210, heightMm: 297 },
];

export const FIELD_OPTIONS = [
  ["generatedCode", "Vygenerovaný šaržovní kód"], ["version", "Verze / šarže dodavatele"],
  ["material", "Číslo materiálu"], ["description", "Popis materiálu"], ["sapBatch", "Dávka SAP (CHARG)"],
  ["vendor", "Dodavatel"], ["plant", "Závod"], ["storageLocation", "Skladové místo"],
  ["quantity", "Množství"], ["unit", "Měrná jednotka"], ["date", "Datum"], ["expiryDate", "Expirace"],
  ["purchaseOrder", "Nákupní objednávka"], ["qrContent", "Obsah QR"], ["barcodeContent", "Externí čárový kód"],
  ["labelName", "Název štítku"],
].map(([value, label]) => ({ value, label }));

export const DEFAULT_LAYOUT = [
  { id: "main-barcode", label: "Čárový kód", type: "barcode", field: "generatedCode", barcodeFormat: "code128", foreground: "#111827", background: "#ffffff", humanReadable: true, x: 4, y: 4, w: 96, h: 20, fontSize: 3, bold: false, align: "center", enabled: true },
];

export function cloneDefaultLayout() {
  return DEFAULT_LAYOUT.map((element) => ({ ...element }));
}

export function substituteTemplate(template, record) {
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z][\w]*)\s*\}\}/g, (_, key) => String(record?.[key] ?? "").trim());
}

export function elementPayload(element, record) {
  if (String(element?.contentTemplate ?? "").trim()) return substituteTemplate(element.contentTemplate, record).trim();
  const field = element.field || (element.type === "barcode" ? "generatedCode" : "qrContent");
  if (field === "qrContent" && !String(record?.[field] ?? "").trim()) return String(record?.generatedCode ?? "").trim();
  if (field === "barcodeContent" && !String(record?.[field] ?? "").trim()) return String(record?.generatedCode ?? "").trim();
  return String(record?.[field] ?? "").trim();
}
