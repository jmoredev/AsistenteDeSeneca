"use strict";

// Adaptador de la pantalla «Grupo de alumnos/as» de Séneca (S1, S2, S3 y S4 de
// odd/tasks/informes-alumnado-grupo.md). HTML sintético salvo el fixture, que
// es la captura real anonimizada (Windows-1252, se lee como latin1).
// Ejecutar: npm test   (o: node --test extension/seneca/grupos-alumnos.test.js)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { extraerGrupos } = require("./grupos-alumnos.js");

const FIXTURE = path.join(__dirname, "..", "..", "tests", "fixtures", "grupos-de-alumnos.html");

const CABECERAS = ["Alumnado de", "Descripción personalizada", "Materia", "Actividad", "Fecha de creación"];

const FORMATO = "«Alumnado de» no tiene el formato «… / materia / grupo / N alumnos\\as»";

// Tabla de mentira con la misma forma que la captura: cabeceras en <th> con un
// <div> dentro y celdas tal cual las escribe cada test.
function tabla(cabeceras, filas, atributos = 'class="table table-hover TableData"') {
  return (
    `<table ${atributos}>` +
    "<thead><tr>" +
    cabeceras.map((c) => `<th class="text-left cabecera"><div class="d-block">\n\t${c}\n</div></th>`).join("") +
    "</tr></thead><tbody>" +
    filas.map((f) => "<tr>" + f.map((c) => `<td class="text-left cuerpo1"><div class="d-block">${c}</div></td>`).join("") + "</tr>").join("") +
    "</tbody></table>"
  );
}

function alumnado(texto) {
  return `<span class="texto-SNC">${texto}</span>`;
}

test("el fixture de la pantalla da los 8 grupos en el orden de la tabla (S1, S2)", () => {
  const html = fs.readFileSync(FIXTURE, "latin1");

  assert.deepEqual(extraerGrupos(html), {
    grupos: [
      { grupo: "1ESOA", materia: "MATE1", alumnos: 28, etiqueta: "1ESOA - MATE1" },
      { grupo: "1BACA", materia: "LENG1", alumnos: 20, etiqueta: "1BACA - LENG1" },
      { grupo: "1BACA", materia: "INGL1", alumnos: 23, etiqueta: "1BACA - INGL1" },
      { grupo: "1BACA", materia: "TECN1", alumnos: 26, etiqueta: "1BACA - TECN1" },
      { grupo: "2ESOB", materia: "HIST1", alumnos: 12, etiqueta: "2ESOB - HIST1" },
      { grupo: "2BACB", materia: "FISQ1", alumnos: 7, etiqueta: "2BACB - FISQ1" },
      { grupo: "4ESOX", materia: "MUSI1", alumnos: 19, etiqueta: "4ESOX - MUSI1" },
      { grupo: "4ESOY", materia: "MUSI1", alumnos: 28, etiqueta: "4ESOY - MUSI1" },
    ],
    avisos: [],
  });
});

test("el texto de la celda se lee como se ve: <br>, &nbsp;, entidades y «>» en atributos (S2)", () => {
  const html = tabla(CABECERAS, [
    [
      '<div data-pista="a > b"><span class="texto-SNC">1º&nbsp;G.D.C.F.G.M.(Estudios&nbsp;Inventados<br>y&nbsp;/&nbsp;MATE1&nbsp;/&nbsp;1ESOA&nbsp;/&nbsp;28&nbsp;alumnos\\as</span></div>',
      "",
      '<span class="texto-SNC">MATE1</span>',
      "",
      "",
    ],
    [
      alumnado("2025/26&nbsp;/&nbsp;Lengua&nbsp;&amp;&nbsp;Literatura&nbsp;/&nbsp;2ºESO&nbsp;B&nbsp;/&nbsp;20&nbsp;alumnos\\as"),
      "",
      alumnado("Lengua &amp; Literatura"),
      "",
      "",
    ],
  ]);

  assert.deepEqual(extraerGrupos(html), {
    grupos: [
      { grupo: "1ESOA", materia: "MATE1", alumnos: 28, etiqueta: "1ESOA - MATE1" },
      { grupo: "2ºESO B", materia: "Lengua & Literatura", alumnos: 20, etiqueta: "2ºESO B - Lengua & Literatura" },
    ],
    avisos: [],
  });
});

