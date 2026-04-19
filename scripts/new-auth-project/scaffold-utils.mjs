export function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function runScaffoldStep(stepName, action) {
  try {
    await action();
  } catch (error) {
    throw new Error(`[${stepName}] ${getErrorMessage(error)}`, { cause: error });
  }
}
