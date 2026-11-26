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

## Cómo empezar (desarrollo)

Pendiente de la Fase 0 del documento de requisitos: validación con docentes
reales de las pantallas exactas de Séneca por perfil.
