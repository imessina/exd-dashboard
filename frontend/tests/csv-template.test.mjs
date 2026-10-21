/** Verifica que la plantilla descargada conserva listas separadas al importarse de nuevo. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("CSV template preserves individual certificates and interests", () => {
  const source = readFileSync(new URL("../src/pages/Personas.jsx", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("const CSV_COLUMNAS"), source.indexOf("function CargaMasivaPanel"));
  const result = new Function(`${code}; return parsearCSV(CSV_EJEMPLO);`)();
  assert.deepEqual(result.filas[0].certificaciones, ["Design Thinking", "Figma"]);
  assert.deepEqual(result.filas[0].intereses, ["UX Research", "Accesibilidad"]);
  assert.deepEqual(result.filas[1].certificaciones, ["React", "Node.js"]);
});
