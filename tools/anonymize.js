#!/usr/bin/env node
"use strict";

// Anonimiza una página de Séneca guardada para que pueda ser un fixture de
// test (RT-05 y RT-09 de REQUISITOS.md): ningún dato personal real entra en el
// repositorio. Es una red de seguridad, no una garantía: quien captura la
// página debe darle además un repaso visual, sobre todo de nombres propios,
// que ningún patrón detecta de forma fiable.
//
// Uso:
//   node tools/anonymize.js <captura.html> [salida.html]
//
// Sin segundo argumento escribe <captura>.anon.html junto a la entrada.
//
// Modos (opción `modo` de anonymizeHtml):
//   "tablas" (por defecto)  lista blanca: el fixture es un documento mínimo
//                           con SOLO las tablas de datos (<table> con
//                           class ... TableData). Todo lo de fuera (cabecera
//                           con nombres de usuario/centro/perfil, menús,
//                           scripts) se descarta.
//   "pagina"                conserva la página entera y solo sustituye
//                           patrones (comportamiento anterior de la
//                           herramienta).
//
// En ambos modos se eliminan los <script>, se neutralizan los valores de
// data-menulink, onclick, onmousedown y href, se vacían los value de los
// <input>, se sustituye el src de las imágenes y se borran DNI, NIE,
// teléfonos españoles y correos.
//
// La captura de Séneca está en Windows-1252: se lee y se escribe como
// "latin1" para conservar los bytes (leerla como UTF-8 destrozaba 115
// caracteres de la captura real).
//
// Códigos de salida: 0 si la verificación pasa; 1 si quedan datos sensibles
// (no se escribe nada); 2 si el uso es incorrecto (sin entrada, archivo
// ilegible o sin tabla de datos).

const fs = require("node:fs");

const DNI_RE = /\b\d{8}[A-HJ-NP-TV-Za-hj-np-tv-z]\b/g;
const NIE_RE = /\b[XYZxyz]-?\d{7}-?[A-HJ-NP-TV-Za-hj-np-tv-z]\b/g;
const PHONE_RE = /(\+34[\s-]?)?\b[6-9]\d{8}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[A-Za-z]{2,}\b/g;

// Formas «casi» sensibles que la sustitución automática no toca (dígitos con
// separadores). Si aparecen, se para y se pide revisión humana.
const SOSPECHOSOS = [
  { re: /\b\d{8}[\s.-]?[A-Za-z]\b/g, descripcion: "posible DNI con separadores" },
  { re: /\b[XYZxyz][\s.-]?\d{7}[\s.-]?[A-Za-z]\b/g, descripcion: "posible NIE con separadores" },
  { re: /(\+34[\s.-]?)?\b[6-9]\d{2}[\s.-]\d{3}[\s.-]\d{3}\b/g, descripcion: "posible teléfono con separadores" }
];

// Atributos cuyo valor puede contener un token de sesión, una ruta de menú o
// código ejecutable: se sustituyen por un valor neutro.
const ATRIBUTOS_CON_TOKEN = ["data-menulink", "onclick", "onmousedown", "href"];

// Los sustitutos están elegidos para que no vuelvan a casar con los patrones:
// así verify() puede demostrar que la salida no tiene identificadores.
const PLACEHOLDER = {
  dni: "DNI-EJEMPLO",
  nie: "NIE-EJEMPLO",
  phone: "TEL-EJEMPLO",
  email: "correo-ejemplo",
  img: "data:ayudante-seneca/foto-anonima",
  attr: "#"
};

