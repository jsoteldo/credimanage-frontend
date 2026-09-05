# Reglas Obligatorias de Arquitectura y Desarrollo de CrediManage (PROJECT_RULES.md)

Este documento define las reglas de obligado cumplimiento para el diseño, desarrollo, refactorización y mantenimiento del frontend de **CrediManage**. Cualquier cambio futuro debe adherirse a estas directrices para preservar la consistencia visual, la experiencia de usuario (UX) y la integridad de los datos.

---

## 1. Regla General de Implementación

Antes de implementar cualquier funcionalidad, vista, modal o interacción:
1. **Inspeccionar componentes existentes:** Revisar la carpeta `src/components/`, `src/utils/` y `src/services/`.
2. **Identificar qué se puede reutilizar:** Verificar si ya existe un componente, clase de estilo, cálculo o modal equivalente.
3. **Reutilizar antes de crear:** Si la solución ya existe, importarla directamente.
4. **Parametrizar antes de duplicar:** Si la diferencia con un caso de uso existente es pequeña o contextual, extender las props del componente existente (por ejemplo, mediante una propiedad `mode="bank" | "debt"`).
5. **Mantener consistencia visual y funcional:** Respetar los patrones de cabecera de página, tarjetas KPI (cuando apliquen), tablas con navegación por fila y modales flotantes.
6. **Consultar este documento (`PROJECT_RULES.md`):** Asegurar que la solución propuesta cumpla todos los apartados descritos a continuación.

---

## 2. Reutilización y Regla de Refactorización

### "No abstraer por abstracción"
Evitar crear abstracciones genéricas excesivas o prematuras únicamente por crear código compartido. Un componente común o abstracción debe extraerse cuando:
- **Existe duplicación real:** Dos o más implementaciones repiten la misma lógica o maquetación.
- **Existen casos de uso compatibles:** Al menos dos o más pantallas requieren el mismo comportamiento esencial.
- **Reduce el mantenimiento:** Centraliza reglas críticas en un solo lugar en vez de dispersarlas.
- **Mantiene la simplicidad:** No introduce una API o conjunto de props más complejo y difícil de entender que el código al que sustituye.

### Reutilización efectiva:
1. **Búsqueda previa obligatoria:** Antes de escribir un nuevo archivo de componente, buscar implementaciones similares en el repositorio.
2. **Cero duplicación innecesaria:** Evitar duplicar lógica financiera, selectores de autocompletado o modales de alta/edición.
3. **Unificación de servicios:** Toda llamada al backend debe canalizarse a través de `src/services/api.ts`. No crear llamadas `fetch` o `axios` aisladas dentro de componentes.

---

## 3. Selector Oficial de Clientes (`ClientSelector.tsx`)

`ClientSelector.tsx` **YA ES el componente oficial de selección de clientes** en CrediManage.

Queda terminantemente prohibido crear componentes paralelos como:
- `ClientAutocomplete`
- `CustomerSelector`
- `ClientSearch`
- o cualquier otro componente equivalente,

si `ClientSelector.tsx` puede resolver el caso de uso mediante sus props o configuración.

### Modos contextuales actuales (`mode`):
- **`mode="debt"` (Deuda / Consumo Corriente):**
  - Prioriza: Límite de crédito y Deuda corriente pendiente (`Debe: S/ ...` o `Al día (S/ 0.00)`).
  - Etiqueta por defecto: `"Cliente Destino *"`.
- **`mode="bank"` (Banco / Créditos con Intereses):**
  - Prioriza: Límite de crédito, Saldo actual y Crédito disponible (`Disp: S/ ...`).
  - Etiqueta por defecto: `"Seleccionar Cliente *"`.

### Capacidades del componente común:
- **Búsqueda multivariable:** Filtrado dinámico tolerante a mayúsculas/minúsculas por:
  - Nombre completo.
  - Código / número de cliente (`clientNumber`, ej. `CLI-1051`).
  - Teléfono.
