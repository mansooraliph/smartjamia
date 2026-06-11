import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_TERMINOLOGY,
  SettingsApi,
  Terminology,
} from '@/services/school.api';

/**
 * School-configurable academic labels (Class/Grade/Semester · Section/Batch).
 * Cached app-wide; falls back to defaults while loading or on error.
 */
export function useTerminology(): Terminology {
  const { data } = useQuery({
    queryKey: ['terminology'],
    queryFn: SettingsApi.getTerminology,
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_TERMINOLOGY,
  });
  return data ?? DEFAULT_TERMINOLOGY;
}
