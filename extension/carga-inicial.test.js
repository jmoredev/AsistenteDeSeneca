"use strict";

// Carga inicial de datos (S7 de odd/tasks/informes-alumnado-grupo.md, D13 de
// REQUISITOS.md): registro ampliable de elementos, comprobación de carga
// completa, ejecución en serie con fetch y reloj inyectados, guardado
// mínimo y «Olvidar todo» (RP-08). Sin DOM ni chrome.*: todo lo que toca el
// navegador se inyecta, así que estas pruebas corren en Node.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Carga = require("./carga-inicial.js");
const { extraerGrupos } = require("./seneca/grupos-alumnos.js");

const FIXTURE = path.join(__dirname, "..", "tests", "fixtures", "grupos-de-alumnos.html");

const RELOJ = () => new Date(2025, 10, 27, 9, 5);

// Un elemento de mentira: hoy el registro real solo trae los grupos, así que
// las pruebas de la ejecución en serie inyectan su propio registro.
function elemento(id, nombre, textoEnlace, extraer) {
  return {
    id,
    nombre,
    textoEnlace,
    extraer: extraer || ((html) => ({ filas: [{ texto: html }], avisos: [] })),
  };
}

test("el registro es una lista ordenada de elementos y hoy solo trae los grupos de alumnos (S7)", () => {
  assert.ok(Array.isArray(Carga.ELEMENTOS));
  assert.deepEqual(
    Carga.ELEMENTOS.map((e) => [e.id, e.nombre, e.textoEnlace]),
    [["grupos", "Grupos de alumnos/as", "Grupos de alumnos/as"]]
  );
  assert.equal(Carga.ELEMENTOS[0].extraer, extraerGrupos);
  // Añadir un elemento nuevo debe ser solo una entrada más en la lista.
  for (const entrada of Carga.ELEMENTOS) {
    assert.deepEqual(Object.keys(entrada).sort(), ["extraer", "id", "nombre", "textoEnlace"]);
  }
});

test("una carga está completa solo si hay versión y todos los elementos del registro están bien (S7)", () => {
  const buena = {
    version: Carga.VERSION,
    cargadoEl: "2025-11-27T09:05:00.000Z",
    elementos: { grupos: { ok: true, datos: { grupos: [] }, avisos: [], error: "" } },
  };
  assert.equal(Carga.estaCompleta(buena), true);

  // No hay nada guardado.
  assert.equal(Carga.estaCompleta(null), false);
  assert.equal(Carga.estaCompleta(undefined), false);
  assert.equal(Carga.estaCompleta({}), false);

  // Versión distinta.
  assert.equal(Carga.estaCompleta({ ...buena, version: Carga.VERSION + 1 }), false);

  // Falta un elemento del registro.
  assert.equal(Carga.estaCompleta({ ...buena, elementos: {} }), false);

  // Un elemento sin `ok: true`.
  assert.equal(Carga.estaCompleta({ ...buena, elementos: { grupos: { datos: {} } } }), false);
  assert.equal(
    Carga.estaCompleta({ ...buena, elementos: { grupos: { ok: false, error: "sin sesión", datos: {} } } }),
    false
  );
});

