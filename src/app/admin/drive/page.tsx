import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getActiveDriveConnection } from '@/lib/drive';
import DisconnectButton from './DisconnectButton';

type SearchParams = Promise<{ connected?: string; error?: string }>;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function AdminDrivePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [connection, params] = await Promise.all([
    getActiveDriveConnection(),
    searchParams,
  ]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Google Drive
        </h1>
        <p className="text-slate-400">
          Connect a Google account so trainee file uploads land in its Drive
          under a <span className="font-mono">Workshop Submissions</span>{' '}
          folder.
        </p>
      </div>

      {params.connected ? (
        <Card className="border-emerald-700 bg-emerald-950/40">
          <p className="text-sm text-emerald-200">Drive connected.</p>
        </Card>
      ) : null}
      {params.error ? (
        <Card className="border-red-800 bg-red-950/40">
          <p className="text-sm text-red-200">
            Could not connect Drive ({params.error}). Try again or double-check
            the OAuth client in Google Cloud Console.
          </p>
        </Card>
      ) : null}

      <Card className="space-y-3">
        {connection ? (
          <>
            <div>
              <p className="text-sm font-medium text-white">Connected</p>
              <p className="text-xs text-slate-500">
                {connection.googleAccountEmail ?? 'unknown account'} · connected{' '}
                {formatWhen(connection.connectedAt)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Scope: <span className="font-mono">{connection.scope}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/api/drive/oauth/start">
                <Button type="button" variant="secondary">
                  Reconnect
                </Button>
              </Link>
              <DisconnectButton />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              No Drive account connected. Trainees cannot submit file-upload
              activities until this is set up.
            </p>
            <Link href="/api/drive/oauth/start">
              <Button type="button">Connect Google Drive</Button>
            </Link>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-slate-200">What&apos;s shared</h2>
        <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-400">
          <li>
            Scope <span className="font-mono">drive.file</span> — only files
            created by this app are accessible to it.
          </li>
          <li>Each activity gets its own subfolder.</li>
          <li>Refresh token is AES-256-GCM encrypted at rest.</li>
          <li>
            File uploads are capped at 4 MB in Phase 7 (Vercel serverless body
            limit).
          </li>
        </ul>
      </Card>
    </section>
  );
}
