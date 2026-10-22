import { createDshTeachingRuntime } from './runtime.mjs';
import { startBridge } from './transport.mjs';
import { ENDPOINT, checkEndpoint, tokenPattern } from './protocol.mjs';

export const name = 'mathbridge-connect';
export const inject = ['agents', 'llm', 'tools', 'systemPrompt', 'credentials', 'workspaceRegistry', 'sessionTitle', 'sessionPersistence', 'deepseekAccount', 'attachments'];

export function apply(ctx, config = {}) {
  const endpoint = checkEndpoint(config.endpoint ?? ENDPOINT);
  if (config.pairingCode !== undefined && config.pairingCode !== '' && !tokenPattern.test(config.pairingCode)) throw new Error('MathBridge pairingCode must be a current one-time pairing code.');
  const runtime = createDshTeachingRuntime(ctx);
  const logger = ctx.logger('mathbridge-connect');
  const bridge = startBridge({ runtime, credentials: ctx.credentials, endpoint, pairingCode: config.pairingCode ?? '', pairingNonce: config.pairingNonce ?? '', bridgeSlot: config.bridgeSlot ?? '', onState: state => logger.info(`MathBridge: ${state}`) });
  // The plugin owns only its teaching handles; unloading never closes DSH itself.
  ctx.effect(() => () => bridge.stop());
}
