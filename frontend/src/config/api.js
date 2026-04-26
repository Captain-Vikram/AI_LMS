const rawBaseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

  ONBOARDING_TEACHER_SETUP: "/api/onboarding/teacher/setup",
  ONBOARDING_STUDENT_JOIN: "/api/onboarding/student/join",
  ONBOARDING_COMPLETE_PROFILE: "/api/onboarding/complete-profile",
  ONBOARDING_TEACHER_PATHWAY: "/api/onboarding/teacher/pathway/", // append classroom id

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
  YOUTUBE_QA_ASK: "/api/resource/qa/ask",
  YOUTUBE_QUIZ_COMPREHENSIVE: "/api/youtube-quiz/comprehensive",
  YOUTUBE_QUIZ_GENERATE: "/api/youtube-quiz/generate",
  YOUTUBE_QUIZ_SUBMIT: "/api/youtube-quiz/submit",

  RESOURCE_SUMMARY_GET_OR_CREATE: "/api/resource/summary/get-or-create",
  RESOURCE_CHAT_HISTORY_PREFIX: "/api/resource/chat-history/", // append resourceId/studentId

  // --- Skill Pathways ---
  PATHWAYS_AVAILABLE: "/api/pathways/available",
  PATHWAYS_MY_PROGRESS: "/api/pathways/progress/my-pathways",
  PATHWAY_GET_BLUEPRINT: (id) => `/api/pathways/${id}`,
  PATHWAY_GET_PROGRESS: (id) => `/api/pathways/progress/${id}`,
  PATHWAY_ENROLL: (id) => `/api/pathways/${id}/enroll`,
  PATHWAY_STAGE_DETAILS: (pathwayId, stageIdx) => `/api/pathways/${pathwayId}/stage/${stageIdx}`,
  PATHWAY_COMPLETE_STAGE: (pathwayId, stageIdx) => `/api/pathways/${pathwayId}/stage/${stageIdx}/complete`,
  PATHWAY_GENERATE_RESOURCES: (pathwayId, stageIdx) => `/api/pathways/${pathwayId}/stage/${stageIdx}/generate-resources`,
  PATHWAY_GENERATE_TESTS: (pathwayId, stageIdx, resourceId) => `/api/pathways/${pathwayId}/stage/${stageIdx}/resource/${resourceId}/tests`,
  PATHWAY_SUBMIT_TEST: (pathwayId, stageIdx) => `/api/pathways/${pathwayId}/stage/${stageIdx}/submit-test`,

  STUDIO_GENERATE: "/api/studio/generate",
  STUDIO_SUMMARY: "/api/studio/summary",
  STUDIO_QUIZ: "/api/studio/quiz",

  PORTABLE_RAG_PODCAST_GENERATE: "/api/portable-rag/podcasts/generate",
  PORTABLE_RAG_PODCAST_JOB_PREFIX: "/api/portable-rag/podcasts/jobs/", // append job id

  STUDENT_PROGRESS_MODULE_PREFIX: "/api/student/progress/", // append module id

  MODULE_ASSESSMENT_DRAFT_GENERATE: "/api/module-assessment/draft-generate",
  MODULE_ASSESSMENT_PREFIX: "/api/module-assessment/", // append assessment id
  MODULE_ASSESSMENT_SUBMISSION_START: "/api/module-assessment/submission/start",
  MODULE_ASSESSMENT_SUBMISSION_PREFIX: "/api/module-assessment/submission/", // append submission id
  MODULE_ASSESSMENT_PENDING_GRADES_PREFIX: "/api/module-assessment/pending-grades/", // append classroom id

  CLASSROOM_ACTIVITY_FEED_PREFIX: "/api/classroom/", // append classroom id + /activity-feed
  CLASSROOM_PENDING_GRADING_COUNT_PREFIX: "/api/classroom/", // append classroom id + /pending-grading-count
};

// Classroom endpoints (Phase 1)
API_ENDPOINTS.CLASSROOM_LIST = "/api/classroom";
API_ENDPOINTS.CLASSROOM_CREATE = "/api/classroom/create";
API_ENDPOINTS.CLASSROOM_GET = "/api/classroom/"; // append id
API_ENDPOINTS.CLASSROOM_JOIN = "/api/classroom/{id}/join";
API_ENDPOINTS.CLASSROOM_FIND_BY_CODE = "/api/classroom/find";
API_ENDPOINTS.CLASSROOM_MY_ENROLLMENTS = "/api/classroom/my/enrollments";
API_ENDPOINTS.CLASSROOM_BOOTSTRAP_DEMO = "/api/classroom/bootstrap/demo";
API_ENDPOINTS.CLASSROOM_RESOURCES = "/api/classroom/{id}/resources";
API_ENDPOINTS.CLASSROOM_RESOURCE_APPROVAL = "/api/classroom/{id}/resources/{resourceId}/approval";

API_ENDPOINTS.AUTH_SET_ACTIVE_CLASSROOM = "/api/auth/set-active-classroom/";
