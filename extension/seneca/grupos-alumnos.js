"use strict";

// Adaptador de la pantalla «Grupo de alumnos/as» de Séneca (S1, S2, S3 y S4 de
// odd/tasks/informes-alumnado-grupo.md): HTML de la respuesta -> lista de
// «Grupo - Materia». Procesa cadenas, sin DOM, para que el mismo código corra
// en los tests de Node y dentro del panel. Los ayudantes de tabla se reutilizan
// de diagnostico-analisis.js (aquí: global `DiagnosticoAnalisis`).

(function (raiz) {
  const analisis =
    typeof module === "object" && module.exports && typeof require === "function"
      ? require("../diagnostico-analisis.js")
      : raiz.DiagnosticoAnalisis;
  const { textoVisible, analizarFilas } = analisis;

  const SIN_SESION = "La respuesta es la pantalla de acceso: no se reconoció tu sesión.";
  const SIN_TABLA = "No aparece la tabla «Grupo de alumnos/as» en la respuesta.";

  // Atributos de una etiqueta: admite «>» dentro de un valor entrecomillado.
  const ATRIBUTOS = "(?:[^>\"']|\"[^\"]*\"|'[^']*')*";
  const RE_INPUT = new RegExp("<input\\b(" + ATRIBUTOS + ")>", "gi");
  const RE_TABLA = new RegExp("<table\\b(" + ATRIBUTOS + ")>([\\s\\S]*?)<\\/table>", "gi");
  const RE_TH = new RegExp("<th\\b(?:" + ATRIBUTOS + ")>([\\s\\S]*?)<\\/th>", "gi");
  const RE_TD = new RegExp("<td\\b(?:" + ATRIBUTOS + ")>([\\s\\S]*?)<\\/td>", "gi");

  function tieneClaseTableData(atributos) {
    const encontrado = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(atributos);
    if (!encontrado) return false;
    const clases = (encontrado[1] || encontrado[2] || encontrado[3] || "").split(/\s+/);
    return clases.includes("TableData");
  }

  // Cabeceras de <th> y filas de <td> de una tabla, con el texto visible.
  function partirTabla(contenido) {
    const cabeceras = Array.from(contenido.matchAll(RE_TH), (m) => textoVisible(m[1]));
    const filas = [];
    for (const trozo of contenido.split(/<tr\b/i)) {
      const celdas = Array.from(trozo.matchAll(RE_TD), (m) => textoVisible(m[1]));
      if (celdas.length > 0) filas.push(celdas);
    }
    return { cabeceras, filas };
  }

  // La pantalla de acceso pide la contraseña: sin sesión no hay datos.
  function esPantallaDeAcceso(html) {
    for (const input of html.matchAll(RE_INPUT)) {
      if (/\btype\s*=\s*["']?\s*password\s*["']?/i.test(input[1])) return true;
    }
    return false;
  }

  function extraerGrupos(html) {
    const texto = String(html);
    if (esPantallaDeAcceso(texto)) return { error: SIN_SESION };

    const tablas = Array.from(texto.matchAll(RE_TABLA)).filter((m) => tieneClaseTableData(m[1])).map((m) => partirTabla(m[2]));
    if (tablas.length === 0) return { error: SIN_TABLA };

    // Primera tabla de datos que tenga «Alumnado de» y «Materia»; si ninguna
    // las tiene, se devuelve el mensaje de analizarFilas sobre la primera.
    let elegido = null;
    let primero = null;
    for (const tabla of tablas) {
      const resultado = analizarFilas(tabla.cabeceras, tabla.filas);
      if (!resultado.error) {
        elegido = resultado;
        break;
      }
      if (!primero) primero = resultado;
    }
    if (!elegido) return { error: primero.error };

    const grupos = [];
    const avisos = [];
    const vistos = new Set();
    elegido.filas.forEach((fila, i) => {
      const numero = i + 1;
      if (fila.error) {
        avisos.push(`Fila ${numero}: ${fila.error}`);
        return;
      }
      if (!fila.coincide) {
        avisos.push(`Fila ${numero}: la materia «${fila.materia}» no coincide con la de «Alumnado de».`);
      }
      const clave = `${fila.grupo}\u0000${fila.materia}`;
      if (vistos.has(clave)) return;
      vistos.add(clave);
      grupos.push({
        grupo: fila.grupo,
        materia: fila.materia,
        alumnos: fila.alumnos,
        etiqueta: `${fila.grupo} - ${fila.materia}`,
      });
    });
    return { grupos, avisos };
  }

  const api = { extraerGrupos };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.SenecaGruposAlumnos = api;
})(globalThis);
