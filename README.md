# Ayudante de Séneca

Extensión de navegador (Chrome, Edge, Brave y Firefox) que ayuda al
profesorado de Andalucía con las tareas repetitivas de la plataforma
[Séneca](https://seneca.juntadeandalucia.es/seneca/jsp/portal/): descargar
datos del alumnado, generar informes de evaluación y exportar faltas y
convivencia, todo en uno o dos clics.

**Privacidad primero**: toda la información es sensible (datos de menores).
La extensión funciona 100 % en local, dentro del navegador: sin servidores,
sin telemetría, sin credenciales. Nada sale del ordenador del docente.
Solo lectura: nunca modifica datos en Séneca.

Los requisitos completos están en [`REQUISITOS.md`](REQUISITOS.md).

## Organización del repositorio

- `main` contiene **solo la versión estable verificada**.
- Cada funcionalidad nueva se desarrolla en su propia rama:
  `feat/<nombre>` (funcionalidad) o `fix/<nombre>` (corrección).
- Una funcionalidad se integra en `main` únicamente cuando está terminada y
  comprobada (tests con fixtures anonimizados en verde).
- Commits con formato [Conventional Commits]
  (https://www.conventionalcommits.org/es/): p. ej.
  `feat: exportar lista de clase a PDF`, `fix: detectar sesión caducada`.

## Licencia

Copyright (C) 2025  Ayudante de Séneca.
Este programa es software libre: puedes redistribuirlo y/o modificarlo bajo
los términos de la [Licencia Pública General de GNU](LICENSE) tal como la
publica la Free Software Foundation, versión 3.

Herramienta independiente creada por docentes, sin relación oficial con la
Consejería de Educación de la Junta de Andalucía.

## Cómo empezar (desarrollo)

### Probar la extensión en tu navegador

1. Abre la página de extensiones: `brave://extensions` en Brave,
   `chrome://extensions` en Chrome o `edge://extensions` en Edge. Activa
   **Modo de desarrollador** (interruptor arriba a la derecha). No hace falta
   empaquetar nada: se carga la carpeta tal cual.
2. Pulsa **Cargar descomprimida** y selecciona la carpeta
   `E:\Dev\AsistenteDeSeneca\extension`.
3. Fija el icono: pulsa el icono de la pieza de puzle de la barra y la
   chincheta junto a «Ayudante de Séneca».
4. Abre Séneca con tu sesión iniciada y pulsa el icono de la extensión.
5. Tras cada cambio del código, pulsa el botón de recargar (↻) que aparece
   en la tarjeta de la extensión y vuelve a abrir el panel.

### Probar la extensión en Firefox

Firefox necesita que el manifiesto lleve un identificador
(`browser_specific_settings.gecko.id`): esta extensión usa
`ayudante-seneca@asistentedeseneca.local`, que no es un buzón real y se
mantiene igual en cada versión (AMO lo exige). La versión mínima es Firefox
115 (ESR), que soporta Manifest V3 con `chrome.scripting` y `storage`. No hay
script en segundo plano.

1. Abre `about:debugging#/runtime/this-firefox` y pulsa **Cargar complemento
temporal…**.
2. Selecciona `E:\Dev\AsistenteDeSeneca\extension\manifest.json`.
3. Abre Séneca con tu sesión iniciada y pulsa el icono de la extensión.

### Permisos que pide

- Acceso **solo** a `https://seneca.juntadeandalucia.es/*`: ningún otro host,
  tampoco el resto de `juntadeandalucia.es`.
- `activeTab` y `scripting`: leer en segundo plano la pantalla de Séneca que ya
  tienes abierta, desde su propio marco, sin moverte de ella.
- `storage`: guardar solo la carga inicial en este navegador (ver más abajo).

No pide `tabs`, ni historial, ni acceso a «todos los sitios web», ni permiso de
descargas (todavía no hay descargas).

### Preparar la extensión la primera vez

La primera vez que abras el panel con Séneca, la extensión mostrará
**Preparar la extensión** con el botón **Cargar datos**: hace una carga
inicial leyendo algunos datos de tu cuenta (hoy, tus «Grupos de alumnos/as»)
para no tener que pedirlos a Séneca cada vez. Esos datos se guardan **solo en
este navegador** (`chrome.storage.local`), nunca se sincronizan ni se envían a
ningún sitio, y no incluyen datos personales del alumnado: solo grupo, materia
y número de alumnos. Al terminar verás la fecha de la carga y el botón
**Actualizar datos**, que vuelve a leerlos cuando quieras.

Si desinstalas la extensión, esos datos se borran con ella. También puedes
borrarlos en cualquier momento con **Olvidar todo**, que los elimina del
navegador y deja el panel como el primer día; ese botón aparece tanto en el
menú normal como en **Preparar la extensión** en cuanto hay algo guardado
(aunque la carga anterior esté incompleta o sea de otra versión).

Si una carga nueva falla (por ejemplo, al pulsar **Actualizar datos**), los
datos buenos de la carga anterior **no se pierden**: se siguen usando en el
menú y en Alumnado, y el panel dice qué elemento falló y de cuándo son los
datos que se mantienen; para volver a intentarlo, pulsa **Actualizar datos**.
Lo mismo pasa si el navegador no deja guardar la carga nueva (por ejemplo, sin
espacio): se mantienen los datos anteriores, con su fecha, y el panel lo dice.

Si lo que falla es la **lectura** de lo guardado, el panel lo explica («No se
han podido leer los datos guardados. Cierra y vuelve a abrir el panel.») y
desactiva **Cargar datos** y **Actualizar datos** para no sobrescribir sin
saber qué hay guardado; **Olvidar todo** sigue disponible por si quieres
empezar de cero.

La lista de datos de la carga inicial está preparada para crecer: hoy solo
tiene «Grupos de alumnos/as» y añadir otro elemento es una entrada más en
`extension/carga-inicial.js`, declarando qué campos de cada fila se pueden
guardar (sin esa lista no se guarda ninguna fila).

### Elegir «Grupo - Materia»

Con Séneca abierto, pulsa el icono de la extensión y entra en **Informes →
Alumnado**: el panel muestra tus grupos como «Grupo - Materia» con el número
de alumnos, leídos de la carga inicial guardada (así no se pide nada a Séneca
cada vez), y te deja elegir uno. Todo ocurre dentro de tu navegador; las
opciones de informes para el grupo elegido llegarán más adelante. Si los
grupos no se cargaron, el panel lo explica y te remite a **Actualizar datos**.

### Diagnóstico de conexión (prueba en vivo)

El panel incluye **Probar conexión con «Grupos de alumnos/as»**. Busca ese
enlace del menú por su texto **solo dentro de la propia página de Séneca**
(nunca en otras webs incrustadas en la pestaña), pide la pantalla en segundo
plano desde la propia página de Séneca (mismo origen, con tu sesión) y muestra
en el panel los pasos, los errores, los grupos y materias extraídos y si tu
pantalla cambió. El informe solo se ve en tu navegador: no se envía a ningún
sitio y las direcciones aparecen con los tokens tapados (`nav/<token>`). Si
quieres compartir el resultado, revísalo antes y copia solo lo necesario.

La lectura de cada pantalla vive en `extension/seneca/` (adaptadores como
`grupos-alumnos.js`), código puro que se prueba en Node con los fixtures
anonimizados de `tests/fixtures/` (por ejemplo `grupos-de-alumnos.html`).

### Pasar una pantalla de Séneca al proyecto (sin exponer datos)

1. En la pantalla de Séneca que interesa, copia la URL del navegador
   (quita cualquier `;jsessionid=...` o token de sesión) y pásala por chat.
2. Guarda la página con **Ctrl+S → «Solo HTML»** dentro de la carpeta
   `fixtures-entrada/` (no se sube nunca a git).
3. Conviértela en fixture:
   `node tools/anonymize.js fixtures-entrada/mi-captura.html tests/fixtures/mi-pantalla.html`
   El script conserva **solo las tablas de datos** (descarta cabecera con tu
   nombre y centro, menús, scripts y tokens), respeta los acentos
   (Windows-1252) y sustituye DNIs, NIE, teléfonos, correos y fotos. Si
   detecta algo dudoso, no escribe nada y lo explica.
4. Revisa visualmente el resultado por si quedara algún nombre de persona:
   los nombres no se pueden detectar de forma fiable.
5. Ejecuta `npm test` para comprobar que todo sigue en verde.

Pendiente de la Fase 0 del documento de requisitos: validación con docentes
reales de las pantallas exactas de Séneca por perfil.
