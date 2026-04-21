import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
// Charts (lightweight) - install with: npm install recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  IoRocketOutline,
  IoTrophyOutline,
  IoBookOutline,
} from "react-icons/io5";

const Dashboard = () => {
  const { id: focusedPathwayId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState({ firstName: "Learner" });
  const [assessmentResults, setAssessmentResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [assessmentHistory, setAssessmentHistory] = useState([]);
  const [analyticsData, setAnalyticsData] = useState({
    learningStreak: 0,
    completedModules: 0,
    progressPercentage: 0,
    weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
    upcomingMilestones: [],
    recentAchievements: [],
    pendingAssignments: 0,
    classroomCount: 0,
  });

  // Minimal placeholder refresh — replace with real fetch logic if desired
  const refreshDashboardData = () => {
    window.location.reload();
  };

  const clearErrors = () => {
    setErrorMessages([]);
  };

  const [loginActivity, setLoginActivity] = useState([
    { day: "S", count: 0, percentage: 0 },
    { day: "M", count: 0, percentage: 0 },
    { day: "T", count: 0, percentage: 0 },
    { day: "W", count: 0, percentage: 0 },
    { day: "T", count: 0, percentage: 0 },
    { day: "F", count: 0, percentage: 0 },
    { day: "S", count: 0, percentage: 0 },
  ]);

  const isSkillPathwayMode = Boolean(focusedPathwayId);
  const focusedPathway = isSkillPathwayMode
    ? myPathways.find((pathway) => pathway.pathway_id === focusedPathwayId) || null
    : null;

  const focusedStageProgress = Array.isArray(focusedPathway?.stage_progress)
    ? focusedPathway.stage_progress
    : [];

  const focusedCurrentStage =
    focusedStageProgress.find((stage) => stage.status === "in-progress") ||
    focusedStageProgress[0] ||
    null;

  const focusedTotalStages =
    Number(focusedPathway?.pathway_details?.total_stages) ||
    focusedStageProgress.length ||
    0;

  const focusedCompletedStages = focusedStageProgress.filter(
    (stage) => stage.status === "completed"
  ).length;

  const focusedProgressPercent =
    focusedTotalStages > 0
      ? Math.round((focusedCompletedStages / focusedTotalStages) * 100)
      : 0;

  const focusedResources = Array.isArray(pathwayStageData?.tracker?.resources)
    ? pathwayStageData.tracker.resources
    : [];
  const focusedVideoCount = focusedResources.filter(
    (resourceItem) => String(resourceItem?.type || "").toLowerCase() === "video"
  ).length;
  const focusedArticleCount = focusedResources.filter(
    (resourceItem) => String(resourceItem?.type || "").toLowerCase() === "article"
  ).length;
  const focusedMasteredCount = focusedResources.filter(
    (resourceItem) => Number(resourceItem?.passed_tests_count || 0) >= 2
  ).length;

  const displayedPathways = isSkillPathwayMode
    ? myPathways.filter((pathway) => pathway.pathway_id === focusedPathwayId)
    : myPathways;

  const fetchUserXP = async () => {
    try {
      const xpData = await apiClient.get(API_ENDPOINTS.GAMIFICATION_XP);
      const currentXP = xpData.current ?? xpData.xp ?? 0;

      setUserXP({
        current: currentXP,
        level: xpData.level ?? 1,
        levelThreshold: xpData.level_threshold ?? 100,
        total_earned: xpData.total_earned ?? 0,
      });

      setAnalyticsData((prev) => ({
        ...prev,
        learningStreak: xpData.streak ?? prev.learningStreak,
      }));
    } catch (error) {
      addErrorMessage(`Unable to load XP data: ${error.message}`);
    }
  };

  const fetchUserBadges = async () => {
    try {
      const badgeData = await apiClient.get(API_ENDPOINTS.GAMIFICATION_BADGES);
      const availableBadges = Array.isArray(badgeData.badges)
        ? badgeData.badges
        : [];

      setBadges(
        availableBadges.map((badge) => ({
          id: badge.id,
          name: badge.name,
          shortDescription: badge.short_description,
          description: badge.description,
          category: badge.category,
          color: badge.color,
          icon: badge.icon,
          xpAwarded: badge.xp_awarded,
          reward: badge.reward || null,
        }))
      );

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const newlyEarned = availableBadges.filter((badge) => {
        if (!badge.unlocked || !badge.earned_date) {
          return false;
        }

        const earnedTimestamp = new Date(badge.earned_date).getTime();
        return Number.isFinite(earnedTimestamp) && earnedTimestamp > oneDayAgo;
      });

      if (newlyEarned.length > 0) {
        setAchievementQueue(
          newlyEarned.map((badge) => ({
            id: badge.id,
            name: badge.name,
            shortDescription: badge.short_description,
            color: badge.color,
            icon: badge.icon,
            xpAwarded: badge.xp_awarded,
          }))
        );
      }
    } catch (error) {
      addErrorMessage(`Unable to load badge data: ${error.message}`);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const analytics = await apiClient.get(API_ENDPOINTS.ANALYTICS_DASHBOARD);
      const apiMilestones = Array.isArray(analytics.upcomingMilestones)
        ? analytics.upcomingMilestones
        : [];
      const apiAchievements = Array.isArray(analytics.recent_achievements)
        ? analytics.recent_achievements
        : [];

      setAnalyticsData((prevData) => ({
        ...prevData,
        learningStreak: analytics.learning_streak ?? prevData.learningStreak,
        totalLearningHours:
          analytics.total_learning_hours ?? prevData.totalLearningHours,
        completedModules: analytics.completed_modules ?? prevData.completedModules,
        progressPercentage:
          analytics.progress_percentage ?? prevData.progressPercentage,
        weeklyActivity: Array.isArray(analytics.weekly_activity)
          ? analytics.weekly_activity
          : prevData.weeklyActivity,
        upcomingMilestones: apiMilestones.map((milestone) => ({
          id: milestone.id,
          name: milestone.name || "Learning milestone",
          progress: Math.max(0, Math.min(100, Number(milestone.progress) || 0)),
        })),
        recentAchievements: apiAchievements.map((achievement) => {
          const parsedDate = achievement.date ? new Date(achievement.date) : null;
          const formattedDate =
            parsedDate && Number.isFinite(parsedDate.getTime())
              ? parsedDate.toLocaleDateString()
              : "Recently";

          return {
            id: achievement.id,
            name: achievement.name || "Achievement",
            description: achievement.description || "",
            date: formattedDate,
          };
        }),
      }));
    } catch (error) {
      addErrorMessage(`Unable to load analytics: ${error.message}`);
    }
  };

  useEffect(() => {
    if (achievementQueue.length > 0 && !newAchievement) {
      // Display the first achievement in the queue
      setNewAchievement(achievementQueue[0]);

      // Remove it from the queue
      setAchievementQueue((prev) => prev.slice(1));
    }
  }, [achievementQueue, newAchievement]);

  // Handle achievement notification close
  const handleAchievementClose = () => {
    setNewAchievement(null);
    // The next achievement will be shown on next render due to the effect above
  };

  // Function to handle retaking the assessment
  const handleRetakeAssessment = () => {
    // Get the current level to determine the new assessment difficulty
    const currentLevel = assessmentResults?.assessed_level || "intermediate";

    // Set skillAssessmentComplete to false to ensure the assessment page doesn't redirect
    localStorage.setItem("skillAssessmentComplete", "false");

    // Store the information about reassessment in localStorage
    localStorage.setItem(
      "reassessmentInfo",
      JSON.stringify({
        previousLevel: currentLevel,
        previousScore: assessmentResults?.score?.percentage || 0,
        isReassessment: true,
        timestamp: new Date().toISOString(),
      })
    );

    // Navigate to the assessment page
    navigate("/assessment");
  };

  // Fetch assessment results including historical data
  const fetchAssessmentHistory = async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.QUIZ_ASSESSMENT_HISTORY);

      if (Array.isArray(data.assessments) && data.assessments.length > 0) {
        setAssessmentHistory(data.assessments);
        setAssessmentResults(data.assessments[0]);

        if (data.assessments.length > 1) {
          const progressData = calculateAssessmentProgress(data.assessments);
          setAnalyticsData((prevData) => ({
            ...prevData,
            assessmentProgress: progressData,
          }));
        }
      } else {
        setAssessmentHistory([]);
      }
    } catch (error) {
      addErrorMessage(`Unable to load assessment history: ${error.message}`);
    }
  };

  const fetchLoginActivity = async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.AUTH_LOGIN_ACTIVITY);
      if (Array.isArray(data.weekly_activity)) {
        setLoginActivity(
          data.weekly_activity.map((item) => ({
            day: item.day.charAt(0),
            count: item.count,
            percentage: item.percentage,
          }))
        );
      }
    } catch (error) {
      addErrorMessage(`Unable to load weekly login activity: ${error.message}`);
    }
  };

  const fetchUserSkills = async () => {
    if (!API_ENDPOINTS.ONBOARDING_USER_SKILLS) {
      setUserSkills([]);
      return;
    }

    try {
      const skillsData = await apiClient.get(API_ENDPOINTS.ONBOARDING_USER_SKILLS);
      setUserSkills(Array.isArray(skillsData) ? skillsData : []);
    } catch (error) {
      addErrorMessage(`Unable to load user skills: ${error.message}`);
    }
  };

  const fetchUserData = async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.AUTH_USER_PROFILE);
      setUserData(data || {});
    } catch (error) {
      addErrorMessage(`Unable to load profile: ${error.message}`);
    }
  };

  const fetchMyPathways = async () => {
    try {
      if (API_ENDPOINTS.PATHWAYS_MY_PROGRESS) {
        const response = await apiClient.get(API_ENDPOINTS.PATHWAYS_MY_PROGRESS);
        if (response && response.status === "success") {
          const pathways = Array.isArray(response.data) ? response.data : [];
          setMyPathways(pathways);
          return pathways;
        }
      }
    } catch (error) {
      addErrorMessage(`Unable to load pathway progress: ${error.message}`);
    }

    setMyPathways([]);
    return [];
  };

  const fetchFocusedPathwayStageData = async () => {
    if (!isSkillPathwayMode || !focusedPathwayId) {
      return;
    }

    if (!focusedCurrentStage?.stage_index) {
      setPathwayStageData(null);
      return;
    }

    setPathwayStageLoading(true);
    try {
      const response = await apiClient.get(
        API_ENDPOINTS.PATHWAY_STAGE_DETAILS(
          focusedPathwayId,
          focusedCurrentStage.stage_index
        )
      );

      if (response?.status === "success") {
        setPathwayStageData(response.data || null);
      } else {
        setPathwayStageData(null);
      }
    } catch (error) {
      setPathwayStageData(null);
      addErrorMessage(`Unable to load stage details: ${error.message}`);
    } finally {
      setPathwayStageLoading(false);
    }
  };

  const verifyUserStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return false;
    }

    try {
      const status = await apiClient.get(API_ENDPOINTS.AUTH_USER_STATUS);

      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem(
        "onboardingComplete",
        status.onboarding_complete ? "true" : "false"
      );
      localStorage.setItem(
        "skillAssessmentComplete",
        status.assessment_complete ? "true" : "false"
      );

      if (!status.onboarding_complete) {
        navigate("/onboarding");
        return false;
      }

      if (!status.assessment_complete) {
        navigate("/assessment");
        return false;
      }

      return true;
    } catch {
      navigate("/login");
      return false;
    }
  };

  const refreshDashboardData = async () => {
    setIsRefreshing(true);
    clearErrors();

    await Promise.all([
      fetchAnalyticsData(),
      fetchUserXP(),
      fetchUserBadges(),
      fetchAssessmentHistory(),
      fetchLoginActivity(),
      fetchUserSkills(),
      fetchUserData(),
      fetchMyPathways(),
    ]);

    setIsRefreshing(false);
  };

  const handleGenerateFocusedResources = async () => {
    if (!focusedPathwayId || !focusedCurrentStage?.stage_index) {
      return;
    }

    setPathwayActionLoading(true);
    clearErrors();
    try {
      await apiClient.post(
        API_ENDPOINTS.PATHWAY_GENERATE_RESOURCES(
          focusedPathwayId,
          focusedCurrentStage.stage_index
        )
      );
      await refreshDashboardData();
    } catch (error) {
      addErrorMessage(`Unable to generate resources: ${error.message}`);
    } finally {
      setPathwayActionLoading(false);
    }
  };

  const handleOpenResourcesWorkspace = () => {
    if (!focusedPathwayId) {
      return;
    }

    navigate(`/skill-pathway/${focusedPathwayId}/resources`);
  };

  const handleTakeSkillAssessment = async () => {
    if (!focusedPathwayId) {
      return;
    }

    const activeStageIndex = focusedCurrentStage?.stage_index || 1;
    const firstResourceId = String(
      focusedResources.find((resourceItem) => resourceItem?.resource_id)?.resource_id || ""
    ).trim();

    if (firstResourceId) {
      navigate(
        `/skill-pathway/${focusedPathwayId}/stage/${activeStageIndex}/resource/${firstResourceId}`
      );
      return;
    }

    await handleGenerateFocusedResources();
    navigate(`/skill-pathway/${focusedPathwayId}/resources`);
  };

  // Calculate progress between assessments
  const calculateAssessmentProgress = (assessments) => {
    // Sort by timestamp descending (newest first)
    const sortedAssessments = [...assessments].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Compare the most recent two assessments
    if (sortedAssessments.length >= 2) {
      const latest = sortedAssessments[0];
      const previous = sortedAssessments[1];
      const latestScore = latest?.score?.percentage ?? 0;
      const previousScore = previous?.score?.percentage ?? 0;

      return {
        scoreChange: latestScore - previousScore,
        levelChange:
          latest.assessed_level !== previous.assessed_level
            ? `${previous.assessed_level} → ${latest.assessed_level}`
            : null,
        improvedAreas: (latest.skill_gaps?.areas || [])
          .filter(
            (area) =>
              area.level === "satisfactory" &&
              (previous.skill_gaps?.areas || []).find(
                (prevArea) =>
                  prevArea.skill === area.skill &&
                  prevArea.level === "needs improvement"
              )
          )
          .map((area) => area.skill),
        timestamp: latest.timestamp,
      };
    }

    return null;
  };

  useEffect(() => {
    if (!isSkillPathwayMode) {
      setPathwayStageData(null);
      setPathwayStageLoading(false);
      return;
    }

    if (!focusedCurrentStage?.stage_index) {
      setPathwayStageData(null);
      return;
    }

    fetchFocusedPathwayStageData();
  }, [isSkillPathwayMode, focusedPathwayId, focusedCurrentStage?.stage_index]);

  useEffect(() => {
    const initializeDashboard = async () => {
      const hasAccess = await verifyUserStatus();
      if (!hasAccess) {
        setIsLoading(false);
        return;
      }

      const storedResults = localStorage.getItem("skillAssessmentResults");
      if (storedResults) {
        try {
          setAssessmentResults(JSON.parse(storedResults));
        } catch {
          localStorage.removeItem("skillAssessmentResults");
        }
      }

      await refreshDashboardData();
      setIsLoading(false);
    };

    initializeDashboard();
  }, [navigate, focusedPathwayId, isSkillPathwayMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-b-purple-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
          <p>
            {isSkillPathwayMode
              ? "Loading your skill dashboard..."
              : "Loading your dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="relative min-h-screen px-4 py-12 pt-28">
      {/* Background Icon Carousel */}
      <div className="absolute inset-0 overflow-hidden">
        <IconsCarousel
          backgroundColor="rgba(17, 24, 39, 0.8)"
          iconColor="gray-500/30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>

      <div className="container mx-auto relative z-10">
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          {/* User Welcome Section */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {isSkillPathwayMode
                  ? `${focusedPathway?.pathway_details?.title || "Skill Pathway"} Dashboard`
                  : `Welcome back, ${userData.firstName || "Learner"} ${
                      userData.lastName || ""
                    }`}
              </h1>
              <p className="text-gray-400">
                {isSkillPathwayMode
                  ? `Track your stage progress and continue learning with AI-generated resources for Stage ${
                      focusedCurrentStage?.stage_index || 1
                    }.`
                  : `Last active: ${userData.lastActive || "Today"}`}
              </p>
            </div>
            <div className="flex items-center mt-4 md:mt-0 space-x-2 bg-gray-700/50 px-4 py-2 rounded-lg">
              <IoFlameOutline className="text-orange-500 text-xl" />
              <span className="text-white font-medium">
                {isSkillPathwayMode
                  ? `${Number(focusedPathway?.current_streak || 0)} day skill test streak`
                  : `${analyticsData.learningStreak} day streak`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refreshDashboardData} className="px-3 py-2 bg-slate-700 text-white rounded">Refresh</button>
            <Link to="/assessment" className="px-3 py-2 bg-blue-600 text-white rounded">Take Assessment</Link>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-800 rounded-lg border border-white/5">
            <div className="text-sm text-gray-400">Students</div>
            <div className="text-2xl font-bold text-white">{analyticsData.classroomCount ?? 0}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg border border-white/5">
            <div className="text-sm text-gray-400">Assignments Due</div>
            <div className="text-2xl font-bold text-white">{analyticsData.pendingAssignments ?? 0}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg border border-white/5">
            <div className="text-sm text-gray-400">Modules</div>
            <div className="text-2xl font-bold text-white">{analyticsData.completedModules ?? 0}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg border border-white/5">
            <div className="text-sm text-gray-400">Completion</div>
            <div className="text-2xl font-bold text-white">{analyticsData.progressPercentage ?? 0}%</div>
          </div>
        </div>

          {/* Main Content Grid */}
          
          {/* Enrolled Pathways Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <IoGridOutline className="mr-2 text-indigo-400" />
              {isSkillPathwayMode
                ? "Focused Skill Pathway"
                : "My Enrolled Skill Pathways"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedPathways && displayedPathways.length > 0 ? (
                displayedPathways.map((pathway) => {
                  const stageProgress = Array.isArray(pathway.stage_progress)
                    ? pathway.stage_progress
                    : [];
                  const currentStage =
                    stageProgress.find((s) => s.status === "in-progress") ||
                    stageProgress[0] ||
                    null;
                  const totalStages =
                    Number(pathway?.pathway_details?.total_stages) ||
                    stageProgress.length ||
                    1;
                  const progressPct = Math.round(
                    (stageProgress.filter((s) => s.status === "completed").length /
                      totalStages) *
                      100
                  );
                  const pathwayDescription = String(
                    pathway?.pathway_details?.description || ""
                  );
                  const trimmedDescription =
                    pathwayDescription.length > 80
                      ? `${pathwayDescription.slice(0, 80)}...`
                      : pathwayDescription;

                  return (
                    <div key={pathway._id} className="bg-gray-700/50 rounded-xl p-5 border border-indigo-500/20 hover:border-indigo-400/40 transition-all cursor-pointer" onClick={() => navigate(`/skill-pathway/${pathway.pathway_id}`)}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">{pathway.pathway_details.title}</h3>
                          <p className="text-sm text-gray-400">{trimmedDescription}</p>
                        </div>
                        <div className="bg-indigo-900/50 px-3 py-1 rounded-full text-xs font-semibold text-indigo-300">
                          {progressPct}% Complete
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="w-full bg-gray-600 rounded-full h-1.5">
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full" style={{ width: `${progressPct}%` }}></div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-300"><span className="text-white font-medium">Current Phase:</span> Stage {currentStage?.stage_index || 1}</span>
                        <span className="text-gray-400">{currentStage?.status || "locked"}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-1 md:col-span-2 bg-gray-700/40 border border-dashed border-gray-600 p-6 rounded-xl text-center">
                  <p className="text-gray-400 mb-4">
                    {isSkillPathwayMode
                      ? "This pathway is not available for your account yet."
                      : "You haven't enrolled in any Skill Pathways yet."}
                  </p>
                  <button onClick={() => navigate('/skills')} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors inline-flex items-center">
                    <IoRocketOutline className="mr-2" /> Browse Skill Pathways
                  </button>
                </div>
              )}
            </div>
          </div>

          {isSkillPathwayMode && (
            <div className="mb-8 rounded-2xl border border-indigo-500/30 bg-gray-700/40 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1 flex items-center">
                    <IoLayersOutline className="mr-2 text-indigo-300" />
                    Stage Workspace
                  </h2>
                  <p className="text-sm text-gray-300">
                    Stage {focusedCurrentStage?.stage_index || 1} • Status: {focusedCurrentStage?.status || "locked"} • {focusedProgressPercent}% pathway complete
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={refreshDashboardData}
                    disabled={isRefreshing || pathwayActionLoading}
                    className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-60 text-white text-sm inline-flex items-center"
                  >
                    <IoRefreshOutline className="mr-2" />
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </button>
                  <button
                    onClick={handleGenerateFocusedResources}
                    disabled={pathwayActionLoading || !focusedCurrentStage?.stage_index}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm inline-flex items-center"
                  >
                    <IoFlashOutline className="mr-2" />
                    {pathwayActionLoading ? "Working..." : "Generate Study Material"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-4 rounded-xl border border-indigo-500/20 bg-gray-800/50 p-4">
                  <h3 className="text-base font-semibold text-indigo-200 mb-3">Learning Objectives</h3>
                  {Array.isArray(pathwayStageData?.blueprint_topics) &&
                  pathwayStageData.blueprint_topics.length > 0 ? (
                    <ul className="space-y-3">
                      {pathwayStageData.blueprint_topics.map((topic, topicIndex) => (
                        <li key={`${topic.name || "topic"}-${topicIndex}`} className="text-sm text-gray-300">
                          <span className="block font-medium text-indigo-300 mb-1">
                            {topic.name || `Topic ${topicIndex + 1}`}
                          </span>
                          <ul className="list-disc pl-5 text-gray-400 space-y-1">
                            {(topic.subtopics || []).map((subtopic, subtopicIndex) => (
                              <li key={`${subtopic}-${subtopicIndex}`}>{subtopic}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">Objectives will appear here after stage details are loaded.</p>
                  )}

                  <div className="mt-4 rounded-lg border border-indigo-500/25 bg-indigo-900/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-indigo-200/80 mb-1">Project Prompt</p>
                    <p className="text-sm text-indigo-100/90">
                      {pathwayStageData?.project_prompt || "Follow the generated resources and complete each resource test to advance."}
                    </p>
                  </div>

                  <div className="mt-4 rounded-lg border border-blue-500/25 bg-blue-900/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-blue-200/80 mb-1">Assessment Prompt</p>
                    <p className="text-sm text-blue-100/90">
                      {pathwayStageData?.quiz_prompt ||
                        "Assessments are generated from the current stage and selected resource content."}
                    </p>
                  </div>
                </div>

                <div className="xl:col-span-8 rounded-xl border border-gray-700 bg-gray-800/40 p-4">
                  <h3 className="text-base font-semibold text-white mb-3">Resource Workspace</h3>

                  {pathwayStageLoading ? (
                    <div className="rounded-lg border border-gray-700/80 bg-gray-900/40 p-4 text-sm text-gray-300">
                      Loading stage resources...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                          <p className="text-xs text-gray-400">Total Resources</p>
                          <p className="text-lg font-semibold text-white">{focusedResources.length}</p>
                        </div>
                        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                          <p className="text-xs text-gray-400">Videos / Articles</p>
                          <p className="text-lg font-semibold text-white">{focusedVideoCount} / {focusedArticleCount}</p>
                        </div>
                        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                          <p className="text-xs text-gray-400">Mastered Resources</p>
                          <p className="text-lg font-semibold text-emerald-300">{focusedMasteredCount}</p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-dashed border-gray-600 bg-gray-900/20 p-4">
                        <p className="text-sm text-gray-300">
                          Resource cards, Study actions, and per-resource tests are moved to a dedicated page for cleaner skill dashboard flow.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleOpenResourcesWorkspace}
                          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm inline-flex items-center"
                        >
                          <IoPlayCircleOutline className="mr-2" />
                          Open Resources Page
                        </button>

                        <button
                          onClick={handleTakeSkillAssessment}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
                        >
                          Take Skill Assessment
                        </button>

                        {focusedResources.length === 0 && (
                          <button
                            onClick={handleGenerateFocusedResources}
                            disabled={pathwayActionLoading || !focusedCurrentStage?.stage_index}
                            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white text-sm"
                          >
                            {pathwayActionLoading ? "Working..." : "Generate Resources"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* First Column */}
            <div className="md:col-span-1 space-y-6">
              {/* Assessment Summary Card */}
              <div className="bg-gray-700/50 rounded-xl p-6 h-full">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <IoBarChartOutline className="mr-2 text-blue-400" />
                  {isSkillPathwayMode ? "Skill Assessment Summary" : "Assessment Summary"}
                </h2>

                {isSkillPathwayMode ? (
                  <div>
                    <div className="mb-4">
                      <p className="text-gray-300">
                        Current Stage:{" "}
                        <span className="text-blue-300 font-medium">
                          {focusedCurrentStage?.stage_index || 1}
                        </span>
                      </p>
                      <p className="text-gray-300 mt-2 text-sm">
                        {pathwayStageData?.quiz_prompt ||
                          "Stage assessments are generated from the pathway quiz prompt and your resource content."}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleTakeSkillAssessment}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center"
                      >
                        Take Assessment
                        <IoArrowForwardOutline className="ml-1" />
                      </button>

                      <button
                        onClick={handleOpenResourcesWorkspace}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center"
                      >
                        Open Resources
                        <IoPlayCircleOutline className="ml-1" />
                      </button>
                    </div>
                  </div>
                ) : assessmentResults ? (
                  <div>
                    <div className="mb-4">
                      <p className="text-gray-300">
                        Level:{" "}
                        <span className="text-blue-400 font-medium capitalize">
                          {assessmentResults.assessed_level}
                        </span>
                      </p>
                      <p className="text-gray-300">
                        Score:{" "}
                        <span className="text-blue-400 font-medium">
                          {assessmentResults.score?.percentage?.toFixed(0)}%
                        </span>
                      </p>
                    </div>

                    <h3 className="font-medium text-white mb-2">
                      Focus Areas:
                    </h3>
                    <ul className="text-gray-300 space-y-1 mb-4">
                      {assessmentResults.skill_gaps?.areas?.map(
                        (area, index) => (
                          <li key={index} className="flex items-center">
                            <span
                              className={`h-2 w-2 rounded-full mr-2 ${
                                area.level === "needs improvement"
                                  ? "bg-amber-400"
                                  : "bg-green-400"
                              }`}
                            ></span>
                            {area.skill}
                          </li>
                        )
                      )}
                    </ul>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => navigate("/recommendations")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center"
                      >
                        View Resources
                        <IoArrowForwardOutline className="ml-1" />
                      </button>

                      <button
                        onClick={handleRetakeAssessment}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center"
                      >
                        Retake Assessment
                        <IoBarChartOutline className="ml-1" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-400 mb-4">
                      You haven't completed an assessment yet.
                    </p>
                    <button
                      onClick={() => navigate("/assessment")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Take Assessment
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-gray-700 p-3 rounded">
                <div className="text-sm text-gray-400">Latest Score</div>
                <div className="text-2xl font-bold text-white">{assessmentResults?.score?.percentage ? `${assessmentResults.score.percentage}%` : 'N/A'}</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="text-sm text-gray-400">Learning Streak</div>
                <div className="text-2xl font-bold text-white">{analyticsData.learningStreak || 0} days</div>
              </div>
            </div>
          </div>

          <aside className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Engagement</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" tick={{ fill: '#9ca3af' }} />
                  <YAxis tick={{ fill: '#9ca3af' }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4">
              <h4 className="text-sm text-gray-400">Upcoming Milestone</h4>
              {analyticsData.upcomingMilestones?.[0] ? (
                <div className="mt-2 bg-gray-700 p-3 rounded">
                  <div className="text-white font-medium">{analyticsData.upcomingMilestones[0].name}</div>
                  <div className="text-sm text-gray-400">Progress: {analyticsData.upcomingMilestones[0].progress}%</div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-400">No upcoming milestones</div>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Activity Feed</h3>
            <div className="text-sm text-gray-400">Recent activity will appear here.</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Achievements</h3>
            {analyticsData.recentAchievements && analyticsData.recentAchievements.length > 0 ? (
              analyticsData.recentAchievements.slice(0,3).map((a) => (
                <div key={a.id} className="mb-2 bg-gray-700 p-2 rounded">
                  <div className="text-sm text-white font-medium">{a.name}</div>
                  <div className="text-xs text-gray-400">{a.date}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400">No recent achievements</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
