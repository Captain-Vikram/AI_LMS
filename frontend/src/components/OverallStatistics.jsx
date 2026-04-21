import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  IoBarChartOutline,
  IoStatsChartOutline,
  IoCalendarOutline,
  IoBookOutline,
} from "react-icons/io5";
import IconsCarousel from "./IconsCarousel";
import apiClient from "../services/apiClient";
import { API_ENDPOINTS } from "../config/api";

const OverallStatistics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    levelDistribution: [],
    skillGapFrequency: [],
    averageScores: [],
    quizCountByMonth: [],
    topRecommendations: [],
  });

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get(API_ENDPOINTS.QUIZ_STATISTICS);

        setStats(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching statistics:", err);
        setError("Failed to load statistics. Please try again later.");
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-b-purple-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900/40 border border-red-700/50 text-red-100 px-6 py-4 rounded-xl max-w-md">
          <h3 className="font-medium mb-2">Error Loading Data</h3>
          <p>{error}</p>
        </div>
      </div>
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
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-white flex items-center">
            <IoStatsChartOutline className="mr-3 text-blue-400" />
            Quiz Assessment Analytics Dashboard
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* User Skill Level Distribution */}
            <div className="bg-gray-700/50 rounded-xl p-6 shadow border border-gray-600/30">
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center">
                <IoBarChartOutline className="mr-2 text-blue-400" />
                User Skill Level Distribution
              </h3>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.levelDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {stats.levelDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.9)",
                        borderColor: "#374151",
                        color: "#fff",
                      }}
                    />
                    <Legend wrapperStyle={{ color: "#e5e7eb" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Common Skill Gaps */}
            <div className="bg-gray-700/50 rounded-xl p-6 shadow border border-gray-600/30">
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center">
                <IoBookOutline className="mr-2 text-green-400" />
                Most Common Skill Gaps
              </h3>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.skillGapFrequency}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9ca3af" }} />
                    <YAxis tick={{ fill: "#9ca3af" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.9)",
                        borderColor: "#374151",
                        color: "#fff",
                      }}
                    />
                    <Bar
                      dataKey="frequency"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 mb-8">
            {/* Average Scores Over Time */}
            <div className="bg-gray-700/50 rounded-xl p-6 shadow border border-gray-600/30">
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center">
                <IoStatsChartOutline className="mr-2 text-purple-400" />
                Average Quiz Scores Over Time
              </h3>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.averageScores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fill: "#9ca3af" }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.9)",
                        borderColor: "#374151",
                        color: "#fff",
                      }}
                    />
                    <Legend wrapperStyle={{ color: "#e5e7eb" }} />
                    <Line
                      type="monotone"
                      dataKey="average"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      activeDot={{ r: 8, fill: "#8b5cf6", stroke: "#fff" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Quiz Count by Month */}
            <div className="bg-gray-700/50 rounded-xl p-6 shadow border border-gray-600/30">
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center">
                <IoCalendarOutline className="mr-2 text-blue-400" />
                Quiz Completions by Month
              </h3>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.quizCountByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" tick={{ fill: "#9ca3af" }} />
                    <YAxis tick={{ fill: "#9ca3af" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.9)",
                        borderColor: "#374151",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Recommendations */}
            <div className="bg-gray-700/50 rounded-xl p-6 shadow border border-gray-600/30">
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center">
                <IoBookOutline className="mr-2 text-yellow-400" />
                Top Learning Recommendations
              </h3>
              <div className="bg-gray-800/50 rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-[300px]">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Recommendation
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Frequency
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800/50 divide-y divide-gray-700">
                      {stats.topRecommendations.map((rec, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-gray-200">
                            {rec.title}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-300 capitalize">
                            {rec.type}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium bg-blue-900/40 text-blue-300 rounded-full">
                              {rec.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OverallStatistics;
