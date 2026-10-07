/**
 * Combined class and stream queries to reduce N+1 problems.
 * Classes and streams are almost always queried together and rarely change.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { stableDataQueryOptions } from "@/lib/query-cache-config";

export type ClassRow = {
  id: string;
  name: string;
  class_teacher_id: string | null;
};

export type StreamRow = {
  id: string;
  name: string;
  class_id: string;
  stream_teacher_id: string | null;
};

export type ClassesAndStreams = {
  classes: ClassRow[];
  streams: StreamRow[];
};

/**
 * Fetch classes and streams in a single Supabase call to avoid N+1 queries.
 * Results are cached for 30 minutes (Tier 1 - stable data).
 */
async function fetchClassesAndStreams(): Promise<ClassesAndStreams> {
  const [classesResult, streamsResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, class_teacher_id")
      .order("name"),
    supabase
      .from("streams")
      .select("id, name, class_id, stream_teacher_id")
      .order("class_id"),
  ]);

  if (classesResult.error) {
    throw new Error(`Unable to load classes: ${classesResult.error.message}`);
  }
  if (streamsResult.error) {
    throw new Error(`Unable to load streams: ${streamsResult.error.message}`);
  }

  return {
    classes: classesResult.data ?? [],
    streams: streamsResult.data ?? [],
  };
}

/**
 * Hook to fetch both classes and streams with unified caching.
 * Reduces two separate Supabase queries to one batch request.
 */
export function useClassesAndStreams(): UseQueryResult<ClassesAndStreams> {
  return useQuery({
    ...stableDataQueryOptions(["classes-and-streams"]),
    queryFn: fetchClassesAndStreams,
  });
}

/**
 * Query options factory for use in prefetch or route loaders.
 */
export function classesAndStreamsQueryOptions() {
  return {
    ...stableDataQueryOptions(["classes-and-streams"]),
    queryFn: fetchClassesAndStreams,
  };
}
