import { ENDPOINT, checkEndpoint, errorCode, fail, idPattern, tokenPattern } from './protocol.mjs';

/** Outbound-only HTTP; DSH exposes no new listening port. */
export function startBridge({ runtime, credentials, pairingCode = '', pairingNonce = '', bridgeSlot = '', endpoint = ENDPOINT, fetcher = fetch, onState = () => {} }) {
  checkEndpoint(endpoint);
  const key = endpoint === ENDPOINT ? bridgeSlot === 'quick-local' ? 'mathbridge-connect/quick-local-bridge' : 'mathbridge-connect/local-bridge' : 'mathbridge-connect/public-bridge';
  const controller = new AbortController();
  let token = '', stopped = false, generation = '', previousState = '';
  const state = value => { if (previousState !== value) { previousState = value; onState(value); } };
  const deliveries = new Set();
  const delay = ms => new Promise(resolve => {
    const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms); controller.signal.addEventListener('abort', done, { once: true });
    if (controller.signal.aborted) done();
  });
  async function request(route, input, authenticated = true) {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const response = await fetcher(endpoint + route, {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
    });
    if (response.status === 401) throw fail('bridge_pairing_required', '需要重新配对。', 401);
    if (!response.ok) throw fail('bridge_unavailable', 'MathBridge 本机连接不可用。', response.status);
    // The gateway emits bounded JSON; do not accept a redirected remote response.
    const reader = response.body.getReader(); let length = 0; const chunks = [];
    try {
      for (;;) { const item = await reader.read(); if (item.done) break; length += item.value.length; if (length > 3 * 1024 * 1024) throw fail('invalid_response', '连接消息过大。'); chunks.push(item.value); }
    } finally { await reader.cancel().catch(() => {}); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const run = (async () => {
    try {
      const saved = await credentials.readRecord(key);
      if (saved?.kind === 'grant' && saved.payload?.endpoint === endpoint && tokenPattern.test(saved.payload.token ?? '') && (!pairingNonce || pairingNonce === saved.payload.pairingNonce)) token = saved.payload.token;
      if (!token) {
        if (!tokenPattern.test(pairingCode)) { state('pairing-required'); return; }
        const result = await request('pair', { ...await runtime.hello(), code: pairingCode }, false);
        if (!tokenPattern.test(result.token ?? '')) throw fail('invalid_response', '配对响应无效。');
        token = result.token;
        await credentials.modifyRecord(key, async () => ({ kind: 'grant', payload: { version: 1, endpoint, token, pairingNonce } }));
      }
      while (!stopped) {
        try {
          const command = await request('poll', await runtime.hello());
          if (stopped) break;
          if (generation && command.generation !== generation) await runtime.reset();
          generation = command.generation;
          state('connected');
          if (command.type === 'ask') {
            const delivery = Promise.resolve().then(() => {
              if (!idPattern.test(command.runtimeId ?? '')) throw fail('disconnected', '教学请求缺少当前 DSH 账号实例绑定。');
              return runtime.execute(command);
            }).catch(error => ({ viewId: command.viewId, requestId: command.requestId, error: { code: errorCode(error) } })).then(result => request('result', result)).catch(() => { /* Never resend a prompt or leak provider error bodies. */ }).finally(() => deliveries.delete(delivery));
            deliveries.add(delivery);
          } else if (command.type === 'cancel') runtime.cancel(command.requestId, command.viewId);
          else if (command.type === 'release') await runtime.release(command.viewId);
          else if (command.type === 'disconnect') {
            await credentials.deleteRecord(key); state('pairing-required'); break;
          } else if (command.type !== 'heartbeat') throw fail('invalid_response', '未知的教学操作。');
          if (command.type === 'heartbeat' && Number.isInteger(command.retryAfterMs)) await delay(Math.min(15000, Math.max(100, command.retryAfterMs)));
        } catch (error) {
          if (stopped || controller.signal.aborted) break;
          if (error.code === 'bridge_pairing_required') { await credentials.deleteRecord(key); state('pairing-required'); break; }
          state('offline'); await delay(2500);
        }
      }
    } catch { if (!stopped) state('connection-error'); }
    finally { await runtime.dispose(); }
  })();
  return {
    done: run,
    async stop() { stopped = true; controller.abort(); await runtime.dispose(); await run; await Promise.allSettled(deliveries); },
  };
}
