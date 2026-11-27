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
//   "pagina"                conserva la estructura de la página entera y solo
//                           sustituye datos (comportamiento anterior).
//
// Lista blanca estricta, en los dos modos:
//   - De cada etiqueta solo sobreviven los atributos permitidos (class, id,
//     colspan, rowspan, name, type, size, scope; value vacío en <input>, src
//     sustituido en <img>). Cualquier otro atributo se descarta, así que no
//     queda ningún token, URL, estilo ni controlador de eventos.
//   - Se eliminan por completo <script> (aunque no estén cerrados), <style>,
//     <iframe>, <object>, <embed>, <link> y <meta>; de <form> se conserva el
//     contenido. El texto de la tabla que no es código se mantiene.
//   - Se sustituyen DNI y NIE (con cualquier mezcla de espacios, puntos y
//     guiones), correos con o sin dominio, rutas de menú/navegación y
//     cualquier tirada de 7 cifras o más (espacios, puntos, guiones,
//     paréntesis y prefijo +34/0034 incluidos), que es lo que identifica a un
//     teléfono o a un documento. Las fechas (01/09/2025) y los recuentos
//     («28 alumnos\as») no se tocan.
//
// La captura de Séneca está en Windows-1252: se lee y se escribe como
// "latin1" para conservar los bytes (leerla como UTF-8 destrozaba 115
// caracteres de la captura real).
//
// Códigos de salida: 0 si la verificación pasa; 1 si quedan datos sensibles
// (no se escribe nada); 2 si el uso es incorrecto (sin entrada, archivo
// ilegible o sin tabla de datos).

const fs = require("node:fs");

// --- patrones de datos personales ----------------------------------------

// Ruta de menú o de navegación con token: nunca puede sobrevivir al fixture.
const RUTA_RE = /(?:\.\.?\/menus|nav)\/[\w.%-]+/gi;

// NIE y DNI con cualquier mezcla de espacios, puntos y guiones entre cifras.
const NIE_RE = /\b[XYZxyz](?:[\s.-]*\d){7}[\s.-]*[A-HJ-NP-TV-Za-hj-np-tv-z]\b/g;
const DNI_RE = /\b(?:\d[\s.-]*){8}[A-HJ-NP-TV-Za-hj-np-tv-z]\b/g;

// Correo, con o sin dominio de primer nivel (usuario@servidor también).
const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\b/g;

// Cualquier tirada de cifras con sus separadores habituales. Si al quitar
// espacios, puntos, guiones, paréntesis y un prefijo +34/0034 quedan 7 cifras
// o más, es un identificador (teléfono, DNI sin letra, expediente...).
// Empieza y termina en cifra: nunca se come el espacio o signo que la sigue.
const TIRADA_NUMERICA_RE = /\+?\d(?:[\d\s.()\-]*\d)?/g;

// Los sustitutos están elegidos para que no vuelvan a casar con los patrones:
// así verify() puede demostrar que la salida no tiene identificadores.
const PLACEHOLDER = {
  dni: "DNI-EJEMPLO",
  nie: "NIE-EJEMPLO",
  phone: "TEL-EJEMPLO",
  email: "correo-ejemplo",
  img: "data:ayudante-seneca/foto-anonima",
  ruta: "RUTA-EJEMPLO"
};

// --- lista blanca de marcado ---------------------------------------------

const ATRIBUTOS_GENERALES = ["class", "id", "colspan", "rowspan", "name", "type", "size", "scope"];
const ATRIBUTOS_EXTRA = {
  input: ["value"],
  img: ["src"],
  meta: ["charset"],
  html: ["lang"]
};

// Elementos que se eliminan con todo su contenido: su interior es código o
// recursos, nunca texto de la tabla.
const ELEMENTOS_CON_CODIGO = ["script", "style", "iframe", "object"];
// Elementos vacíos que se eliminan tal cual.
const ELEMENTOS_VACIOS = ["link", "meta", "embed"];
// Contenedores que se despliegan: se van las etiquetas y queda su texto.
const ELEMENTOS_DESENVOLTADOS = ["form"];
// Lo que verify() no admite encontrar en un fixture.
const ELEMENTOS_PROHIBIDOS = ELEMENTOS_CON_CODIGO.concat(ELEMENTOS_VACIOS, ELEMENTOS_DESENVOLTADOS).filter(
  (nombre) => nombre !== "meta"
);

