# FINAV · Matriz de Evaluación de Restaurantes

Aplicación web para evaluar el estado de un restaurante antes de su adquisición: calificación de 129 ítems en 14 categorías, guardado en Google Sheets, dashboard con dictamen y plan de acción, e informe PDF imprimible.

- **Frontend:** HTML + CSS + JavaScript estático, publicado con GitHub Pages.
- **Backend / API:** Google Apps Script (`apps-script/Code.gs`), publicado como aplicación web.
- **Base de datos:** Google Sheets (hojas `Config`, `Catalogo`, `Evaluaciones`, `Detalle`, `Log`).

## Estructura

```
index.html              Interfaz (login, lista, evaluación, dashboard)
css/styles.css          Estilos y colores de marca
js/config.js            ← ÚNICO archivo a editar: URL de la API
js/api.js               Comunicación con Apps Script (o modo demostración)
js/calc.js              Motor de cálculo (riesgo, niveles, índices, dictamen, plan)
js/report.js            Generación del informe PDF
js/app.js               Lógica de la interfaz
js/catalog-demo.js      Catálogo usado solo en modo demostración
assets/logo.png|jpg     Logo FINAV (interfaz y PDF)
apps-script/Code.gs     Código del backend (se copia al editor de Apps Script)
```

## Puesta en marcha (resumen)

1. Crear un Google Sheet, abrir **Extensiones → Apps Script**, pegar `apps-script/Code.gs`, ejecutar `setup()` y luego `setAccessKey()` con su clave.
2. **Implementar → Nueva implementación → Aplicación web** (Ejecutar como: Yo · Acceso: Cualquier usuario). Copiar la URL `/exec`.
3. Pegar la URL en `js/config.js` → `API_URL`.
4. Subir el contenido de esta carpeta al repositorio `matriz-restaurante` de https://github.com/Patamant y activar **Settings → Pages → Deploy from a branch → main / (root)**.
5. Abrir `https://patamant.github.io/matriz-restaurante/` e ingresar con la clave.

El procedimiento completo está en el **Manual de implementación**.

## Modo demostración

Si `API_URL` está vacía, la app funciona sin servidor y guarda en el navegador. Útil para probar el diseño antes de conectar Google Sheets.
