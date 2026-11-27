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

1. Abre `chrome://extensions` y activa **Modo de desarrollador** (arriba a la
   derecha).
2. Pulsa **Cargar descomprimida** y selecciona la carpeta
   `E:\Dev\AsistenteDeSeneca\extension`.
3. Abre Séneca con tu sesión iniciada y pulsa el icono de la extensión.
4. Tras cada cambio del código, pulsa el botón de recargar (↻) que aparece
   en la tarjeta de la extensión y vuelve a abrir el panel.

### Diagnóstico de conexión (prueba en vivo)

El panel incluye **Probar conexión con «Materias que imparte»**. Busca ese
enlace del menú por su texto, pide la pantalla en segundo plano desde la
propia página de Séneca (mismo origen, con tu sesión) y muestra en el panel
los pasos, los errores, los grupos y materias extraídos y si tu pantalla
cambió. El informe solo se ve en tu navegador: no se envía a ningún sitio y
las direcciones aparecen con los tokens tapados (`nav/<token>`). Si quieres
compartir el resultado, revísalo antes y copia solo lo necesario.

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
