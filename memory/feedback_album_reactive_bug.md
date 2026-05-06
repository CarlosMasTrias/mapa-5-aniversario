---
name: Album reactive bug fix
description: El álbum se actualizaba solo porque layout era un computed que dependía de aspectRatios (reactivo). Solución real: layout como data pura, solo actualizable via update() o resize.
type: feedback
---

El álbum en AlbumSection.vue se reorganizaba visualmente mientras el usuario interactuaba con elementos de CityPage. La causa real NO era que las interacciones llamasen refreshAlbum(), sino que:

1. `layout` era una `computed` que dependía de `this.aspectRatios`
2. `aspectRatios` se cargaba asíncronamente (una imagen a la vez) en `loadAspectRatios`
3. Cada vez que una imagen cargaba su ratio natural, `aspectRatios[id]` cambiaba → `layout` se recalculaba → el álbum se reorganizaba visualmente
4. Esto ocurría en background mientras el usuario interactuaba, dando la ilusión de que sus clics causaban el update

**Solución definitiva (implementada):**
- `layout` convertida de `computed` a `data` plana (`{ placed: [], totalH: 0 }`)
- `_buildLayout(rows)` es un método puro (no reactivo) con el algoritmo skyline
- `update(rows)` calcula el layout inmediatamente, luego carga ratios faltantes con Promise.all, y hace UN único recalculo final cuando todos los ratios están listos
- El álbum solo puede cambiar mediante: llamada explícita a `update()` (vía refreshAlbum o loadData) o resize de ventana

**Why:** Usuario frustrado tras 10+ intentos fallidos de "arreglar" el bug. Era fundamental entender que el problema era la reactividad de Vue sobre aspectRatios, no llamadas directas a refreshAlbum.

**How to apply:** Si se añade lógica nueva a AlbumSection, NO hacer que layout dependa de propiedades reactivas que cambien en background. Siempre pasar por update() para forzar el recalculo.
