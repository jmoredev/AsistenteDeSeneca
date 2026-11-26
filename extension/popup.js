"use strict";

// Detects whether the active tab is inside Seneca (RF-01, RF-03 of
// REQUISITOS.md) and renders the utility menu accordingly.
// Read-only context detection: nothing is fetched from Seneca yet.

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
  } else {
    estado.textContent = "La extensión solo funciona dentro de Séneca.";
    aviso.textContent =
      "Abre Séneca (seneca.juntadeandalucia.es) con tu sesión iniciada " +
      "y pulsa de nuevo este botón.";
    aviso.hidden = false;
  }
}

main();
