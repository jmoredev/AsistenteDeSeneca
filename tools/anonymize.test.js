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
const FIXTURE = path.join(__dirname, "..", "tests", "fixtures", "grupos-de-alumnos.html");

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

function tablaCon(contenido, atributosTabla = 'class="TableData"') {
  return "<table " + atributosTabla + "><tbody><tr><td>" + contenido + "</td></tr></tbody></table>";
}

// Tiradas de 7 o más cifras (quitando espacios, puntos, guiones y +34/0034):
// cualquier cosa así en un fixture es un identificador. Cálculo independiente
// del módulo, para no fiarse del mismo código que se está probando.
function tiradasLargas(html) {
  const encontradas = html.match(/\+?\d[\d\s.\-()]*/g) || [];
  return encontradas.filter((tirada) => {
    let limpia = tirada.trim();
    if (limpia.startsWith("+34")) limpia = limpia.slice(3);
    else if (limpia.startsWith("0034")) limpia = limpia.slice(4);
    return (limpia.match(/\d/g) || []).length >= 7;
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

test("dentro de la tabla solo sobreviven los atributos de la lista blanca", () => {
  const tabla = tablaCon(
    [
      '<a data-menulink="tokabc" href="../menus/tokabc" onclick="abrir()" onmousedown="pulsar()" title="pista"',
      ' data-target="../menus/tokabc" style="background:url(fondo.png)" class="enlace">ver</a>',
      '<input name="T_DESCPERS_1" id="T_DESCPERS_1" size="35" type="text" value="texto real" placeholder="pista">',
      '<img src="fotos/alumno42.jpg" srcset="fotos/alumno42.jpg 2x" alt="foto">',
      '<button type="button" formaction="../menus/tokabc" name="b1">Enviar</button>',
      '<td colspan="2" rowspan="3" scope="col" class="celda" bogus="x">dato</td>'
    ].join("")
  );

  const salida = anonymizeHtml(tabla);

  for (const rastro of ["tokabc", "../menus/", "texto real", "fotos/", "url(", "srcset", "formaction", "onclick", "onmousedown", "data-menulink", "data-target", "style=", "placeholder", "title=", "bogus", "alt="]) {
    assert.equal(salida.includes(rastro), false, "queda " + rastro);
  }
  assert.ok(salida.includes('<input name="T_DESCPERS_1" id="T_DESCPERS_1" size="35" type="text" value="">'), "atributos del input mal filtrados: " + salida);
  assert.ok(salida.includes('src="' + PLACEHOLDER.img + '"'), "el src de la imagen no es el sustituto");
  assert.ok(salida.includes('<button type="button" name="b1">Enviar</button>'), "atributos permitidos del botón perdidos");
  assert.ok(salida.includes('<td colspan="2" rowspan="3" scope="col" class="celda">dato</td>'), "atributos permitidos de la celda perdidos");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("elimina iframe, style, form, script, object, embed, link y meta", () => {
  const tabla = tablaCon(
    [
      '<iframe src="../menus/tokiframe"></iframe>',
      "<style>.x{background:url(fondo.png)}</style>",
      '<form action="../menus/tokform"><span class="texto-SNC">MUSI1</span></form>',
      "<script>alert('x')</script>",
      '<object data="foto.png">alternativa</object>',
      '<embed src="foto.png">',
      '<link rel="stylesheet" href="../css/tema.css">',
      '<meta name="author" content="Profesor Ejemplo">',
      "texto visible"
    ].join("")
  );

  const salida = anonymizeHtml(tabla);

  for (const rastro of ["iframe", "tokiframe", "<style", "url(", "<form", "tokform", "action=", "script", "<object", "<embed", "<link", "author", "stylesheet", "Profesor Ejemplo", "alternativa", "foto.png", "tema.css"]) {
    assert.equal(salida.toLowerCase().includes(rastro.toLowerCase()), false, "queda " + rastro);
  }
  // El único <meta> que sobrevive es el charset del propio fixture.
  assert.equal((salida.match(/<meta\b/gi) || []).length, 1, "queda un meta de la captura");
  assert.ok(salida.includes('<meta charset="windows-1252">'), "falta el charset del fixture");
  assert.ok(salida.includes("texto visible"), "se ha perdido el texto de la tabla");
  assert.ok(salida.includes('<span class="texto-SNC">MUSI1</span>'), "se ha perdido el texto del form");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("un script sin cerrar se elimina hasta el final", () => {
  const salida = anonymizeHtml('<table class="TableData"><tr><td>ok<script>var x = 1;');

  assert.equal(salida.toLowerCase().includes("script"), false, "queda el script");
  assert.equal(salida.includes("var x"), false, "queda el código del script");
  assert.ok(salida.includes("<td>ok"), "se ha perdido el texto anterior al script");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("borra DNI, NIE, teléfonos y correos dentro de la tabla", () => {
  const salida = anonymizeHtml(
    tablaCon(
      [
        "<span>12345678Z</span>",
        "<span>X1234567L</span>",
        "<span>654321098</span>",
        "<span>alumno.real@correo.es</span>"
      ].join("")
    )
  );

  for (const dato of ["12345678Z", "X1234567L", "654321098", "alumno.real@correo.es"]) {
    assert.equal(salida.includes(dato), false, "queda el dato " + dato);
  }
  assert.ok(salida.includes(PLACEHOLDER.dni), "falta el sustituto del DNI");
  assert.ok(salida.includes(PLACEHOLDER.nie), "falta el sustituto del NIE");
  assert.ok(salida.includes(PLACEHOLDER.phone), "falta el sustituto del teléfono");
  assert.ok(salida.includes(PLACEHOLDER.email), "falta el sustituto del correo");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("cualquier tirada de 7 cifras o más es un identificador", () => {
  const casos = [
    ["+34654321098", "teléfono con +34 pegado"],
    ["654321098", "móvil de 9 cifras"],
    ["0034 654 321 098", "prefijo 0034 y espacios"],
    ["654.321.098", "puntos"],
    ["654-321-098", "guiones"],
    ["12345678", "ocho cifras sin letra"],
    ["963123456", "fijo de 9 cifras"],
    ["(654) 321 098", "paréntesis"]
  ];

  for (const [dato, descripcion] of casos) {
    assert.equal(verify("<p>" + dato + "</p>").ok, false, "verify debía fallar con " + descripcion);

    const salida = anonymizeHtml(tablaCon("<span>Contacto: " + dato + "</span>"));
    assert.equal(salida.includes(dato), false, "queda " + descripcion);
    assert.ok(salida.includes(PLACEHOLDER.phone), "falta el sustituto en " + descripcion);
    assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
    assert.deepEqual(tiradasLargas(salida), [], "queda una tirada larga con " + descripcion);
  }
});

test("los datos de la pantalla de alumnado sobreviven a la anonimización", () => {
  const salida = anonymizeHtml(
    tablaCon('<span class="texto-SNC">4º de E.S.O. / MUSI1 / 4ESOX / 19 alumnos\\as</span><span>01/09/2025</span><span>28 alumnos\\as</span>')
  );

  assert.ok(salida.includes("4º de E.S.O. / MUSI1 / 4ESOX / 19 alumnos\\as"), "se ha perdido el grupo");
  assert.ok(salida.includes("01/09/2025"), "se ha perdido la fecha");
  assert.ok(salida.includes("28 alumnos\\as"), "se ha perdido el recuento");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("borra DNI y NIE con cualquier mezcla de espacios, puntos y guiones", () => {
  const casos = [
    ["12345678Z", "DNI pegado"],
    ["12345678 - Z", "DNI con espacio guion espacio"],
    ["12345678-Z", "DNI con guion"],
    ["12.345.678 Z", "DNI con puntos"],
    ["12 345 678-Z", "DNI con espacios y guion"],
    ["X1234567L", "NIE pegado"],
    ["X 1234567 - L", "NIE con separadores"],
    ["Y.1234567.Z", "NIE con puntos"]
  ];

  for (const [dato, descripcion] of casos) {
    assert.equal(verify("<p>" + dato + "</p>").ok, false, "verify debía fallar con " + descripcion);
    const salida = anonymizeHtml(tablaCon("<span>" + dato + "</span>"));
    assert.equal(salida.includes("1234567"), false, "quedan cifras de " + descripcion);
    assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
  }
});

test("borra correos con y sin dominio de primer nivel", () => {
  for (const correo of ["alumno.real@correo.es", "usuario@servidor", "a.b+c@intranet"]) {
    assert.equal(verify("<p>" + correo + "</p>").ok, false, "verify debía fallar con " + correo);
    const salida = anonymizeHtml(tablaCon("<span>" + correo + "</span>"));
    assert.equal(salida.includes(correo), false, "queda el correo " + correo);
    assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
  }
});

test("borra rutas de menú y de navegación que aparezcan como texto", () => {
  const salida = anonymizeHtml(tablaCon("<span>../menus/tokabc</span><span>nav/tokdef</span>"));

  assert.equal(salida.includes("../menus/"), false, "queda una ruta de menú");
  assert.equal(salida.includes("nav/tokdef"), false, "queda una ruta de navegación");
  assert.equal(verify(salida).ok, true, JSON.stringify(verify(salida).problems));
});

test("verify() falla con cualquier identificador o atributo de riesgo que quede", () => {
  const casos = [
    ["DNI", "<p>12345678Z</p>"],
    ["DNI con separadores", "<p>12345678 - Z</p>"],
    ["NIE", "<p>X1234567L</p>"],
    ["teléfono", "<p>654321098</p>"],
    ["teléfono con +34 pegado", "<p>+34654321098</p>"],
    ["correo", "<p>alumno.real@correo.es</p>"],
    ["correo sin dominio", "<p>usuario@servidor</p>"],
    ["script", "<p><script>alert(1)</script></p>"],
    ["data-menulink", '<a data-menulink="tok123">ver</a>'],
    ["data-target", '<span data-target="../menus/tok123">ver</span>'],
    ["href", '<a href="../menus/tok123">ver</a>'],
    ["img src", '<img src="fotos/alumno42.jpg">'],
    ["img srcset", '<img srcset="fotos/alumno42.jpg 2x">'],
    ["style", '<span style="background:url(fondo.png)">x</span>'],
    ["url(", "<p>background: url(fondo.png)</p>"],
    ["form", '<form action="../menus/tok123"><input type="text" value=""></form>'],
    ["iframe", '<iframe src="https://ejemplo"></iframe>'],
    ["style bloque", "<style>.x{background:url(fondo.png)}</style>"],
    ["valor de input", '<input type="text" value="texto real">'],
    ["ruta de menú como texto", "<p>../menus/tok123</p>"],
    ["ruta de navegación como texto", "<p>nav/tok123</p>"]
  ];

  for (const [nombre, fragmento] of casos) {
    const resultado = verify('<table class="TableData"><tr><td>' + fragmento + "</td></tr></table>");
    assert.equal(resultado.ok, false, "verify debía fallar con " + nombre);
    assert.ok(resultado.problems.length > 0, "sin mensaje para " + nombre);
  }

  // Los sustitutos no pueden disparar la verificación.
  const limpio = "<p>" + [PLACEHOLDER.dni, PLACEHOLDER.nie, PLACEHOLDER.phone, PLACEHOLDER.email, PLACEHOLDER.ruta].join(" ") + "</p>";
  assert.equal(verify(limpio).ok, true, JSON.stringify(verify(limpio).problems));
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

test("CLI: el teléfono con +34 pegado no sobrevive", (t) => {
  const dir = crearDirectorioTemporal(t);
  const entrada = path.join(dir, "captura.html");
  const salida = path.join(dir, "salida.html");

  fs.writeFileSync(entrada, tablaCon("<span>Contacto: +34654321098</span>"), "latin1");

  const resultado = ejecutarCli([entrada, salida], dir);
  assert.equal(resultado.status, 0, resultado.stderr);
  const texto = fs.readFileSync(salida, "latin1");
  assert.equal(texto.includes("654321098"), false, "queda el teléfono pegado al +34");
  assert.equal(texto.includes("+34"), false, "queda el prefijo +34");
  assert.deepEqual(tiradasLargas(texto), [], "queda una tirada larga");
  assert.equal(verify(texto).ok, true, JSON.stringify(verify(texto).problems));
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

  // Una url() suelta en el texto de la celda no se puede limpiar sola: para y
  // pide revisión humana en vez de escribir un fixture dudoso.
  fs.writeFileSync(entrada, tablaCon("<span>background: url(fondo.png)</span>"), "latin1");

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
    assert.fail("falta el fixture tests/fixtures/grupos-de-alumnos.html (genéralo con tools/anonymize.js)");
  }
  const html = fs.readFileSync(FIXTURE, "latin1");

  assert.equal(verify(html).ok, true, JSON.stringify(verify(html).problems));
  assert.equal((html.match(/<table\b/gi) || []).length, 1, "debe haber exactamente una tabla");
  assert.ok(/class="[^"]*TableData[^"]*"/.test(html), "la tabla no es TableData");
  assert.equal(html.toLowerCase().includes("<script"), false, "queda un script");
  assert.equal(html.includes("data-menulink"), false, "queda un token de menú");
  assert.equal(html.includes("+34"), false, "queda el prefijo +34");
  assert.equal(/\d{8}/.test(html), false, "quedan ocho cifras seguidas");
  assert.deepEqual(tiradasLargas(html), [], "quedan tiradas de 7 o más cifras");

  const cabeceras = (html.match(/<th\b[^>]*>([\s\S]*?)<\/th>/gi) || []).map((th) =>
    th.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  );
  assert.deepEqual(cabeceras, CABECERAS, "cabeceras distintas de la pantalla de alumnado");

  assert.equal((html.match(/<tr\b/gi) || []).length, 9, "se esperan 1 fila de cabecera y 8 de datos");
});

test("una tirada numérica no se come el texto que la sigue (revisión R3-NUMERIC-TRAILING)", () => {
  const salida = anonymizeHtml(tablaCon("<tr><td>654321098 alumno</td><td>654321098 (móvil)</td><td>(954) 123 456.</td></tr>"));
  assert.ok(salida.includes(PLACEHOLDER.phone + " alumno"), "se perdió el espacio tras el teléfono");
  assert.ok(salida.includes(PLACEHOLDER.phone + " (móvil)"), "se perdió el paréntesis tras el teléfono");
  assert.ok(salida.includes(PLACEHOLDER.phone + "."), "se perdió el punto final");
  // Solo la tabla: la cabecera fija declara charset="windows-1252".
  const tabla = salida.slice(salida.indexOf("<table"));
  assert.equal(/\d{3}/.test(tabla), false, "queda un número sin sustituir");
});
