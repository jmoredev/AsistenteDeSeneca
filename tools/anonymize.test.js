"use strict";

// RED-first test for tools/anonymize.js (RT-09 of REQUISITOS.md).
// Run: node tools/anonymize.test.js

const assert = require("node:assert/strict");
const { anonymizeHtml, verify } = require("./anonymize.js");

const sample = [
  "<html><body>",
  "<table><tr><td>12345678Z</td>",
  "<td>654321098</td>",
  "<td>alumno.real@correo.es</td></tr></table>",
  '<img src="fotos/alumno42.jpg" alt="foto">',
  "</body></html>"
].join("\n");

const out = anonymizeHtml(sample);

// Strong identifiers must be gone.
assert.equal(out.includes("12345678Z"), false, "DNI real presente");
assert.equal(out.includes("654321098"), false, "telefono real presente");
assert.equal(out.includes("alumno.real@correo.es"), false, "correo real presente");

// Photos must not keep their source.
assert.equal(out.includes("fotos/alumno42.jpg"), false, "src de foto presente");

// Verification must pass for the anonymized output.
const result = verify(out);
assert.equal(result.ok, true, "verify fallo: " + JSON.stringify(result.problems));

// Verification must FAIL for the raw sample (guard against a verify() that
// always says ok).
const rawResult = verify(sample);
assert.equal(rawResult.ok, false, "verify debia fallar sobre datos reales");

console.log("anonymize.test.js: OK");
