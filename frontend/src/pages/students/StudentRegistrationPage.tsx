import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, UserPlus } from 'lucide-react';
import {
  AcademicYearsApi,
  ClassesApi,
  classLabel,
  ParentsApi,
  SectionsApi,
  StudentsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select, Textarea, Checkbox } from '@/components/ui/Input';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '@/lib/phone';
import { useTerminology } from '@/hooks/useTerminology';
import { usePermissions } from '@/hooks/usePermissions';

const GENDERS = ['male', 'female', 'other'] as const;
const STUDENT_STATUSES = [
  'active',
  'inactive',
  'transferred',
  'alumni',
] as const;
const RELATIONS = ['father', 'mother', 'guardian'] as const;

const parentSchema = z
  .object({
    id: z.string().optional(),
    relation: z.enum(RELATIONS),
    name: z.string().optional().or(z.literal('')),
    phoneCountryCode: z.string(),
    phone: z.string().optional().or(z.literal('')),
    whatsappSameAsMobile: z.boolean(),
    whatsappCountryCode: z.string(),
    whatsapp: z.string().optional().or(z.literal('')),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    occupation: z.string().optional().or(z.literal('')),
    annualIncome: z.string().optional().or(z.literal('')),
    aadharNumber: z.string().optional().or(z.literal('')),
    isPrimary: z.boolean(),
  })
  .superRefine((v, ctx) => {
    // A parent row is either fully empty (ignored) or needs a name + phone.
    const touched = v.name || v.phone || v.email || v.occupation;
    if (!touched) return;
    if (!v.name)
      ctx.addIssue({
        path: ['name'],
        code: z.ZodIssueCode.custom,
        message: 'Required',
      });
    if (!v.phone)
      ctx.addIssue({
        path: ['phone'],
        code: z.ZodIssueCode.custom,
        message: 'Required',
      });
  });

const schema = z
  .object({
    admissionNumber: z.string().min(1, 'Required'),
    firstName: z.string().min(1, 'Required'),
    lastName: z.string().min(1, 'Required'),
    dateOfBirth: z.string().min(1, 'Required'),
    gender: z.enum(GENDERS),
    bloodGroup: z.string().optional().or(z.literal('')),
    religion: z.string().optional().or(z.literal('')),
    caste: z.string().optional().or(z.literal('')),
    aadharNumber: z.string().optional().or(z.literal('')),
    mobileCountryCode: z.string(),
    mobile: z.string().optional().or(z.literal('')),
    whatsappSameAsMobile: z.boolean(),
    whatsappCountryCode: z.string(),
    whatsapp: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    pincode: z.string().optional().or(z.literal('')),
    previousSchool: z.string().optional().or(z.literal('')),
    admissionDate: z.string().min(1, 'Required'),
    status: z.enum(STUDENT_STATUSES),
    academicYearId: z.string().optional().or(z.literal('')),
    classId: z.string().optional().or(z.literal('')),
    sectionId: z.string().optional().or(z.literal('')),
    rollNumber: z.string().optional().or(z.literal('')),
    parents: z.array(parentSchema),
  })
  .superRefine((v, ctx) => {
    const any = v.academicYearId || v.classId || v.sectionId;
    if (!any) return;
    if (!v.academicYearId)
      ctx.addIssue({
        path: ['academicYearId'],
        code: z.ZodIssueCode.custom,
        message: 'Required for enrollment',
      });
    if (!v.classId)
      ctx.addIssue({
        path: ['classId'],
        code: z.ZodIssueCode.custom,
        message: 'Required for enrollment',
      });
  });

type FormValues = z.infer<typeof schema>;

const emptyParent = (): FormValues['parents'][number] => ({
  relation: 'father',
  name: '',
  phoneCountryCode: DEFAULT_COUNTRY_CODE,
  phone: '',
  whatsappSameAsMobile: true,
  whatsappCountryCode: DEFAULT_COUNTRY_CODE,
  whatsapp: '',
  email: '',
  occupation: '',
  annualIncome: '',
  aadharNumber: '',
  isPrimary: false,
});

