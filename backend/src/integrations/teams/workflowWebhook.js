/**
 * HTTP client for Teams Workflows triggers ("When a Teams webhook request is received" or
 * Power Automate "When an HTTP request is received"). Every call carries `x-api-key`, which
 * the workflow must compare with its own copy of the token.
 */
const RETRY_DELAYS_MS = [1000, 4000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class WorkflowError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * POSTs `payload` to the workflow. Retries 429/5xx and network errors (1 s, 4 s) when `retry`
 * is true (spec 15.1). Resolves with the HTTP status; rejects with WorkflowError.
 */
export async function postToWorkflow(url, token, payload, { retry = true, timeoutMs = 15_000 } = {}) {
  if (!url) throw new WorkflowError('Workflow URL not configured', 0);
  let lastError;
  const attempts = retry ? RETRY_DELAYS_MS.length + 1 : 1;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(RETRY_DELAYS_MS[i - 1]);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': token || '' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res.status;
      const text = (await res.text().catch(() => '')).slice(0, 300);
      lastError = new WorkflowError(`Workflow responded ${res.status}${text ? `: ${text}` : ''}`, res.status);
      if (res.status !== 429 && res.status < 500) break; // 4xx other than 429: retrying won't help
    } catch (err) {
      lastError = err instanceof WorkflowError ? err : new WorkflowError(err.name === 'TimeoutError' ? 'Workflow timeout' : err.message, 0);
    }
  }
  throw lastError;
}
