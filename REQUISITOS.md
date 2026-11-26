# Requisitos — «Ayudante de Séneca» (extensión de navegador)

> Estado: borrador v1 para validación. Nombre provisional del producto.
> Audiencia de este documento: el equipo de desarrollo y docentes colaboradores.

## 1. Visión y objetivo

Una extensión de navegador sencilla, en español y para cualquier docente (sin
exigencia tecnológica ni de edad), que reduce a uno o dos clics las tareas
frecuentes y repetitivas de la plataforma Séneca
(https://seneca.juntadeandalucia.es/seneca/jsp/portal/): descargar datos,
generar informes y exportar listados.

Principios rectores, en orden de prioridad:

1. **Privacidad absoluta**: la información es altamente sensible (datos de
   menores, datos del profesorado). Todo el procesamiento es 100 % local,
   dentro del navegador. Ningún dato sale del equipo del docente.
2. **Simplicidad**: cualquier docente debe poder usarla sin formación previa.
3. **Fiabilidad bajo cambios**: Séneca es un portal JSP que cambia sin previo
   aviso; la extensión se degrada con mensajes claros, nunca con fallos
   silenciosos.
4. **Nunca estorba**: la extensión mejora la web de Séneca, no la altera ni
   interfiere con su funcionamiento normal.

## 2. Público objetivo

- Docentes de centros públicos y concertados de Andalucía con cuenta Séneca.
- Sin conocimientos técnicos. Rango de edad amplio.
- Con perfiles distintos en Séneca (docente sin tutoría, tutor, dirección,
  orientación, etc.): cada perfil ve opciones y pantallas diferentes. La
  extensión se adapta a cada perfil (ver RF-07).
- Ya autenticados en Séneca: la extensión **nunca** gestiona credenciales,
   inicios de sesión ni contraseñas.

## 3. Alcance y fuera de alcance

### Dentro de alcance (v1)

- **Solo lectura**: extraer, formatear y descargar información ya visible para
  el docente en Séneca. La extensión nunca modifica, envía ni borra datos
  dentro de Séneca.
- Módulos priorizados por el docente propietario:
  1. Exportar datos del alumnado (listas de clase con y sin fotos, datos de
     contacto, grupos).
  2. Evaluación y actas (calificaciones, informes de evaluación, boletines,
     sesiones de evaluación).
  3. Faltas y convivencia (faltas de asistencia, justificaciones, informes de
     convivencia y sanciones).
- Navegadores: Chrome, Edge, Brave y Firefox.

### Fuera de alcance (v1)

- **Automatizar acciones que escriban en Séneca** (rellenar actas, marcar
  faltas, enviar formularios). Decisión explícita: v1 es solo lectura; la
  escritura se valora en una fase futura con confirmación explícita paso a
  paso.
- Inicio de sesión, recuperación de contraseñas, gestión de credenciales.
- Guardias, horarios y sustituciones (candidato a fase posterior).
- Safari (requeriría empaquetado con Xcode; se valora más adelante).
- Aplicaciones móviles; sincronización con nube; trabajo colaborativo.
- Portales relacionados (eLVIs, iPasen, PASEN) salvo como fase futura.

## 4. Requisitos funcionales (RF)

Prioridad: **[M]** imprescindible v1 · **[S]** deseable v1 · **[C]** futuro.

### Activación y contexto

- **RF-01 [M] Activación contextual.** La extensión solo se activa en páginas
  de `seneca.juntadeandalucia.es`. Fuera de Séneca, el icono aparece en gris y
  el panel explica por qué no está activa.
- **RF-02 [M] Detección de sesión.** La extensión funciona únicamente cuando
  el docente ya tiene la sesión de Séneca iniciada. Si la sesión ha caducado,
  muestra: «Tu sesión de Séneca ha caducado. Vuelve a entrar y pulsa de nuevo
  este botón». Nunca solicita ni almacena contraseñas.
- **RF-03 [M] Detección de módulo.** El panel identifica en qué módulo de
  Séneca se encuentra la pestaña activa (p. ej. listado del alumnado, actas,
  faltas) y ofrece las tareas disponibles para ese módulo. Si la página actual
  no corresponde a ninguna tarea, muestra las tareas generales disponibles y
  cómo llegar a cada módulo desde el menú de Séneca.
- **RF-07 [M] Adaptación al perfil del docente.** Las opciones de Séneca
  dependen del perfil con el que se haya iniciado sesión (docente sin tutoría,
  tutor, dirección, orientación, etc.). La extensión no asume un perfil fijo
  ni mantiene listas fijas de «qué perfil puede hacer qué»: determina qué
  tareas están disponibles a partir de lo que la sesión actual realmente
  muestra (menús, pantallas y permisos visibles en cada momento).
  - Las tareas no disponibles para el perfil activo no se ofrecen, o se
    muestran desactivadas con explicación clara: «esta utilidad requiere
    perfil de tutor».
  - Ninguna utilidad intenta acceder a páginas que el perfil no tiene
    permitidas ni «adivina» si un permiso existe: si la pantalla no está, la
    tarea no se ofrece.
  - La ayuda integrada por utilidad (RF-05) indica desde qué perfiles es
    accesible la pantalla de origen en Séneca.
  - Además de variar entre perfiles, los nombres de menú pueden variar entre
    centros: los casos variables se resuelven con la asignación manual de
    RF-14, siempre a partir de los menús que la sesión realmente muestra.
  - Dentro de Séneca se puede **cambiar de perfil sin cerrar la sesión**:
    por eso la disponibilidad de tareas se recalcula cada vez que se abre el
    panel o cambia la pestaña/página. La extensión nunca asume que el perfil
    permanece fijo durante la sesión ni cachea permisos entre usos.

### Panel de utilidades

- **RF-04 [M] Panel único y sencillo.** Un único panel (popup al pulsar el
  icono) lista las utilidades disponibles. Máximo 3 clics desde abrir el panel
  hasta descargar el resultado.
- **RF-05 [M] Ayuda integrada por tarea.** Cada utilidad incluye una
  descripción de una frase: «Qué hace» y «Desde dónde: menú X → opción Y de
  Séneca». Sin jerga técnica.
- **RF-06 [C] Recientes.** El panel recuerda las últimas utilidades usadas
  para mostrarlas primero.

### Utilidades v1

- **RF-10 [M] Exportar datos del alumnado.**
  - Entrada: listado del alumnado de un grupo visible en Séneca.
  - Salida: lista de clase en PDF lista para imprimir (con o sin fotos, a
    elegir), y hoja de cálculo (XLSX/CSV) con nombre, apellidos y columnas de
    datos de contacto disponibles en la página.
  - Incluye vista previa antes de descargar.
- **RF-11 [M] Evaluación y actas.**
  - Exportar las calificaciones de un grupo/materia a hoja de cálculo con
    formato de acta (orden alfabético, columnas por evaluación o criterio
    según la pantalla de origen).
  - Descargar en un solo paso informes/boletines ya generados en Séneca que
    hoy requieren navegar varios niveles y abrirlos uno a uno.
- **RF-12 [M] Faltas y convivencia.**
  - Resumen de faltas de asistencia de un grupo (totales por alumno, tipo de
    falta) en hoja de cálculo, para consultar o pegar en otros informes
    oficiales que exige la burocracia.
  - Informes de convivencia/sanciones con la misma mecánica. Ojo: el menú
    de convivencia varía entre centros y perfiles (ver RF-14).
- **RF-13 [S] Personalización ligera.** Elegir qué columnas incluir en la
  exportación (p. ej. quitar fotos o teléfonos) con casillas simples. Sin
  pantallas de configuración complejas.
- **RF-14 [M] Menús que varían por centro.** Algunas pantallas de Séneca se
  alcanzan por menús cuyo nombre o perfil cambia entre centros (p. ej. el
  seguimiento de convivencia, que en el centro de referencia se llama
  «Part Centros Seguimiento de Convivencia» y se usa con el perfil
  «Tutoría F»). Cuando la extensión no localice el menú esperado:
  - Muestra los menús que la sesión actual realmente tiene y pide una
    única elección: «¿Cuál de estos menús es el seguimiento de convivencia?».
    Nunca texto libre, URLs ni rutas técnicas.
  - La elección se recuerda para futuros usos y puede cambiarse desde el
    panel («cambiar menú asignado»).
  - Si el docente no encuentra el menú porque su perfil no lo tiene, la
    utilidad queda desactivada con explicación (RF-07).
- **RF-15 [M] Trabajo invisible en segundo plano.** Cuando el docente pide
  algo a través de la extensión, **su vista de Séneca no cambia**: la tarea se
  ejecuta por detrás, sin moverlo de la pantalla en la que está.
  - La extensión nunca navega la pestaña del docente ni simula clics en la
    interfaz visible para llegar a los datos.
  - Los datos se obtienen con peticiones GET en segundo plano desde la
    propia extensión a páginas de Séneca (mismo dominio, con la sesión ya
    iniciada), se analizan fuera de pantalla y solo se muestran en el panel.
  - La pestaña activa se usa como contexto (RF-03), pero ninguna tarea exige
    navegar a una página concreta para poder ejecutarse.
- **RF-18 [M] Sesión caducada durante una tarea.** Si alguna petición en
  segundo plano devuelve la pantalla de acceso de Séneca (sesión caducada a
  mitad de una tarea larga), la tarea se detiene inmediatamente: no se hacen
  más peticiones, se avisa con mensaje claro («tu sesión ha caducado; vuelve
  a entrar y repite la tarea») y se ofrece descargar lo ya obtenido,
  siempre marcado como «resultado parcial» en el propio documento.
- **RF-19 [M] Ritmo y reintentos acotados.** Las peticiones en segundo plano
  van en serie con pausas breves (máximo una o dos simultáneas); como mucho
  dos reintentos por petición fallida y sin bucles automáticos. Un fallo de
  red persistente se convierte en un mensaje accionable (RF-24).

### Informes y plantillas (Typst)

- **RF-16 [M] Informes con plantilla Typst.** Los informes en PDF se generan
  con Typst a partir de una **plantilla predefinida** empaquetada en la
  extensión.
  - La plantilla es un recurso separado del código: ajustar diseño (márgenes,
    tablas, encabezados, pie con curso y fecha) no exige tocar la lógica de
    extracción ni reescribir adaptadores.
  - La plantilla evoluciona **poco a poco, versión a versión**, según lo que
    pidan los docentes; cada cambio de plantilla se versiona en el
    repositorio con su motivo.
- **RF-17 [M] Datos rellenados, nunca adivinados.** La plantilla solo
  rellena los campos que el adaptador extrajo; un dato ausente se muestra
  vacío y señalizado («—»), nunca inventado ni estimado (consistente con
  RC-04).

### Exportación y resultados

- **RF-20 [M] Formatos de salida.** XLSX/CSV para datos tabulares, PDF para
  listas e informes (generados con Typst, ver RF-16), y opción «imprimir»
  para reusar el diálogo del navegador.
- **RF-21 [M] Nombres de archivo descriptivos.** P. ej.
  `Lista_1ºESO-A_2025-10-01.pdf`, no `documento(3).pdf`.
- **RF-22 [M] Vista previa obligatoria.** Antes de descargar, la extensión
  muestra una previsualización (tabla o miniatura del PDF) con botones claros:
  «Descargar» / «Cancelar». Nunca descarga sin que el docente lo confirme.
- **RF-23 [M] Progreso visible.** Las tareas largas (pedir varias páginas en
  segundo plano, RF-15) muestran una barra o contador de progreso y pueden
  cancelarse en cualquier momento.
- **RF-24 [M] Mensajes de error accionables.** Ante cualquier problema: qué
  falló, qué puede hacer el docente («no encuentro la tabla de calificaciones;
  comprueba que estás en X e inténtalo de nuevo»). Prohibido mostrar
  trazas técnicas o mensajes en inglés.

## 5. Requisitos de privacidad y seguridad (RP)

Estos requisitos son de cumplimiento obligatorio; ningún requisito funcional
puede contradecirlos.

- **RP-01 [M] Procesamiento 100 % local.** Toda la extracción, formateo y
  generación de archivos ocurre en el navegador del docente. La extensión no
  contiene ni realiza ninguna comunicación de red hacia servidores propios o
  de terceros: sin analytics, sin telemetría, sin mapas de calor, sin fuentes
  remotas de tipografía o CDN, sin actualizaciones de recursos desde la web.
- **RP-02 [M] Cero credenciales.** La extensión no solicita, almacena,
  procesa ni ve contraseñas. Funciona exclusivamente con la sesión que el
  docente ya tiene abierta.
- **RP-03 [M] Minimización de permisos.** El manifiesto solo pide los
  permisos imprescindibles: acceso a `*.juntadeandalucia.es`, almacenamiento
  local de la propia extensión y descargas. Sin permisos de «leer y cambiar
  todos tus datos en todos los sitios web», sin pestañas, sin historial.
- **RP-04 [M] Sin persistencia por defecto.** Los datos extraídos viven en
  memoria durante la tarea y desaparecen al cerrar el panel. Los datos solo
  se guardan cuando el docente pulsa «Descargar» y el navegador los guarda en
  su carpeta de descargas, como cualquier otro archivo. Única excepción:
  preferencias de uso no personales y sin datos del alumnado (p. ej. la
  asignación de menús de RF-14), guardadas solo en el almacenamiento local de
  la propia extensión y borrables con «Olvidar todo» (RP-08).
- **RP-05 [M] Datos de menores.** El proyecto se rige por el RGPD y la
  LOPDGDD como diseño base: minimización, no registro de datos personales en
  logs, y documentación clara para el docente de qué datos maneja la
  extensión y hasta cuándo.
- **RP-06 [M] Política de contenido estricta.** CSP sin `eval`, sin código
  remoto, sin scripts de terceros sin auditar. Cualquier librería usada se
  empaqueta dentro de la extensión y se justifica.
- **RP-07 [M] Garantía de solo lectura.** La extensión jamás envía
  formularios, peticiones POST de modificación ni simulaciones de clics que
  guarden cambios en Séneca. Arquitectura revisada para impedirlo por
  construcción, no solo por promesa. El trabajo en segundo plano (RF-15) usa
  exclusivamente peticiones GET de una lista blanca declarada por cada
  adaptador; cualquier URL o método fuera de esa lista se rechaza sin
  ejecutarse.
- **RP-08 [S] Botón «Olvidar todo».** Un botón en el panel borra
  instantáneamente cualquier dato que la extensión pudiera tener en memoria o
  en su almacenamiento local, y lo confirma con un mensaje claro.
- **RP-09 [M] Declaración de privacidad.** Texto de privacidad en español,
  apto para no técnicos, visible desde la ficha de la tienda y desde el
  panel: «Nada de lo que ves en Séneca sale de tu ordenador».

## 6. Requisitos de compatibilidad (RC)

- **RC-01 [M] Chrome, Edge y Brave.** Base común Manifest V3. Un único código
  fuente, sin bifurcaciones por navegador salvo ajustes de manifiesto.
- **RC-02 [M] Firefox.** Mismo código base con ajustes de manifiesto
  (identificador de navegador, adaptaciones menores de API). Publicada en
  Add-ons de Mozilla (AMO).
- **RC-03 [M] Solo con sesión iniciada.** Sin sesión, la extensión no intenta
  nada: informa (RF-02) y se detiene.
- **RC-04 [M] Tolerancia a cambios de Séneca.**
  - Cada módulo de Séneca se lee mediante un «adaptador» independiente; si un
    módulo cambia, los demás siguen funcionando.
  - Si un adaptador no encuentra lo esperado, la extensión muestra un aviso
    claro y una forma de notificar la incidencia (enlace tipo issue o correo
    público) para corregirla en la siguiente versión.
  - Nunca inventa ni rellena datos dudosos: si un dato no está, la columna o
    celda queda vacía y señalizada, no adivinada.
- **RC-05 [M] No interferencia.** La extensión no modifica el DOM visible de
  Séneca, no inyecta banners salvo indicaciones propias mínimas y desactivables,
  y no cambia estilos de la web. Tampoco navega la pestaña del docente para
  ejecutar tareas: el trabajo ocurre en segundo plano (RF-15). Séneca debe
  verse y funcionar igual con o sin la extensión instalada.

## 7. Requisitos de usabilidad y accesibilidad (RU)

- **RU-01 [M] Español llano.** Toda la interfaz en español de España, sin
  jerga informática. Términos de centro educativo (grupo, acta, boletín,
  evaluación) tal y como los usa el profesorado.
- **RU-02 [M] Tres clics máximo.** Abrir panel → elegir utilidad →
  descargar. Ninguna tarea exige pasos intermedios innecesarios.
- **RU-03 [M] Accesibilidad WCAG 2.1 AA.** Contraste suficiente, navegación
  completa por teclado, etiquetas para lectores de pantalla, botones grandes,
  texto escalable, iconos siempre acompañados de texto (nunca solo iconos).
- **RU-04 [M] Estados claros.** Cada utilidad tiene cuatro estados visibles
  con mensajes distintos: lista para usar, trabajando (con progreso), lista de
  resultado (con vista previa) y error (con qué hacer).
- **RU-05 [M] Onboarding mínimo.** La primera vez que se abre el panel tras
  instalar, se muestran tres frases: qué hace, que nada sale del ordenador y
  cómo pedir ayuda. Nada más.
- **RU-06 [S] Fuente y tamaño ajustables** desde el propio panel para
  docentes con visión reducida.

## 8. Requisitos técnicos (RT)

- **RT-01 [M] Arquitectura de adaptadores.** Separación estricta:
  - Capa «adaptadores de lectura»: un módulo por zona de Séneca que convierte
    en datos estructurados (JSON interno) las páginas que obtiene con
    peticiones GET en segundo plano y analiza fuera de pantalla, sin tocar
    la pestaña del docente (RF-15). Cada adaptador declara su lista blanca
    de URLs (RP-07).
  - Capa «formateadores»: convierten JSON a XLSX, CSV o PDF.
  - Capa «presentación»: panel y vistas previas.
  Cada adaptador se prueba y se rompe de forma aislada (ver RC-04).
- **RT-02 [M] Manifest V3** con service worker mínimo y sin estado persistente
  en él; los datos viven en la pestaña y en el panel.
- **RT-03 [M] Código común multi-navegador** con un build que genera dos
  manifiestos (Chromium y Firefox) a partir de una sola base. Sin duplicar
  lógica por navegador.
- **RT-04 [M] Dependencias mínimas y empaquetadas.** Solo librerías
  auditables, incluidas dentro de la extensión (nada cargado por red, ver
  RP-06). Justificar cada una en el README.
- **RT-05 [M] Tests de adaptadores con fixtures anónimos.** Cada adaptador se
  prueba contra copias de HTML de Séneca previamente anonimizadas (nombres
  inventados), guardadas en el repositorio. Nunca datos reales en el
  repositorio ni en los tests. Los tests comprueban: extracción correcta,
  páginas con datos ausentes y cambios de estructura (degradación controlada).
  Se incluye al menos un fixture por perfil relevante (docente sin tutoría,
  tutor, dirección) para verificar que la extensión solo ofrece las tareas
  que cada perfil realmente ve (RF-07).
- **RT-06 [M] Versionado semántico y registro de cambios** legible por
  docentes: «qué se ha arreglado» en español en cada versión.
- **RT-07 [S] Registro de diagnóstico local** activable por el docente con un
  clic («modo avería»), que solo sale de su ordenador si él decide copiarlo y
  pegarlo, y que avisa de no incluir datos personales.
- **RT-08 [M] Motor Typst local.** Los PDF se generan con Typst compilado a
  WebAssembly (p. ej. typst.ts) y **empaquetado dentro de la extensión**:
  compila en el propio navegador, sin ninguna comunicación de red (RP-01).
  **El docente no necesita Typst ni nada instalado en su equipo**: el
  compilador viaja dentro de la extensión y se actualiza con ella.
  - CSP de las páginas de la extensión con `'wasm-unsafe-eval'` como único
    permiso adicional, justificado en el expediente de tienda (RD-02).
  - Fuentes tipográficas también empaquetadas: nada se descarga al generar.
  - La compilación se prueba en los tests de adaptadores con los mismos
    fixtures anonimizados (RT-05).
- **RT-09 [M] Procedimiento de captura y anonimización de fixtures.**
  Workflow documentado y verificación automática: capturar el HTML con la
  sesión del propio docente → anonimizar (nombres, DNIs, teléfonos, correos,
  direcciones → datos inventados) → verificación automática de patrones
  sensibles antes de permitir el commit. Ningún fixture entra al repositorio
  sin pasar esa verificación.

## 9. Requisitos de distribución (RD)

- **RD-01 [M] Tienda oficial como canal principal.** Publicación en Chrome
  Web Store y Firefox AMO para obtener auto-actualización y revisión de
  seguridad del canal.
- **RD-02 [M] Expediente de tienda.** Ficha con capturas, descripción en
  español, política de privacidad (RP-09) y justificación clara del permiso
  sobre `juntadeandalucia.es` («solo funciona dentro de Séneca, que es donde
  están tus datos») y del uso de WebAssembly local para generar los PDF
  (RT-08), único permiso adicional de CSP.
- **RD-03 [S] Instrucciones de instalación guiada** paso a paso con capturas
  para docentes sin experiencia.
- **RD-04 [M] Canal de ayuda y avisos de incidencias** (p. ej. repositorio
  público con issues) enlazado desde el panel y desde la ficha de la tienda.
- **RD-05 [M] Sin anuncios, sin cuentas, sin pagos.** La extensión es
  gratuita, no requiere registro y no cobra nada, y así debe decirlo la ficha.
- **RD-06 [M] Identidad no oficial.** La ficha, el panel y el README indican
  claramente que es una herramienta independiente creada por docentes, **sin
  relación oficial con la Consejería de Educación de la Junta de Andalucía**
  ni respaldada por ella, y no se usan logotipos ni imagen oficial de Séneca
  o de la Junta.
- **RD-07 [S] FAQ para direcciones y DPO.** Documento breve en español que
  responde a lo que preguntará quien deba autorizar la extensión en un
  centro: qué datos toca, qué no hace, dónde vive la información y por qué
  nada sale del navegador.

## 10. Criterios de aceptación generales

La v1 se considera completa cuando:

1. Un docente con sesión iniciada, sin leer nada previo, descarga una lista
   de clase en PDF con menos de 3 clics.
2. Las tres familias de tareas (RF-10, RF-11, RF-12) funcionan en las
   pantallas acordadas de Séneca, con vista previa y nombres de archivo claros.
3. Un análisis de red de la extensión (p. ej. con las herramientas de
   desarrollo del navegador) demuestra cero peticiones externas mientras se
   usa; solo las peticiones que el propio Séneca hace.
4. Con sesión caducada o fuera de Séneca, la extensión informa y no hace
   nada más (RF-01, RF-02).
5. Al romper artificialmente un selector en un fixture, la extensión avisa
   con un mensaje claro y el resto de utilidades sigue funcionando (RC-04).
6. Se publica en Chrome Web Store y en AMO con ficha y privacidad en español.
7. Los tests de adaptadores pasan con fixtures anonimizados y sin datos
   reales en el repositorio.
8. Con sesiones de perfiles distintos (p. ej. docente sin tutoría, tutor,
   dirección), el panel solo ofrece las tareas que cada perfil realmente ve
   (RF-07), con explicación clara cuando una tarea requiere otro perfil.

## 11. Riesgos conocidos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Séneca cambia su estructura sin aviso y las utilidades se rompen | Adaptadores aislados (RT-01), aviso claro + canal de incidencias (RC-04), versión corregida rápida vía tienda |
| Cambios de políticas de Séneca o la Junta sobre herramientas de terceros | Solo lectura, sin credenciales, sin red externa: la extensión no hace nada que el docente no pueda hacer a mano |
| Datos de menores expuestos por un descuido de diseño | Sin persistencia por defecto (RP-04), sin logs con datos (RT-07), fixtures anonimizados (RT-05), revisión de privacidad en cada versión |
| Permisos amplios rechazados por las tiendas o desconfianza del usuario | Permisos mínimos y justificados (RP-03, RD-02) |
| Público poco técnico abandona al primer problema | Mensajes accionables (RF-24), ayuda integrada (RF-05), onboarding de 3 frases (RU-05) |
| Perfiles distintos (tutor, docente, dirección…) ven opciones diferentes en Séneca | Derivar la disponibilidad de tareas de lo que la sesión muestra realmente, nunca de listas fijas de perfiles (RF-07); fixtures por perfil en tests (RT-05) |
| Las peticiones en segundo plano pudieran considerarse uso automatizado por Séneca | Solo GET a `juntadeandalucia.es` con la sesión existente, lista blanca por adaptador (RP-07), ritmo moderado y tarea cancelable (RF-23): mismo tipo de acceso que el navegador al navegar, sin credenciales y sin escrituras |
| Motor WASM (Typst): tamaño de la extensión y revisión de tiendas por CSP especial | Motor y fuentes empaquetados y auditados (RP-06, RT-08), justificación explícita en ficha (RD-02), tamaño comprimido razonable y pruebas de compilación en tests (RT-05) |
| Algunos informes de Séneca pueden generarse mediante POST, hoy prohibido por RP-07 | Medir los flujos reales en la Fase 0 (D11): las descargas que exijan POST quedan fuera de v1 o se tratan aparte con revisión específica |

## 12. Fases sugeridas

- **Fase 0 — Validación de requisitos.** Este documento revisado con docentes
  reales: confirmar qué pantallas exactas de Séneca son las dolorosas para
  fijar los adaptadores concretos de cada utilidad. Perfiles disponibles de
  momento para validar: «Profesorado» y «Tutoría F» (convivencia; menú
  «Part Centros Seguimiento de Convivencia»). Queda pendiente validar con
  otros perfiles (dirección, orientación) y con centros donde el menú de
  convivencia tenga otro nombre (RF-14). Además se medirá con datos reales
  qué flujos de Séneca usan GET y cuáles POST (decisión D11).
- **Fase 1 — Núcleo.** RF-01 a RF-04, RF-10 (alumnado) completo, exportación
  con vista previa (RF-20 a RF-24), motor Typst local y primera plantilla
  (RF-16, RT-08), marco de adaptadores y tests con fixtures.
- **Fase 2 — Evaluación y faltas.** RF-11 y RF-12 sobre el núcleo.
- **Fase 3 — Publicación.** RD-01 a RD-05, accesibilidad auditada (RU-03),
  expedientes de tienda.
- **Fase posterior (valorar)**: escritura en Séneca con confirmación paso a
  paso, guardias/horarios, Safari.

---

## Registro de decisiones

- **D1 (2025-…, propietario del proyecto).** v1 es **solo lectura**: la
  extensión extrae y descarga, nunca modifica datos en Séneca.
- **D2.** Tareas prioritarias v1: datos del alumnado, evaluación y actas,
  faltas y convivencia. Guardias y horarios quedan para fase posterior.
- **D3.** Navegadores v1: Chrome, Edge, Brave y Firefox (Manifest V3 común).
  Safari fuera de alcance v1.
- **D4.** Distribución por tienda oficial (Chrome Web Store y AMO).
- **D5.** A petición del propietario: las opciones de Séneca dependen del
  perfil de sesión (tutor, docente, dirección, etc.). La extensión se adapta
  derivando las tareas disponibles de lo que cada sesión realmente muestra,
  nunca de listas fijas de perfiles (RF-07).
- **D6.** Perfiles disponibles para validar en la Fase 0: «Profesorado» y
  «Tutoría F» (usado en el centro de referencia para convivencia; puede
  variar entre centros; da acceso al menú «Part Centros Seguimiento de
  Convivencia»). Requisito añadido a petición del propietario: cuando el
  perfil o menú de convivencia sea distinto en otro centro, el docente debe
  poder especificarlo — resuelto con la asignación manual de menús visibles
  (RF-14), sin texto libre ni URLs.
- **D7.** Dato del propietario: dentro de Séneca se puede cambiar de perfil
  sin volver a iniciar sesión. Por tanto la disponibilidad de tareas se
  recalcula en cada apertura del panel o cambio de página (RF-07); nunca se
  cachea por sesión.
- **D8.** Política de git (petición del propietario): todo el trabajo se
  registra en git; cada funcionalidad nueva se desarrolla en su propia rama
  (p. ej. `feat/exportar-alumnado`); `main` queda reservado para la versión
  estable verificada. Los avances se integran en `main` solo cuando la
  funcionalidad está terminada y comprobada.
- **D9.** Petición del propietario: las tareas pedidas a través de la
  extensión no deben modificar la vista del docente. Se ejecutan por detrás
  con peticiones en segundo plano (RF-15), exclusivamente GET de lista
  blanca declarada por adaptador (RP-07), analizando las respuestas fuera
  de pantalla.
- **D10.** Petición del propietario: los informes se generan con **Typst**
  a partir de una plantilla predefinida que se ajusta poco a poco, versión a
  versión (RF-16). Compilación 100 % local con Typst en WebAssembly
  empaquetado (RT-08).
- **D11.** Decisión del propietario: medir en la Fase 0 qué flujos de Séneca
  usan GET y cuáles POST antes de cerrar el alcance de v1; mientras tanto
  RP-07 se mantiene sin cambios (solo GET). Las descargas que exijan POST
  quedan fuera de v1 o se tratan aparte con revisión específica.
- **D12.** Decisión del propietario: el repositorio se publica bajo licencia
  **GPL-3.0** (copyleft: cualquier derivado debe seguir siendo abierto).
