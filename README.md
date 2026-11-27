# Ayudante de Séneca

> [!WARNING]
> **Proyecto en desarrollo temprano.** La extensión todavía no está lista
> para el uso diario: la mayor parte de lo que describen este documento y
> [`REQUISITOS.md`](REQUISITOS.md) aún no existe, puede cambiar sin aviso y no
> hay ninguna versión publicada en las tiendas de extensiones. Úsala solo
> para probar.

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

Pendiente de la Fase 0 del documento de requisitos: validación con docentes
reales de las pantallas exactas de Séneca por perfil.
