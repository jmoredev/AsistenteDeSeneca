"use strict";

// Carga inicial de datos (S7 de odd/tasks/informes-alumnado-grupo.md y D13 de
// REQUISITOS.md). La primera vez que se usa la extensión hay que cargar unos
// datos de Séneca para poder operar; hoy solo son los «Grupos de alumnos/as»
// y el propietario irá diciendo qué más hace falta: por eso es una lista
// ampliable (`ELEMENTOS`), en la que añadir un elemento es una entrada más.
//
// Se guarda solo en `chrome.storage.local` (nunca sincronizado ni enviado) y
// solo datos de trabajo sin datos personales del alumnado: grupo, materia,
// número de alumnos y etiqueta, más los avisos y el error del elemento y la
// fecha de la carga. Nada de HTML, URL ni tokens (D13). «Olvidar todo»
// (RP-08) borra el almacén y la memoria.
//
// Este archivo es puro: no toca el DOM ni `chrome.*`. La petición a Séneca,
// el reloj y el almacenamiento se inyectan, así que corre igual en el panel y
// en los tests de Node. Los ayudantes de Séneca se reutilizan tal cual.

(function (raiz) {
  const enNode = typeof module === "object" && module.exports && typeof require === "function";
  const peticion = enNode ? require("./seneca/peticion.js") : raiz.SenecaPeticion;
  const gruposAlumnos = enNode ? require("./seneca/grupos-alumnos.js") : raiz.SenecaGruposAlumnos;

  // Versión del formato guardado: si cambia, la carga anterior no sirve y el
  // panel vuelve a pedir la carga inicial.
  const VERSION = 1;

  // Clave propia en chrome.storage.local (RP-04, D13).
  const CLAVE = "cargaInicial";

  const TITULO_PRIMER_USO = "Preparar la extensión";
  const EXPLICACION_PRIMER_USO =
    "La extensión lee algunos datos de Séneca una sola vez y los guarda solo en este navegador. " +
    "No se envían a ningún sitio y puedes borrarlos cuando quieras.";

  const TEXTO_CARGAR = "Cargar datos";
  const TEXTO_REINTENTAR = "Reintentar";
  const TEXTO_ACTUALIZAR = "Actualizar datos";
  const TEXTO_OLVIDAR = "Olvidar todo";

  const MENSAJE_OLVIDADO = "Se han borrado los datos guardados en este navegador.";
  const MENSAJE_SIN_BORRAR = "No se han podido borrar los datos guardados. Vuelve a intentarlo.";
  const MENSAJE_SIN_GUARDAR = "No se han podido guardar los datos en este navegador. Vuelve a intentarlo.";
  const MENSAJE_SIN_CARGA = "No se ha podido completar la carga de datos. Vuelve a intentarlo.";

  const ERROR_INESPERADO =
    "No se pudo completar la carga de datos. Comprueba que Séneca sigue abierto y vuelve a intentarlo.";

  // Lista ampliable de la carga inicial: el orden es el orden en que se piden
  // las pantallas (una detrás de otra, nunca en paralelo, para no castigar al
  // servidor de Séneca). Añadir un elemento nuevo es solo una entrada más.
  const ELEMENTOS = [
    {
      id: "grupos",
      nombre: "Grupos de alumnos/as",
      textoEnlace: peticion.TEXTO_ENLACE_GRUPOS,
      extraer: gruposAlumnos.extraerGrupos,
    },
  ];

  // El estado de cada elemento mientras se carga: pendiente, cargando, listo
  // o error. El panel lo anuncia en una región aria-live.
  function progresoInicial(elementos) {
    return (elementos || ELEMENTOS).map((elemento) => ({
      id: elemento.id,
      nombre: elemento.nombre,
      estado: "pendiente",
      error: "",
    }));
  }

  function textoProgreso(linea) {
    switch (linea.estado) {
      case "cargando":
        return `${linea.nombre}: cargando…`;
      case "listo":
        return `${linea.nombre}: ✔ listo`;
      case "error":
        return `${linea.nombre}: ✖ error. ${linea.error || "No se pudo cargar."}`;
      default:
        return `${linea.nombre}: pendiente`;
    }
  }

  function lineasDeProgreso(progreso) {
    return (progreso || []).map((linea) => ({ ...linea, texto: textoProgreso(linea) }));
  }

  // Copia solo texto, números y booleanos: ni HTML, ni estructuras ajenas.
  function soloPrimitivas(valor) {
    if (Array.isArray(valor)) return valor.map(soloPrimitivas);
    if (valor && typeof valor === "object") {
      const copia = {};
      for (const clave of Object.keys(valor)) {
        const interno = valor[clave];
        if (typeof interno === "string" || typeof interno === "boolean") copia[clave] = interno;
        else if (typeof interno === "number" && Number.isFinite(interno)) copia[clave] = interno;
      }
      return copia;
    }
    if (typeof valor === "string" || typeof valor === "boolean") return valor;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    return "";
  }

  // Lo que devuelve un adaptador, sin sus avisos ni su error: esos van aparte.
  // Hoy son los grupos ({ grupo, materia, alumnos, etiqueta }) y nada más.
  function datosDeExtraccion(extraido) {
    const datos = {};
    if (!extraido || typeof extraido !== "object") return datos;
    for (const clave of Object.keys(extraido)) {
      if (clave === "avisos" || clave === "error") continue;
      datos[clave] = soloPrimitivas(extraido[clave]);
    }
    return datos;
  }

  function elementosDe(carga) {
    return carga && typeof carga === "object" && carga.elementos && typeof carga.elementos === "object"
      ? carga.elementos
      : null;
  }

  // Hay carga utilizable solo si su versión es la actual y todos los
  // elementos del registro terminaron bien.
  function estaCompleta(carga) {
    if (!carga || typeof carga !== "object") return false;
    if (carga.version !== VERSION) return false;
    const elementos = elementosDe(carga);
    if (!elementos) return false;
    return ELEMENTOS.every((elemento) => {
      const guardado = elementos[elemento.id];
      return Boolean(guardado) && guardado.ok === true;
    });
  }

  // Elementos del registro que fallaron, con su nombre y su mensaje.
  function fallosDeCarga(carga) {
    const elementos = elementosDe(carga);
    if (!elementos) return [];
    const fallos = [];
    for (const elemento of ELEMENTOS) {
      const guardado = elementos[elemento.id];
      if (guardado && guardado.ok === true) continue;
      fallos.push({
        id: elemento.id,
        nombre: elemento.nombre,
        error: guardado && guardado.error ? String(guardado.error) : "",
      });
    }
    return fallos;
  }

  function sinPuntoFinal(texto) {
    return String(texto).replace(/\.\s*$/, "");
  }

  function textoFallos(fallos) {
    const lista = (fallos || []).filter(Boolean);
    if (lista.length === 0) return "";
    const nombres = lista
      .map((fallo) => (fallo.error ? `${fallo.nombre} (${sinPuntoFinal(fallo.error)})` : fallo.nombre))
      .join("; ");
    return lista.length === 1 ? `No se pudo cargar ${nombres}.` : `No se pudieron cargar ${nombres}.`;
  }

  function dosDigitos(numero) {
    return String(numero).padStart(2, "0");
  }

  // Fecha local del navegador, dd/mm/aaaa hh:mm.
  function formatearFecha(iso) {
    if (!iso) return "";
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return "";
    return (
      `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()}` +
      ` ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`
    );
  }

  function textoCargadoEl(iso) {
    const fecha = formatearFecha(iso);
    return fecha === "" ? "" : `Datos cargados el ${fecha}`;
  }

  // Ejecuta la carga inicial: un elemento detrás de otro, anotando cada fallo
  // sin detener los demás. Las dependencias se inyectan (S7):
  //   pedir(textoEnlace) -> { ok, html } | { ok: false, error }
  //   ahora()            -> Date (fecha de la carga)
  //   alProgreso(lineas) -> se llama en cada cambio de estado
  async function ejecutarCarga(opciones) {
    const pedir = opciones.pedir;
    const ahora = opciones.ahora || (() => new Date());
    const alProgreso = opciones.alProgreso || function () {};
    const elementos = opciones.elementos || ELEMENTOS;

    const progreso = progresoInicial(elementos);
    const avisar = () => alProgreso(progreso.map((linea) => ({ ...linea })));
    avisar();

    const carga = { version: VERSION, cargadoEl: "", elementos: {} };

    for (let i = 0; i < elementos.length; i += 1) {
      const elemento = elementos[i];
      progreso[i] = { ...progreso[i], estado: "cargando", error: "" };
      avisar();

      let respuesta = null;
      try {
        respuesta = await pedir(elemento.textoEnlace);
      } catch (e) {
        respuesta = { ok: false, error: (e && e.message) || String(e) };
      }

      let registro;
      if (!respuesta || !respuesta.ok) {
        registro = {
          ok: false,
          datos: {},
          avisos: [],
          error: (respuesta && respuesta.error) || ERROR_INESPERADO,
        };
      } else {
        let extraido = null;
        try {
          extraido = elemento.extraer(respuesta.html);
        } catch (e) {
          extraido = { error: (e && e.message) || String(e) };
        }
        if (!extraido || extraido.error) {
          registro = {
            ok: false,
            datos: {},
            avisos: [],
            error: (extraido && extraido.error) || ERROR_INESPERADO,
          };
        } else {
          registro = {
            ok: true,
            datos: datosDeExtraccion(extraido),
            avisos: Array.isArray(extraido.avisos) ? extraido.avisos.map(String) : [],
            error: "",
          };
        }
      }

      carga.elementos[elemento.id] = registro;
      progreso[i] = {
        ...progreso[i],
        estado: registro.ok ? "listo" : "error",
        error: registro.error,
      };
      avisar();
    }

    carga.cargadoEl = new Date(ahora()).toISOString();
    return carga;
  }

  // «Olvidar todo» (RP-08): borra el almacenamiento de la extensión mediante
  // la función inyectada y devuelve el estado en memoria ya vacío, para
  // volver al panel de primer uso.
  async function olvidar(opciones) {
    await opciones.borrar();
    return {
      carga: null,
      seleccion: "",
      primeraVez: true,
      mensaje: MENSAJE_OLVIDADO,
    };
  }

  const api = {
    VERSION,
    CLAVE,
    ELEMENTOS,
    TITULO_PRIMER_USO,
    EXPLICACION_PRIMER_USO,
    TEXTO_CARGAR,
    TEXTO_REINTENTAR,
    TEXTO_ACTUALIZAR,
    TEXTO_OLVIDAR,
    MENSAJE_OLVIDADO,
    MENSAJE_SIN_BORRAR,
    MENSAJE_SIN_GUARDAR,
    MENSAJE_SIN_CARGA,
    ERROR_INESPERADO,
    progresoInicial,
    textoProgreso,
    lineasDeProgreso,
    datosDeExtraccion,
    estaCompleta,
    fallosDeCarga,
    textoFallos,
    formatearFecha,
    textoCargadoEl,
    ejecutarCarga,
    olvidar,
  };

  if (enNode) module.exports = api;
  else raiz.CargaInicial = api;
})(globalThis);
