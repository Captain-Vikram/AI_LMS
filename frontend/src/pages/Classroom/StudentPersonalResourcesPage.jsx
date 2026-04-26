import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBackOutline,
  IoBookOutline,
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoLinkOutline,
  IoMapOutline,
  IoSearchOutline,
  IoSparklesOutline,
  IoTrashOutline,
  IoFlashOutline,
  IoLayersOutline,
  IoRocketOutline,
} from 'react-icons/io5';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';
import apiClient from '../../services/apiClient';
import IconsCarousel from '../../components/IconsCarousel';

const PORTABLE_RAG_PREFIX = '/api/portable-rag';
const portablePath = (path) => `${PORTABLE_RAG_PREFIX}${path}`;
const DEFAULT_WORKSPACE_SHELL_OFFSET_PX = 160;
const WORKSPACE_SHELL_TOP_PADDING_PX = 112;
const WORKSPACE_SHELL_BOTTOM_PADDING_PX = 48;
const NAVBAR_SELECTOR = '[data-app-navbar="true"]';

const getWorkspaceShellOffsetPx = () => {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_SHELL_OFFSET_PX;

  const navbar = document.querySelector(NAVBAR_SELECTOR);
  if (!navbar) {
    return WORKSPACE_SHELL_TOP_PADDING_PX + WORKSPACE_SHELL_BOTTOM_PADDING_PX;
  }

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

const toSafeFileName = (value) => {
  const raw = String(value || 'report').trim().toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'report';
};

const deriveLearnerProfile = (messages = [], latestMessage = '') => {
  const recentUserMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m?.role === 'user' && typeof m?.content === 'string' && m.content.trim())
    .slice(-6)
    .map((m) => m.content.trim());

  const sample = [...recentUserMessages, String(latestMessage || '').trim()].filter(Boolean).join(' ');
  const words = sample.split(/\s+/).filter(Boolean);
  const avgWords = recentUserMessages.length
    ? recentUserMessages.reduce((sum, text) => sum + text.split(/\s+/).filter(Boolean).length, 0) / recentUserMessages.length
    : words.length;

  const informalPattern = /\b(pls|plz|bro|sis|ya|u|btw|lol|hey|thx|thanks yaar)\b/i;
  const concisePattern = /\b(short|brief|quick|in points|bullet|summary|tldr)\b/i;
  const beginnerPattern = /\b(simple|easy|beginner|basic|eli5|step by step)\b/i;
  const advancedPattern = /\b(advanced|deep|detailed|technical|in depth|rigorous)\b/i;

  const tone = informalPattern.test(sample) ? 'friendly and conversational' : 'professional and supportive';
  const complexity = beginnerPattern.test(sample)
    ? 'beginner-friendly'
    : advancedPattern.test(sample)
      ? 'advanced'
      : avgWords <= 10
        ? 'simple'
        : avgWords >= 22
          ? 'detailed'
          : 'intermediate';
  const brevity = concisePattern.test(sample) ? 'concise' : 'balanced';

  return { tone, complexity, brevity };
};

const buildAdaptiveInstruction = (messages = [], latestMessage = '') => {
  const profile = deriveLearnerProfile(messages, latestMessage);

  return [
    'Adaptive response instructions:',
    '- Infer the user type from the latest request and recent chat history.',
    '- Match the user\'s language style from their latest message (including mixed-language usage if present).',
    `- Keep tone ${profile.tone}.`,
    `- Keep explanation level ${profile.complexity}.`,
    `- Keep response style ${profile.brevity}.`,
    '- Personalize to the user\'s question-specific need and intent.',
    '- Keep content grounded in retrieved notebook context only.',
    '- If the task asks for a strict format (like JSON), return only that format with no extra text.',
  ].join('\n');
};

