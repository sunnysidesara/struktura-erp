// Tiny in-flight request counter shared by the API client and the UI.
// Every call to request() in lib/api.ts increments it, so the dashboard can
// show a single loading layer for page data, refreshes and saves.

type Listener = (busy: boolean) => void;

let inFlight = 0;
const listeners = new Set<Listener>();

function emit(): void {
  const busy = inFlight > 0;
  listeners.forEach((listener) => listener(busy));
}

export function beginApiRequest(): void {
  inFlight += 1;

  if (inFlight === 1) {
    emit();
  }
}

export function endApiRequest(): void {
  inFlight = Math.max(0, inFlight - 1);

  if (inFlight === 0) {
    emit();
  }
}

export function subscribeApiLoading(listener: Listener): () => void {
  listeners.add(listener);
  listener(inFlight > 0);

  return () => {
    listeners.delete(listener);
  };
}