test("se elige la tabla de datos con «Alumnado de» y «Materia» aunque haya otras tablas", () => {
  const html = [
    tabla(["Unidad", "Curso", "Materia"], [["Base de datos", "2025/26", "MATE1"]], 'class="table TableData"'),
    tabla(["Alumnado de", "Materia"], [["2025/26 / Física / 4ºESO C / 18 alumnos\\as", "Física"]], 'class="tabla-menu"'),
    tabla(CABECERAS, [[alumnado("2025/26 / Lengua / 2ºESO B / 20 alumnos\\as"), "", alumnado("Lengua"), "", ""]]),
  ].join("\n");

  assert.deepEqual(extraerGrupos(html), {
    grupos: [{ grupo: "2ºESO B", materia: "Lengua", alumnos: 20, etiqueta: "2ºESO B - Lengua" }],
    avisos: [],
  });
});

test("la pantalla de acceso se reconoce con cualquier comilla y mayúsculas", () => {
  for (const html of [
    '<form action="login"><input name="usuario" type="text"><INPUT TYPE="PASSWORD" name="clave"></form>',
    '<form><input name="clave" type=password></form>',
    "<form><input type='Password' name='clave'></form>",
  ]) {
    assert.deepEqual(extraerGrupos(html), {
      error: "La respuesta es la pantalla de acceso: no se reconoció tu sesión.",
    });
  }
});

test("sin tabla de datos se avisa en español", () => {
  for (const html of [
    '<html><body><h1>GRUPO DE ALUMNOS/AS</h1><p>Sin tabla.</p></body></html>',
    '<html><body><table class="tabla-menu"><tr><td>Menú</td></tr></table></body></html>',
  ]) {
    assert.deepEqual(extraerGrupos(html), {
      error: "No aparece la tabla «Grupo de alumnos/as» en la respuesta.",
    });
  }
});

test("si falta una columna se informa de las cabeceras encontradas", () => {
  const html = tabla(["Alumnado de", "Descripción personalizada"], [
    [alumnado("2025/26 / Lengua / 2ºESO B / 20 alumnos\\as"), ""],
  ]);

  assert.deepEqual(extraerGrupos(html), {
    error: "No encuentro la columna «Materia». Cabeceras: Alumnado de | Descripción personalizada",
  });
});

test("si la materia no coincide con «Alumnado de» se mantiene la fila y se avisa (S2)", () => {
  const html = tabla(CABECERAS, [
    [alumnado("2025/26 / Lengua / 2ºESO B / 20 alumnos\\as"), "", alumnado("Lengua"), "", ""],
    [alumnado("2025/26 / Física / 4ºESO C / 18 alumnos\\as"), "", alumnado("Química"), "", ""],
  ]);

  assert.deepEqual(extraerGrupos(html), {
    grupos: [
      { grupo: "2ºESO B", materia: "Lengua", alumnos: 20, etiqueta: "2ºESO B - Lengua" },
      { grupo: "4ºESO C", materia: "Química", alumnos: 18, etiqueta: "4ºESO C - Química" },
    ],
    avisos: ["Fila 2: la materia «Química» no coincide con la de «Alumnado de»."],
  });
});

test("una fila con «Alumnado de» mal formado se descarta con un aviso numerado", () => {
  const html = tabla(CABECERAS, [
    [alumnado("2025/26 / Lengua / 2ºESO B / 20 alumnos\\as"), "", alumnado("Lengua"), "", ""],
    [alumnado("Sin separadores"), "", alumnado("Música"), "", ""],
  ]);

  assert.deepEqual(extraerGrupos(html), {
    grupos: [{ grupo: "2ºESO B", materia: "Lengua", alumnos: 20, etiqueta: "2ºESO B - Lengua" }],
    avisos: [`Fila 2: ${FORMATO}`],
  });
});

test("los pares «grupo - materia» repetidos salen una sola vez y en orden", () => {
  const html = tabla(CABECERAS, [
    [alumnado("2025/26 / MATE1 / 1ESOA / 28 alumnos\\as"), "", alumnado("MATE1"), "", ""],
    [alumnado("2025/26 / INGL1 / 1BACA / 23 alumnos\\as"), "", alumnado("INGL1"), "", ""],
    [alumnado("2025/26 / MATE1 / 1ESOA / 27 alumnos\\as"), "", alumnado("MATE1"), "", ""],
  ]);

  assert.deepEqual(extraerGrupos(html), {
    grupos: [
      { grupo: "1ESOA", materia: "MATE1", alumnos: 28, etiqueta: "1ESOA - MATE1" },
      { grupo: "1BACA", materia: "INGL1", alumnos: 23, etiqueta: "1BACA - INGL1" },
    ],
    avisos: [],
  });
});