test("la carga pide las pantallas en el orden del registro, en serie y sin solaparse (S7)", async () => {
  const llamadas = [];
  const progreso = [];
  let enCurso = 0;
  let maximo = 0;

  const carga = await Carga.ejecutarCarga({
    elementos: [elemento("uno", "Primero", "Enlace uno"), elemento("dos", "Segundo", "Enlace dos")],
    pedir: async (textoEnlace) => {
      enCurso += 1;
      maximo = Math.max(maximo, enCurso);
      await new Promise((listo) => setTimeout(listo, 1));
      enCurso -= 1;
      llamadas.push(textoEnlace);
      return { ok: true, html: `html de ${textoEnlace}` };
    },
    ahora: RELOJ,
    alProgreso: (lineas) => progreso.push(lineas.map((l) => l.estado).join(",")),
  });

  assert.deepEqual(llamadas, ["Enlace uno", "Enlace dos"]);
  assert.equal(maximo, 1);
  assert.deepEqual(carga, {
    version: Carga.VERSION,
    cargadoEl: RELOJ().toISOString(),
    elementos: {
      uno: { ok: true, datos: { filas: [{ texto: "html de Enlace uno" }] }, avisos: [], error: "" },
      dos: { ok: true, datos: { filas: [{ texto: "html de Enlace dos" }] }, avisos: [], error: "" },
    },
  });
  assert.deepEqual(progreso, [
    "pendiente,pendiente",
    "cargando,pendiente",
    "listo,pendiente",
    "listo,cargando",
    "listo,listo",
  ]);
});

test("si un elemento falla, se anota su error y los demás siguen cargándose (S7)", async () => {
  const progreso = [];

  const carga = await Carga.ejecutarCarga({
    elementos: [elemento("uno", "Primero", "Enlace uno"), elemento("dos", "Segundo", "Enlace dos")],
    pedir: async (textoEnlace) =>
      textoEnlace === "Enlace uno"
        ? { ok: false, error: "Séneca respondió con un error (HTTP 500)." }
        : { ok: true, html: "contenido dos" },
    ahora: RELOJ,
    alProgreso: (lineas) => progreso.push(lineas.map((l) => l.estado).join(",")),
  });

  assert.deepEqual(carga.elementos.uno, {
    ok: false,
    datos: {},
    avisos: [],
    error: "Séneca respondió con un error (HTTP 500).",
  });
  assert.equal(carga.elementos.dos.ok, true);
  assert.equal(carga.elementos.dos.datos.filas[0].texto, "contenido dos");
  assert.deepEqual(progreso, [
    "pendiente,pendiente",
    "cargando,pendiente",
    "error,pendiente",
    "error,cargando",
    "error,listo",
  ]);
  assert.equal(Carga.estaCompleta(carga), false);
});

test("un adaptador o una petición que lanzan una excepción se anotan como error del elemento (S7)", async () => {
  const carga = await Carga.ejecutarCarga({
    elementos: [
      elemento("roto", "Roto", "Enlace roto", () => {
        throw new Error("la tabla cambió");
      }),
      elemento("sin-red", "Sin red", "Enlace sin red"),
    ],
    pedir: async (textoEnlace) => {
      if (textoEnlace === "Enlace sin red") throw new Error("sin conexión");
      return { ok: true, html: "" };
    },
    ahora: RELOJ,
  });

  assert.deepEqual(carga.elementos.roto, { ok: false, datos: {}, avisos: [], error: "la tabla cambió" });
  assert.deepEqual(carga.elementos["sin-red"], { ok: false, datos: {}, avisos: [], error: "sin conexión" });
});

