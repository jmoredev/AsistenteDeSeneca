"use strict";

// Tests de tools/anonymize.js (RT-05 y RT-09 de REQUISITOS.md).
// Ejecutar: npm test   (o: node --test tools/anonymize.test.js)
//
// Datos personales de estos tests: todos inventados.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  anonymizeHtml,
  verify,
  PLACEHOLDER
} = require("./anonymize.js");

const HERRAMIENTA = path.join(__dirname, "anonymize.js");
const FIXTURE = path.join(__dirname, "..", "tests", "fixtures", "materias-que-imparte.html");

const CABECERAS = [
  "Alumnado de",
  "Descripción personalizada",
  "Materia",
  "Actividad",
  "Fecha de creación"
];

// Página de mentira con la misma forma que la captura real de Séneca: cabecera
// con nombres del docente/centro, menús con tokens y una tabla de datos.
const PAGINA = [
  "<!doctype html>",
  '<html lang="es-ES"><head>',
  "<script>var usuarioReal = 'apellido';</script>",
  "<title>Séneca</title></head><body>",
  "<header><span>Profesor Ejemplo Apellido</span><span>IES Centro Inventado</span></header>",
  '<nav><a data-menulink="toknv1" href="../menus/toknv1" onmousedown="menu();">Alumnado</a></nav>',
  '<table id="Gen_Id_000002" class="table table-hover TableData">',
  "<thead><tr>" + CABECERAS.map((t) => "<th>" + t + "</th>").join("") + "</tr></thead>",
  '<tbody><tr class="menuContextual">',
  '<td class="text-left snc-col-0 cuerpo1"><div class="d-block"><span class="texto-SNC">4º de E.S.O. / MUSI1 / 4ESOX / 19 alumnos\\as</span></div>',
  '<input name="T_DESCPERS_1" size="35" type="text" value="descripcion real">',
  '<img src="fotos/alumno42.jpg" alt="foto">',
  "</td>",
  '<td class="text-left snc-col-2 cuerpo1"><div class="d-block"><span class="texto-SNC">MUSI1</span></div></td>',
  "</tr></tbody></table>",
  '<table class="tabla-menu"><tr><td>menu interno</td></tr></table>',
  "</body></html>"
].join("\n");

