"use strict";

// Petición en segundo plano compartida por el diagnóstico y el selector de
// grupos (S3, S5 y S6 de odd/tasks/informes-alumnado-grupo.md). Solo se prueban
// las partes puras: las funciones inyectadas en la página necesitan
// chrome.scripting y no se pueden probar en Node.
// Ejecutar: npm test

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TEXTO_ENLACE_GRUPOS,
  MAX_SALTOS,
  ESPERA_MS,
  origenPermitido,
  destinoDe,
  evaluarSalto,
  textoDePaso,
  ERROR_INESPERADO,
} = require("./peticion.js");

const BASE = "https://seneca.juntadeandalucia.es/seneca/jsp/portal/";
const NAV = "https://seneca.juntadeandalucia.es/seneca/nav/Tok3nDePrueba_x-3";
const TOKEN = "Tok3nDePrueba_x-3";

test("las salvaguardas de la petición no cambian: solo Séneca, 2 saltos y 20 s (S3, S5, S6)", () => {
  assert.equal(TEXTO_ENLACE_GRUPOS, "Grupos de alumnos/as");
  assert.equal(MAX_SALTOS, 2);
  assert.equal(ESPERA_MS, 20000);
  assert.equal(origenPermitido("https://seneca.juntadeandalucia.es/seneca/nav/x"), true);
  assert.equal(origenPermitido("https://otra.juntadeandalucia.es/seneca/nav/x"), false);
  assert.equal(origenPermitido("http://seneca.juntadeandalucia.es/seneca/nav/x"), false);
  assert.equal(origenPermitido("no es url"), false);
});

test("destinoDe prefiere data-menulink y resuelve la dirección contra la base (S3)", () => {
  assert.equal(
    destinoDe({ menulink: "../menus/AbC123_-z", href: "#", base: BASE }),
    "https://seneca.juntadeandalucia.es/seneca/jsp/menus/AbC123_-z"
  );
  assert.equal(
    destinoDe({ menulink: null, href: "../nav/abc", base: BASE }),
    "https://seneca.juntadeandalucia.es/seneca/jsp/nav/abc"
  );
  assert.equal(destinoDe({ menulink: null, href: "#", base: BASE }), "");
  assert.equal(destinoDe({ menulink: null, href: null, base: BASE }), "");
  assert.equal(destinoDe({ menulink: "x", href: null, base: "no es url" }), "");
});

test("evaluarSalto descarta lo que llega fuera de Séneca y no sigue tras un error HTTP (S5, S6)", () => {
  const sano = {
    final: "https://seneca.juntadeandalucia.es/seneca/nav/abc",
    ok: true,
    estado: 200,
    html: '<table class="table TableData"></table>',
  };
  assert.deepEqual(evaluarSalto(sano), { valida: true, motivo: null, siguiente: null });

  const conSalto = { ...sano, html: '<a href="../nav/def">x</a>' };
  assert.deepEqual(evaluarSalto(conSalto), {
    valida: true,
    motivo: null,
    siguiente: "https://seneca.juntadeandalucia.es/seneca/nav/def",
  });

  assert.deepEqual(evaluarSalto({ ...sano, final: "https://ejemplo.com/robar" }), {
    valida: false,
    motivo: "fuera-de-seneca",
    siguiente: null,
  });

  assert.deepEqual(evaluarSalto({ ...sano, ok: false, estado: 500 }), {
    valida: true,
    motivo: "http",
    siguiente: null,
  });
});

test("textoDePaso reproduce las líneas del diagnóstico actual, con los tokens tapados (S6)", () => {
  const casos = [
    [{ tipo: "buscando", texto: TEXTO_ENLACE_GRUPOS }, "1. Busco el enlace «Grupos de alumnos/as» en la página…"],
    [
      { tipo: "sin-enlace", texto: TEXTO_ENLACE_GRUPOS },
      "✖ No encuentro «Grupos de alumnos/as». Entra en una pantalla de Séneca con el menú lateral y repite.",
    ],
    [{ tipo: "sin-destino", cuantos: 2 }, "✖ Hay 2 enlaces, pero ninguno tiene destino (ni data-menulink ni href)."],
    [{ tipo: "varios-marcos", cuantos: 2 }, "⚠ Aparece en 2 marcos; uso el primero con destino."],
    [{ tipo: "marco", frameId: 0, menulink: "../menus/AbC123_-z", href: "#" }, "   Marco 0; data-menulink=../menus/<token> href=#"],
    [{ tipo: "pidiendo" }, "2. Pido la pantalla en segundo plano (GET, mismo origen)…"],
    [
      { tipo: "salto-bloqueado", numero: 1, url: "https://ejemplo.com/robar" },
      "✖ Salto 1 bloqueado: https://ejemplo.com/robar no es Séneca. No se ha pedido.",
    ],
    [
      { tipo: "salto-error", numero: 2, url: NAV, motivo: "sin respuesta en 20 s" },
      "✖ Salto 2: https://seneca.juntadeandalucia.es/seneca/nav/<token>\n     Error en la petición: sin respuesta en 20 s",
    ],
    [
      {
        tipo: "salto",
        numero: 1,
        url: NAV,
        estado: 200,
        contentType: "text/html;charset=ISO-8859-1",
        bytes: 120517,
        redirigida: false,
        final: NAV,
      },
      "   Salto 1: HTTP 200 · text/html;charset=ISO-8859-1 · 120517 bytes\n" +
        "     https://seneca.juntadeandalucia.es/seneca/nav/<token>\n" +
        "     → https://seneca.juntadeandalucia.es/seneca/nav/<token>",
    ],
    [
      {
        tipo: "salto",
        numero: 2,
        url: NAV,
        estado: 302,
        contentType: "",
        bytes: 12,
        redirigida: true,
        final: NAV,
      },
      "   Salto 2: HTTP 302 · sin tipo · 12 bytes · redirigida\n" +
        "     https://seneca.juntadeandalucia.es/seneca/nav/<token>\n" +
        "     → https://seneca.juntadeandalucia.es/seneca/nav/<token>",
    ],
    [{ tipo: "fuera-de-seneca" }, "✖ La respuesta terminó fuera de Séneca: se descarta."],
  ];

  for (const [paso, esperado] of casos) {
    assert.equal(textoDePaso(paso), esperado);
    assert.equal(esperado.includes(TOKEN), false);
  }
});

test("un fallo inesperado se explica en español llano (RU-01, RF-24)", () => {
  assert.equal(
    ERROR_INESPERADO,
    "No se pudo completar la petición en segundo plano. Comprueba que Séneca sigue abierto y vuelve a intentarlo."
  );
  assert.equal(ERROR_INESPERADO.includes("Error"), false);
});
