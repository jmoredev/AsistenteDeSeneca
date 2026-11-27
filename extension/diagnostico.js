"use strict";

// T7 live diagnostic (S5, S6 of odd/tasks/informes-alumnado-grupo.md).
// Finds the «Materias que imparte» menu link by its visible text, fetches that
// screen in the background from the same Seneca page (same origin, session
// cookie) and paints the report only in this popup. Every request is checked
// against Seneca's origin first; nothing is sent anywhere else and the
// teacher's page is never modified.

(function (raiz) {
  const TEXTO_ENLACE = "Materias que imparte";
  const MAX_SALTOS = 2;
  const ESPERA_MS = 20000;

  // Injected into every frame of the Seneca tab. Must be self-contained.
  function localizarEnlace(texto) {
    const enlace = Array.from(document.querySelectorAll("a")).find(
      (a) => a.textContent.replace(/\s+/g, " ").trim() === texto
    );
    if (!enlace) return null;
    return {
      menulink: enlace.getAttribute("data-menulink"),
      href: enlace.getAttribute("href"),
      base: document.baseURI,
    };
  }

  // Injected into the frame holding the link: one background GET with a
  // timeout, plus the visible state of the page before and after.
  // Must be self-contained.
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

  const limpiar = (t) => String(t || "").replace(/\s+/g, " ").trim();

  function destinoDe(enlace) {
    const crudo = enlace.menulink || (enlace.href && enlace.href !== "#" ? enlace.href : "");
    if (!crudo) return "";
    try {
      return new URL(crudo, enlace.base).href;
    } catch (e) {
      return "";
    }
  }

  function leerTabla(doc) {
    const texto = (celda) => raiz.DiagnosticoAnalisis.textoVisible(celda.innerHTML);
    const tabla = doc.querySelector("table.TableData");
    if (!tabla) return null;
    let cabeceras = Array.from(tabla.querySelectorAll("thead th")).map(texto);
    if (cabeceras.length === 0) {
      const primera = tabla.querySelector("tr");
      cabeceras = primera ? Array.from(primera.querySelectorAll("th")).map(texto) : [];
    }
    const filas = Array.from(tabla.querySelectorAll("tr"))
      .map((tr) => Array.from(tr.querySelectorAll("td")).map(texto))
      .filter((celdas) => celdas.length > 0);
    return { cabeceras, filas };
  }

  function informarExtraccion(html, decir) {
    const { enmascarar, analizarFilas } = raiz.DiagnosticoAnalisis;
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.querySelector('input[type="password"]')) {
      decir("✖ La respuesta es la pantalla de acceso: no se reconoció tu sesión.");
      return;
    }
    const tabla = leerTabla(doc);
    if (!tabla) {
      const h1 = doc.querySelector("h1");
      decir(
        `✖ No aparece la tabla de datos. Título: «${enmascarar(limpiar(doc.title))}»; ` +
          `h1: «${enmascarar(limpiar(h1 && h1.textContent))}».`
      );
      return;
    }
    const analisis = analizarFilas(tabla.cabeceras, tabla.filas);
    if (analisis.error) {
      decir(`✖ ${analisis.error}`);
      return;
    }
    decir(`3. Extraído (${analisis.filas.length} filas):`);
    for (const f of analisis.filas) {
      if (f.error) decir(`   ✖ Fila ${f.fila}: ${f.error}`);
      else
        decir(
          `   ${f.coincide ? "✔" : "⚠"} ${f.grupo} - ${f.materia} (${f.alumnos} alumnos)` +
            `${f.coincide ? "" : " · la materia no coincide con «Alumnado de»"}`
        );
    }
  }

  async function ejecutar(tabId, salida) {
    const { enmascarar, urlPermitida, siguienteSalto } = raiz.DiagnosticoAnalisis;
    const lineas = [];
    const decir = (t) => {
      lineas.push(t);
      salida.textContent = lineas.join("\n");
    };

    try {
      decir(`1. Busco el enlace «${TEXTO_ENLACE}» en la página…`);
      const marcos = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: localizarEnlace,
        args: [TEXTO_ENLACE],
      });
      const encontrados = marcos.filter((m) => m.result);
      if (encontrados.length === 0) {
        decir(`✖ No encuentro «${TEXTO_ENLACE}». Entra en una pantalla de Séneca con el menú lateral y repite.`);
        return;
      }
      const utilizable = encontrados.find((m) => destinoDe(m.result));
      if (!utilizable) {
        decir(`✖ Hay ${encontrados.length} enlaces, pero ninguno tiene destino (ni data-menulink ni href).`);
        return;
      }
      if (encontrados.length > 1) decir(`⚠ Aparece en ${encontrados.length} marcos; uso el primero con destino.`);
      const { frameId, result: enlace } = utilizable;
      decir(`   Marco ${frameId}; data-menulink=${enmascarar(enlace.menulink)} href=${enmascarar(enlace.href)}`);

      decir("2. Pido la pantalla en segundo plano (GET, mismo origen)…");
      let url = destinoDe(enlace);
      let primeraVista = null;
      let ultimaVista = null;
      let html = "";
      for (let i = 1; url && i <= MAX_SALTOS; i += 1) {
        if (!urlPermitida(url)) {
          decir(`✖ Salto ${i} bloqueado: ${enmascarar(url)} no es Séneca. No se ha pedido.`);
          html = "";
          break;
        }
        const [{ result: sonda }] = await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: sondear,
          args: [url, ESPERA_MS],
        });
        primeraVista = primeraVista || sonda.antes;
        ultimaVista = sonda.despues;
        if (sonda.error) {
          decir(`✖ Salto ${i}: ${enmascarar(url)}\n     Error en la petición: ${enmascarar(sonda.error)}`);
          html = "";
          break;
        }
        const s = sonda.salto;
        decir(
          `   Salto ${i}: HTTP ${s.estado} · ${s.tipo || "sin tipo"} · ${s.bytes} bytes` +
            `${s.redirigida ? " · redirigida" : ""}\n     ${enmascarar(url)}\n     → ${enmascarar(s.final)}`
        );
        if (!urlPermitida(s.final)) {
          decir("✖ La respuesta terminó fuera de Séneca: se descarta.");
          html = "";
          break;
        }
        html = s.html;
        if (!s.ok) break;
        url = siguienteSalto(html, s.final);
      }

      if (html) informarExtraccion(html, decir);

      if (primeraVista && ultimaVista) {
        const igual =
          primeraVista.url === ultimaVista.url &&
          primeraVista.historial === ultimaVista.historial &&
          primeraVista.titulo === ultimaVista.titulo;
        decir(igual ? "4. ✔ Tu pantalla no ha cambiado." : "4. ✖ Tu pantalla ha cambiado durante la prueba.");
      }
      decir(
        "5. Comprobación manual: en Séneca pulsa «Volver» o abre otra opción del menú " +
          "y confirma que todo sigue como esperabas."
      );
    } catch (e) {
      decir(`✖ Error del diagnóstico: ${enmascarar((e && e.message) || e)}`);
    }
  }

  raiz.Diagnostico = { ejecutar };
})(globalThis);
