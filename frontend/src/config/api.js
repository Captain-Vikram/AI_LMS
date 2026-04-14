const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export const apiUrl = (path = "") => {
  if (!path) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

export const API_ENDPOINTS = {
  SYSTEM_HEALTH_DEPENDENCIES: "/health/dependencies",

  AUTH_LOGIN: "/api/auth/login",
  AUTH_REGISTER: "/api/auth/register",
  AUTH_USER_PROFILE: "/api/auth/user-profile",
  AUTH_USER_STATUS: "/api/auth/user-status",
  AUTH_LOGIN_ACTIVITY: "/api/auth/login-activity",
  AUTH_UPDATE_ONBOARDING_STATUS: "/api/auth/update-onboarding-status",
  AUTH_UPDATE_ASSESSMENT_STATUS: "/api/auth/update-assessment-status",

  ONBOARDING_SAVE: "/api/onboarding/save",
  ONBOARDING_USER_SKILLS: "/api/onboarding/user-skills",

  QUIZ_GENERATE: "/api/quiz/generate",
  QUIZ_SUBMIT: "/api/quiz/submit",
  QUIZ_ASSESSMENT_HISTORY: "/api/quiz/assessment-history",
  QUIZ_STATISTICS: "/api/quiz/statistics",

  GAMIFICATION_XP: "/api/gamification/xp",
  GAMIFICATION_BADGES: "/api/gamification/badges",
  GAMIFICATION_ACHIEVEMENTS_RECENT: "/api/gamification/achievements/recent",

  ANALYTICS_DASHBOARD: "/api/analytics/dashboard",
  USER_MILESTONES: "/api/user/milestones",

  DEEPSEARCH_RECOMMENDATIONS: "/api/deepresearch/recommendations",

  YOUTUBE_RECOMMENDATIONS: "/api/youtube/recommendations",
  YOUTUBE_QA_PROCESS: "/api/youtube-qa/process",
  YOUTUBE_QA_ASK: "/api/youtube-qa/ask",
  YOUTUBE_QUIZ_COMPREHENSIVE: "/api/youtube-quiz/comprehensive",
  YOUTUBE_QUIZ_GENERATE: "/api/youtube-quiz/generate",
  YOUTUBE_QUIZ_SUBMIT: "/api/youtube-quiz/submit",
};
