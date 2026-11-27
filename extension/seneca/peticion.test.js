"use strict";

// Petición en segundo plano compartida por el diagnóstico y el selector de
// grupos (S3, S5 y S6 de odd/tasks/informes-alumnado-grupo.md) y selección de
// marcos de Séneca (S8.1). Se prueban las partes puras y la orquestación con
// `chrome.scripting` inyectado: ni la pestaña ni el navegador se tocan.
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
  obtenerPantalla,
  localizarEnlace,
  ERROR_INESPERADO,
} = require("./peticion.js");

const BASE = "https://seneca.juntadeandalucia.es/seneca/jsp/portal/";
const NAV = "https://seneca.juntadeandalucia.es/seneca/nav/Tok3nDePrueba_x-3";
const TOKEN = "Tok3nDePrueba_x-3";
const ORIGEN_SENECA = "https://seneca.juntadeandalucia.es";
const ORIGEN_AJENO = "https://ejemplo.com";

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

// --- S8.1: la búsqueda del enlace y la petición solo ocurren en marcos cuyo
// documento es del origen de Séneca. Se simula `chrome.scripting`: los marcos
// llegan como los devolvería la función inyectada y la sonda se resuelve aquí.

const VISTA = { url: `${ORIGEN_SENECA}/seneca/jsp/portal/`, historial: 3, titulo: "Séneca" };

function marcoConEnlace(frameId, origen, enlace) {
  return {
    frameId,
    result: {
      menulink: enlace === undefined ? "../menus/AbC123_-z" : enlace,
      href: "#",
      base: `${ORIGEN_SENECA}/seneca/jsp/portal/`,
      origin: origen,
    },
  };
}

// Sonda que responde con la tabla de datos (un salto, sin redirección).
function sondaConTabla() {
  return {
    antes: VISTA,
    despues: VISTA,
    salto: {
      final: NAV,
      estado: 200,
      ok: true,
      redirigida: false,
      tipo: "text/html;charset=ISO-8859-1",
      bytes: 120517,
      html: '<table class="table TableData"><tr><td>x</td></tr></table>',
    },
  };
}

async function conScriptingSimulado(marcos, sonda, hacer) {
  const pedidos = [];
  const original = globalThis.chrome;
  globalThis.chrome = {
    scripting: {
      async executeScript(peticion) {
        if (peticion.target.allFrames) return marcos;
        const frameId = peticion.target.frameIds[0];
        pedidos.push({ frameId, url: peticion.args[0] });
        return [{ result: sonda({ frameId, url: peticion.args[0] }) }];
      },
    },
  };
  try {
    return await hacer(pedidos);
  } finally {
    if (original === undefined) delete globalThis.chrome;
    else globalThis.chrome = original;
  }
}

function textosDe(pasos) {
  return pasos.map(textoDePaso);
}

test("S8.1: se elige el marco de Séneca aunque un marco ajeno con el mismo enlace aparezca antes", async () => {
  const marcos = [marcoConEnlace(0, ORIGEN_AJENO), marcoConEnlace(7, ORIGEN_SENECA)];

  const resultado = await conScriptingSimulado(marcos, sondaConTabla, (pedidos) =>
    obtenerPantalla(42, TEXTO_ENLACE_GRUPOS)
  );

  assert.equal(resultado.ok, true);
  assert.equal(resultado.frameId, 7);
  assert.equal(resultado.motivo, null);
  assert.equal(resultado.error, null);
  assert.equal(resultado.vistaIntacta, true);
  assert.match(resultado.html, /TableData/);
  assert.deepEqual(textosDe(resultado.pasos), [
    "1. Busco el enlace «Grupos de alumnos/as» en la página…",
    "   Marco 7; data-menulink=../menus/<token> href=#",
    "2. Pido la pantalla en segundo plano (GET, mismo origen)…",
    "   Salto 1: HTTP 200 · text/html;charset=ISO-8859-1 · 120517 bytes\n" +
      "     https://seneca.juntadeandalucia.es/seneca/jsp/menus/<token>\n" +
      "     → https://seneca.juntadeandalucia.es/seneca/nav/<token>",
  ]);
  // Solo se pidió desde el marco de Séneca, nunca desde el ajeno.
  assert.deepEqual(
    await conScriptingSimulado(marcos, sondaConTabla, async (pedidos) => {
      await obtenerPantalla(42, TEXTO_ENLACE_GRUPOS);
      return pedidos;
    }),
    [{ frameId: 7, url: "https://seneca.juntadeandalucia.es/seneca/jsp/menus/AbC123_-z" }]
  );
});

