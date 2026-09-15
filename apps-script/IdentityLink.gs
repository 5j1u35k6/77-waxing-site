const IDENTITY_LINK_VERSION = '2026-09-15-identity-link-v1';
const IDENTITY_PROJECT_ID = 'waxing-86909';
const FIREBASE_WEB_API_KEY = 'AIzaSyB53YYJsuFybvuPfLD3gFSKxxKfTT20dWs';
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`;
const FIRESTORE_ADMIN_BASE = `https://firestore.googleapis.com/v1/projects/${IDENTITY_PROJECT_ID}/databases/(default)/documents`;
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const IDENTITY_LINK_COLLECTION = 'identityLinks';
const IDENTITY_OWNER_COLLECTIONS = ['bookings', 'shopOrders', 'shopMessages'];

function routeIdentityLinkPost_(payload) {
  const action = String(payload && payload.action || '').trim();
  if (!action) return null;

  try {
    if (action === 'identity_status') return json_(identityStatus_(payload));
    if (action === 'identity_resolve') return json_(identityResolve_(payload));
    if (action === 'identity_bind_google') return json_(identityBindGoogle_(payload));
    if (action === 'line_link_prepare') return json_(lineLinkPreparePost_(payload));
    return null;
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    const code = String(err && err.message || 'identity_server_error');
    return json_({ ok:false, error:identityPublicErrorCode_(code), version:IDENTITY_LINK_VERSION });
  }
}

function identityStatus_(payload) {
  const user = firebaseLookupUser_(String(payload.firebaseIdToken || '').trim());
  ensureNativeIdentityLinks_(user);
  const links = identityLinksForCanonical_(user.uid);
  const providers = { line:false, google:false };

  if (String(user.uid || '').indexOf('line_') === 0) providers.line = true;
  if (firebaseProviderSubject_(user, 'google')) providers.google = true;
  links.forEach(link => {
    if (link.provider === 'line') providers.line = true;
    if (link.provider === 'google') providers.google = true;
  });

  return {
    ok:true,
    uid:user.uid,
    providers,
    version:IDENTITY_LINK_VERSION,
  };
}

function identityResolve_(payload) {
  const user = firebaseLookupUser_(String(payload.firebaseIdToken || '').trim());
  const provider = String(payload.provider || 'google').trim().toLowerCase();
  const subject = firebaseProviderSubject_(user, provider);
  if (!subject) return { ok:true, uid:user.uid, canonicalUid:user.uid, mapped:false, version:IDENTITY_LINK_VERSION };

  let link = getIdentityLink_(provider, subject);
  if (!link) {
    upsertIdentityLink_(provider, subject, user.uid, user.uid, 'native');
    link = { canonicalUid:user.uid, sourceUid:user.uid, bindingMode:'native', provider };
  }

  const canonicalUid = String(link.canonicalUid || user.uid).trim() || user.uid;
  if (canonicalUid === user.uid) {
    return { ok:true, uid:user.uid, canonicalUid, mapped:false, version:IDENTITY_LINK_VERSION };
  }

  return {
    ok:true,
    uid:user.uid,
    canonicalUid,
    mapped:true,
    customToken:firebaseCustomToken_(canonicalUid, {
      provider:'linked',
      linkedProvider:provider,
    }),
    version:IDENTITY_LINK_VERSION,
  };
}

function identityBindGoogle_(payload) {
  const primary = firebaseLookupUser_(String(payload.primaryIdToken || '').trim());
  const secondary = firebaseLookupUser_(String(payload.secondaryIdToken || '').trim());
  const subject = firebaseProviderSubject_(secondary, 'google');
  if (!subject) throw new Error('google_identity_missing');

  const primaryGoogleSubject = firebaseProviderSubject_(primary, 'google');
  if (primaryGoogleSubject && primaryGoogleSubject !== subject) {
    throw new Error('primary_google_exists');
  }

  const existing = getIdentityLink_('google', subject);
  if (existing && String(existing.canonicalUid || '') !== primary.uid) {
    const existingCanonical = String(existing.canonicalUid || '').trim();
    const existingSource = String(existing.sourceUid || '').trim();
    const existingMode = String(existing.bindingMode || '').trim();
    const mayReassignNative = existingMode === 'native'
      && existingCanonical === secondary.uid
      && (!existingSource || existingSource === secondary.uid);
    if (!mayReassignNative) throw new Error('google_already_linked');
  }

  const migration = migrateMemberOwnership_(secondary.uid, primary.uid);
  upsertIdentityLink_('google', subject, primary.uid, secondary.uid, 'linked');
  ensureNativeIdentityLinks_(primary);

  return {
    ok:true,
    canonicalUid:primary.uid,
    providers:{ google:true },
    migration,
    customToken:firebaseCustomToken_(primary.uid, {
      provider:'linked',
      linkedProvider:'google',
    }),
    version:IDENTITY_LINK_VERSION,
  };
}

