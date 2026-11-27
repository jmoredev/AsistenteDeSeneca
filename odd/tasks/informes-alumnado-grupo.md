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
- **S6** (verbatim del propietario, L9): «La prueba en vivo debe de mostrarme
  a mi localmente los errores y lo que se extrae para luego yo indicartelo
  pero no te debe de mandar nada de Séneca direcamente a ti, la información
  no puede salir de Internet.» El informe se pinta solo en el panel; ninguna
  petición sale a otro origen que Séneca; las URL se muestran con los tokens
  tapados.

- **S7** (verbatim del propietario, L16): «La primera vez que se use la extensión hay que hacer una carga inicial de datos para poder operar con ella, uno de esos datos es cargar los grupos de alumnos para despuñes poder elegir que queremos hacer con cada uno de ellos. Si posteriormente hay más elementos que son necesarios en la carga inicial te lo indicaré». Implementación: la
  carga inicial es una lista ampliable de elementos (hoy solo «Grupos de
  alumnos/as»); se guarda solo en el navegador (`chrome.storage.local`), con
  fecha de la última carga y un botón para volver a cargar; Alumnado lee los
  grupos guardados sin pedir a Séneca cada vez.

## Tasks

| ID | Spec | Ruta | Commit |
| --- | --- | --- | --- |
| T1 | S1 | esqueleto MV3 + panel | ae09a68 |
| T2 | S4 | `tools/anonymize.js` + test (primera versión) | 95697ca |
| T3 | S2, S3 | captura del propietario recibida | — (gitignored) |
| T6 | S4 | anonimizador: codificación + NIE + lista blanca de tabla; fixture `tests/fixtures/`; `npm test` | d9d69e7, 13cc967, 6cdf17e, 23bc77b |
| T7 | S5, S6 | prueba en vivo: botón de diagnóstico en el panel (`chrome.scripting`, mismo origen) que muestra localmente pasos, errores y extracción | 62f7502, 06c9903, 3a32d82, e712d1b · cerrada (L14, L15) |
| T4 | S2, S3 | 8b5ef9a · adaptador «Grupos de alumnos/as» → lista de `{grupo, materia, alumnos}` con tests | pendiente |
| T5 | S1 | panel: Alumnado → lista «Grupo - Materia» → selección (informes pendientes) | 0080d12 · falta prueba en vivo |
| T10 | S7 | carga inicial ampliable guardada en el navegador (D13); Alumnado lee de ella; «Actualizar datos»; «Olvidar todo» (RP-08) | 6e89112 · falta prueba en vivo |
| T9 | — | limpieza: host `seneca.` solamente, gecko id, error de tabs, coherencias de REQUISITOS; «Olvidar todo» también accesible en «Preparar la extensión» con datos incompletos o de otra versión; no perder la carga buena anterior si falla una nueva | pendiente |

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
- **L9** (verbatim): «La prueba en vivo debe de mostrarme a mi localmente los
  errores y lo que se extrae para luego yo indicartelo pero no te debe de
  mandar nada de Séneca direcamente a ti, la información no puede salir de
  Internet.»
- **L10** Mapa de la captura: el enlace del menú es `<a data-menulink="../menus/<token>"
  href="#" onclick="Navegacion.llamadaMenu(this)">Materias que imparte</a>`; la
  página registra su entrada de navegación con JS (`Navegacion.addEntradaNavegacion`)
  y «Volver» pide `PaginaVuelta.jsp`: hay pila de navegación en el servidor. Bytes
  en Windows-1252 aunque la meta diga UTF-8. Se desconoce si `menus/<token>`
  devuelve los datos o un paso intermedio: el diagnóstico sigue como mucho un
  salto inequívoco y lo informa.
- **L11** Diagnóstico en 62f7502. Revisión nativa `review-3639227bda884fa0`
  (alto): R3-001 (`<br>` pegaba elementos) corregido en 06c9903; el validador
  dirigido lo rechazó sin motivo visible → estado `escalated`, parada
  terminal `native_stop_required` (decisión del propietario antes de publicar).
  Endurecimiento posterior por S6 (R1-1, R3-002..005, R4-001, R1-2): solo
  origen `https://seneca.juntadeandalucia.es`, límite de 20 s, decisión de
  saltos en funciones puras con tests. Pendiente: prueba en vivo del propietario.
- **L12** Prueba en vivo (Brave): enlace en marco 0, `../menus/<token>`; un solo
  GET, HTTP 200, `text/html;charset=ISO-8859-1`, 123980 bytes, sin redirección;
  pantalla del docente sin cambios. Pero «Materias que imparte» devuelve una
  tabla `Unidad | Curso | Materia`, no la captura del propietario (h1 «GRUPO DE
  ALUMNOS/AS», columna «Alumnado de»): el enlace de L10 era solo el menú
  lateral de esa página. Error de interpretación del orquestador.
- **L13** Decisión del propietario: la lista «Grupo - Materia» sale de la
  pantalla «Grupo de alumnos/as» (la capturada). Su enlace del menú lateral
  es «Grupos de alumnos/as». El propietario lanzó la prueba desde la página
  principal sin moverse, así que la comprobación manual de «Volver»/menú
  sigue pendiente. El fixture `materias-que-imparte.html` tiene nombre
  equivocado: renombrar en T4.
- **L14** Segunda prueba en vivo (e712d1b, Brave, desde la página principal):
  enlace «Grupos de alumnos/as» en marco 0; un solo GET, HTTP 200,
  ISO-8859-1, 120517 bytes; 8 filas ✔ (1ESOA - MATE1 28, 1BACA - LENG1 20,
  1BACA - INGL1 23, 1BACA - TECN1 26, 2ESOB - HIST1 12, 2BACB - FISQ1 7, 4ESOX - MUSI1
  19, 4ESOY - MUSI1 28), idénticas al fixture; pantalla sin cambios. Pendiente:
  confirmación manual de menú/«Volver».
- **L15** (verbatim) Comprobación manual tras la petición en segundo plano:
  «Volver me devuelve a la pantalla anterior. Si navego un nivel pues me
  vuelve a la pantalla principal pero si navego dos inveles me devuelve al
  nivel anterior». Sin entrada fantasma en la pila del servidor: S5 cumplida.
- **L16** (verbatim): «La primera vez que se use la extensión hay que hacer una carga inicial de datos para poder operar con ella, uno de esos datos es cargar los grupos de alumnos para despuñes poder elegir que queremos hacer con cada uno de ellos. Si posteriormente hay más elementos que son necesarios en la carga inicial te lo indicaré»
- **L17** T5 en 0080d12. El trabajador detectó que 8b5ef9a (T4) había borrado
  `destinoDe` y roto el diagnóstico en vivo; arreglado en 0080d12 (salida del
  diagnóstico idéntica en 6 escenarios simulados). Lección: tras tocar el
  diagnóstico, volver a probarlo en vivo.
- **L18** Conflicto S7 vs RP-04 [M] (sin persistencia). Decisión del propietario:
  excepción acotada (D13 en REQUISITOS): guardar solo la carga inicial sin
  datos personales del alumnado, con «Olvidar todo» (RP-08) dentro de T10.
