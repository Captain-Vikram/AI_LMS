import os
import re
from pathlib import Path

src = Path('frontend/src')

def read(p): return (src / p).read_text(encoding='utf-8')
def write(p, content): (src / p).write_text(content, encoding='utf-8')
def repl(p, old, new):
    if not (src / p).exists(): return
    write(p, read(p).replace(old, new))
def repl_re(p, pattern, new):
    if not (src / p).exists(): return
    write(p, re.sub(pattern, new, read(p)))

# 1. AppBackButton.jsx
repl_re('components/UI/AppBackButton.jsx', r'\s*label,\s*// eslint-disable.*?\n', '\n')
repl_re('components/UI/AppBackButton.jsx', r'\s*useHistory,\s*// eslint-disable.*?\n', '\n')

# 2. JoinByCode.jsx
repl('components/Classroom/JoinByCode.jsx', 'catch (_) {', 'catch {\n          // Non-fatal — the DB was already updated by the join above.')

# 3. ModuleAssessmentWorkflowPrototype.jsx
repl_re('components/Classroom/ModuleAssessmentWorkflowPrototype.jsx', r'const \[workflowStatus, setWorkflowStatus\] = useState\([^\)]+\);', '')
repl_re('components/Classroom/ModuleAssessmentWorkflowPrototype.jsx', r'setWorkflowStatus\([^)]+\);?', '')
repl_re('components/Classroom/ModuleAssessmentWorkflowPrototype.jsx', r'const \[loadingTopics, setLoadingTopics\] = useState\([^)]+\);', '')
repl_re('components/Classroom/ModuleAssessmentWorkflowPrototype.jsx', r'loadingTopics \|\| ', '')
repl_re('components/Classroom/ModuleAssessmentWorkflowPrototype.jsx', r'setLoadingTopics\([^)]+\);?', '')

# 4. Remove unused imports
motion_files = [
    'components/HeroContent.jsx', 'components/IconsCarousel.jsx', 'components/Navbar.jsx', 
    'components/XPProgressBar.jsx', 'components/features/FeaturesDisplay.jsx', 
    'components/features/FeaturesIntro.jsx', 'components/features/FloatingDots.jsx', 
    'components/StatBar.jsx', 'components/TiltCard.jsx', 'pages/Contact.jsx', 
    'pages/Features.jsx', 'pages/Home.jsx', 'pages/Login.jsx', 'pages/Register.jsx', 
    'pages/Signout.jsx', 'pages/onboarding/Onboarding.jsx'
]
for f in motion_files:
    repl_re(f, r"import\s*\{\s*motion\s*(?:,\s*AnimatePresence)?\s*\}\s*from\s*['\"]framer-motion['\"];?", "")
repl_re('components/features/FeaturesDisplay.jsx', r',\s*Icon\s*', '')

# 5. StudentPersonalResourcesPage.jsx
s_res = 'pages/Classroom/StudentPersonalResourcesPage.jsx'
helper = '''
const toSafeFileName = (value) =>
  String(value || 'study-report')
    .trim()
    .replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, '-')
    .replace(/\\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'study-report';
'''
content = read(s_res)
if 'toSafeFileName =' not in content:
    # Just insert it after import React
    content = content.replace("import React, { useEffect, useMemo, useState, useRef } from 'react';", 
                              "import React, { useEffect, useMemo, useState, useRef } from 'react';\n" + helper)
    write(s_res, content)

# 6. Unused navigation hooks
nav_files = [
    'components/Classroom/StudentProgressTimeline.jsx', 'components/Skill/SkillPathwayResource.jsx',
    'pages/Classroom/InteractiveLessonViewer.jsx', 'pages/Classroom/TeacherGradingDashboard.jsx',
    'pages/ProjectAnalyzerPage.jsx'
]
for f in nav_files:
    repl_re(f, r'const\s+navigate\s*=\s*useNavigate\(\);\s*', '')

# Unused hook imports
repl_re('pages/Classroom/ClassroomDashboard.jsx', r"import\s*\{\s*useAIJobStatus\s*\}\s*from\s*['\"]../../hooks/useAIJob['\"];?", '')
repl_re('pages/Classroom/LearningModules.jsx', r"import\s*\{\s*useAIJobStatus\s*\}\s*from\s*['\"]../../hooks/useAIJob['\"];?", '')
repl_re('pages/Classroom/ClassroomDashboard.jsx', r"import\s*apiClient\s*from\s*['\"]../../services/apiClient['\"];?", '')
repl_re('pages/Classroom/LearningModules.jsx', r"import\s*apiClient\s*from\s*['\"]../../services/apiClient['\"];?", '')