function lineLinkPreparePost_(payload) {
  const state = String(payload.state || '').trim();
  const nonce = String(payload.nonce || '').trim();
  const target = sanitizeLineTarget_(payload.target);
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(state) || !/^[A-Za-z0-9_-]{24,128}$/.test(nonce)) {
    throw new Error('invalid_link_prepare');
  }

  const primary = firebaseLookupUser_(String(payload.firebaseIdToken || '').trim());
  ensureNativeIdentityLinks_(primary);

  CacheService.getScriptCache().put(
    `line_oauth:${state}`,
    JSON.stringify({
      target,
      nonce,
      createdAt:Date.now(),
      mode:'link',
      canonicalUid:primary.uid,
    }),
    LINE_STATE_TTL_SECONDS
  );

  return {
    ok:true,
    canonicalUid:primary.uid,
    version:IDENTITY_LINK_VERSION,
  };
}

function resolveLineCanonicalUid_(lineUserId, defaultUid) {
  const subject = String(lineUserId || '').trim();
  const fallbackUid = String(defaultUid || '').trim();
  if (!subject || !fallbackUid) throw new Error('line_identity_missing');

  const link = getIdentityLink_('line', subject);
  if (link && String(link.canonicalUid || '').trim()) return String(link.canonicalUid).trim();

  upsertIdentityLink_('line', subject, fallbackUid, fallbackUid, 'native');
  return fallbackUid;
}

function completeLineLink_(lineUserId, canonicalUid, defaultUid) {
  const subject = String(lineUserId || '').trim();
  const targetUid = String(canonicalUid || '').trim();
  const sourceUid = String(defaultUid || '').trim();
  if (!subject || !targetUid || !sourceUid) throw new Error('line_link_missing_data');

  const existing = getIdentityLink_('line', subject);
  if (existing && String(existing.canonicalUid || '') !== targetUid) {
    const existingCanonical = String(existing.canonicalUid || '').trim();
    const existingSource = String(existing.sourceUid || '').trim();
    const existingMode = String(existing.bindingMode || '').trim();
    const mayReassignNative = existingMode === 'native'
      && existingCanonical === sourceUid
      && (!existingSource || existingSource === sourceUid);
    if (!mayReassignNative) throw new Error('line_already_linked');
  }

  migrateMemberOwnership_(sourceUid, targetUid);
  upsertIdentityLink_('line', subject, targetUid, sourceUid, 'linked');
  return targetUid;
}

function ensureNativeIdentityLinks_(user) {
  if (!user || !user.uid) return;

  const googleSubject = firebaseProviderSubject_(user, 'google');
  if (googleSubject) {
    const existingGoogle = getIdentityLink_('google', googleSubject);
    if (!existingGoogle) upsertIdentityLink_('google', googleSubject, user.uid, user.uid, 'native');
  }

  if (String(user.uid).indexOf('line_') === 0) {
    const lineSubject = String(user.uid).slice(5);
    if (lineSubject) {
      const existingLine = getIdentityLink_('line', lineSubject);
      if (!existingLine) upsertIdentityLink_('line', lineSubject, user.uid, user.uid, 'native');
    }
  }
}

function firebaseLookupUser_(idToken) {
  if (!idToken) throw new Error('firebase_token_missing');
  const response = UrlFetchApp.fetch(FIREBASE_LOOKUP_URL, {
    method:'post',
    contentType:'application/json',
    payload:JSON.stringify({ idToken }),
    muteHttpExceptions:true,
  });
  if (response.getResponseCode() !== 200) {
    console.error('Firebase accounts lookup failed', response.getContentText());
    throw new Error('firebase_token_invalid');
  }
  const body = JSON.parse(response.getContentText() || '{}');
  const raw = body.users && body.users[0];
  if (!raw || !raw.localId) throw new Error('firebase_user_missing');
  return {
    uid:String(raw.localId || '').trim(),
    email:String(raw.email || '').trim(),
    displayName:String(raw.displayName || '').trim(),
    providerUserInfo:Array.isArray(raw.providerUserInfo) ? raw.providerUserInfo : [],
  };
}

function firebaseProviderSubject_(user, provider) {
  const wanted = provider === 'google' ? 'google.com' : provider;
  const info = (user.providerUserInfo || []).find(item => String(item && item.providerId || '') === wanted);
  if (!info) return '';
  return String(info.rawId || info.federatedId || '').trim();
}

function getIdentityLink_(provider, subject) {
  return identityAdminGetDoc_(IDENTITY_LINK_COLLECTION, identityLinkDocId_(provider, subject));
}

