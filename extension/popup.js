"use strict";

// Panel de la extensión: detección de Séneca (RF-01, RF-03 de REQUISITOS.md),
// carga inicial de datos (S7 y D13) y utilidades. Nada sale del navegador: la
// carga lee Séneca en segundo plano (seneca/peticion.js) y su resultado se
// guarda solo en `chrome.storage.local`, nunca se sincroniza ni se envía.

// La detección del host y la lectura de la pestaña viven en sitio-seneca.js:
// solo `seneca.juntadeandalucia.es`, y sin errores sin capturar si la consulta
// de pestañas falla (T9).

// Almacenamiento local de la propia extensión (RP-04, D13): solo la clave de
// la carga inicial, borrable con «Olvidar todo» (RP-08).
const Almacen = {
  async leer() {
    const guardado = await chrome.storage.local.get(CargaInicial.CLAVE);
    return (guardado && guardado[CargaInicial.CLAVE]) || null;
  },
  async guardar(carga) {
    await chrome.storage.local.set({ [CargaInicial.CLAVE]: carga });
  },
  async borrar() {
    await chrome.storage.local.remove(CargaInicial.CLAVE);
  },
};

async function main() {
  const estado = document.getElementById("estado");
  const aviso = document.getElementById("aviso");

  // `chrome.tabs.query` puede fallar o no traer pestaña o dirección: se
  // explica en español en vez de dejar un error sin capturar (T9, RF-24).
  const leida = await SitioSeneca.leerPestanaActiva(() =>
    chrome.tabs.query({ active: true, currentWindow: true })
  );
  if (!leida.ok) {
    estado.textContent = leida.mensaje;
    aviso.textContent = leida.ayuda;
    aviso.hidden = false;
    return;
  }

  if (!SitioSeneca.esUrlSeneca(leida.url)) {
    estado.textContent = SitioSeneca.MENSAJE_NO_SENECA;
    aviso.textContent = SitioSeneca.AYUDA_NO_SENECA;
    aviso.hidden = false;
    return;
  }

  const tab = leida.pestana;
  estado.textContent = "Séneca detectado: la extensión está activa.";
  // El diagnóstico se conecta antes de leer el almacén y no depende de la
  // carga inicial: su salida es la misma que antes (T7, T10).
  conectarDiagnostico(tab);
  const panel = conectarCarga(tab);
  await panel.iniciar();
}

function conectarDiagnostico(tab) {
  const boton = document.getElementById("diagnostico");
  const salida = document.getElementById("diagnostico-salida");
  boton.addEventListener("click", async () => {
    boton.disabled = true;
    salida.hidden = false;
    salida.textContent = "";
    try {
      await Diagnostico.ejecutar(tab.id, salida);
    } finally {
      boton.disabled = false;
    }
  });
}

