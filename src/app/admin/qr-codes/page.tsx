import QRCode from 'qrcode';
import { Card } from '@/components/ui/Card';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteOrigin } from '@/lib/siteOrigin';
import CopyButton from './CopyButton';

type GroupQrRow = {
  id: string;
  name: string;
  joinUrl: string;
  qrSvg: string;
};

async function fetchGroupQrRows(): Promise<GroupQrRow[]> {
  const origin = await getSiteOrigin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, join_token')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/qr-codes] fetch failed', error);
    return [];
  }

  const rows = await Promise.all(
    (data ?? []).map(async (row) => {
      const joinUrl = `${origin}/join/${row.join_token as string}`;
      const qrSvg = await QRCode.toString(joinUrl, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      return {
        id: row.id as string,
        name: row.name as string,
        joinUrl,
        qrSvg,
      };
    }),
  );

  return rows;
}

export default async function AdminQrCodesPage() {
  const groups = await fetchGroupQrRows();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          QR Codes
        </h1>
        <p className="text-slate-400">
          Print or share a code. Trainees scan it, sign in with Google, and
          land in the group.
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <p className="text-slate-400">
            No groups yet. Create a group first, then come back here for its
            QR code.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Card className="flex flex-col gap-3">
                <div>
                  <p className="text-base font-medium text-white">
                    {group.name}
                  </p>
                </div>
                <div
                  className="mx-auto w-48 rounded-md bg-white p-2"
                  aria-label={`QR code for ${group.name}`}
                  dangerouslySetInnerHTML={{ __html: group.qrSvg }}
                />
                <div className="space-y-2">
                  <code className="block break-all rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300">
                    {group.joinUrl}
                  </code>
                  <CopyButton value={group.joinUrl} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