function crearDirectorioTemporal(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anonimiza-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function ejecutarCli(args, cwd) {
  return spawnSync(process.execPath, [HERRAMIENTA].concat(args), {
    cwd,
    encoding: "utf8"
  });
}

test("solo se queda con las tablas de datos (lista blanca)", () => {
  const salida = anonymizeHtml(PAGINA);

  // Lo que entra: la tabla y su estructura.
  assert.ok(salida.includes('<table id="Gen_Id_000002" class="table table-hover TableData">'), "falta la tabla de datos");
  assert.ok(salida.includes('class="texto-SNC"'), "falta la estructura de las celdas");
  assert.ok(salida.includes("4º de E.S.O. / MUSI1 / 4ESOX / 19 alumnos\\as"), "falta el texto de la celda");
  for (const cabecera of CABECERAS) {
    assert.ok(salida.includes("<th>" + cabecera + "</th>"), "falta la cabecera " + cabecera);
  }

  // Lo que NO entra: cabecera de la página, menús, scripts, tabla no TableData.
  assert.equal(salida.includes("Profesor Ejemplo"), false, "se ha colado un nombre del docente");
  assert.equal(salida.includes("IES Centro Inventado"), false, "se ha colado el nombre del centro");
  assert.equal(salida.includes("usuarioReal"), false, "se ha colado un script");
  assert.equal(salida.toLowerCase().includes("<script"), false, "queda una etiqueta script");
  assert.equal(salida.includes("toknv1"), false, "se ha colado un token de menú");
  assert.equal(salida.includes("menu interno"), false, "se ha colado una tabla que no es de datos");

  // Documento mínimo y autocontenido.
  assert.ok(salida.startsWith("<!doctype html>"), "no empieza por doctype");
  assert.ok(salida.includes('<meta charset="windows-1252">'), "falta el charset declarado");
  assert.ok(salida.includes("</html>"), "no termina el documento");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("neutraliza tokens y valores dentro de la tabla", () => {
  const tabla = [
    '<table class="TableData"><tbody><tr>',
    '<td><a data-menulink="tokabc" href="../menus/tokabc" onclick="abrir(\'tokabc\')" onmousedown="pulsar()">ver</a></td>',
    '<td><input name="T_DESCPERS_1" type="text" value="texto real"></td>',
    '<td><img src="fotos/alumno42.jpg"></td>',
    "</tr></tbody></table>"
  ].join("\n");

  const salida = anonymizeHtml(tabla);

  assert.equal(salida.includes("tokabc"), false, "queda el token del menú");
  assert.equal(salida.includes("../menus/"), false, "queda una ruta de menú");
  assert.equal(salida.includes("texto real"), false, "queda un value de input");
  assert.equal(salida.includes("fotos/alumno42.jpg"), false, "queda el src de una foto");
  assert.ok(salida.includes('value=""'), "el value no se ha vaciado");
  assert.ok(salida.includes('href="' + PLACEHOLDER.attr + '"'), "href sin neutralizar");
  assert.ok(salida.includes('onclick="' + PLACEHOLDER.attr + '"'), "onclick sin neutralizar");
  assert.ok(salida.includes('onmousedown="' + PLACEHOLDER.attr + '"'), "onmousedown sin neutralizar");
  assert.ok(salida.includes('data-menulink="' + PLACEHOLDER.attr + '"'), "data-menulink sin neutralizar");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("elimina los scripts que hubiera dentro de la tabla", () => {
  const salida = anonymizeHtml('<table class="TableData"><tr><td>ok<script>alert(1)</script></td></tr></table>');
  assert.equal(salida.toLowerCase().includes("<script"), false, "queda un script");
  assert.ok(salida.includes("<td>ok</td>"), "se ha perdido el texto de la celda");
});

test("borra DNI, NIE, teléfonos y correos dentro de la tabla", () => {
  const tabla = [
    '<table class="TableData"><tbody><tr>',
    "<td>12345678Z</td>",
    "<td>X1234567L</td>",
    "<td>654321098</td>",
    "<td>alumno.real@correo.es</td>",
    "</tr></tbody></table>"
  ].join("\n");

  const salida = anonymizeHtml(tabla);

  for (const dato of ["12345678Z", "X1234567L", "654321098", "alumno.real@correo.es"]) {
    assert.equal(salida.includes(dato), false, "queda el dato " + dato);
  }
  assert.ok(salida.includes(PLACEHOLDER.dni), "falta el sustituto del DNI");
  assert.ok(salida.includes(PLACEHOLDER.nie), "falta el sustituto del NIE");
  assert.ok(salida.includes(PLACEHOLDER.phone), "falta el sustituto del teléfono");
  assert.ok(salida.includes(PLACEHOLDER.email), "falta el sustituto del correo");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("verify() falla con cualquier identificador que quede", () => {
  const casos = [
    ["DNI", "12345678Z"],
    ["NIE", "X1234567L"],
    ["teléfono", "654321098"],
    ["correo", "alumno.real@correo.es"],
    ["script", "<script>alert(1)</script>"],
    ["data-menulink", '<a data-menulink="tok123">ver</a>'],
    ["img src", '<img src="fotos/alumno42.jpg">'],
    ["valor de input", '<input type="text" value="texto real">']
  ];

  for (const [nombre, fragmento] of casos) {
    const resultado = verify('<table class="TableData"><tr><td>' + fragmento + "</td></tr></table>");
    assert.equal(resultado.ok, false, "verify debía fallar con " + nombre);
    assert.ok(resultado.problems.length > 0, "sin mensaje para " + nombre);
  }

  // Los sustitutos no pueden disparar la verificación.
  assert.equal(verify("<p>" + [PLACEHOLDER.dni, PLACEHOLDER.nie, PLACEHOLDER.phone, PLACEHOLDER.email].join(" ") + "</p>").ok, true);
});

test("modo pagina: conserva la página y anonimiza los patrones (comportamiento anterior)", () => {
  const pagina = [
    "<html><body>",
    "<h1>Alumnado</h1>",
    "<table><tr><td>12345678Z</td><td>654321098</td><td>alumno.real@correo.es</td></tr></table>",
    '<img src="fotos/alumno42.jpg" alt="foto">',
    "</body></html>"
  ].join("\n");

  const salida = anonymizeHtml(pagina, { modo: "pagina" });

  assert.ok(salida.includes("<h1>Alumnado</h1>"), "el modo pagina no debe recortar el documento");
  assert.equal(salida.includes("12345678Z"), false, "queda el DNI");
  assert.equal(salida.includes("654321098"), false, "queda el teléfono");
  assert.equal(salida.includes("alumno.real@correo.es"), false, "queda el correo");
  assert.equal(salida.includes("fotos/alumno42.jpg"), false, "queda el src de la foto");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("si no hay tabla de datos no se inventa un fixture", () => {
  assert.throws(() => anonymizeHtml("<html><body><p>sin tablas</p></body></html>"), /tabla/i);
});

test("CLI: conserva los bytes Windows-1252 (latin1) de la captura", (t) => {
  const dir = crearDirectorioTemporal(t);
  const entrada = path.join(dir, "captura.html");
  const salida = path.join(dir, "salida.html");

  const tabla = [
    '<table class="TableData"><tbody><tr>',
    '<td><span class="texto-SNC">1º G.D.C.F.G.M. / LENG1 / 1BACA / año académico / señal</span></td>',
    "<td>12345678Z</td>",
    "</tr></tbody></table>"
  ].join("\n");
  fs.writeFileSync(entrada, "<html><body>" + tabla + "</body></html>", "latin1");

  const resultado = ejecutarCli([entrada, salida], dir);
  assert.equal(resultado.status, 0, resultado.stderr);

  const bytes = fs.readFileSync(salida);
  const texto = bytes.toString("latin1");

  // Ida y vuelta byte a byte salvo la sustitución del DNI.
  const esperado = tabla.replace("12345678Z", PLACEHOLDER.dni);
  assert.ok(texto.includes(esperado), "la tabla no se conserva byte a byte");
  assert.ok(texto.includes("año académico / señal"), "faltan los caracteres latin1");
  assert.equal(texto.includes("12345678Z"), false, "queda el DNI");

  // Nada de UTF-8: ni U+FFFD (EF BF BD) ni el «º» codificado en dos bytes.
  assert.equal(bytes.includes(Buffer.from([0xef, 0xbf, 0xbd])), false, "hay caracteres de sustitución UTF-8");
  assert.equal(bytes.includes(Buffer.from([0xc2, 0xba])), false, "el «º» se ha recodificado en UTF-8");
  assert.ok(bytes.includes(Buffer.from([0xba])), "falta el byte latin1 del «º»");
  assert.ok(bytes.includes(Buffer.from([0xf1])), "falta el byte latin1 de la «ñ»");
});

test("CLI: código 2 y mensaje en español si falta la captura", (t) => {
  const dir = crearDirectorioTemporal(t);
  const resultado = ejecutarCli([], dir);
  assert.equal(resultado.status, 2);
  assert.ok(resultado.stderr.includes("Uso:"), "sin mensaje de uso en español");
});

test("CLI: código 2 si el archivo no existe o no tiene tabla de datos", (t) => {
  const dir = crearDirectorioTemporal(t);

  const inexistente = ejecutarCli([path.join(dir, "no-existe.html"), path.join(dir, "a.html")], dir);
  assert.equal(inexistente.status, 2);
  assert.ok(inexistente.stderr.length > 0, "sin mensaje de error");

  const sinTabla = path.join(dir, "sin-tabla.html");
  fs.writeFileSync(sinTabla, "<html><body><p>nada</p></body></html>", "latin1");
  const resultado = ejecutarCli([sinTabla, path.join(dir, "b.html")], dir);
  assert.equal(resultado.status, 2);
  assert.ok(resultado.stderr.includes("tabla"), "sin aviso de tabla ausente");
  assert.equal(fs.existsSync(path.join(dir, "b.html")), false, "ha escrito un fixture vacío");
});

test("CLI: código 1 y ningún archivo escrito si la verificación falla", (t) => {
  const dir = crearDirectorioTemporal(t);
  const entrada = path.join(dir, "captura.html");
  const salida = path.join(dir, "salida.html");

  // Teléfono con separadores: el anonimizador no lo sustituye, la verificación
  // debe pararlo para que una persona lo revise.
  fs.writeFileSync(
    entrada,
    '<html><body><table class="TableData"><tr><td>Contacto 654 321 098</td></tr></table></body></html>',
    "latin1"
  );

  const resultado = ejecutarCli([entrada, salida], dir);
  assert.equal(resultado.status, 1);
  assert.ok(resultado.stderr.includes("Verificación"), "sin mensaje de verificación en español");
  assert.equal(fs.existsSync(salida), false, "ha escrito un fixture sin verificar");
});

test("CLI: escribe el fixture y sale con 0 cuando todo está limpio", (t) => {
  const dir = crearDirectorioTemporal(t);
  const entrada = path.join(dir, "captura.html");
  const salida = path.join(dir, "salida.html");
  fs.writeFileSync(entrada, PAGINA, "latin1");

  const resultado = ejecutarCli([entrada, salida], dir);
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.ok(resultado.stdout.includes(salida), "no informa del archivo escrito");
  assert.equal(fs.existsSync(salida), true, "no ha escrito la salida");
  assert.equal(verify(fs.readFileSync(salida, "latin1")).ok, true);
});

test("fixture del repositorio: solo la tabla de datos y sin datos reales", (t) => {
  if (!fs.existsSync(FIXTURE)) {
    assert.fail("falta el fixture tests/fixtures/materias-que-imparte.html (genéralo con tools/anonymize.js)");
  }
  const html = fs.readFileSync(FIXTURE, "latin1");

  assert.equal(verify(html).ok, true, JSON.stringify(verify(html).problems));
  assert.equal((html.match(/<table\b/gi) || []).length, 1, "debe haber exactamente una tabla");
  assert.ok(/class="[^"]*TableData[^"]*"/.test(html), "la tabla no es TableData");
  assert.equal(html.toLowerCase().includes("<script"), false, "queda un script");
  assert.equal(html.includes("data-menulink"), false, "queda un token de menú");

  const cabeceras = (html.match(/<th\b[^>]*>([\s\S]*?)<\/th>/gi) || []).map((th) =>
    th.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  );
  assert.deepEqual(cabeceras, CABECERAS, "cabeceras distintas de la pantalla de alumnado");

  assert.equal((html.match(/<tr\b/gi) || []).length, 9, "se esperan 1 fila de cabecera y 8 de datos");
});
