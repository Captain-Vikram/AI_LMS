import React, { useCallback, useMemo, useState } from 'react';
import {
  IoCheckmarkCircleOutline,
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoLayersOutline,
  IoRefreshOutline,
  IoSaveOutline,
  IoSparklesOutline,
} from 'react-icons/io5';
import apiClient from '../../services/apiClient';

const CATEGORY_META = {
  scenario: {
    title: 'Scenario Based Questions',
    gradingMode: 'Teacher review only',
    description:
      'AI creates 3 sets of 2 long-form questions (default 5 marks each). Teacher selects one set and can edit everything.',
  },
  ppt: {
    title: 'PDF or PPT Assessment',
    gradingMode: 'AI partial + teacher scrutiny',
    description:
      'AI proposes 6 presentation topics and a format guide. Teacher can edit topics and final submission format.',
  },
  article: {
    title: 'Article or Blog Writing',
    gradingMode: 'AI full grading',
    description:
      'AI proposes 6 writing topics. Student submits a link, and AI evaluates content relevance against module topics and sources.',
  },
  research: {
    title: 'Research Paper (LaTeX Template)',
    gradingMode: 'AI full grading + template alignment',
    description:
      'Teacher provides a .tex template. AI proposes 6 research topics and grades uploaded LaTeX submissions for structure and content alignment.',
  },
};

const safeTrim = (value) => String(value || '').trim();

const getModuleName = (module) =>
  safeTrim(module?.name) || safeTrim(module?.title) || 'Untitled Module';

const getModuleSources = (module) => {
  const resources = Array.isArray(module?.resources) ? module.resources : [];

  return resources
    .map((resource, index) => {
      const title =
        safeTrim(resource?.title) ||
        safeTrim(resource?.name) ||
        `Source ${index + 1}`;
      const description =
        safeTrim(resource?.description) ||
        safeTrim(resource?.summary) ||
        '';
      const url =
        safeTrim(resource?.url) ||
        safeTrim(resource?.youtube_url) ||
        safeTrim(resource?.youtube_link) ||
        '';

      return {
        id: safeTrim(resource?.id) || safeTrim(resource?.resource_id) || `source-${index + 1}`,
        title,
        description,
        url,
      };
    })
    .filter((source) => source.title);
};

const dedupeList = (values = []) => {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const normalized = safeTrim(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(normalized);
  });

  return result;
};

const buildSeedTopics = (module, moduleName, sources) => {
  const objectives = Array.isArray(module?.objectives) ? module.objectives : [];
  const skills = Array.isArray(module?.target_skills) ? module.target_skills : [];

  const objectiveSeeds = objectives
    .map((objective) => {
      if (typeof objective === 'string') {
        return objective;
      }
      return objective?.title || objective?.name || objective?.text || '';
    })
    .filter(Boolean);

  const sourceSeeds = sources
    .map((source) => source.title)
    .filter(Boolean);

  const baseSeeds = dedupeList([
    ...skills,
    ...objectiveSeeds,
    ...sourceSeeds,
    `Real world application of ${moduleName}`,
    `${moduleName} pitfalls and trade-offs`,
    `${moduleName} implementation strategy`,
    `${moduleName} best practices`,
  ]);

  if (baseSeeds.length >= 6) {
    return baseSeeds.slice(0, 12);
  }

  const padded = [...baseSeeds];
  while (padded.length < 6) {
    padded.push(`${moduleName} concept ${padded.length + 1}`);
  }

  return padded.slice(0, 12);
};

const buildDefaultQuestionPrompt = (moduleName, seed, index) =>
  `Using ${seed}, explain a real-life scenario where ${moduleName} decisions affect outcomes. Include constraints, trade-offs, and recommended actions.`;

