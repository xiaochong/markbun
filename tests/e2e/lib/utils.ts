export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function dispatchEventScript(eventName: string): string {
  return `(() => {
    const listeners = window.__electrobunListeners && window.__electrobunListeners[${JSON.stringify(eventName)}] || [];
    listeners.forEach((cb) => cb());
  })()`;
}