function upsertIdentityLink_(provider, subject, canonicalUid, sourceUid, bindingMode) {
  const docId = identityLinkDocId_(provider, subject);
  identityAdminPatchDoc_(IDENTITY_LINK_COLLECTION, docId, {
    provider:String(provider || ''),
    subjectHash:identitySubjectHash_(provider, subject),
    canonicalUid:String(canonicalUid || ''),
    sourceUid:String(sourceUid || ''),
    bindingMode:String(bindingMode || 'native'),
    updatedAtIso:new Date().toISOString(),
  });
}

function identityLinksForCanonical_(uid) {
  return identityAdminQuery_(IDENTITY_LINK_COLLECTION, 'canonicalUid', String(uid || ''));
}

function migrateMemberOwnership_(sourceUid, targetUid) {
  const source = String(sourceUid || '').trim();
  const target = String(targetUid || '').trim();
  const counts = { profiles:0, bookings:0, shopOrders:0, shopMessages:0 };
  if (!source || !target || source === target) return counts;

  const sourceProfile = identityAdminGetDoc_('memberProfiles', source);
  const targetProfile = identityAdminGetDoc_('memberProfiles', target) || {};
  if (sourceProfile) {
    const mergeable = [
      'displayName', 'email', 'phone', 'phoneCountry', 'gender',
      'avatarUrl', 'lineUserId', 'linePicture', 'provider'
    ];
    const patch = { uid:target };
    mergeable.forEach(key => {
      const targetValue = targetProfile[key];
      const sourceValue = sourceProfile[key];
      const targetEmpty = targetValue === undefined || targetValue === null || String(targetValue).trim() === '';
      if (targetEmpty && sourceValue !== undefined && sourceValue !== null && String(sourceValue).trim() !== '') {
        patch[key] = sourceValue;
      }
    });
    const linkedProviders = [];
    [targetProfile.linkedProviders, sourceProfile.linkedProviders].forEach(list => {
      if (Array.isArray(list)) list.forEach(item => {
        const value = String(item || '').trim();
        if (value && linkedProviders.indexOf(value) === -1) linkedProviders.push(value);
      });
    });
    if (linkedProviders.length) patch.linkedProviders = linkedProviders;
    identityAdminPatchDoc_('memberProfiles', target, patch);
    identityAdminDeleteDoc_('memberProfiles', source);
    counts.profiles = 1;
  }

  IDENTITY_OWNER_COLLECTIONS.forEach(collectionId => {
    const docs = identityAdminQueryDocs_(collectionId, 'ownerUid', source);
    docs.forEach(doc => identityAdminPatchDocByName_(doc.name, { ownerUid:target }));
    counts[collectionId] = docs.length;
  });

  return counts;
}

function firebaseAdminAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('firebase_admin_access_token_v1');
  if (cached) return cached;

  const config = lineAuthConfig_();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg:'RS256', typ:'JWT' };
  const payload = {
    iss:config.serviceAccountEmail,
    scope:'https://www.googleapis.com/auth/datastore',
    aud:GOOGLE_OAUTH_TOKEN_URL,
    iat:now,
    exp:now + 3600,
  };
  const unsigned = `${base64UrlJson_(header)}.${base64UrlJson_(payload)}`;
  const signature = Utilities.computeRsaSha256Signature(unsigned, config.privateKey);
  const assertion = `${unsigned}.${Utilities.base64EncodeWebSafe(signature).replace(/=+$/g, '')}`;

  const response = UrlFetchApp.fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method:'post',
    contentType:'application/x-www-form-urlencoded',
    payload:{
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    },
    muteHttpExceptions:true,
  });
  if (response.getResponseCode() !== 200) {
    console.error('Firebase admin access token failed', response.getContentText());
    throw new Error('firebase_admin_token_failed');
  }
  const body = JSON.parse(response.getContentText() || '{}');
  const token = String(body.access_token || '').trim();
  if (!token) throw new Error('firebase_admin_token_missing');
  cache.put('firebase_admin_access_token_v1', token, 3300);
  return token;
}

function identityAdminGetDoc_(collectionId, docId) {
  const url = `${FIRESTORE_ADMIN_BASE}/${encodeURIComponent(collectionId)}/${encodeURIComponent(docId)}`;
  const response = identityAdminFetch_(url, { method:'get' });
  const code = response.getResponseCode();
  if (code === 404) return null;
  if (code !== 200) throw new Error(`firestore_admin_get_${code}`);
  const body = JSON.parse(response.getContentText() || '{}');
  return identityDecodeMap_(body.fields || {});
}

function identityAdminPatchDoc_(collectionId, docId, data) {
  const name = `projects/${IDENTITY_PROJECT_ID}/databases/(default)/documents/${collectionId}/${docId}`;
  return identityAdminPatchDocByName_(name, data);
}