test("S8.1: si el enlace solo aparece en marcos ajenos, no se pide nada y se explica en español", async () => {
  const marcos = [marcoConEnlace(0, ORIGEN_AJENO), marcoConEnlace(3, ORIGEN_AJENO)];

  const resultado = await conScriptingSimulado(marcos, sondaConTabla, (pedidos) =>
    obtenerPantalla(42, TEXTO_ENLACE_GRUPOS).then((r) => ({ ...r, pedidos }))
  );

  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, "marco-ajeno");
  assert.equal(
    resultado.error,
    "Solo encuentro el menú «Grupos de alumnos/as» en marcos que no son de Séneca, " +
      "así que no se ha pedido nada. Abre la pantalla en la pestaña de Séneca y vuelve a intentarlo."
  );
  assert.equal(resultado.html, "");
  assert.equal(resultado.frameId, null);
  assert.equal(resultado.vistaIntacta, null);
  assert.deepEqual(textosDe(resultado.pasos), [
    "1. Busco el enlace «Grupos de alumnos/as» en la página…",
    "✖ Solo encuentro «Grupos de alumnos/as» en marcos que no son de Séneca; no se ha pedido nada.",
  ]);
  assert.deepEqual(resultado.pedidos, []);
});

test("S8.1: sin el enlace en ningún marco se mantiene el mensaje de siempre", async () => {
  const marcos = [
    { frameId: 0, result: null },
    { frameId: 5, result: null },
    { frameId: 9, result: null },
  ];

  const resultado = await conScriptingSimulado(marcos, sondaConTabla, (pedidos) =>
    obtenerPantalla(42, TEXTO_ENLACE_GRUPOS).then((r) => ({ ...r, pedidos }))
  );

  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, "sin-enlace");
  assert.equal(
    resultado.error,
    "No encuentro el menú «Grupos de alumnos/as». Abre una pantalla de Séneca con el menú lateral y vuelve a intentarlo."
  );
  assert.deepEqual(textosDe(resultado.pasos), [
    "1. Busco el enlace «Grupos de alumnos/as» en la página…",
    "✖ No encuentro «Grupos de alumnos/as». Entra en una pantalla de Séneca con el menú lateral y repite.",
  ]);
  assert.deepEqual(resultado.pedidos, []);
});

test("S8.1: la búsqueda inyectada devuelve el origen de su propio marco (S6)", () => {
  const originales = { document: globalThis.document, location: globalThis.location };
  globalThis.document = {
    baseURI: `${ORIGEN_AJENO}/pagina/`,
    querySelectorAll: () => [
      { textContent: "  Grupos de\n alumnos/as ", getAttribute: (nombre) => (nombre === "data-menulink" ? "../menus/AbC123_-z" : "#") },
    ],
  };
  globalThis.location = { origin: ORIGEN_AJENO };
  try {
    assert.deepEqual(localizarEnlace(TEXTO_ENLACE_GRUPOS), {
      menulink: "../menus/AbC123_-z",
      href: "#",
      base: `${ORIGEN_AJENO}/pagina/`,
      origin: ORIGEN_AJENO,
    });
    // Sin enlace en el documento, nada que devolver.
    globalThis.document.querySelectorAll = () => [];
    assert.equal(localizarEnlace(TEXTO_ENLACE_GRUPOS), null);
  } finally {
    if (originales.document === undefined) delete globalThis.document;
    else globalThis.document = originales.document;
    if (originales.location === undefined) delete globalThis.location;
    else globalThis.location = originales.location;
  }
});

// PRESERVE: los marcos de Séneca con el enlace siguen eligiéndose igual.
test("PRESERVE: con dos marcos de Séneca con el enlace se usa el primero con destino y se avisa", async () => {
  const marcos = [marcoConEnlace(0, ORIGEN_SENECA, null), marcoConEnlace(4, ORIGEN_SENECA)];

  const resultado = await conScriptingSimulado(marcos, sondaConTabla, (pedidos) =>
    obtenerPantalla(42, TEXTO_ENLACE_GRUPOS).then((r) => ({ ...r, pedidos }))
  );

  assert.equal(resultado.ok, true);
  assert.equal(resultado.frameId, 4);
  assert.deepEqual(textosDe(resultado.pasos), [
    "1. Busco el enlace «Grupos de alumnos/as» en la página…",
    "⚠ Aparece en 2 marcos; uso el primero con destino.",
    "   Marco 4; data-menulink=../menus/<token> href=#",
    "2. Pido la pantalla en segundo plano (GET, mismo origen)…",
    "   Salto 1: HTTP 200 · text/html;charset=ISO-8859-1 · 120517 bytes\n" +
      "     https://seneca.juntadeandalucia.es/seneca/jsp/menus/<token>\n" +
      "     → https://seneca.juntadeandalucia.es/seneca/nav/<token>",
  ]);
  assert.deepEqual(resultado.pedidos, [
    { frameId: 4, url: "https://seneca.juntadeandalucia.es/seneca/jsp/menus/AbC123_-z" },
  ]);
});