// Etiquetas de apertura, admitiendo «>» dentro de valores entrecomillados
// (los atributos de la captura real vienen partidos en varias líneas).
const TAG_RE = /<[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;
const SCRIPT_ELEMENT_RE = /<script\b[\s\S]*?<\/script\s*>/gi;
const SCRIPT_OPEN_RE = /<script\b[^>]*>/gi;

function claseDeEtiqueta(etiqueta) {
  const m = etiqueta.match(/\bclass\s*=\s*("[^"]*"|'[^']*')/i);
  return m ? m[1].slice(1, -1) : "";
}

// Devuelve el marcado de cada <table> cuya class contiene «TableData»,
// incluidas sus tablas anidadas.
function extraerTablasDeDatos(html) {
  const tablas = [];
  const aperturaRe = /<table\b[^>]*>/gi;
  let m;
  while ((m = aperturaRe.exec(html)) !== null) {
    if (!/tabledata/i.test(claseDeEtiqueta(m[0]))) continue;
    const inicio = m.index;
    const fin = finDeTabla(html, inicio + m[0].length);
    tablas.push(html.slice(inicio, fin));
    aperturaRe.lastIndex = fin;
  }
  return tablas;
}

function finDeTabla(html, desde) {
  const re = /<table\b|<\/table\s*>/gi;
  re.lastIndex = desde;
  let profundidad = 1;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/^<table/i.test(m[0])) {
      profundidad += 1;
      continue;
    }
    profundidad -= 1;
    if (profundidad === 0) return m.index + m[0].length;
  }
  // Tabla sin cerrar: se conserva el resto, que la verificación revisará.
  return html.length;
}

function neutralizarAtributos(tag) {
  let salida = tag;
  for (const nombre of ATRIBUTOS_CON_TOKEN) {
    const re = new RegExp("(\\b" + nombre + "\\s*=\\s*)(\"[^\"]*\"|'[^']*'|[^\\s>]+)", "gi");
    salida = salida.replace(re, (m, prefijo) => prefijo + '"' + PLACEHOLDER.attr + '"');
  }
  if (/^<input\b/i.test(tag)) {
    salida = salida.replace(/(\bvalue\s*=\s*)("[^"]*"|'[^']*')/gi, (m, prefijo) => prefijo + '""');
  }
  if (/^<img\b/i.test(tag)) {
    salida = salida.replace(/(\bsrc\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, prefijo) => prefijo + '"' + PLACEHOLDER.img + '"');
  }
  return salida;
}

// Elimina scripts y neutraliza atributos (dentro de la tabla o de la página).
function limpiarMarcado(html) {
  let salida = html.replace(SCRIPT_ELEMENT_RE, "").replace(SCRIPT_OPEN_RE, "");
  salida = salida.replace(TAG_RE, (tag) => neutralizarAtributos(tag));
  return salida;
}

function sustituirPatrones(html) {
  let salida = html;
  salida = salida.replace(NIE_RE, PLACEHOLDER.nie);
  salida = salida.replace(DNI_RE, PLACEHOLDER.dni);
  salida = salida.replace(PHONE_RE, PLACEHOLDER.phone);
  salida = salida.replace(EMAIL_RE, PLACEHOLDER.email);
  return salida;
}

function documentoMinimo(tablas) {
  return [
    "<!doctype html>",
    '<html lang="es-ES">',
    "<head>",
    '<meta charset="windows-1252">',
    "<title>Fixture anonimizado de Séneca</title>",
    "</head>",
    "<body>",
    tablas.join("\n"),
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

// Fixture de lista blanca: solo las tablas de datos, ya anonimizadas.
function construirFixture(html) {
  const tablas = extraerTablasDeDatos(html).map((tabla) => sustituirPatrones(limpiarMarcado(tabla)));
  if (tablas.length === 0) {
    throw new Error("No hay ninguna tabla de datos (class TableData) en la captura.");
  }
  return { tablas, html: documentoMinimo(tablas) };
}

function anonymizeHtml(html, opciones = {}) {
  const modo = opciones.modo || "tablas";
  if (modo === "pagina") return sustituirPatrones(limpiarMarcado(html));
  if (modo !== "tablas") throw new Error("Modo no soportado: " + modo);
  return construirFixture(html).html;
}

function buscar(html, re) {
  return html.match(new RegExp(re.source, re.flags)) || [];
}

// Marcado de cada etiqueta <nombre ...> presente en el documento.
function etiquetasDe(html, nombre) {
  const re = new RegExp(TAG_RE.source, "gi");
  const etiquetas = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[0].toLowerCase().startsWith("<" + nombre)) etiquetas.push(m[0]);
  }
  return etiquetas;
}

// Valores de un atributo, sin comillas.
function valoresDeAtributo(html, nombre) {
  const re = new RegExp("\\b" + nombre + "\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)", "gi");
  const valores = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    let valor = m[1];
    if (valor[0] === '"' || valor[0] === "'") valor = valor.slice(1, -1);
    valores.push(valor);
  }
  return valores;
}

