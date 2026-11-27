# Alumnado → selector «Grupo - Materia»

Primera utilidad de «Ayudante de Séneca»: tras «Alumnado», el docente elige
uno de sus grupos como «Grupo - Materia» (extraído de su pantalla de Séneca)
y, después, se le ofrecen informes. Especificación que leen los trabajadores;
leer hasta `## Log`. Marco obligatorio: `REQUISITOS.md`.

## Specs

- **S1** (verbatim del propietario, L5): «No es un informe todavía, lo que
  quiero es que después de alumnado, salgan los grupos a elegir como "Grupo -
  Materia" y eso se saca de este menú. Después de seleccionar el grupo y
  materia se darán opciones de informes». Las opciones de informes concretas
  están fuera de esta feature.
- **S2** (verbatim del propietario, L4): «de aquí lo importante es la columna
  "Alumnado de" que contiene texto separado por "/" lo importante es el tercer
  elemento que es el grupo. Después la columna "Materia" tiene la asignatura
  que se imparte a ese grupo (a un grupo se le pueden dar varias
  asignaturas)». Implementación robusta: separar por ` / ` tras normalizar
  `&nbsp;`/`<br>` y tomar el grupo como penúltimo elemento (el último es «N
  alumnos\as»), que coincide con el tercero en el formato actual; comprobar
  que el elemento de la materia coincide con la columna «Materia».
- **S3** Datos por GET confirmados por el propietario (L3). La URL es un
  token opaco `nav/<token>` y los enlaces del menú `../menus/<token>`: no se
  guarda ninguna URL fija; se localiza el enlace por su texto visible.
- **S4** Fixtures: nunca datos reales en el repositorio (RT-05, RT-09). El
  anonimizador conserva bytes (Windows-1252) y usa lista blanca: solo la
  tabla de datos entra en el fixture.
- **S5** La petición en segundo plano no puede alterar la vista ni la sesión
  del docente (RF-15, D9). Debe comprobarse en vivo que el estado de
  navegación del servidor no cambia y que la cookie de sesión se envía.

## Tasks

| ID | Spec | Ruta | Commit |
| --- | --- | --- | --- |
| T1 | S1 | esqueleto MV3 + panel | ae09a68 |
| T2 | S4 | `tools/anonymize.js` + test (primera versión) | 95697ca |
| T3 | S2, S3 | captura del propietario recibida | — (gitignored) |
| T6 | S4 | anonimizador: codificación + NIE + lista blanca de tabla; fixture `tests/fixtures/`; `npm test` | d9d69e7, 13cc967, 6cdf17e, 23bc77b |
| T7 | S5 | prueba en vivo: fetch en segundo plano (content script, mismo origen) sin efectos en la sesión | pendiente |
| T4 | S2, S3 | adaptador «Materias que imparte» → lista de `{grupo, materia, alumnos}` con tests | pendiente |
| T5 | S1 | panel: Alumnado → lista «Grupo - Materia» → selección (informes pendientes) | pendiente |
| T9 | — | limpieza: host `seneca.` solamente, gecko id, error de tabs, coherencias de REQUISITOS | pendiente |

## Log

- **L1** (verbatim): «Vale, la extensión tiene que tener una sección que sea
  informes -> Alumnado -> Grupo de alumnos. Este grupo de alumnos hay que
  extraerlo de Séneca de una ruta. ¿Como hacemos esto? Como te lo paso y como
  voy probando a la vez la extensión?»
- **L2** Protocolo: URL sin tokens + Ctrl+S «Solo HTML» en
  `fixtures-entrada/` (gitignored) + anonimización antes del repositorio.
- **L3** Ruta aportada: `https://seneca.juntadeandalucia.es/seneca/nav/<token>`
  (token omitido por ser opaco y posiblemente de sesión). Datos por GET.
- **L4** (verbatim): «Guardada, de aquí lop importante es la columna "Alumnado
  de" que contiene texto separado por "/" lo importante es el tercer elemento
  que es el grupo. Después la columna "Materia" tiene la asignatura que se
  imparte a ese grupo (a un grupo se le pueden dar varias asignaturas)»
- **L5** (verbatim): «No es un informe todavía, lo que quiero es que después
  de alumnado, salgan los grupos a elegir como "Grupo - Materia" y eso se saca
  de este menú. Después de seleccionar el grupo y materia se darán opciones de
  informes»
- **L6** Revisión del nuevo orquestador: el anonimizador rompía 115
  caracteres (UTF-8 frente a Windows-1252), no cubría NIE ni cabecera ni
  tokens; «solo GET» no prueba la ausencia de efectos en una sesión con
  estado de navegación en el servidor. El propietario autorizó aplicar todo
  en orden: T6 → T7 → T4 → T5 → T9.
- **L7** Reinicio del equipo durante R3-NUMERIC-TRAILING: el arreglo de la
  expresión era correcto; el test fallaba porque contaba el `1252` de la
  cabecera fija `charset="windows-1252"`. La aserción ahora mira solo la
  tabla. RED con la expresión anterior, GREEN 21/21. T6 cerrada en 23bc77b.
- **L8** Límite de corte: la rama suma ~1416 líneas en 6 commits desde
  `main` (T1, T2, T6). Al publicar, proponer PR encadenados por tarea.
