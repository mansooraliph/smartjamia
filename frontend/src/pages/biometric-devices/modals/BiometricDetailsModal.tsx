import { useQuery } from '@tanstack/react-query';
import { Fingerprint } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { BiometricDevicesApi } from '@/services/biometric-devices.api';
import { EnrollUserType, FINGER_NAMES } from '@/constants/biometric';

const BIO_TYPE_LABEL: Record<string, string> = {
  FP: 'Fingerprint',
  FACE: 'Face',
  PALM: 'Palm',
  USERPIC: 'Photo',
  BIOPHOTO: 'Bio Photo',
};

function fmt(dt?: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function typeLabel(type: string, index: string): string {
  const base = BIO_TYPE_LABEL[type] ?? type;
  if (type !== 'FP') return base;
  const finger = FINGER_NAMES[Number(index)];
  return finger ? `${base} — ${finger}` : base;
}

interface Props {
  userId: string;
  userType: EnrollUserType;
  name: string;
  onClose: () => void;
  onEnrollMore: () => void;
}

/** Shows a person's captured/queued biometric templates, with a way to enroll
 *  another one — reused across the students & staff lists' fingerprint icon. */
export function BiometricDetailsModal({
  userId,
  userType,
  name,
  onClose,
  onEnrollMore,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['bio-enrollment-detail', userType, userId],
    queryFn: () =>
      BiometricDevicesApi.listEnrollments({
        studentId: userType === 'student' ? userId : undefined,
        staffId: userType === 'teacher' || userType === 'staff' ? userId : undefined,
        limit: 50,
      }),
    enabled: userType === 'student' || userType === 'teacher' || userType === 'staff',
  });
  const items = data?.items ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Biometric — ${name}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={onEnrollMore}>
            Enroll another
          </button>
        </>
      }
    >
      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Fingerprint className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No biometric data yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <div className="leading-tight">
                <div className="font-medium text-slate-900">
                  {typeLabel(e.type, e.index)}
                </div>
                <div className="text-xs text-slate-500">
                  {e.deviceAlias ?? '—'} · {fmt(e.createdAt)}
                </div>
              </div>
              <Badge tone={e.status === 'enrolled' ? 'green' : 'amber'}>
                {e.status === 'enrolled' ? 'Enrolled' : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
