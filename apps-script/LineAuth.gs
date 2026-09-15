const LINE_AUTH_VERSION = '2026-09-15-line-custom-v1';
const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const FIREBASE_CUSTOM_TOKEN_AUD = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const LINE_STATE_TTL_SECONDS = 600;
const LINE_ALLOWED_TARGET_PREFIX = 'https://5j1u35k6.github.io/77-waxing-site/';

function routeLineAuthGet_(e) {
  const action = String(e && e.parameter && e.parameter.action || '').trim();
  if (action === 'line_login') return lineLoginStart_(e);
  if (action === 'line_callback') return lineLoginCallback_(e);
  return null;
}

function lineLoginStart_(e) {
  const config = lineAuthConfig_();
  const target = sanitizeLineTarget_(e && e.parameter && e.parameter.target);
  const state = randomUrlSafe_(32);
  const nonce = randomUrlSafe_(32);
  const cache = CacheService.getScriptCache();
  cache.put(`line_oauth:${state}`, JSON.stringify({ target, nonce, createdAt: Date.now() }), LINE_STATE_TTL_SECONDS);

  const params = {
    response_type: 'code',
    client_id: config.channelId,
    redirect_uri: config.callbackUrl,
    state,
    scope: 'openid profile',
    nonce,
  };
  const authorizeUrl = LINE_AUTHORIZE_URL + '?' + formEncode_(params);
  return htmlRedirect_(authorizeUrl, '正在前往 LINE 登入…');
}

function lineLoginCallback_(e) {
  const state = String(e && e.parameter && e.parameter.state || '').trim();
  const cache = CacheService.getScriptCache();
  const stateKey = `line_oauth:${state}`;
  const raw = state ? cache.get(stateKey) : '';
  const saved = raw ? JSON.parse(raw) : null;
  if (state) cache.remove(stateKey);

  const target = sanitizeLineTarget_(saved && saved.target);
  if (!saved || !state) return lineAuthErrorRedirect_(target, 'state_invalid');

  const oauthError = String(e && e.parameter && e.parameter.error || '').trim();
  if (oauthError) return lineAuthErrorRedirect_(target, oauthError);

  const code = String(e && e.parameter && e.parameter.code || '').trim();
  if (!code) return lineAuthErrorRedirect_(target, 'missing_code');

  try {
    const config = lineAuthConfig_();
    const tokenResponse = UrlFetchApp.fetch(LINE_TOKEN_URL, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.callbackUrl,
        client_id: config.channelId,
        client_secret: config.channelSecret,
      },
      muteHttpExceptions: true,
    });
    if (tokenResponse.getResponseCode() !== 200) {
      console.error('LINE token exchange failed', tokenResponse.getContentText());
      return lineAuthErrorRedirect_(target, 'token_exchange_failed');
    }

    const tokenData = JSON.parse(tokenResponse.getContentText() || '{}');
    const idToken = String(tokenData.id_token || '').trim();
    if (!idToken) return lineAuthErrorRedirect_(target, 'missing_id_token');

    const verifyResponse = UrlFetchApp.fetch(LINE_VERIFY_URL, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: { id_token: idToken, client_id: config.channelId },
      muteHttpExceptions: true,
    });
    if (verifyResponse.getResponseCode() !== 200) {
      console.error('LINE id_token verify failed', verifyResponse.getContentText());
      return lineAuthErrorRedirect_(target, 'id_token_verify_failed');
    }

    const identity = JSON.parse(verifyResponse.getContentText() || '{}');
    if (String(identity.nonce || '') !== String(saved.nonce || '')) {
      return lineAuthErrorRedirect_(target, 'nonce_mismatch');
    }
    const lineUserId = String(identity.sub || '').trim();
    if (!lineUserId) return lineAuthErrorRedirect_(target, 'missing_line_user');

    const customToken = firebaseCustomToken_(`line_${lineUserId}`, {
      provider: 'line',
      lineUserId,
      lineName: String(identity.name || '').slice(0, 100),
      linePicture: String(identity.picture || '').slice(0, 500),
    });

    return htmlRedirect_(appendFragmentParam_(target, '77line_token', customToken), 'LINE 登入成功，正在回到 77waxing…');
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    return lineAuthErrorRedirect_(target, 'server_error');
  }
}

function lineAuthConfig_() {
  const props = PropertiesService.getScriptProperties();
  const channelId = String(props.getProperty('LINE_CHANNEL_ID') || '').trim();
  const channelSecret = String(props.getProperty('LINE_CHANNEL_SECRET') || '').trim();
  const callbackUrl = String(props.getProperty('LINE_CALLBACK_URL') || '').trim();
  const serviceAccountEmail = String(props.getProperty('FIREBASE_SERVICE_ACCOUNT_EMAIL') || '').trim();
  const privateKey = String(props.getProperty('FIREBASE_PRIVATE_KEY') || '').replace(/\\n/g, '\n').trim();
  if (!channelId || !channelSecret || !callbackUrl || !serviceAccountEmail || !privateKey) {
    throw new Error('LINE_AUTH_PROPERTIES_MISSING');
  }
  return { channelId, channelSecret, callbackUrl, serviceAccountEmail, privateKey };
}

function firebaseCustomToken_(uid, claims) {
  const config = lineAuthConfig_();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: config.serviceAccountEmail,
    sub: config.serviceAccountEmail,
    aud: FIREBASE_CUSTOM_TOKEN_AUD,
    iat: now,
    exp: now + 3600,
    uid: String(uid || '').slice(0, 128),
    claims: claims || {},
  };
  const unsigned = `${base64UrlJson_(header)}.${base64UrlJson_(payload)}`;
  const signature = Utilities.computeRsaSha256Signature(unsigned, config.privateKey);
  return `${unsigned}.${Utilities.base64EncodeWebSafe(signature).replace(/=+$/g, '')}`;
}

function sanitizeLineTarget_(value) {
  const target = String(value || '').trim();
  if (target.indexOf(LINE_ALLOWED_TARGET_PREFIX) === 0) return target;
  return LINE_ALLOWED_TARGET_PREFIX;
}

function lineAuthErrorRedirect_(target, code) {
  return htmlRedirect_(appendFragmentParam_(sanitizeLineTarget_(target), '77line_error', String(code || 'login_failed')), 'LINE 登入未完成，正在返回 77waxing…');
}

function appendFragmentParam_(target, key, value) {
  const clean = String(target || '').split('#')[0];
  return `${clean}#${encodeURIComponent(key)}=${encodeURIComponent(String(value || ''))}`;
}

function randomUrlSafe_(bytes) {
  const raw = Utilities.getUuid() + Utilities.getUuid() + String(Date.now()) + String(Math.random());
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '').slice(0, Math.max(16, bytes || 32));
}

function base64UrlJson_(value) {
  return Utilities.base64EncodeWebSafe(JSON.stringify(value), Utilities.Charset.UTF_8).replace(/=+$/g, '');
}

function formEncode_(params) {
  return Object.keys(params).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`).join('&');
}

function htmlRedirect_(url, message) {
  const safeUrl = JSON.stringify(String(url || LINE_ALLOWED_TARGET_PREFIX));
  const safeMessage = String(message || '正在跳轉…').replace(/[<>&]/g, '');
  return HtmlService.createHtmlOutput(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>77waxing Login</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f4ee;color:#292724;display:grid;place-items:center;min-height:100vh;margin:0"><p>${safeMessage}</p><script>location.replace(${safeUrl});<\/script></body></html>`);
}
