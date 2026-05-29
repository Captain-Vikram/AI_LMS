# Browser Caching & State Optimization Strategy

This document outlines the strategy for implementing browser-side caching (LocalStorage/SessionStorage) in the Quasar EduSaarthi frontend to complement the existing backend Redis cache.

## 1. Current Caching Architecture (Redis)

The backend currently uses a Redis-based caching layer (`Backend/functions/cache_utils.py`):
- **Mechanism:** Decorator-based (`@cache_response`) on FastAPI routes.
- **Scope:** Server-side response caching based on path, query params, and `user_id`.
- **TTL:** Default 300 seconds (5 minutes).
- **Targets:** Classroom lists, module details, and other heavy GET requests.

## 2. Browser-Side Caching Opportunities

Implementing browser caching will reduce redundant API calls, improve "perceived" speed, and provide a smoother experience during navigation.

### A. Persistent State (LocalStorage)
*Duration: Long-term (survives browser restart)*

| Feature | Data to Cache | Benefit |
|---------|---------------|---------|
| **User Profile** | Name, role, institution, avatar | Instant UI personalization on load without waiting for `get_me`. |
| **Onboarding State** | `onboardingComplete`, `assessmentComplete` flags | Prevents flickering of onboarding prompts during slow network. |
| **UI Preferences** | Theme (light/dark), Sidebar collapsed state | Seamless UI consistency. |
| **Classroom List** | Brief metadata of all classrooms | Quick access to classroom selector. |

### B. Session State (SessionStorage)
*Duration: Short-term (cleared when tab closes)*

| Feature | Data to Cache | Benefit |
|---------|---------------|---------|
| **Classroom Metadata** | Active classroom details, subject, grade | Quick navigation between classroom tabs. |
| **Form Drafts** | Classroom creation form, Module assessment inputs | Prevents data loss if user accidentally refreshes or navigates away. |
| **Recently Viewed** | Last 5-10 visited modules or resources | Smooth "back" navigation experience. |

## 3. Synergy: Redis + Browser Cache

The combination creates a multi-tier caching strategy:

1.  **Tier 1 (Browser):** Instant lookup (0ms). Best for UI state and user-specific static data.
2.  **Tier 2 (Redis):** Fast lookup (<10ms). Best for data that changes occasionally across users or requires heavy DB joins.
3.  **Tier 3 (Database):** Source of truth.

### Example: Classroom Dashboard Load
1.  **Frontend** checks LocalStorage for `cached_dashboard_data`.
2.  **Frontend** renders UI with cached data (Immediate).
3.  **Frontend** triggers background fetch (using `stale-while-revalidate` pattern).
4.  **Backend** checks Redis. If HIT, returns in <10ms.
5.  **Frontend** updates UI if new data differs (Smooth transition).

## 4. Implementation Plan

### Step 1: Utility Class
Create `frontend/src/utils/storage.js` to handle serialized storage with expiry.

### Step 2: Hook Integration
Modify `useClassroom.js` to support local caching:
```javascript
// Example modification for useClassroomDashboard
const fetchDashboard = useCallback(async (useCache = true) => {
  const cacheKey = `dashboard_${classroomId}`;
  if (useCache) {
    const cached = storage.get(cacheKey);
    if (cached) setDashboard(cached);
  }
  
  const response = await apiClient.get(`/api/classroom/${classroomId}/dashboard`);
  if (response.status === 'success') {
    setDashboard(response.data);
    storage.set(cacheKey, response.data, 300); // 5 min
  }
}, [classroomId]);
```

### Step 3: Global State Hydration
In `App.jsx`, hydrate the `ClassroomContext` from LocalStorage on mount to eliminate initial loading spinners.

## 5. Cache Invalidation Strategy

To ensure users don't see stale data permanently:
- **Write Actions:** Any POST/PATCH/DELETE action to a classroom must clear the associated browser cache keys.
- **Versioning:** Append a `cache_version` to keys. Incrementing this in a global config will force-clear all user caches during deployments.
- **Timed Expiry:** Use a wrapper around `localStorage.setItem` that includes a timestamp.

## 6. Load Impact
- **Database:** Expected 30-40% reduction in read queries for active sessions.
- **Redis:** Lower load on Redis for high-frequency "re-reads" within the same session.
- **UX:** Eliminates 90% of layout shifting and loading spinners on sub-page navigation.
