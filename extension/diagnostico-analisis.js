"use strict";

// Pure helpers for the T7 live diagnostic (S2, S6 of
// odd/tasks/informes-alumnado-grupo.md). They run inside the popup, never
// send anything anywhere, and are shared with Node tests.

(function (raiz) {
  const FORMATO_ALUMNADO =
    "«Alumnado de» no tiene el formato «… / materia / grupo / N alumnos\\as»";

  // Hides opaque navigation tokens and query values before showing a URL.
  function enmascarar(texto) {
    return String(texto)
      .replace(/\b(nav|menus|acciones)\/[A-Za-z0-9_-]+/g, "$1/<token>")
      .replace(/\/[A-Za-z0-9_-]{20,}/g, "/<token>")
      .replace(/([?&][^=&#\s]+=)[^&#\s]*/g, "$1<valor>");
  }

  const ORIGEN_SENECA = "https://seneca.juntadeandalucia.es";

  // S6: background requests may only target Seneca's own origin.
  function urlPermitida(url) {
    try {
      return new URL(url).origin === ORIGEN_SENECA;
    } catch (e) {
      return false;
    }
  }

  // Next hop when a response is not the data screen yet: only one unambiguous
  // nav/<token> or meta-refresh target, resolved against the response URL.
  function siguienteSalto(html, base) {
    if (/class="[^"]*\bTableData\b/.test(html)) return null;
    const crudos = Array.from(html.matchAll(/(?:https?:\/\/[^"'\s<>]+\/)?(?:\.\.\/)?nav\/[A-Za-z0-9_-]+/g), (m) => m[0]);
    const refresco = /http-equiv=["']?refresh["']?[^>]*url=([^"'>\s]+)/i.exec(html);
    if (refresco) crudos.push(refresco[1]);
    const candidatos = new Set();
    for (const crudo of crudos) {
      try {
        candidatos.add(new URL(crudo, base).href);
      } catch (e) {
        // Not a URL: ignore it.
      }
    }
    return candidatos.size === 1 ? Array.from(candidatos)[0] : null;
  }

  // "… / materia / grupo / N alumnos\as" -> { grupo, materia, alumnos }.
  function partirAlumnadoDe(texto) {
    const elementos = String(texto)
      .replace(/\u00a0/g, " ")
      .split(/\s+\/\s+/)
      .map((e) => e.trim())
      .filter((e) => e !== "");
    const cuenta = elementos.length >= 3 ? /^(\d+)\s+alumnos/i.exec(elementos[elementos.length - 1]) : null;
    if (!cuenta) return { error: FORMATO_ALUMNADO };
    return {
      grupo: elementos[elementos.length - 2],
      materia: elementos[elementos.length - 3],
      alumnos: Number(cuenta[1]),
      elementos: elementos.length,
    };
  }

  const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };

  // Visible text of a cell's HTML: <br> becomes a space so separators never
  // glue together (S2); tags are dropped and basic entities decoded.
  function textoVisible(html) {
    return String(html)
      .replace(/<br\b[^>]*>/gi, " ")
      .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, "")
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entidad, nombre) => {
        if (nombre[0] === "#") {
          const hexadecimal = nombre[1].toLowerCase() === "x";
          return String.fromCodePoint(parseInt(nombre.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
        }
        const clave = nombre.toLowerCase();
        return Object.prototype.hasOwnProperty.call(ENTIDADES, clave) ? ENTIDADES[clave] : entidad;
      })
      .replace(/[ \t\r\n]+/g, " ")
      .trim();
  }

  function indiceDe(cabeceras, nombre) {
    return cabeceras.findIndex((c) => String(c).replace(/\s+/g, " ").trim() === nombre);
  }

  // Cross-checks every row's «Alumnado de» against its «Materia» column.
  function analizarFilas(cabeceras, filas) {
    for (const nombre of ["Alumnado de", "Materia"]) {
      if (indiceDe(cabeceras, nombre) === -1) {
        return { error: `No encuentro la columna «${nombre}». Cabeceras: ${cabeceras.join(" | ")}` };
      }
    }
    const iAlumnado = indiceDe(cabeceras, "Alumnado de");
    const iMateria = indiceDe(cabeceras, "Materia");
    return {
      filas: filas.map((celdas, i) => {
        const partes = partirAlumnadoDe(celdas[iAlumnado] || "");
        if (partes.error) return { fila: i + 1, error: partes.error };
        const materia = String(celdas[iMateria] || "").replace(/\s+/g, " ").trim();
        return { grupo: partes.grupo, materia, alumnos: partes.alumnos, coincide: materia === partes.materia };
      }),
    };
  }

  const api = { enmascarar, partirAlumnadoDe, analizarFilas, textoVisible, urlPermitida, siguienteSalto };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.DiagnosticoAnalisis = api;
})(globalThis);
