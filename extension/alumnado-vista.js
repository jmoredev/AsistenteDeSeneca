"use strict";

// Modelo de vista del selector «Grupo - Materia» (S1 de
// odd/tasks/informes-alumnado-grupo.md). Convierte el resultado del adaptador
// (`extraerGrupos`: { grupos, avisos } o { error }) en lo que pinta el panel.
// Código puro: sin DOM, sin chrome.*, sin red. Las opciones de informes
// concretas llegarán en otra tarea.

(function (raiz) {
  const VACIO = "No se han encontrado grupos en «Grupo de alumnos/as».";
  const SIN_CARGA = "Todavía no has cargado los datos de Séneca. Pulsa «Actualizar datos» para cargar tus grupos.";

  function mensajeGruposFallidos(error) {
    const detalle = error ? ` (${String(error).replace(/\.\s*$/, "")})` : "";
    return `No se pudieron cargar tus grupos${detalle}. Pulsa «Actualizar datos» para volver a intentarlo.`;
  }

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

  // Alumnado lee los grupos de la carga inicial guardada (S7): al pulsar su
  // botón no se pide nada a Séneca. Si el elemento «grupos» no está o falló,
  // se explica en español y se remite a «Actualizar datos» (RF-24).
  function vistaDesdeCarga(carga) {
    const guardado = carga && carga.elementos ? carga.elementos.grupos : null;
    if (!guardado) return vistaDeGrupos({ error: SIN_CARGA });
    if (!guardado.ok) return vistaDeGrupos({ error: mensajeGruposFallidos(guardado.error) });
    const datos = guardado.datos || {};
    return vistaDeGrupos({
      grupos: Array.isArray(datos.grupos) ? datos.grupos : [],
      avisos: guardado.avisos,
    });
  }

  const api = {
    VACIO,
    SIN_CARGA,
    vistaDeGrupos,
    vistaDesdeCarga,
    mensajeGruposFallidos,
    textoSeleccion,
    textoAlumnos,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.AlumnadoVista = api;
})(globalThis);