- **Interacción no intrusiva:** El listado desplegable nunca debe ser fijo ni ocupar espacio vertical permanente; solo se abre al enfocar o escribir.
- **Navegación por teclado y accesibilidad:** Soporte para flechas (`↓`, `↑`), selección con `Enter`, cierre con `Escape` y descarte al hacer clic fuera (`click outside`).
- **Bloque de cliente seleccionado (Anti-errores accidentales):** Al elegir un cliente, el buscador se oculta y se muestra una tarjeta compacta no editable para evitar cambios involuntarios mientras se completan otros campos del formulario.
- **Acción cambiar cliente:** Botón `[ ⇄ Cambiar cliente ]` para reactivar la búsqueda sin recargar la pantalla ni perder datos del formulario padre.
- **Integración con `+ Nuevo Cliente`:**
  - Botón visible junto al campo de búsqueda (responsive: horizontal en escritorio, vertical en móvil).
  - Estado vacío interactivo cuando la búsqueda no arroja resultados (`No se encontraron clientes para: "[query]"` con botón `[ + Crear nuevo cliente ]`).
  - Reutilización de `ClientFormModal` superpuesto en capa superior (`zIndexClass="z-[60]"`).
  - **Preservación obligatoria de datos:** Si el usuario ya había completado campos en el formulario padre (capital, tasa, cuotas, productos, importes, etc.), estos valores deben conservarse al 100% tras registrar al nuevo cliente.

---

## 4. Tablas y Presentación de Datos

No se exige forzar todas las tablas a un único componente genérico complejo si eso complica casos de uso particulares. Primero debe evaluarse si la abstracción realmente reduce duplicación sin dificultar la especificidad de cada pantalla. Si posteriormente se demuestra que un componente común de tabla aporta valor real, podrá extraerse mediante refactorización controlada.

Lo **obligatorio** en todas las tablas es compartir:
1. **Patrón responsive dual:**
   - **En Escritorio (`≥ md`):** Tabla tradicional `<table>` con cabecera en mayúsculas pequeña (`text-[11px] font-bold text-slate-500 uppercase`) y filas con hover sutil (`hover:bg-slate-50/90`).
   - **En Móvil (`< md`):** Ocultar la tabla (`hidden md:block`) y desplegar tarjetas verticales compactas (`md:hidden divide-y divide-slate-100`) con padding táctil (`p-4`) y datos estructurados en un grid interno legible.
   - **Cero scroll horizontal global:** Ninguna tabla o vista móvil debe desbordar la pantalla (`viewport`) en el eje horizontal.
2. **Navegación por fila clicable:**
   - Cuando una fila represente un registro seleccionable o editable, **toda la fila `<tr>` debe ser clicable** (`onClick`, `cursor-pointer`, `select-none`).
   - No crear columnas redundantes de botones o acciones si hacer clic en la fila ya resuelve la acción principal (ver detalle, editar cliente o administrar deuda).
3. **Estados de carga y vacíos consistentes:**
   - Spinner centrado con texto descriptivo en estado de carga.
   - Icono temático tenue, mensaje claro y botón de acción sugerida en estado vacío.

---

## 5. Diseño e Identidad Visual

CrediManage posee un lenguaje visual moderno, sobrio y financiero. Las clases Tailwind específicas mencionadas a continuación son una **referencia de la implementación actual**, no una restricción inflexible que impida ajustes justificados.

### Principios directores de diseño:
- **Reutilizar tokens, estilos y componentes existentes:** Mantener la coherencia estética con el resto del sistema.
- **No introducir nuevos colores o estilos arbitrariamente:** Todo color o estilo adicional debe tener una justificación funcional clara.
- **Conservar la identidad visual:**
  - **Tonalidades principales de referencia:** Índigo (marca, navegación y acciones principales), Slate (textos neutros, superficies y bordes), Rose (deuda pendiente y estados vencidos), Emerald (pagos al día y disponibles) y Ámbar (advertencias y límites).
  - **Tipografía:** `Inter` o fuentes de sistema sans-serif para texto general, y `font-mono` para valores numéricos, importes en soles (`S/`), códigos de cliente y folios.
  - **Iconografía:** `Material Symbols Outlined`.
  - **Bordes y sombras:** `rounded-xl` / `rounded-2xl` y sombras sutiles (`shadow-xs`, `shadow-2xs`).
