import {createHash, timingSafeEqual, randomUUID} from 'node:crypto';
import {isIP} from 'node:net';

const digest = value => createHash('sha256').update(value).digest();

export function deploymentConfig(env = process.env) {
  const cloud = env.DEPLOYMENT_MODE === 'cloud';
  const publicAccess = env.PUBLIC_ACCESS === 'true';
  const username = env.JUDGE_USERNAME || '';
  const password = env.JUDGE_PASSWORD || '';
  if ((username && !password) || (!username && password)) {
    throw new Error('请同时设置 JUDGE_USERNAME 和 JUDGE_PASSWORD。');
  }
  if (cloud && !publicAccess && (!username || password.length < 16)) {
    throw new Error('云端部署须配置评委账号和至少16位的体验密码。');
  }
  if (username.includes(':') || /[\r\n]/.test(username + password)) {
    throw new Error('评委凭证格式无效。');
  }
  let origin = '';
  if (env.PUBLIC_ORIGIN) {
    const parsed = new URL(env.PUBLIC_ORIGIN);
    if (!(parsed.protocol === 'https:' || publicAccess && parsed.protocol === 'http:' && isIP(parsed.hostname) === 4) || parsed.username || parsed.password ||
        parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('PUBLIC_ORIGIN 须填写完整的 HTTPS 网站地址，不包含路径。');
    }
    origin = parsed.origin;
  }
  return {
    cloud, origin, publicAccess,
    host: env.HOST || (cloud ? '0.0.0.0' : '127.0.0.1'),
    authEnabled: Boolean(username),
    expected: username ? digest('Basic ' + Buffer.from(username + ':' + password).toString('base64')) : null,
  };
}

export function checkAccess(req, pathname, config, port) {
  // Cloud load-balancer health checks do not carry a browser's credentials.
  if (req.method === 'GET' && pathname === '/health') return null;
  const localHosts = ['127.0.0.1:' + port, 'localhost:' + port];
  const host = String(req.headers.host || '').toLowerCase();
  if (!/^(?:[a-z0-9-]+\.)*[a-z0-9-]+(?::[0-9]{1,5})?$/.test(host)) {
    return {status: 403, error: '访问地址无效。'};
  }
  if (!config.cloud && !localHosts.includes(host)) {
    return {status: 403, error: '此本地版本只允许本机访问。'};
  }
  if (config.cloud && config.origin && !localHosts.includes(host) && host !== new URL(config.origin).host) {
    return {status: 403, error: '访问地址与部署配置不匹配。'};
  }
  if (config.authEnabled) {
    const authorization = String(req.headers.authorization || '');
    const normalized = authorization.replace(/^basic /i, 'Basic ');
    if (authorization.length > 1024 || !timingSafeEqual(digest(normalized), config.expected)) {
      return {status: 401, error: '请使用评委体验账号和密码登录。', challenge: true};
    }
  }
  if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
    const origins = localHosts.map(value => 'http://' + value);
    if (config.cloud) origins.push(config.origin || 'https://' + host);
    if (!origins.includes(req.headers.origin)) {
      return {status: 403, error: '请求来源不匹配。'};
    }
  }
  return null;
}

export function viewerSession(req, res, config) {
  const existing=String(req.headers.cookie||'').match(/(?:^|;\s*)agrimatch_viewer=([0-9a-f-]{36})(?:;|$)/)?.[1];
  const viewer=existing||randomUUID();
  const secure=config.origin.startsWith('https:')?'; Secure':'';
  res.setHeader('set-cookie','agrimatch_viewer='+viewer+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400'+secure);
  return viewer;
}
