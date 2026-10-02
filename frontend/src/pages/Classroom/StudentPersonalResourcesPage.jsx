import React, { useEffect, useMemo, useState, useRef } from 'react';

const toSafeFileName = (value) =>
  String(value || 'study-report')
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'study-report';

import { useNavigate, useParams } from 'react-router-dom';
import {
  LuBookOpen,
  LuSparkles,
  LuPlus,
  LuTrash2,
  LuSearch,
  LuFolder,
  LuFileText,
  LuLink,
  LuUpload,
  LuCornerDownLeft,
  LuArrowLeft,
  LuCircleHelp,
  LuSettings,
  LuRefreshCw,
  LuVolume2,
  LuMoon,
  LuSun,
  LuPlay,
  LuCpu,
  LuBook,
  LuCheck,
  LuMic,
  LuFileSpreadsheet,
  LuBrainCircuit,
  LuDownload,
  LuInfo,
  LuPencil,
  LuActivity
} from 'react-icons/lu';
import { IoLogoYoutube } from 'react-icons/io5';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';
import AppBackButton from '../../components/UI/AppBackButton';
import apiClient from '../../services/apiClient';
import IconsCarousel from '../../components/IconsCarousel';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

const PORTABLE_RAG_PREFIX = '/api/portable-rag';
const portablePath = (path) => `${PORTABLE_RAG_PREFIX}${path}`;

