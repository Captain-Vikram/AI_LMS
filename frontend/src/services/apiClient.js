import { apiUrl } from "../config/api";

const clearClientAuthState = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("onboardingComplete");
  localStorage.removeItem("skillAssessmentComplete");
};

const isTokenExpired = (token) => {
  try {
    const [, payloadBase64] = token.split(".");
    const normalizedBase64 = payloadBase64
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedBase64 = normalizedBase64.padEnd(
      Math.ceil(normalizedBase64.length / 4) * 4,
      "="
    );
    const payloadJson = atob(paddedBase64);
    const payload = JSON.parse(payloadJson);

    if (!payload.exp) {
      return false;
    }

    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

const parseResponseBody = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

const buildErrorMessage = (responseBody, status) => {
  if (responseBody && typeof responseBody === "object") {
    const detail = responseBody.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (detail && typeof detail === "object") {
      return (
        detail.user_message ||
        detail.message ||
        responseBody.message ||
        `Request failed with status ${status}`
      );
    }

    return responseBody.message || `Request failed with status ${status}`;
  }

  if (typeof responseBody === "string" && responseBody.trim()) {
    return responseBody;
  }

  return `Request failed with status ${status}`;
};

const request = async (path, options = {}) => {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;

  if (token && isTokenExpired(token)) {
    clearClientAuthState();
    throw new Error("Session expired. Please login again.");
  }

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(apiUrl(path), {
      ...options,
      headers,
    });
  } catch {
    const networkError = new Error(
      "Backend is unreachable. Ensure backend server, Docker services, and LM Studio are running."
    );
    networkError.status = 0;
    networkError.code = "BACKEND_UNREACHABLE";
    networkError.dependency = "backend";
    networkError.payload = {
      detail: {
        code: "BACKEND_UNREACHABLE",
        dependency: "backend",
        user_message: networkError.message,
      },
    };
    throw networkError;
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    const errorMessage = buildErrorMessage(responseBody, response.status);
    const detail =
      responseBody &&
      typeof responseBody === "object" &&
      responseBody.detail &&
      typeof responseBody.detail === "object"
        ? responseBody.detail
        : null;

    const error = new Error(errorMessage);
    error.status = response.status;
    error.payload = responseBody;
    error.code = detail?.code;
    error.dependency = detail?.dependency;

    if (response.status === 401) {
      clearClientAuthState();
    }

    throw error;
  }

  return responseBody;
};

const apiClient = {
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (path, options = {}) => request(path, { ...options, method: "DELETE" }),
};

export default apiClient;
export { clearClientAuthState };
