import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

// Hand-rolled Google Drive v3 integration. We avoid pulling in the full
// `googleapis` package (several MB) because we only need: OAuth code → token
// exchange, refresh → access token, folder lookup/create, and a multipart
// upload. All functions here run server-side.

const ROOT_FOLDER_NAME = 'Workshop Submissions';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// ---------- Config -----------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

export function driveConfig() {
  return {
    clientId: requireEnv('GOOGLE_DRIVE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_DRIVE_CLIENT_SECRET'),
  };
}

// Google OAuth requires the redirect_uri at both /start and /callback to
// match exactly, AND to match an Authorized URI in Google Cloud Console. We
// derive it from the request origin so localhost and the Vercel URL both
// work without needing to swap env vars when switching environments.
export function driveRedirectUri(origin: string): string {
  return `${origin}/api/drive/oauth/callback`;
}

export function driveAuthUrl(state: string, redirectUri: string): string {
  const { clientId } = driveConfig();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  // prompt=consent forces Google to always issue a refresh token, even if
  // the admin has already granted the app before.
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', DRIVE_SCOPE);
  url.searchParams.set('state', state);
  return url.toString();
}

// ---------- Encryption (AES-256-GCM) -----------------------------------------

function encKey(): Buffer {
  const raw = requireEnv('DRIVE_TOKEN_ENC_KEY');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('DRIVE_TOKEN_ENC_KEY must decode to 32 bytes (AES-256)');
  }
  return key;
}

export function encryptRefreshToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv) as CipherGCM;
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: iv || ciphertext || tag, all base64.
  return Buffer.concat([iv, ciphertext, tag]).toString('base64');
}

export function decryptRefreshToken(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 12 + 16) throw new Error('Encrypted payload too short');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', encKey(), iv) as DecipherGCM;
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  );
}

// ---------- OAuth exchange ---------------------------------------------------

type TokenExchangeResult = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

async function postToken(
  body: Record<string, string>,
): Promise<TokenExchangeResult> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token endpoint failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenExchangeResult;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{
  refreshToken: string;
  accessToken: string;
  scope: string;
}> {
  const { clientId, clientSecret } = driveConfig();
  const result = await postToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (!result.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token — did the user previously grant? ' +
        'Use prompt=consent and ensure the Google account revokes the app before retrying.',
    );
  }
  return {
    refreshToken: result.refresh_token,
    accessToken: result.access_token,
    scope: result.scope,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = driveConfig();
  const result = await postToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  return result.access_token;
}

// ---------- User info (for display) -----------------------------------------

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo?fields=email',
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

// ---------- Token store ------------------------------------------------------

export type DriveConnection = {
  adminProfileId: string;
  encryptedRefreshToken: string;
  scope: string;
  googleAccountEmail: string | null;
  connectedAt: string;
};

export async function getActiveDriveConnection(): Promise<DriveConnection | null> {
  // Phase 7 ships one admin-connection-per-workspace. The row we care about
  // is "the most recently connected"; later phases can expand to per-admin.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('drive_tokens')
    .select(
      'admin_profile_id, encrypted_refresh_token, scope, google_account_email, connected_at',
    )
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[drive] getActiveDriveConnection failed', error);
    return null;
  }
  if (!data) return null;
  return {
    adminProfileId: data.admin_profile_id as string,
    encryptedRefreshToken: data.encrypted_refresh_token as string,
    scope: data.scope as string,
    googleAccountEmail: (data.google_account_email as string | null) ?? null,
    connectedAt: data.connected_at as string,
  };
}

export async function storeDriveConnection(args: {
  adminProfileId: string;
  refreshToken: string;
  scope: string;
  email: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const row = {
    admin_profile_id: args.adminProfileId,
    encrypted_refresh_token: encryptRefreshToken(args.refreshToken),
    scope: args.scope,
    google_account_email: args.email,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('drive_tokens')
    .upsert(row, { onConflict: 'admin_profile_id' });
  if (error) throw error;
}

export async function removeDriveConnection(
  adminProfileId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('drive_tokens')
    .delete()
    .eq('admin_profile_id', adminProfileId);
  if (error) throw error;
}

// ---------- Drive REST helpers -----------------------------------------------

async function driveFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
    },
  });
  return res;
}

async function findFolder(
  accessToken: string,
  name: string,
  parentId: string | null,
): Promise<string | null> {
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    `name='${name.replace(/'/g, "\\'")}'`,
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ].join(' and ');
  const url = `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
  const res = await driveFetch(accessToken, url);
  if (!res.ok) {
    throw new Error(`Drive findFolder failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId: string | null,
): Promise<string> {
  const res = await driveFetch(accessToken, '/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`Drive createFolder failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function ensureRootFolder(accessToken: string): Promise<string> {
  const existing = await findFolder(accessToken, ROOT_FOLDER_NAME, null);
  if (existing) return existing;
  return createFolder(accessToken, ROOT_FOLDER_NAME, null);
}

async function ensureActivityFolder(
  accessToken: string,
  activityId: string,
  activityTitle: string,
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('activity_drive_folders')
    .select('drive_folder_id')
    .eq('activity_id', activityId)
    .maybeSingle();
  if (error) {
    console.error('[drive] ensureActivityFolder lookup failed', error);
  }
  if (data?.drive_folder_id) return data.drive_folder_id as string;

  const root = await ensureRootFolder(accessToken);
  const folderId = await createFolder(accessToken, activityTitle, root);
  const { error: insertError } = await supabase
    .from('activity_drive_folders')
    .upsert(
      { activity_id: activityId, drive_folder_id: folderId },
      { onConflict: 'activity_id' },
    );
  if (insertError) {
    // Not fatal — the file still uploaded. Next upload will re-create or
    // find the folder.
    console.error('[drive] ensureActivityFolder cache insert failed', insertError);
  }
  return folderId;
}

export async function uploadFile(args: {
  activityId: string;
  activityTitle: string;
  fileName: string;
  mimeType: string;
  data: Uint8Array;
}): Promise<{ driveFileId: string; webViewLink: string }> {
  const connection = await getActiveDriveConnection();
  if (!connection) {
    throw new Error(
      'No Google Drive connection — ask an admin to connect Drive on /admin/drive.',
    );
  }
  const accessToken = await refreshAccessToken(
    decryptRefreshToken(connection.encryptedRefreshToken),
  );
  const folderId = await ensureActivityFolder(
    accessToken,
    args.activityId,
    args.activityTitle,
  );

  // Multipart related upload — one request, metadata + body.
  const boundary = `boundary_${randomBytes(16).toString('hex')}`;
  const metadata = {
    name: args.fileName,
    parents: [folderId],
  };
  const preamble =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${args.mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(preamble, 'utf8'),
    Buffer.from(args.data),
    Buffer.from(closing, 'utf8'),
  ]);

  const res = await driveFetch(
    accessToken,
    '/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        'content-type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string; webViewLink: string };
  return { driveFileId: data.id, webViewLink: data.webViewLink };
}
