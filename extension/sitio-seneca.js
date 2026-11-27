"use strict";

// Detección de Séneca en el panel (RF-01 de REQUISITOS.md y T9 de
// odd/tasks/informes-alumnado-grupo.md). Dos reglas, en funciones puras para
// poder probarlas en Node:
//
// 1. Solo el host de Séneca: ni el resto de `juntadeandalucia.es`, ni http, ni
//    un dominio que solo lo parezca. Es el mismo host del manifiesto
//    (`host_permissions`), así que lo que el panel considera Séneca y lo que el
//    navegador permite leer coinciden.
// 2. Leer la pestaña activa sin dejar errores sin capturar: si `chrome.tabs.query`
//    falla o no devuelve pestaña o dirección, se explica en español (RF-24) en
//    vez de mostrar un fallo técnico. `chrome.tabs.query` se inyecta, así que
//    este archivo no toca `chrome.*`.

(function (raiz) {
  const HOST_SENECA = "seneca.juntadeandalucia.es";

  const MENSAJE_NO_SENECA = "La extensión solo funciona dentro de Séneca.";
  const AYUDA_NO_SENECA =
    "Abre Séneca (seneca.juntadeandalucia.es) con tu sesión iniciada y pulsa de nuevo este botón.";

  const MENSAJE_SIN_PESTANA = "No se ha podido leer la pestaña activa.";
  const AYUDA_SIN_PESTANA =
    "Cierra este panel, abre Séneca (seneca.juntadeandalucia.es) con tu sesión iniciada " +
    "y vuelve a pulsar el icono de la extensión.";

  // Dirección de una pantalla de Séneca: https y el host exacto. `host`
  // incluye el puerto, así que un puerto distinto del normal tampoco pasa.
  function esUrlSeneca(url) {
    if (typeof url !== "string" || url === "") return false;
    let direccion;
    try {
      direccion = new URL(url);
    } catch (e) {
      return false;
    }
    return direccion.protocol === "https:" && direccion.host === HOST_SENECA;
  }

  function sinPestana() {
    return {
      ok: false,
      pestana: null,
      url: "",
      mensaje: MENSAJE_SIN_PESTANA,
      ayuda: AYUDA_SIN_PESTANA,
    };
  }

  // Lee la pestaña activa con la consulta inyectada (en el panel,
  // `() => chrome.tabs.query({ active: true, currentWindow: true })`).
  // Devuelve siempre { ok, pestana, url, mensaje, ayuda }: nunca lanza.
  async function leerPestanaActiva(consultar) {
    let pestanas = null;
    try {
      pestanas = await consultar();
    } catch (e) {
      return sinPestana();
    }
    const pestana = Array.isArray(pestanas) && pestanas.length > 0 ? pestanas[0] : null;
    if (!pestana || typeof pestana !== "object") return sinPestana();
    const url = typeof pestana.url === "string" ? pestana.url : "";
    if (url === "") return sinPestana();
    return { ok: true, pestana, url, mensaje: "", ayuda: "" };
  }

  const api = {
    HOST_SENECA,
    MENSAJE_NO_SENECA,
    AYUDA_NO_SENECA,
    MENSAJE_SIN_PESTANA,
    AYUDA_SIN_PESTANA,
    esUrlSeneca,
    leerPestanaActiva,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.SitioSeneca = api;
})(globalThis);
