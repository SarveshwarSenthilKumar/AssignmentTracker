export function taskStages(folder, labels) {
  return [
    { id: 'todo', name: labels.todo },
    { id: 'in-progress', name: labels['in-progress'] },
    ...(folder?.stages || []),
    { id: 'completed', name: labels.completed, complete: true },
  ]
}

export const taskStageId = task => task.stageId || (task.status === 'in_progress' ? 'in-progress' : task.status) || 'todo'
export const taskFolder = (task, folders) => folders.find(folder => folder._id === (task.folder?._id || task.folder))
export function nextTaskStage(task, folders, labels) {
  const stages = taskStages(taskFolder(task, folders), labels)
  return stages[(stages.findIndex(stage => stage.id === taskStageId(task)) + 1) % stages.length]
}
export const taskStageLabel = (task, folders, labels) =>
  taskStages(taskFolder(task, folders), labels).find(stage => stage.id === taskStageId(task))?.name || labels[task.status] || labels.todo