# Unused state values
repl_re('components/Skill/SkillPathwayResource.jsx', r'const \[progressStatus, setProgressStatus\] = useState\([^)]*\);\s*', '')
repl_re('components/Skill/SkillPathwayResource.jsx', r'setProgressStatus\([^)]*\);?\s*', '')

repl_re('pages/Classroom/ClassroomDashboard.jsx', r'const \{\s*studentClassProgress,\s*loading:\s*classContextLoading,\s*error:\s*classContextError\s*\}\s*=\s*useClassroomContext\(\);\s*', 'const {} = useClassroomContext();\n')
repl_re('pages/Classroom/ClassroomDashboard.jsx', r'const \{\s*loading:\s*classContextLoading,\s*error:\s*classContextError\s*\}\s*=\s*useClassroomContext\(\);\s*', 'const {} = useClassroomContext();\n')
repl_re('pages/Classroom/ClassroomDashboard.jsx', r'const \{\s*roomsDisplay,\s*error:\s*roomsError\s*\}\s*=\s*useRooms\(\);\s*', 'const { error: roomsError } = useRooms();\n')

repl_re('pages/Classroom/LearningModules.jsx', r'const \[completionPercentage, setCompletionPercentage\] = useState\([^)]*\);\s*', '')
repl_re('pages/Classroom/LearningModules.jsx', r'const \[studentProgress, setStudentProgress\] = useState\([^)]*\);\s*', '')
repl_re('pages/Classroom/LearningModules.jsx', r'const \{\s*removeResource:\s*removeResourceFromModule,\s*loading:\s*removingResource\s*\}\s*=', 'const { removeResource: removeResourceFromModule } =')

repl_re('pages/Dashboard.jsx', r'const \[focusedProgressPercent, setFocusedProgressPercent\] = useState\([^)]*\);\s*', '')
repl_re('pages/Dashboard.jsx', r'const \[focusedVideoCount, setFocusedVideoCount\] = useState\([^)]*\);\s*', '')
repl_re('pages/Dashboard.jsx', r'const \[focusedArticleCount, setFocusedArticleCount\] = useState\([^)]*\);\s*', '')
repl_re('pages/Dashboard.jsx', r'const \[focusedMasteredCount, setFocusedMasteredCount\] = useState\([^)]*\);\s*', '')
repl_re('pages/Dashboard.jsx', r'const \[pathwayStageLoading, setPathwayStageLoading\] = useState\([^)]*\);\s*', '')
repl_re('pages/Dashboard.jsx', r'const \[userSkills, setUserSkills\] = useState\([^)]*\);\s*', '')
repl_re('pages/Dashboard.jsx', r'const handleTakeSkillAssessment = async \(\) => \{[^}]*\};\s*', '')
repl_re('pages/Dashboard.jsx', r'const isLocked = .*?\n', '')

repl_re('pages/Classroom/StudentPersonalResourcesPage.jsx', r'const \[activeStudioPanel, setActiveStudioPanel\] = useState\([^)]*\);\s*', '')
repl_re('pages/Classroom/StudentPersonalResourcesPage.jsx', r'setActiveStudioPanel\([^)]*\);?\s*', '')

# 7. Unnecessary string escapes
repl('components/Skill/SkillPathwayResource.jsx', '.replace(/\\"/g, \'"\')', '.replace(/"/g, \'"\')')
repl('pages/Classroom/InteractiveLessonViewer.jsx', '.replace(/\\"/g, \'"\')', '.replace(/"/g, \'"\')')

# 8 & 9. useAIJob.js & storage.js Catch blocks
for f in ['hooks/useAIJob.js', 'utils/storage.js']:
    repl_re(f, r'catch\s*\([^\)]+\)\s*\{', 'catch {')
    # and for storage.js which might have unused variables
    repl_re(f, r'catch\s*\(\s*[a-zA-Z_]+\s*\)\s*\{', 'catch {')

print("Applied automated fixes!")
