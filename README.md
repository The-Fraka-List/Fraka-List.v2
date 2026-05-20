# FRAKA LIST

Una página web con una lista de niveles estilo "demon list" con soporte para ver detalles de cada nivel, un ranking de jugadores y un minijuego de ruleta.

## ¿Qué es?

`FRAKA LIST` es una interfaz web estática pensada para explorar y consultar una lista de niveles de dificultad, ver información detallada del nivel, revisar puntuaciones globales y jugar una ruleta que propone niveles aleatorios para completar. Todo esto recopilado por records de la comunidad **Fraka clan**

## Cómo funciona

La página está construida con HTML, CSS y JavaScript puro. Los datos principales provienen de archivos JSON ubicados en `data-lvl/`, donde cada nivel tiene su propia definición.

El archivo principal es:

- `index.html`: estructura de la página y tres secciones principales.
- `main.js`: lógica de carga de datos, renderizado, navegación entre pestañas y funciones de la ruleta.

## Pestañas principales

La interfaz tiene tres pestañas en la barra de navegación:

1. **List**
   - Muestra un listado de niveles disponibles los cuales son los records de la comunidad.
   - Permite seleccionar un nivel para ver su detalle, con información como creador, verificador, ID del nivel, puntos de lista, requisito mínimo y contraseña.
   - Inserta un video de verificación si la información del nivel incluye una URL de YouTube.

2. **Leaderboard**
   - Calcula un ranking global de jugadores basado en los datos disponibles en los niveles.
   - Muestra puntos totales, cantidad de niveles completados, progresos y el récord más difícil registrado por cada jugador.

3. **Roulette**
   - Minijuego que genera una lista aleatoria de niveles para completar.
   - Permite registrar el porcentaje completado de cada nivel y avanzar en la ruleta.
   - Guarda el progreso en `localStorage` para mantener la sesión.
   - Incluye opciones para importar/ exportar el progreso en formato JSON.

## Estructura del proyecto

```
index.html          # Página principal
main.js             # Lógica de la aplicación
assets/             # Estilos, scripts y recursos estáticos
  css/              # Estilos del sitio
  img/              # Imágenes utilizadas por la página
  js/               # Scripts adicionales (por ejemplo, leaderboard)
data/               # Carpeta vacía o para datos futuros
data-lvl/           # Niveles individuales en formato JSON
```

## Datos de niveles

Cada nivel se describe en un archivo JSON dentro de `data-lvl/`. La página carga todos estos archivos al iniciar y genera el listado dinámicamente.

Ejemplos de campos que puede incluir un nivel:

- `id`
- `name`
- `rank`
- `percentToQualify`
- `verification` (URL de video)
- `creators`
- `verifier`
- `password`
- `records`

## Uso local

1. Abre `index.html` en un navegador moderno.
2. Navega entre las pestañas `List`, `Leaderboard` y `Roulette`.
3. En la pestaña `List`, haz clic en un nivel para ver sus detalles.
4. En `Roulette`, inicia la ruleta y registra tu progreso en cada nivel.

## Notas

- La navegación entre pestañas se realiza con botones que activan/desactivan secciones.
- El minijuego de ruleta usa `localStorage` para mantener el estado entre recargas.
- El contenido visual se basa en estilos CSS definidos en `assets/css/`.