const parseInline = (text) => {
  if (typeof text !== 'string') return text;
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <strong key={i} style={{ fontWeight: '600', color: '#fff' }}>{part}</strong>;
    }
    const subParts = part.split(/`([^`]+)`/g);
    return subParts.map((subPart, j) => {
      if (j % 2 === 1) {
        return <code key={j} style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#5B8CFF', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.85em' }}>{subPart}</code>;
      }
      return subPart;
    });
  });
};

const renderMarkdown = (text) => {
  if (!text || typeof text !== 'string') return '';
  const lines = text.split('\n');
  
  const sections = [];
  let currentSection = { header: null, content: [] };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
      if (currentSection.header || currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { header: line, content: [] };
    } else {
      currentSection.content.push(line);
    }
  }
  if (currentSection.header || currentSection.content.length > 0) {
    sections.push(currentSection);
  }
  
  return sections.map((sec, secIdx) => {
    let headerText = '';
    if (sec.header) {
      if (sec.header.startsWith('### ')) headerText = sec.header.slice(4);
      else if (sec.header.startsWith('## ')) headerText = sec.header.slice(3);
      else if (sec.header.startsWith('# ')) headerText = sec.header.slice(2);
    }
    
    let SectionIcon = null;
    let sectionStyle = 'border-l-indigo-500 bg-white/[0.02]';
    const lowerHeader = headerText.toLowerCase();
    
    if (lowerHeader.includes('summary')) {
      SectionIcon = () => <LuSparkles className="mr-2.5 text-indigo-400" size={15} />;
      sectionStyle = 'border-l-[#7C5CFF] bg-[#7C5CFF]/[0.02]';
    } else if (lowerHeader.includes('overview')) {
      SectionIcon = () => <LuBookOpen className="mr-2.5 text-sky-400" size={15} />;
      sectionStyle = 'border-l-[#5B8CFF] bg-[#5B8CFF]/[0.02]';
    } else if (lowerHeader.includes('component') || lowerHeader.includes('functionality')) {
      SectionIcon = () => <LuSettings className="mr-2.5 text-purple-400" size={15} />;
      sectionStyle = 'border-l-purple-500 bg-purple-500/[0.02]';
    } else if (lowerHeader.includes('insight')) {
      SectionIcon = () => <LuActivity className="mr-2.5 text-emerald-400" size={15} />;
      sectionStyle = 'border-l-emerald-500 bg-emerald-500/[0.02]';
    } else if (lowerHeader.includes('recommend') || lowerHeader.includes('checklist') || lowerHeader.includes('takeaway')) {
      SectionIcon = () => <LuCircleHelp className="mr-2.5 text-amber-400" size={15} />;
      sectionStyle = 'border-l-amber-500 bg-amber-500/[0.02]';
    }
    
    const renderedContent = sec.content.map((cLine, cIdx) => {
      const cleanLine = cLine.trim();
      if (!cleanLine) return <div key={cIdx} className="h-2.5" />;
      
      if (cLine.startsWith('- ') || cLine.startsWith('* ')) {
        return (
          <ul key={cIdx} className="list-disc pl-5 my-1 text-slate-300">
            <li className="text-[13.5px] leading-relaxed font-normal">{parseInline(cLine.slice(2))}</li>
          </ul>
        );
      }
      
      return (
        <p key={cIdx} className="text-[13.5px] leading-relaxed text-slate-300 my-2">
          {parseInline(cLine)}
        </p>
      );
    });
    
    if (headerText) {
      return (
        <div key={secIdx} className={`my-4 p-4 rounded-xl border border-white/5 border-l-3 ${sectionStyle} shadow-sm transition-all duration-200 hover:border-white/10`}>
          <h4 className="flex items-center text-[13.5px] font-semibold text-white mb-2 tracking-wide uppercase">
            {SectionIcon && <SectionIcon />}
            {headerText}
          </h4>
          <div className="space-y-0.5">{renderedContent}</div>
        </div>
      );
    }
    
    return <div key={secIdx} className="my-2 space-y-0.5">{renderedContent}</div>;
  });
};

const DEFAULT_WORKSPACE_SHELL_OFFSET_PX = 150;
const WORKSPACE_SHELL_TOP_PADDING_PX = 100;
const WORKSPACE_SHELL_BOTTOM_PADDING_PX = 32;
const NAVBAR_SELECTOR = '[data-app-navbar="true"]';

const getWorkspaceShellOffsetPx = () => {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_SHELL_OFFSET_PX;
  const navbar = document.querySelector(NAVBAR_SELECTOR);
  if (!navbar) return WORKSPACE_SHELL_TOP_PADDING_PX + WORKSPACE_SHELL_BOTTOM_PADDING_PX;
  const navbarRect = navbar.getBoundingClientRect();
  const navbarBottom = Math.ceil(navbarRect.top + navbarRect.height);
  const topOffsetPx = Math.max(WORKSPACE_SHELL_TOP_PADDING_PX, navbarBottom);
  return Math.ceil(topOffsetPx + WORKSPACE_SHELL_BOTTOM_PADDING_PX);
};

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message, index) => {
      if (typeof message === 'string') {
        return { id: `msg-${index}`, role: index % 2 === 0 ? 'user' : 'assistant', content: message };
      }
      const role = message?.role || message?.sender || (message?.answer ? 'assistant' : 'user');
      const content = message?.content || message?.message || message?.answer || message?.text || '';
      return { id: message?.id || `msg-${index}`, role: role === 'assistant' ? 'assistant' : 'user', content };
    })
    .filter((m) => m.content);
};

const extractJsonObject = (rawText) => {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;
  const sanitized = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(sanitized);
  } catch {
    const start = sanitized.indexOf('{');
    const end = sanitized.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(sanitized.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

const normalizeGeneratedQuiz = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
  if (!rawQuestions.length) return null;
  
  const questions = rawQuestions.map((question, index) => {
    const resolvedQuestion = question?.question || question?.question_text || `Question ${index + 1}`;
    const options = Array.isArray(question?.options) ? question.options : [];
    const resolvedType = question?.type || (options.length ? 'mcq' : 'short_answer');
    return {
      id: question?.id || `q-${index + 1}`,
      type: resolvedType,
      question: resolvedQuestion,
      options,
      answer: question?.answer || question?.correct_answer || '',
      explanation: question?.explanation || question?.rationale || '',
    };
  });
  return {
    title: payload.title || 'Generated Quiz',
    instructions: payload.instructions || 'Review each question and validate with your notes.',
    questions,
  };
};

const deriveLearnerProfile = (messages = [], latestMessage = '') => {
  const recentUserMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m?.role === 'user' && typeof m?.content === 'string' && m.content.trim())
    .slice(-6)
    .map((m) => m.content.trim());
  const sample = [...recentUserMessages, String(latestMessage || '').trim()].filter(Boolean).join(' ');
  const avgWords = recentUserMessages.length
    ? recentUserMessages.reduce((sum, text) => sum + text.split(/\s+/).filter(Boolean).length, 0) / recentUserMessages.length
    : sample.split(/\s+/).filter(Boolean).length;
  
  const tone = /\b(pls|plz|bro|sis|ya|u|btw|lol|hey|thx|thanks)\b/i.test(sample) ? 'friendly and conversational' : 'professional and supportive';
  const complexity = /\b(simple|easy|beginner|basic|eli5)\b/i.test(sample)
    ? 'beginner-friendly'
    : /\b(advanced|deep|detailed|technical|in depth)\b/i.test(sample)
      ? 'advanced'
      : avgWords <= 10 ? 'simple' : avgWords >= 22 ? 'detailed' : 'intermediate';
  const brevity = /\b(short|brief|quick|summary|tldr)\b/i.test(sample) ? 'concise' : 'balanced';
  return { tone, complexity, brevity };
};

const buildAdaptiveInstruction = (messages = [], latestMessage = '') => {
  const profile = deriveLearnerProfile(messages, latestMessage);
  return [
    `[ADAPTIVE AI STATE: Tone=${profile.tone}, Complexity=${profile.complexity}, Brevity=${profile.brevity}]`,
    '- Synthesize your answers using strictly the uploaded sources in this workspace.',
    '- Provide headers, bullet lists, or bolding where appropriate to maximize readability.'
  ].join('\n');
};

const Styles = () => (
  <style>{`
    :root {
      --bg-gradient: linear-gradient(180deg, #0A1020 0%, #121826 100%);
      --primary:     #7C5CFF;
      --accent:      #5B8CFF;
      --success:     #22C55E;
      --warning:     #F59E0B;
      --card-bg:     rgba(255, 255, 255, 0.04);
      --border:      rgba(255, 255, 255, 0.06);
      --border-hi:   rgba(255, 255, 255, 0.12);
      --muted:       #94A3B8;
      --text:        #F8FAFC;
      --text-dim:    #CBD5E1;
      --glow:        rgba(124, 92, 255, 0.15);
    }
    
    .nb-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .nb-scroll::-webkit-scrollbar-track { background: transparent; }
    .nb-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 99px; }
    .nb-scroll:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); }
    .nb-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.18); }
    .scrollbar-none::-webkit-scrollbar { display: none; }
    .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
    
    .nb-animate-fade {
      animation: nbFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes nbFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `}</style>
);

const DashboardView = ({
  // eslint-disable-next-line no-unused-vars
  notebooks, sortedNotebooks, dashboardLoading, dashboardError, dashboardInfo,
  newNotebookName, setNewNotebookName, newNotebookDescription, setNewNotebookDescription,
  creatingNotebook, createNotebook, deleteNotebook, refreshNotebooks,
  classroomId, navigate,
}) => (
  <GlassDashboardShell withPanel={false} contentClassName="max-w-[1240px]">
    <div className="nb-root relative min-h-screen text-slate-100" style={{ padding: '24px 16px', zIndex: 1 }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}>
        <IconsCarousel backgroundColor="rgba(10, 16, 32, 0.95)" iconColor="gray-500/10" />
      </div>
      <Styles />

      <div className="mb-6">
        <AppBackButton fallbackTo={`/classroom/${classroomId}/dashboard`} />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-8 mb-8 nb-animate-fade shadow-xl shadow-black/25">
        <div className="absolute inset-0 bg-gradient-to-r from-[#7C5CFF]/10 to-[#5B8CFF]/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 px-3 py-1 text-xs font-semibold text-[#7C5CFF] mb-4">
            <LuSparkles size={13} /> Personal Study Space
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2 leading-tight">
            Your personal <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C5CFF] to-[#5B8CFF]">NotebookLM</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl leading-relaxed">
            Upload learning materials, import videos or websites, and chat with an AI copilot fully grounded in your custom sources.
          </p>
          <div className="flex gap-3 mt-6">
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-gray-200 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white" onClick={() => navigate(`/classroom/${classroomId}/modules`)}>
              <LuBookOpen size={15} /> Learning Modules
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-lg shadow-black/15 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Create Notebook</h2>
            <p className="text-xs text-slate-400 mb-6">Create a private space to group study resources.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notebook Name</label>
                <input
                  className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-[#7C5CFF]/60 focus:ring-1 focus:ring-[#7C5CFF]/30"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  placeholder="e.g. Midterm Preparation"
                  onKeyDown={(e) => e.key === 'Enter' && createNotebook()}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                <textarea
                  className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-[#7C5CFF]/60 focus:ring-1 focus:ring-[#7C5CFF]/30 resize-none"
                  rows={3}
                  value={newNotebookDescription}
                  onChange={(e) => setNewNotebookDescription(e.target.value)}
                  placeholder="Briefly state the goal..."
                />
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <button 
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C5CFF] to-[#5B8CFF] py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C5CFF]/20 transition-all duration-200 hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              onClick={createNotebook} 
              disabled={creatingNotebook}
            >
              <LuPlus size={16} /> {creatingNotebook ? 'Creating...' : 'Create Notebook'}
            </button>
            {(dashboardError || dashboardInfo) && (
              <p className={`text-xs text-center ${dashboardError ? 'text-rose-400' : 'text-emerald-400'}`}>
                {dashboardError || dashboardInfo}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Saved Notebooks</h2>
            <button className="p-2 text-slate-400 hover:text-white transition-colors" onClick={refreshNotebooks} disabled={dashboardLoading}>
              <LuRefreshCw size={15} className={dashboardLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {dashboardLoading ? (
            <div className="py-20 text-center text-slate-500 text-sm">Loading notebooks...</div>
          ) : sortedNotebooks.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
              <LuFolder size={32} className="mx-auto text-slate-500 mb-3" />
              <p className="text-slate-400 text-sm">No notebooks created yet. Build one on the left to start importing.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedNotebooks.map((nb) => (
                <div key={nb.id} className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-md shadow-black/10 transition-all duration-250 hover:border-white/15 hover:bg-white/[0.04] hover:-translate-y-0.5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#7C5CFF]/20 to-[#5B8CFF]/15 border border-[#7C5CFF]/30 flex items-center justify-center">
                        <LuBookOpen size={16} className="text-[#5B8CFF]" />
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 transition-all"
                        onClick={(e) => { e.stopPropagation(); deleteNotebook(nb.id); }}
                        title="Delete notebook"
                      >
                        <LuTrash2 size={14} />
                      </button>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-[#5B8CFF] transition-colors">{nb.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-4 h-8">{nb.description || 'No description added'}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-[10px] font-medium text-slate-500">
                      {new Date(nb.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5B8CFF] hover:text-white transition-colors"
                      onClick={() => navigate(`/classroom/${classroomId}/personal-resources/notebook/${nb.id}`)}
                    >
                      Open Workspace <LuPlay size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </GlassDashboardShell>
);

const WorkspaceView = ({
  // eslint-disable-next-line no-unused-vars
  notebookDetail, workspaceLoading, workspaceError, chatError, sourceActionError,
  sources, chatMessages, chatInput, setChatInput, sendingChat, sendMessage,
  sourceTitle, setSourceTitle, sourceText, setSourceText, sourceUrl, setSourceUrl,
  sourceFile, setSourceFile, sourceActionLoading, addTextSource, addUrlSource, addFileSource, removeSource,
  // eslint-disable-next-line no-unused-vars
  health, models, vectorStats, searchQuery, setSearchQuery, searchResults, searchLoading, studioMessage,
  // eslint-disable-next-line no-unused-vars
  podcastEpisodeName, setPodcastEpisodeName, podcastLoading, podcastJob, generatePodcast, refreshPodcastJob,
  // eslint-disable-next-line no-unused-vars
  quizLoading, generatedQuiz, generatedQuizRaw, generateCombinedQuiz,
  // eslint-disable-next-line no-unused-vars
  reportTopic, setReportTopic, reportLoading, reportText, generateTopicReport, downloadTopicReport,
  // eslint-disable-next-line no-unused-vars
  audioBriefing, setAudioBriefing, audioLoading, audioOverview, generateAudioPodcast, refreshAudioOverview,
  // eslint-disable-next-line no-unused-vars
  selectedProvider, setSelectedProvider, selectedModel, setSelectedModel,
  isRecording, transcribingVoice, startVoiceRecording, stopVoiceRecording,
  // eslint-disable-next-line no-unused-vars
  runSearch, initializeVectorDb, refreshWorkspace, notebookId, classroomId, navigate,
}) => {
  const chatEndRef = useRef(null);
  const [activeAddTab, setActiveAddTab] = useState('text');
  const [workspaceShellOffsetPx, setWorkspaceShellOffsetPx] = useState(() => getWorkspaceShellOffsetPx());
  const [sourcePopoverOpen, setSourcePopoverOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('chat');

  useEffect(() => {
    const handleResize = () => setWorkspaceShellOffsetPx(getWorkspaceShellOffsetPx());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, sendingChat]);

  const handleSuggestionClick = (chip) => {
    if (chip.action === 'quiz') {
      generateCombinedQuiz();
    } else {
      setChatInput(chip.text);
    }
  };

  const suggestions = [
    { text: 'Explain key ideas simply', icon: <LuBrainCircuit size={13} /> },
    { text: 'Summarize all resources', icon: <LuSparkles size={13} /> },
    { text: 'Verify core formulas/facts', icon: <LuCheck size={13} /> },
    { text: 'Generate Quiz', action: 'quiz', icon: <LuBookOpen size={13} /> }
  ];

  return (
    <GlassDashboardShell withPanel={false} contentClassName="w-full lg:max-w-[96vw] 2xl:max-w-[1780px]">
      <div
        className="relative overflow-hidden rounded-none lg:rounded-2xl border-x-0 lg:border border-y-0 lg:border-y border-white/5 bg-[#0B1020]/95 backdrop-blur-md shadow-2xl flex flex-col text-slate-100"
        style={{
          height: `calc(100dvh - ${workspaceShellOffsetPx}px)`,
          maxHeight: `calc(100dvh - ${workspaceShellOffsetPx}px)`,
          minHeight: 0,
        }}
      >
        <Styles />
        
        <div className="absolute top-[20%] left-[45%] -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#7C5CFF]/[0.02] blur-[120px] pointer-events-none" />

        <header className="h-14 border-b border-white/5 bg-slate-950/20 px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3.5">
            <AppBackButton fallbackTo={`/classroom/${classroomId}/personal-resources`} />
            <div className="w-px h-4 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] font-medium tracking-wide text-slate-500 flex items-center gap-1">
                My Workspace <span className="text-[9px]">/</span> Personal Resources
              </span>
              <h2 className="text-xs font-bold text-white flex items-center gap-1">
                {notebookDetail?.name || 'Loading Notebook...'}
                <LuPencil className="text-slate-500 cursor-pointer hover:text-white transition-colors" size={11} />
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all" onClick={() => refreshWorkspace(notebookId)}>
              <LuRefreshCw size={12} className={workspaceLoading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all" onClick={() => navigate(`/classroom/${classroomId}/modules`)}>
              <LuBookOpen size={12} /> Modules
            </button>
          </div>
        </header>

        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden bg-slate-900/30 p-1 border-b border-white/5 flex-shrink-0">
          {['sources', 'chat', 'studio'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveMobileTab(tab)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold tracking-wide uppercase transition-all duration-205 ${
                activeMobileTab === tab
                  ? 'bg-gradient-to-r from-[#7C5CFF] to-[#5B8CFF] text-white shadow-md shadow-[#7C5CFF]/15'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'sources' && <LuFileText size={12} />}
              {tab === 'chat' && <LuSparkles size={12} />}
              {tab === 'studio' && <LuSettings size={12} />}
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          
          {workspaceLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <LuRefreshCw className="animate-spin text-[#7C5CFF]" size={20} />
              Loading notebook files and vector store...
            </div>
          ) : (
            <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-[20%_64%_16%] overflow-hidden h-full">

              <aside className={`${activeMobileTab === 'sources' ? 'flex' : 'hidden'} lg:flex border-r border-white/5 flex-col min-h-0 bg-slate-950/10 z-10 w-full lg:w-auto`}>
                
                <div className="p-4 border-b border-white/5 flex-shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LuFileText className="text-[#5B8CFF]" size={15} />
                    <span className="text-xs font-semibold text-white">Sources</span>
                    <span className="text-[10px] font-bold bg-[#7C5CFF]/15 text-[#7C5CFF] border border-[#7C5CFF]/20 px-1.5 py-0.5 rounded-full">
                      {sources.length}
                    </span>
                  </div>
                </div>

                <div className="p-4 border-b border-white/5 bg-slate-900/10 flex-shrink-0">
                  <button
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C5CFF] to-[#5B8CFF] py-2.5 text-xs font-semibold text-white shadow-md shadow-[#7C5CFF]/10 transition-all hover:scale-[1.01] hover:brightness-110"
                    onClick={() => setSourcePopoverOpen(!sourcePopoverOpen)}
                  >
                    <LuPlus size={14} /> Add Source
                  </button>

                  <AnimatePresence>
                    {sourcePopoverOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="mt-3 p-3 rounded-xl border border-white/5 bg-slate-950/80 backdrop-blur-md space-y-3"
                      >
                        <div className="flex gap-1.5 bg-slate-900 p-0.5 rounded-lg">
                          {['text', 'url', 'file'].map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setActiveAddTab(tab)}
                              className={`flex-1 text-[10px] font-medium py-1 rounded-md transition-colors capitalize ${
                                activeAddTab === tab ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>

                        <input
                          className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-slate-600 outline-none"
                          value={sourceTitle}
                          onChange={(e) => setSourceTitle(e.target.value)}
                          placeholder="Source title (optional)"
                        />

                        {activeAddTab === 'text' && (
                          <div className="space-y-2">
                            <textarea
                              className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[11px] text-white placeholder-slate-600 outline-none resize-none"
                              rows={3}
                              value={sourceText}
                              onChange={(e) => setSourceText(e.target.value)}
                              placeholder="Paste text notes..."
                            />
                            <button className="w-full py-1.5 bg-[#7C5CFF] rounded-lg text-[10px] font-bold text-white hover:brightness-110 disabled:opacity-50" onClick={() => { addTextSource(); setSourcePopoverOpen(false); }} disabled={sourceActionLoading}>
                              Create Note
                            </button>
                          </div>
                        )}

                        {activeAddTab === 'url' && (
                          <div className="space-y-2">
                            <input
                              className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-slate-600 outline-none"
                              value={sourceUrl}
                              onChange={(e) => setSourceUrl(e.target.value)}
                              placeholder="https://..."
                            />
                            <button className="w-full py-1.5 bg-[#7C5CFF] rounded-lg text-[10px] font-bold text-white hover:brightness-110 disabled:opacity-50" onClick={() => { addUrlSource(); setSourcePopoverOpen(false); }} disabled={sourceActionLoading}>
                              Fetch URL
                            </button>
                          </div>
                        )}

                        {activeAddTab === 'file' && (
                          <div className="space-y-2">
                            <div className="border border-dashed border-white/10 rounded-lg p-2.5 text-center bg-slate-900/40">
                              <input type="file" onChange={(e) => setSourceFile(e.target.files?.[0] || null)} className="text-[10px] text-slate-400 w-full" />
                            </div>
                            <button className="w-full py-1.5 bg-[#7C5CFF] rounded-lg text-[10px] font-bold text-white hover:brightness-110 disabled:opacity-50" onClick={() => { addFileSource(); setSourcePopoverOpen(false); }} disabled={!sourceFile || sourceActionLoading}>
                              Upload File
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 nb-scroll">
                  {sources.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      <LuFileText className="mx-auto text-slate-600 mb-2" size={20} />
                      <p className="text-[11px]">No sources added yet.</p>
                    </div>
                  ) : (
                    sources.map((src) => {
                      let SourceIcon = LuFileText;
                      let iconColor = 'text-sky-400';
                      if (src.source_type?.toLowerCase() === 'youtube') {
                        SourceIcon = IoLogoYoutube;
                        iconColor = 'text-rose-500';
                      } else if (src.source_type?.toLowerCase() === 'url') {
                        SourceIcon = LuLink;
                        iconColor = 'text-emerald-400';
                      } else if (src.source_type?.toLowerCase() === 'text') {
                        SourceIcon = LuBook;
                        iconColor = 'text-amber-400';
                      }
                      
                      return (
                        <div
                          key={src.id}
                          className="group relative rounded-xl border border-white/5 bg-white/[0.01] p-3 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.03]"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="mt-0.5 flex-shrink-0">
                                <SourceIcon className={iconColor} size={13} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-[11.5px] font-semibold text-white leading-snug truncate pr-4" title={src.title}>
                                  {src.title}
                                </h4>
                                <span className="block text-[10px] text-slate-500 mt-0.5 capitalize">
                                  {src.source_type} · {src.chunk_count} chunk{src.chunk_count !== 1 && 's'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeSource(src.id)}
                              className="opacity-0 group-hover:opacity-100 absolute right-2.5 top-2.5 p-1 text-slate-500 hover:text-rose-400 transition-all"
                              title="Delete source"
                            >
                              <LuTrash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </aside>

              <main className={`${activeMobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 bg-slate-950/20 relative w-full lg:w-auto`}>
                
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 nb-scroll">
                  {chatMessages.length === 0 ? (
                    <div className="max-w-md mx-auto my-auto py-20 text-center flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-[#7C5CFF] to-[#5B8CFF] flex items-center justify-center shadow-lg shadow-[#7C5CFF]/15 mb-4">
                        <LuSparkles className="text-white" size={20} />
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">Notebook Grounded Copilot</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Start questioning your workspace! The AI answers will draw directly from your custom notes, files, and URLs.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] ${
                          msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <>
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#7C5CFF] to-[#5B8CFF] flex items-center justify-center flex-shrink-0 shadow-md">
                              <LuSparkles className="text-white" size={13} />
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-lg shadow-black/10">
                              <div className="prose prose-invert max-w-none text-slate-200">
                                {renderMarkdown(msg.content)}
                              </div>
                              {msg.citationCount > 0 && (
                                <div className="mt-3.5 pt-3.5 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-[#5B8CFF] font-semibold">
                                  <LuCheck size={12} />
                                  Grounded in {msg.citationCount} source chunk{msg.citationCount > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="rounded-2xl bg-gradient-to-br from-[#7C5CFF] to-[#5B8CFF] px-4 py-3 text-slate-100 text-[13.5px] leading-relaxed font-medium shadow-md shadow-[#7C5CFF]/10">
                            {msg.content}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {sendingChat && (
                    <div className="flex gap-3 max-w-[80%] mr-auto items-center">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#7C5CFF] to-[#5B8CFF] flex items-center justify-center flex-shrink-0 shadow-md">
                        <LuSparkles className="text-white" size={13} />
                      </div>
                      <div className="inline-flex gap-1.5 items-center p-3 rounded-2xl border border-white/5 bg-white/[0.02]">
                        <span className="w-1.5 h-1.5 bg-[#7C5CFF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#7C5CFF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#7C5CFF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 sm:p-6 border-t border-white/5 bg-slate-950/10 flex-shrink-0">
                  {chatMessages.length === 0 && (
                    <div 
                      className="flex flex-nowrap gap-2 overflow-x-auto pb-2 justify-start lg:justify-center mb-4 max-w-full scrollbar-none nb-scroll"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {suggestions.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(chip)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-[#7C5CFF]/40 hover:bg-[#7C5CFF]/5 transition-all duration-200 whitespace-nowrap flex-shrink-0"
                        >
                          {chip.icon} {chip.text}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="relative w-full max-w-2xl mx-auto flex items-center bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-full px-4 sm:px-5 py-2.5 sm:py-3.5 shadow-xl shadow-black/25">
                    <button className="text-slate-500 hover:text-white transition-colors flex-shrink-0 mr-3" onClick={() => setSourcePopoverOpen(true)} title="Add attachment">
                      <LuUpload size={16} />
                    </button>
                    <textarea
                      className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none resize-none h-5 max-h-24 leading-relaxed overflow-y-auto pr-8 nb-scroll"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Ask anything about your study materials..."
                      rows={1}
                    />
                    <div className="absolute right-3.5 flex items-center gap-2">
                      <button
                        className={`transition-all p-1.5 rounded-full ${
                          isRecording
                            ? 'text-rose-400 bg-rose-500/20 animate-pulse border border-rose-500/30'
                            : transcribingVoice
                            ? 'text-amber-400 animate-spin'
                            : 'text-slate-500 hover:text-white'
                        }`}
                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        disabled={transcribingVoice}
                        title={isRecording ? "Click to stop recording" : "Click to speak (Voice input)"}
                      >
                        <LuMic size={15} />
                      </button>
                      <button
                        className="w-8 h-8 rounded-full bg-[#7C5CFF] hover:bg-[#5B8CFF] text-white flex items-center justify-center transition-all shadow-md shadow-[#7C5CFF]/20"
                        onClick={sendMessage}
                        disabled={sendingChat || !chatInput.trim()}
                      >
                        <LuCornerDownLeft size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </main>

              {/* ── RIGHT COLUMN: Studio Tools Panel ── */}
              <aside className={`${activeMobileTab === 'studio' ? 'flex' : 'hidden'} lg:flex border-l border-white/5 flex-col min-h-0 bg-slate-950/10 z-10 p-4 space-y-5 overflow-y-auto nb-scroll w-full lg:w-auto`}>
                
                {/* Section Title */}
                <div className="flex items-center gap-1.5 text-[#7C5CFF]">
                  <LuSettings size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">Studio</span>
                </div>

                {/* Dynamic AI Model Selector */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">AI Model & Provider</span>
                  <div className="relative flex items-center bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-[#7C5CFF]/50 transition-colors">
                    <LuSparkles className="text-[#5B8CFF] mr-2 shrink-0" size={13} />
                    <select
                      value={selectedProvider}
                      onChange={(e) => {
                        const newProv = e.target.value;
                        setSelectedProvider(newProv);
                        if (newProv === 'gemini') setSelectedModel('gemini-1.5-flash');
                        else if (newProv === 'lmstudio') setSelectedModel('auto');
                        else setSelectedModel('');
                      }}
                      className="bg-transparent text-xs font-semibold text-white outline-none w-full cursor-pointer py-1"
                    >
                      <option value="lmstudio" className="bg-slate-900 text-white">LM Studio (Local LLM)</option>
                      <option value="gemini" className="bg-slate-900 text-white">Google Gemini (Cloud)</option>
                      <option value="local" className="bg-slate-900 text-white">Ollama / CPU Local</option>
                    </select>
                  </div>
                  <span className="block text-[9px] text-slate-500 italic pl-1">
                    {selectedProvider === 'lmstudio' ? 'Port 1234 (Fast local inference)' : selectedProvider === 'gemini' ? 'Gemini 1.5/3.0 Cloud Web API' : 'Local system engine'}
                  </span>
                </div>

                {/* Quick Add Note Card */}
                <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3.5">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Notebook Notes</span>
                  <button
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                    onClick={() => { setActiveAddTab('text'); setSourcePopoverOpen(true); }}
                  >
                    <LuPlus size={12} /> Add new note
                  </button>
                </div>

                {/* Workspace Generator Buttons */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Quick tools</span>
                  
                  <button
                    className="w-full inline-flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3 text-xs text-slate-300 transition-all hover:bg-white/5 hover:border-[#7C5CFF]/30 hover:text-white group"
                    onClick={() => {
                      setChatInput("Generate a list of Frequently Asked Questions (FAQ) with answers based on the uploaded sources.");
                      sendMessage();
                    }}
                  >
                    <span className="flex items-center gap-2"><LuCircleHelp size={13} className="text-slate-400 group-hover:text-[#7C5CFF] transition-colors" /> Generate FAQ</span>
                    <LuPlay size={10} className="text-slate-600 group-hover:text-white transition-colors" />
                  </button>

                  <button
                    className="w-full inline-flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3 text-xs text-slate-300 transition-all hover:bg-white/5 hover:border-[#7C5CFF]/30 hover:text-white group"
                    onClick={generateCombinedQuiz}
                    disabled={quizLoading}
                  >
                    <span className="flex items-center gap-2"><LuBookOpen size={13} className="text-slate-400 group-hover:text-[#7C5CFF] transition-colors" /> {quizLoading ? 'Generating...' : 'Start Quiz'}</span>
                    <LuPlay size={10} className="text-slate-600 group-hover:text-white transition-colors" />
                  </button>

                  <button
                    className="w-full inline-flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3 text-xs text-slate-300 transition-all hover:bg-white/5 hover:border-[#7C5CFF]/30 hover:text-white group"
                    onClick={generateTopicReport}
                    disabled={reportLoading}
                  >
                    <span className="flex items-center gap-2"><LuFileSpreadsheet size={13} className="text-slate-400 group-hover:text-[#7C5CFF] transition-colors" /> {reportLoading ? 'Generating...' : 'Topic Report'}</span>
                    <LuPlay size={10} className="text-slate-600 group-hover:text-white transition-colors" />
                  </button>

                  <button
                    className="w-full inline-flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3 text-xs text-slate-300 transition-all hover:bg-white/5 hover:border-[#7C5CFF]/30 hover:text-white group"
                    onClick={generateAudioPodcast}
                    disabled={audioLoading}
                  >
                    <span className="flex items-center gap-2"><LuVolume2 size={13} className="text-slate-400 group-hover:text-[#7C5CFF] transition-colors" /> {audioLoading ? 'Generating Audio...' : 'Podcast Audio'}</span>
                    <LuPlay size={10} className="text-slate-600 group-hover:text-white transition-colors" />
                  </button>
                </div>

                {/* Inline Audio Player for Generated Podcast */}
                {audioOverview?.status === 'completed' && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5"><LuVolume2 size={13} /> Audio Podcast Ready</span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded">MP3</span>
                    </div>
                    <audio
                      controls
                      className="w-full h-8 mt-1 rounded-lg"
                      src={`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/portable-rag/notebooks/${notebookId}/audio-file`}
                    />
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-white/5 my-2" />

                {/* Notebook statistics & Insights */}
                <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3.5 space-y-3 shadow-inner">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Workspace Insights</span>
                  
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Vector documents</span>
                    <span className="font-semibold text-white">{vectorStats?.vector_documents_count ?? '—'}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Storage database</span>
                    <span className="font-semibold text-white text-[10px] truncate max-w-[80px]" title={health?.storage?.sqlite}>{health?.storage?.sqlite || '—'}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Chat Provider</span>
                    <span className="font-semibold text-white text-[10px] truncate max-w-[80px]" title={models?.default_chat_provider}>{models?.default_chat_provider || '—'}</span>
                  </div>
                  
                  <button className="w-full mt-2 inline-flex items-center justify-center gap-1 py-1.5 border border-white/5 rounded-lg text-[9px] font-bold text-[#5B8CFF] hover:bg-white/5 transition-colors" onClick={initializeVectorDb}>
                    <LuCpu size={10} /> Initialize Vector DB
                  </button>
                </div>

                {/* Status indicator */}
                {studioMessage && (
                  <div className="rounded-xl border border-[#5B8CFF]/15 bg-[#5B8CFF]/5 p-3 flex gap-2">
                    <LuInfo className="text-[#5B8CFF] mt-0.5 flex-shrink-0" size={13} />
                    <p className="text-[10px] text-[#5B8CFF] leading-relaxed font-semibold">{studioMessage}</p>
                  </div>
                )}
              </aside>

            </div>
          )}

        </div>
      </div>
    </GlassDashboardShell>
  );
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────*/
const StudentPersonalResourcesPage = () => {
  const navigate = useNavigate();
  const { id: classroomId, notebookId } = useParams();

  const [notebooks, setNotebooks] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardInfo, setDashboardInfo] = useState('');
  const [newNotebookName, setNewNotebookName] = useState('');
  const [newNotebookDescription, setNewNotebookDescription] = useState('');
  const [creatingNotebook, setCreatingNotebook] = useState(false);

  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [notebookDetail, setNotebookDetail] = useState(null);
  const [sources, setSources] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSessionId, setChatSessionId] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');

  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceActionLoading, setSourceActionLoading] = useState(false);
  const [sourceActionError, setSourceActionError] = useState('');

  const [health, setHealth] = useState(null);
  const [models, setModels] = useState(null);
  const [vectorStats, setVectorStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [studioMessage, setStudioMessage] = useState('');

  const [podcastEpisodeName, setPodcastEpisodeName] = useState('');
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [podcastJob, setPodcastJob] = useState(null);

  const [quizLoading, setQuizLoading] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [generatedQuizRaw, setGeneratedQuizRaw] = useState('');

  const [reportTopic, setReportTopic] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState('');

  const [audioBriefing, setAudioBriefing] = useState('');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioOverview, setAudioOverview] = useState(null);

  // Dynamic AI Provider / Model selector
  const [selectedProvider, setSelectedProvider] = useState('lmstudio');
  const [selectedModel, setSelectedModel] = useState('');

  // Voice Input state
  const [isRecording, setIsRecording] = useState(false);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const isWorkspace = Boolean(notebookId);

  const sortedNotebooks = useMemo(() =>
    [...notebooks].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)), [notebooks]);

  const refreshNotebooks = async () => {
    setDashboardLoading(true); setDashboardError('');
    try {
      const url = classroomId
        ? portablePath(`/notebooks?classroom_id=${classroomId}`)
        : portablePath('/notebooks');
      const items = await apiClient.get(url);
      setNotebooks(Array.isArray(items) ? items : []);
    }
    catch (e) { setDashboardError(e.message || 'Failed to load notebooks'); }
    finally { setDashboardLoading(false); }
  };

  const refreshSources = async () => {
    if (!notebookId) return;
    try { const items = await apiClient.get(portablePath(`/sources?notebook_id=${notebookId}`)); setSources(Array.isArray(items) ? items : []); }
    catch { setSources([]); }
  };

  const refreshVectorStats = async () => {
    try { setVectorStats(await apiClient.get(portablePath('/vector-db/stats'))); }
    catch { setVectorStats(null); }
  };

  const ensureChatSession = async (id) => {
    const sessions = await apiClient.get(portablePath(`/chat/sessions?notebook_id=${id}`));
    if (Array.isArray(sessions) && sessions.length > 0) return sessions[0];
    return apiClient.post(portablePath('/chat/sessions'), { notebook_id: id, title: 'Personal Workspace Chat' });
  };

  const refreshWorkspace = async (id) => {
    setWorkspaceLoading(true); setWorkspaceError(''); setChatError('');
    try {
      const [detail, srcs, h, m] = await Promise.all([
        apiClient.get(portablePath(`/notebooks/${id}`)),
        apiClient.get(portablePath(`/sources?notebook_id=${id}`)),
        apiClient.get(portablePath('/health')),
        apiClient.get(portablePath('/models')),
      ]);
      setNotebookDetail(detail); setSources(Array.isArray(srcs) ? srcs : []); setHealth(h); setModels(m);
      const session = await ensureChatSession(id);
      setChatSessionId(session.id);
      const sessionDetail = await apiClient.get(portablePath(`/chat/sessions/${session.id}`));
      setChatMessages(normalizeMessages(sessionDetail?.messages));
      await refreshVectorStats();
      await refreshAudioOverview({ silent: true });
    } catch (e) { setWorkspaceError(e.message || 'Failed to load workspace'); }
    finally { setWorkspaceLoading(false); }
  };

  useEffect(() => {
    if (!isWorkspace) { refreshNotebooks(); return; }
    refreshWorkspace(notebookId);
  }, [isWorkspace, notebookId]);

  const createNotebook = async () => {
    const name = newNotebookName.trim();
    if (!name) { setDashboardError('Notebook name is required'); return; }
    setCreatingNotebook(true); setDashboardError(''); setDashboardInfo('');
    try {
      const payload = {
        name,
        description: newNotebookDescription.trim(),
        ...(classroomId ? { classroom_id: classroomId } : {})
      };
      const created = await apiClient.post(portablePath('/notebooks'), payload);
      setDashboardInfo('Opening workspace…'); setNewNotebookName(''); setNewNotebookDescription('');
      navigate(`/classroom/${classroomId}/personal-resources/notebook/${created.id}`);
    } catch (e) { setDashboardError(e.message || 'Failed to create notebook'); }
    finally { setCreatingNotebook(false); }
  };

  const deleteNotebook = async (id) => {
    if (!window.confirm('Delete this notebook? This cannot be undone.')) return;
    setDashboardError(''); setDashboardInfo('');
    try { await apiClient.delete(portablePath(`/notebooks/${id}`)); setDashboardInfo('Deleted.'); await refreshNotebooks(); }
    catch (e) { setDashboardError(e.message || 'Failed to delete'); }
  };

  const addTextSource = async () => {
    if (!sourceText.trim() || !notebookId) return;
    setSourceActionLoading(true); setSourceActionError('');
    try {
      await apiClient.post(portablePath('/sources/text'), { notebook_id: notebookId, title: sourceTitle.trim() || 'Quick note', content: sourceText.trim(), embed: true });
      setSourceTitle(''); setSourceText(''); await refreshSources(); await refreshVectorStats();
    } catch (e) { setSourceActionError(e.message || 'Failed'); }
    finally { setSourceActionLoading(false); }
  };

  const addUrlSource = async () => {
    if (!sourceUrl.trim() || !notebookId) return;
    setSourceActionLoading(true); setSourceActionError('');
    try {
      await apiClient.post(portablePath('/sources/url'), { notebook_id: notebookId, url: sourceUrl.trim(), title: sourceTitle.trim() || null, embed: true });
      setSourceUrl(''); await refreshSources(); await refreshVectorStats();
    } catch (e) { setSourceActionError(e.message || 'Failed'); }
    finally { setSourceActionLoading(false); }
  };

  const addFileSource = async () => {
    if (!sourceFile || !notebookId) return;
    setSourceActionLoading(true); setSourceActionError('');
    try {
      const form = new FormData();
      form.append('notebook_id', notebookId); form.append('file', sourceFile);
      if (sourceTitle.trim()) form.append('title', sourceTitle.trim());
      await apiClient.post(portablePath('/sources/file'), form);
      setSourceFile(null); await refreshSources(); await refreshVectorStats();
    } catch (e) { setSourceActionError(e.message || 'Failed'); }
    finally { setSourceActionLoading(false); }
  };

  const removeSource = async (id) => {
    setSourceActionLoading(true); setSourceActionError('');
    try { await apiClient.delete(portablePath(`/sources/${id}`)); await refreshSources(); await refreshVectorStats(); }
    catch (e) { setSourceActionError(e.message || 'Failed'); }
    finally { setSourceActionLoading(false); }
  };

  const sendMessage = async () => {
    if (!chatSessionId || !chatInput.trim()) return;
    const message = chatInput.trim(); setChatInput(''); setChatError(''); setSendingChat(true);
    setChatMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: message }]);
    try {
      const adaptiveInstruction = buildAdaptiveInstruction(chatMessages, message);
      const payload = {
        message: `${adaptiveInstruction}\n\nUser request:\n${message}`,
        retrieval_k: 6,
      };
      if (selectedProvider) payload.provider = selectedProvider;
      if (selectedModel) payload.model = selectedModel;

      const res = await apiClient.post(portablePath(`/chat/sessions/${chatSessionId}/messages`), payload);
      const answer = res?.answer || 'No response generated.';
      const citationCount = Array.isArray(res?.citation_map) ? res.citation_map.length : 0;
      setChatMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: answer, citationCount }]);
    } catch (e) { setChatError(e.message || 'Failed to send'); }
    finally { setSendingChat(false); }
  };

  const sendStudioPrompt = async (message, retrievalK = 12) => {
    if (!notebookId) throw new Error('Open a notebook workspace first.');

    let activeSessionId = chatSessionId;

    if (!activeSessionId) {
      const session = await ensureChatSession(notebookId);
      activeSessionId = session?.id;
      if (activeSessionId) setChatSessionId(activeSessionId);
    }

    if (!activeSessionId) throw new Error('Unable to create Studio chat session.');

    const adaptiveInstruction = buildAdaptiveInstruction(chatMessages, message);

    const payload = {
      message: `${adaptiveInstruction}\n\nTask:\n${message}`,
      retrieval_k: retrievalK,
      temperature: 0.2,
    };
    if (selectedProvider) payload.provider = selectedProvider;
    if (selectedModel) payload.model = selectedModel;

    const response = await apiClient.post(portablePath(`/chat/sessions/${activeSessionId}/messages`), payload);

    return response?.answer || '';
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        stream.getTracks().forEach((track) => track.stop());
        setTranscribingVoice(true);
        try {
          const form = new FormData();
          form.append('file', audioBlob, 'voice-input.wav');
          const result = await apiClient.post(portablePath('/speech/transcribe'), form);
          if (result?.text) {
            setChatInput((prev) => (prev ? `${prev} ${result.text}` : result.text));
          }
        } catch (err) {
          setChatError('Speech transcription failed: ' + (err.message || 'Error'));
        } finally {
          setTranscribingVoice(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      setChatError('Microphone permission denied or audio device not found.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const generatePodcast = async () => {
    if (!notebookId) return;

    setPodcastLoading(true);
    setStudioMessage('');

    try {
      const episodeName = podcastEpisodeName.trim() || `${notebookDetail?.name || 'Notebook'} Podcast`;

      const response = await apiClient.post(portablePath('/podcasts/generate'), {
        episode_profile: 'default',
        speaker_profile: 'default',
        episode_name: episodeName,
        notebook_id: notebookId,
      });

      const generatedJobId = String(response?.job_id || '').trim();
      setPodcastJob({
        job_id: generatedJobId,
        status: response?.status || 'queued',
        message: response?.message || '',
        result: null,
        error: '',
      });

      setStudioMessage(generatedJobId ? `Podcast generation queued: ${generatedJobId}` : 'Podcast generation requested.');
    } catch (e) {
      setStudioMessage(e.message || 'Podcast generation failed');
    } finally {
      setPodcastLoading(false);
    }
  };

  const refreshPodcastJob = async () => {
    const currentJobId = String(podcastJob?.job_id || '').trim();
    if (!currentJobId) {
      setStudioMessage('Generate a podcast first to track job status.');
      return;
    }

    setPodcastLoading(true);
    setStudioMessage('');

    try {
      const status = await apiClient.get(portablePath(`/podcasts/jobs/${currentJobId}`));
      const resolvedJobId = String(status?.id || currentJobId).trim();

      setPodcastJob((previous) => ({
        ...(previous || {}),
        job_id: resolvedJobId,
        status: status?.status || previous?.status || 'unknown',
        result: status?.result || null,
        error: status?.error || '',
      }));

      setStudioMessage(`Podcast job status: ${status?.status || 'unknown'}`);
    } catch (e) {
      setStudioMessage(e.message || 'Unable to fetch podcast job status');
    } finally {
      setPodcastLoading(false);
    }
  };

  useEffect(() => {
    let pollInterval = null;
    const currentJobId = String(podcastJob?.job_id || '').trim();
    const status = podcastJob?.status;

    if (currentJobId && status && !['ready', 'failed', 'completed'].includes(status.toLowerCase())) {
      pollInterval = setInterval(() => {
        refreshPodcastJob();
      }, 5000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [podcastJob?.job_id, podcastJob?.status]);

  const generateCombinedQuiz = async () => {
    if (!notebookId) return;

    setQuizLoading(true);
    setStudioMessage('');
    setGeneratedQuiz(null);
    setGeneratedQuizRaw('');

    try {
      const prompt = [
        'Generate a comprehensive quiz using all available sources in this notebook, including YouTube-derived content if present.',
        'Return ONLY strict JSON with this shape:',
        '{',
        '  "title": "string",',
        '  "instructions": "string",',
        '  "questions": [',
        '    {"id":"q1","type":"mcq|short_answer","question":"string","options":["A","B"],"answer":"string","explanation":"string"}',
        '  ]',
        '}',
        'Include 8 questions with a mix of mcq and short_answer.',
      ].join('\n');

      const answer = await sendStudioPrompt(prompt, 24);
      setGeneratedQuizRaw(answer);

      const parsed = normalizeGeneratedQuiz(extractJsonObject(answer));
      if (parsed) {
        setGeneratedQuiz(parsed);
        setStudioMessage('Quiz generated from all notebook sources.');
      } else {
        setStudioMessage('Quiz generated, but response was not strict JSON. Raw output is shown.');
      }
    } catch (e) {
      setStudioMessage(e.message || 'Quiz generation failed');
    } finally {
      setQuizLoading(false);
    }
  };

  const generateTopicReport = async () => {
    const topic = reportTopic.trim();
    if (!topic) {
      setStudioMessage('Enter a topic to generate report.');
      return;
    }

    setReportLoading(true);
    setStudioMessage('');
    setReportText('');

    try {
      const prompt = [
        `Create a detailed study report about: ${topic}`,
        'Use only the notebook sources retrieved via RAG context.',
        'Structure:',
        '1) Overview',
        '2) Key Concepts',
        '3) Important Facts',
        '4) Practical Takeaways',
        '5) Quick Revision Checklist',
        'Write clear plain text suitable for exporting to a .txt document.',
      ].join('\n');

      const report = await sendStudioPrompt(prompt, 20);
      setReportText(report || 'No report generated.');
      setStudioMessage('Topic report generated. Use download to save .txt file.');
    } catch (e) {
      setStudioMessage(e.message || 'Report generation failed');
    } finally {
      setReportLoading(false);
    }
  };

  const downloadTopicReport = () => {
    if (!reportText.trim()) {
      setStudioMessage('Generate a report before downloading.');
      return;
    }

    const fileName = `${toSafeFileName(reportTopic || notebookDetail?.name || 'study-report')}.txt`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const refreshAudioOverview = async ({ silent = false } = {}) => {
    if (!notebookId) return;

    if (!silent) {
      setAudioLoading(true);
      setStudioMessage('');
    }

    try {
      const overview = await apiClient.get(portablePath(`/notebooks/${notebookId}/audio-overview`));
      setAudioOverview(overview);

      if (!silent) {
        setStudioMessage(`Audio podcast status: ${overview?.status || 'unknown'}`);
      }
    } catch (e) {
      if (!silent) {
        setStudioMessage(e.message || 'Unable to fetch audio podcast status');
      }
    } finally {
      if (!silent) {
        setAudioLoading(false);
      }
    }
  };

  const generateAudioPodcast = async () => {
    if (!notebookId) return;

    setAudioLoading(true);
    setStudioMessage('');

    try {
      const payload = audioBriefing.trim() ? { briefing: audioBriefing.trim() } : {};

      const response = await apiClient.post(portablePath(`/notebooks/${notebookId}/audio-overview`), payload);

      setAudioOverview((previous) => ({
        ...(previous || {}),
        notebook_id: notebookId,
        job_id: response?.job_id,
        status: response?.status || 'queued',
      }));

      setStudioMessage(response?.job_id ? `Audio podcast job queued: ${response.job_id}` : 'Audio podcast generation requested.');
      await refreshAudioOverview({ silent: true });
    } catch (e) {
      setStudioMessage(e.message || 'Audio podcast generation failed');
    } finally {
      setAudioLoading(false);
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim() || !notebookId) return;
    setSearchLoading(true); setStudioMessage('');
    try {
      const res = await apiClient.post(portablePath('/search'), { notebook_id: notebookId, query: searchQuery.trim(), k: 5 });
      setSearchResults(Array.isArray(res?.results) ? res.results : []);
    } catch (e) { setStudioMessage(e.message || 'Search failed'); setSearchResults([]); }
    finally { setSearchLoading(false); }
  };

  const initializeVectorDb = async () => {
    setStudioMessage('');
    try { const init = await apiClient.post(portablePath('/vector-db/init'), {}); setVectorStats(init); setStudioMessage('Vector DB initialized.'); }
    catch (e) { setStudioMessage(e.message || 'Init failed'); }
  };

  useEffect(() => {
    const status = String(audioOverview?.status || '').toLowerCase();
    if (!isWorkspace || !notebookId || !['queued', 'running'].includes(status)) return undefined;

    const timer = setInterval(() => {
      refreshAudioOverview({ silent: true });
    }, 5000);

    return () => clearInterval(timer);
  }, [audioOverview?.status, isWorkspace, notebookId]);

  if (!isWorkspace) {
    return (
      <DashboardView
        notebooks={notebooks} sortedNotebooks={sortedNotebooks}
        dashboardLoading={dashboardLoading} dashboardError={dashboardError} dashboardInfo={dashboardInfo}
        newNotebookName={newNotebookName} setNewNotebookName={setNewNotebookName}
        newNotebookDescription={newNotebookDescription} setNewNotebookDescription={setNewNotebookDescription}
        creatingNotebook={creatingNotebook} createNotebook={createNotebook}
        deleteNotebook={deleteNotebook} refreshNotebooks={refreshNotebooks}
        classroomId={classroomId} navigate={navigate}
      />
    );
  }

  return (
    <WorkspaceView
      notebookDetail={notebookDetail} workspaceLoading={workspaceLoading}
      workspaceError={workspaceError} chatError={chatError} sourceActionError={sourceActionError}
      sources={sources} chatMessages={chatMessages}
      chatInput={chatInput} setChatInput={setChatInput} sendingChat={sendingChat} sendMessage={sendMessage}
      sourceTitle={sourceTitle} setSourceTitle={setSourceTitle}
      sourceText={sourceText} setSourceText={setSourceText}
      sourceUrl={sourceUrl} setSourceUrl={setSourceUrl}
      sourceFile={sourceFile} setSourceFile={setSourceFile}
      sourceActionLoading={sourceActionLoading}
      addTextSource={addTextSource} addUrlSource={addUrlSource} addFileSource={addFileSource} removeSource={removeSource}
      health={health} models={models} vectorStats={vectorStats}
      searchQuery={searchQuery} setSearchQuery={setSearchQuery}
      searchResults={searchResults} searchLoading={searchLoading} studioMessage={studioMessage}
      podcastEpisodeName={podcastEpisodeName} setPodcastEpisodeName={setPodcastEpisodeName}
      podcastLoading={podcastLoading} podcastJob={podcastJob}
      generatePodcast={generatePodcast} refreshPodcastJob={refreshPodcastJob}
      quizLoading={quizLoading} generatedQuiz={generatedQuiz}
      generatedQuizRaw={generatedQuizRaw} generateCombinedQuiz={generateCombinedQuiz}
      reportTopic={reportTopic} setReportTopic={setReportTopic}
      reportLoading={reportLoading} reportText={reportText}
      generateTopicReport={generateTopicReport} downloadTopicReport={downloadTopicReport}
      audioBriefing={audioBriefing} setAudioBriefing={setAudioBriefing}
      audioLoading={audioLoading} audioOverview={audioOverview}
      generateAudioPodcast={generateAudioPodcast} refreshAudioOverview={refreshAudioOverview}
      selectedProvider={selectedProvider} setSelectedProvider={setSelectedProvider}
      selectedModel={selectedModel} setSelectedModel={setSelectedModel}
      isRecording={isRecording} transcribingVoice={transcribingVoice}
      startVoiceRecording={startVoiceRecording} stopVoiceRecording={stopVoiceRecording}
      runSearch={runSearch} initializeVectorDb={initializeVectorDb}
      refreshWorkspace={refreshWorkspace} notebookId={notebookId} classroomId={classroomId} navigate={navigate}
    />
  );
};

export default StudentPersonalResourcesPage;