/** Přepis souboru na LF konce řádků (na Windows bez .gitattributes). */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Použití: node tools/normalize-eol.mjs <soubor>");
  process.exit(1);
}
const before = readFileSync(file);
const after = Buffer.from(before.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
if (before.equals(after)) {
  console.log(`${file}: bez změny`);
} else {
  writeFileSync(file, after);
  console.log(`${file}: přepsáno na LF`);
}
