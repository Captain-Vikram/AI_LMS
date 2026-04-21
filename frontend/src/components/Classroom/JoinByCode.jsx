import React, { useState } from 'react';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { Link, useNavigate } from 'react-router-dom';
import GlassDashboardShell from '../UI/GlassDashboardShell';
import { IoArrowBackOutline, IoKeyOutline, IoPeopleOutline } from 'react-icons/io5';

const JoinByCode = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedCode = code.trim();
      const found = await apiClient.get(`${API_ENDPOINTS.CLASSROOM_FIND_BY_CODE}?code=${encodeURIComponent(normalizedCode)}`);
      const classId = found.classroom_id;
      await apiClient.post(`${API_ENDPOINTS.CLASSROOM_JOIN.replace('{id}', classId)}?enrollment_code=${encodeURIComponent(normalizedCode)}`, {});
      navigate(`/classroom/${classId}`);
    } catch (err) {
      setError(err.message || 'Failed to join classroom');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassDashboardShell contentClassName="max-w-4xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">Classroom Access</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-100">Join Classroom by Enrollment Code</h1>
              <p className="mt-2 text-sm text-gray-300">
                Enter the code shared by your teacher or admin to join the right classroom instantly.
              </p>
            </div>
            <Link
              to="/classrooms"
              className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-600 bg-gray-800/70 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-700"
            >
              <IoArrowBackOutline />
              Back to Classrooms
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <form
            onSubmit={handleJoin}
            className="md:col-span-7 rounded-xl border border-gray-700 bg-gray-900/50 p-6"
          >
            <label className="mb-2 block text-sm text-gray-300">Enrollment Code</label>
            <div className="relative">
              <IoKeyOutline className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABC123"
                className="w-full rounded-lg border border-gray-600 bg-gray-800 py-2 pl-9 pr-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-100">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
              >
                {loading ? 'Joining Classroom...' : 'Join Classroom'}
              </button>
              <Link
                to="/classrooms"
                className="rounded-lg border border-gray-600 bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700"
              >
                Cancel
              </Link>
            </div>
          </form>

          <aside className="md:col-span-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-200">
              <IoPeopleOutline />
              Quick Notes
            </p>
            <ul className="mt-3 space-y-2 text-sm text-blue-100/90">
              <li>1. Codes are classroom-specific and case-insensitive.</li>
              <li>2. If the code is expired, ask your teacher/admin for a fresh one.</li>
              <li>3. After joining, use the dashboard to track assignments and announcements.</li>
            </ul>
          </aside>
        </div>
      </div>
    </GlassDashboardShell>
  );
};

export default JoinByCode;
