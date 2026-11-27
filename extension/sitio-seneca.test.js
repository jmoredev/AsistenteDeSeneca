"use strict";

// Detección de Séneca en el panel (RF-01 de REQUISITOS.md y T9 de
// odd/tasks/informes-alumnado-grupo.md): solo el host de Séneca y lectura de la
// pestaña activa sin errores sin capturar. Código puro: `chrome.tabs.query` se
// inyecta, así que estas pruebas corren en Node.
// Ejecutar: npm test

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  HOST_SENECA,
  MENSAJE_NO_SENECA,
  AYUDA_NO_SENECA,
  MENSAJE_SIN_PESTANA,
  AYUDA_SIN_PESTANA,
  esUrlSeneca,
  leerPestanaActiva,
} = require("./sitio-seneca.js");

const SENECA = "https://seneca.juntadeandalucia.es/seneca/jsp/portal/";

test("solo se acepta el host de Séneca en https: ni otros hosts de la Junta, ni http, ni dominios que solo lo parecen (T9)", () => {
  assert.equal(HOST_SENECA, "seneca.juntadeandalucia.es");

  assert.equal(esUrlSeneca(SENECA), true);
  assert.equal(esUrlSeneca("https://seneca.juntadeandalucia.es/"), true);
  assert.equal(esUrlSeneca("https://seneca.juntadeandalucia.es"), true);
  assert.equal(esUrlSeneca("https://SENECA.juntadeandalucia.es/seneca/nav/x"), true);

  // Otros servicios de la Junta de Andalucía quedan fuera.
  assert.equal(esUrlSeneca("https://www.juntadeandalucia.es/"), false);
  assert.equal(esUrlSeneca("https://juntadeandalucia.es/seneca/"), false);
  assert.equal(esUrlSeneca("https://otra.juntadeandalucia.es/seneca/jsp/portal/"), false);
  assert.equal(esUrlSeneca("https://seneca.juntadeandalucia.es.ejemplo.com/seneca/"), false);

  // Sin cifrar no se acepta.
  assert.equal(esUrlSeneca("http://seneca.juntadeandalucia.es/seneca/jsp/portal/"), false);

  // Parecidos que intentan colarse con el host en otro sitio de la dirección.
  assert.equal(esUrlSeneca("https://seneca.juntadeandalucia.es@ejemplo.com/seneca/"), false);
  assert.equal(esUrlSeneca("https://falsoseneca.juntadeandalucia.es/seneca/"), false);
  assert.equal(esUrlSeneca("https://seneca.juntadeandalucia.es.evil.example/seneca/"), false);
  assert.equal(esUrlSeneca("https://ejemplo.com/?url=https://seneca.juntadeandalucia.es/"), false);

  // Lo que no es una dirección no se acepta.
  assert.equal(esUrlSeneca(""), false);
  assert.equal(esUrlSeneca(null), false);
  assert.equal(esUrlSeneca(undefined), false);
  assert.equal(esUrlSeneca("no es una dirección"), false);
  assert.equal(esUrlSeneca("chrome://extensions"), false);
});

test("la pestaña activa se lee con la consulta inyectada: su dirección y la pestaña completa (T9)", async () => {
  const pestana = { id: 7, url: SENECA, active: true };

  const leida = await leerPestanaActiva(async () => [pestana]);

  assert.deepEqual(leida, { ok: true, pestana, url: SENECA, mensaje: "", ayuda: "" });
  assert.equal(esUrlSeneca(leida.url), true);

  // Una pestaña fuera de Séneca se lee igual: quien decide es `esUrlSeneca`.
  const fuera = await leerPestanaActiva(async () => [{ id: 8, url: "https://ejemplo.com/" }]);
  assert.equal(fuera.ok, true);
  assert.equal(esUrlSeneca(fuera.url), false);
});

test("si la consulta de pestañas falla o no trae pestaña ni dirección, se explica en español y no se lanza nada (T9, RF-24)", async () => {
  const casos = {
    "la consulta falla": async () => {
      throw new Error("tabs.query is not available");
    },
    "la consulta devuelve nada": async () => undefined,
    "la consulta devuelve una lista vacía": async () => [],
    "la pestaña no trae dirección": async () => [{ id: 7, active: true }],
    "la dirección viene vacía": async () => [{ id: 7, url: "" }],
    "la dirección no es texto": async () => [{ id: 7, url: 42 }],
    "lo devuelto no es una pestaña": async () => ["no es una pestaña"],
  };

  for (const [caso, consultar] of Object.entries(casos)) {
    const leida = await leerPestanaActiva(consultar);
    assert.equal(leida.ok, false, caso);
    assert.equal(leida.pestana, null, caso);
    assert.equal(leida.url, "", caso);
    assert.equal(leida.mensaje, MENSAJE_SIN_PESTANA, caso);
    assert.equal(leida.ayuda, AYUDA_SIN_PESTANA, caso);
  }
});

test("los mensajes de la detección están en español llano y no muestran nada técnico (RU-01, RF-24)", () => {
  assert.equal(MENSAJE_NO_SENECA, "La extensión solo funciona dentro de Séneca.");
  assert.equal(
    AYUDA_NO_SENECA,
    "Abre Séneca (seneca.juntadeandalucia.es) con tu sesión iniciada y pulsa de nuevo este botón."
  );
  assert.equal(MENSAJE_SIN_PESTANA, "No se ha podido leer la pestaña activa.");
  assert.equal(
    AYUDA_SIN_PESTANA,
    "Cierra este panel, abre Séneca (seneca.juntadeandalucia.es) con tu sesión iniciada y vuelve a pulsar el icono de la extensión."
  );

  for (const mensaje of [MENSAJE_NO_SENECA, AYUDA_NO_SENECA, MENSAJE_SIN_PESTANA, AYUDA_SIN_PESTANA]) {
    assert.equal(/error|null|undefined|chrome\./i.test(mensaje), false);
  }
  // Cada aviso va con una ayuda que dice qué hacer y nombra Séneca o el panel.
  for (const ayuda of [AYUDA_NO_SENECA, AYUDA_SIN_PESTANA]) {
    assert.match(ayuda, /Séneca|panel/);
  }
});
