/**
 * Read-only GHCR /v2/ manifest digest inspection, independent of Docker Buildx.
 * Pull-scope registry bearer tokens; fixed ghcr.io URLs, no redirects.
 * Root header SHA-256 MUST match received raw manifest bytes.
 */
import { createHash } from 'node:crypto';

const REF = /^ghcr\.io\/([a-z0-9_.-]+\/[a-z0-9_.-]+):([a-f0-9]{40})$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json'
];
const MAX_MANIFEST = 4 * 1024 * 1024;

function registryError(message, status) {
  const e = new Error(message + (status ? ': HTTP ' + status : ''));
  e.status = status;
  return e;
}

async function fetchScopedToken(repository, { request, username, credential, authenticated }) {
  const url = new URL('https://ghcr.io/token');
  url.searchParams.set('service', 'ghcr.io');
  url.searchParams.set('scope', 'repository:' + repository + ':pull');
  const headers = { Accept: 'application/json' };
  if (authenticated) {
    if (!username || !credential) throw registryError('GHCR read:packages credentials unavailable');
    headers.Authorization = 'Basic ' + Buffer.from(username + ':' + credential).toString('base64');
  }
  const response = await request(url.toString(), {
    headers, method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000)
  });
  if (!response || !response.ok) {
    throw registryError('GHCR registry token request denied', response?.status);
  }
  const json = await response.json();
  const token = json?.token || json?.access_token;
  if (typeof token !== 'string' || token.length < 3 || token.length > 16384) {
    throw registryError('GHCR registry token response invalid');
  }
  return token;
}

async function fetchRootManifest(repository, sha, bearer, { request }) {
  const url = 'https://ghcr.io/v2/' + repository + '/manifests/' + sha;
  const response = await request(url, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { Authorization: 'Bearer ' + bearer, Accept: ACCEPT.join(', ') }
  });
  if (!response || response.status !== 200) {
    throw registryError('GHCR root manifest request failed', response?.status);
  }
  const mediaType = (response.headers?.get('content-type') || '').split(';')[0].trim();
  if (!ACCEPT.includes(mediaType)) throw registryError('Unrecognized GHCR root manifest content-type');
  const advertisedLength = Number(response.headers?.get('content-length') || 0);
  if (!Number.isFinite(advertisedLength) || advertisedLength > MAX_MANIFEST) {
    throw registryError('GHCR root manifest content-length too large');
  }
  const expected = response.headers?.get('docker-content-digest');
  if (!DIGEST.test(expected || '')) throw registryError('GHCR root Docker-Content-Digest missing/invalid');
  const raw = Buffer.from(await response.arrayBuffer());
  if (!raw.length || raw.length > MAX_MANIFEST) throw registryError('GHCR root manifest payload invalid/oversized');
  const actual = 'sha256:' + createHash('sha256').update(raw).digest('hex');
  if (actual !== expected) throw registryError('GHCR root digest disagrees with raw OCI bytes');
  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); }
  catch { throw registryError('GHCR root manifest JSON malformed'); }
  if (payload?.schemaVersion !== 2 ||
      (payload.mediaType && payload.mediaType !== mediaType)) {
    throw registryError('GHCR manifest mediaType/schema mismatch');
  }
  return actual;
}

/**
 * Resolve tag's ROOT digest directly via GHCR. Public packages use anonymous
 * tokens; private packages may fall back to GitHub CLI's read:packages token.
 * Authorization is transmitted ONLY to fixed ghcr.io HTTPS endpoints.
 */
export async function ghcrRootDigest(ref, {
  request = fetch,
  username = process.env.GHCR_USERNAME || '',
  credential = process.env.GHCR_READ_TOKEN || process.env.GITHUB_TOKEN || ''
} = {}) {
  const match = REF.exec(ref || '');
  if (!match) throw registryError('Expected exact lowercase GHCR SHA-tagged image reference');
  const [, repository, sha] = match;
  try {
    const bearer = await fetchScopedToken(repository, {
      request, username, credential, authenticated: false
    });
    return await fetchRootManifest(repository, sha, bearer, { request });
  } catch (error) {
    if (![401, 403].includes(error?.status)) throw error;
    if (!username || !credential) {
      throw registryError('GHCR private package requires GitHub read:packages credentials', error.status);
    }
  }
  try {
    const bearer = await fetchScopedToken(repository, {
      request, username, credential, authenticated: true
    });
    return await fetchRootManifest(repository, sha, bearer, { request });
  } catch (error) {
    if ([401,403].includes(error?.status)) {
      throw registryError(
        'GHCR pull denied after anonymous and authenticated checks. ' +
        'This is a package visibility or read:packages authorization problem, ' +
        'NOT an OCI digest mismatch. Verify BOTH GHCR packages are public, ' +
        'or use a local classic PAT with only read:packages as GHCR_READ_TOKEN',
        error.status
      );
    }
    throw error;
  }
}
