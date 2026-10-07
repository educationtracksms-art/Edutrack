# EduTrack Caching Strategy

## Current State

The application uses TanStack Query (React Query) with the following defaults:
- **staleTime**: 5 minutes (data is considered "fresh" for 5 min)
- **gcTime**: 10-30 minutes (cached data persists for 10-30 min before garbage collection)
- **refetch behavior**: Disabled on window focus/mount/reconnect
- **retry**: Single retry on failure

## Issues Identified

1. **Inconsistent cache timings**: Different screens define their own staleTime/gcTime, leading to redundant queries
2. **N+1 query patterns**: Classes, streams, and students are fetched separately on each page load
3. **Frequent subscription checks**: Checked every 60s, but subscription changes are infrequent
4. **Missing request deduplication**: Parallel requests for the same data hit Supabase independently
5. **No browser storage for static data**: User preferences, module metadata, and schema info could persist locally
6. **Suboptimal preload strategy**: Intent preload (30s stale time) is good, but no aggressive prefetch for hot paths

## Improvements Implemented

### 1. QueryClient Configuration Enhancements
- **Increased default staleTime** from 5 min → 10 min for stable data
- **Extended gcTime** from 10 min → 15 min to reduce re-fetches during navigation
- **Added query deduplication** by default (prevents concurrent identical requests)
- **Conservative retry strategy** remains (single retry to avoid cascading failures)

### 2. Cache Tier Categorization
Created query option factories for different data lifetimes:
- **Tier 1 - Stable metadata** (staleTime: 30 min, gcTime: 60 min): Classes, streams, departments, years, terms
- **Tier 2 - User data** (staleTime: 10 min, gcTime: 30 min): Current user, profiles, subscriptions
- **Tier 3 - Volatile data** (staleTime: 1 min, gcTime: 5 min): Real-time metrics, current session data
- **Tier 4 - Subscriptions** (staleTime: 5 min, gcTime: 10 min): School subscription status (reduced from 60s check)

### 3. Batch Query Implementations
- **Classes + Streams**: Load together with single Supabase call
- **Module availability**: Cached for 15 minutes per school
- **Student roster**: Single paginated query instead of per-class fetches

### 4. Browser Storage Optimization
- **User preferences** stored in localStorage (only synced on explicit save)
- **Module metadata** cached locally with 30-minute TTL
- **School configuration** stored once and updated infrequently

### 5. Server-Side Query Consolidation
- Reduced Supabase RPC calls in server functions (batch operations)
- Atomic updates prevent redundant read-back queries
- Subscription status cached centrally (not re-fetched per component)

## Performance Targets

| Screen | Before | After | Improvement |
|--------|--------|-------|-------------|
| Dashboard | ~4 Supabase calls | ~2 calls | 50% fewer queries |
| Students | ~3 calls | ~1 call | 67% fewer queries |
| Finance | ~5 calls | ~2-3 calls | 40-60% fewer queries |
| Shell init | ~6 calls | ~3 calls | 50% fewer queries |

## Cache Invalidation Strategy

### Automatic invalidation (on mutations):
- User updates → invalidate `["current-user"]`
- Student create/update → invalidate `["students-*"]` wildcard + server-side revalidation
- Subscription change → invalidate `["shell-subscription-status"]` + `["active-subscription"]`
- Budget/fee updates → invalidate finance-related queries

### Manual prefetch (on navigation intent):
- Intent preload to classes/streams/students on route hover
- Dashboard widgets preload trending data
- Finance screens prefetch budget/fee data on tab switch

## Monitoring & Profiling

Use React Query DevTools to track:
- Query hit rates (% successful cache hits vs. server fetches)
- Cache retention (how long data stays warm)
- Stale refetch frequency (should be rare for stable data)

## Future Enhancements

1. **Infinite query pagination** for student/staff lists (instead of load-all)
2. **Optimistic updates** for creates/updates (UI responds instantly)
3. **Background sync** for offline-first capability
4. **CDN caching** for static assets and public data (if using serverless)
5. **GraphQL with batching** (if Supabase migration needed) to eliminate N+1

## Implementation Checklist

- [x] Update QueryClient defaults
- [x] Create shared query option factories
- [x] Consolidate classes + streams queries
- [x] Extend module cache timeout
- [x] Reduce subscription check frequency
- [x] Add localStorage for user preferences
- [x] Document invalidation strategy
- [x] Update routes with Tier 1/2/3 cache settings
- [ ] Implement infinite query pagination (future)
- [ ] Add optimistic UI updates (future)
- [ ] Profile real-world query patterns
