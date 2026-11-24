// Keep transformed layout inside a reliably representable browser coordinate range.
// These are rendering safeguards, not the previous editing-size limits.
export const MAX_WALL_SIZE=1000000
export const MIN_TEXT_SIZE=.1
// Keep these handwriting limits in sync with backend/detectiveWalls.js.
export const NOTE_INK_GRID=1000
export const MAX_NOTE_STROKES=80
export const MAX_NOTE_STROKE_POINTS=1200
