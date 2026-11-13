export const documentRoute = id => `documents/${encodeURIComponent(id)}`

export function openInTab(event, route) {
  if (!(event?.ctrlKey || event?.metaKey)) return false
  event.preventDefault()
  window.open(new URL(`#/${route}`, window.location.href).href, '_blank', 'noopener,noreferrer')
  return true
}
