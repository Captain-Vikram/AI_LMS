const CACHE_VERSION = "v1";
const PREFIX = "edusaarthi";

const buildKey = (key) => {
  return `${PREFIX}_${CACHE_VERSION}_${key}`;
};

export const storage = {
  /**
   * Sets serialized value with TTL in local or session storage.
   * @param {string} key 
   * @param {any} value 
   * @param {number|null} ttlSeconds Time-to-live in seconds
   * @param {boolean} useSession Use SessionStorage instead of LocalStorage
   */
  set: (key, value, ttlSeconds = null, useSession = false) => {
    const store = useSession ? window.sessionStorage : window.localStorage;
    const cacheKey = buildKey(key);
    const data = {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    };
    try {
      store.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
      console.warn("Storage write error:", e);
    }
  },

  /**
   * Retrieves serialized value, checking TTL and evicting expired entries.
   * @param {string} key 
   * @param {boolean} useSession Use SessionStorage instead of LocalStorage
   * @returns {any|null}
   */
  get: (key, useSession = false) => {
    const store = useSession ? window.sessionStorage : window.localStorage;
    const cacheKey = buildKey(key);
    try {
      const serialized = store.getItem(cacheKey);
      if (!serialized) return null;
      const data = JSON.parse(serialized);
      if (data.expiresAt && Date.now() > data.expiresAt) {
        store.removeItem(cacheKey);
        return null;
      }
      return data.value;
    } catch (e) {
      return null;
    }
  },

  /**
   * Removes item from storage.
   * @param {string} key 
   * @param {boolean} useSession Use SessionStorage instead of LocalStorage
   */
  remove: (key, useSession = false) => {
    const store = useSession ? window.sessionStorage : window.localStorage;
    const cacheKey = buildKey(key);
    store.removeItem(cacheKey);
  },

  /**
   * Clears all cache entries associated with a specific classroom.
   * @param {string} classroomId 
   */
  clearClassroomCache: (classroomId) => {
    if (!classroomId) return;
    const classroomPrefix = `classroom_${classroomId}`;
    const keysToEvict = [
      `dashboard_${classroomId}`,
      `overview_${classroomId}`,
      `announcements_${classroomId}`,
      `roster_${classroomId}`,
      `modules_${classroomId}`,
      `resources_${classroomId}`,
      `groups_${classroomId}`,
      `analytics_${classroomId}`,
      classroomPrefix
    ];

    keysToEvict.forEach((key) => {
      storage.remove(key, false);
      storage.remove(key, true);
    });
  },

  /**
   * Clears all expired entries for cleanup hygiene.
   */
  clearAllExpired: () => {
    const storages = [window.localStorage, window.sessionStorage];
    storages.forEach((store) => {
      try {
        const keysToRemove = [];
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key && key.startsWith(`${PREFIX}_`)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => {
          try {
            const data = JSON.parse(store.getItem(key));
            if (data && data.expiresAt && Date.now() > data.expiresAt) {
              store.removeItem(key);
            }
          } catch (e) {
            // Not JSON or corrupted, keep/ignore
          }
        });
      } catch (err) {
        console.warn("Error running expired cache cleanup:", err);
      }
    });
  },

  /**
   * Clears cache entries with mismatched CACHE_VERSION.
   */
  clearOldVersions: () => {
    const activePrefix = `${PREFIX}_${CACHE_VERSION}_`;
    const storages = [window.localStorage, window.sessionStorage];
    storages.forEach((store) => {
      try {
        const keysToRemove = [];
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key && key.startsWith(`${PREFIX}_`) && !key.startsWith(activePrefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => {
          store.removeItem(key);
        });
      } catch (err) {
        console.warn("Error clearing legacy cache versions:", err);
      }
    });
  }
};