/* ─────────────────────────────────────────────────────────────
   STYLE INJECTION — scoped design tokens + animations
───────────────────────────────────────────────────────────────*/
const Styles = () => (
  <style>{`
    :root {
      --ink:       transparent;
      --surface:   rgba(17, 24, 39, 0.4);
      --card:      rgba(31, 41, 55, 0.6);
      --border:    rgba(55, 65, 81, 0.5);
      --border-hi: rgba(75, 85, 99, 0.8);
      --muted:     #9ca3af;
      --text:      #f9fafb;
      --text-dim:  #d1d5db;
      --accent:    #06b6d4;
      --accent2:   #6366f1;
      --glow:      rgba(6, 182, 212, 0.2);
      --glow2:     rgba(99, 102, 241, 0.15);
      --success:   #10b981;
      --danger:    #f43f5e;
    }

    .nb-root * { box-sizing: border-box; }

    .nb-root {
      font-family: inherit;
      background: transparent;
      color: var(--text);
      min-height: 100vh;
    }

    .nb-root.nb-root-workspace {
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }

    /* ── Card ── */
    .nb-card {
      background: var(--card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 16px;
      transition: border-color .2s;
    }
    .nb-card:hover { border-color: var(--border-hi); shadow: 0 12px 32px rgba(0,0,0,0.5); }

    /* ── Inputs ── */
    .nb-input {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 14px;
      color: var(--text);
      font-family: inherit;
      font-size: 13px;
      outline: none;
      transition: border-color .2s, box-shadow .2s;
    }
    .nb-input::placeholder { color: var(--muted); }
    .nb-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--glow);
    }
    textarea.nb-input { resize: vertical; }

    /* ── Buttons ── */
    .nb-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      padding: 9px 16px;
      transition: all .18s;
    }
    .nb-btn:disabled { opacity: .45; cursor: not-allowed; }

    .nb-btn-primary {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #fff;
      box-shadow: 0 4px 18px var(--glow);
    }
    .nb-btn-primary:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 24px var(--glow);
    }

    .nb-btn-ghost {
      background: transparent;
      color: var(--text-dim);
      border: 1px solid var(--border);
    }
    .nb-btn-ghost:not(:disabled):hover {
      background: rgba(255,255,255,0.04);
      color: var(--text);
      border-color: var(--border-hi);
    }

    .nb-btn-danger {
      background: transparent;
      color: var(--danger);
      border: 1px solid rgba(248,113,113,0.25);
    }
    .nb-btn-danger:not(:disabled):hover {
      background: rgba(248,113,113,0.08);
    }

    .nb-btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 8px; }

    /* ── Badge ── */
    .nb-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 500;
    }
    .nb-badge-accent {
      background: rgba(108,143,255,0.12);
      color: var(--accent);
      border: 1px solid rgba(108,143,255,0.22);
    }

    /* ── Page Header ── */
    .nb-hero {
      position: relative;
      overflow: hidden;
      border-radius: 20px;
      padding: 36px 40px;
      background: rgba(31, 41, 55, 0.5);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
    }
    .nb-hero::before {
      content:'';
      position:absolute; inset:0;
      background: radial-gradient(ellipse 70% 60% at 80% 30%, var(--glow2), transparent 65%),
                  radial-gradient(ellipse 50% 40% at 20% 70%, var(--glow),  transparent 60%);
      pointer-events: none;
    }
    .nb-hero-title {
      font-family: inherit;
      font-size: clamp(28px, 4vw, 42px);
      font-weight: 700;
      letter-spacing: -.5px;
      color: var(--text);
      line-height: 1.15;
    }
    .nb-hero-title em { font-style: italic; color: var(--accent); }

    /* ── Notebook Card ── */
    .nb-notebook-card {
      background: var(--card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      cursor: pointer;
      transition: all .2s;
      position: relative;
      overflow: hidden;
    }
    .nb-notebook-card::before {
      content:'';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      opacity: 0;
      transition: opacity .2s;
    }
    .nb-notebook-card:hover {
      border-color: var(--border-hi);
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
    }
    .nb-notebook-card:hover::before { opacity: 1; }

    /* ── Workspace sidebar ── */
    .nb-ws-panel {
      background: var(--card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
    }
    .nb-ws-panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nb-ws-panel-body { padding: 16px 20px; flex: 1; overflow: hidden; }
    .nb-section-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 10px;
    }

    /* ── Source pill ── */
    .nb-source-pill {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      transition: border-color .15s;
    }
    .nb-source-pill:hover { border-color: var(--border-hi); }

    /* ── Chat bubbles ── */
    .nb-bubble {
      border-radius: 14px;
      padding: 12px 16px;
      font-size: 13.5px;
      line-height: 1.65;
    }
    .nb-bubble-user {
      background: rgba(108,143,255,0.1);
      border: 1px solid rgba(108,143,255,0.2);
      color: var(--text);
      margin-left: auto;
      max-width: 82%;
    }
    .nb-bubble-ai {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      max-width: 92%;
    }
    .nb-bubble-ai-accent {
      display: inline-block;
      width: 6px; height: 6px;
      background: var(--accent);
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }

    /* ── Stat box ── */
    .nb-stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .nb-stat-label { font-size: 11px; color: var(--muted); margin-bottom: 3px; }
    .nb-stat-val { font-size: 15px; font-weight: 600; color: var(--text); }

    /* ── Divider ── */
    .nb-divider { height: 1px; background: var(--border); margin: 14px 0; }

    /* ── Animations ── */
    @keyframes fadeUp {
      from { opacity:0; transform:translateY(16px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .nb-animate { animation: fadeUp .4s ease both; }
    .nb-animate-d1 { animation-delay:.07s; }
    .nb-animate-d2 { animation-delay:.14s; }
    .nb-animate-d3 { animation-delay:.21s; }

    @keyframes pulse-dot {
      0%,100% { opacity:1; } 50% { opacity:.3; }
    }
    .nb-typing span {
      display: inline-block;
      width: 5px; height: 5px;
      background: var(--accent);
      border-radius: 50%;
      margin: 0 2px;
      animation: pulse-dot 1.2s ease-in-out infinite;
    }
    .nb-typing span:nth-child(2) { animation-delay:.2s; }
    .nb-typing span:nth-child(3) { animation-delay:.4s; }

    /* ── Scrollbar ── */
    .nb-scroll::-webkit-scrollbar { width: 4px; }
    .nb-scroll::-webkit-scrollbar-track { background: transparent; }
    .nb-scroll::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 4px; }

    .nb-workspace-grid {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(240px, 280px) minmax(0, 1fr) minmax(220px, 260px);
      overflow: hidden;
    }

    @media (max-width: 1200px) {
      .nb-workspace-grid {
        grid-template-columns: 240px minmax(0, 1fr);
      }
      .nb-studio-pane {
        display: none !important;
      }
    }

    @media (max-width: 860px) {
      .nb-workspace-grid {
        grid-template-columns: 1fr;
      }
      .nb-sources-pane {
        display: none !important;
      }
    }
  `}</style>
);

