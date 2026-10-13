function dependencyChange(body, userId) {
  const id = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
  if (!id(body.beforeId) || !id(body.afterId) || typeof body.linked !== 'boolean') throw new Error('Choose two tasks and a valid connection action.');
  if (body.beforeId.toLowerCase() === body.afterId.toLowerCase()) throw new Error('A task cannot be its own prerequisite.');
  return {
    owner: { user: userId, _id: { $in: [body.beforeId, body.afterId] } },
    target: { user: userId, _id: body.afterId },
    update: body.linked ? { $addToSet: { dependsOn: body.beforeId } } : { $pull: { dependsOn: body.beforeId } },
  };
}
module.exports = { dependencyChange };
