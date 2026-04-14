import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import IconsCarousel from "./IconsCarousel";
import apiClient from "../services/apiClient";
import { API_ENDPOINTS } from "../config/api";
import {
  IoSearchOutline,
  IoBookOutline,
  IoSchoolOutline,
  IoCodeOutline,
  IoBarChartOutline,
  IoRocketOutline,
  IoLibraryOutline,
  IoLinkOutline,
  IoVideocamOutline,
  IoDocumentTextOutline,
  IoLogoYoutube,
  IoFileTrayFullOutline,
  IoStarOutline,
  IoTimeOutline,
  IoAlertCircleOutline,
} from "react-icons/io5";

const DeepSearch = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resources, setResources] = useState([]);
  const [assessmentData, setAssessmentData] = useState(null);
  const didFetch = useRef(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  useEffect(() => {
    // Prevent multiple fetches
    if (didFetch.current) return;
    didFetch.current = true;

    const fetchDeepSearchResults = async () => {
      try {
        setIsLoading(true);

        // Get assessment results from localStorage
        const assessmentResults = localStorage.getItem(
          "skillAssessmentResults"
        );
        const parsedResults = assessmentResults
          ? JSON.parse(assessmentResults)
          : null;

        if (!parsedResults) {
          throw new Error(
            "No assessment data found. Please complete an assessment first."
          );
        }

        setAssessmentData(parsedResults);

        // Structure request body
        const requestBody = { data: parsedResults };

        console.log("Sending request to DeepSearch API:", requestBody);

        // Call the DeepSearch API
        const data = await apiClient.post(
          API_ENDPOINTS.DEEPSEARCH_RECOMMENDATIONS,
          requestBody
        );
        console.log("DeepSearch API response:", data);

        // Process recommendations
        if (data.recommendations && Array.isArray(data.recommendations)) {
          const processedResources = [];
          const defaultLevel = "intermediate";

          data.recommendations.forEach((rec) => {
            // Process documents
            if (rec.documents && Array.isArray(rec.documents)) {
              rec.documents.forEach((doc) => {
                const resourceLevel =
                  parsedResults && parsedResults.assessed_level
                    ? parsedResults.assessed_level
                    : defaultLevel;
                processedResources.push({
                  title: doc.title || "Untitled Resource",
                  description: doc.content || "No description available",
                  url: doc.url,
                  type: getResourceTypeFromUrl(doc.url) || "article",
                  difficulty: resourceLevel,
                  rating: doc.score ? Math.min(5, doc.score * 5) : undefined,
                  tags: [rec.skill].filter(Boolean),
                  skill_category: rec.skill,
                });
              });
            }

            // Process blogs (new structure)
            if (rec.blogs && Array.isArray(rec.blogs)) {
              rec.blogs.forEach((blogUrl) => {
                const resourceLevel =
                  parsedResults && parsedResults.assessed_level
                    ? parsedResults.assessed_level
                    : defaultLevel;
                processedResources.push({
                  title: blogUrl, // Optionally adjust title formatting here
                  description: "Recommended blog resource",
                  url: blogUrl,
                  type: "blog",
                  difficulty: resourceLevel,
                  rating: undefined,
                  tags: [rec.skill].filter(Boolean),
                  skill_category: rec.skill,
                });
              });
            }
          });

          setResources(processedResources);
        } else {
          setResources([]);
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching deep search results:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchDeepSearchResults();
  }, []);

  // Determine resource type from URL
  const getResourceTypeFromUrl = (url) => {
    if (!url) return "article";

    url = url.toLowerCase();

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return "youtube";
    } else if (
      url.includes("coursera.org") ||
      url.includes("udemy.com") ||
      url.includes("edx.org") ||
      url.includes("course")
    ) {
      return "course";
    } else if (url.includes("github.com") || url.includes("gitlab.com")) {
      return "project";
    } else if (url.includes("docs.") || url.includes("documentation")) {
      return "documentation";
    } else if (
      url.includes("medium.com") ||
      url.endsWith(".pdf") ||
      url.includes("paper") ||
      url.includes("research") ||
      url.includes("article")
    ) {
      return "article";
    } else {
      return "article";
    }
  };

  // Get resource type icon
  const getResourceIcon = (type) => {
    const iconProps = { className: "mr-2" };
    switch ((type ?? "").toLowerCase()) {
      case "course":
        return <IoSchoolOutline {...iconProps} />;
      case "video":
        return <IoVideocamOutline {...iconProps} />;
      case "youtube":
        return <IoLogoYoutube {...iconProps} />;
      case "documentation":
        return <IoDocumentTextOutline {...iconProps} />;
      case "library":
        return <IoLibraryOutline {...iconProps} />;
      case "article":
        return <IoFileTrayFullOutline {...iconProps} />;
      case "project":
        return <IoCodeOutline {...iconProps} />;
      case "blog":
        return <IoBookOutline {...iconProps} />;
      default:
        return <IoBookOutline {...iconProps} />;
    }
  };

  // Get badge color based on difficulty or skill level
  const getBadgeColor = (level) => {
    if (!level) return "bg-gray-600/40 text-gray-200 border border-gray-500/30";

    switch (level.toLowerCase()) {
      case "beginner":
        return "bg-green-600/40 text-green-200 border border-green-500/30";
      case "intermediate":
        return "bg-blue-600/40 text-blue-200 border border-blue-500/30";
      case "advanced":
        return "bg-purple-600/40 text-purple-200 border border-purple-500/30";
      case "expert":
        return "bg-red-600/40 text-red-200 border border-red-500/30";
      case "needs improvement":
        return "bg-amber-600/40 text-amber-200 border border-amber-500/30";
      case "satisfactory":
        return "bg-green-600/40 text-green-200 border border-green-500/30";
      default:
        return "bg-gray-600/40 text-gray-200 border border-gray-500/30";
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel
            backgroundColor="rgba(17, 24, 39, 0.8)"
            iconColor="gray-500/30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <div className="w-full max-w-3xl relative z-10 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-b-purple-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
            <h3 className="text-xl font-medium text-white mt-4 mb-2">
              Searching the universe...
            </h3>
            <p className="text-gray-300 text-center">
              We're finding the best learning resources for your skill level.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel
            backgroundColor="rgba(17, 24, 39, 0.8)"
            iconColor="gray-500/30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <div className="w-full max-w-3xl relative z-10 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center justify-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-medium text-white mb-2">
              Search Error
            </h3>
            <p className="text-gray-300 text-center mb-6">{error}</p>
            <Link to="/assessment">
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Take Assessment
              </button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen px-4 py-12 pt-28">
      {/* Background with Icon Carousel */}
      <div className="absolute inset-0 overflow-hidden">
        <IconsCarousel
          backgroundColor="rgba(17, 24, 39, 0.8)"
          iconColor="gray-500/30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>

      <div className="container mx-auto relative z-10">
        <motion.div
          className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Page Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-4 bg-blue-900/30 rounded-full mb-4">
              <IoSearchOutline className="text-blue-400 text-4xl" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Deep Knowledge Search
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              AI-powered resource recommendations based on your current skill
              level and identified improvement areas.
            </p>
          </div>

          {/* Assessment Summary */}
          {assessmentData && (
            <motion.div
              className="mb-10 bg-gray-700/50 rounded-xl p-6"
              variants={cardVariants}
            >
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <IoBarChartOutline className="mr-2 text-blue-400" />
                Assessment Summary
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Score */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-gray-300 text-sm mb-2">Your Score</h3>
                  <div className="flex items-end">
                    <span className="text-3xl font-bold text-blue-400">
                      {assessmentData.score.percentage}%
                    </span>
                    <span className="text-gray-400 ml-2 mb-1">
                      ({assessmentData.score.correct}/
                      {assessmentData.score.total} correct)
                    </span>
                  </div>
                </div>

                {/* Level */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-gray-300 text-sm mb-2">Your Level</h3>
                  <div className="flex items-center">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getBadgeColor(
                        assessmentData.assessed_level
                      )}`}
                    >
                      {assessmentData.assessed_level}
                    </span>
                  </div>
                </div>

                {/* Skill Gaps */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-gray-300 text-sm mb-2">Focus Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {assessmentData.skill_gaps.areas.map((area, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(
                          area.level
                        )}`}
                      >
                        {area.skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Resources */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <IoRocketOutline className="mr-3 text-purple-400" />
              Recommended Resources
            </h2>

            {resources && resources.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {resources.map((resource, index) => (
                  <motion.div
                    key={index}
                    className="bg-gray-700/50 border border-gray-600/50 rounded-xl overflow-hidden flex flex-col"
                    variants={cardVariants}
                    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  >
                    {resource.image_url && (
                      <div className="aspect-video w-full overflow-hidden">
                        <img
                          src={resource.image_url}
                          alt={resource.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="p-6 flex flex-col flex-grow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center text-sm font-medium">
                          {getResourceIcon(resource.type)}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(
                              resource.difficulty ||
                                assessmentData?.assessed_level
                            )}`}
                          >
                            {resource.type}
                          </span>
                        </div>

                        {resource.est_time && (
                          <div className="flex items-center text-gray-400 text-xs">
                            <IoTimeOutline className="mr-1" />
                            {resource.est_time}
                          </div>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-2">
                        {resource.title}
                      </h3>

                      {resource.description && (
                        <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                          {resource.description}
                        </p>
                      )}

                      <div className="mt-auto pt-4">
                        {resource.rating && (
                          <div className="flex items-center mb-3">
                            <div className="flex items-center">
                              {[...Array(Math.floor(resource.rating))].map(
                                (_, i) => (
                                  <IoStarOutline
                                    key={i}
                                    className="text-yellow-400"
                                  />
                                )
                              )}
                            </div>
                            <span className="ml-2 text-sm text-gray-400">
                              {resource.rating.toFixed(1)}
                            </span>
                          </div>
                        )}

                        {resource.tags && resource.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {resource.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="bg-blue-900/30 text-blue-300 text-xs px-2 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {resource.tags.length > 3 && (
                              <span className="text-gray-400 text-xs">
                                +{resource.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        {resource.url ? (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            <IoLinkOutline className="mr-2" />
                            View Resource
                          </a>
                        ) : (
                          <div className="inline-flex items-center justify-center w-full px-4 py-2 bg-gray-600/50 text-gray-300 rounded-lg cursor-not-allowed">
                            <IoAlertCircleOutline className="mr-2" />
                            No Link Available
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="bg-gray-700/30 border border-gray-600/30 rounded-xl p-8 text-center">
                <p className="text-gray-400">
                  No custom resources found for your profile. Try retaking the
                  assessment.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-center mt-8">
            <Link to="/dashboard">
              <button className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors mr-4">
                Back to Dashboard
              </button>
            </Link>
            <Link to="/assessment">
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Retake Assessment
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DeepSearch;
