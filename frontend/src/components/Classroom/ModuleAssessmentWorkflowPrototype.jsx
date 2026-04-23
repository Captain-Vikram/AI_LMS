import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const DEFAULT_PPT_GUIDE =
  'Format: 10-12 slides or 4-6 page PDF. Include problem statement, concept explanation, real-world use case, and references.';
const DEFAULT_ARTICLE_GUIDE =
  'Format: structured article with heading, abstract, core discussion, source references, and concluding insights.';
const DEFAULT_RESEARCH_GUIDE =
  'Format: follow teacher-provided LaTeX template strictly (section order, citation style, tables/figures format).';

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

  const sourceSeeds = sources.map((source) => source.title).filter(Boolean);

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

const buildDefaultQuestionPrompt = (moduleName, seed) =>
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
    prompts.push(buildDefaultQuestionPrompt(moduleName, seed));
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
    padded.push(buildDefaultQuestionPrompt(moduleName, seed));
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

const cloneState = (value) => JSON.parse(JSON.stringify(value));

const normalizeTopicList = (incomingTopics, fallbackTopics) => {
  if (!Array.isArray(incomingTopics) || incomingTopics.length === 0) {
    return cloneState(fallbackTopics);
  }

  const normalized = incomingTopics
    .map((topic, index) => {
      if (typeof topic === 'string') {
        const title = safeTrim(topic);
        if (!title) return null;
        return {
          id: `topic-${index + 1}`,
          title,
          scope: `${title}: context, methods, measurable outcomes`,
          deliverable: fallbackTopics[index % fallbackTopics.length]?.deliverable || '',
        };
      }

      if (topic && typeof topic === 'object') {
        const title = safeTrim(topic.title || topic.topic);
        if (!title) return null;
        return {
          id: safeTrim(topic.id) || `topic-${index + 1}`,
          title,
          scope:
            safeTrim(topic.scope) || `${title}: context, methods, measurable outcomes`,
          deliverable:
            safeTrim(topic.deliverable) ||
            fallbackTopics[index % fallbackTopics.length]?.deliverable ||
            '',
        };
      }

      return null;
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : cloneState(fallbackTopics);
};

const normalizeScenarioSets = (incomingSets, fallbackSets) => {
  if (!Array.isArray(incomingSets) || incomingSets.length === 0) {
    return cloneState(fallbackSets);
  }

  const normalized = incomingSets
    .map((scenarioSet, setIndex) => {
      if (!scenarioSet || typeof scenarioSet !== 'object') {
        return null;
      }

      const questions = Array.isArray(scenarioSet.questions)
        ? scenarioSet.questions
            .map((question, questionIndex) => {
              if (!question || typeof question !== 'object') {
                return null;
              }

              const prompt = safeTrim(question.prompt || question.question);
              if (!prompt) {
                return null;
              }

              return {
                id:
                  safeTrim(question.id) ||
                  `set-${setIndex + 1}-q-${questionIndex + 1}`,
                prompt,
                marks: Math.max(1, Number(question.marks || 5)),
                expected_length:
                  safeTrim(question.expected_length) || '150-220 words',
                rubric:
                  safeTrim(question.rubric) ||
                  'Assess conceptual correctness, practical reasoning, and clarity of explanation.',
              };
            })
            .filter(Boolean)
        : [];

      if (questions.length === 0) {
        return null;
      }

      return {
        id: safeTrim(scenarioSet.id) || `scenario-set-${setIndex + 1}`,
        title:
          safeTrim(scenarioSet.title) || `Scenario Set ${setIndex + 1}`,
        review_note:
          safeTrim(scenarioSet.review_note) ||
          'Teacher review required before release.',
        questions: questions.slice(0, 2),
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : cloneState(fallbackSets);
};

const ModuleAssessmentWorkflowPrototype = ({ moduleId, module, onPublished }) => {
  const moduleName = useMemo(() => getModuleName(module), [module]);
  const moduleSources = useMemo(() => getModuleSources(module), [module]);
  const seedTopics = useMemo(
    () => buildSeedTopics(module, moduleName, moduleSources),
    [module, moduleName, moduleSources]
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

  const [workflowId, setWorkflowId] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState('draft');
  const [workflowPublished, setWorkflowPublished] = useState(false);

  const [activeCategory, setActiveCategory] = useState('scenario');
  const [finalCategory, setFinalCategory] = useState('scenario');
  const [selectedScenarioSetId, setSelectedScenarioSetId] = useState('scenario-set-1');

  const [scenarioSets, setScenarioSets] = useState(() => cloneState(defaultScenarioSets));
  const [pptTopics, setPptTopics] = useState(() => cloneState(defaultPptTopics));
  const [articleTopics, setArticleTopics] = useState(() => cloneState(defaultArticleTopics));
  const [researchTopics, setResearchTopics] = useState(() => cloneState(defaultResearchTopics));

  const [pptFormatGuide, setPptFormatGuide] = useState(DEFAULT_PPT_GUIDE);
  const [articleFormatGuide, setArticleFormatGuide] = useState(DEFAULT_ARTICLE_GUIDE);
  const [researchFormatGuide, setResearchFormatGuide] = useState(DEFAULT_RESEARCH_GUIDE);

  const [latexTemplateName, setLatexTemplateName] = useState('');
  const [finalizedAt, setFinalizedAt] = useState('');

  const [loadingInitial, setLoadingInitial] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isBusy =
    loadingInitial ||
    generatingDraft ||
    savingDraft ||
    finalizing ||
    uploadingTemplate ||
    loadingScenario ||
    loadingTopics;
  const isReadOnly = workflowPublished;

  const selectedScenarioSet = useMemo(
    () =>
      scenarioSets.find((scenarioSet) => scenarioSet.id === selectedScenarioSetId) ||
      scenarioSets[0] ||
      null,
    [scenarioSets, selectedScenarioSetId]
  );

  const resetToDefaults = useCallback(() => {
    setWorkflowId('');
    setWorkflowStatus('draft');
    setWorkflowPublished(false);

    setActiveCategory('scenario');
    setFinalCategory('scenario');
    setSelectedScenarioSetId('scenario-set-1');

    setScenarioSets(cloneState(defaultScenarioSets));
    setPptTopics(cloneState(defaultPptTopics));
    setArticleTopics(cloneState(defaultArticleTopics));
    setResearchTopics(cloneState(defaultResearchTopics));

    setPptFormatGuide(DEFAULT_PPT_GUIDE);
    setArticleFormatGuide(DEFAULT_ARTICLE_GUIDE);
    setResearchFormatGuide(DEFAULT_RESEARCH_GUIDE);

    setLatexTemplateName('');
    setFinalizedAt('');
  }, [defaultScenarioSets, defaultPptTopics, defaultArticleTopics, defaultResearchTopics]);

  const applyWorkflowState = useCallback(
    (workflow) => {
      if (!workflow || typeof workflow !== 'object') {
        resetToDefaults();
        return;
      }

      const categories = workflow.categories && typeof workflow.categories === 'object'
        ? workflow.categories
        : {};

      const scenarioConfig =
        categories.scenario && typeof categories.scenario === 'object'
          ? categories.scenario
          : {};
      const pptConfig =
        categories.ppt && typeof categories.ppt === 'object' ? categories.ppt : {};
      const articleConfig =
        categories.article && typeof categories.article === 'object'
          ? categories.article
          : {};
      const researchConfig =
        categories.research && typeof categories.research === 'object'
          ? categories.research
          : {};

      const normalizedFinalCategory = CATEGORY_META[workflow.final_category]
        ? workflow.final_category
        : 'scenario';
      const normalizedScenarioSets = normalizeScenarioSets(
        scenarioConfig.question_sets,
        defaultScenarioSets
      );
      const selectedSetId =
        safeTrim(scenarioConfig.selected_set_id) ||
        normalizedScenarioSets[0]?.id ||
        'scenario-set-1';

      setWorkflowId(safeTrim(workflow.workflow_id));
      setWorkflowStatus(safeTrim(workflow.status) || 'draft');
      setWorkflowPublished(Boolean(workflow.is_published));

      setActiveCategory(normalizedFinalCategory);
      setFinalCategory(normalizedFinalCategory);
      setScenarioSets(normalizedScenarioSets);
      setSelectedScenarioSetId(selectedSetId);

      setPptTopics(normalizeTopicList(pptConfig.topics, defaultPptTopics));
      setArticleTopics(normalizeTopicList(articleConfig.topics, defaultArticleTopics));
      setResearchTopics(normalizeTopicList(researchConfig.topics, defaultResearchTopics));

      setPptFormatGuide(safeTrim(pptConfig.format_guide) || DEFAULT_PPT_GUIDE);
      setArticleFormatGuide(safeTrim(articleConfig.format_guide) || DEFAULT_ARTICLE_GUIDE);
      setResearchFormatGuide(safeTrim(researchConfig.format_guide) || DEFAULT_RESEARCH_GUIDE);

      const latexTemplate =
        researchConfig.latex_template && typeof researchConfig.latex_template === 'object'
          ? researchConfig.latex_template
          : {};
      setLatexTemplateName(safeTrim(latexTemplate.file_name));
      setFinalizedAt(safeTrim(workflow.finalized_at));
    },
    [
      resetToDefaults,
      defaultScenarioSets,
      defaultPptTopics,
      defaultArticleTopics,
      defaultResearchTopics,
    ]
  );

  const loadLatestWorkflow = useCallback(
    async ({ silent = false } = {}) => {
      if (!moduleId) {
        return;
      }

      setLoadingInitial(true);
      if (!silent) {
        setError('');
        setMessage('');
      }

      try {
        const response = await apiClient.get(
          `/api/module-assessment/workflow/module/${moduleId}/latest`
        );

        if (response?.workflow) {
          applyWorkflowState(response.workflow);
          if (!silent) {
            setMessage(response?.message || 'Latest workflow loaded successfully.');
          }
        } else {
          resetToDefaults();
          if (!silent) {
            setMessage('No saved workflow found for this module. Generate AI draft to begin.');
          }
        }
      } catch (requestError) {
        resetToDefaults();
        setError(requestError?.message || 'Failed to load latest workflow.');
      } finally {
        setLoadingInitial(false);
      }
    },
    [moduleId, applyWorkflowState, resetToDefaults]
  );

  useEffect(() => {
    if (!moduleId) {
      resetToDefaults();
      return;
    }

    loadLatestWorkflow({ silent: true });
  }, [moduleId, loadLatestWorkflow, resetToDefaults]);

  const createWorkflowDraft = useCallback(
    async ({ silent = false } = {}) => {
      if (!moduleId) {
        setError('Module id is missing. Open this page from a specific module route.');
        return '';
      }

      setGeneratingDraft(true);
      if (!silent) {
        setError('');
        setMessage('');
      }

      try {
        const response = await apiClient.post('/api/module-assessment/workflow/draft-generate', {
          module_id: moduleId,
        });

        if (response?.workflow) {
          applyWorkflowState(response.workflow);
        } else if (response?.workflow_id) {
          setWorkflowId(String(response.workflow_id));
          setWorkflowPublished(false);
          setWorkflowStatus('draft');
        }

        if (!silent) {
          setMessage(response?.message || 'Assessment workflow draft generated.');
        }

        return safeTrim(response?.workflow_id || response?.workflow?.workflow_id);
      } catch (requestError) {
        setError(requestError?.message || 'Failed to generate workflow draft.');
        return '';
      } finally {
        setGeneratingDraft(false);
      }
    },
    [moduleId, applyWorkflowState]
  );

  const buildPatchPayload = useCallback(
    (overrides = {}) => ({
      final_category: overrides.finalCategory ?? finalCategory,
      selected_scenario_set_id: overrides.selectedScenarioSetId ?? selectedScenarioSetId,
      scenario_sets: overrides.scenarioSets ?? scenarioSets,
      ppt_topics: overrides.pptTopics ?? pptTopics,
      article_topics: overrides.articleTopics ?? articleTopics,
      research_topics: overrides.researchTopics ?? researchTopics,
      ppt_format_guide: overrides.pptFormatGuide ?? pptFormatGuide,
      article_format_guide: overrides.articleFormatGuide ?? articleFormatGuide,
      research_format_guide: overrides.researchFormatGuide ?? researchFormatGuide,
    }),
    [
      finalCategory,
      selectedScenarioSetId,
      scenarioSets,
      pptTopics,
      articleTopics,
      researchTopics,
      pptFormatGuide,
      articleFormatGuide,
      researchFormatGuide,
    ]
  );

  const saveWorkflowDraft = useCallback(
    async ({ silent = false, overrides = {} } = {}) => {
      if (isReadOnly) {
        setError('This workflow is published and immutable. Generate a new draft to make changes.');
        return '';
      }

      let targetWorkflowId = workflowId;
      if (!targetWorkflowId) {
        targetWorkflowId = await createWorkflowDraft({ silent: true });
        if (!targetWorkflowId) {
          return '';
        }
      }

      setSavingDraft(true);
      if (!silent) {
        setError('');
        setMessage('');
      }

      try {
        const response = await apiClient.patch(
          `/api/module-assessment/workflow/${targetWorkflowId}`,
          buildPatchPayload(overrides)
        );

        if (response?.workflow) {
          applyWorkflowState(response.workflow);
        }

        if (!silent) {
          setMessage(response?.message || 'Workflow draft saved successfully.');
        }

        return targetWorkflowId;
      } catch (requestError) {
        setError(requestError?.message || 'Failed to save workflow draft.');
        return '';
      } finally {
        setSavingDraft(false);
      }
    },
    [
      isReadOnly,
      workflowId,
      createWorkflowDraft,
      buildPatchPayload,
      applyWorkflowState,
    ]
  );

  const handleGenerateScenarioSets = async () => {
    if (!moduleId) {
      setError('Module id is missing. Open this page from a specific classroom module.');
      setMessage('');
      return;
    }

    if (isReadOnly) {
      setError('This workflow is published and immutable. Generate a new draft to make changes.');
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
      const selectedId = generatedSets[0]?.id || 'scenario-set-1';

      setScenarioSets(generatedSets);
      setSelectedScenarioSetId(selectedId);

      await saveWorkflowDraft({
        silent: true,
        overrides: {
          scenarioSets: generatedSets,
          selectedScenarioSetId: selectedId,
        },
      });

      setMessage(
        response?.message ||
          'AI generated scenario sets from module sources. Teacher can now select and edit one set.'
      );
    } catch (requestError) {
      const fallbackSets = buildDefaultScenarioSets(moduleName, seedTopics);
      const selectedId = fallbackSets[0]?.id || 'scenario-set-1';

      setScenarioSets(fallbackSets);
      setSelectedScenarioSetId(selectedId);

      setError(
        requestError?.message ||
          'AI scenario generation failed. Loaded editable template question sets.'
      );
      setMessage('Fallback template created from current module context.');
    } finally {
      setLoadingScenario(false);
    }
  };

  const regenerateTopics = async (type) => {
    if (isReadOnly) {
      setError('This workflow is published and immutable. Generate a new draft to make changes.');
      setMessage('');
      return;
    }

    if (type === 'ppt') {
      const topics = buildTopicList(moduleName, seedTopics, 'PDF/PPT presentation deck');
      setPptTopics(topics);
      await saveWorkflowDraft({ silent: true, overrides: { pptTopics: topics } });
      setMessage('AI topic suggestions refreshed for PDF/PPT assessment.');
      setError('');
      return;
    }

    if (type === 'article') {
      const topics = buildTopicList(
        moduleName,
        seedTopics,
        'Article or blog post (1000-1500 words)'
      );
      setArticleTopics(topics);
      await saveWorkflowDraft({ silent: true, overrides: { articleTopics: topics } });
      setMessage('AI topic suggestions refreshed for article/blog assessment.');
      setError('');
      return;
    }

    const topics = buildTopicList(moduleName, seedTopics, 'Research paper (LaTeX based)');
    setResearchTopics(topics);
    await saveWorkflowDraft({ silent: true, overrides: { researchTopics: topics } });
    setMessage('AI topic suggestions refreshed for research-paper assessment.');
    setError('');
  };

  const handleLatexTemplateSelect = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    if (isReadOnly) {
      setError('This workflow is published and immutable. Generate a new draft to make changes.');
      setMessage('');
      return;
    }

    let targetWorkflowId = workflowId;
    if (!targetWorkflowId) {
      targetWorkflowId = await createWorkflowDraft({ silent: true });
      if (!targetWorkflowId) {
        return;
      }
    }

    setUploadingTemplate(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(
        `/api/module-assessment/workflow/${targetWorkflowId}/latex-template`,
        formData
      );

      if (response?.workflow) {
        applyWorkflowState(response.workflow);
      } else {
        setLatexTemplateName(file.name);
      }

      setMessage(response?.message || 'LaTeX template uploaded successfully.');
    } catch (requestError) {
      setError(requestError?.message || 'Failed to upload LaTeX template.');
    } finally {
      setUploadingTemplate(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleFinalize = async () => {
    if (isReadOnly) {
      setMessage('Workflow is already published. Generate a new draft if you need changes.');
      setError('');
      return;
    }

    setFinalizing(true);
    setError('');
    setMessage('');

    try {
      let targetWorkflowId = await saveWorkflowDraft({ silent: true });
      if (!targetWorkflowId) {
        targetWorkflowId = await createWorkflowDraft({ silent: true });
      }

      if (!targetWorkflowId) {
        throw new Error('Unable to create workflow draft for finalization.');
      }

      const response = await apiClient.post(
        `/api/module-assessment/workflow/${targetWorkflowId}/finalize`,
        {
          final_category: finalCategory,
        }
      );

      if (response?.workflow) {
        applyWorkflowState(response.workflow);
      }

      setMessage(
        response?.message ||
          `${CATEGORY_META[finalCategory].title} finalized and published successfully.`
      );
      setFinalizedAt(safeTrim(response?.workflow?.finalized_at) || new Date().toISOString());

      onPublished?.({
        mode: 'workflow',
        workflow_id: targetWorkflowId,
        final_category: finalCategory,
        response,
      });
    } catch (requestError) {
      setError(requestError?.message || 'Failed to finalize workflow.');
    } finally {
      setFinalizing(false);
    }
  };

  const updateScenarioSet = (setId, updater) => {
    if (isReadOnly) {
      return;
    }

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
    if (isReadOnly) {
      return;
    }

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
    if (isReadOnly) {
      return;
    }

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
    if (isReadOnly) {
      return;
    }

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
    if (isReadOnly) {
      return;
    }

    setter((previous) => previous.filter((topic) => topic.id !== topicId));
  };

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
      };
    }

    return {
      category: finalCategory,
      category_label: CATEGORY_META[finalCategory].title,
      grading_mode: CATEGORY_META[finalCategory].gradingMode,
      topics: researchTopics,
      format_guide: researchFormatGuide,
      latex_template_name: latexTemplateName || null,
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

  const renderTopicEditor = (label, topics, setter, type) => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/50 pb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-100">{label}</h3>
          <p className="mt-1 text-sm text-gray-400">Review and edit the AI-generated topics for this assessment type.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => regenerateTopics(type)}
            disabled={isReadOnly || isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all hover:bg-gray-700 hover:text-white disabled:opacity-50"
          >
            <IoRefreshOutline className="text-sm" /> Refresh Topics
          </button>
          <button
            type="button"
            onClick={() => addTopic(setter, label)}
            disabled={isReadOnly}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all hover:bg-gray-800 hover:text-white hover:border-gray-600 disabled:opacity-50"
          >
            + Add Topic
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {topics.map((topic, index) => (
          <article
            key={topic.id}
            className="group relative rounded-xl border border-gray-800/50 bg-gray-900/20 p-4 transition-all hover:border-gray-700/50 hover:bg-gray-800/40"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-blue-400 transition-colors">
                Topic {index + 1}
              </p>
              <button
                type="button"
                onClick={() => removeTopic(setter, topic.id)}
                disabled={isReadOnly}
                className="text-xs text-rose-500/70 hover:text-rose-400 disabled:opacity-50 transition-colors font-medium"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={topic.title || ''}
                disabled={isReadOnly}
                onChange={(event) =>
                  updateTopicList(setter, topic.id, 'title', event.target.value)
                }
                placeholder="Topic Title"
                className="w-full bg-transparent text-base font-bold text-gray-200 outline-none focus:border-b focus:border-blue-500/50 transition-colors placeholder-gray-600"
              />
              <textarea
                value={topic.scope || ''}
                disabled={isReadOnly}
                onChange={(event) =>
                  updateTopicList(setter, topic.id, 'scope', event.target.value)
                }
                rows={2}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder="Scope and objective..."
                className="w-full bg-transparent text-sm text-gray-400 outline-none resize-none focus:text-gray-300 transition-colors border-l-2 border-gray-800 focus:border-blue-500/50 pl-3 py-1"
              />
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium text-gray-500">Deliverable:</span>
                <input
                  type="text"
                  value={topic.deliverable || ''}
                  disabled={isReadOnly}
                  onChange={(event) =>
                    updateTopicList(setter, topic.id, 'deliverable', event.target.value)
                  }
                  placeholder="Deliverable format"
                  className="bg-transparent text-xs text-emerald-400 outline-none border-b border-gray-800/50 focus:border-emerald-500/50 py-0.5 min-w-[200px]"
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );

  return (
    <section className="space-y-8 rounded-2xl border border-gray-700/50 bg-gray-900/40 p-6 shadow-2xl backdrop-blur-xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-gray-700/50 pb-6">
        <div>
          <h2 className="inline-flex items-center gap-3 text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            <IoDocumentTextOutline className="text-blue-400" />
            Assessment Workflow Studio
          </h2>
          <p className="mt-2 text-sm text-gray-400 max-w-2xl">
            Configure assessment formats, review AI suggestions, and select the final evaluation method for your students.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2 text-xs font-medium bg-gray-800/80 px-4 py-2 rounded-full border border-gray-700/50">
            <span className={workflowPublished ? "text-emerald-400" : "text-amber-400"}>
              ● {workflowPublished ? 'Published' : 'Draft Mode'}
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400 font-mono tracking-wider">{workflowId ? `ID: ${workflowId.substring(0,8)}...` : 'Unsaved'}</span>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => loadLatestWorkflow()}
              disabled={!moduleId || isBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-600/50 bg-gray-800/50 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:bg-gray-700 hover:text-white disabled:opacity-50"
            >
              <IoLayersOutline /> Discard & Reload
            </button>
            <button
              type="button"
              onClick={() => createWorkflowDraft()}
              disabled={!moduleId || isBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
            >
              {generatingDraft ? <IoRefreshOutline className="animate-spin text-lg" /> : <IoSparklesOutline className="text-lg" />}
              AI Generate
            </button>
            <button
              type="button"
              onClick={() => saveWorkflowDraft()}
              disabled={!moduleId || isBusy || isReadOnly}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-gray-600 disabled:opacity-50"
            >
              {savingDraft ? <IoRefreshOutline className="animate-spin text-lg" /> : <IoSaveOutline className="text-lg" />}
              Save Progress
            </button>
          </div>
        </div>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(CATEGORY_META).map(([categoryKey, meta]) => {
          const isActive = activeCategory === categoryKey;
          const isFinal = finalCategory === categoryKey;

          return (
            <article
              key={categoryKey}
              onClick={() => !isReadOnly && setActiveCategory(categoryKey)}
              className={`group relative cursor-pointer overflow-hidden rounded-xl border p-5 transition-all duration-300 ${
                isActive
                  ? 'border-blue-500/50 bg-blue-900/20 shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]'
                  : 'border-gray-700/50 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/60'
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-50" />
              )}
              
              <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <h3 className={`text-lg font-bold tracking-tight ${isActive ? 'text-blue-100' : 'text-gray-200'}`}>
                      {meta.title}
                    </h3>
                    {isFinal ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 shadow-[0_0_10px_0_rgba(16,185,129,0.2)]">
                        <IoCheckmarkCircleOutline className="text-sm" /> FINAL
                      </span>
                    ) : null}
                  </div>
                  <div className="inline-flex items-center rounded-md bg-gray-900/50 px-2 py-1 flex-wrap"> 
                    <p className={`text-xs font-medium uppercase tracking-wider ${isActive ? 'text-blue-300' : 'text-gray-400'}`}>
                      {meta.gradingMode}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-400 group-hover:text-gray-300">
                    {meta.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-700/50">
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFinalCategory(categoryKey);
                      setActiveCategory(categoryKey);
                    }}
                    className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
                      isFinal
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400'
                    }`}
                  >
                    {isFinal ? 'Currently Selected' : 'Set as Final Variant'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-500"></div>
        {activeCategory === 'scenario' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-800/50">
              <div>
                <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                  Scenario Selection
                </h3>
                <p className="mt-1 text-sm text-gray-400 max-w-lg">
                  AI generated 3 distinct question sets. Select the variation that best tests understanding.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateScenarioSets}
                disabled={loadingScenario || isReadOnly || isBusy}
                className="mt-4 sm:mt-0 inline-flex items-center gap-2 rounded-lg bg-gray-800/80 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:bg-gray-700 hover:text-white disabled:opacity-50"
              >
                {loadingScenario ? <IoRefreshOutline className="animate-spin text-lg" /> : <IoSparklesOutline className="text-lg" />}
                Regenerate Scenarios
              </button>
            </div>

            <div className="text-sm text-gray-400 px-2">
              <span className="font-semibold text-gray-300">Context Source:</span>{' '}
              {moduleSources.slice(0, 4).map(s => s.title).join(', ')}
              {moduleSources.length > 4 ? ` and ${moduleSources.length - 4} more.` : ''}
            </div>

            <div className="grid gap-4">
              {scenarioSets.map((scenarioSet) => {
                const isSelected = selectedScenarioSetId === scenarioSet.id;

                return (
                  <article
                    key={scenarioSet.id}
                    onClick={() => !isReadOnly && setSelectedScenarioSetId(scenarioSet.id)}
                    className={`relative rounded-xl border p-5 transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? 'border-blue-500/50 bg-blue-900/10 shadow-[0_4px_20px_-5px_rgba(59,130,246,0.15)]'
                        : 'border-gray-800/50 bg-gray-900/20 hover:border-gray-700/50 hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <input
                          type="radio"
                          name="scenario-set"
                          disabled={isReadOnly}
                          checked={isSelected}
                          onChange={() => setSelectedScenarioSetId(scenarioSet.id)}
                          className="w-5 h-5 text-blue-500 border-gray-600 focus:ring-blue-500 bg-gray-900 cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={scenarioSet.title || ''}
                          disabled={isReadOnly}
                          onClick={(e) => isSelected && e.stopPropagation()}
                          onChange={(event) =>
                            updateScenarioSet(scenarioSet.id, { title: event.target.value })
                          }
                          className="bg-transparent text-lg font-bold text-gray-100 outline-none focus:border-b focus:border-blue-500/50 transition-colors placeholder-gray-600 w-full min-w-[200px]"
                          placeholder="Set Title"
                        />
                      </div>
                      <input
                        type="text"
                        value={scenarioSet.review_note || ''}
                        disabled={isReadOnly}
                        onClick={(e) => isSelected && e.stopPropagation()}
                        onChange={(event) =>
                          updateScenarioSet(scenarioSet.id, { review_note: event.target.value })
                        }
                        className="bg-transparent text-sm text-emerald-400/80 outline-none text-left sm:text-right w-full sm:w-1/3 focus:border-b focus:border-emerald-500/50 transition-colors"
                        placeholder="Teacher review note"
                      />
                    </div>

                    {isSelected && (
                      <div className="space-y-6 mt-6 border-t border-gray-800/50 pt-6">
                        {(scenarioSet.questions || []).map((question, qIndex) => (
                          <div
                            key={question.id}
                            onClick={(e) => e.stopPropagation()}
                            className="flex flex-col gap-3 group/question"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover/question:text-blue-400 transition-colors">
                                Question {qIndex + 1}
                              </span>
                              {question.bloom_alignment_warning && (
                                <span className="text-[10px] font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-500/20">
                                  ⚠️ Verb Mismatch
                                </span>
                              )}
                            </div>
                            
                            <textarea
                              value={question.prompt || ''}
                              disabled={isReadOnly}
                              onChange={(event) =>
                                updateScenarioQuestion(scenarioSet.id, question.id, 'prompt', event.target.value)
                              }
                              rows={2}
                              onInput={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              className="w-full bg-transparent text-gray-200 text-sm outline-none resize-none focus:text-white transition-colors"
                              placeholder="Describe the scenario..."
                            />

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-gray-500 mt-2">
                              <div className="flex items-center gap-2">
                                <span>Bloom</span>
                                <select
                                  value={question.bloom_level || 3}
                                  disabled={isReadOnly}
                                  onChange={(event) =>
                                    updateScenarioQuestion(scenarioSet.id, question.id, 'bloom_level', Number(event.target.value))
                                  }
                                  className="bg-transparent text-blue-400 outline-none border-b border-transparent focus:border-blue-500 pb-0.5 cursor-pointer"
                                >
                                  <option value={3}>Level 3 (Apply)</option>
                                  <option value={4}>Level 4 (Analyze)</option>
                                  <option value={5}>Level 5 (Evaluate)</option>
                                </select>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span>Verb</span>
                                <input
                                  type="text"
                                  value={question.bloom_verb || ''}
                                  disabled={isReadOnly}
                                  onChange={(event) =>
                                    updateScenarioQuestion(scenarioSet.id, question.id, 'bloom_verb', event.target.value)
                                  }
                                  className="bg-transparent text-blue-400 outline-none border-b border-gray-700/50 focus:border-blue-500 pb-0.5 w-20 px-1"
                                  placeholder="Analyze"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <span>Marks</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={question.marks || 5}
                                  disabled={isReadOnly}
                                  onChange={(event) =>
                                    updateScenarioQuestion(scenarioSet.id, question.id, 'marks', event.target.value)
                                  }
                                  className="bg-transparent text-emerald-400 outline-none border-b border-gray-700/50 focus:border-emerald-500 pb-0.5 w-12 text-center"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <span>Length</span>
                                <input
                                  type="text"
                                  value={question.expected_length || ''}
                                  disabled={isReadOnly}
                                  onChange={(event) =>
                                    updateScenarioQuestion(scenarioSet.id, question.id, 'expected_length', event.target.value)
                                  }
                                  className="bg-transparent text-gray-300 outline-none border-b border-gray-700/50 focus:border-gray-500 pb-0.5 w-24 px-1"
                                  placeholder="150-220 wds"
                                />
                              </div>
                            </div>

                            {question.rubric_hint && (
                              <div className="text-[11px] text-emerald-400/80 bg-emerald-500/5 px-2 py-1 rounded inline-block w-fit mt-1">
                                <span className="font-bold">Hint:</span> {question.rubric_hint}
                              </div>
                            )}

                            <textarea
                              value={question.rubric || ''}
                              disabled={isReadOnly}
                              onChange={(event) =>
                                updateScenarioQuestion(scenarioSet.id, question.id, 'rubric', event.target.value)
                              }
                              rows={1}
                              onInput={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              className="w-full bg-transparent text-gray-400 text-xs italic outline-none resize-none focus:text-gray-300 mt-2 border-l-2 border-gray-700/50 pl-3 py-1"
                              placeholder="Rubric and evaluation criteria..."
                            />
                            
                            {qIndex < scenarioSet.questions.length - 1 && (
                              <div className="h-px w-full bg-gray-800/30 mt-4"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeCategory === 'ppt' ? (
          <div className="space-y-6">
            {renderTopicEditor('PDF or PPT Topics', pptTopics, setPptTopics, 'ppt')}
            <div className="border-t border-gray-800/50 pt-5">
              <p className="mb-2 text-sm font-bold text-gray-300 flex items-center gap-2">
                <IoDocumentTextOutline className="text-blue-400" /> Format Guide
              </p>
              <textarea
                value={pptFormatGuide}
                disabled={isReadOnly}
                onChange={(event) => setPptFormatGuide(event.target.value)}
                rows={2}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder="Instructions on format, length, style..."
                className="w-full rounded-xl border border-gray-700/50 bg-gray-900/40 px-4 py-3 text-sm text-gray-200 focus:border-blue-500/50 focus:bg-gray-900/80 outline-none resize-none transition-all placeholder-gray-600"
              />
            </div>
          </div>
        ) : null}

        {activeCategory === 'article' ? (
          <div className="space-y-6">
            {renderTopicEditor('Article or Blog Topics', articleTopics, setArticleTopics, 'article')}
            
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
              <IoSparklesOutline className="text-blue-400 text-xl flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-200 mb-1">AI Grading Flow Connected</p>
                <p className="text-xs text-blue-300/70">
                  Student URL submissions will be automatically scraped and evaluated for topic and source alignment.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-800/50 pt-5">
              <p className="mb-2 text-sm font-bold text-gray-300 flex items-center gap-2">
                <IoDocumentTextOutline className="text-blue-400" /> Format Guide
              </p>
              <textarea
                value={articleFormatGuide}
                disabled={isReadOnly}
                onChange={(event) => setArticleFormatGuide(event.target.value)}
                rows={2}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder="Instructions on format, length, style..."
                className="w-full rounded-xl border border-gray-700/50 bg-gray-900/40 px-4 py-3 text-sm text-gray-200 focus:border-blue-500/50 focus:bg-gray-900/80 outline-none resize-none transition-all placeholder-gray-600"
              />
            </div>
          </div>
        ) : null}

        {activeCategory === 'research' ? (
          <div className="space-y-6">
            {renderTopicEditor('Research Paper Topics', researchTopics, setResearchTopics, 'research')}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-800/50 pt-5">
              <div>
                <p className="mb-2 text-sm font-bold text-gray-300 flex items-center gap-2">
                  <IoDocumentTextOutline className="text-blue-400" /> Format Guide
                </p>
                <textarea
                  value={researchFormatGuide}
                  disabled={isReadOnly}
                  onChange={(event) => setResearchFormatGuide(event.target.value)}
                  rows={4}
                  className="w-full h-32 rounded-xl border border-gray-700/50 bg-gray-900/40 px-4 py-3 text-sm text-gray-200 focus:border-blue-500/50 focus:bg-gray-900/80 outline-none resize-none transition-all placeholder-gray-600"
                  placeholder="Instructions for LaTeX report..."
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-gray-300 flex items-center gap-2">
                  <IoDocumentTextOutline className="text-emerald-400" /> LaTeX Template
                </p>
                <div className="h-32 flex flex-col justify-center items-center gap-3 rounded-xl border border-dashed border-gray-600/50 bg-gray-900/20 hover:bg-gray-900/40 hover:border-gray-500/50 transition-all">
                  
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-all border border-gray-700 hover:border-gray-500">
                    {uploadingTemplate ? <IoRefreshOutline className="animate-spin text-lg" /> : <IoCloudUploadOutline className="text-lg" />}
                    {uploadingTemplate ? 'Uploading...' : 'Upload .tex Template'}
                    <input
                      type="file"
                      accept=".tex"
                      className="hidden"
                      disabled={isReadOnly || uploadingTemplate}
                      onChange={handleLatexTemplateSelect}
                    />
                  </label>
                  
                  {latexTemplateName ? (
                    <p className="text-xs text-emerald-400 font-medium px-4 text-center truncate w-full flex items-center justify-center gap-1">
                      <IoCheckmarkCircleOutline className="text-sm flex-shrink-0" /> {latexTemplateName}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 px-4 text-center">
                      No template currently uploaded
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/10 p-6 shadow-lg backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <IoCheckmarkCircleOutline className="text-xl" />
              Final Assessment Selection
            </h3>
            <p className="text-sm text-emerald-100/70 mt-1">
              Exactly one category is marked final for module release.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isReadOnly || isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
          >
            {finalizing ? <IoRefreshOutline className="animate-spin text-lg" /> : <IoCheckmarkCircleOutline className="text-lg" />}
            {isReadOnly ? 'Published & Locked' : 'Finalize Module Assessment'}
          </button>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4 bg-emerald-950/40 p-4 rounded-xl border border-emerald-800/50">
          <div className="flex-1">
            <p className="text-sm text-emerald-200">
              Current final category
            </p>
            <p className="text-xl font-bold text-white mt-1">
              {CATEGORY_META[finalCategory].title}
            </p>
          </div>
          
          {finalizedAt && (
            <div className="sm:border-l sm:border-emerald-800/50 sm:pl-4">
              <p className="text-xs text-emerald-400/80 uppercase tracking-widest font-semibold mb-1">
                Last Published
              </p>
              <p className="text-sm text-emerald-100">
                {new Date(finalizedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <details className="mt-6 group">
          <summary className="cursor-pointer text-xs font-semibold text-emerald-500/70 hover:text-emerald-400 transition-colors uppercase tracking-wider flex items-center gap-2">
            <span>Developer Preview: JSON Blueprint</span>
            <span className="group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 overflow-hidden rounded-xl border border-emerald-500/20 bg-gray-950/80 shadow-inner">
            <pre className="max-h-72 overflow-auto p-4 text-xs font-mono text-emerald-200/80 scrollbar-thin scrollbar-thumb-emerald-700/50">
              {JSON.stringify(finalBlueprint, null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </section>
  );
};

export default ModuleAssessmentWorkflowPrototype;
