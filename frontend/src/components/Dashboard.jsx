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

  const scoreSeries = (assessmentHistory || [])
    .slice()
    .reverse()
    .map((a) => ({ date: new Date(a.timestamp).toLocaleDateString(), score: a.score?.percentage || 0 }));

  const weeklyChartData = (analyticsData.weeklyActivity || []).map((v, i) => ({
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i] || `D${i}`,
    value: Number(v) || 0,
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-b-purple-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Welcome back, {userData.firstName}</h1>
            <p className="text-sm text-gray-400">Last active: {userData.lastActive || 'Today'}</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Score Trend</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af' }} />
                  <YAxis tick={{ fill: '#9ca3af' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#60a5fa" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
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
