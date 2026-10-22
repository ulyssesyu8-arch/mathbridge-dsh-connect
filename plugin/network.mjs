import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ENDPOINT, PUBLIC_ENDPOINT, checkEndpoint } from './protocol.mjs';

function systemProxy() {
  // Use Windows' existing per-URL proxy/PAC policy. No settings are changed.
  const script = "$taskTarget=[uri]'https://minemath-academy-bridge.ulyssesyu8.chatgpt.site'; $taskProxy=[System.Net.WebRequest]::GetSystemWebProxy().GetProxy($taskTarget); if($taskProxy.AbsoluteUri -ne $taskTarget.AbsoluteUri){[Console]::Write($taskProxy.AbsoluteUri)}";
  return execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 8192 }).trim();
}

function proxyAgent() {
  // Reuse the HTTP implementation already shipped by the verified DSH version.
  // Resolve from DSH, never from a downloaded or student-supplied module path.
  const candidates = [];
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'app.asar/dsh/package.json'));
  let directory = path.dirname(process.execPath);
  for (let depth = 0; depth < 7; depth++) {
    candidates.push(path.join(directory, 'resources/app.asar/dsh/package.json'), path.join(directory, 'app.asar/dsh/package.json'));
    const parent = path.dirname(directory); if (parent === directory) break; directory = parent;
  }
  const anchor = candidates.find(file => existsSync(file));
  if (!anchor) throw new Error('DSH network runtime was not found.');
  const installed = createRequire(anchor);
  const network = createRequire(installed.resolve('@deepseek-ai/dsh-http-proxy'));
  const { Agent, ProxyAgent, fetch: runtimeFetch } = network('undici');
  // DSH's Agent supplies the dispatcher compatibility layer for its Node build.
  return class ScopedProxyAgent extends Agent {
    static fetch = runtimeFetch;
    constructor(uri) { super({ factory: (_origin, options) => new ProxyAgent({ ...options, uri }) }); }
  };
}

export function createBridgeNetwork({ endpoint, fetcher, platform = process.platform, environment = process.env, readSystemProxy = systemProxy, loadProxyAgent = proxyAgent }) {
  checkEndpoint(endpoint);
  const plain = { fetcher: fetcher ?? fetch, close: async () => {}, systemProxy: false };
  // DSH's configured environment policy remains authoritative, including NO_PROXY.
  const configured = ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY'].some(name => environment[name]?.trim());
  if (endpoint === ENDPOINT || platform !== 'win32' || configured) return plain;
  const address = readSystemProxy();
  if (!address) return plain;
  const proxy = new URL(address);
  if (!['http:', 'https:'].includes(proxy.protocol)) throw new Error('The Windows proxy protocol is not supported.');
  const Agent = loadProxyAgent();
  const dispatcher = new Agent(proxy.href);
  const request = fetcher ?? Agent.fetch ?? fetch;
  return {
    systemProxy: true,
    fetcher(url, options) {
      if (typeof url !== 'string' || !['pair', 'poll', 'result'].some(route => url === PUBLIC_ENDPOINT + route)) throw new Error('MathBridge network destination is not allowed.');
      return request(url, { ...options, dispatcher });
    },
    close: () => dispatcher.close(),
  };
}
