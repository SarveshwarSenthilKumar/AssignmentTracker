// Adapted from Excalidraw v0.18.0, Copyright (c) 2020 Excalidraw.
// MIT licensed; see ./LICENSE and ./SOURCE.md.

// gesture.ts: TypeScript annotations removed, empty-map guard added.
const sum = (array, mapper) => array.reduce((acc, item) => acc + mapper(item), 0)
export const getCenter = pointers => {
  const allCoords = Array.from(pointers.values())
  if (!allCoords.length) return null
  return {
    x: sum(allCoords, coords => coords.x) / allCoords.length,
    y: sum(allCoords, coords => coords.y) / allCoords.length,
  }
}

// App.tsx handleCanvasPointerDown: tool names mapped to this PDF editor.
export const allowOnPointerDown = (penMode, event, tool) =>
  !penMode ||
  event.pointerType !== 'touch' ||
  tool === 'select' ||
  tool === 'text' ||
  tool === 'image'

// App.tsx detects pen input from pointerType, never from width or pressure.
export const isPenInput = event => event.pointerType === 'pen'
