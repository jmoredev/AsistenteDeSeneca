#!/usr/bin/env node
"use strict";

// Anonymizes a saved Seneca HTML page before it can become a test fixture.
// Implements RT-09 of REQUISITOS.md: no real personal data ever enters the
// repository. This tool is a safety net, not a guarantee: the person who
// captures the page must also give it a quick visual pass, especially for
// names, which cannot be detected reliably by pattern.
//
// Usage:
//   node tools/anonymize.js <captura.html> [salida.html]
//
// Without a second argument it writes <captura>.anon.html next to the input.
// Exit code 0 only if the verification pass finds no strong identifiers.

const fs = require("node:fs");
const path = require("node:path");

const DNI_RE = /\b\d{8}[A-HJ-NP-TV-Za-hj-np-tv-z]\b/g;
const PHONE_RE = /(\+34[\s-]?)?\b[6-9]\d{8}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[A-Za-z]{2,}\b/g;
const IMG_SRC_RE = /(<img\b[^>]*\bsrc\s*=\s*)("[^"]*"|'[^']*')/gi;

// Placeholders are deliberately non-matching so verify() can prove that the
// output contains no strong-identifier patterns at all.
const PLACEHOLDER = {
  dni: "DNI-EJEMPLO",
  phone: "TEL-EJEMPLO",
  email: "correo-ejemplo",
  img: '"data:ayudante-seneca/foto-anonima"'
};

function anonymizeHtml(html) {
  let out = html;
  out = out.replace(DNI_RE, PLACEHOLDER.dni);
  out = out.replace(PHONE_RE, PLACEHOLDER.phone);
  out = out.replace(EMAIL_RE, PLACEHOLDER.email);
  out = out.replace(IMG_SRC_RE, (m, prefix) => prefix + PLACEHOLDER.img);
  return out;
}

function verify(html) {
  const problems = [];
  const dnis = html.match(new RegExp(DNI_RE.source, "g")) || [];
  const phones = html.match(new RegExp(PHONE_RE.source, "g")) || [];
  const emails = html.match(new RegExp(EMAIL_RE.source, "g")) || [];
  const fotos = html.match(/<img\b[^>]*\bsrc\s*=\s*["'](?!data:ayudante-seneca)/gi) || [];
  if (dnis.length) problems.push(dnis.length + " posible(s) DNI: " + dnis.slice(0, 3).join(", "));
  if (phones.length) problems.push(phones.length + " posible(s) telefono(s): " + phones.slice(0, 3).join(", "));
  if (emails.length) problems.push(emails.length + " posible(s) correo(s): " + emails.slice(0, 3).join(", "));
  if (fotos.length) problems.push(fotos.length + " imagen(es) con src no anonimizado");
  return { ok: problems.length === 0, problems };
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Uso: node tools/anonymize.js <captura.html> [salida.html]");
    process.exitCode = 2;
    return;
  }
  const html = fs.readFileSync(input, "utf8");
  const out = anonymizeHtml(html);
  const result = verify(out);
  const output = process.argv[3] || input.replace(/(\.html)?$/i, "") + ".anon.html";
  fs.writeFileSync(output, out, "utf8");

  console.log("Anonimizado: " + output);
  if (result.ok) {
    console.log("Verificacion: sin DNIs, telefonos ni correos detectables.");
    console.log("AVISO: revisa visualmente nombres y apellidos; el script no los detecta de forma fiable.");
  } else {
    console.error("Verificacion con problemas:");
    for (const p of result.problems) console.error("  - " + p);
    console.error("NO entregues este archivo como fixture hasta corregir lo anterior.");
    process.exitCode = 1;
  }
}

module.exports = { anonymizeHtml, verify, PLACEHOLDER };

if (require.main === module) main();
