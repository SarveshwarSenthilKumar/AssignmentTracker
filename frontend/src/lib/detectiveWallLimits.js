// Keep transformed layout inside a reliably representable browser coordinate range.
// These are rendering safeguards, not the previous editing-size limits.
export const MAX_WALL_SIZE=1000000
export const MIN_TEXT_SIZE=.1
export const DEFAULT_WALL_WIDTH=12000
export const DEFAULT_WALL_HEIGHT=8000
// Persisted board dimensions share these bounds with backend/detectiveWalls.js.
export const MIN_BOARD_WIDTH=320
export const MIN_BOARD_HEIGHT=240
export const MAX_BOARD_DIMENSION=MAX_WALL_SIZE*2
