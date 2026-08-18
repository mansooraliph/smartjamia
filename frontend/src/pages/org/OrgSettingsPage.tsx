import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OrgPortalApi } from '@/services/org.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Field, Select } from '@/components/ui/Input';
import { RolesTab } from './RolesTab';

export function OrgSettingsPage() {
  const { data: schools = [] } = useQuery({
    queryKey: ['org-schools'],
    queryFn: OrgPortalApi.listSchools,
  });
  const [schoolId, setSchoolId] = useState('');
  const activeSchoolId = schoolId || schools[0]?.id || '';

  return (
    <>
      <PageHeader
        title="Settings"
        description="Create and manage each school's custom roles & permissions."
      />

      <Field label="School" className="mb-5 max-w-xs">
        <Select value={activeSchoolId} onChange={(e) => setSchoolId(e.target.value)}>
          {schools.length === 0 && <option value="">No schools yet</option>}
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </Field>

      {activeSchoolId ? (
        <RolesTab schoolId={activeSchoolId} />
      ) : (
        <div className="card p-8 text-center text-slate-400">
          Add a school first (Schools tab) to manage its roles.
        </div>
      )}
    </>
  );
}
