// Retry only a confirmed billing/credit quota failure, with one shared deadline.
const QUOTA = new Set(['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached', 'billing_not_active', 'usage_limit_reached']);
async function openaiRequest(url, options, {fetchImpl = fetch, primary = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KIOSK_KEY || process.env.OPEN_API_KEY, backup = process.env.OPENAI_BACKUP} = {}) {
  if (!primary) throw Object.assign(new Error('Image service is not configured'), {code: 'NO_KEY'});
  const send = key => fetchImpl(url, {...options, headers: {...options.headers, Authorization: `Bearer ${key}`}});
  let response = await send(primary);
  if ([400,402,429].includes(response.status) && backup && backup !== primary && !options.signal?.aborted) {
    const problem = await response.clone().json().catch(() => ({}));
    if (QUOTA.has(problem?.error?.code) || QUOTA.has(problem?.error?.type)) response = await send(backup);
  }
  return response;
}
module.exports = {openaiRequest};