/** Was the saved WhatsApp number identical to the mobile? (drives the checkbox). */
function whatsappMirrors(
  mobile?: string | null,
  mobileCode?: string | null,
  whatsapp?: string | null,
  whatsappCode?: string | null,
): boolean {
  // No distinct WhatsApp on record → default the convenience checkbox on.
  if (!whatsapp) return true;
  return (
    whatsapp === (mobile ?? '') &&
    (whatsappCode ?? DEFAULT_COUNTRY_CODE) === (mobileCode ?? DEFAULT_COUNTRY_CODE)
  );
}

export function StudentRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const term = useTerminology();
  const { can } = usePermissions();
  const today = new Date().toISOString().slice(0, 10);

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });
  const { data: allSections = [] } = useQuery({
    queryKey: ['sections-all'],
    queryFn: () => SectionsApi.list(),
  });

  // Edit-mode sources
  const { data: student } = useQuery({
    queryKey: ['student', id],
    queryFn: () => StudentsApi.get(id!),
    enabled: isEdit,
  });
  const { data: parentsPage } = useQuery({
    queryKey: ['student-parents', id],
    queryFn: () => ParentsApi.list({ studentId: id!, limit: 100 }),
    enabled: isEdit,
  });

  // Create-mode: suggest next admission number
  const { data: nextAdm } = useQuery({
    queryKey: ['next-admission-number'],
    queryFn: StudentsApi.nextAdmissionNumber,
    enabled: !isEdit,
  });

  const defaultYearId = useMemo(
    () => years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? '',
    [years],
  );

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      admissionNumber: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'male',
      bloodGroup: '',
      religion: '',
      caste: '',
      aadharNumber: '',
      mobileCountryCode: DEFAULT_COUNTRY_CODE,
      mobile: '',
      whatsappSameAsMobile: true,
      whatsappCountryCode: DEFAULT_COUNTRY_CODE,
      whatsapp: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      previousSchool: '',
      admissionDate: today,
      status: 'active',
      academicYearId: '',
      classId: '',
      sectionId: '',
      rollNumber: '',
      parents: [emptyParent()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'parents' });

  // Prefill once the relevant data is loaded (guard against re-running on every
  // keystroke, which would wipe the user's edits).
  const seeded = useRef<string | null>(null);
  const originalParentIds = useRef<string[]>([]);
  useEffect(() => {
    if (isEdit) {
      if (!student || !parentsPage) return;
      if (seeded.current === id) return;
      const ps = parentsPage.items;
      originalParentIds.current = ps.map((p) => p.id);
      reset({
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth?.slice(0, 10) ?? '',
        gender: student.gender,
        bloodGroup: student.bloodGroup ?? '',
        religion: student.religion ?? '',
        caste: student.caste ?? '',
        aadharNumber: student.aadharNumber ?? '',
        mobileCountryCode: student.mobileCountryCode ?? DEFAULT_COUNTRY_CODE,
        mobile: student.mobile ?? '',
        whatsappSameAsMobile: whatsappMirrors(
          student.mobile,
          student.mobileCountryCode,
          student.whatsapp,
          student.whatsappCountryCode,
        ),
        whatsappCountryCode:
          student.whatsappCountryCode ?? DEFAULT_COUNTRY_CODE,
        whatsapp: student.whatsapp ?? '',
        address: student.address ?? '',
        city: student.city ?? '',
        state: student.state ?? '',
        pincode: student.pincode ?? '',
        previousSchool: student.previousSchool ?? '',
        admissionDate: student.admissionDate?.slice(0, 10) ?? today,
        status: student.status,
        academicYearId: student.enrollment?.academicYearId ?? '',
        classId: student.enrollment?.classId ?? '',
        sectionId: student.enrollment?.sectionId ?? '',
        rollNumber: student.enrollment?.rollNumber ?? '',
        parents: ps.length
          ? ps.map((p) => ({
              id: p.id,
              relation: p.relation,
              name: p.name,
              phoneCountryCode: p.phoneCountryCode ?? DEFAULT_COUNTRY_CODE,
              phone: p.phone,
              whatsappSameAsMobile: whatsappMirrors(
                p.phone,
                p.phoneCountryCode,
                p.whatsapp,
                p.whatsappCountryCode,
              ),
              whatsappCountryCode:
                p.whatsappCountryCode ?? DEFAULT_COUNTRY_CODE,
              whatsapp: p.whatsapp ?? '',
              email: p.email ?? '',
              occupation: p.occupation ?? '',
              annualIncome:
                p.annualIncome != null ? String(p.annualIncome) : '',
              aadharNumber: p.aadharNumber ?? '',
              isPrimary: p.isPrimary,
            }))
          : [emptyParent()],
      });
      seeded.current = id!;
    } else {
      if (seeded.current === 'new') return;
      if (!nextAdm && !defaultYearId) return;
      reset((prev) => ({
        ...prev,
        admissionNumber: nextAdm?.admissionNumber ?? '',
        academicYearId: defaultYearId,
      }));
      seeded.current = 'new';
    }
  }, [isEdit, id, student, parentsPage, nextAdm, defaultYearId, reset, today]);

  const watchedYear = watch('academicYearId');
  const watchedClass = watch('classId');
  const { data: yearClasses = [] } = useQuery({
    queryKey: ['classes', watchedYear],
    queryFn: () => ClassesApi.list(watchedYear || undefined),
    enabled: !!watchedYear,
  });
  const filteredSections = useMemo(
    () => allSections.filter((s) => s.classId === watchedClass),
    [allSections, watchedClass],
  );

  const toParentPayload = (p: FormValues['parents'][number]) => {
    const wa = p.whatsappSameAsMobile ? p.phone : p.whatsapp;
    const waCode = p.whatsappSameAsMobile
      ? p.phoneCountryCode
      : p.whatsappCountryCode;
    return {
      relation: p.relation,
      name: p.name,
      phoneCountryCode: p.phoneCountryCode || undefined,
      phone: p.phone,
      whatsappCountryCode: wa ? waCode : undefined,
      whatsapp: wa || undefined,
      email: p.email || undefined,
      occupation: p.occupation || undefined,
      annualIncome: p.annualIncome ? Number(p.annualIncome) : undefined,
      aadharNumber: p.aadharNumber || undefined,
      isPrimary: p.isPrimary,
    };
  };

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const studentPayload: Record<string, unknown> = {
        admissionNumber: v.admissionNumber,
        firstName: v.firstName,
        lastName: v.lastName,
        dateOfBirth: v.dateOfBirth,
        gender: v.gender,
        bloodGroup: v.bloodGroup || undefined,
        religion: v.religion || undefined,
        caste: v.caste || undefined,
        aadharNumber: v.aadharNumber || undefined,
        mobileCountryCode: v.mobile ? v.mobileCountryCode : undefined,
        mobile: v.mobile || undefined,
        ...(() => {
          const wa = v.whatsappSameAsMobile ? v.mobile : v.whatsapp;
          const waCode = v.whatsappSameAsMobile
            ? v.mobileCountryCode
            : v.whatsappCountryCode;
          return {
            whatsappCountryCode: wa ? waCode : undefined,
            whatsapp: wa || undefined,
          };
        })(),
        address: v.address || undefined,
        city: v.city || undefined,
        state: v.state || undefined,
        pincode: v.pincode || undefined,
        previousSchool: v.previousSchool || undefined,
        admissionDate: v.admissionDate,
        status: v.status,
      };
      if (v.academicYearId && v.classId) {
        studentPayload.academicYearId = v.academicYearId;
        studentPayload.classId = v.classId;
        studentPayload.sectionId = v.sectionId || undefined;
        studentPayload.rollNumber = v.rollNumber || undefined;
      }

      // Only rows with a name + phone count as real parents.
      const validParents = v.parents.filter((p) => p.name && p.phone);

      if (!isEdit) {
        studentPayload.parents = validParents.map(toParentPayload);
        return StudentsApi.create(studentPayload);
      }

      // Edit: update the student, then reconcile parents (create/update/delete).
      await StudentsApi.update(id!, studentPayload);
      const keptIds = new Set(
        validParents.map((p) => p.id).filter(Boolean) as string[],
      );
      const ops: Promise<unknown>[] = [];
      for (const p of validParents) {
        if (p.id) {
          ops.push(ParentsApi.update(p.id, toParentPayload(p)));
        } else {
          ops.push(
            ParentsApi.create({ studentId: id, ...toParentPayload(p) }),
          );
        }
      }
      for (const oldId of originalParentIds.current) {
        if (!keptIds.has(oldId)) ops.push(ParentsApi.remove(oldId));
      }
      await Promise.all(ops);
      return { id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['parents'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      navigate('/students');
    },
  });

  const canSave = isEdit ? can('/students', 'create') : can('/students', 'create');

  return (
    <>
      <button
        onClick={() => navigate('/students')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to students
      </button>

      <PageHeader
        title={isEdit ? 'Edit student' : 'New student admission'}
        description={
          isEdit
            ? 'Update the student profile, enrollment and guardians.'
            : `Capture the student's details, enrollment and parent/guardian information in one place.`
        }
      />

      <form
        onSubmit={handleSubmit((v) => save.mutate(v))}
        className="space-y-6 pb-24"
      >
        {/* ── Student profile ─────────────────────────────────────────── */}
        <section className="card p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Student details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="Admission #"
              required
              error={errors.admissionNumber?.message}
            >
              <Input {...register('admissionNumber')} placeholder="ADM2026001" />
            </Field>
            <Field label="First name" required error={errors.firstName?.message}>
              <Input {...register('firstName')} />
            </Field>
            <Field label="Last name" required error={errors.lastName?.message}>
              <Input {...register('lastName')} />
            </Field>

            <Field
              label="Date of birth"
              required
              error={errors.dateOfBirth?.message}
            >
              <Input type="date" {...register('dateOfBirth')} />
            </Field>
            <Field label="Gender" required error={errors.gender?.message}>
              <Select {...register('gender')}>
                {GENDERS.map((g) => (
                  <option key={g} value={g} className="capitalize">
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Blood group">
              <Input {...register('bloodGroup')} placeholder="O+" />
            </Field>

            <Field label="Religion">
              <Input {...register('religion')} />
            </Field>
            <Field label="Caste">
              <Input {...register('caste')} />
            </Field>
            <Field label="Aadhaar #">
              <Input {...register('aadharNumber')} placeholder="12 digits" />
            </Field>

            <Field label="Mobile">
              <PhoneInputs
                codeReg={register('mobileCountryCode')}
                numReg={register('mobile')}
                placeholder="9876543210"
              />
            </Field>
            <Field label="WhatsApp">
              <label className="mb-1.5 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  {...register('whatsappSameAsMobile')}
                />
                Same as mobile
              </label>
              {!watch('whatsappSameAsMobile') && (
                <PhoneInputs
                  codeReg={register('whatsappCountryCode')}
                  numReg={register('whatsapp')}
                  placeholder="WhatsApp number"
                />
              )}
            </Field>

            <Field
              label="Admission date"
              required
              error={errors.admissionDate?.message}
            >
              <Input type="date" {...register('admissionDate')} />
            </Field>
            <Field label="Status">
              <Select {...register('status')}>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Previous school">
              <Input {...register('previousSchool')} />
            </Field>

            <Field label="Address" className="sm:col-span-3">
              <Textarea rows={2} {...register('address')} />
            </Field>
            <Field label="City">
              <Input {...register('city')} />
            </Field>
            <Field label="State">
              <Input {...register('state')} />
            </Field>
            <Field label="Pincode">
              <Input {...register('pincode')} />
            </Field>
          </div>
        </section>

        {/* ── Enrollment ──────────────────────────────────────────────── */}
        <section className="card p-5">
          <h3 className="font-semibold text-slate-900">Enrollment</h3>
          <p className="mb-4 text-xs text-slate-500">
            Optional — pick a {term.level.toLowerCase()} to enroll now. {term.group} is
            optional.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Academic year" error={errors.academicYearId?.message}>
              <Select {...register('academicYearId')}>
                <option value="">— None —</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={term.level} error={errors.classId?.message}>
              <Select {...register('classId')} disabled={!watchedYear}>
                <option value="">— None —</option>
                {yearClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={term.group} hint="Optional">
              <Select {...register('sectionId')} disabled={!watchedClass}>
                <option value="">— None —</option>
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Roll number">
              <Input {...register('rollNumber')} placeholder="15" />
            </Field>
          </div>
        </section>

        {/* ── Parents / guardians ─────────────────────────────────────── */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">
                Parents / guardians
              </h3>
              <p className="text-xs text-slate-500">
                Add the father, mother and/or guardian. Leave a row blank to skip
                it.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => append(emptyParent())}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add guardian
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((f, i) => (
              <div
                key={f.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Guardian {i + 1}
                  </span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove guardian"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Relation" required>
                    <Select {...register(`parents.${i}.relation`)}>
                      {RELATIONS.map((r) => (
                        <option key={r} value={r} className="capitalize">
                          {r}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Name"
                    error={errors.parents?.[i]?.name?.message}
                  >
                    <Input {...register(`parents.${i}.name`)} />
                  </Field>
                  <Field
                    label="Mobile"
                    error={errors.parents?.[i]?.phone?.message}
                  >
                    <PhoneInputs
                      codeReg={register(`parents.${i}.phoneCountryCode`)}
                      numReg={register(`parents.${i}.phone`)}
                      placeholder="Mobile"
                    />
                  </Field>
                  <Field label="WhatsApp">
                    <label className="mb-1.5 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                        {...register(`parents.${i}.whatsappSameAsMobile`)}
                      />
                      Same as mobile
                    </label>
                    {!watch(`parents.${i}.whatsappSameAsMobile`) && (
                      <PhoneInputs
                        codeReg={register(`parents.${i}.whatsappCountryCode`)}
                        numReg={register(`parents.${i}.whatsapp`)}
                        placeholder="WhatsApp"
                      />
                    )}
                  </Field>
                  <Field
                    label="Email"
                    error={errors.parents?.[i]?.email?.message}
                  >
                    <Input {...register(`parents.${i}.email`)} />
                  </Field>
                  <Field label="Occupation">
                    <Input {...register(`parents.${i}.occupation`)} />
                  </Field>
                  <Field label="Annual income (₹)">
                    <Input
                      type="number"
                      {...register(`parents.${i}.annualIncome`)}
                    />
                  </Field>
                  <Field label="Aadhaar #">
                    <Input {...register(`parents.${i}.aadharNumber`)} />
                  </Field>
                  <div className="flex items-end pb-2 sm:col-span-2">
                    <Checkbox
                      label="Primary contact"
                      {...register(`parents.${i}.isPrimary`)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {save.error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errMsg(save.error)}
          </div>
        )}

        {/* ── Sticky action bar ───────────────────────────────────────── */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur sm:left-64">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/students')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={save.isPending || !canSave}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              {save.isPending
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : 'Admit student'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function PhoneInputs({
  codeReg,
  numReg,
  placeholder,
}: {
  codeReg: ReturnType<ReturnType<typeof useForm>['register']>;
  numReg: ReturnType<ReturnType<typeof useForm>['register']>;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <Select {...codeReg} className="!w-24 shrink-0">
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </Select>
      <Input {...numReg} placeholder={placeholder} className="flex-1" />
    </div>
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
