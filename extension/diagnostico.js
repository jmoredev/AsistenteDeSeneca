"use strict";

// T7 live diagnostic (S5, S6 of odd/tasks/informes-alumnado-grupo.md).
// Finds the «Materias que imparte» menu link by its visible text, fetches that
// screen in the background from the same Seneca page (same origin, session
// cookie) and paints the report only in this popup. Nothing is sent anywhere
// else and the teacher's page is never modified.

(function (raiz) {
  const TEXTO_ENLACE = "Materias que imparte";

  // Injected into every frame of the Seneca tab. Must be self-contained.
  function localizarEnlace(texto) {
    const enlace = Array.from(document.querySelectorAll("a")).find(
      (a) => a.textContent.replace(/\s+/g, " ").trim() === texto
    );
    if (!enlace) return null;
    return { menulink: enlace.getAttribute("data-menulink"), href: enlace.getAttribute("href") };
  }

  // Injected into the frame holding the link. Background GET only; follows at
  // most one unambiguous extra hop. Must be self-contained.
  async function sondear(destino) {
    const vista = () => ({ url: location.href, historial: history.length, titulo: document.title });
    const antes = vista();
    const saltos = [];
    let url = new URL(destino, document.baseURI).href;
    try {
      for (let i = 0; i < 2; i += 1) {
        const r = await fetch(url, { credentials: "include", cache: "no-store" });
        const bytes = await r.arrayBuffer();
        const html = new TextDecoder("windows-1252").decode(bytes);
        saltos.push({
          pedida: url,
          final: r.url,
          estado: r.status,
          redirigida: r.redirected,
          tipo: r.headers.get("content-type") || "",
          bytes: bytes.byteLength,
          html,
        });
        if (!r.ok || /class="[^"]*\bTableData\b/.test(html)) break;
        const candidatos = new Set();
        for (const m of html.matchAll(/(?:https?:\/\/[^"'\s<>]+\/)?(?:\.\.\/)?nav\/[A-Za-z0-9_-]{10,}/g)) {
          candidatos.add(m[0]);
        }
        const refresco = /http-equiv=["']?refresh["']?[^>]*url=([^"'>\s]+)/i.exec(html);
        if (refresco) candidatos.add(refresco[1]);
        if (candidatos.size !== 1) break;
        url = new URL([...candidatos][0], r.url).href;
      }
    } catch (e) {
      return { antes, despues: vista(), saltos, error: String((e && e.message) || e) };
    }
    return { antes, despues: vista(), saltos };
  }

  const limpiar = (t) => String(t || "").replace(/\s+/g, " ").trim();

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

  async function ejecutar(tabId, salida) {
    const { enmascarar, analizarFilas } = raiz.DiagnosticoAnalisis;
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
      const conEnlace = marcos.filter((m) => m.result);
      if (conEnlace.length === 0) {
        decir(`✖ No encuentro «${TEXTO_ENLACE}». Entra en una pantalla de Séneca con el menú lateral y repite.`);
        return;
      }
      if (conEnlace.length > 1) decir(`⚠ Aparece en ${conEnlace.length} marcos; uso el primero.`);
      const { frameId, result: enlace } = conEnlace[0];
      const destino = enlace.menulink || (enlace.href !== "#" ? enlace.href : "");
      decir(`   Marco ${frameId}; data-menulink=${enmascarar(enlace.menulink)} href=${enmascarar(enlace.href)}`);
      if (!destino) {
        decir("✖ El enlace no tiene destino utilizable (ni data-menulink ni href).");
        return;
      }

      decir("2. Pido la pantalla en segundo plano (GET, mismo origen)…");
      const [{ result: sonda }] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func: sondear,
        args: [destino],
      });
      sonda.saltos.forEach((s, i) => {
        decir(
          `   Salto ${i + 1}: HTTP ${s.estado} · ${s.tipo || "sin tipo"} · ${s.bytes} bytes` +
            `${s.redirigida ? " · redirigida" : ""}\n     ${enmascarar(s.pedida)}\n     → ${enmascarar(s.final)}`
        );
      });
      if (sonda.error) decir(`✖ Error en la petición: ${enmascarar(sonda.error)}`);

      const ultimo = sonda.saltos[sonda.saltos.length - 1];
      if (ultimo) {
        const doc = new DOMParser().parseFromString(ultimo.html, "text/html");
        if (doc.querySelector('input[type="password"]')) {
          decir("✖ La respuesta es la pantalla de acceso: no se reconoció tu sesión.");
        } else {
          const tabla = leerTabla(doc);
          if (!tabla) {
            const titulo = limpiar(doc.title);
            const h1 = limpiar(doc.querySelector("h1") && doc.querySelector("h1").textContent);
            decir(`✖ No aparece la tabla de datos. Título: «${enmascarar(titulo)}»; h1: «${enmascarar(h1)}».`);
          } else {
            const analisis = analizarFilas(tabla.cabeceras, tabla.filas);
            if (analisis.error) {
              decir(`✖ ${analisis.error}`);
            } else {
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
          }
        }
      }

      const igual =
        sonda.antes.url === sonda.despues.url &&
        sonda.antes.historial === sonda.despues.historial &&
        sonda.antes.titulo === sonda.despues.titulo;
      decir(igual ? "4. ✔ Tu pantalla no ha cambiado." : "4. ✖ Tu pantalla ha cambiado durante la prueba.");
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
