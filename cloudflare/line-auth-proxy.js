const GAS_URL = 'https://script.google.com/macros/s/AKfycbx6iC26KXbHWYte5XhLGNRMmG16Yydx2vPHDxYpmp4rmWn3plk__6Qwwr7Y09hLptTW/exec';
const ALLOWED_ORIGIN = 'https://5j1u35k6.github.io';
const ALLOWED_TARGET_PREFIX = 'https://5j1u35k6.github.io/77-waxing-site/';
const LINE_JSONP_CALLBACK = '__77LineExchange';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders_(request) });
    }

    try {
      if (request.method !== 'POST') {
        return json_({ ok: false, error: 'method_not_allowed' }, 405, request);
      }

      const origin = request.headers.get('Origin') || '';
      if (origin && origin !== ALLOWED_ORIGIN) {
        return json_({ ok: false, error: 'origin_not_allowed' }, 403, request);
      }

      const body = await request.json().catch(() => ({}));
      const action = String(body.action || '').trim();

      if (action === 'line_prepare') {
        return await prepare_(body, request);
      }

      if (action === 'line_exchange') {
        return await exchange_(body, request);
      }

      return json_({ ok: false, error: 'invalid_action' }, 400, request);
    } catch (error) {
      return json_({ ok: false, error: 'proxy_error' }, 500, request);
    }
  },
};

async function prepare_(body, request) {
  const state = String(body.state || '').trim();
  const nonce = String(body.nonce || '').trim();
  const target = sanitizeTarget_(body.target);

  if (!validToken_(state) || !validToken_(nonce)) {
    return json_({ ok: false, error: 'invalid_prepare' }, 400, request);
  }

  const gas = new URL(GAS_URL);
  gas.searchParams.set('action', 'line_prepare');
  gas.searchParams.set('state', state);
  gas.searchParams.set('nonce', nonce);
  gas.searchParams.set('target', target);
  gas.searchParams.set('_', String(Date.now()));

  const response = await fetch(gas.href, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': '77waxing-line-auth-proxy/1.0' },
  });

  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}

  if (!response.ok || !payload || !payload.ok) {
    return json_({ ok: false, error: payload?.error || 'prepare_backend_failed' }, 502, request);
  }

  return json_({ ok: true }, 200, request);
}

async function exchange_(body, request) {
  const state = String(body.state || '').trim();
  const code = String(body.code || '').trim();

  if (!validToken_(state) || !code || code.length > 4096) {
    return json_({ ok: false, error: 'invalid_exchange' }, 400, request);
  }

  const gas = new URL(GAS_URL);
  gas.searchParams.set('action', 'line_exchange');
  gas.searchParams.set('callback', LINE_JSONP_CALLBACK);
  gas.searchParams.set('state', state);
  gas.searchParams.set('code', code);
  gas.searchParams.set('_', String(Date.now()));

  const response = await fetch(gas.href, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': '77waxing-line-auth-proxy/1.0' },
  });

  const source = await response.text();
  if (!response.ok) {
    return json_({ ok: false, error: 'exchange_backend_failed' }, 502, request);
  }

  const payload = parseJsonp_(source);
  if (!payload) {
    return json_({ ok: false, error: 'exchange_backend_invalid' }, 502, request);
  }

  return json_(payload, 200, request);
}

function parseJsonp_(source) {
  const text = String(source || '').trim();
  const prefix = `${LINE_JSONP_CALLBACK}(`;
  if (!text.startsWith(prefix)) return null;
  const end = text.endsWith(');') ? -2 : text.endsWith(')') ? -1 : 0;
  if (!end) return null;
  const json = text.slice(prefix.length, end);
  try { return JSON.parse(json); } catch { return null; }
}

function validToken_(value) {
  return /^[A-Za-z0-9_-]{24,128}$/.test(String(value || ''));
}

function sanitizeTarget_(value) {
  const target = String(value || '').trim();
  return target.startsWith(ALLOWED_TARGET_PREFIX) ? target : ALLOWED_TARGET_PREFIX;
}

function corsHeaders_(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

function json_(payload, status, request) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders_(request),
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
