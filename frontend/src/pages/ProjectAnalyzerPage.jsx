import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import GlassDashboardShell from "../components/UI/GlassDashboardShell";
import AppBackButton from "../components/UI/AppBackButton";
import {
  FiUploadCloud, FiGithub, FiLoader, FiCheckCircle, FiAlertTriangle,
  FiCode, FiShield, FiZap, FiAward, FiList, FiTarget, FiCpu,
  FiChevronDown, FiChevronUp, FiX, FiRefreshCw,
} from "react-icons/fi";
import apiClient from "../services/apiClient";

const gradeColor = (grade) => ({
  "A+": "text-emerald-400", A: "text-emerald-400", "A-": "text-emerald-300",
  "B+": "text-blue-400", B: "text-blue-400", "B-": "text-blue-300",
  "C+": "text-amber-400", C: "text-amber-400", "C-": "text-amber-300",
  D: "text-orange-400", F: "text-red-400",
}[grade] ?? "text-gray-300");

const priorityBadge = (p) => ({
  High: "bg-red-500/10 text-red-400 border-red-500/20",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
}[(p || "")] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20");

const Section = ({ icon: Icon, title, color = "text-purple-400", children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="flex items-center gap-2.5 font-semibold text-white text-sm">
          <Icon size={15} className={color} /> {title}
        </span>
        {open ? <FiChevronUp size={14} className="text-gray-500" /> : <FiChevronDown size={14} className="text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
};

const ProjectAnalyzerPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState("zip");
  const [projectTopic, setProjectTopic] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [customRequirements, setCustomRequirements] = useState("");
  const [zipFile, setZipFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) setZipFile(f);
  };

  const handleAnalyze = async () => {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      let data;
      if (mode === "zip") {
        if (!zipFile) { setError("Please select a ZIP file."); setLoading(false); return; }
        const form = new FormData();
        form.append("file", zipFile);
        if (projectTopic.trim()) form.append("project_topic", projectTopic.trim());
        if (problemStatement.trim()) form.append("problem_statement", problemStatement.trim());
        if (customRequirements.trim()) form.append("custom_requirements", customRequirements.trim());
        data = await apiClient.post("/api/project-analyzer/analyze/zip", form);
      } else {
        if (!repoUrl.trim()) { setError("Please enter a GitHub repo URL."); setLoading(false); return; }
        const form = new FormData();
        form.append("repo_url", repoUrl.trim());
        form.append("branch", branch.trim() || "main");
        if (projectTopic.trim()) form.append("project_topic", projectTopic.trim());
        if (problemStatement.trim()) form.append("problem_statement", problemStatement.trim());
        if (customRequirements.trim()) form.append("custom_requirements", customRequirements.trim());
        data = await apiClient.post("/api/project-analyzer/analyze/github", form);
      }
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(""); setZipFile(null); setRepoUrl(""); };

  const renderResults = () => {
    if (!result) return null;
    const { executive_summary, final_verdict, requirements_mapping, what_user_built,
            code_quality, improvements, architecture_review, performance_security, recommendations, file_statistics } = result;

    return (
      <div className="space-y-4 mt-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Final Verdict</p>
              <h2 className="text-2xl font-extrabold text-white mb-1">{executive_summary?.description || "Project Analysis Complete"}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{executive_summary?.overall_assessment}</p>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Score</p>
                <p className="text-5xl font-black text-white">{final_verdict?.score ?? "—"}</p>
                <p className="text-xs text-gray-500">/100</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Grade</p>
                <p className={`text-5xl font-black ${gradeColor(final_verdict?.grade)}`}>{final_verdict?.grade || "—"}</p>
              </div>
            </div>
          </div>
          {final_verdict?.summary && <p className="relative mt-4 text-sm text-gray-300 border-t border-white/5 pt-4">{final_verdict.summary}</p>}
          {final_verdict?.next_steps && <p className="relative mt-2 text-xs text-blue-300"><span className="font-bold">Next steps:</span> {final_verdict.next_steps}</p>}
        </div>

        {file_statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
              <p className="text-2xl font-bold text-white">{file_statistics.total_files ?? 0}</p>
              <p className="text-xs text-gray-500">Total files</p>
            </div>
            {Object.entries(file_statistics.file_types || {}).slice(0, 3).map(([ext, count]) => (
              <div key={ext} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                <p className="text-2xl font-bold text-purple-400">{count}</p>
                <p className="text-xs text-gray-500">{ext || "unknown"} files</p>
              </div>
            ))}
          </div>
        )}

        <Section icon={FiTarget} title="Requirements Mapping" color="text-blue-400" defaultOpen={true}>
          <div className="space-y-2 mt-2">
            {(requirements_mapping || []).map((req, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-3">
                <span className={`mt-0.5 shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${req.implemented === "Yes" ? "bg-emerald-500/10 text-emerald-400" : req.implemented === "Partial" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>{req.implemented}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{req.requirement}</p>
                  {req.implementation_details && <p className="text-xs text-gray-400 mt-0.5">{req.implementation_details}</p>}
                  {req.missing_elements && <p className="text-xs text-red-400 mt-0.5">Missing: {req.missing_elements}</p>}
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityBadge(req.quality)}`}>{req.quality}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={FiCheckCircle} title="What You Built" color="text-emerald-400">
          <div className="grid md:grid-cols-3 gap-3 mt-2">
            {[
              { label: "Successful", items: what_user_built?.successful, color: "text-emerald-400", border: "border-emerald-500/20" },
              { label: "Missing", items: what_user_built?.missing, color: "text-red-400", border: "border-red-500/20" },
              { label: "Incomplete", items: what_user_built?.incomplete, color: "text-amber-400", border: "border-amber-500/20" },
            ].map(({ label, items, color, border }) => (
              <div key={label} className={`rounded-xl border ${border} bg-white/[0.01] p-3`}>
                <p className={`text-xs font-bold ${color} mb-2`}>{label}</p>
                <ul className="space-y-1">{(items || []).map((item, i) => <li key={i} className="text-xs text-gray-300">• {item}</li>)}</ul>
                {!(items || []).length && <li className="text-xs text-gray-600 italic">None</li>}
              </div>
            ))}
          </div>
        </Section>

        <Section icon={FiCode} title="Code Quality" color="text-purple-400">
          <div className="mt-2 space-y-3">
            {(code_quality?.strengths || []).length > 0 && (
              <div><p className="text-xs font-bold text-emerald-400 mb-2">Strengths</p><ul className="space-y-1">{code_quality.strengths.map((s, i) => <li key={i} className="text-xs text-gray-300">• {s}</li>)}</ul></div>
            )}
            {(code_quality?.weaknesses || []).length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-400 mb-2">Weaknesses</p>
                <div className="space-y-2">{code_quality.weaknesses.map((w, i) => (
                  <div key={i} className="rounded-lg border border-white/5 bg-white/[0.01] p-2.5">
                    <div className="flex items-center justify-between mb-1"><p className="text-xs font-semibold text-white">{w.issue}</p><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityBadge(w.impact)}`}>{w.impact}</span></div>
                    {w.location && <p className="text-[10px] text-gray-500 font-mono">{w.location}</p>}
                    {w.problem && <p className="text-xs text-gray-400 mt-1">{w.problem}</p>}
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        </Section>

        <Section icon={FiZap} title="Improvements" color="text-amber-400">
          <div className="space-y-2 mt-2">{(improvements || []).map((imp, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/[0.01] p-3">
              <div className="flex items-start justify-between gap-2 mb-1"><p className="text-xs font-semibold text-white">{imp.title}</p><span className={`text-[10px] shrink-0 font-bold px-1.5 py-0.5 rounded border ${priorityBadge(imp.priority)}`}>{imp.priority}</span></div>
              {imp.location && <p className="text-[10px] font-mono text-gray-500 mb-1">{imp.location}</p>}
              {imp.problem && <p className="text-xs text-gray-400 mb-1">{imp.problem}</p>}
              {imp.suggested_fix && <p className="text-xs text-blue-300"><span className="font-bold">Fix:</span> {imp.suggested_fix}</p>}
              {imp.effort_hours > 0 && <p className="text-[10px] text-gray-500 mt-1">~{imp.effort_hours}h effort</p>}
            </div>
          ))}</div>
        </Section>

        <Section icon={FiCpu} title="Architecture Review" color="text-blue-400">
          <div className="mt-2 grid md:grid-cols-2 gap-3">
            {[{ label: "Organization", value: architecture_review?.organization }, { label: "Scalability", value: architecture_review?.scalability }, { label: "Maintainability", value: architecture_review?.maintainability }].map(({ label, value }) => value ? (
              <div key={label} className="rounded-xl border border-white/5 bg-white/[0.01] p-3"><p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</p><p className="text-xs text-gray-300">{value}</p></div>
            ) : null)}
            {(architecture_review?.patterns_used || []).length > 0 && (
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3"><p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Patterns Used</p><div className="flex flex-wrap gap-1">{architecture_review.patterns_used.map((p, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">{p}</span>)}</div></div>
            )}
          </div>
        </Section>

        <Section icon={FiShield} title="Performance and Security" color="text-red-400">
          <div className="mt-2 grid md:grid-cols-2 gap-3">
            {[{ label: "Performance Issues", items: performance_security?.performance_issues, color: "text-amber-400" }, { label: "Security Concerns", items: performance_security?.security_concerns, color: "text-red-400" }].map(({ label, items, color }) => (
              <div key={label} className="rounded-xl border border-white/5 bg-white/[0.01] p-3">
                <p className={`text-xs font-bold ${color} mb-2`}>{label}</p>
                <ul className="space-y-1">{(items || []).map((item, i) => <li key={i} className="text-xs text-gray-300">• {item}</li>)}</ul>
                {!(items || []).length && <p className="text-xs text-gray-600 italic">None detected</p>}
              </div>
            ))}
          </div>
        </Section>

        <Section icon={FiList} title="Prioritized Recommendations" color="text-green-400">
          <div className="mt-2 space-y-3">
            {[{ label: "High Priority", items: recommendations?.high_priority, color: "text-red-400" }, { label: "Medium Priority", items: recommendations?.medium_priority, color: "text-amber-400" }, { label: "Low Priority", items: recommendations?.low_priority, color: "text-blue-400" }].map(({ label, items, color }) => (items || []).length ? (
              <div key={label}><p className={`text-xs font-bold ${color} mb-1.5`}>{label}</p><ul className="space-y-1">{items.map((r, i) => <li key={i} className="text-xs text-gray-300">• {r}</li>)}</ul></div>
            ) : null)}
          </div>
        </Section>

        <button onClick={reset} className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] py-3 text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors">
          <FiRefreshCw size={13} /> Analyze another project
        </button>
      </div>
    );
  };

  return (
    <GlassDashboardShell contentClassName="max-w-4xl">
      <div className="min-h-screen text-slate-100 py-6 px-4">
        <div className="mb-6"><AppBackButton fallbackTo="/dashboard" /></div>

        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-8 mb-8 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/5 pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400 mb-4">
              <FiCpu size={12} /> AI Code Analyzer
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Project Analyzer</h1>
            <p className="text-gray-400 text-sm max-w-xl leading-relaxed">Upload a ZIP file or paste a GitHub URL to get an AI-powered code review — requirements mapping, code quality, security, architecture, and a final score.</p>
          </div>
        </div>

        {!result && (
          <div className="space-y-6">
            <div className="flex rounded-xl border border-white/5 bg-white/[0.02] p-1 w-fit">
              {[{ id: "zip", icon: FiUploadCloud, label: "Upload ZIP" }, { id: "github", icon: FiGithub, label: "GitHub URL" }].map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setMode(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === id ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}><Icon size={14} /> {label}</button>
              ))}
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
              {mode === "zip" ? (
                <div className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all cursor-pointer ${dragging ? "border-purple-500 bg-purple-500/5" : "border-white/10 hover:border-white/20"}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={(e) => setZipFile(e.target.files[0])} />
                  {zipFile ? (
                    <div className="flex items-center gap-3">
                      <FiCheckCircle className="text-emerald-400 text-2xl" />
                      <div><p className="font-semibold text-white">{zipFile.name}</p><p className="text-xs text-gray-500">{(zipFile.size / 1024).toFixed(1)} KB</p></div>
                      <button onClick={(e) => { e.stopPropagation(); setZipFile(null); }} className="ml-4 text-gray-500 hover:text-red-400"><FiX /></button>
                    </div>
                  ) : (
                    <><FiUploadCloud className="text-4xl text-gray-600 mb-3" /><p className="text-sm font-semibold text-white">Drop your ZIP file here</p><p className="text-xs text-gray-500 mt-1">or click to browse</p></>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div><label className="block text-xs font-bold text-gray-400 mb-1.5">GitHub Repository URL <span className="text-red-400">*</span></label><input type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/username/repo" className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 transition-colors" /></div>
                  <div><label className="block text-xs font-bold text-gray-400 mb-1.5">Branch</label><input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 transition-colors" /></div>
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4 pt-2">
                <div><label className="block text-xs font-bold text-gray-400 mb-1.5">Project Topic</label><input value={projectTopic} onChange={(e) => setProjectTopic(e.target.value)} placeholder="e.g. E-commerce web app" className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 transition-colors" /></div>
                <div><label className="block text-xs font-bold text-gray-400 mb-1.5">Custom Requirements (comma-separated)</label><input value={customRequirements} onChange={(e) => setCustomRequirements(e.target.value)} placeholder="Auth system, REST API, Unit tests" className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 transition-colors" /></div>
              </div>
              <div><label className="block text-xs font-bold text-gray-400 mb-1.5">Problem Statement</label><textarea value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} placeholder="Describe the problem this project should solve..." rows={3} className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 transition-colors resize-none" /></div>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                <FiAlertTriangle className="shrink-0" /> {error}
                <button onClick={() => setError("")} className="ml-auto opacity-60 hover:opacity-100"><FiX size={12} /></button>
              </div>
            )}

            <button onClick={handleAnalyze} disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-600/20 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50">
              {loading ? <><FiLoader className="animate-spin" /> Analyzing project — this may take a minute...</> : <><FiAward size={15} /> Analyze Project</>}
            </button>
          </div>
        )}

        {renderResults()}
      </div>
    </GlassDashboardShell>
  );
};

export default ProjectAnalyzerPage;
