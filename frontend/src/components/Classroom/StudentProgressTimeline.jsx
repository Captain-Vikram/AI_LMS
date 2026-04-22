import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IoCheckmarkCircleOutline,
  IoLockClosedOutline,
  IoPulseOutline,
  IoSchoolOutline,
} from "react-icons/io5";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppBackButton from "../UI/AppBackButton";
import apiClient from "../../services/apiClient";
import IconsCarousel from "../IconsCarousel";

const getModuleId = (module) => String(module?.module_id || module?._id || "").trim();

const getStatusMeta = (status) => {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "text-emerald-300",
        icon: IoCheckmarkCircleOutline,
      };
    case "in_progress":
      return {
        label: "In Progress",
        className: "text-amber-300",
        icon: IoPulseOutline,
      };
    case "unlocked":
      return {
        label: "Unlocked",
        className: "text-cyan-300",
        icon: IoPulseOutline,
      };
    default:
      return {
        label: "Locked",
        className: "text-rose-300",
        icon: IoLockClosedOutline,
      };
  }
};

const StudentProgressTimeline = () => {
  const navigate = useNavigate();
  const { id: classroomId, studentId } = useParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("Student");
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadTimeline = async () => {
      if (!classroomId || !studentId) return;

      setLoading(true);
      setError("");

      try {
        const [rosterResponse, modulesResponse] = await Promise.all([
          apiClient.get(`/api/classroom/${classroomId}/members`),
          apiClient.get(`/api/classroom/${classroomId}/modules`),
        ]);

        if (!isMounted) return;

        const rosterStudents = Array.isArray(rosterResponse?.data?.students)
          ? rosterResponse.data.students
          : Array.isArray(rosterResponse?.students)
            ? rosterResponse.students
            : [];

        const selectedStudent = rosterStudents.find(
          (student) => String(student?.user_id || student?.id || "") === String(studentId)
        );
        setStudentName(selectedStudent?.name || "Student");

        const modules = Array.isArray(modulesResponse?.modules)
          ? modulesResponse.modules
          : Array.isArray(modulesResponse?.data)
            ? modulesResponse.data
            : [];

        const sortedModules = [...modules].sort(
          (first, second) => Number(first?.order || 0) - Number(second?.order || 0)
        );

        const progressPayload = await Promise.all(
          sortedModules.map(async (module) => {
            const moduleId = getModuleId(module);
            if (!moduleId) return null;

            const progress = await apiClient.get(
              `/api/student/progress/${moduleId}?student_id=${encodeURIComponent(
                studentId
              )}&classroom_id=${encodeURIComponent(classroomId)}`
            );

            return {
              module,
              moduleId,
              progress,
            };
          })
        );

        if (!isMounted) return;

        setTimeline(progressPayload.filter(Boolean));
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load student timeline");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTimeline();

    return () => {
      isMounted = false;
    };
  }, [classroomId, studentId]);

  const overallCompletion = useMemo(() => {
    if (timeline.length === 0) return 0;

    const ratios = timeline.map((item) => {
      const resources = Array.isArray(item?.progress?.resources) ? item.progress.resources : [];
      if (resources.length === 0) return 0;

      const completed = resources.filter((resource) => resource.status === "completed").length;
      return completed / resources.length;
    });

    const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    return Math.round(average * 100);
  }, [timeline]);

  const chartData = useMemo(() => {
    let completed = 0, inProgress = 0, locked = 0;
    const scoresData = [];
    const attemptsData = [];

    timeline.forEach((entry, idx) => {
      const moduleName = entry.module?.title || entry.module?.name || `M${idx + 1}`;
      const shortName = moduleName.length > 15 ? moduleName.slice(0, 12) + "..." : moduleName;
      
      let moduleScoreSum = 0;
      let scoredResources = 0;
      let totalAttempts = 0;

      const resources = Array.isArray(entry.progress?.resources) ? entry.progress.resources : [];
      resources.forEach((r) => {
        if (r.status === "completed") completed++;
        else if (r.status === "in_progress") inProgress++;
        else locked++;

        if (r.highest_score != null) {
          moduleScoreSum += Number(r.highest_score);
          scoredResources++;
        }
        totalAttempts += Number(r.tests_taken || 0);
      });

      scoresData.push({
        module: shortName,
        score: scoredResources > 0 ? Math.round(moduleScoreSum / scoredResources) : 0,
      });

      attemptsData.push({
        module: shortName,
        attempts: totalAttempts,
      });
    });

    const statusData = [
      { name: 'Completed', value: completed, color: '#10b981' },
      { name: 'In Progress', value: inProgress, color: '#06b6d4' },
      { name: 'Locked', value: locked, color: '#475569' },
    ].filter(d => d.value > 0);

    return { statusData, scoresData, attemptsData };
  }, [timeline]);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 text-gray-200">
        <p>Loading student timeline...</p>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen px-4 py-12 pt-28">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <IconsCarousel backgroundColor="rgba(7, 8, 22, 0.95)" iconColor="indigo-500/10" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#070816]/90 via-[#09091e]/95 to-[#0b0e22]/90" />
      </div>

      <div className="container mx-auto relative z-10 max-w-7xl space-y-6">
        {/* ── HERO ── */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#070816] via-[#09091e] to-[#0b0e22] shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage:'radial-gradient(#818cf8 1px,transparent 1px)', backgroundSize:'22px 22px' }} />
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
          
          <div className="pointer-events-none absolute right-8 top-12 hidden h-28 w-28 lg:block opacity-[0.25]">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 drop-shadow-lg">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#818cf8" strokeWidth="8" strokeOpacity="0.25"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="#818cf8" strokeWidth="8"
                strokeDasharray={`${(overallCompletion/100)*263.89} 263.89`} strokeLinecap="round"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-white">{overallCompletion}%</span>
          </div>

          <div className="relative px-6 pt-6 pb-6 space-y-4">
            <AppBackButton
              label="Back to Roster"
              fallbackTo={`/classroom/${classroomId}/roster`}
            />
            <div className="pt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/[0.09] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400">
                <IoSchoolOutline size={14} /> Student Progress Radar
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl leading-tight">{studentName}</h1>
              <p className="mt-1.5 text-sm font-medium tracking-wide text-slate-400">Live Analytics and Module Timeline</p>
            </div>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-200 shadow-md">
            {error}
          </p>
        ) : null}

        {/* ── ANALYTICS CHARTS ── */}
        {timeline.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Resource Status Pie */}
            <div className="flex flex-col rounded-3xl border border-white/[0.07] bg-[#0f1623]/90 p-5 shadow-2xl backdrop-blur-md">
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Resource Distribution</p>
              <div className="flex-1 min-h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      stroke="rgba(0,0,0,0)"
                      paddingAngle={4}
                    >
                      {chartData.statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0b1220', borderColor: 'rgba(148, 163, 184, 0.2)', color: '#e2e8f0', borderRadius:'12px', fontSize:'12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 border-t border-white/[0.05] pt-3 px-2">
                {chartData.statusData.map((d) => (
                  <div key={d.name} className="flex justify-between items-center text-xs">
                     <span className="flex items-center gap-2 text-slate-400 font-medium">
                       <span className="h-2.5 w-2.5 rounded-full shadow-inner" style={{backgroundColor: d.color}} /> {d.name}
                     </span>
                     <span className="font-bold text-slate-200">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scores Line Chart */}
            <div className="flex flex-col rounded-3xl border border-white/[0.07] bg-[#0f1623]/90 p-5 shadow-2xl backdrop-blur-md lg:col-span-2">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Score Progression Trend</p>
              <div className="flex-1 w-full min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.scoresData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="module" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0b1220', borderColor: 'rgba(148, 163, 184, 0.2)', color: '#e2e8f0', borderRadius:'12px', fontSize:'12px' }}
                      itemStyle={{ color: '#34d399' }}
                      formatter={(value) => [`${value} Pts`, 'Avg Module Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#34d399"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#0b1220', stroke: '#34d399', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#34d399', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Test Attempts Bar Chart (Heatmap Flow) */}
            <div className="flex flex-col rounded-3xl border border-white/[0.07] bg-[#0f1623]/90 p-5 shadow-2xl backdrop-blur-md lg:col-span-3">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-500">Student Struggle Heatmap (Test Attempts per Module)</p>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.attemptsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="module" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: '#0b1220', borderColor: 'rgba(148, 163, 184, 0.2)', color: '#e2e8f0', borderRadius:'12px', fontSize:'12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                      formatter={(value) => [value, 'Total Checkpoint Retries']}
                    />
                    <Bar dataKey="attempts" fill="#818cf8" radius={[6, 6, 0, 0]}>
                      {chartData.attemptsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.attempts > 5 ? '#f43f5e' : entry.attempts > 2 ? '#fbbf24' : '#818cf8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex gap-4 border-t border-white/[0.05] px-2 pt-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 justify-center">
                 <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-[#818cf8]" /> Low Struggle</span>
                 <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-[#fbbf24]" /> Moderate Retries</span>
                 <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-[#f43f5e]" /> High Struggle</span>
              </div>
            </div>
          </div>
        )}

        {/* ── TIMELINE MODULES ── */}
        <div className="space-y-6">
          {timeline.map((entry, index) => {
            const module = entry.module || {};
            const progress = entry.progress || {};
            const resources = Array.isArray(progress.resources) ? progress.resources : [];

            return (
              <div key={entry.moduleId} className="rounded-3xl border border-white/[0.07] bg-[#0f1623]/90 p-5 md:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-500/5 blur-2xl" />
                
                <div className="mb-5 flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-white/[0.05] pb-5">
                  <div className="flex-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Module {index + 1}</span>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-1.5">{module.name || module.title || "Module"}</h2>
                    <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">{module.description || "No description provided."}</p>
                  </div>
                  <div className="shrink-0 flex items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 shadow-inner">
                    <span className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">
                      Assessment: <span className={progress?.final_assessment?.status === "completed" ? "text-emerald-400" : "text-white"}>{progress?.final_assessment?.status || "PENDING"}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {resources.map((resource) => {
                    const meta = getStatusMeta(resource.status);
                    return (
                      <div
                        key={resource.resource_id}
                        className="flex flex-col justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 hover:border-white/[0.1] hover:bg-white/[0.04] transition-all duration-200"
                      >
                         <div className="flex items-start justify-between gap-3 mb-4">
                           <p className="text-sm font-semibold text-slate-200 leading-snug line-clamp-2">{resource.resource_title}</p>
                           <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                             resource.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                             resource.status === 'in_progress' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                             'border-slate-500/20 bg-slate-500/10 text-slate-500'
                           }`}>
                             {meta.label}
                           </span>
                         </div>
                         
                         <div className="space-y-1.5 mt-auto">
                           <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-white/[0.05] pb-1.5 mb-1.5">Learning Stats</p>
                           <div className="flex justify-between items-center">
                             <span className="text-xs font-medium text-slate-400">Total Attempts</span>
                             <span className="text-xs font-bold text-slate-200 bg-white/5 px-2 py-0.5 rounded-md">{resource.tests_taken || 0}</span>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-xs font-medium text-slate-400">Checkpoints</span>
                             <span className="text-xs font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md">{resource.passed_tests_count || 0}/2</span>
                           </div>
                           {resource.highest_score != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-400">Apex Mastery</span>
                                <span className="text-xs font-extrabold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{Math.round(Number(resource.highest_score))} Pts</span>
                              </div>
                           )}
                         </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {timeline.length === 0 && !error ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center bg-white/[0.01]">
              <p className="text-sm font-semibold tracking-wide text-slate-400">
                No learning data has been recorded for this student yet.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default StudentProgressTimeline;