test("solo se guardan los datos de trabajo permitidos: ni HTML, ni URL, ni tokens (S7, D13)", async () => {
  const html = fs.readFileSync(FIXTURE, "latin1");

  const carga = await Carga.ejecutarCarga({
    pedir: async () => ({ ok: true, html }),
    ahora: RELOJ,
  });

  assert.deepEqual(Object.keys(carga).sort(), ["cargadoEl", "elementos", "version"]);
  assert.equal(carga.version, Carga.VERSION);
  assert.equal(carga.cargadoEl, RELOJ().toISOString());
  assert.deepEqual(Object.keys(carga.elementos), ["grupos"]);
  assert.deepEqual(Object.keys(carga.elementos.grupos).sort(), ["avisos", "datos", "error", "ok"]);
  assert.deepEqual(Object.keys(carga.elementos.grupos.datos), ["grupos"]);

  const grupos = carga.elementos.grupos.datos.grupos;
  assert.equal(grupos.length, 8);
  for (const grupo of grupos) {
    assert.deepEqual(Object.keys(grupo).sort(), ["alumnos", "etiqueta", "grupo", "materia"]);
    assert.equal(typeof grupo.alumnos, "number");
    assert.equal(grupo.etiqueta, `${grupo.grupo} - ${grupo.materia}`);
  }

  // Nada de la respuesta original: ni etiquetas HTML, ni direcciones, ni tokens.
  const guardado = JSON.stringify(carga);
  assert.ok(!guardado.includes("<"), "no debe guardarse HTML");
  assert.ok(!/https?:|nav\/|menus\//.test(guardado), "no debe guardarse ninguna URL ni token");
});

test("la fecha de la última carga se muestra en local como dd/mm/aaaa hh:mm (S7)", () => {
  assert.equal(Carga.formatearFecha(new Date(2025, 10, 27, 9, 5).toISOString()), "27/11/2025 09:05");
  assert.equal(Carga.formatearFecha(new Date(2026, 0, 3, 18, 0).toISOString()), "03/01/2026 18:00");
  assert.equal(
    Carga.textoCargadoEl(new Date(2025, 10, 27, 9, 5).toISOString()),
    "Datos cargados el 27/11/2025 09:05"
  );
  assert.equal(Carga.formatearFecha(""), "");
  assert.equal(Carga.formatearFecha("no es una fecha"), "");
});

test("cada elemento anuncia su progreso en español, con ✔ listo y ✖ error (S7, RU-04)", () => {
  assert.deepEqual(Carga.progresoInicial(), [
    { id: "grupos", nombre: "Grupos de alumnos/as", estado: "pendiente", error: "" },
  ]);

  const lineas = Carga.lineasDeProgreso([
    { id: "uno", nombre: "Grupos de alumnos/as", estado: "pendiente", error: "" },
    { id: "dos", nombre: "Otro dato", estado: "cargando", error: "" },
    { id: "tres", nombre: "Tercer dato", estado: "listo", error: "" },
    { id: "cuatro", nombre: "Cuarto dato", estado: "error", error: "No se pudo pedir la pantalla." },
  ]);

  assert.deepEqual(lineas.map((l) => l.texto), [
    "Grupos de alumnos/as: pendiente",
    "Otro dato: cargando…",
    "Tercer dato: ✔ listo",
    "Cuarto dato: ✖ error. No se pudo pedir la pantalla.",
  ]);
  assert.deepEqual(lineas.map((l) => l.estado), ["pendiente", "cargando", "listo", "error"]);
});

test("el panel de primer uso se titula «Preparar la extensión» y lo explica en dos frases (S7)", () => {
  assert.equal(Carga.TITULO_PRIMER_USO, "Preparar la extensión");
  assert.equal(Carga.TEXTO_CARGAR, "Cargar datos");
  assert.equal(Carga.TEXTO_REINTENTAR, "Reintentar");
  assert.equal(Carga.TEXTO_ACTUALIZAR, "Actualizar datos");
  assert.equal(Carga.TEXTO_OLVIDAR, "Olvidar todo");

  const frases = Carga.EXPLICACION_PRIMER_USO.split(". ").filter((f) => f.trim() !== "");
  assert.equal(frases.length, 2);
  assert.match(Carga.EXPLICACION_PRIMER_USO, /Séneca/);
  assert.match(Carga.EXPLICACION_PRIMER_USO, /este navegador/);
});

test("los elementos que fallan se nombran para poder reintentar (S7, RU-04)", () => {
  const carga = {
    version: Carga.VERSION,
    cargadoEl: RELOJ().toISOString(),
    elementos: {
      grupos: { ok: false, datos: {}, avisos: [], error: "No encuentro el menú «Grupos de alumnos/as»." },
    },
  };

  assert.deepEqual(Carga.fallosDeCarga(carga), [
    { id: "grupos", nombre: "Grupos de alumnos/as", error: "No encuentro el menú «Grupos de alumnos/as»." },
  ]);
  assert.equal(
    Carga.textoFallos(Carga.fallosDeCarga(carga)),
    "No se pudo cargar Grupos de alumnos/as (No encuentro el menú «Grupos de alumnos/as»)."
  );
  assert.deepEqual(Carga.fallosDeCarga(null), []);
  // Un elemento que no llegó a guardarse también se nombra para reintentarlo.
  assert.deepEqual(Carga.fallosDeCarga({ version: Carga.VERSION, cargadoEl: "", elementos: {} }), [
    { id: "grupos", nombre: "Grupos de alumnos/as", error: "" },
  ]);
  assert.equal(Carga.textoFallos([{ id: "grupos", nombre: "Grupos de alumnos/as", error: "" }]), "No se pudo cargar Grupos de alumnos/as.");
  assert.equal(Carga.textoFallos([]), "");
});

// --- T9: datos incompletos o de otra versión y cargas que fallan ---

function cargaCompleta(cargadoEl) {
  return {
    version: Carga.VERSION,
    cargadoEl,
    elementos: {
      grupos: {
        ok: true,
        datos: { grupos: [{ grupo: "1BACA", materia: "TECN1", alumnos: 26, etiqueta: "1BACA - TECN1" }] },
        avisos: [],
        error: "",
      },
    },
  };
}

function cargaFallida(mensaje) {
  return {
    version: Carga.VERSION,
    cargadoEl: "2025-11-27T10:30:00.000Z",
    elementos: {
      grupos: { ok: false, datos: {}, avisos: [], error: mensaje },
    },
  };
}

test("«Olvidar todo» se ofrece siempre que haya algo guardado, aunque esté incompleto o sea de otra versión (RP-08, T9)", () => {
  assert.equal(Carga.hayDatosQueOlvidar(null), false);
  assert.equal(Carga.hayDatosQueOlvidar(undefined), false);

  assert.equal(Carga.hayDatosQueOlvidar(cargaCompleta(RELOJ().toISOString())), true);
  assert.equal(Carga.hayDatosQueOlvidar(cargaFallida("No encuentro el menú.")), true);
  assert.equal(Carga.hayDatosQueOlvidar({ version: Carga.VERSION, cargadoEl: "", elementos: {} }), true);
  // Una carga de una versión anterior del formato también se puede olvidar.
  assert.equal(Carga.hayDatosQueOlvidar({ ...cargaCompleta(RELOJ().toISOString()), version: Carga.VERSION - 1 }), true);
});

test("si falla «Actualizar datos», se conservan los datos buenos anteriores y se dice qué falló y de cuándo son (T9)", async () => {
  const anterior = cargaCompleta(RELOJ().toISOString());
  const nueva = cargaFallida("No encuentro el menú «Grupos de alumnos/as».");

  // Almacén inyectado: reproduce chrome.storage.local sin tocar el navegador.
  let guardado = anterior;
  let escrituras = 0;

  const resultado = await Carga.aplicarCarga({
    anterior,
    nueva,
    guardar: async (carga) => {
      escrituras += 1;
      guardado = carga;
    },
  });

  // Lo guardado no se toca y se sigue pudiendo usar (menú y Alumnado).
  assert.equal(escrituras, 0);
  assert.equal(guardado, anterior);
  assert.equal(resultado.carga, anterior);
  assert.equal(Carga.estaCompleta(resultado.carga), true);
  assert.deepEqual(resultado.carga.elementos.grupos.datos.grupos, [
    { grupo: "1BACA", materia: "TECN1", alumnos: 26, etiqueta: "1BACA - TECN1" },
  ]);

  // Se explica qué falló y cuándo se cargaron los datos que se mantienen.
  assert.equal(resultado.conservada, true);
  assert.equal(
    resultado.aviso,
    "No se pudo cargar Grupos de alumnos/as (No encuentro el menú «Grupos de alumnos/as»). " +
      "Se mantienen los datos cargados el 27/11/2025 09:05."
  );
});

test("una carga nueva que no llega a ejecutarse tampoco borra los datos buenos anteriores (T9)", async () => {
  const anterior = cargaCompleta(RELOJ().toISOString());
  let guardado = anterior;

  const resultado = await Carga.aplicarCarga({
    anterior,
    nueva: null,
    guardar: async (carga) => {
      guardado = carga;
    },
  });

  assert.equal(guardado, anterior);
  assert.equal(resultado.carga, anterior);
  assert.equal(resultado.conservada, true);
  assert.equal(
    resultado.aviso,
    "No se ha podido completar la carga de datos. Vuelve a intentarlo. " +
      "Se mantienen los datos cargados el 27/11/2025 09:05."
  );

  // También cuando lo guardado era un intento incompleto: no se inventa nada,
  // pero se sigue sabiendo que hay datos que se pueden olvidar (RP-08, T9).
  const incompleta = cargaFallida("No encuentro el menú.");
  const segunda = await Carga.aplicarCarga({
    anterior: incompleta,
    nueva: null,
    guardar: async () => {
      assert.fail("no debe guardarse nada cuando la carga no llegó a ejecutarse");
    },
  });
  assert.equal(segunda.carga, incompleta);
  assert.equal(segunda.conservada, false);
  assert.equal(segunda.aviso, "");
  assert.equal(Carga.hayDatosQueOlvidar(segunda.carga), true);
});

test("si es la primera carga y falla, el fallo se guarda como hasta ahora para poder reintentar (T9)", async () => {
  const nueva = cargaFallida("Séneca respondió con un error (HTTP 500).");

  let guardado = null;
  const resultado = await Carga.aplicarCarga({
    anterior: null,
    nueva,
    guardar: async (carga) => {
      guardado = carga;
    },
  });

  assert.equal(guardado, nueva);
  assert.equal(resultado.carga, nueva);
  assert.equal(resultado.conservada, false);
  assert.equal(resultado.aviso, "");
  assert.deepEqual(Carga.fallosDeCarga(resultado.carga), [
    { id: "grupos", nombre: "Grupos de alumnos/as", error: "Séneca respondió con un error (HTTP 500)." },
  ]);
  assert.equal(Carga.estaCompleta(resultado.carga), false);
});

test("una carga nueva completa sustituye a la anterior, buena o incompleta (T9)", async () => {
  for (const anterior of [null, cargaFallida("No encuentro el menú."), cargaCompleta("2025-10-01T08:00:00.000Z")]) {
    const nueva = cargaCompleta("2025-11-27T10:30:00.000Z");
    let guardado = anterior;

    const resultado = await Carga.aplicarCarga({
      anterior,
      nueva,
      guardar: async (carga) => {
        guardado = carga;
      },
    });

    assert.equal(guardado, nueva);
    assert.equal(resultado.carga, nueva);
    assert.equal(resultado.conservada, false);
    assert.equal(resultado.aviso, "");
  }
});

test("«Olvidar todo» borra el almacén, vacía la memoria y lo confirma (RP-08, S7)", async () => {
  let borrados = 0;

  const resultado = await Carga.olvidar({
    borrar: async () => {
      borrados += 1;
    },
  });

  assert.equal(borrados, 1);
  assert.deepEqual(resultado, {
    carga: null,
    seleccion: "",
    primeraVez: true,
    mensaje: "Se han borrado los datos guardados en este navegador.",
  });
  assert.equal(Carga.MENSAJE_OLVIDADO, "Se han borrado los datos guardados en este navegador.");
  // Tras olvidar, el panel vuelve al primer uso.
  assert.equal(Carga.estaCompleta(resultado.carga), false);
  assert.match(Carga.MENSAJE_SIN_BORRAR, /No se han podido borrar/);
  assert.match(Carga.MENSAJE_SIN_GUARDAR, /No se han podido guardar/);
});