- **Evitar CSS duplicado:** Emplear las utilidades de TailwindCSS ya existentes en el proyecto.

---

## 6. Estructura de Pantallas Principales

La estructura visual debe ser armónica pero funcionalmente flexible:
1. **PageHeader:**
   - Es el **patrón estándar obligatorio** para las pantallas principales (título grande `text-2xl font-black`, subtítulo contextual en `text-xs text-slate-500`, icono temático y botones de acción a la derecha).
2. **KpiGrid / Tarjetas Métricas (Uso condicional):**
   - Debe reutilizarse **únicamente cuando la pantalla realmente requiera mostrar indicadores o resúmenes cuantitativos**.
   - **No todas las pantallas están obligadas a tener KPIs.** No inventar métricas ficticias ni agregar tarjetas innecesarias solo para cumplir un formato visual.
   - La cantidad de KPIs **no está rígidamente limitada a 4**: se mantienen las 4 columnas en las vistas actuales que ya las usan (Clientes, Deuda, Banco), pero se admiten cantidades distintas (1, 2, 3 o más) según las necesidades funcionales de cada vista.
3. **Contenedor Principal de Datos:**
   - Barra superior con filtros rápidos (píldoras), buscador con icono y ordenamiento si procede.
   - Visualización de datos adaptable (tabla en desktop / tarjetas apiladas en móvil).

---

## 7. Modales y Capas (`Z-Index`)

- **Modales principales:** Renderizados en capa `z-50` sobre fondo oscuro desenfocado (`bg-slate-900/40 backdrop-blur-xs`).
- **Modales superpuestos / anidados:** Cuando un modal abre otro modal (ej. `ClientFormModal` abierto desde `AddDebtModal` o `GrantLoanModal`), debe utilizar `zIndexClass="z-[60]"` para sobreponerse limpiamente sin conflictos visuales.
- **Ergonomía:**
  - Cabecera con título, subtítulo e icono temático.
  - Botón de cierre visible `close`.
  - Contenedor con scroll interno (`overflow-y-auto max-h-[92vh]`) para adaptarse a resoluciones pequeñas.
  - Pie de formulario con cancelación y confirmación con indicador de carga (`loading`).

---

## 8. Seguridad e Integridad de Datos

Queda estrictamente prohibido:
1. **Resetear la base de datos o almacenamiento:** No vaciar colecciones ni reinicializar estados sin consentimiento explícito.
2. **Ejecutar scripts destructivos o seeds:** No sobreescribir datos existentes en entornos de desarrollo o producción.
3. **Introducir datos mock o ficticios:** Conectar siempre los componentes a los modelos reales (`src/types.ts`) y servicios oficiales (`src/services/api.ts`).
4. **Modificar identificadores (`id`):** Los códigos de cliente (`clientNumber`), folios de crédito (`CR-...`) y comprobantes no deben alterarse.
5. **Pérdida de datos en formularios:** Todo formulario extenso debe conservar los datos introducidos por el usuario si este interactúa con un sub-flujo (como registrar un nuevo cliente sobre la marcha).

---

## 9. Criterios de Calidad y Validación

Todo cambio en el código debe validarse mediante:
```bash
npx tsc --noEmit
```
Adicionalmente, cuando existan configurados en el proyecto, deben ejecutarse:
- **Linter** (ej. `npm run lint`).
- **Pruebas unitarias.**
- **Pruebas de integración.**
- **Pruebas E2E** relacionadas con el cambio.

*Nota: No se deben instalar herramientas nuevas automáticamente solo para satisfacer esta regla si el proyecto no cuenta con ellas previamente.*
