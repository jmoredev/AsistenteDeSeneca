"use strict";

// Pure helpers of the T7 live diagnostic (S2, S6 of
// odd/tasks/informes-alumnado-grupo.md). Synthetic data only.

const test = require("node:test");
const assert = require("node:assert/strict");
const { enmascarar, partirAlumnadoDe, analizarFilas } = require("./diagnostico-analisis.js");

test("enmascarar tapa los tokens de navegación y los valores de la consulta", () => {
  const salida = enmascarar(
    "https://seneca.juntadeandalucia.es/seneca/nav/Tok3nDePrueba_x-3 y ../menus/AbC123_-z " +
      "y ../acciones/Zz9 y PaginaVuelta.jsp?ALEATORIO=0.123&MODO=2#x"
  );
  assert.equal(
    salida,
    "https://seneca.juntadeandalucia.es/seneca/nav/<token> y ../menus/<token> " +
      "y ../acciones/<token> y PaginaVuelta.jsp?ALEATORIO=<valor>&MODO=<valor>#x"
  );
  assert.equal(enmascarar("Materias que imparte"), "Materias que imparte");
});

test("partirAlumnadoDe toma el grupo del penúltimo elemento y la materia del anterior", () => {
  const r = partirAlumnadoDe("2025/26\u00a0/ Matemáticas /  1ºESO A / 25 alumnos\\as ");
  assert.deepEqual(r, { grupo: "1ºESO A", materia: "Matemáticas", alumnos: 25, elementos: 4 });
});

test("partirAlumnadoDe avisa si el texto no tiene el formato esperado", () => {
  assert.deepEqual(partirAlumnadoDe("Sin separadores"), {
    error: "«Alumnado de» no tiene el formato «… / materia / grupo / N alumnos\\as»",
  });
});

test("analizarFilas cruza «Alumnado de» con la columna «Materia»", () => {
  const cabeceras = ["Alumnado de", "Descripción personalizada", "Materia", "Actividad", "Fecha de creación"];
  const filas = [
    ["2025/26 / Lengua / 2ºESO B / 20 alumnos\\as", "", "Lengua", "", "01/09/2025"],
    ["2025/26 / Física / 4ºESO C / 18 alumnos\\as", "", "Química", "", "01/09/2025"],
    ["roto", "", "Música", "", ""],
  ];
  assert.deepEqual(analizarFilas(cabeceras, filas), {
    filas: [
      { grupo: "2ºESO B", materia: "Lengua", alumnos: 20, coincide: true },
      { grupo: "4ºESO C", materia: "Química", alumnos: 18, coincide: false },
      { fila: 3, error: "«Alumnado de» no tiene el formato «… / materia / grupo / N alumnos\\as»" },
    ],
  });
});

test("analizarFilas informa de la columna que falta", () => {
  assert.deepEqual(analizarFilas(["Alumnado de", "Actividad"], [["a / b / c / 1 alumnos\\as", "x"]]), {
    error: "No encuentro la columna «Materia». Cabeceras: Alumnado de | Actividad",
  });
});
