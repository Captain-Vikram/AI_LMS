import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  IoPersonAddOutline,
  IoSchoolOutline,
} from "react-icons/io5";

import apiClient from "../../services/apiClient";
import { API_ENDPOINTS } from "../../config/api";
import GlassDashboardShell from "../UI/GlassDashboardShell";

const normalizeRole = (rawRole) => {
  const role = (rawRole || "").trim().toLowerCase();
  if (["teacher", "student", "admin"].includes(role)) {
    return role;
  }
  if (["educator", "instructor", "faculty"].includes(role)) {
    return "teacher";
  }
  return "student";
};

const Onboarding = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [role, setRole] = useState("student");
  const [studentJoinCode, setStudentJoinCode] = useState("");

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const [status, profile] = await Promise.all([
          apiClient.get(API_ENDPOINTS.AUTH_USER_STATUS),
          apiClient.get(API_ENDPOINTS.AUTH_USER_PROFILE),
        ]);

        if (!mounted) {
          return;
        }

        const normalizedRole = normalizeRole(profile?.role || status?.role);
        setRole(normalizedRole);
        localStorage.setItem("userRole", normalizedRole);

        if (status.onboarding_complete) {
          localStorage.setItem("onboardingComplete", "true");
          localStorage.setItem("isLoggedIn", "true");
          navigate("/classrooms");
          return;
        }

        // Teachers and admins skip onboarding and go directly to classroom creation
        if (normalizedRole === "teacher" || normalizedRole === "admin") {
          localStorage.setItem("onboardingComplete", "true");
          localStorage.setItem("isLoggedIn", "true");
          navigate("/classroom/create");
          return;
        }
      } catch {
        if (!mounted) {
          return;
        }
        navigate("/login");
        return;
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleStudentJoin = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiClient.post(API_ENDPOINTS.ONBOARDING_STUDENT_JOIN, {
        enrollment_code: studentJoinCode.trim(),
      });

      localStorage.setItem("onboardingComplete", "true");
      localStorage.setItem("skillAssessmentComplete", "true");
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userRole", "student");

      try {
        const refreshed = await apiClient.post(
          `${API_ENDPOINTS.AUTH_SET_ACTIVE_CLASSROOM}${response.classroom_id}`
        );
        const token = refreshed.access_token || refreshed.token;
        if (token) {
          localStorage.setItem("token", token);
        }
      } catch {
        // non-blocking
      }

      navigate(`/classroom/${response.classroom_id}/dashboard`);
    } catch (requestError) {
      setError(requestError.message || "Failed to join classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <GlassDashboardShell contentClassName="max-w-3xl">
        <div className="py-6 text-center text-gray-300">Loading onboarding...</div>
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-5xl" withPanel={false}>
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 md:p-8 shadow-xl">
          {error && (
            <div className="mb-6 rounded-lg border border-red-700/50 bg-red-900/30 text-red-100 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <IoPersonAddOutline className="text-green-400" />
              Join Your Classroom
            </h1>
            <p className="text-gray-300 mt-2">
              Students only need a class enrollment code from their teacher.
            </p>
          </div>

          <form onSubmit={handleStudentJoin} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Enrollment Code</label>
              <input
                type="text"
                value={studentJoinCode}
                onChange={(event) => setStudentJoinCode(event.target.value)}
                placeholder="Enter classroom code"
                className="w-full px-3 py-2 rounded bg-gray-700/60 border border-gray-600 text-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded bg-gradient-to-r from-green-600 to-emerald-500 text-white font-medium disabled:opacity-60 flex items-center gap-2"
            >
              <IoSchoolOutline />
              {isSubmitting ? "Joining Classroom..." : "Join Classroom"}
            </button>
          </form>
        </div>
      </motion.div>
    </GlassDashboardShell>
  );
};

export default Onboarding;
