import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ACADEMIC_MANAGERS, hasAny, useCurrentUser } from "@/hooks/useCurrentUser";
import { stableDataQueryOptions } from "@/lib/query-cache-config";

// Shared data layer for the academic setup section.
// One cached query feeds every academics sub-page; React Query dedupes it per visit.
// Uses Tier 1 caching (stableDataQueryOptions) since academic metadata changes infrequently.

export type AcademicClass = {
    id: string;
    name: string;
    level: number | null;
    education_level: string | null;
    class_teacher_id: string | null;
  };
export type AcademicStream = {
    id: string;
    name: string;
    class_id: string;
    stream_teacher_id: string | null;
  };
export type AcademicSubject = {
    id: string;
    name: string;
    code: string | null;
    department_id: string;
    category: string | null;
    position: number | null;
    points: number | null;
    education_level: string | null;
    is_subsidiary: boolean;
  };

    type QueryResult<T> = {
    data: T | null;
    error: { message: string } | null;
  };

  // Explicit contract so every sub-page indexes a typed (not `never`) shape.
  // The underlying query uses loose supabase inference; we keep arrays as `any[]`
  // to match the existing permissive style of this codebase.
  export type AcademicsData = {
    classes: any[];
    streams: any[];
    subjects: any[];
    subjectPapers: any[];
    allocations: any[];
    teachers: any[];
    departments: any[];
    academicYears: any[];
    terms: any[];
    gradingScales: any[];
    identifierScales: any[];
    school: any;
  };


export function useAcademicsData(schoolId: string | null) {
  return useQuery({
    ...stableDataQueryOptions(["academics", schoolId]),
    enabled: !!schoolId,
    queryFn: async () => {
      const schoolQuery = <T extends { eq(column: string, value: string): T }>(query: T) =>
        schoolId ? query.eq("school_id", schoolId) : query;
      const safeLoad = async <T,>(promise: Promise<QueryResult<T>>, fallback: T) => {
        const result = await promise;
        if (result.error) return fallback;
        return (result.data ?? fallback) as T;
      };
      const loadIdentifierScales = async () => {
        const primary = await schoolQuery(
          supabase
            .from("grading_identifier_scales")
            .select("*")
            .order("identifier", { ascending: false }),
        );
        if (!primary.error) return primary.data ?? [];

        const fallback = await schoolQuery(
          supabase.from("identifier_scales").select("*").order("identifier", { ascending: false }),
        );
        return fallback.error ? [] : (fallback.data ?? []);
      };

      const [
        classes,
        streams,
        subjects,
        subjectPapers,
        allocations,
        teachers,
        departments,
        roles,
        academicYears,
        terms,
        scales,
        identifierScales,
        school,
      ] = await Promise.all([
        safeLoad(
          schoolQuery(
            supabase
              .from("classes")
              .select("*")
              .order("education_level", { ascending: false })
              .order("level", { ascending: true })
              .order("name"),
          ),
          [],
        ),
        safeLoad(schoolQuery(supabase.from("streams").select("*").order("name")), []),
        safeLoad(schoolQuery(supabase.from("subjects").select("*").order("position")), []),
        safeLoad(
          schoolQuery(
            (supabase as any)
              .from("subject_papers")
              .select("id, subject_id, name, position")
              .order("position"),
          ),
          [],
        ),
        safeLoad(schoolQuery(supabase.from("teacher_allocations").select("*")), []),
        safeLoad(
          schoolQuery(
            supabase
              .from("profiles")
              .select("id, full_name, initials, department_id")
              .order("full_name"),
          ),
          [],
        ),
        safeLoad(schoolQuery(supabase.from("departments").select("id, name").order("name")), []),
        safeLoad(schoolQuery(supabase.from("user_roles").select("user_id, role")), []),
        safeLoad(schoolQuery(supabase.from("academic_years").select("*").order("name")), []),
        safeLoad(
          schoolQuery(
            supabase
              .from("terms")
              .select("*")
              .order("start_date", { ascending: true })
              .order("name"),
          ),
          [],
        ),
        safeLoad(
          schoolQuery(
            supabase.from("grading_scales").select("*").order("min_score", { ascending: false }),
          ),
          [],
        ),
        loadIdentifierScales(),
        safeLoad(
          supabase
            .from("schools")
            .select("report_next_term_begins_on")
            .eq("id", schoolId!)
            .maybeSingle(),
          null,
        ),
      ]);
      const teachingRoles = new Set(
        roles
          .filter((r) =>
            [
              "class_teacher",
              "subject_teacher",
              "hod",
              "dos",
              "head_teacher",
              "deputy_head_teacher",
            ].includes(r.role),
          )
          .map((r) => r.user_id),
      );
      return {
        classes,
        streams,
        subjects,
        subjectPapers,
        allocations,
        teachers: teachers.filter((t) => teachingRoles.has(t.id)),
        departments,
        academicYears,
        terms,
        gradingScales: scales,
        identifierScales,
                school,
      } as AcademicsData;
    },
  });
}

export function useAcademicsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const allowed = hasAny(me?.roles, ACADEMIC_MANAGERS);
  const query = useAcademicsData(schoolId);
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["academics", schoolId] });
  }
  return { me, schoolId, allowed, data: query.data, refresh };
}