function verify(html) {
  const problemas = [];

  const dnis = buscar(html, DNI_RE);
  const nies = buscar(html, NIE_RE);
  const telefonos = buscar(html, PHONE_RE);
  const correos = buscar(html, EMAIL_RE);
  const scripts = buscar(html, /<script\b/gi);
  const fotos = etiquetasDe(html, "img").flatMap((tag) => valoresDeAtributo(tag, "src"));
  const fotosSinAnonimizar = fotos.filter((valor) => valor !== PLACEHOLDER.img);
  const tokens = ATRIBUTOS_CON_TOKEN.reduce(
    (total, nombre) => total + valoresDeAtributo(html, nombre).filter((valor) => valor !== PLACEHOLDER.attr).length,
    0
  );
  const valores = etiquetasDe(html, "input")
    .flatMap((tag) => valoresDeAtributo(tag, "value"))
    .filter((valor) => valor !== "");
  const sospechosos = SOSPECHOSOS.reduce((total, patron) => total + buscar(html, patron.re).length, 0);

  if (dnis.length) problemas.push(dnis.length + " posible(s) DNI: " + dnis.slice(0, 3).join(", "));
  if (nies.length) problemas.push(nies.length + " posible(s) NIE: " + nies.slice(0, 3).join(", "));
  if (telefonos.length) problemas.push(telefonos.length + " posible(s) teléfono(s): " + telefonos.slice(0, 3).join(", "));
  if (correos.length) problemas.push(correos.length + " posible(s) correo(s): " + correos.slice(0, 3).join(", "));
  if (scripts.length) problemas.push(scripts.length + " etiqueta(s) <script> sin eliminar");
  if (fotosSinAnonimizar.length) problemas.push(fotosSinAnonimizar.length + " imagen(es) con src no anonimizado");
  if (tokens) problemas.push(tokens + " atributo(s) con token sin neutralizar (" + ATRIBUTOS_CON_TOKEN.join(", ") + ")");
  if (valores.length) problemas.push(valores.length + " value de <input> sin vaciar");
  if (sospechosos) problemas.push(sospechosos + " posible(s) identificador(es) con separadores: revísalos a mano");

  return { ok: problemas.length === 0, problems: problemas };
}

function salidaPorDefecto(entrada) {
  return entrada.replace(/(\.html)?$/i, "") + ".anon.html";
}

function main() {
  const entrada = process.argv[2];
  const destino = process.argv[3] || (entrada ? salidaPorDefecto(entrada) : "");

  if (!entrada) {
    console.error("Uso: node tools/anonymize.js <captura.html> [salida.html]");
    process.exitCode = 2;
    return;
  }

  let html;
  try {
    html = fs.readFileSync(entrada, "latin1");
  } catch (error) {
    console.error("No se puede leer la captura: " + entrada);
    console.error("Comprueba la ruta y que el archivo exista.");
    process.exitCode = 2;
    return;
  }

  let fixture;
  try {
    fixture = construirFixture(html);
  } catch (error) {
    console.error(error.message);
    console.error("No se ha escrito nada: revisa que la captura sea la pantalla de alumnado.");
    process.exitCode = 2;
    return;
  }

  const resultado = verify(fixture.html);
  if (!resultado.ok) {
    console.error("Verificación con problemas:");
    for (const problema of resultado.problems) console.error("  - " + problema);
    console.error("NO entregues este archivo como fixture hasta corregir lo anterior.");
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(destino, fixture.html, "latin1");
  console.log("Anonimizado: " + destino);
  console.log("Tablas de datos conservadas: " + fixture.tablas.length);
  console.log("Verificación: sin DNIs, NIEs, teléfonos ni correos detectables.");
  console.log("AVISO: revisa visualmente nombres y apellidos; el script no los detecta de forma fiable.");
}

module.exports = { anonymizeHtml, construirFixture, extraerTablasDeDatos, verify, PLACEHOLDER };

if (require.main === module) main();
