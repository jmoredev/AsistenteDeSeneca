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
      .replace(/([?&][^=&#\s]+=)[^&#\s]*/g, "$1<valor>");
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

  const api = { enmascarar, partirAlumnadoDe, analizarFilas };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.DiagnosticoAnalisis = api;
})(globalThis);
