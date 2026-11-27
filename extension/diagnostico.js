"use strict";

// T7 live diagnostic (S5, S6 of odd/tasks/informes-alumnado-grupo.md).
// The background request lives in seneca/peticion.js, shared with the
// «Alumnado» selector (T5): same origin, session cookie, 2 hops at most,
// 20 s timeout. This file only turns every step into the report printed in
// the popup: nothing leaves the browser and the teacher's page is untouched.

(function (raiz) {
  // The reading of the screen is the adapter's job (S1, S2): the same pure
  // code runs in the Node tests and here, without DOMParser.
  function informarExtraccion(html, decir) {
    const extraido = raiz.SenecaGruposAlumnos.extraerGrupos(html);
    if (extraido.error) {
      decir(`✖ ${extraido.error}`);
      return;
    }
    decir(`3. Extraído (${extraido.grupos.length} filas):`);
    for (const grupo of extraido.grupos) decir(`   ✔ ${grupo.etiqueta} (${grupo.alumnos} alumnos)`);
    for (const aviso of extraido.avisos) decir(`   ⚠ ${aviso}`);
  }

  async function ejecutar(tabId, salida) {
    const { enmascarar } = raiz.DiagnosticoAnalisis;
    const { TEXTO_ENLACE_GRUPOS, obtenerPantalla, textoDePaso } = raiz.SenecaPeticion;
    const lineas = [];
    const decir = (t) => {
      lineas.push(t);
      salida.textContent = lineas.join("\n");
    };

    try {
      const r = await obtenerPantalla(tabId, TEXTO_ENLACE_GRUPOS, {
        alPaso: (paso) => decir(textoDePaso(paso)),
      });

      if (r.html) informarExtraccion(r.html, decir);

      if (r.vistaIntacta !== null) {
        decir(r.vistaIntacta ? "4. ✔ Tu pantalla no ha cambiado." : "4. ✖ Tu pantalla ha cambiado durante la prueba.");
      }
      // Sin enlace no ha habido petición: se termina sin la comprobación manual.
      if (r.motivo === "sin-enlace" || r.motivo === "sin-destino") return;

      decir(
        "5. Comprobación manual: en Séneca pulsa «Volver» o abre otra opción del menú " +
          "y confirma que todo sigue como esperabas."
      );
    } catch (e) {
      decir(`✖ Error del diagnóstico: ${enmascarar((e && e.message) || e)}`);
    }
  }

  raiz.Diagnostico = { ejecutar };
})(globalThis);
