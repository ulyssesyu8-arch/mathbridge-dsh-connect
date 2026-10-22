// This is MathBridge's restricted bridge protocol, not DSH's owner API.
export const PROTOCOL = 'mathbridge-dsh-v1';
export const ENDPOINT = 'http://127.0.0.1:4173/api/dsh-tutor/bridge/';
export const PUBLIC_ENDPOINT = 'https://minemath-academy-bridge.ulyssesyu8.chatgpt.site/api/dsh-tutor/bridge/';
export const ACCOUNT_PROVIDER = 'deepseek-account';
export const idPattern = /^[A-Za-z0-9_-]{16,80}$/;
export const tokenPattern = /^[a-f0-9]{64}$/;
export const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const fail = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
export function safeDiagnostic(error) {
  // A verified Cordis error template. Only its service identifier is projected.
  const missing = /^cannot get property "([A-Za-z][A-Za-z0-9]{0,45})" without inject$/.exec(error?.message ?? '');
  if (missing) return `MISSING_INJECT_${missing[1].toUpperCase()}`;
  if (typeof error?.code === 'string' && /^[A-Z0-9_]{1,60}$/.test(error.code)) return error.code;
  return error?.name === 'TypeError' ? 'PLUGIN_TYPE_ERROR' : 'PLUGIN_ERROR';
}

export function checkEndpoint(value) {
  // No configurable hosts, redirects, proxy destinations or credential-bearing URLs.
  if (value !== ENDPOINT && value !== PUBLIC_ENDPOINT) throw fail('invalid_endpoint', '连接地址必须是 MathBridge 官方课程教学接口。');
  return value;
}
export function publicModels(models) {
  if (!Array.isArray(models) || models.length > 100) throw fail('invalid_models', 'DSH 模型列表无效。');
  const seen = new Set();
  return models.map(model => {
    if (!record(model) || typeof model.id !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(model.id) || typeof model.name !== 'string' || !model.name.trim() || model.name.length > 200 || seen.has(model.id)) throw fail('invalid_models', 'DSH 模型列表无效。');
    seen.add(model.id);
    return { id: model.id, name: model.name, images: model.images === true };
  });
}
export function checkHello(value) {
  if (!record(value) || value.protocol !== PROTOCOL || value.provider !== ACCOUNT_PROVIDER || value.toolsDisabled !== true || value.persistentHistory !== true) throw fail('incompatible_plugin', '需要支持独立教学会话、禁用工具和账号路线的 MathBridge 插件。', 409);
  return { protocol: PROTOCOL, provider: ACCOUNT_PROVIDER, toolsDisabled: true, persistentHistory: true, models: publicModels(value.models),
    ...(typeof value.runtimeId === 'string' && idPattern.test(value.runtimeId) ? { runtimeId: value.runtimeId } : {}),
    ...(['ready', 'empty', 'failed'].includes(value.catalogState) ? { catalogState: value.catalogState } : {}),
    ...(['unknown', 'signed-out', 'credential-stored'].includes(value.accountState) ? { accountState: value.accountState } : {}),
    ...(typeof value.catalogErrorCode === 'string' && /^[A-Z0-9_]{1,60}$/.test(value.catalogErrorCode) ? { catalogErrorCode: value.catalogErrorCode } : {}) };
}
export function checkQuestion(value) {
  if (!record(value) || !idPattern.test(value.viewId ?? '') || !idPattern.test(value.requestId ?? '')) throw fail('invalid_request', '教学会话或请求标识无效。');
  if (typeof value.model !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(value.model)) throw fail('invalid_model', '请选择 DSH 当前账号的可用模型。');
  if (typeof value.question !== 'string' || !value.question.trim() || value.question.length > 4000 || !['zh', 'dual', 'en'].includes(value.language)) throw fail('invalid_question', '请检查问题和语言设置。');
  const context = value.context;
  if (!record(context) || JSON.stringify(context).length > 20000) throw fail('invalid_context', '课程内容过长或无效。');
  const inspect = (entry, depth = 0) => {
    if (depth > 14) throw fail('invalid_context', '课程内容层级过深。');
    if (!entry || typeof entry !== 'object') return;
    for (const [key, child] of Object.entries(entry)) {
      if (/^(?:__proto__|constructor|prototype|access_token|refresh_token|id_token|api_key|password|authorization)$/i.test(key)) throw fail('invalid_context', '课程内容包含不允许的字段。');
      inspect(child, depth + 1);
    }
  };
  inspect(context);
  const images = value.images ?? [];
  if (!Array.isArray(images) || images.length > 2) throw fail('invalid_image', '每次最多发送两张课程截图。');
  const checked = images.map(image => {
    if (!record(image) || image.source !== 'course-selection' || typeof image.dataUrl !== 'string' || image.dataUrl.length > 1_398_140 || !/^data:image\/(?:png|jpeg);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.dataUrl) || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 8 || image.height < 8 || image.width > 2048 || image.height > 2048 || image.width * image.height > 3_000_000 || (image.selectedText !== undefined && (typeof image.selectedText !== 'string' || image.selectedText.length > 2000))) throw fail('invalid_image', '截图格式无效，请重新圈选。');
    return { source: 'course-selection', dataUrl: image.dataUrl, width: image.width, height: image.height, ...(image.selectedText ? { selectedText: image.selectedText } : {}) };
  });
  return { viewId: value.viewId, requestId: value.requestId, model: value.model, question: value.question.trim(), language: value.language, context, images: checked };
}
export function errorCode(error) {
  const code = error?.code;
  if (['ACCOUNT_QUOTA', 'ACCOUNT_QUOTA_EXCEEDED', 'QUOTA_EXCEEDED', 'INSUFFICIENT_BALANCE'].includes(code)) return 'account_quota';
  if (['ACCOUNT_SIGN_IN_REQUIRED', 'ACCOUNT_TOKEN_INVALID', 'AUTH'].includes(code)) return 'account_required';
  if (['RATE_LIMIT', 'ACCOUNT_RATE_LIMIT'].includes(code)) return 'rate_limit';
  return typeof code === 'string' && /^[a-z_]{1,60}$/.test(code) ? code : 'dsh_failed';
}
export const errorMessages = {
  account_quota: 'DSH 账号额度不可用，本轮已停止；没有切换到 API Key。',
  account_required: '请先在 DSH 中完成官方账号登录。',
  rate_limit: 'DSH 暂时限流，请稍后再试。',
  cancelled: '本轮已停止，问题草稿保留。DSH 可能保留已接收的问题或部分回答。',
  disconnected: 'DSH 连接已断开，请保持 DSH 和连接插件运行。',
  incomplete_response: 'DSH 没有完成本轮回答。请在 DSH 中查看记录后再决定是否重试。',
  dsh_failed: 'DSH 本轮答疑未完成，请在 DSH 中检查账号、版本和连接插件。',
};