const buildScenarioSetFromPrompts = (setIndex, prompts = []) => ({
  id: `scenario-set-${setIndex + 1}`,
  title: `Scenario Set ${setIndex + 1}`,
  review_note: 'Teacher review required before release.',
  questions: prompts.map((prompt, questionIndex) => ({
    id: `set-${setIndex + 1}-q-${questionIndex + 1}`,
    prompt,
    marks: 5,
    expected_length: '150-220 words',
    rubric:
      'Assess conceptual correctness, practical reasoning, and clarity of explanation.',
  })),
});

const buildDefaultScenarioSets = (moduleName, seeds = []) => {
  const prompts = [];
  for (let index = 0; index < 6; index += 1) {
    const seed = seeds[index % Math.max(1, seeds.length)] || `${moduleName} concept ${index + 1}`;
    prompts.push(buildDefaultQuestionPrompt(moduleName, seed, index));
  }

  return [0, 1, 2].map((setIndex) => {
    const start = setIndex * 2;
    return buildScenarioSetFromPrompts(setIndex, prompts.slice(start, start + 2));
  });
};

const ensureSixPrompts = (moduleName, seeds, incomingPrompts = []) => {
  const cleaned = incomingPrompts
    .map((prompt) => safeTrim(prompt))
    .filter(Boolean)
    .slice(0, 6);

  if (cleaned.length >= 6) {
    return cleaned;
  }

  const padded = [...cleaned];
  for (let index = padded.length; index < 6; index += 1) {
    const seed = seeds[index % Math.max(1, seeds.length)] || `${moduleName} concept ${index + 1}`;
    padded.push(buildDefaultQuestionPrompt(moduleName, seed, index));
  }

  return padded;
};

const splitIntoThreeSets = (moduleName, seeds, prompts) => {
  const sixPrompts = ensureSixPrompts(moduleName, seeds, prompts);

  return [0, 1, 2].map((setIndex) => {
    const start = setIndex * 2;
    return buildScenarioSetFromPrompts(setIndex, sixPrompts.slice(start, start + 2));
  });
};

const buildTopicList = (moduleName, seeds, template) => {
  const topics = [];

  for (let index = 0; index < 6; index += 1) {
    const seed = seeds[index % Math.max(1, seeds.length)] || `${moduleName} concept ${index + 1}`;
    topics.push({
      id: `${template}-${index + 1}`,
      title: `${seed}`,
      scope: `${seed}: context, methods, measurable outcomes`,
      deliverable: template,
    });
  }

  return topics;
};

