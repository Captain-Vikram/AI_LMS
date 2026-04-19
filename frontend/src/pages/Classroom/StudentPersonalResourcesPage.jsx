import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBackOutline,
  IoBookOutline,
  IoCloudUploadOutline,
  IoConstructOutline,
  IoDocumentTextOutline,
  IoLinkOutline,
  IoMapOutline,
  IoSearchOutline,
  IoSparklesOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';
import apiClient from '../../services/apiClient';

const PORTABLE_RAG_PREFIX = '/api/portable-rag';

const portablePath = (path) => `${PORTABLE_RAG_PREFIX}${path}`;

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message, index) => {
      if (typeof message === 'string') {
        return {
          id: `msg-${index}`,
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: message,
        };
      }

      const role =
        message?.role ||
        message?.sender ||
        (message?.answer ? 'assistant' : 'user');

      const content =
        message?.content ||
        message?.message ||
        message?.answer ||
        message?.text ||
        '';

      return {
        id: message?.id || `msg-${index}`,
        role: role === 'assistant' ? 'assistant' : 'user',
        content,
      };
    })
    .filter((message) => message.content);
};

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

  const isWorkspace = Boolean(notebookId);

  const sortedNotebooks = useMemo(() => {
    return [...notebooks].sort((first, second) => {
      return new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime();
    });
  }, [notebooks]);

  const refreshNotebooks = async () => {
    setDashboardLoading(true);
    setDashboardError('');

    try {
      const items = await apiClient.get(portablePath('/notebooks'));
      setNotebooks(Array.isArray(items) ? items : []);
    } catch (error) {
      setDashboardError(error.message || 'Failed to load notebooks');
    } finally {
      setDashboardLoading(false);
    }
  };

  const refreshSources = async () => {
    if (!notebookId) {
      return;
    }

    try {
      const items = await apiClient.get(portablePath(`/sources?notebook_id=${notebookId}`));
      setSources(Array.isArray(items) ? items : []);
    } catch {
      setSources([]);
    }
  };

  const refreshVectorStats = async () => {
    try {
      const stats = await apiClient.get(portablePath('/vector-db/stats'));
      setVectorStats(stats);
    } catch {
      setVectorStats(null);
    }
  };

  const ensureChatSession = async (currentNotebookId) => {
    const sessions = await apiClient.get(
      portablePath(`/chat/sessions?notebook_id=${currentNotebookId}`)
    );

    if (Array.isArray(sessions) && sessions.length > 0) {
      return sessions[0];
    }

    return apiClient.post(portablePath('/chat/sessions'), {
      notebook_id: currentNotebookId,
      title: 'Personal Workspace Chat',
    });
  };

  const refreshWorkspace = async (currentNotebookId) => {
    setWorkspaceLoading(true);
    setWorkspaceError('');
    setChatError('');

    try {
      const [detailResult, sourcesResult, healthResult, modelsResult] = await Promise.all([
        apiClient.get(portablePath(`/notebooks/${currentNotebookId}`)),
        apiClient.get(portablePath(`/sources?notebook_id=${currentNotebookId}`)),
        apiClient.get(portablePath('/health')),
        apiClient.get(portablePath('/models')),
      ]);

      setNotebookDetail(detailResult);
      setSources(Array.isArray(sourcesResult) ? sourcesResult : []);
      setHealth(healthResult);
      setModels(modelsResult);

      const activeSession = await ensureChatSession(currentNotebookId);
      setChatSessionId(activeSession.id);

      const sessionDetail = await apiClient.get(
        portablePath(`/chat/sessions/${activeSession.id}`)
      );
      setChatMessages(normalizeMessages(sessionDetail?.messages));

      await refreshVectorStats();
    } catch (error) {
      setWorkspaceError(error.message || 'Failed to load personal workspace');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    if (!isWorkspace) {
      refreshNotebooks();
      return;
    }

    refreshWorkspace(notebookId);
  }, [isWorkspace, notebookId]);

  const createNotebook = async () => {
    const name = newNotebookName.trim();
    if (!name) {
      setDashboardError('Notebook name is required');
      return;
    }

    setCreatingNotebook(true);
    setDashboardError('');
    setDashboardInfo('');

    try {
      const created = await apiClient.post(portablePath('/notebooks'), {
        name,
        description: newNotebookDescription.trim(),
      });

      setDashboardInfo('Notebook created. Opening workspace...');
      setNewNotebookName('');
      setNewNotebookDescription('');
      navigate(`/classroom/${classroomId}/personal-resources/notebook/${created.id}`);
    } catch (error) {
      setDashboardError(error.message || 'Failed to create notebook');
    } finally {
      setCreatingNotebook(false);
    }
  };

  const deleteNotebook = async (targetNotebookId) => {
    const shouldDelete = window.confirm(
      'Delete this notebook and its personal notes? This cannot be undone.'
    );
    if (!shouldDelete) {
      return;
    }

    setDashboardError('');
    setDashboardInfo('');
    try {
      await apiClient.delete(portablePath(`/notebooks/${targetNotebookId}`));
      setDashboardInfo('Notebook deleted successfully.');
      await refreshNotebooks();
    } catch (error) {
      setDashboardError(error.message || 'Failed to delete notebook');
    }
  };

  const addTextSource = async () => {
    const content = sourceText.trim();
    if (!content || !notebookId) {
      return;
    }

    setSourceActionLoading(true);
    setSourceActionError('');

    try {
      await apiClient.post(portablePath('/sources/text'), {
        notebook_id: notebookId,
        title: sourceTitle.trim() || 'Quick note',
        content,
        embed: true,
      });

      setSourceTitle('');
      setSourceText('');
      await refreshSources();
      await refreshVectorStats();
    } catch (error) {
      setSourceActionError(error.message || 'Failed to add text source');
    } finally {
      setSourceActionLoading(false);
    }
  };

  const addUrlSource = async () => {
    const url = sourceUrl.trim();
    if (!url || !notebookId) {
      return;
    }

    setSourceActionLoading(true);
    setSourceActionError('');

    try {
      await apiClient.post(portablePath('/sources/url'), {
        notebook_id: notebookId,
        url,
        title: sourceTitle.trim() || null,
        embed: true,
      });

      setSourceUrl('');
      await refreshSources();
      await refreshVectorStats();
    } catch (error) {
      setSourceActionError(error.message || 'Failed to add URL source');
    } finally {
      setSourceActionLoading(false);
    }
  };

  const addFileSource = async () => {
    if (!sourceFile || !notebookId) {
      return;
    }

    setSourceActionLoading(true);
    setSourceActionError('');

    try {
      const form = new FormData();
      form.append('notebook_id', notebookId);
      form.append('file', sourceFile);
      if (sourceTitle.trim()) {
        form.append('title', sourceTitle.trim());
      }

      await apiClient.post(portablePath('/sources/file'), form);
      setSourceFile(null);
      await refreshSources();
      await refreshVectorStats();
    } catch (error) {
      setSourceActionError(error.message || 'Failed to upload source file');
    } finally {
      setSourceActionLoading(false);
    }
  };

  const removeSource = async (sourceId) => {
    setSourceActionLoading(true);
    setSourceActionError('');

    try {
      await apiClient.delete(portablePath(`/sources/${sourceId}`));
      await refreshSources();
      await refreshVectorStats();
    } catch (error) {
      setSourceActionError(error.message || 'Failed to remove source');
    } finally {
      setSourceActionLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatSessionId || !chatInput.trim()) {
      return;
    }

    const message = chatInput.trim();
    setChatInput('');
    setChatError('');
    setSendingChat(true);

    setChatMessages((previous) => [
      ...previous,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
      },
    ]);

    try {
      const response = await apiClient.post(
        portablePath(`/chat/sessions/${chatSessionId}/messages`),
        {
          message,
          retrieval_k: 6,
        }
      );

      const answer = response?.answer || 'No response generated.';
      const citationCount = Array.isArray(response?.citation_map)
        ? response.citation_map.length
        : 0;

      setChatMessages((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
          citationCount,
        },
      ]);
    } catch (error) {
      setChatError(error.message || 'Failed to send chat message');
    } finally {
      setSendingChat(false);
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim() || !notebookId) {
      return;
    }

    setSearchLoading(true);
    setStudioMessage('');

    try {
      const response = await apiClient.post(portablePath('/search'), {
        notebook_id: notebookId,
        query: searchQuery.trim(),
        k: 5,
      });

      setSearchResults(Array.isArray(response?.results) ? response.results : []);
    } catch (error) {
      setStudioMessage(error.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const initializeVectorDb = async () => {
    setStudioMessage('');
    try {
      const initialized = await apiClient.post(portablePath('/vector-db/init'), {});
      setVectorStats(initialized);
      setStudioMessage('Vector DB initialized for current data.');
    } catch (error) {
      setStudioMessage(error.message || 'Vector initialization failed');
    }
  };

  if (!isWorkspace) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-cyan-300">Student Personal Resources</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-100">Personal AI Learning Workspace</h1>
            <p className="mt-2 text-sm text-gray-300">
              Build your own private NotebookLM-style space with sources, retrieval chat, and study outputs.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 lg:col-span-1">
              <h2 className="text-lg font-semibold text-gray-100">New Notebook</h2>
              <p className="mt-1 text-sm text-gray-400">Create a personal workspace notebook.</p>

              <div className="mt-4 space-y-3">
                <input
                  value={newNotebookName}
                  onChange={(event) => setNewNotebookName(event.target.value)}
                  placeholder="Notebook name"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-gray-100"
                />
                <textarea
                  value={newNotebookDescription}
                  onChange={(event) => setNewNotebookDescription(event.target.value)}
                  rows={3}
                  placeholder="Description (optional)"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-gray-100"
                />
                <button
                  type="button"
                  onClick={createNotebook}
                  disabled={creatingNotebook}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <IoAddOutline /> {creatingNotebook ? 'Creating...' : 'Create Notebook'}
                </button>
              </div>

              {(dashboardError || dashboardInfo) && (
                <p className={`mt-3 text-xs ${dashboardError ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {dashboardError || dashboardInfo}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-5 lg:col-span-2">
              <div className="flex items-start gap-3">
                <IoConstructOutline className="mt-0.5 text-xl text-amber-300" />
                <div>
                  <h2 className="text-lg font-semibold text-amber-100">NotebookLM Dummy Workspace</h2>
                  <p className="mt-1 text-sm text-amber-100/85">
                    This version is intentionally lightweight: source ingestion, chat sessions, vector stats, and retrieval search.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">Your Personal Notebooks</h2>
              <button
                type="button"
                onClick={refreshNotebooks}
                disabled={dashboardLoading}
                className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-800"
              >
                Refresh
              </button>
            </div>

            {dashboardLoading ? (
              <p className="text-sm text-gray-400">Loading notebooks...</p>
            ) : sortedNotebooks.length === 0 ? (
              <p className="text-sm text-gray-400">No personal notebooks yet. Create one to start.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sortedNotebooks.map((notebook) => (
                  <article
                    key={notebook.id}
                    className="rounded-lg border border-gray-700 bg-gray-950/50 p-4"
                  >
                    <h3 className="text-sm font-semibold text-gray-100">{notebook.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                      {notebook.description || 'No description'}
                    </p>
                    <p className="mt-2 text-[11px] text-gray-500">Updated: {new Date(notebook.updated_at).toLocaleString()}</p>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/classroom/${classroomId}/personal-resources/notebook/${notebook.id}`)
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500"
                      >
                        <IoSparklesOutline /> Open
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNotebook(notebook.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/10"
                      >
                        <IoTrashOutline /> Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
            <h2 className="text-lg font-semibold text-gray-100">Current Access</h2>
            <p className="mt-2 text-sm text-gray-400">
              Teacher-assigned modules, quizzes, and classroom progression remain available in the Modules section.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
              >
                <IoArrowBackOutline /> Back to Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate(`/classroom/${classroomId}/modules`)}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              >
                <IoBookOutline /> Open Classroom Modules
              </button>
            </div>
          </div>
        </div>
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-[1600px]" panelClassName="p-4 md:p-5">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300">Notebook Workspace</p>
            <h1 className="text-lg font-semibold text-gray-100">
              {notebookDetail?.name || 'Loading notebook...'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/classroom/${classroomId}/personal-resources`)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-800"
            >
              <IoArrowBackOutline /> Notebook List
            </button>
            <button
              type="button"
              onClick={() => refreshWorkspace(notebookId)}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs text-white hover:bg-cyan-500"
            >
              <IoMapOutline /> Refresh Workspace
            </button>
          </div>
        </div>

        {(workspaceError || chatError || sourceActionError) && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {workspaceError || chatError || sourceActionError}
          </div>
        )}

        {workspaceLoading ? (
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-300">
            Loading personal workspace...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 xl:col-span-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <IoDocumentTextOutline className="text-cyan-300" /> Sources
              </h2>

              <div className="mt-3 space-y-2">
                <input
                  value={sourceTitle}
                  onChange={(event) => setSourceTitle(event.target.value)}
                  placeholder="Source title (optional)"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/70 px-2.5 py-2 text-xs text-gray-100"
                />
                <textarea
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  rows={4}
                  placeholder="Paste notes/text..."
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/70 px-2.5 py-2 text-xs text-gray-100"
                />
                <button
                  type="button"
                  onClick={addTextSource}
                  disabled={sourceActionLoading}
                  className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-70"
                >
                  Add Text Source
                </button>

                <div className="h-px bg-gray-700" />

                <div className="flex gap-2">
                  <input
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://example.com/article"
                    className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950/70 px-2.5 py-2 text-xs text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={addUrlSource}
                    disabled={sourceActionLoading}
                    className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/10"
                  >
                    <IoLinkOutline />
                  </button>
                </div>

                <div className="rounded-lg border border-dashed border-gray-600 p-2.5">
                  <input
                    type="file"
                    onChange={(event) => setSourceFile(event.target.files?.[0] || null)}
                    className="w-full text-xs text-gray-300"
                  />
                  <button
                    type="button"
                    onClick={addFileSource}
                    disabled={!sourceFile || sourceActionLoading}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs text-white hover:bg-gray-600 disabled:opacity-60"
                  >
                    <IoCloudUploadOutline /> Upload File
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                  Linked Sources ({sources.length})
                </h3>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {sources.length === 0 ? (
                    <p className="text-xs text-gray-500">No sources yet.</p>
                  ) : (
                    sources.map((source) => (
                      <div key={source.id} className="rounded-lg border border-gray-700 bg-gray-950/60 p-2.5">
                        <p className="text-xs font-medium text-gray-100">{source.title}</p>
                        <p className="text-[11px] text-gray-500">{source.source_type} • chunks {source.chunk_count}</p>
                        <button
                          type="button"
                          onClick={() => removeSource(source.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200"
                        >
                          <IoTrashOutline /> Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 xl:col-span-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <IoSparklesOutline className="text-cyan-300" /> Chat
              </h2>

              <div className="mt-3 h-[52vh] space-y-3 overflow-y-auto rounded-lg border border-gray-700 bg-gray-950/40 p-3">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Ask a question about your uploaded notes and sources.
                  </p>
                ) : (
                  chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        message.role === 'assistant'
                          ? 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-50'
                          : 'border border-gray-700 bg-gray-800 text-gray-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.citationCount > 0 && (
                        <p className="mt-1 text-[11px] text-cyan-200">
                          Citations: {message.citationCount}
                        </p>
                      )}
                    </div>
                  ))
                )}
                {sendingChat && <p className="text-xs text-gray-400">Generating response...</p>}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask about your personal sources..."
                  className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-gray-100"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sendingChat}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-70"
                >
                  Send
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 xl:col-span-3">
              <h2 className="text-sm font-semibold text-gray-100">Studio</h2>

              <div className="mt-3 space-y-3 text-xs">
                <div className="rounded-lg border border-gray-700 bg-gray-950/60 p-2.5">
                  <p className="text-gray-300">Storage</p>
                  <p className="mt-1 text-gray-100">{health?.storage?.sqlite || 'Unknown'}</p>
                </div>

                <div className="rounded-lg border border-gray-700 bg-gray-950/60 p-2.5">
                  <p className="text-gray-300">Vector Docs</p>
                  <p className="mt-1 text-gray-100">{vectorStats?.vector_documents_count ?? 'n/a'}</p>
                  <button
                    type="button"
                    onClick={initializeVectorDb}
                    className="mt-2 rounded-lg border border-cyan-400/40 px-2.5 py-1 text-[11px] text-cyan-200 hover:bg-cyan-500/10"
                  >
                    Initialize Vector DB
                  </button>
                </div>

                <div className="rounded-lg border border-gray-700 bg-gray-950/60 p-2.5">
                  <p className="text-gray-300">Default Chat Provider</p>
                  <p className="mt-1 text-gray-100">{models?.default_chat_provider || 'unknown'}</p>
                </div>

                <div className="rounded-lg border border-gray-700 bg-gray-950/60 p-2.5">
                  <p className="text-gray-300">Semantic Search</p>
                  <div className="mt-2 flex gap-1.5">
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search notes"
                      className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={runSearch}
                      disabled={searchLoading}
                      className="rounded-lg bg-gray-700 px-2 py-1.5 text-xs text-white hover:bg-gray-600"
                    >
                      <IoSearchOutline />
                    </button>
                  </div>

                  <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {searchResults.map((result, index) => (
                      <div key={`${result.source_id}-${index}`} className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5">
                        <p className="text-[11px] text-gray-200">{result.title || result.source_id}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-400">
                          {result.snippet || result.content || 'No snippet'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {studioMessage && <p className="text-[11px] text-amber-200">{studioMessage}</p>}

                <button
                  type="button"
                  onClick={() => navigate(`/classroom/${classroomId}/modules`)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  <IoBookOutline /> Classroom Modules
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </GlassDashboardShell>
  );
};

export default StudentPersonalResourcesPage;
