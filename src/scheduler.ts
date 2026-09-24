export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export async function forEachBatched<T>(
  items: readonly T[],
  batchSize: number,
  callback: (item: T, index: number) => void,
): Promise<void> {
  for (let index = 0; index < items.length; index += 1) {
    callback(items[index], index);

    if ((index + 1) % batchSize === 0 && index + 1 < items.length) {
      await yieldToUi();
    }
  }
}
