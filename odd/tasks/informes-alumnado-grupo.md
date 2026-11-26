# Informes → Alumnado → Grupo de alumnos

Primera utilidad de «Ayudante de Séneca»: extraer el grupo de alumnos desde
su ruta en Séneca y generarlo como informe. Especificación que leen los
trabajadores; leer hasta `## Log`.

## Specs

- **S1** (petición verbatim del propietario): «la extensión tiene que tener
  una sección que sea informes -> Alumnado -> Grupo de alumnos. Este grupo de
  alumnos hay que extraerlo de Séneca de una ruta.»
- **S2** Entrada pendiente del propietario: ruta exacta de Séneca de esa
  pantalla (sin tokens de sesión) + HTML anonimizado capturado con
  `tools/anonymize.js` (protocolo RT-09). Con la ruta se anota si el flujo es
  GET o POST (decisión D11).
- **S3** Marco obligatorio: `REQUISITOS.md` — trabajo en segundo plano solo
  GET con lista blanca (RF-15, RF-19, RP-07), informe Typst con plantilla
  (RF-16, RF-17, RT-08), todo local (RP-01), datos nunca adivinados (RC-04).

## Tasks

| ID | Spec | Ruta | Commit |
| --- | --- | --- | --- |
| T1 | S1 | inline: esqueleto MV3 + panel con menú Informes→Alumnado→Grupo de alumnos y detección de contexto (RF-01/RF-03) | pendiente |
| T2 | S2 | inline: `tools/anonymize.js` + test (RT-09) | pendiente |
| T3 | S2 | entrada del propietario (ruta + HTML anonimizado) | bloqueada: espera al usuario |
| T4 | S1, S2 | adaptador grupo-alumnos con tests sobre el fixture | pendiente |
| T5 | S1 | plantilla Typst de lista de grupo + vista previa + descarga (RF-22) | pendiente |

## Log

- **L1** (verbatim): «Vale, la extensión tiene que tener una sección que sea
  informes -> Alumnado -> Grupo de alumnos. Este grupo de alumnos hay que
  extraerlo de Séneca de una ruta. ¿Como hacemos esto? Como te lo paso y como
  voy probando a la vez la extensión?»
- **L2** Protocolo acordado: el propietario copia la URL de la pantalla
  (eliminando tokens de sesión) y captura el HTML con Ctrl+S en
  `fixtures-entrada/` (gitignored); se anonimiza con `tools/anonymize.js`
  antes de que el contenido pueda entrar al repositorio.