// Etiquetas de apertura, admitiendo «>» dentro de valores entrecomillados
// (los atributos de la captura real vienen partidos en varias líneas).
const TAG_RE = /<[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;

function atributosPermitidos(etiqueta) {
  return ATRIBUTOS_GENERALES.concat(ATRIBUTOS_EXTRA[etiqueta] || []);
}

// Valor obligatorio de un atributo; null si su valor es libre.
function valorFijado(etiqueta, atributo) {
  if (atributo === "value") return "";
  if (atributo === "src") return PLACEHOLDER.img;
  if (atributo === "charset") return "windows-1252";
  return null;
}

function nombreDeEtiqueta(tag) {
  const m = tag.match(/^<\s*([a-zA-Z][\w:-]*)/);
  return m ? m[1].toLowerCase() : "";
}

// Atributos de una etiqueta de apertura: [{ nombre, valor }], sin comillas y
// con el valor null si el atributo no lleva «=».
function leerAtributos(tag) {
  let interior = tag.replace(/^<\s*[a-zA-Z][\w:-]*/, "");
  if (interior.endsWith(">")) interior = interior.slice(0, -1);
  interior = interior.replace(/\/\s*$/, "");

  const atributos = [];
  const re = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
  let m;
  while ((m = re.exec(interior)) !== null) {
    let valor = m[2];
    if (valor === undefined) valor = null;
    else if (valor[0] === '"' || valor[0] === "'") valor = valor.slice(1, -1);
    atributos.push({ nombre: m[1].toLowerCase(), valor });
  }
  return atributos;
}

function normalizarValor(valor) {
  return valor.replace(/\s+/g, " ").trim().replace(/"/g, "&quot;");
}

// Reescribe una etiqueta de apertura dejando solo los atributos permitidos.
function limpiarEtiqueta(tag) {
  const etiqueta = nombreDeEtiqueta(tag);
  if (!etiqueta) return tag;
  const permitidos = atributosPermitidos(etiqueta);

  const conservados = [];
  const vistos = new Set();
  for (const atributo of leerAtributos(tag)) {
    if (!permitidos.includes(atributo.nombre)) continue;
    if (vistos.has(atributo.nombre)) continue;
    vistos.add(atributo.nombre);

    const fijado = valorFijado(etiqueta, atributo.nombre);
    if (fijado !== null) {
      if (atributo.valor === null && atributo.nombre !== "value") {
        conservados.push(atributo.nombre);
      } else {
        conservados.push(atributo.nombre + '="' + (fijado === null ? "" : fijado) + '"');
      }
      continue;
    }
    if (atributo.valor === null) conservados.push(atributo.nombre);
    else conservados.push(atributo.nombre + '="' + normalizarValor(atributo.valor) + '"');
  }

  return "<" + etiqueta + (conservados.length ? " " + conservados.join(" ") : "") + ">";
}

function quitarElemento(html, nombre) {
  const bloque = new RegExp("<" + nombre + "\\b[\\s\\S]*?</" + nombre + "\\s*>", "gi");
  const sinCerrar = new RegExp("<" + nombre + "\\b[^>]*>[\\s\\S]*$", "i");
  return html.replace(bloque, "").replace(sinCerrar, "");
}

// Elimina el marcado peligroso y filtra los atributos de todo el documento.
function limpiarMarcado(html) {
  let salida = html;
  for (const nombre of ELEMENTOS_CON_CODIGO) salida = quitarElemento(salida, nombre);
  for (const nombre of ELEMENTOS_VACIOS) {
    salida = salida.replace(new RegExp("<" + nombre + "\\b[^>]*>", "gi"), "");
  }
  for (const nombre of ELEMENTOS_DESENVOLTADOS) {
    salida = salida.replace(new RegExp("</?" + nombre + "\\b[^>]*>", "gi"), "");
  }
  return salida.replace(TAG_RE, (tag) => limpiarEtiqueta(tag));
}

// --- sustitución de datos -------------------------------------------------

function cifrasDe(tirada) {
  let limpia = tirada.trim();
  if (limpia.startsWith("+34")) limpia = limpia.slice(3);
  else if (limpia.startsWith("0034")) limpia = limpia.slice(4);
  return (limpia.match(/\d/g) || []).length;
}

function esIdentificadorNumerico(tirada) {
  return cifrasDe(tirada) >= 7;
}

function sustituirPatrones(html) {
  let salida = html.replace(RUTA_RE, PLACEHOLDER.ruta);
  salida = salida.replace(NIE_RE, PLACEHOLDER.nie);
  salida = salida.replace(DNI_RE, PLACEHOLDER.dni);
  salida = salida.replace(EMAIL_RE, PLACEHOLDER.email);
  salida = salida.replace(TIRADA_NUMERICA_RE, (tirada) =>
    esIdentificadorNumerico(tirada) ? PLACEHOLDER.phone : tirada
  );
  return salida;
}

// --- extracción de la tabla de datos -------------------------------------

function claseDeEtiqueta(etiqueta) {
  const m = etiqueta.match(/\bclass\s*=\s*("[^"]*"|'[^']*')/i);
  return m ? m[1].slice(1, -1) : "";
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

// Marcado de cada <table> cuya class contiene «TableData», con sus tablas
// anidadas.
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

// --- verificación ---------------------------------------------------------

function buscar(html, re) {
  return html.match(new RegExp(re.source, re.flags)) || [];
}

// Problemas de marcado: elementos prohibidos y atributos fuera de la lista
// blanca (incluye tokens, url(), estilos, controladores de eventos y valores
// que deberían estar vacíos o sustituidos).
function problemasDeMarcado(html) {
  const problemas = [];
  const re = new RegExp(TAG_RE.source, "gi");
  let m;
  while ((m = re.exec(html)) !== null) {
    const etiqueta = nombreDeEtiqueta(m[0]);
    if (!etiqueta) continue;
    if (ELEMENTOS_PROHIBIDOS.includes(etiqueta)) {
      problemas.push("elemento <" + etiqueta + "> prohibido en el fixture");
      continue;
    }
    for (const atributo of leerAtributos(m[0])) {
      if (!atributosPermitidos(etiqueta).includes(atributo.nombre)) {
        problemas.push("atributo " + atributo.nombre + " no permitido en <" + etiqueta + ">");
        continue;
      }
      const esperado = valorFijado(etiqueta, atributo.nombre);
      if (esperado !== null && atributo.valor !== esperado) {
        problemas.push("atributo " + atributo.nombre + " de <" + etiqueta + "> sin anonimizar");
      }
    }
  }
  return problemas;
}

function resumir(problemas) {
  const cuenta = new Map();
  for (const problema of problemas) cuenta.set(problema, (cuenta.get(problema) || 0) + 1);
  return Array.from(cuenta, ([problema, veces]) => (veces > 1 ? veces + " x " + problema : problema));
}

// verify() no imprime los datos encontrados (podrían ser personales): solo
// cuenta cuántos hay.
function verify(html) {
  const problemas = [];

  const dnis = buscar(html, DNI_RE);
  const nies = buscar(html, NIE_RE);
  const correos = buscar(html, EMAIL_RE);
  const numericas = buscar(html, TIRADA_NUMERICA_RE).filter(esIdentificadorNumerico);
  const rutas = buscar(html, /(?:\.\.?\/menus|nav)\//gi);
  const urls = buscar(html, /url\(/gi);
  const scripts = buscar(html, /<script\b/gi);

  if (dnis.length) problemas.push(dnis.length + " posible(s) DNI sin anonimizar");
  if (nies.length) problemas.push(nies.length + " posible(s) NIE sin anonimizar");
  if (numericas.length) problemas.push(numericas.length + " identificador(es) numérico(s) sin anonimizar");
  if (correos.length) problemas.push(correos.length + " posible(s) correo(s) sin anonimizar");
  if (rutas.length) problemas.push(rutas.length + " ruta(s) de menú o navegación con token");
  if (urls.length) problemas.push(urls.length + " url(...) sin eliminar");
  if (scripts.length) problemas.push(scripts.length + " etiqueta(s) <script> sin eliminar");
  problemas.push(...resumir(problemasDeMarcado(html)));

  return { ok: problemas.length === 0, problems: problemas };
}

// --- CLI ------------------------------------------------------------------

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
  console.log("Verificación: sin identificadores, tokens ni enlaces de riesgo.");
  console.log("AVISO: revisa visualmente nombres y apellidos; el script no los detecta de forma fiable.");
}

module.exports = { anonymizeHtml, construirFixture, extraerTablasDeDatos, verify, PLACEHOLDER };

if (require.main === module) main();
