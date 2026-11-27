"use strict";

// Manifiesto de la extensión (RP-03 y RC-02 de REQUISITOS.md, T9 de
// odd/tasks/informes-alumnado-grupo.md): permisos mínimos, un solo host de
// Séneca y los ajustes que Firefox necesita para instalar y ejecutar el mismo
// Manifest V3. El manifiesto es un dato: se lee tal cual, sin ejecutarlo.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RUTA = path.join(__dirname, "manifest.json");
const manifiesto = JSON.parse(fs.readFileSync(RUTA, "utf8"));

test("el manifiesto pide solo Séneca como host y los permisos imprescindibles (RP-03, T9)", () => {
  assert.equal(manifiesto.manifest_version, 3);

  // Un único host: el de Séneca, no todo juntadeandalucia.es.
  assert.deepEqual(manifiesto.host_permissions, ["https://seneca.juntadeandalucia.es/*"]);

  // activeTab y scripting para leer la pantalla desde la propia pestaña,
  // storage para la carga inicial de D13: nada de «tabs» ni «history».
  assert.deepEqual(manifiesto.permissions, ["activeTab", "scripting", "storage"]);

  // Sin service worker: el trabajo ocurre en la pestaña y en el panel (RT-02).
  assert.equal("background" in manifiesto, false);
});

test("Firefox recibe un identificador estable y una versión mínima con MV3, scripting y storage (RC-02, T9)", () => {
  const ajustes = manifiesto.browser_specific_settings;
  assert.ok(ajustes && typeof ajustes === "object");
  assert.deepEqual(Object.keys(ajustes), ["gecko"]);

  const gecko = ajustes.gecko;
  // Identificador con forma de dirección, pero de un dominio no enrutable y
  // sin buzón real: vale igual en cada versión y en AMO.
  assert.equal(gecko.id, "ayudante-seneca@asistentedeseneca.local");
  assert.match(gecko.id, /^[^@\s]+@[^@\s]+\.[a-z]+$/);
  assert.equal(/gmail|hotmail|outlook|yahoo/i.test(gecko.id), false);

  // Firefox 115 (ESR) soporta Manifest V3 con chrome.scripting y storage.
  assert.equal(gecko.strict_min_version, "115.0");
  const minima = Number(gecko.strict_min_version.split(".")[0]);
  assert.ok(minima >= 109, "MV3 es la versión por defecto desde Firefox 109");
});