/* ─────────────────────────────────────────────────────────────
   DASHBOARD VIEW
───────────────────────────────────────────────────────────────*/
const DashboardView = ({
  notebooks, sortedNotebooks, dashboardLoading, dashboardError, dashboardInfo,
  newNotebookName, setNewNotebookName, newNotebookDescription, setNewNotebookDescription,
  creatingNotebook, createNotebook, deleteNotebook, refreshNotebooks,
  classroomId, navigate,
}) => (
  <GlassDashboardShell withPanel={false} contentClassName="max-w-[1240px]">
    <div className="nb-root relative" style={{ padding: '16px 8px 10px', maxWidth: 1200, margin: '0 auto', zIndex: 1 }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}>
        <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>
      <Styles />

    {/* Hero */}
    <div className="nb-hero nb-animate" style={{ marginBottom: 28 }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="nb-badge nb-badge-accent"><IoSparklesOutline /> Personal AI Workspace</span>
        </div>
        <h1 className="nb-hero-title">Your <em>NotebookLM</em><br />study companion.</h1>
        <p style={{ marginTop: 12, color: 'var(--text-dim)', fontSize: 14, maxWidth: 480, lineHeight: 1.7 }}>
          Upload sources, add notes, and have AI-powered conversations grounded in your personal study materials.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}>
            <IoArrowBackOutline /> Dashboard
          </button>
          <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={() => navigate(`/classroom/${classroomId}/modules`)}>
            <IoBookOutline /> Classroom Modules
          </button>
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
      {/* Create Notebook */}
      <div className="nb-card nb-animate nb-animate-d1" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>New Notebook</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>
          Create a private workspace to gather sources and chat.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="nb-input"
            value={newNotebookName}
            onChange={(e) => setNewNotebookName(e.target.value)}
            placeholder="Notebook name…"
            onKeyDown={(e) => e.key === 'Enter' && createNotebook()}
          />
          <textarea
            className="nb-input"
            rows={3}
            value={newNotebookDescription}
            onChange={(e) => setNewNotebookDescription(e.target.value)}
            placeholder="Description (optional)"
          />
          <button className="nb-btn nb-btn-primary" onClick={createNotebook} disabled={creatingNotebook}>
            <IoAddOutline /> {creatingNotebook ? 'Creating…' : 'Create Notebook'}
          </button>
        </div>
        {(dashboardError || dashboardInfo) && (
          <p style={{ marginTop: 12, fontSize: 12, color: dashboardError ? 'var(--danger)' : 'var(--success)' }}>
            {dashboardError || dashboardInfo}
          </p>
        )}

        {/* Current access */}
        <div style={{ marginTop: 22, padding: '14px 16px', borderRadius: 12, background: 'rgba(108,143,255,0.06)', border: '1px solid rgba(108,143,255,0.15)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <IoBookOutline style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Current Access</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.65 }}>
                Teacher-assigned modules, quizzes, and classroom progression remain available in the Modules section.
              </p>
              <button className="nb-btn nb-btn-ghost nb-btn-sm" style={{ marginTop: 10 }} onClick={() => navigate(`/classroom/${classroomId}/modules`)}>
                <IoBookOutline /> Open Classroom Modules
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notebooks list */}
      <div className="nb-animate nb-animate-d2">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 'bold' }}>Your Notebooks</h2>
          <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={refreshNotebooks} disabled={dashboardLoading}>
            Refresh
          </button>
        </div>

        {dashboardLoading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Loading…</div>
        ) : sortedNotebooks.length === 0 ? (
          <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <IoLayersOutline style={{ fontSize: 32, color: 'var(--muted)', marginBottom: 12 }} />
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No notebooks yet — create one to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {sortedNotebooks.map((nb, i) => (
              <div key={nb.id} className="nb-notebook-card" style={{ animationDelay: `${i * 0.06}s` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IoBookOutline style={{ color: '#fff', fontSize: 16 }} />
                  </div>
                  <button
                    className="nb-btn nb-btn-sm"
                    style={{ background: 'transparent', border: 'none', color: 'var(--muted)', padding: '4px 6px' }}
                    onClick={(e) => { e.stopPropagation(); deleteNotebook(nb.id); }}
                  >
                    <IoTrashOutline style={{ fontSize: 14 }} />
                  </button>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>{nb.name}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55, marginBottom: 14,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {nb.description || 'No description'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>
                  {new Date(nb.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <button
                  className="nb-btn nb-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                  onClick={() => navigate(`/classroom/${classroomId}/personal-resources/notebook/${nb.id}`)}
                >
                  <IoRocketOutline /> Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  </GlassDashboardShell>
);

/* ─────────────────────────────────────────────────────────────
   WORKSPACE VIEW
───────────────────────────────────────────────────────────────*/
const WorkspaceView = ({
  notebookDetail, workspaceLoading, workspaceError, chatError, sourceActionError,
  sources, chatMessages, chatInput, setChatInput, sendingChat, sendMessage,
  sourceTitle, setSourceTitle, sourceText, setSourceText, sourceUrl, setSourceUrl,
  sourceFile, setSourceFile, sourceActionLoading, addTextSource, addUrlSource, addFileSource, removeSource,
  health, models, vectorStats, searchQuery, setSearchQuery, searchResults, searchLoading, studioMessage,
  podcastEpisodeName, setPodcastEpisodeName, podcastLoading, podcastJob, generatePodcast, refreshPodcastJob,
  quizLoading, generatedQuiz, generatedQuizRaw, generateCombinedQuiz,
  reportTopic, setReportTopic, reportLoading, reportText, generateTopicReport, downloadTopicReport,
  audioBriefing, setAudioBriefing, audioLoading, audioOverview, generateAudioPodcast, refreshAudioOverview,
  runSearch, initializeVectorDb, refreshWorkspace, notebookId, classroomId, navigate,
}) => {
  const chatEndRef = useRef(null);
  const [activeAddTab, setActiveAddTab] = useState('text');
  const [activeStudioPanel, setActiveStudioPanel] = useState('search');
  const [workspaceShellOffsetPx, setWorkspaceShellOffsetPx] = useState(() => getWorkspaceShellOffsetPx());

  useEffect(() => {
    const updateWorkspaceShellOffset = () => {
      setWorkspaceShellOffsetPx(getWorkspaceShellOffsetPx());
    };

    updateWorkspaceShellOffset();
    window.addEventListener('resize', updateWorkspaceShellOffset);

    return () => {
      window.removeEventListener('resize', updateWorkspaceShellOffset);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, sendingChat]);

  return (
    <GlassDashboardShell withPanel={false} contentClassName="max-w-[1540px]">
      <div
        className="nb-root nb-root-workspace relative"
        style={{
          height: `calc(100dvh - ${workspaceShellOffsetPx}px)`,
          maxHeight: `calc(100dvh - ${workspaceShellOffsetPx}px)`,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          borderRadius: 16,
          background: 'rgba(31, 41, 55, 0.6)',
          backdropFilter: 'blur(12px)',
          zIndex: 1
        }}
      >
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -2 }}>
        <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>
      <Styles />

      {/* Top bar */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={() => navigate(`/classroom/${classroomId}/personal-resources`)}>
            <IoArrowBackOutline /> Notebooks
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
          <div>
            <p style={{ fontSize: 17, fontWeight: 'bold', color: 'var(--text)', marginTop: 1 }}>
              {notebookDetail?.name || '—'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={() => refreshWorkspace(notebookId)}>
            <IoMapOutline /> Refresh
          </button>
          <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={() => navigate(`/classroom/${classroomId}/modules`)}>
            <IoBookOutline /> Modules
          </button>
        </div>
      </div>

      {/* Error strip */}
      {(workspaceError || chatError || sourceActionError) && (
        <div style={{ padding: '8px 20px', background: 'rgba(248,113,113,0.08)', borderBottom: '1px solid rgba(248,113,113,0.2)', fontSize: 12, color: 'var(--danger)' }}>
          {workspaceError || chatError || sourceActionError}
        </div>
      )}

      {/* 3-column workspace */}
      {workspaceLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Loading workspace…
        </div>
      ) : (
        <div className="nb-workspace-grid">

          {/* ── LEFT: Sources ── */}
          <div className="nb-sources-pane" style={{ borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <IoDocumentTextOutline style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Sources</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 20 }}>
                  {sources.length}
                </span>
              </div>
            </div>

            {/* Add source tabs */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'var(--surface)', padding: 3, borderRadius: 10 }}>
                {['text', 'url', 'file'].map((tab) => (
                  <button key={tab} onClick={() => setActiveAddTab(tab)} style={{
                    flex: 1, padding: '5px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
                    background: activeAddTab === tab ? 'var(--card)' : 'transparent',
                    color: activeAddTab === tab ? 'var(--text)' : 'var(--muted)',
                    transition: 'all .15s',
                  }}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <input className="nb-input" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} placeholder="Title (optional)" style={{ marginBottom: 8 }} />

              {activeAddTab === 'text' && (
                <>
                  <textarea className="nb-input" rows={4} value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="Paste notes or text…" style={{ marginBottom: 8 }} />
                  <button className="nb-btn nb-btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={addTextSource} disabled={sourceActionLoading}>
                    <IoAddOutline /> Add Text
                  </button>
                </>
              )}

              {activeAddTab === 'url' && (
                <>
                  <input className="nb-input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" style={{ marginBottom: 8 }} />
                  <button className="nb-btn nb-btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={addUrlSource} disabled={sourceActionLoading}>
                    <IoLinkOutline /> Import URL
                  </button>
                </>
              )}

              {activeAddTab === 'file' && (
                <>
                  <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '12px', marginBottom: 8, textAlign: 'center' }}>
                    <input type="file" onChange={(e) => setSourceFile(e.target.files?.[0] || null)} style={{ fontSize: 12, color: 'var(--text-dim)', width: '100%' }} />
                  </div>
                  <button className="nb-btn nb-btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={addFileSource} disabled={!sourceFile || sourceActionLoading}>
                    <IoCloudUploadOutline /> Upload File
                  </button>
                </>
              )}
            </div>

            {/* Sources list */}
            <div style={{ flex: 1, overflow: 'hidden', padding: '12px 18px' }}>
              {sources.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--muted)', fontSize: 12 }}>
                  <IoLayersOutline style={{ fontSize: 24, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  No sources yet
                </div>
              ) : sources.map((src) => (
                <div key={src.id} className="nb-source-pill" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{src.source_type} · {src.chunk_count} chunks</p>
                    </div>
                    <button onClick={() => removeSource(src.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0 }}
                      title="Remove">
                      <IoTrashOutline style={{ fontSize: 13 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CENTER: Chat ── */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--ink)' }}>
            <div className="nb-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {chatMessages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 360 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <IoSparklesOutline style={{ color: '#fff', fontSize: 22 }} />
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--text)', marginBottom: 8 }}>Start a conversation</p>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.65 }}>
                    Ask questions about your uploaded sources. The AI will answer using your personal notes.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IoSparklesOutline style={{ color: '#fff', fontSize: 11 }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>AI Assistant</span>
                      </div>
                    )}
                    <div className={`nb-bubble ${msg.role === 'user' ? 'nb-bubble-user' : 'nb-bubble-ai'}`}>
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                      {msg.citationCount > 0 && (
                        <p style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)' }}>
                          <IoFlashOutline style={{ verticalAlign: 'middle', marginRight: 3 }} />
                          {msg.citationCount} source{msg.citationCount > 1 ? 's' : ''} cited
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {sendingChat && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IoSparklesOutline style={{ color: '#fff', fontSize: 11 }} />
                  </div>
                  <div className="nb-typing"><span /><span /><span /></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--card)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                className="nb-input"
                rows={1}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask about your sources… (Enter to send)"
                style={{ flex: 1, resize: 'none', maxHeight: 120 }}
              />
              <button className="nb-btn nb-btn-primary" onClick={sendMessage} disabled={sendingChat} style={{ flexShrink: 0, padding: '10px 18px' }}>
                Send
              </button>
            </div>
          </div>

          {/* ── RIGHT: Studio ── */}
          <div className="nb-studio-pane" style={{ borderLeft: '1px solid var(--border)', overflow: 'hidden', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>Studio</p>

            <div className="nb-stat">
              <p className="nb-stat-label">Storage</p>
              <p className="nb-stat-val" style={{ fontSize: 12 }}>{health?.storage?.sqlite || '—'}</p>
            </div>

            <div className="nb-stat">
              <p className="nb-stat-label">Vector Documents</p>
              <p className="nb-stat-val">{vectorStats?.vector_documents_count ?? '—'}</p>
              <button className="nb-btn nb-btn-ghost nb-btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={initializeVectorDb}>
                Initialize Vector DB
              </button>
            </div>

            <div className="nb-stat">
              <p className="nb-stat-label">Chat Provider</p>
              <p className="nb-stat-val" style={{ fontSize: 12 }}>{models?.default_chat_provider || '—'}</p>
            </div>

            <div className="nb-divider" />

            <div>
              <p className="nb-section-title">Workspace Tools</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {[
                  { id: 'search', label: 'Search' },
                  { id: 'quiz', label: 'Quiz' },
                  { id: 'report', label: 'Report' },
                  { id: 'podcast', label: 'Podcast' },
                  { id: 'audio', label: 'Audio' },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    className="nb-btn nb-btn-sm"
                    style={{
                      padding: '5px 9px',
                      borderRadius: 999,
                      fontSize: 11,
                      border: '1px solid var(--border)',
                      background: activeStudioPanel === tool.id ? 'rgba(108,143,255,0.14)' : 'var(--surface)',
                      color: activeStudioPanel === tool.id ? 'var(--accent)' : 'var(--text-dim)',
                    }}
                    onClick={() => setActiveStudioPanel(tool.id)}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>

              {activeStudioPanel === 'search' && (
                <div className="nb-stat">
                  <p className="nb-stat-label">Semantic Search</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input
                      className="nb-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search notes…"
                      onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                      style={{ flex: 1, fontSize: 12 }}
                    />
                    <button className="nb-btn nb-btn-ghost" style={{ padding: '9px 12px', flexShrink: 0 }} onClick={runSearch} disabled={searchLoading}>
                      <IoSearchOutline />
                    </button>
                  </div>
                  {searchResults.slice(0, 2).map((r, i) => (
                    <div key={`${r.source_id}-${i}`} style={{ marginTop: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{r.title || r.source_id}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {r.snippet || r.content || 'No snippet'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeStudioPanel === 'quiz' && (
                <div className="nb-stat">
                  <p className="nb-stat-label">Quiz Generation</p>
                  <button className="nb-btn nb-btn-primary nb-btn-sm" style={{ marginTop: 8 }} onClick={generateCombinedQuiz} disabled={quizLoading}>
                    {quizLoading ? 'Generating…' : 'Generate Quiz'}
                  </button>
                  {generatedQuiz && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{generatedQuiz.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                        {generatedQuiz.questions.length} questions generated.
                      </p>
                      {generatedQuiz.questions[0] && (
                        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {generatedQuiz.questions[0].question}
                        </p>
                      )}
                    </div>
                  )}
                  {!generatedQuiz && generatedQuizRaw && (
                    <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                      Quiz generated in raw format. Ask again for structured JSON if needed.
                    </p>
                  )}
                </div>
              )}

              {activeStudioPanel === 'report' && (
                <div className="nb-stat">
                  <p className="nb-stat-label">Topic Report</p>
                  <input
                    className="nb-input"
                    value={reportTopic}
                    onChange={(e) => setReportTopic(e.target.value)}
                    placeholder="Enter report topic"
                    style={{ marginTop: 8, fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="nb-btn nb-btn-primary nb-btn-sm" onClick={generateTopicReport} disabled={reportLoading}>
                      {reportLoading ? 'Generating…' : 'Generate'}
                    </button>
                    <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={downloadTopicReport} disabled={!reportText.trim()}>
                      Download .txt
                    </button>
                  </div>
                  {reportText && (
                    <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {reportText}
                    </p>
                  )}
                </div>
              )}

              {activeStudioPanel === 'podcast' && (
                <div className="nb-stat">
                  <p className="nb-stat-label">Podcast Generation</p>
                  <input
                    className="nb-input"
                    value={podcastEpisodeName}
                    onChange={(e) => setPodcastEpisodeName(e.target.value)}
                    placeholder="Episode name (optional)"
                    style={{ marginTop: 8, fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="nb-btn nb-btn-primary nb-btn-sm" onClick={generatePodcast} disabled={podcastLoading}>
                      {podcastLoading ? 'Working…' : 'Generate'}
                    </button>
                    <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={refreshPodcastJob} disabled={podcastLoading || !podcastJob?.job_id}>
                      Refresh
                    </button>
                  </div>
                  {podcastJob && (
                    <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                      Job: {podcastJob.job_id || 'n/a'} · Status: {podcastJob.status || 'unknown'}
                    </p>
                  )}
                </div>
              )}

              {activeStudioPanel === 'audio' && (
                <div className="nb-stat">
                  <p className="nb-stat-label">Audio Podcast</p>
                  <input
                    className="nb-input"
                    value={audioBriefing}
                    onChange={(e) => setAudioBriefing(e.target.value)}
                    placeholder="Optional briefing for audio"
                    style={{ marginTop: 8, fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="nb-btn nb-btn-primary nb-btn-sm" onClick={generateAudioPodcast} disabled={audioLoading}>
                      {audioLoading ? 'Working…' : 'Generate Audio'}
                    </button>
                    <button className="nb-btn nb-btn-ghost nb-btn-sm" onClick={() => refreshAudioOverview()} disabled={audioLoading}>
                      Refresh
                    </button>
                  </div>
                  {audioOverview && (
                    <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                      Status: {audioOverview.status || 'unknown'}{audioOverview.audio_path ? ' · Ready' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>

            {studioMessage && (
              <p style={{ fontSize: 11, color: 'var(--accent)', background: 'rgba(108,143,255,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                {studioMessage}
              </p>
            )}
          </div>
        </div>
      )}
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

  const isWorkspace = Boolean(notebookId);

  const sortedNotebooks = useMemo(() =>
    [...notebooks].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)), [notebooks]);

  const refreshNotebooks = async () => {
    setDashboardLoading(true); setDashboardError('');
    try { const items = await apiClient.get(portablePath('/notebooks')); setNotebooks(Array.isArray(items) ? items : []); }
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
      const created = await apiClient.post(portablePath('/notebooks'), { name, description: newNotebookDescription.trim() });
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
      const res = await apiClient.post(portablePath(`/chat/sessions/${chatSessionId}/messages`), {
        message: `${adaptiveInstruction}\n\nUser request:\n${message}`,
        retrieval_k: 6,
      });
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

    const response = await apiClient.post(portablePath(`/chat/sessions/${activeSessionId}/messages`), {
      message: `${adaptiveInstruction}\n\nTask:\n${message}`,
      retrieval_k: retrievalK,
      temperature: 0.2,
    });

    return response?.answer || '';
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
      runSearch={runSearch} initializeVectorDb={initializeVectorDb}
      refreshWorkspace={refreshWorkspace} notebookId={notebookId} classroomId={classroomId} navigate={navigate}
    />
  );
};

export default StudentPersonalResourcesPage;