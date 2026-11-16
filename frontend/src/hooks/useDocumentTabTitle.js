import { useEffect } from 'react'

export default function useDocumentTabTitle(name) {
  useEffect(() => {
    if (!name?.trim()) return
    const previous = document.title
    document.title = name.trim()
    return () => { document.title = previous }
  }, [name])
}
