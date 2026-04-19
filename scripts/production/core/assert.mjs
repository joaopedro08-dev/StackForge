export function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
