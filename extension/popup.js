"use strict";

// Detects whether the active tab is inside Seneca (RF-01, RF-03 of
// REQUISITOS.md) and renders the utility menu accordingly.
// The diagnostic button (T7) runs a background GET inside the Seneca page
// and shows the report only in this popup.

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
    const boton = document.getElementById("diagnostico");
    const salida = document.getElementById("diagnostico-salida");
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      salida.hidden = false;
      salida.textContent = "";
      await Diagnostico.ejecutar(tab.id, salida);
      boton.disabled = false;
    });
  } else {
    estado.textContent = "La extensión solo funciona dentro de Séneca.";
    aviso.textContent =
      "Abre Séneca (seneca.juntadeandalucia.es) con tu sesión iniciada " +
      "y pulsa de nuevo este botón.";
    aviso.hidden = false;
  }
}

main();
