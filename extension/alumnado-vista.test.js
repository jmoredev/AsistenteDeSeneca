"use strict";

// Modelo de vista del selector «Grupo - Materia» (S1 de
// odd/tasks/informes-alumnado-grupo.md). Datos sintéticos: no hay DOM ni
// chrome.* aquí, solo lo que el panel pinta.

const test = require("node:test");
const assert = require("node:assert/strict");

const { VACIO, SIN_CARGA, vistaDeGrupos, vistaDesdeCarga, textoSeleccion } = require("./alumnado-vista.js");

test("la lista sale en el orden de la tabla con su etiqueta y su número de alumnos (S1)", () => {
  const vista = vistaDeGrupos({
    grupos: [
      { grupo: "1ESOA", materia: "MATE1", alumnos: 28, etiqueta: "1ESOA - MATE1" },
      { grupo: "2BACB", materia: "FISQ1", alumnos: 7, etiqueta: "2BACB - FISQ1" },
      { grupo: "4ESOY", materia: "MUSI1", alumnos: 1, etiqueta: "4ESOY - MUSI1" },
    ],
    avisos: [],
  });

  assert.deepEqual(vista, {
    error: "",
    avisos: [],
    vacio: "",
    grupos: [
      { etiqueta: "1ESOA - MATE1", alumnos: 28, textoAlumnos: "28 alumnos" },
      { etiqueta: "2BACB - FISQ1", alumnos: 7, textoAlumnos: "7 alumnos" },
      { etiqueta: "4ESOY - MUSI1", alumnos: 1, textoAlumnos: "1 alumno" },
    ],
  });
});

test("los avisos del adaptador se muestran tal cual sobre la lista", () => {
  const vista = vistaDeGrupos({
    grupos: [{ grupo: "1ESOA", materia: "MATE1", alumnos: 28, etiqueta: "1ESOA - MATE1" }],
    avisos: [
      "Fila 2: la materia «Química» no coincide con la de «Alumnado de».",
      "Fila 3: «Alumnado de» no tiene el formato «… / materia / grupo / N alumnos\\as»",
    ],
  });

  assert.deepEqual(vista.avisos, [
    "Fila 2: la materia «Química» no coincide con la de «Alumnado de».",
    "Fila 3: «Alumnado de» no tiene el formato «… / materia / grupo / N alumnos\\as»",
  ]);
  assert.equal(vista.grupos.length, 1);
  assert.equal(vista.error, "");
});

test("un error del adaptador se muestra como mensaje, sin lista (RU-04, RF-24)", () => {
  assert.deepEqual(vistaDeGrupos({ error: "La respuesta es la pantalla de acceso: no se reconoció tu sesión." }), {
    error: "La respuesta es la pantalla de acceso: no se reconoció tu sesión.",
    avisos: [],
    grupos: [],
    vacio: "",
  });
});

test("el texto de la selección avisa de que las opciones de informes llegarán pronto (S1)", () => {
  assert.equal(
    textoSeleccion("1ESOA - MATE1"),
    "Seleccionado: 1ESOA - MATE1. Las opciones de informes llegarán pronto."
  );
});

test("sin grupos se explica en español y se nombra la pantalla de Séneca (S1)", () => {
  assert.equal(VACIO, "No se han encontrado grupos en «Grupo de alumnos/as».");
  assert.deepEqual(vistaDeGrupos({ grupos: [], avisos: [] }), {
    error: "",
    avisos: [],
    grupos: [],
    vacio: "No se han encontrado grupos en «Grupo de alumnos/as».",
  });
  assert.equal(vistaDeGrupos({ grupos: [], avisos: [] }).vacio, VACIO);
});

// --- Alumnado lee la carga inicial guardada (S7), sin pedir nada a Séneca ---

function cargaGuardada(elementoGrupos) {
  return {
    version: 1,
    cargadoEl: "2025-11-27T09:05:00.000Z",
    elementos: elementoGrupos === undefined ? {} : { grupos: elementoGrupos },
  };
}

test("con los grupos guardados, Alumnado pinta la misma lista y los mismos avisos (S7)", () => {
  const vista = vistaDesdeCarga(
    cargaGuardada({
      ok: true,
      datos: {
        grupos: [
          { grupo: "1ESOA", materia: "MATE1", alumnos: 28, etiqueta: "1ESOA - MATE1" },
          { grupo: "2BACB", materia: "FISQ1", alumnos: 7, etiqueta: "2BACB - FISQ1" },
        ],
      },
      avisos: ["Fila 2: la materia «Química» no coincide con la de «Alumnado de»."],
      error: "",
    })
  );

  assert.deepEqual(vista, {
    error: "",
    avisos: ["Fila 2: la materia «Química» no coincide con la de «Alumnado de»."],
    vacio: "",
    grupos: [
      { etiqueta: "1ESOA - MATE1", alumnos: 28, textoAlumnos: "28 alumnos" },
      { etiqueta: "2BACB - FISQ1", alumnos: 7, textoAlumnos: "7 alumnos" },
    ],
  });
});

test("si los grupos guardados no se pudieron cargar, Alumnado lo explica y remite a «Actualizar datos» (S7)", () => {
  const vista = vistaDesdeCarga(
    cargaGuardada({ ok: false, datos: {}, avisos: [], error: "No encuentro el menú «Grupos de alumnos/as»." })
  );

  assert.deepEqual(vista.grupos, []);
  assert.deepEqual(vista.avisos, []);
  assert.equal(vista.vacio, "");
  assert.match(vista.error, /No se pudieron cargar tus grupos/);
  assert.match(vista.error, /Grupos de alumnos\/as/);
  assert.match(vista.error, /Actualizar datos/);
});

test("sin carga guardada, Alumnado lo explica y remite a «Actualizar datos» (S7)", () => {
  const vacia = vistaDesdeCarga(null);
  assert.deepEqual(vacia.grupos, []);
  assert.equal(vacia.error, SIN_CARGA);
  assert.match(vacia.error, /Actualizar datos/);
  assert.deepEqual(vistaDesdeCarga(cargaGuardada(undefined)), vacia);
});
