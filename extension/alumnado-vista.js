"use strict";

// Modelo de vista del selector «Grupo - Materia» (S1 de
// odd/tasks/informes-alumnado-grupo.md). Convierte el resultado del adaptador
// (`extraerGrupos`: { grupos, avisos } o { error }) en lo que pinta el panel.
// Código puro: sin DOM, sin chrome.*, sin red. Las opciones de informes
// concretas llegarán en otra tarea.

(function (raiz) {
  const CARGANDO = "Cargando tus grupos…";
  const VACIO = "No se han encontrado grupos en «Grupo de alumnos/as».";

  function textoAlumnos(cuantos) {
    const n = Number(cuantos);
    return `${n} ${n === 1 ? "alumno" : "alumnos"}`;
  }

  // { grupos, avisos, vacio, error }: listo para pintar, en el orden recibido.
  function vistaDeGrupos(resultado) {
    const avisos = resultado && Array.isArray(resultado.avisos) ? resultado.avisos.map(String) : [];
    if (resultado && resultado.error) {
      return { error: String(resultado.error), avisos: [], grupos: [], vacio: "" };
    }
    const grupos = resultado && Array.isArray(resultado.grupos) ? resultado.grupos : [];
    return {
      error: "",
      avisos,
      vacio: grupos.length === 0 ? VACIO : "",
      grupos: grupos.map((g) => ({
        etiqueta: String((g && g.etiqueta) || ""),
        alumnos: Number((g && g.alumnos) || 0),
        textoAlumnos: textoAlumnos((g && g.alumnos) || 0),
      })),
    };
  }

  // La selección se queda solo en memoria: no hay almacenamiento ni red.
  function textoSeleccion(etiqueta) {
    return `Seleccionado: ${etiqueta}. Las opciones de informes llegarán pronto.`;
  }

  const api = { CARGANDO, VACIO, vistaDeGrupos, textoSeleccion, textoAlumnos };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.AlumnadoVista = api;
})(globalThis);
