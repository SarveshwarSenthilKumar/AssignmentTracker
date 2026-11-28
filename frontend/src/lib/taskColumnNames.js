export const defaultTaskColumns = { todo: 'To Do', 'in-progress': 'In Progress', completed: 'Completed' }

export function taskColumnNames(preference) {
  return Object.fromEntries(Object.entries(defaultTaskColumns).map(([status, fallback]) => {
    const value = preference?.[status]
    return [status, typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : fallback]
  }))
}
