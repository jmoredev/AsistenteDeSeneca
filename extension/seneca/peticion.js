"use strict";

// Una sola implementación de la petición en segundo plano a Séneca (S3, S5 y
// S6 de odd/tasks/informes-alumnado-grupo.md). La usan el diagnóstico (T7) y
// el selector «Grupo - Materia» (T5): localiza el enlace del menú por su texto
// visible, pide la pantalla con GET desde la propia página (mismo origen, con
// la cookie de sesión) y devuelve su HTML. Nunca navega la pestaña del
// docente, nunca toca su DOM y nada sale del navegador.
//
// Salvaguardas, todas obligatorias: solo el origen de Séneca (antes de cada
// petición y sobre la URL final), solo marcos cuyo documento es del origen de
// Séneca (ni la búsqueda del enlace ni la sonda se ejecutan en marcos de otra
// web incrustados en la pestaña, S8.1), 2 saltos como máximo, 20 s de espera,
// decodificación Windows-1252 y ningún destino fuera de Séneca.

(function (raiz) {
  const analisis =
    typeof module === "object" && module.exports && typeof require === "function"
      ? require("../diagnostico-analisis.js")
      : raiz.DiagnosticoAnalisis;

  const TEXTO_ENLACE_GRUPOS = "Grupos de alumnos/as";
  const MAX_SALTOS = 2;
  const ESPERA_MS = 20000;

  const ERROR_INESPERADO =
    "No se pudo completar la petición en segundo plano. Comprueba que Séneca sigue abierto y vuelve a intentarlo.";

  function avisoDeRed(motivo) {
    return `No se pudo pedir la pantalla de Séneca (${motivo}). Comprueba tu conexión y vuelve a intentarlo.`;
  }

  function avisoDeEstado(estado) {
    return `Séneca respondió con un error (HTTP ${estado}). Vuelve a intentarlo dentro de un momento.`;
  }

  function errorMarcoAjeno(textoEnlace) {
    return (
      `Solo encuentro el menú «${textoEnlace}» en marcos que no son de Séneca, así que no se ha pedido nada. ` +
      "Abre la pantalla en la pestaña de Séneca y vuelve a intentarlo."
    );
  }

  // --- Funciones inyectadas en la página: autosuficientes, chrome.scripting
  // las serializa y no ven este módulo. ---

  // Busca el enlace del menú por su texto visible en cada marco y devuelve
  // también el origen de su propio documento (S8.1): así la selección de marco
  // descarta los marcos de otra web.
  function localizarEnlace(texto) {
    const enlace = Array.from(document.querySelectorAll("a")).find(
      (a) => a.textContent.replace(/\s+/g, " ").trim() === texto
    );
    if (!enlace) return null;
    return {
      menulink: enlace.getAttribute("data-menulink"),
      href: enlace.getAttribute("href"),
      base: document.baseURI,
      origin: location.origin,
    };
  }

  // Un GET en segundo plano con límite de tiempo y la vista antes y después.
  async function sondear(url, esperaMs) {
    const vista = () => ({ url: location.href, historial: history.length, titulo: document.title });
    const antes = vista();
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), esperaMs);
    try {
      const r = await fetch(url, { credentials: "include", cache: "no-store", signal: control.signal });
      const bytes = await r.arrayBuffer();
      return {
        antes,
        despues: vista(),
        salto: {
          final: r.url,
          estado: r.status,
          ok: r.ok,
          redirigida: r.redirected,
          tipo: r.headers.get("content-type") || "",
          bytes: bytes.byteLength,
          html: new TextDecoder("windows-1252").decode(bytes),
        },
      };
    } catch (e) {
      const motivo = e && e.name === "AbortError" ? `sin respuesta en ${esperaMs / 1000} s` : (e && e.message) || e;
      return { antes, despues: vista(), error: String(motivo) };
    } finally {
      clearTimeout(reloj);
    }
  }

  // --- Partes puras: las mismas corren en el panel y en los tests de Node ---

  function origenPermitido(url) {
    return analisis.urlPermitida(url);
  }

  // Dirección del enlace: data-menulink manda; href solo si no es «#».
  function destinoDe(enlace) {
    const crudo = enlace.menulink || (enlace.href && enlace.href !== "#" ? enlace.href : "");
    if (!crudo) return "";
    try {
      return new URL(crudo, enlace.base).href;
    } catch (e) {
      return "";
    }
  }

  // Qué hacer con una respuesta: si acabó fuera de Séneca se descarta; con un
  // error HTTP se conserva el cuerpo (el diagnóstico lo informa) pero no se
  // sigue saltando; si es correcta, como mucho un salto inequívoco.
  function evaluarSalto(salto) {
    if (!origenPermitido(salto.final)) return { valida: false, motivo: "fuera-de-seneca", siguiente: null };
    if (!salto.ok) return { valida: true, motivo: "http", siguiente: null };
    return { valida: true, motivo: null, siguiente: analisis.siguienteSalto(salto.html || "", salto.final) };
  }

  // Marcos que contienen el enlace, separados por el origen de su documento
  // (S8.1): solo los del origen de Séneca pueden elegirse para lanzar la
  // petición, y de ellos el primero con destino.
  function elegirMarco(resultados) {
    const conEnlace = (resultados || []).filter((m) => m && m.result);
    const propios = conEnlace.filter((m) => origenPermitido(m.result.origin));
    const ajenos = conEnlace.filter((m) => !origenPermitido(m.result.origin));
    return { propios, ajenos, utilizable: propios.find((m) => destinoDe(m.result)) || null };
  }

  // Cada paso, tal y como lo muestra el informe del diagnóstico en el panel.
  function textoDePaso(paso) {
    switch (paso.tipo) {
      case "buscando":
        return `1. Busco el enlace «${paso.texto}» en la página…`;
      case "sin-enlace":
        return `✖ No encuentro «${paso.texto}». Entra en una pantalla de Séneca con el menú lateral y repite.`;
      case "marco-ajeno":
        return `✖ Solo encuentro «${paso.texto}» en marcos que no son de Séneca; no se ha pedido nada.`;
      case "sin-destino":
        return `✖ Hay ${paso.cuantos} enlaces, pero ninguno tiene destino (ni data-menulink ni href).`;
      case "varios-marcos":
        return `⚠ Aparece en ${paso.cuantos} marcos; uso el primero con destino.`;
      case "marco":
        return (
          `   Marco ${paso.frameId}; data-menulink=${analisis.enmascarar(paso.menulink)}` +
          ` href=${analisis.enmascarar(paso.href)}`
        );
      case "pidiendo":
        return "2. Pido la pantalla en segundo plano (GET, mismo origen)…";
      case "salto-bloqueado":
        return `✖ Salto ${paso.numero} bloqueado: ${analisis.enmascarar(paso.url)} no es Séneca. No se ha pedido.`;
      case "salto-error":
        return (
          `✖ Salto ${paso.numero}: ${analisis.enmascarar(paso.url)}` +
          `\n     Error en la petición: ${analisis.enmascarar(paso.motivo)}`
        );
      case "salto":
        return (
          `   Salto ${paso.numero}: HTTP ${paso.estado} · ${paso.contentType || "sin tipo"} · ${paso.bytes} bytes` +
          `${paso.redirigida ? " · redirigida" : ""}` +
          `\n     ${analisis.enmascarar(paso.url)}` +
          `\n     → ${analisis.enmascarar(paso.final)}`
        );
      case "fuera-de-seneca":
        return "✖ La respuesta terminó fuera de Séneca: se descarta.";
      default:
        return "";
    }
  }

  // --- Orquestación (necesita chrome.scripting) ---

  // Devuelve { ok, html, frameId, pasos, vistaIntacta, motivo, error }.
  // `alPaso(paso)` recibe cada paso según ocurre (el diagnóstico lo imprime).
  async function obtenerPantalla(tabId, textoEnlace, opciones) {
    const alPaso = (opciones && opciones.alPaso) || function () {};
    const pasos = [];
    const avisar = (paso) => {
      pasos.push(paso);
      alPaso(paso);
    };

    const resultado = { ok: true, html: "", frameId: null, pasos, vistaIntacta: null, motivo: null, error: null };
    const fallar = (motivo, error) => {
      resultado.ok = false;
      resultado.motivo = motivo;
      resultado.error = error;
      resultado.html = "";
      return resultado;
    };

    avisar({ tipo: "buscando", texto: textoEnlace });
    const marcos = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: localizarEnlace,
      args: [textoEnlace],
    });
    const { propios, ajenos, utilizable } = elegirMarco(marcos);
    if (propios.length === 0 && ajenos.length === 0) {
      avisar({ tipo: "sin-enlace", texto: textoEnlace });
      return fallar(
        "sin-enlace",
        `No encuentro el menú «${textoEnlace}». Abre una pantalla de Séneca con el menú lateral y vuelve a intentarlo.`
      );
    }
    if (!utilizable) {
      // El enlace aparece, pero solo en marcos de otra web (S8.1): ninguno de
      // ellos puede dirigir una petición con la sesión del docente. No se pide
      // nada.
      if (propios.length === 0) {
        avisar({ tipo: "marco-ajeno", texto: textoEnlace });
        return fallar("marco-ajeno", errorMarcoAjeno(textoEnlace));
      }
      avisar({ tipo: "sin-destino", cuantos: propios.length });
      return fallar(
        "sin-destino",
        `Encontré «${textoEnlace}», pero su enlace no lleva a ninguna dirección de Séneca.`
      );
    }
    if (propios.length > 1) avisar({ tipo: "varios-marcos", cuantos: propios.length });

    const { frameId, result: enlace } = utilizable;
    resultado.frameId = frameId;
    avisar({ tipo: "marco", frameId, menulink: enlace.menulink, href: enlace.href });

    avisar({ tipo: "pidiendo" });
    let url = destinoDe(enlace);
    let vista = null;
    for (let i = 1; url && i <= MAX_SALTOS; i += 1) {
      if (!origenPermitido(url)) {
        avisar({ tipo: "salto-bloqueado", numero: i, url });
        return fallar(
          "bloqueado",
          "La dirección a la que apunta «Grupos de alumnos/as» no es de Séneca; no se ha pedido nada."
        );
      }
      const [{ result: sonda }] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func: sondear,
        args: [url, ESPERA_MS],
      });
      vista = vista || { antes: sonda.antes };
      vista.despues = sonda.despues;
      if (sonda.error) {
        avisar({ tipo: "salto-error", numero: i, url, motivo: sonda.error });
        resultado.vistaIntacta = vistaIntacta(vista);
        return fallar("red", avisoDeRed(sonda.error));
      }
      const s = sonda.salto;
      avisar({
        tipo: "salto",
        numero: i,
        url,
        estado: s.estado,
        contentType: s.tipo,
        bytes: s.bytes,
        redirigida: s.redirigida,
        final: s.final,
      });
      const decision = evaluarSalto(s);
      if (!decision.valida) {
        avisar({ tipo: "fuera-de-seneca" });
        resultado.vistaIntacta = vistaIntacta(vista);
        return fallar(
          "fuera-de-seneca",
          "La respuesta llegó desde fuera de Séneca; se ha descartado y no se ha leído nada."
        );
      }
      resultado.html = s.html;
      if (decision.motivo === "http") {
        resultado.vistaIntacta = vistaIntacta(vista);
        resultado.ok = false;
        resultado.motivo = "http";
        resultado.error = avisoDeEstado(s.estado);
        return resultado;
      }
      url = decision.siguiente;
    }

    resultado.vistaIntacta = vista ? vistaIntacta(vista) : null;
    return resultado;
  }

  function vistaIntacta(vista) {
    return (
      vista.antes.url === vista.despues.url &&
      vista.antes.historial === vista.despues.historial &&
      vista.antes.titulo === vista.despues.titulo
    );
  }

  const api = {
    TEXTO_ENLACE_GRUPOS,
    MAX_SALTOS,
    ESPERA_MS,
    ERROR_INESPERADO,
    origenPermitido,
    destinoDe,
    evaluarSalto,
    elegirMarco,
    textoDePaso,
    obtenerPantalla,
    localizarEnlace,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.SenecaPeticion = api;
})(globalThis);
