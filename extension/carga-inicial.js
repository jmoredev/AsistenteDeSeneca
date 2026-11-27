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
// fecha de la carga. Cada elemento del registro declara qué campos de cada
// fila se pueden guardar (`campos`) y el saneador copia solo esos (S8.2): si
// un elemento no los declara, no se guarda ninguna fila. Nada de HTML, URL ni
// tokens (D13). «Olvidar todo» (RP-08) borra el almacén y la memoria.
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
  const MENSAJE_SIN_LEER = "No se han podido leer los datos guardados. Cierra y vuelve a abrir el panel.";
  const MENSAJE_SIN_CAMPOS =
    "Este elemento de la carga no declara qué campos se pueden guardar; no se ha guardado nada.";

  const ERROR_INESPERADO =
    "No se pudo completar la carga de datos. Comprueba que Séneca sigue abierto y vuelve a intentarlo.";

  // Lista ampliable de la carga inicial: el orden es el orden en que se piden
  // las pantallas (una detrás de otra, nunca en paralelo, para no castigar al
  // servidor de Séneca). Añadir un elemento nuevo es solo una entrada más, con
  // los campos de cada fila que se pueden guardar (S8.2); sin `campos` no se
  // guarda ninguna fila (cierra en fallo).
  const ELEMENTOS = [
    {
      id: "grupos",
      nombre: "Grupos de alumnos/as",
      textoEnlace: peticion.TEXTO_ENLACE_GRUPOS,
      campos: ["grupo", "materia", "alumnos", "etiqueta"],
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

  // Un valor guardable: texto, número finito o booleano. Cualquier otra cosa
  // (nulos, objetos, HTML estructurado) no se guarda.
  function valorGuardable(valor) {
    if (typeof valor === "string" || typeof valor === "boolean") return valor;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    return undefined;
  }

  // Lista blanca declarada por el elemento del registro (S8.2). Devuelve null
  // si no es una lista válida: entonces no se guarda ninguna fila.
  function camposPermitidos(campos) {
    if (!Array.isArray(campos) || campos.length === 0) return null;
    const lista = [];
    for (const campo of campos) {
      if (typeof campo !== "string" || campo === "" || campo === "avisos" || campo === "error") return null;
      lista.push(campo);
    }
    return lista;
  }

  // Una fila con solo los campos declarados: lo demás se descarta.
  function filaPermitida(fila, campos) {
    const limpia = {};
    if (!fila || typeof fila !== "object") return limpia;
    for (const campo of campos) {
      const valor = valorGuardable(fila[campo]);
      if (valor !== undefined) limpia[campo] = valor;
    }
    return limpia;
  }

  // Lo que devuelve un adaptador: solo sus colecciones de filas, sin avisos ni
  // error (esos van aparte) y con solo los campos que el elemento declara en
  // `campos` (S8.2). Cualquier otra clave que devuelva el adaptador, escalar o
  // anidada, se descarta; sin lista blanca no se copia nada.
  function datosDeExtraccion(extraido, campos) {
    const datos = {};
    const permitidos = camposPermitidos(campos);
    if (!permitidos || !extraido || typeof extraido !== "object") return datos;
    for (const clave of Object.keys(extraido)) {
      if (clave === "avisos" || clave === "error") continue;
      const valor = extraido[clave];
      if (!Array.isArray(valor)) continue;
      datos[clave] = valor.map((fila) => filaPermitida(fila, permitidos));
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

  // La carga nueva no llegó a guardarse porque el navegador rechazó la
  // escritura (S8.3): se dice y se recuerda de cuándo son los datos que se
  // mantienen, que siguen utilizables en el menú y en Alumnado.
  function textoNoGuardada(anterior) {
    const cuando = formatearFecha(anterior && anterior.cargadoEl);
    const mantiene =
      cuando === "" ? "Se mantienen los datos de la última carga." : `Se mantienen los datos cargados el ${cuando}.`;
    return (
      `No se han podido guardar los datos nuevos en este navegador. ${mantiene} ` +
      "Pulsa «Actualizar datos» para volver a intentarlo."
    );
  }

  // Hay algo guardado que «Olvidar todo» (RP-08) puede borrar: sirve cualquier
  // carga, aunque esté incompleta o sea de una versión anterior del formato,
  // porque el panel la ofrece también desde «Preparar la extensión» (T9).
  function hayDatosQueOlvidar(carga) {
    return Boolean(carga) && typeof carga === "object";
  }

  // Qué se hace con el resultado de una carga nueva (T9): si la nueva está
  // completa se guarda y sustituye a la anterior; si falla y había una carga
  // buena, se conserva la buena (no se pierde lo que ya funcionaba) y se
  // explica qué falló y de cuándo son los datos que se mantienen. Si es la
  // primera carga, el fallo se guarda como siempre, para poder reintentar.
  function textoConservada(nueva, anterior) {
    const fallos = textoFallos(fallosDeCarga(nueva));
    const cuando = anterior ? formatearFecha(anterior.cargadoEl) : "";
    const mantiene =
      cuando === "" ? "Se mantienen los datos de la última carga." : `Se mantienen los datos cargados el ${cuando}.`;
    const motivo = fallos || "No se ha podido completar la carga de datos.";
    return `${motivo} ${mantiene} Pulsa «Actualizar datos» para volver a intentarlo.`;
  }

  // Aplica la carga nueva sobre la guardada con el almacén inyectado.
  // Devuelve { carga, conservada, aviso, errorGuardado }: `aviso` es el texto
  // para el panel, `conservada` indica que la carga de pantalla no se ha tocado
  // y `errorGuardado` es el aviso cuando no queda nada que conservar.
  // Si el navegador rechaza la escritura de una carga nueva completa, se sigue
  // usando la carga buena anterior en memoria y en el panel, con su fecha
  // (S8.3). Y con la lectura del almacén fallida no se escribe nada, porque no
  // se sabe qué hay guardado (S8.4).
  async function aplicarCarga(opciones) {
    const anterior = opciones.anterior || null;
    const nueva = opciones.nueva || null;
    const guardar = opciones.guardar;

    if (opciones.lecturaFallida) {
      return { carga: anterior, conservada: false, aviso: "", errorGuardado: MENSAJE_SIN_LEER };
    }

    if (estaCompleta(nueva)) {
      try {
        await guardar(nueva);
        return { carga: nueva, conservada: false, aviso: "", errorGuardado: "" };
      } catch (e) {
        if (estaCompleta(anterior)) {
          return { carga: anterior, conservada: true, aviso: textoNoGuardada(anterior), errorGuardado: "" };
        }
        return { carga: null, conservada: false, aviso: "", errorGuardado: MENSAJE_SIN_GUARDAR };
      }
    }
    if (estaCompleta(anterior)) {
      return { carga: anterior, conservada: true, aviso: textoConservada(nueva, anterior), errorGuardado: "" };
    }
    if (nueva) {
      try {
        await guardar(nueva);
      } catch (e) {
        return { carga: null, conservada: false, aviso: "", errorGuardado: MENSAJE_SIN_GUARDAR };
      }
    }
    return { carga: nueva || anterior, conservada: false, aviso: "", errorGuardado: "" };
  }

  // Lee la carga guardada con el almacén inyectado (S8.4): «no hay nada
  // guardado» y «no se pudo leer» son estados distintos. Con la lectura
  // fallida el panel lo dice y no deja escribir encima.
  async function leerCarga(opciones) {
    try {
      const guardada = await opciones.leer();
      return { carga: guardada || null, lecturaFallida: false, mensaje: "" };
    } catch (e) {
      return { carga: null, lecturaFallida: true, mensaje: MENSAJE_SIN_LEER };
    }
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
      // Sin lista blanca declarada no se guarda ninguna fila y ni siquiera se
      // pide la pantalla: cierra en fallo (S8.2).
      const permitidos = camposPermitidos(elemento.campos);
      if (!permitidos) {
        carga.elementos[elemento.id] = { ok: false, datos: {}, avisos: [], error: MENSAJE_SIN_CAMPOS };
        progreso[i] = { ...progreso[i], estado: "error", error: MENSAJE_SIN_CAMPOS };
        avisar();
        continue;
      }

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
            datos: datosDeExtraccion(extraido, permitidos),
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
    MENSAJE_SIN_LEER,
    MENSAJE_SIN_CAMPOS,
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
    hayDatosQueOlvidar,
    textoConservada,
    textoNoGuardada,
    aplicarCarga,
    leerCarga,
    ejecutarCarga,
    olvidar,
  };

  if (enNode) module.exports = api;
  else raiz.CargaInicial = api;
})(globalThis);
