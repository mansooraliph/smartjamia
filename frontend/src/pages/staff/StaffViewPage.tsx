import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Upload,
  Trash2,
  FileText,
  ExternalLink,
  Camera,
  Loader2,
} from 'lucide-react';
import {
  StaffApi,
  StaffDocument,
  StaffDocumentsApi,
  StaffDocumentType,
  UploadApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { formatDate, formatMoney } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { usePermissions } from '@/hooks/usePermissions';

type Tab = 'overview' | 'employment' | 'documents';

const DOC_TYPES: { value: StaffDocumentType; label: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN' },
  { value: 'id_proof', label: 'ID proof' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'resume', label: 'Resume / CV' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'experience', label: 'Experience letter' },
  { value: 'contract', label: 'Contract / appointment' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Other' },
];
const docLabel = (t: StaffDocumentType) =>
  DOC_TYPES.find((d) => d.value === t)?.label ?? t;

export function StaffViewPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canWrite = can('/staff', 'create');
  const canDelete = can('/staff', 'delete');
  const [tab, setTab] = useState<Tab>('overview');

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => StaffApi.get(id),
    enabled: !!id,
  });

  if (isLoading || !staff) {
    return <div className="card p-10 text-center text-slate-400">Loading…</div>;
  }

  const roleLabel = staff.user?.roleKey || staff.user?.role || '—';
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'employment', label: 'Employment & Bank' },
    { key: 'documents', label: 'Documents' },
  ];

  return (
    <>
      <button
        onClick={() => navigate('/staff')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to staff
      </button>

      <div className="card mb-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <StaffAvatar staff={staff} canEdit={canWrite} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">
              {staff.user?.name ?? '—'}
            </h1>
            <Badge tone={staff.status === 'active' ? 'green' : 'slate'}>
              {staff.status}
            </Badge>
            <Badge tone="blue">{roleLabel}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>
              Emp # <code className="text-slate-700">{staff.employeeId}</code>
            </span>
            <span>{staff.designation}</span>
            {staff.department && <span>{staff.department}</span>}
          </div>
        </div>
        {canWrite && (
          <button
            className="btn-secondary self-start"
            onClick={() => navigate('/staff', { state: { editId: id } })}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab staff={staff} roleLabel={roleLabel} />}
      {tab === 'employment' && <EmploymentTab staff={staff} />}
      {tab === 'documents' && (
        <DocumentsTab staffId={id} canWrite={canWrite} canDelete={canDelete} />
      )}
    </>
  );
}

function StaffAvatar({
  staff,
  canEdit,
}: {
  staff: { id: string; photoUrl: string | null; user?: { name: string } | null };
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { url } = await UploadApi.upload(file);
      return StaffApi.update(staff.id, { photoUrl: url });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', staff.id] }),
  });

  return (
    <div className="relative h-20 w-20 shrink-0">
      {staff.photoUrl ? (
        <img
          src={staff.photoUrl}
          alt=""
          className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-200"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-600">
          {staff.user?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 rounded-full bg-white p-1.5 text-slate-600 shadow ring-1 ring-slate-200 hover:text-brand-600"
            title="Change photo"
          >
            {upload.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}

function OverviewTab({ staff, roleLabel }: { staff: any; roleLabel: string }) {
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Profile</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Row label="Name" value={staff.user?.name} />
          <Row label="Email" value={staff.user?.email} />
          <Row label="Role" value={roleLabel} />
          <Row label="Employee ID" value={staff.employeeId} />
          <Row label="Designation" value={staff.designation} />
          <Row label="Department" value={staff.department} />
          <Row label="Joining date" value={formatDate(staff.joiningDate)} />
          <Row label="Status" value={staff.status} />
        </dl>
      </section>

      <section className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Contact</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Row
            label="Mobile"
            value={formatPhone(staff.mobileCountryCode, staff.mobile)}
          />
          <Row
            label="WhatsApp"
            value={formatPhone(staff.whatsappCountryCode, staff.whatsapp)}
          />
          <Row label="Address" value={staff.address} />
        </dl>
      </section>

      <section className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Qualification</h3>
        <p className="whitespace-pre-line text-sm text-slate-700">
          {staff.qualification || '—'}
        </p>
      </section>
    </div>
  );
}

function EmploymentTab({ staff }: { staff: any }) {
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Compensation</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Row
            label="Monthly salary"
            value={staff.salary ? formatMoney(staff.salary) : '—'}
          />
          <Row label="Bank account" value={staff.bankAccount} />
          <Row label="Bank IFSC" value={staff.bankIfsc} />
        </dl>
      </section>
      <section className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">KYC</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Row label="PAN" value={staff.pan} />
          <Row label="Aadhaar" value={staff.aadhar} />
        </dl>
      </section>
    </div>
  );
}

/* ── Documents ─────────────────────────────────────────────────────────────── */
function DocumentsTab({
  staffId,
  canWrite,
  canDelete,
}: {
  staffId: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ['staff-documents', staffId],
    queryFn: () => StaffDocumentsApi.list(staffId),
  });
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState<{ open: boolean; d?: StaffDocument }>({
    open: false,
  });

  const remove = useMutation({
    mutationFn: (did: string) => StaffDocumentsApi.remove(did),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-documents', staffId] });
      setConfirm({ open: false });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canWrite && (
          <button className="btn-primary text-sm" onClick={() => setModal(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Upload document
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          No documents uploaded (ID proofs, certificates, contract…).
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Badge tone="slate">{docLabel(d.type)}</Badge>
                  <div className="mt-1.5 truncate font-medium text-slate-900">
                    {d.title}
                  </div>
                  {d.fileName && (
                    <div className="truncate text-xs text-slate-400">
                      {d.fileName}
                    </div>
                  )}
                </div>
                {canDelete && (
                  <button
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setConfirm({ open: true, d })}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {d.note && <p className="mt-2 text-xs text-slate-500">{d.note}</p>}
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DocumentModal
          staffId={staffId}
          onClose={() => setModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['staff-documents', staffId] });
            setModal(false);
          }}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.d && remove.mutate(confirm.d.id)}
        loading={remove.isPending}
        title="Delete document?"
        message={`Permanently remove "${confirm.d?.title}" and its file.`}
        confirmText="Delete"
      />
    </div>
  );
}

function DocumentModal({
  staffId,
  onClose,
  onSaved,
}: {
  staffId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<StaffDocumentType>('id_proof');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useMutation({
    mutationFn: (f: File) => UploadApi.upload(f),
    onSuccess: (r) => {
      setFile({ url: r.url, name: r.name });
      if (!title) setTitle(r.name);
    },
  });
  const save = useMutation({
    mutationFn: () =>
      StaffDocumentsApi.create({
        staffId,
        type,
        title: title || docLabel(type),
        fileUrl: file!.url,
        fileName: file!.name,
        note: note || undefined,
      }),
    onSuccess: onSaved,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Upload document"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={!file || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type" required>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as StaffDocumentType)}
          >
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Appointment letter"
          />
        </Field>
        <Field label="File" required>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploadFile.isPending}
            >
              {uploadFile.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Choose file
            </button>
            {file && (
              <span className="truncate text-sm text-slate-600">
                {file.name}
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile.mutate(f);
                e.target.value = '';
              }}
            />
          </div>
        </Field>
        <Field label="Note (optional)">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {(save.error || uploadFile.error) && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errMsg(save.error || uploadFile.error)}
          </div>
        )}
      </div>
    </Modal>
  );
}

function errMsg(e: unknown): string | undefined {
  if (!e) return undefined;
  const anyE = e as any;
  return (
    anyE?.response?.data?.error?.message ??
    anyE?.message ??
    'Something went wrong'
  );
}