const parseStoredPayload = (rawValue) => {
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const cloneState = (value) => JSON.parse(JSON.stringify(value));

const ModuleAssessmentWorkflowPrototype = ({ moduleId, module, onPublished }) => {
  const moduleName = useMemo(() => getModuleName(module), [module]);
  const moduleSources = useMemo(() => getModuleSources(module), [module]);
  const seedTopics = useMemo(
    () => buildSeedTopics(module, moduleName, moduleSources),
    [module, moduleName, moduleSources]
  );

  const storageKey = useMemo(
    () => `module-assessment-workflow-prototype:${moduleId || 'unknown'}`,
    [moduleId]
  );

  const defaultScenarioSets = useMemo(
    () => buildDefaultScenarioSets(moduleName, seedTopics),
    [moduleName, seedTopics]
  );

  const defaultPptTopics = useMemo(
    () => buildTopicList(moduleName, seedTopics, 'PDF/PPT presentation deck'),
    [moduleName, seedTopics]
  );

  const defaultArticleTopics = useMemo(
    () => buildTopicList(moduleName, seedTopics, 'Article or blog post (1000-1500 words)'),
    [moduleName, seedTopics]
  );

  const defaultResearchTopics = useMemo(
    () => buildTopicList(moduleName, seedTopics, 'Research paper (LaTeX based)'),
    [moduleName, seedTopics]
  );

  const [activeCategory, setActiveCategory] = useState('scenario');
  const [finalCategory, setFinalCategory] = useState('scenario');
  const [selectedScenarioSetId, setSelectedScenarioSetId] = useState('scenario-set-1');

  const [scenarioSets, setScenarioSets] = useState(() => cloneState(defaultScenarioSets));
  const [pptTopics, setPptTopics] = useState(() => cloneState(defaultPptTopics));
  const [articleTopics, setArticleTopics] = useState(() => cloneState(defaultArticleTopics));
  const [researchTopics, setResearchTopics] = useState(() => cloneState(defaultResearchTopics));

  const [pptFormatGuide, setPptFormatGuide] = useState(
    'Format: 10-12 slides or 4-6 page PDF. Include problem statement, concept explanation, real-world use case, and references.'
  );
  const [articleFormatGuide, setArticleFormatGuide] = useState(
    'Format: structured article with heading, abstract, core discussion, source references, and concluding insights.'
  );
  const [researchFormatGuide, setResearchFormatGuide] = useState(
    'Format: follow teacher-provided LaTeX template strictly (section order, citation style, tables/figures format).' 
  );

  const [latexTemplateName, setLatexTemplateName] = useState('');
  const [finalizedAt, setFinalizedAt] = useState('');

  const [loadingScenario, setLoadingScenario] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedScenarioSet = useMemo(
    () =>
      scenarioSets.find((scenarioSet) => scenarioSet.id === selectedScenarioSetId) ||
      scenarioSets[0] ||
      null,
    [scenarioSets, selectedScenarioSetId]
  );

  const finalBlueprint = useMemo(() => {
    if (finalCategory === 'scenario') {
      return {
        category: finalCategory,
        category_label: CATEGORY_META[finalCategory].title,
        grading_mode: CATEGORY_META[finalCategory].gradingMode,
        selected_set_id: selectedScenarioSet?.id || null,
        selected_set_title: selectedScenarioSet?.title || null,
        question_sets: scenarioSets,
      };
    }

    if (finalCategory === 'ppt') {
      return {
        category: finalCategory,
        category_label: CATEGORY_META[finalCategory].title,
        grading_mode: CATEGORY_META[finalCategory].gradingMode,
        topics: pptTopics,
        format_guide: pptFormatGuide,
      };
    }

    if (finalCategory === 'article') {
      return {
        category: finalCategory,
        category_label: CATEGORY_META[finalCategory].title,
        grading_mode: CATEGORY_META[finalCategory].gradingMode,
        topics: articleTopics,
        format_guide: articleFormatGuide,
        ai_link_grading: {
          enabled: true,
          checks: [
            'Fetch and parse submitted URL content',
            'Topic alignment with selected prompt',
            'Source and subject relevance score',
          ],
        },
      };
    }

    return {
      category: finalCategory,
      category_label: CATEGORY_META[finalCategory].title,
      grading_mode: CATEGORY_META[finalCategory].gradingMode,
      topics: researchTopics,
      format_guide: researchFormatGuide,
      latex_template_name: latexTemplateName || null,
      ai_template_alignment: {
        enabled: true,
        checks: [
          'Template structure compliance',
          'Section-level content relevance',
          'Topic-source alignment',
        ],
      },
    };
  }, [
    finalCategory,
    scenarioSets,
    selectedScenarioSet,
    pptTopics,
    pptFormatGuide,
    articleTopics,
    articleFormatGuide,
    researchTopics,
    researchFormatGuide,
    latexTemplateName,
  ]);

  const applyStoredState = useCallback(
    (stored) => {
      const nextActiveCategory = CATEGORY_META[stored?.activeCategory]
        ? stored.activeCategory
        : 'scenario';
      const nextFinalCategory = CATEGORY_META[stored?.finalCategory]
        ? stored.finalCategory
        : 'scenario';

      setActiveCategory(nextActiveCategory);
      setFinalCategory(nextFinalCategory);
      setSelectedScenarioSetId(stored?.selectedScenarioSetId || 'scenario-set-1');

      setScenarioSets(
        Array.isArray(stored?.scenarioSets) && stored.scenarioSets.length > 0
          ? stored.scenarioSets
          : cloneState(defaultScenarioSets)
      );

      setPptTopics(
        Array.isArray(stored?.pptTopics) && stored.pptTopics.length > 0
          ? stored.pptTopics
          : cloneState(defaultPptTopics)
      );

      setArticleTopics(
        Array.isArray(stored?.articleTopics) && stored.articleTopics.length > 0
          ? stored.articleTopics
          : cloneState(defaultArticleTopics)
      );

      setResearchTopics(
        Array.isArray(stored?.researchTopics) && stored.researchTopics.length > 0
          ? stored.researchTopics
          : cloneState(defaultResearchTopics)
      );

      setPptFormatGuide(
        safeTrim(stored?.pptFormatGuide) ||
          'Format: 10-12 slides or 4-6 page PDF. Include problem statement, concept explanation, real-world use case, and references.'
      );

      setArticleFormatGuide(
        safeTrim(stored?.articleFormatGuide) ||
          'Format: structured article with heading, abstract, core discussion, source references, and concluding insights.'
      );

      setResearchFormatGuide(
        safeTrim(stored?.researchFormatGuide) ||
          'Format: follow teacher-provided LaTeX template strictly (section order, citation style, tables/figures format).'
      );

      setLatexTemplateName(safeTrim(stored?.latexTemplateName) || '');
      setFinalizedAt(safeTrim(stored?.finalizedAt) || '');
    },
    [defaultScenarioSets, defaultPptTopics, defaultArticleTopics, defaultResearchTopics]
  );

  const handleLoadPrototype = useCallback(() => {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      setError('No saved prototype found for this module.');
      setMessage('');
      return;
    }

    const stored = parseStoredPayload(rawValue);
    if (!stored) {
      setError('Saved prototype data is invalid. Reset and create a new one.');
      setMessage('');
      return;
    }

    applyStoredState(stored);
    setError('');
    setMessage('Saved prototype loaded successfully.');
  }, [applyStoredState, storageKey]);

  const handleSavePrototype = useCallback(() => {
    const payload = {
      version: 1,
      activeCategory,
      finalCategory,
      selectedScenarioSetId,
      scenarioSets,
      pptTopics,
      articleTopics,
      researchTopics,
      pptFormatGuide,
      articleFormatGuide,
      researchFormatGuide,
      latexTemplateName,
      finalizedAt,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
    setError('');
    setMessage('Prototype saved locally for this module.');
  }, [
    activeCategory,
    finalCategory,
    selectedScenarioSetId,
    scenarioSets,
    pptTopics,
    articleTopics,
    researchTopics,
    pptFormatGuide,
    articleFormatGuide,
    researchFormatGuide,
    latexTemplateName,
    finalizedAt,
    storageKey,
  ]);

  const resetToDefaults = useCallback(() => {
    setActiveCategory('scenario');
    setFinalCategory('scenario');
    setSelectedScenarioSetId('scenario-set-1');

    setScenarioSets(cloneState(defaultScenarioSets));
    setPptTopics(cloneState(defaultPptTopics));
    setArticleTopics(cloneState(defaultArticleTopics));
    setResearchTopics(cloneState(defaultResearchTopics));

    setPptFormatGuide(
      'Format: 10-12 slides or 4-6 page PDF. Include problem statement, concept explanation, real-world use case, and references.'
    );
    setArticleFormatGuide(
      'Format: structured article with heading, abstract, core discussion, source references, and concluding insights.'
    );
    setResearchFormatGuide(
      'Format: follow teacher-provided LaTeX template strictly (section order, citation style, tables/figures format).'
    );

    setLatexTemplateName('');
    setFinalizedAt('');
    setError('');
    setMessage('Prototype reset to module-based defaults.');
  }, [defaultScenarioSets, defaultPptTopics, defaultArticleTopics, defaultResearchTopics]);

  const handleResetPrototype = useCallback(() => {
    localStorage.removeItem(storageKey);
    resetToDefaults();
  }, [resetToDefaults, storageKey]);

  const updateScenarioSet = (setId, updater) => {
    setScenarioSets((previous) =>
      previous.map((scenarioSet) =>
        scenarioSet.id === setId
          ? {
              ...scenarioSet,
              ...updater,
            }
          : scenarioSet
      )
    );
  };

  const updateScenarioQuestion = (setId, questionId, field, value) => {
    setScenarioSets((previous) =>
      previous.map((scenarioSet) => {
        if (scenarioSet.id !== setId) {
          return scenarioSet;
        }

        return {
          ...scenarioSet,
          questions: (scenarioSet.questions || []).map((question) => {
            if (question.id !== questionId) {
              return question;
            }

            return {
              ...question,
              [field]: field === 'marks' ? Math.max(1, Number(value || 0)) : value,
            };
          }),
        };
      })
    );
  };

  const updateTopicList = (setter, topicId, field, value) => {
    setter((previous) =>
      previous.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              [field]: value,
            }
          : topic
      )
    );
  };

  const addTopic = (setter, label) => {
    setter((previous) => [
      ...previous,
      {
        id: `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        title: `${moduleName} topic`,
        scope: 'Explain objective, method, and expected outcomes.',
        deliverable: label,
      },
    ]);
  };

  const removeTopic = (setter, topicId) => {
    setter((previous) => previous.filter((topic) => topic.id !== topicId));
  };

  const regenerateTopics = (type) => {
    if (type === 'ppt') {
      setPptTopics(buildTopicList(moduleName, seedTopics, 'PDF/PPT presentation deck'));
      setMessage('AI topic suggestions refreshed for PDF/PPT assessment.');
      setError('');
      return;
    }

    if (type === 'article') {
      setArticleTopics(
        buildTopicList(moduleName, seedTopics, 'Article or blog post (1000-1500 words)')
      );
      setMessage('AI topic suggestions refreshed for article/blog assessment.');
      setError('');
      return;
    }

    setResearchTopics(buildTopicList(moduleName, seedTopics, 'Research paper (LaTeX based)'));
    setMessage('AI topic suggestions refreshed for research-paper assessment.');
    setError('');
  };

  const handleGenerateScenarioSets = async () => {
    if (!moduleId) {
      setError('Module id is missing. Open this page from a specific classroom module.');
      setMessage('');
      return;
    }

    setLoadingScenario(true);
    setError('');
    setMessage('');

    try {
      const response = await apiClient.post('/api/module-assessment/draft-generate', {
        module_id: moduleId,
        num_questions: 6,
        question_types: ['short_answer'],
      });

      const aiPrompts = Array.isArray(response?.questions)
        ? response.questions.map((question) => question?.question_text || '')
        : [];

      const generatedSets = splitIntoThreeSets(moduleName, seedTopics, aiPrompts);
      setScenarioSets(generatedSets);
      setSelectedScenarioSetId(generatedSets[0]?.id || 'scenario-set-1');

      setMessage(
        response?.message ||
          'AI generated scenario sets from module sources. Teacher can now select and edit one set.'
      );
    } catch (requestError) {
      const fallbackSets = buildDefaultScenarioSets(moduleName, seedTopics);
      setScenarioSets(fallbackSets);
      setSelectedScenarioSetId(fallbackSets[0]?.id || 'scenario-set-1');

      setError(requestError?.message || 'AI generation failed. Loaded editable template question sets.');
      setMessage('Fallback template created from current module context.');
    } finally {
      setLoadingScenario(false);
    }
  };

  const handleLatexTemplateSelect = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    setLatexTemplateName(file.name);
    setError('');
    setMessage('Template file selected. Backend upload API is required for persistent storage.');
  };

  const handleFinalize = () => {
    const now = new Date().toISOString();
    setFinalizedAt(now);
    setError('');
    setMessage(
      `${CATEGORY_META[finalCategory].title} marked as the final assessment category for this module.`
    );

    onPublished?.({
      mode: 'prototype',
      finalized_at: now,
      final_blueprint: finalBlueprint,
    });
  };

  const renderTopicEditor = (label, topics, setter, type) => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-cyan-100">{label}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => regenerateTopics(type)}
            className="rounded-md border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 hover:border-cyan-300/70"
          >
            Refresh 6 AI Topics
          </button>
          <button
            type="button"
            onClick={() => addTopic(setter, label)}
            className="rounded-md border border-slate-400/40 bg-slate-700/40 px-3 py-1 text-xs text-slate-100 hover:border-slate-300/70"
          >
            Add Topic
          </button>
        </div>
      </div>

      {topics.map((topic, index) => (
        <article
          key={topic.id}
          className="rounded-lg border border-slate-600/70 bg-slate-900/70 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-slate-300">Topic {index + 1}</p>
            <button
              type="button"
              onClick={() => removeTopic(setter, topic.id)}
              className="rounded-md border border-rose-400/50 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 hover:border-rose-300"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <input
              type="text"
              value={topic.title || ''}
              onChange={(event) =>
                updateTopicList(setter, topic.id, 'title', event.target.value)
              }
              placeholder="Topic title"
              className="w-full rounded-md border border-slate-500/50 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
            <textarea
              value={topic.scope || ''}
              onChange={(event) =>
                updateTopicList(setter, topic.id, 'scope', event.target.value)
              }
              rows={2}
              placeholder="Scope and objective"
              className="w-full rounded-md border border-slate-500/50 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
            <input
              type="text"
              value={topic.deliverable || ''}
              onChange={(event) =>
                updateTopicList(setter, topic.id, 'deliverable', event.target.value)
              }
              placeholder="Deliverable format"
              className="w-full rounded-md border border-slate-500/50 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <section className="space-y-5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
      <header className="space-y-2">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-cyan-100">
          <IoDocumentTextOutline />
          Assessment Workflow Studio (Prototype)
        </h2>
        <p className="text-sm text-cyan-100/80">
          Configure 4 assessment categories, edit AI suggestions, and mark exactly one category
          as the module final assessment.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Object.entries(CATEGORY_META).map(([categoryKey, meta]) => {
          const isActive = activeCategory === categoryKey;
          const isFinal = finalCategory === categoryKey;

          return (
            <article
              key={categoryKey}
              className={`rounded-lg border p-4 ${
                isActive
                  ? 'border-cyan-300/70 bg-cyan-500/10'
                  : 'border-slate-600/70 bg-slate-900/70'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{meta.title}</h3>
                  <p className="mt-1 text-xs text-slate-300">{meta.gradingMode}</p>
                </div>
                {isFinal ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                    <IoCheckmarkCircleOutline /> Final
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-xs text-slate-200/90">{meta.description}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory(categoryKey)}
                  className="rounded-md border border-slate-400/50 bg-slate-700/40 px-3 py-1 text-xs text-white hover:border-slate-200/70"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFinalCategory(categoryKey);
                    setActiveCategory(categoryKey);
                  }}
                  className="rounded-md border border-cyan-300/50 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 hover:border-cyan-200/80"
                >
                  Set As Final
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-600/70 bg-slate-900/80 p-4">
        {activeCategory === 'scenario' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-cyan-100">Scenario Set Builder</p>
                <p className="text-xs text-slate-300">
                  Generate 3 sets of 2 long-answer questions from module sources. Each question
                  defaults to 5 marks.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateScenarioSets}
                disabled={loadingScenario}
                className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
              >
                {loadingScenario ? <IoRefreshOutline className="animate-spin" /> : <IoSparklesOutline />}
                Generate Scenario Sets
              </button>
            </div>

            <div className="rounded-md border border-slate-600/70 bg-slate-950/70 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Module source context</p>
              <p className="mt-1">{moduleSources.length} source(s) available for generation.</p>
              {moduleSources.slice(0, 4).map((source) => (
                <p key={source.id} className="mt-1">
                  - {source.title}
                </p>
              ))}
            </div>

            <div className="space-y-3">
              {scenarioSets.map((scenarioSet) => {
                const isSelected = selectedScenarioSetId === scenarioSet.id;

                return (
                  <article
                    key={scenarioSet.id}
                    className={`rounded-lg border p-3 ${
                      isSelected
                        ? 'border-emerald-400/70 bg-emerald-500/10'
                        : 'border-slate-600/70 bg-slate-950/70'
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                        <input
                          type="radio"
                          name="scenario-set"
                          checked={isSelected}
                          onChange={() => setSelectedScenarioSetId(scenarioSet.id)}
                        />
                        Use this set as final scenario assessment
                      </label>
                    </div>

                    <input
                      type="text"
                      value={scenarioSet.title || ''}
                      onChange={(event) =>
                        updateScenarioSet(scenarioSet.id, { title: event.target.value })
                      }
                      className="w-full rounded-md border border-slate-500/60 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                    />

                    <textarea
                      value={scenarioSet.review_note || ''}
                      onChange={(event) =>
                        updateScenarioSet(scenarioSet.id, { review_note: event.target.value })
                      }
                      rows={2}
                      className="mt-2 w-full rounded-md border border-slate-500/60 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
                      placeholder="Teacher review note"
                    />

                    <div className="mt-3 space-y-2">
                      {(scenarioSet.questions || []).map((question, index) => (
                        <div
                          key={question.id}
                          className="rounded-md border border-slate-600/60 bg-slate-900/70 p-2"
                        >
                          <p className="mb-1 text-xs uppercase tracking-wide text-slate-300">
                            Question {index + 1}
                          </p>
                          <textarea
                            value={question.prompt || ''}
                            onChange={(event) =>
                              updateScenarioQuestion(
                                scenarioSet.id,
                                question.id,
                                'prompt',
                                event.target.value
                              )
                            }
                            rows={3}
                            className="w-full rounded-md border border-slate-500/60 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                          />

                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <input
                              type="number"
                              min={1}
                              value={question.marks}
                              onChange={(event) =>
                                updateScenarioQuestion(
                                  scenarioSet.id,
                                  question.id,
                                  'marks',
                                  event.target.value
                                )
                              }
                              className="rounded-md border border-slate-500/60 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                              placeholder="Marks"
                            />
                            <input
                              type="text"
                              value={question.expected_length || ''}
                              onChange={(event) =>
                                updateScenarioQuestion(
                                  scenarioSet.id,
                                  question.id,
                                  'expected_length',
                                  event.target.value
                                )
                              }
                              className="rounded-md border border-slate-500/60 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                              placeholder="Expected length"
                            />
                            <input
                              type="text"
                              value={question.rubric || ''}
                              onChange={(event) =>
                                updateScenarioQuestion(
                                  scenarioSet.id,
                                  question.id,
                                  'rubric',
                                  event.target.value
                                )
                              }
                              className="rounded-md border border-slate-500/60 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                              placeholder="Rubric"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeCategory === 'ppt' ? (
          <div className="space-y-4">
            {renderTopicEditor('PDF/PPT Topic List', pptTopics, setPptTopics, 'ppt')}
            <div>
              <p className="mb-1 text-sm font-semibold text-cyan-100">Format Guide</p>
              <textarea
                value={pptFormatGuide}
                onChange={(event) => setPptFormatGuide(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-500/60 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>
        ) : null}

        {activeCategory === 'article' ? (
          <div className="space-y-4">
            {renderTopicEditor(
              'Article/Blog Topic List',
              articleTopics,
              setArticleTopics,
              'article'
            )}
            <div>
              <p className="mb-1 text-sm font-semibold text-cyan-100">Format Guide</p>
              <textarea
                value={articleFormatGuide}
                onChange={(event) => setArticleFormatGuide(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-500/60 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <p className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
              AI grading flow: fetch submission URL, scrape content, evaluate topic alignment,
              source usage, and conceptual accuracy.
            </p>
          </div>
        ) : null}

        {activeCategory === 'research' ? (
          <div className="space-y-4">
            {renderTopicEditor(
              'Research Topic List',
              researchTopics,
              setResearchTopics,
              'research'
            )}

            <div>
              <p className="mb-1 text-sm font-semibold text-cyan-100">Research Format Guide</p>
              <textarea
                value={researchFormatGuide}
                onChange={(event) => setResearchFormatGuide(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-500/60 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="rounded-md border border-slate-500/60 bg-slate-950/70 p-3">
              <p className="text-sm font-semibold text-cyan-100">LaTeX Template</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-400/50 bg-slate-700/40 px-3 py-2 text-xs text-white hover:border-slate-200/70">
                <IoCloudUploadOutline />
                Select .tex template file
                <input
                  type="file"
                  accept=".tex"
                  className="hidden"
                  onChange={handleLatexTemplateSelect}
                />
              </label>

              <p className="mt-2 text-xs text-slate-300">
                Selected template: {latexTemplateName || 'None'}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-100">Final Assessment Selection</p>
            <p className="text-xs text-emerald-100/80">
              Exactly one category is marked final for module release.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinalize}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            <IoCheckmarkCircleOutline />
            Finalize Category
          </button>
        </div>

        <p className="mt-3 text-sm text-emerald-100">
          Current final category: <span className="font-semibold">{CATEGORY_META[finalCategory].title}</span>
        </p>

        {finalizedAt ? (
          <p className="mt-1 text-xs text-emerald-200/90">
            Last finalized at: {new Date(finalizedAt).toLocaleString()}
          </p>
        ) : null}

        <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-emerald-500/20 bg-slate-950 p-3 text-xs text-emerald-100">
          {JSON.stringify(finalBlueprint, null, 2)}
        </pre>
      </div>

      <div className="rounded-lg border border-slate-600/70 bg-slate-900/80 p-4">
        <p className="text-sm font-semibold text-slate-100">Prototype Persistence</p>
        <p className="mt-1 text-xs text-slate-300">
          Save and load this assessment studio state from browser local storage.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSavePrototype}
            className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600"
          >
            <IoSaveOutline /> Save Prototype
          </button>
          <button
            type="button"
            onClick={handleLoadPrototype}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300/50 bg-slate-700/50 px-3 py-2 text-xs text-white hover:border-slate-200/80"
          >
            <IoLayersOutline /> Load Prototype
          </button>
          <button
            type="button"
            onClick={handleResetPrototype}
            className="inline-flex items-center gap-2 rounded-md border border-rose-300/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 hover:border-rose-200/80"
          >
            <IoRefreshOutline /> Reset
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm font-semibold text-amber-100">Backend Checklist For Production</p>
        <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
          <li>1. Topic generation endpoint for PPT, article, and research categories.</li>
          <li>2. Upload APIs for student files (PDF/PPT, LaTeX) and teacher LaTeX templates.</li>
          <li>3. URL scraping and scoring endpoint for article/blog submissions.</li>
          <li>4. AI partial grading endpoint and teacher moderation queue for PPT/PDF.</li>
          <li>5. AI LaTeX template alignment grader for research papers.</li>
          <li>6. Category-aware submission model to support one final selected category per module.</li>
        </ul>
      </div>
    </section>
  );
};

export default ModuleAssessmentWorkflowPrototype;
