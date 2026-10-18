import { zipSync, strToU8 } from "fflate";
import { sanitiseName, stampYYYYMMDDHHMM } from "./exporter.js";

// M9: zip packaging for the display OBJ bundle (character.obj + character.mtl
// + texture PNGs, all in one folder with relative MTL paths). fflate was
// approved for this milestone (deflate; ~8 KB gzip, no deps of its own).
// Everything stays local: zipSync builds the archive in memory, nothing
// uploads.

export async function makeZip(files) {
  // files: { [name]: string | Uint8Array }
  const encoded = {};
  for (const [name, data] of Object.entries(files)) {
    encoded[name] = typeof data === "string" ? strToU8(data) : data;
  }
  return zipSync(encoded, { level: 6 });
}

function stampName(name) {
  return (sanitiseName(name) || "character");
}
function stamp() {
  return stampYYYYMMDDHHMM();
}

export function displayZipFilename(name) {
  return `psx-character-${stampName(name)}-display-${stamp()}.zip`;
}

export function printOBJFilename(name, heightMm) {
  return `psx-character-${stampName(name)}-print-${heightMm}mm-${stamp()}.obj`;
}

export function displayOBJFilename(name) {
  return `psx-character-${stampName(name)}-display-${stamp()}.obj`;
}
