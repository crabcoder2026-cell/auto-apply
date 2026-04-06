/**
 * Serialize all headless-Chrome work in this Node process so cron watch, job-feed,
 * batch apply, and single apply never run Chromium concurrently (reduces RAM spikes / OOM).
 */
let queueTail: Promise<unknown> = Promise.resolve();

export async function runExclusiveChromeAutomation<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(() => fn());
  queueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
