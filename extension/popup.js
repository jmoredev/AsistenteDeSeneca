"use strict";

// Detects whether the active tab is inside Seneca (RF-01, RF-03 of
// REQUISITOS.md) and renders the utility menu accordingly.
// «Alumnado» (T5) lists the teacher's «Grupo - Materia» entries in this popup;
// the diagnostic (T7) prints its report here too. Both share the background
// request in seneca/peticion.js: nothing leaves the browser.

const SENECA_URL_RE = /^https:\/\/[^/]*\.juntadeandalucia\.es\//i;

async function main() {
  const estado = document.getElementById("estado");
  const menu = document.getElementById("menu");
  const aviso = document.getElementById("aviso");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? tab.url : "";

  if (SENECA_URL_RE.test(url)) {
    estado.textContent = "Séneca detectado: la extensión está activa.";
    menu.hidden = false;
    conectarDiagnostico(tab);
    conectarAlumnado(tab);
  } else {
    estado.textContent = "La extensión solo funciona dentro de Séneca.";
    aviso.textContent =
      "Abre Séneca (seneca.juntadeandalucia.es) con tu sesión iniciada " +
      "y pulsa de nuevo este botón.";
    aviso.hidden = false;
  }
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

// Alumnado → lista «Grupo - Materia» → selección. La elección se queda en
// memoria: no se guarda ni se envía a ningún sitio (S5, S6). Las opciones de
// informes llegarán en otra tarea (S1).
function conectarAlumnado(tab) {
  const boton = document.getElementById("alumnado");
  const cargando = document.getElementById("alumnado-cargando");
  const avisos = document.getElementById("alumnado-avisos");
  const error = document.getElementById("alumnado-error");
  const reintentar = document.getElementById("alumnado-reintentar");
  const lista = document.getElementById("alumnado-lista");
  const vacio = document.getElementById("alumnado-vacio");
  const seleccion = document.getElementById("alumnado-seleccion");

  let vista = null; // último resultado pintado
  let elegido = ""; // selección en memoria, sin almacenamiento

  function pintarSeleccion() {
    seleccion.hidden = elegido === "";
    seleccion.textContent = elegido === "" ? "" : AlumnadoVista.textoSeleccion(elegido);
  }

  function pintarLista() {
    lista.textContent = "";
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
        for (const otra of lista.querySelectorAll("button.grupo")) {
          otra.setAttribute("aria-pressed", String(otra === opcion));
        }
        pintarSeleccion();
      });
      lista.append(opcion);
    }
  }

  function pintarTodo() {
    avisos.textContent = "";
    avisos.hidden = vista.avisos.length === 0;
    for (const aviso of vista.avisos) {
      const parrafo = document.createElement("p");
      parrafo.className = "aviso";
      parrafo.textContent = `⚠ ${aviso}`;
      avisos.append(parrafo);
    }

    error.hidden = vista.error === "";
    error.textContent = vista.error;
    reintentar.hidden = vista.error === "";

    vacio.textContent = vista.vacio;
    vacio.hidden = vista.vacio === "";

    pintarLista();
    lista.hidden = vista.grupos.length === 0;
    pintarSeleccion();
  }

  async function cargar() {
    vista = null;
    elegido = "";
    avisos.hidden = true;
    avisos.textContent = "";
    error.hidden = true;
    error.textContent = "";
    reintentar.hidden = true;
    lista.hidden = true;
    lista.textContent = "";
    vacio.hidden = true;
    vacio.textContent = "";
    pintarSeleccion();

    cargando.hidden = false;
    cargando.textContent = AlumnadoVista.CARGANDO;
    boton.disabled = true;
    reintentar.disabled = true;
    boton.setAttribute("aria-busy", "true");

    try {
      const r = await SenecaPeticion.obtenerPantalla(tab.id, SenecaPeticion.TEXTO_ENLACE_GRUPOS);
      vista = AlumnadoVista.vistaDeGrupos(
        r.ok ? SenecaGruposAlumnos.extraerGrupos(r.html) : { error: r.error || SenecaPeticion.ERROR_INESPERADO }
      );
    } catch (e) {
      vista = AlumnadoVista.vistaDeGrupos({ error: SenecaPeticion.ERROR_INESPERADO });
    } finally {
      cargando.hidden = true;
      boton.removeAttribute("aria-busy");
      boton.disabled = false;
      reintentar.disabled = false;
      pintarTodo();
    }

    const primera = lista.querySelector("button.grupo");
    if (primera) primera.focus();
    else if (vista.error !== "") reintentar.focus();
  }

  boton.addEventListener("click", () => {
    // Si la lista ya está cargada no se repite la petición: solo se vuelve a ella.
    if (vista && vista.error === "" && vista.grupos.length > 0) {
      const primera = lista.querySelector("button.grupo");
      if (primera) primera.focus();
      else boton.focus();
      return;
    }
    cargar();
  });

  reintentar.addEventListener("click", () => {
    cargar();
  });
}

main();