function identityAdminPatchDocByName_(documentName, data) {
  const shortPrefix = `projects/${IDENTITY_PROJECT_ID}/databases/(default)/documents/`;
  const relative = String(documentName || '').indexOf(shortPrefix) === 0
    ? String(documentName).slice(shortPrefix.length)
    : String(documentName || '');
  const keys = Object.keys(data || {});
  if (!relative || !keys.length) return;
  const masks = keys.map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
  const url = `${FIRESTORE_ADMIN_BASE}/${relative.split('/').map(encodeURIComponent).join('/')}?${masks}`;
  const fields = {};
  keys.forEach(key => { fields[key] = identityEncodeValue_(data[key]); });
  const response = identityAdminFetch_(url, {
    method:'patch',
    contentType:'application/json',
    payload:JSON.stringify({ fields }),
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error('Firestore admin patch failed', code, response.getContentText());
    throw new Error(`firestore_admin_patch_${code}`);
  }
}

function identityAdminDeleteDoc_(collectionId, docId) {
  const url = `${FIRESTORE_ADMIN_BASE}/${encodeURIComponent(collectionId)}/${encodeURIComponent(docId)}`;
  const response = identityAdminFetch_(url, { method:'delete' });
  const code = response.getResponseCode();
  if (code !== 200 && code !== 204 && code !== 404) throw new Error(`firestore_admin_delete_${code}`);
}

function identityAdminQuery_(collectionId, fieldPath, value) {
  return identityAdminQueryDocs_(collectionId, fieldPath, value).map(doc => ({
    id:String(doc.name || '').split('/').pop(),
    ...identityDecodeMap_(doc.fields || {}),
  }));
}

function identityAdminQueryDocs_(collectionId, fieldPath, value) {
  const url = `${FIRESTORE_ADMIN_BASE}:runQuery`;
  const response = identityAdminFetch_(url, {
    method:'post',
    contentType:'application/json',
    payload:JSON.stringify({
      structuredQuery:{
        from:[{ collectionId }],
        where:{
          fieldFilter:{
            field:{ fieldPath },
            op:'EQUAL',
            value:identityEncodeValue_(value),
          },
        },
      },
    }),
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    console.error('Firestore admin query failed', code, response.getContentText());
    throw new Error(`firestore_admin_query_${code}`);
  }
  const rows = identityParseQueryResponse_(response.getContentText());
  return rows.map(row => row && row.document).filter(Boolean);
}

function identityAdminFetch_(url, options) {
  const headers = Object.assign({}, options && options.headers || {}, {
    Authorization:`Bearer ${firebaseAdminAccessToken_()}`,
  });
  return UrlFetchApp.fetch(url, Object.assign({}, options || {}, {
    headers,
    muteHttpExceptions:true,
  }));
}

function identityParseQueryResponse_(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    return source.split(/\r?\n/).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }
}

function identityEncodeValue_(value) {
  if (value === null || value === undefined) return { nullValue:null };
  if (typeof value === 'boolean') return { booleanValue:value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue:String(value) } : { doubleValue:value };
  }
  if (Array.isArray(value)) return { arrayValue:{ values:value.map(identityEncodeValue_) } };
  if (typeof value === 'object') {
    const fields = {};
    Object.keys(value).forEach(key => { fields[key] = identityEncodeValue_(value[key]); });
    return { mapValue:{ fields } };
  }
  return { stringValue:String(value) };
}

function identityDecodeMap_(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(key => { out[key] = identityDecodeValue_(fields[key]); });
  return out;
}

function identityDecodeValue_(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(identityDecodeValue_);
  if ('mapValue' in value) return identityDecodeMap_(value.mapValue.fields || {});
  return null;
}

function identityLinkDocId_(provider, subject) {
  return `${String(provider || '').toLowerCase()}_${identitySubjectHash_(provider, subject)}`;
}

function identitySubjectHash_(provider, subject) {
  const source = `${String(provider || '').toLowerCase()}:${String(subject || '')}`;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}

function identityPublicErrorCode_(message) {
  const value = String(message || '').toLowerCase();
  if (value.indexOf('google_already_linked') >= 0) return 'google_already_linked';
  if (value.indexOf('line_already_linked') >= 0) return 'line_already_linked';
  if (value.indexOf('primary_google_exists') >= 0) return 'primary_google_exists';
  if (value.indexOf('firebase_token') >= 0 || value.indexOf('firebase_user') >= 0) return 'firebase_auth_invalid';
  if (value.indexOf('invalid_link_prepare') >= 0) return 'invalid_link_prepare';
  if (value.indexOf('google_identity_missing') >= 0) return 'google_identity_missing';
  return 'identity_server_error';
}
