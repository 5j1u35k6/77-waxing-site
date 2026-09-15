const LINE_AUTH_VERSION = '2026-09-15-line-custom-v2';
const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const FIREBASE_CUSTOM_TOKEN_AUD = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const LINE_STATE_TTL_SECONDS = 600;
const LINE_ALLOWED_TARGET_PREFIX = 'https://5j1u35k6.github.io/77-waxing-site/';
const LINE_JSONP_CALLBACK = '__77LineExchange';

function routeLineAuthGet_(e) {
  const action = String(e && e.parameter && e.parameter.action || '').trim();
  if (action === 'line_prepare') return linePrepare_(e);
  if (action === 'line_exchange') return lineExchangeJsonp_(e);
  // Kept as a diagnostic fallback. Production login starts directly from 77waxing.
  if (action === 'line_login') return lineLoginStart_(e);
  if (action === 'line_callback') return lineLoginCallback_(e);
  return null;
}

function linePrepare_(e) {
  try {
    const state = String(e && e.parameter && e.parameter.state || '').trim();
    const nonce = String(e && e.parameter && e.parameter.nonce || '').trim();
    const target = sanitizeLineTarget_(e && e.parameter && e.parameter.target);
    if (!/^[A-Za-z0-9_-]{24,128}$/.test(state) || !/^[A-Za-z0-9_-]{24,128}$/.test(nonce)) {
      return json_({ ok:false, error:'invalid_prepare', version:LINE_AUTH_VERSION });
    }
    CacheService.getScriptCache().put(
      `line_oauth:${state}`,
      JSON.stringify({ target, nonce, createdAt: Date.now() }),
      LINE_STATE_TTL_SECONDS
    );
    return json_({ ok:true, version:LINE_AUTH_VERSION });
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    return json_({ ok:false, error:'prepare_failed', version:LINE_AUTH_VERSION });
  }
}

function lineLoginStart_(e) {
  const config = lineAuthConfig_();
  const target = sanitizeLineTarget_(e && e.parameter && e.parameter.target);
  const state = randomUrlSafe_(32);
  const nonce = randomUrlSafe_(32);
  CacheService.getScriptCache().put(
    `line_oauth:${state}`,
    JSON.stringify({ target, nonce, createdAt: Date.now() }),
    LINE_STATE_TTL_SECONDS
  );

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

function lineExchangeJsonp_(e) {
  const callback = String(e && e.parameter && e.parameter.callback || '').trim();
  if (callback !== LINE_JSONP_CALLBACK) {
    return javascriptOutput_('void 0;');
  }

  const state = String(e && e.parameter && e.parameter.state || '').trim();
  const code = String(e && e.parameter && e.parameter.code || '').trim();
  const result = exchangeLineCode_(state, code);
  return javascriptOutput_(`${LINE_JSONP_CALLBACK}(${JSON.stringify(result)});`);
}

function lineLoginCallback_(e) {
  const state = String(e && e.parameter && e.parameter.state || '').trim();
  const oauthError = String(e && e.parameter && e.parameter.error || '').trim();
  const code = String(e && e.parameter && e.parameter.code || '').trim();
  const result = oauthError
    ? { ok:false, error:oauthError, state, target:LINE_ALLOWED_TARGET_PREFIX }
    : exchangeLineCode_(state, code);

  const target = sanitizeLineTarget_(result.target);
  if (!result.ok) {
    return htmlRedirect_(appendFragmentParams_(target, {
      '77line_error': String(result.error || 'login_failed'),
      '77line_state': String(state || ''),
    }), 'LINE 登入未完成，正在返回 77waxing…');
  }

  return htmlRedirect_(appendFragmentParams_(target, {
    '77line_token': result.customToken,
    '77line_state': state,
  }), 'LINE 登入成功，正在回到 77waxing…');
}

function exchangeLineCode_(state, code) {
  const cache = CacheService.getScriptCache();
  const stateKey = `line_oauth:${state}`;
  const raw = state ? cache.get(stateKey) : '';
  const saved = raw ? JSON.parse(raw) : null;
  const target = sanitizeLineTarget_(saved && saved.target);

  if (!saved || !state) return { ok:false, error:'state_invalid', state, target };
  if (!code) return { ok:false, error:'missing_code', state, target };

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
      return { ok:false, error:'token_exchange_failed', state, target };
    }

    const tokenData = JSON.parse(tokenResponse.getContentText() || '{}');
    const idToken = String(tokenData.id_token || '').trim();
    if (!idToken) return { ok:false, error:'missing_id_token', state, target };

    const verifyResponse = UrlFetchApp.fetch(LINE_VERIFY_URL, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: { id_token: idToken, client_id: config.channelId },
      muteHttpExceptions: true,
    });
    if (verifyResponse.getResponseCode() !== 200) {
      console.error('LINE id_token verify failed', verifyResponse.getContentText());
      return { ok:false, error:'id_token_verify_failed', state, target };
    }

    const identity = JSON.parse(verifyResponse.getContentText() || '{}');
    if (String(identity.nonce || '') !== String(saved.nonce || '')) {
      return { ok:false, error:'nonce_mismatch', state, target };
    }

    const lineUserId = String(identity.sub || '').trim();
    if (!lineUserId) return { ok:false, error:'missing_line_user', state, target };

    const customToken = firebaseCustomToken_(`line_${lineUserId}`, {
      provider: 'line',
      lineUserId,
      lineName: String(identity.name || '').slice(0, 100),
      linePicture: String(identity.picture || '').slice(0, 500),
    });

    cache.remove(stateKey);
    return { ok:true, customToken, state, target };
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    return { ok:false, error:'server_error', state, target };
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

function appendFragmentParams_(target, params) {
  const clean = String(target || '').split('#')[0];
  const fragment = Object.keys(params || {})
    .filter(key => params[key] !== undefined && params[key] !== null && String(params[key]) !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
  return fragment ? `${clean}#${fragment}` : clean;
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

function javascriptOutput_(source) {
  return ContentService.createTextOutput(String(source || 'void 0;'))
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function htmlRedirect_(url, message) {
  const safeUrl = String(url || LINE_ALLOWED_TARGET_PREFIX);
  const safeMessage = String(message || '正在跳轉…').replace(/[<>&]/g, '');
  const escapedUrl = safeUrl
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return HtmlService.createHtmlOutput(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_top"><title>77waxing Login</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f4ee;color:#292724;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center"><p>${safeMessage}</p><a href="${escapedUrl}" target="_top" style="display:inline-block;margin-top:16px;padding:13px 24px;border-radius:999px;background:#06c755;color:white;text-decoration:none;font-weight:700">繼續</a></div></body></html>`);
}