// Carga inicial (S7) y utilidades. La petición a Séneca se sigue haciendo con
// `SenecaPeticion.obtenerPantalla`, en serie y solo al cargar o actualizar.
function conectarCarga(tab) {
  const dom = {
    progreso: document.getElementById("carga-progreso"),
    fallos: document.getElementById("carga-fallos"),
    mensaje: document.getElementById("carga-mensaje"),
    primerUso: document.getElementById("primer-uso"),
    cargar: document.getElementById("cargar-datos"),
    menu: document.getElementById("menu"),
    fecha: document.getElementById("carga-fecha"),
    actualizar: document.getElementById("actualizar-datos"),
    actualizarEtiqueta: document.getElementById("actualizar-datos-etiqueta"),
    olvidar: document.getElementById("olvidar-todo"),
    olvidarEtiqueta: document.getElementById("olvidar-todo-etiqueta"),
    olvidarPrimerUso: document.getElementById("olvidar-todo-primer-uso"),
    alumnado: document.getElementById("alumnado"),
    avisos: document.getElementById("alumnado-avisos"),
    error: document.getElementById("alumnado-error"),
    lista: document.getElementById("alumnado-lista"),
    vacio: document.getElementById("alumnado-vacio"),
    seleccion: document.getElementById("alumnado-seleccion"),
  };

  let carga = null; // última carga guardada (o null si no hay ninguna útil)
  let progreso = []; // estado de cada elemento mientras se carga
  let vista = null; // lo último pintado en Alumnado
  let elegido = ""; // selección en memoria, sin almacenamiento
  let ocupado = false; // hay una carga en marcha
  let errorGuardado = ""; // aviso si el navegador no dejó guardar
  let conservada = false; // la última carga falló y se mantienen los datos anteriores
  let avisoConservada = ""; // qué falló y de cuándo son los datos que se mantienen

  dom.cargar.textContent = CargaInicial.TEXTO_CARGAR;
  dom.actualizarEtiqueta.textContent = CargaInicial.TEXTO_ACTUALIZAR;
  dom.olvidarEtiqueta.textContent = CargaInicial.TEXTO_OLVIDAR;

  // --- Carga inicial ---

  async function pedirPantalla(textoEnlace) {
    try {
      const r = await SenecaPeticion.obtenerPantalla(tab.id, textoEnlace);
      return { ok: r.ok, html: r.html, error: r.error || "" };
    } catch (e) {
      return { ok: false, html: "", error: SenecaPeticion.ERROR_INESPERADO };
    }
  }

  function pintarProgreso() {
    dom.progreso.textContent = "";
    for (const linea of CargaInicial.lineasDeProgreso(progreso)) {
      const parrafo = document.createElement("p");
      parrafo.className = `progreso-linea progreso-${linea.estado}`;
      parrafo.textContent = linea.texto;
      dom.progreso.append(parrafo);
    }
    dom.progreso.hidden = progreso.length === 0;
  }

  function pintarCarga() {
    const completa = CargaInicial.estaCompleta(carga);
    dom.primerUso.hidden = completa;
    dom.menu.hidden = !completa;
    // «Olvidar todo» (RP-08) se ofrece también en «Preparar la extensión» en
    // cuanto haya algo guardado, aunque la carga esté incompleta o sea de otra
    // versión del formato (T9).
    dom.olvidarPrimerUso.hidden = !CargaInicial.hayDatosQueOlvidar(carga);

    if (completa) {
      dom.fecha.textContent = CargaInicial.textoCargadoEl(carga.cargadoEl);
    }

    // Qué falló (o si el navegador no dejó guardar), para poder reintentar.
    const fallos = CargaInicial.fallosDeCarga(carga);
    const partes = [CargaInicial.textoFallos(fallos), errorGuardado, avisoConservada].filter(Boolean);
    dom.fallos.textContent = partes.join(" ");
    dom.fallos.hidden = partes.length === 0;
    dom.cargar.textContent = fallos.length === 0 ? CargaInicial.TEXTO_CARGAR : CargaInicial.TEXTO_REINTENTAR;
    // Con los datos anteriores conservados el menú sigue visible: se ofrece
    // «Reintentar» aquí, porque «Cargar datos» está en «Preparar la extensión».

    pintarProgreso();
  }

  async function cargarDatos() {
    if (ocupado) return;
    ocupado = true;
    bloquear(true);
    errorGuardado = "";
    conservada = false;
    avisoConservada = "";
    dom.mensaje.hidden = true;
    dom.mensaje.textContent = "";
    reiniciarAlumnado();

    progreso = CargaInicial.progresoInicial();
    pintarProgreso();

    let nueva = null;
    let sinCarga = false;
    try {
      nueva = await CargaInicial.ejecutarCarga({
        pedir: pedirPantalla,
        ahora: () => new Date(),
        alProgreso: (lineas) => {
          progreso = lineas;
          pintarProgreso();
        },
      });
    } catch (e) {
      nueva = null;
      sinCarga = true;
    }

    // Una carga nueva que falla no borra la anterior si era buena (T9): se
    // conserva lo guardado y se explica qué falló y de cuándo son los datos.
    let decision;
    try {
      decision = await CargaInicial.aplicarCarga({ anterior: carga, nueva, guardar: Almacen.guardar });
    } catch (e) {
      decision = { carga: null, conservada: false, aviso: "" };
      errorGuardado = CargaInicial.MENSAJE_SIN_GUARDAR;
    }

    carga = decision.carga;
    conservada = decision.conservada;
    avisoConservada = decision.aviso;
    // Si la carga ni siquiera pudo empezar y no hay datos que conservar, el
    // panel lo dice como siempre.
    if (sinCarga && !conservada) errorGuardado = CargaInicial.MENSAJE_SIN_CARGA;

    // Con la carga completa el progreso deja paso al menú.
    if (CargaInicial.estaCompleta(carga)) progreso = [];

    ocupado = false;
    bloquear(false);
    pintarCarga();

    if (CargaInicial.estaCompleta(carga)) dom.alumnado.focus();
    else dom.cargar.focus();
  }

  async function olvidarTodo() {
    if (ocupado) return;
    ocupado = true;
    bloquear(true);
    try {
      const resultado = await CargaInicial.olvidar({ borrar: Almacen.borrar });
      carga = resultado.carga;
      elegido = resultado.seleccion;
      vista = null;
      progreso = [];
      errorGuardado = "";
      conservada = false;
      avisoConservada = "";
      dom.mensaje.textContent = resultado.mensaje;
      dom.mensaje.hidden = false;
      reiniciarAlumnado();
    } catch (e) {
      dom.mensaje.textContent = CargaInicial.MENSAJE_SIN_BORRAR;
      dom.mensaje.hidden = false;
    } finally {
      ocupado = false;
      bloquear(false);
      pintarCarga();
      if (!CargaInicial.estaCompleta(carga)) dom.cargar.focus();
    }
  }

  function bloquear(si) {
    dom.cargar.disabled = si;
    dom.actualizar.disabled = si;
    dom.olvidar.disabled = si;
    dom.olvidarPrimerUso.disabled = si;
    dom.alumnado.disabled = si;
  }

  // --- Alumnado: lee los grupos de la carga guardada, sin pedir a Séneca ---

  function pintarSeleccion() {
    dom.seleccion.hidden = elegido === "";
    dom.seleccion.textContent = elegido === "" ? "" : AlumnadoVista.textoSeleccion(elegido);
  }

  function pintarLista() {
    dom.lista.textContent = "";
    if (!vista) return;
    for (const grupo of vista.grupos) {
      const opcion = document.createElement("button");
      opcion.type = "button";
      opcion.className = "grupo";
      opcion.setAttribute("aria-pressed", String(grupo.etiqueta === elegido));

      const etiqueta = document.createElement("span");
      etiqueta.className = "grupo-etiqueta";
      etiqueta.textContent = grupo.etiqueta;

      const cuenta = document.createElement("span");
      cuenta.className = "grupo-alumnos";
      cuenta.textContent = grupo.textoAlumnos;

      opcion.append(etiqueta, cuenta);
      opcion.addEventListener("click", () => {
        elegido = grupo.etiqueta;
        for (const otra of dom.lista.querySelectorAll("button.grupo")) {
          otra.setAttribute("aria-pressed", String(otra === opcion));
        }
        pintarSeleccion();
      });
      dom.lista.append(opcion);
    }
  }

  function pintarAlumnado() {
    dom.avisos.textContent = "";
    const avisos = vista ? vista.avisos : [];
    dom.avisos.hidden = avisos.length === 0;
    for (const aviso of avisos) {
      const parrafo = document.createElement("p");
      parrafo.className = "aviso";
      parrafo.textContent = `⚠ ${aviso}`;
      dom.avisos.append(parrafo);
    }

    dom.error.hidden = !vista || vista.error === "";
    dom.error.textContent = vista ? vista.error : "";

    dom.vacio.textContent = vista ? vista.vacio : "";
    dom.vacio.hidden = !vista || vista.vacio === "";

    pintarLista();
    dom.lista.hidden = !vista || vista.grupos.length === 0;
    pintarSeleccion();
  }

  function reiniciarAlumnado() {
    vista = null;
    elegido = "";
    pintarAlumnado();
  }

  function abrirAlumnado() {
    if (ocupado) return;
    // Sin petición a Séneca: los grupos ya están en la carga guardada (S7).
    vista = AlumnadoVista.vistaDesdeCarga(carga);
    pintarAlumnado();
    const primera = dom.lista.querySelector("button.grupo");
    if (primera) primera.focus();
  }

  dom.cargar.addEventListener("click", cargarDatos);
  dom.actualizar.addEventListener("click", cargarDatos);
  dom.olvidar.addEventListener("click", olvidarTodo);
  dom.olvidarPrimerUso.addEventListener("click", olvidarTodo);
  dom.alumnado.addEventListener("click", abrirAlumnado);

  return {
    async iniciar() {
      try {
        carga = await Almacen.leer();
      } catch (e) {
        carga = null;
      }
      pintarCarga();
    },
  };
}

main();
