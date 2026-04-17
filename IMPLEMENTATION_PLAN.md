# 📘 Quasar LMS Pipeline: Comprehensive Implementation Plan

## Executive Summary
This document provides a detailed, file-by-file, API-by-API, and schema-by-schema breakdown of implementing a **strict sequential learning module system** where students must complete resources (YouTube videos) in order, pass knowledge checks (≥80% on 2 attempts), and then take a final module assessment.

---

# PHASE 0: SYSTEM DEBLOAT & CLEANUP

## 0.1 Frontend Files to DELETE

### Rationale
These components were built for an older, disconnected system design where quizzes and resources were floating features. They conflict with the new integrated module-centric architecture.

**Files to Remove:**

1. **`frontend/src/components/Classroom/QuizGenerator.jsx`**
   - Reason: Was a top-level teacher tool. Quizzes are now generated per-resource within modules.
   - Dependency Check: Search for imports of this component across the frontend.

2. **`frontend/src/components/Classroom/QuizTaker.jsx`**
   - Reason: Was a generic quiz taker. Quizzes are now embedded in `InteractiveLessonViewer.jsx`.
   - Dependency Check: Remove imports from `App.jsx`.

3. **`frontend/src/pages/Classroom/ClassroomResources.jsx`**
   - Reason: Students no longer have a generic resource hub. All resources are accessed via modules in strict order.
   - Dependency Check: Verify no other student-facing routes reference this.

4. **`frontend/src/components/Classroom/YoutubeAssessment.jsx`**
   - Reason: Old YouTube-specific UI. Functionality is being refactored into the new `InteractiveLessonViewer.jsx` with unified AI tools.
   - Dependency Check: Search for usages in routes and dashboard components.

5. **`frontend/src/pages/Classroom/SkillAssessmentRecommendations.jsx`**
   - Reason: Old recommendation system disconnected from modules. Recommendations are now embedded in each module's resource list.
   - Dependency Check: Ensure no teacher workflows depend on this.

---

### 0.2 Frontend Files to MODIFY

#### `frontend/src/App.jsx`
**Current Routes to Remove:**
- `/classroom/:classroomId/resources` (ClassroomResources)
- `/classroom/:classroomId/quiz/create` (QuizGenerator)
- `/classroom/:classroomId/quiz/take/:quizId` (QuizTaker)
- `/classroom/:classroomId/skills` (SkillAssessmentRecommendations)
- `/classroom/:classroomId/youtube-assessment` (YoutubeAssessment)

**New Routes to Add:**
- `/classroom/:classroomId/modules/:moduleId/learn/:resourceId` → `InteractiveLessonViewer.jsx`
- `/classroom/:classroomId/modules/manage` → Module management (teacher only)
- `/classroom/:classroomId/roster/:studentId` → Student progress drill-down (teacher only)
- `/classroom/:classroomId/grading` → Pending manual grades (teacher only)

---

#### `frontend/src/pages/Classroom/ClassroomDashboard.jsx`
**Changes:**
- Remove the "Create Quiz" button (already done in previous session).
- Add a new **Activity Feed Section** that displays recent student actions.
- Add a "Pending Grading" alert badge if there are Final Assessments awaiting teacher grades.
- Simplify the UI to show only:
  - Classroom name, description, student count.
  - Activity Feed (latest 5 actions).
  - Pending Grading count.
  - Quick links to Modules, Roster, and Grading Dashboard.

---

#### `frontend/src/components/Classroom/LearningModules.jsx`
**Current State Issues:**
- Shows resources as simple links without progression locks.
- No visual indication of whether a resource is unlocked.

**Required Changes:**
- Fetch `StudentProgress` data from backend for the current student.
- For each resource in the module, display:
  - ✅ Status badge: "Unlocked" (if ≥2 tests with 80% passed), "Locked" (if not), "In Progress" (if 0-1 tests passed).
  - Progress bar: "1/2 tests passed", "2/2 tests passed".
  - Click handler: If unlocked, open `InteractiveLessonViewer.jsx` for that resource. If locked, show a message explaining the Rule of Two.
- At the bottom, show the Final Module Assessment status:
  - "Coming Soon" if not published.
  - "Take Final Assessment" button if published and all resources are unlocked.
  - "Final Assessment Complete (Score: 92%)" if already taken.

---

## 0.3 Backend Files to CLEAN UP

### `Backend/routes/youtube_quiz_routes.py`
**Current Issues:**
- Uses in-memory `youtube_quiz_cache` dictionary. This is temporary and doesn't persist across server restarts or track the "Rule of Two."

**Required Changes:**
- **Remove the `youtube_quiz_cache` dictionary entirely.**
- Modify the `/api/youtube-quiz/generate` endpoint to:
  - Accept `classroom_id`, `module_id`, `resource_id` as query parameters (in addition to `youtube_url`).
  - Generate a quiz and **immediately save it** to a new `QuizAttempt` collection in MongoDB (see Schema section).
  - Return the quiz with a `quiz_attempt_id` for tracking.
- Modify the `/api/youtube-quiz/submit` endpoint to:
  - Accept the submission and `quiz_attempt_id`.
  - Save the submission result to the `QuizAttempt` record.
  - Fetch the `StudentProgress` record for this student + resource.
  - If score ≥ 80%, increment `passed_tests_count`.
  - If `passed_tests_count` reaches 2, set `is_unlocked = True` for the next resource in the module.
  - Return the grading feedback (correct answers, what they got wrong, where to review).

---

### `Backend/routes/rag_route.py`
**Current Issues:**
- Generates summaries on-demand without persistence.
- Q&A responses are single-use; no history is stored.

**Required Changes:**
- Create a new endpoint `/api/resource/summary/get-or-create`:
  - Accepts `resource_id`, `resource_url`.
  - If `Resource.cached_summary` exists, return it immediately (cache hit).
  - If not, generate the summary using LLM, save it to `Resource.cached_summary` in MongoDB, and return it.
- Modify the Q&A endpoint `/api/youtube-qa/ask`:
  - Accepts `resource_id`, `question`, `student_id`.
  - Generates the answer (strict single-turn, no multi-turn context).
  - Appends `{question, answer, timestamp}` to `StudentProgress.single_turn_chat_history[resource_id]`.
  - Returns the answer + current chat history for that resource.

---

### `Backend/database.py`
**No deletions needed**, but ensure the database initialization is idempotent and creates indexes for fast queries:
- Index on `StudentProgress(student_id, module_id)` for fast progress lookups.
- Index on `QuizAttempt(resource_id, student_id)` for fast quiz history lookups.
- Index on `ModuleAssessment(module_id, is_published)` for fetching published assessments.

---

## 0.4 Test Files to ADD/MODIFY

### `Backend/tests/test_youtube_quiz_routes_v2.py` (NEW FILE)
**Purpose:** Ensure the new quiz generation and submission logic works correctly with MongoDB persistence.

**Tests to Write:**
1. `test_quiz_generation_creates_attempt_in_db()` - Generate a quiz, verify it's saved to `QuizAttempt`.
2. `test_quiz_submission_updates_student_progress()` - Submit a quiz, verify `passed_tests_count` is incremented.
3. `test_passing_two_tests_unlocks_next_resource()` - Simulate student passing 2 quizzes, verify next resource's `StudentProgress.is_unlocked` is set to True.
4. `test_failing_quiz_does_not_increment_count()` - Submit a quiz with < 80%, verify `passed_tests_count` is not incremented.

---

### `Backend/tests/test_rag_route_v2.py` (NEW FILE)
**Purpose:** Ensure the summary caching and Q&A history logic works.

**Tests to Write:**
1. `test_summary_first_request_generates_and_caches()` - First call to summary endpoint, verify it's generated and saved to DB.
2. `test_summary_second_request_returns_cached()` - Second call to same resource, verify cached version is returned (not regenerated).
3. `test_qa_single_turn_appends_to_history()` - Ask a question, verify it and the answer are appended to `StudentProgress.single_turn_chat_history`.
4. `test_qa_returns_chat_history()` - Ask a question, verify the response includes the full chat history for that resource.

---

## 0.5 Validation Checklist for Phase 0

- [ ] All imports of deleted components removed from `App.jsx`.
- [ ] Frontend builds successfully: `npm run build` in `frontend/` directory.
- [ ] No console errors or broken routes in the running app.
- [ ] Backend tests pass: `pytest Backend/tests/test_*.py -v`.
- [ ] Database migrations (if using them) applied successfully.

---

---

# PHASE 1: DATABASE SCHEMA & MODELS

## 1.1 Updated MongoDB Collections

### 1. `resources` Collection (EXISTING, TO UPDATE)

**Current Fields:**
```
{
  _id: ObjectId,
  classroom_id: ObjectId,
  module_id: ObjectId,
  resource_type: "youtube" | "pdf" | "link",
  title: String,
  description: String,
  url: String,
  created_at: DateTime,
  updated_at: DateTime
}
```

**New Fields to Add:**
```
{
  ...existing fields...
  
  # Sequential ordering within the module
  order_index: Integer (0-indexed, enforces sequential access),
  
  # AI-generated cached summary
  cached_summary: String (null initially, populated on first "Generate Summary" click),
  cached_summary_generated_at: DateTime (null initially),
  
  # Unlock criteria for this resource (the next resource in the sequence)
  min_passing_tests_required: Integer (default: 2, represents Rule of Two),
  passing_score_threshold: Float (default: 0.80, represents 80%),
}
```

**Indexes to Add:**
```
db.resources.createIndex({ "classroom_id": 1, "module_id": 1, "order_index": 1 })
db.resources.createIndex({ "_id": 1, "cached_summary": 1 })
```

---

### 2. `student_progress` Collection (NEW)

**Purpose:** Track each student's progression through each resource in each module.

**Schema:**
```
{
  _id: ObjectId,
  student_id: ObjectId (FK to users collection),
  classroom_id: ObjectId (FK to classrooms collection),
  module_id: ObjectId (FK to modules collection),
  resource_id: ObjectId (FK to resources collection),
  
  # Unlocking logic
  is_unlocked: Boolean (default: False initially, True after passing 2 tests with ≥80%),
  unlocked_at: DateTime (null initially),
  
  # Quiz attempt tracking
  tests_taken: Integer (count of all quiz attempts for this resource),
  passed_tests_count: Integer (count of attempts with score ≥ 80%),
  failed_tests_count: Integer (count of attempts with score < 80%),
  highest_score: Float (best score across all attempts),
  last_test_date: DateTime (null initially),
  
  # AI interaction history
  single_turn_chat_history: Array of Objects [
    {
      question: String,
      answer: String,
      asked_at: DateTime
    }
  ],
  
  # Metadata
  created_at: DateTime,
  updated_at: DateTime,
  last_accessed_at: DateTime
}
```

**Indexes:**
```
db.student_progress.createIndex({ "student_id": 1, "classroom_id": 1, "module_id": 1 })
db.student_progress.createIndex({ "resource_id": 1, "student_id": 1 })
```

---

### 3. `quiz_attempts` Collection (NEW)

**Purpose:** Store each individual quiz attempt, including questions, answers, scores, and AI feedback.

**Schema:**
```
{
  _id: ObjectId,
  resource_id: ObjectId (FK to resources),
  student_id: ObjectId (FK to users),
  classroom_id: ObjectId (FK to classrooms),
  module_id: ObjectId (FK to modules),
  
  # Quiz content
  questions: Array of Objects [
    {
      id: String (UUID),
      type: "mcq" | "fill_blank" | "short_answer",
      question_text: String,
      options: Array<String> (for MCQs),
      correct_answer: String,
      points: Integer,
      student_answer: String (null until submitted),
      is_correct: Boolean (null until submitted)
    }
  ],
  
  # Grading
  total_points: Integer,
  score_obtained: Integer,
  score_percentage: Float (calculated as score_obtained / total_points),
  passed: Boolean (True if score_percentage >= passing_score_threshold from Resource),
  
  # Feedback (generated after submission)  
  ai_feedback: String (AI analysis of what they got right/wrong and where to focus),
  
  # Metadata
  started_at: DateTime,
  submitted_at: DateTime (null until submitted),
  duration_seconds: Integer (calculated from submitted_at - started_at),
  attempt_number: Integer (1st attempt, 2nd attempt, etc.)
}
```

**Indexes:**
```
db.quiz_attempts.createIndex({ "resource_id": 1, "student_id": 1, "submitted_at": -1 })
db.quiz_attempts.createIndex({ "student_id": 1, "classroom_id": 1, "module_id": 1 })
```

---

### 4. `module_assessments` Collection (NEW)

**Purpose:** Store the Final Module Assessment (the high-stakes test given at the end of a module after all resources are completed).

**Schema:**
```
{
  _id: ObjectId,
  module_id: ObjectId (FK to modules),
  classroom_id: ObjectId (FK to classrooms),
  created_by_teacher_id: ObjectId (FK to users),
  
  # Draft vs Published state
  status: "draft" | "published" | "archived",
  is_draft: Boolean (True until teacher clicks "Publish"),
  is_published: Boolean (opposite of is_draft),
  published_at: DateTime (null if still draft),
  
  # Assessment configuration
  title: String (e.g., "Module 1: Cloud Computing Final Assessment"),
  description: String,
  total_points: Integer,
  passing_score_percentage: Float (default: 0.70, represents 70% minimum to pass module),
  
  # Execution rules
  time_limit_minutes: Integer (e.g., 60 for a 1-hour exam),
  valid_from: DateTime (when assessment becomes available),
  valid_until: DateTime (hard deadline for taking the assessment),
  allow_retakes: Boolean (default: False, students get one shot),
  shuffle_questions: Boolean (default: True, questions randomized for each student),
  
  # Question bank
  questions: Array of Objects [
    {
      id: String (UUID),
      type: "mcq" | "fill_blank" | "short_answer" | "essay",
      question_text: String,
      options: Array<String> (for MCQs),
      correct_answer: String (for MCQs/fill_blank),
      points: Integer,
      expected_length: String (for essays, e.g., "100-150 words"),
      rubric: String (for subjective questions, describes grading criteria)
    }
  ],
  
  # Metadata
  created_at: DateTime,
  updated_at: DateTime
}
```

**Indexes:**
```
db.module_assessments.createIndex({ "module_id": 1, "status": 1 })
```

---

### 5. `assessment_submissions` Collection (NEW)

**Purpose:** Store each student's submission for a Final Module Assessment.

**Schema:**
```
{
  _id: ObjectId,
  assessment_id: ObjectId (FK to module_assessments),
  student_id: ObjectId (FK to users),
  classroom_id: ObjectId (FK to classrooms),
  module_id: ObjectId (FK to modules),
  
  # Execution timing
  started_at: DateTime,
  submitted_at: DateTime (null if not yet submitted),
  time_spent_seconds: Integer (calculated from submitted_at - started_at),
  
  # Submission content
  answers: Array of Objects [
    {
      question_id: String (UUID),
      student_answer: String,
      type: "mcq" | "fill_blank" | "short_answer" | "essay"
    }
  ],
  
  # Grading state
  grading_status: "auto_graded" | "pending_manual_grade" | "fully_graded",
  
  # Auto-graded results (immediate)
  auto_graded_score: Integer (sum of points from MCQs/fill_blanks only),
  auto_graded_at: DateTime,
  
  # Manual grading results (teacher adds these)
  manual_graded_score: Integer (sum of points from essay/subjective questions),
  graded_by_teacher_id: ObjectId (FK to users, the teacher who graded),
  manual_graded_at: DateTime,
  teacher_feedback: String (optional comments from teacher),
  
  # Final score
  total_score: Integer (auto_graded_score + manual_graded_score),
  score_percentage: Float (total_score / total_points from assessment),
  passed: Boolean (True if score_percentage >= passing_score_percentage),
  is_final_score: Boolean (True once all grading is done; no further changes allowed)
}
```

**Indexes:**
```
db.assessment_submissions.createIndex({ "assessment_id": 1, "student_id": 1 })
db.assessment_submissions.createIndex({ "grading_status": 1, "classroom_id": 1 })
```

---

### 6. `activity_feed` Collection (NEW)

**Purpose:** Store real-time activity logs for the Activity Feed on the Teacher Dashboard.

**Schema:**
```
{
  _id: ObjectId,
  classroom_id: ObjectId (FK to classrooms),
  action_type: "quiz_passed" | "quiz_failed" | "resource_unlocked" | "ai_question_asked" | "assessment_submitted" | "assessment_graded",
  student_id: ObjectId (FK to users, the student who performed the action),
  action_performed_by_id: ObjectId (FK to users, usually same as student_id, but for teacher actions like grading, this is the teacher),
  
  # Context
  resource_id: ObjectId (if action involves a resource),
  module_id: ObjectId (if action involves a module),
  assessment_id: ObjectId (if action involves an assessment),
  quiz_attempt_id: ObjectId (if action involves a quiz),
  
  # Details (varies by action_type)
  details: Object {
    score: Float (if quiz_passed or quiz_failed),
    question: String (if ai_question_asked),
    resource_title: String,
    module_title: String
  },
  
  # Metadata
  created_at: DateTime,
  visibility_until: DateTime (optional, for pruning old feed items)
}
```

**Indexes:**
```
db.activity_feed.createIndex({ "classroom_id": 1, "created_at": -1 })
```

---

## 1.2 Backend Models (Pydantic)

**File:** `Backend/models/student_progress.py` (NEW)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class ChatHistoryItem(BaseModel):
    question: str
    answer: str
    asked_at: datetime

class StudentProgress(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    student_id: str
    classroom_id: str
    module_id: str
    resource_id: str
    
    is_unlocked: bool = False
    unlocked_at: Optional[datetime] = None
    
    tests_taken: int = 0
    passed_tests_count: int = 0
    failed_tests_count: int = 0
    highest_score: Optional[float] = None
    last_test_date: Optional[datetime] = None
    
    single_turn_chat_history: List[ChatHistoryItem] = []
    
    created_at: datetime
    updated_at: datetime
    last_accessed_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
```

---

**File:** `Backend/models/quiz_attempt.py` (NEW)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class QuestionType(str, Enum):
    MCQ = "mcq"
    FILL_BLANK = "fill_blank"
    SHORT_ANSWER = "short_answer"

class QuizQuestion(BaseModel):
    id: str (UUID)
    type: QuestionType
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: str
    points: int
    student_answer: Optional[str] = None
    is_correct: Optional[bool] = None

class QuizAttempt(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    resource_id: str
    student_id: str
    classroom_id: str
    module_id: str
    
    questions: List[QuizQuestion]
    total_points: int
    score_obtained: int
    score_percentage: float
    passed: bool
    
    ai_feedback: str
    
    started_at: datetime
    submitted_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    attempt_number: int
    
    class Config:
        populate_by_name = True
```

---

**File:** `Backend/models/module_assessment.py` (NEW)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class AssessmentStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class AssessmentQuestion(BaseModel):
    id: str (UUID)
    type: str  # "mcq" | "fill_blank" | "short_answer" | "essay"
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    points: int
    expected_length: Optional[str] = None
    rubric: Optional[str] = None

class ModuleAssessment(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    module_id: str
    classroom_id: str
    created_by_teacher_id: str
    
    status: AssessmentStatus
    is_draft: bool
    is_published: bool
    published_at: Optional[datetime] = None
    
    title: str
    description: str
    total_points: int
    passing_score_percentage: float = 0.70
    
    time_limit_minutes: int
    valid_from: datetime
    valid_until: datetime
    allow_retakes: bool = False
    shuffle_questions: bool = True
    
    questions: List[AssessmentQuestion]
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True
```

---

**File:** `Backend/models/assessment_submission.py` (NEW)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class GradingStatus(str, Enum):
    AUTO_GRADED = "auto_graded"
    PENDING_MANUAL_GRADE = "pending_manual_grade"
    FULLY_GRADED = "fully_graded"

class StudentAnswer(BaseModel):
    question_id: str
    student_answer: str
    type: str

class AssessmentSubmission(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    assessment_id: str
    student_id: str
    classroom_id: str
    module_id: str
    
    started_at: datetime
    submitted_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None
    
    answers: List[StudentAnswer]
    
    grading_status: GradingStatus
    auto_graded_score: int = 0
    auto_graded_at: Optional[datetime] = None
    
    manual_graded_score: int = 0
    graded_by_teacher_id: Optional[str] = None
    manual_graded_at: Optional[datetime] = None
    teacher_feedback: Optional[str] = None
    
    total_score: int = 0
    score_percentage: float = 0.0
    passed: bool = False
    is_final_score: bool = False
    
    class Config:
        populate_by_name = True
```

---

## 1.3 Database Migration Strategy

**File:** `Backend/migrations/001_add_lms_collections.py` (NEW)

**Purpose:** Idempotent migration that creates the new collections and indexes if they don't exist.

```python
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

def migrate_up(db):
    """Create new collections and indexes for the LMS system."""
    
    # Update existing 'resources' collection
    try:
        db.resources.update_many({}, {
            "$set": {
                "order_index": 0,
                "cached_summary": None,
                "cached_summary_generated_at": None,
                "min_passing_tests_required": 2,
                "passing_score_threshold": 0.80
            }
        })
    except Exception as e:
        print(f"Error updating resources collection: {e}")
    
    # Create indexes on resources
    try:
        db.resources.create_index([("classroom_id", 1), ("module_id", 1), ("order_index", 1)])
        db.resources.create_index([("_id", 1), ("cached_summary", 1)])
    except DuplicateKeyError:
        pass  # Index already exists
    
    # Create student_progress collection
    db.create_collection("student_progress") if "student_progress" not in db.list_collection_names() else None
    db.student_progress.create_index([("student_id", 1), ("classroom_id", 1), ("module_id", 1)])
    db.student_progress.create_index([("resource_id", 1), ("student_id", 1)])
    
    # Create quiz_attempts collection
    db.create_collection("quiz_attempts") if "quiz_attempts" not in db.list_collection_names() else None
    db.quiz_attempts.create_index([("resource_id", 1), ("student_id", 1), ("submitted_at", -1)])
    db.quiz_attempts.create_index([("student_id", 1), ("classroom_id", 1), ("module_id", 1)])
    
    # Create module_assessments collection
    db.create_collection("module_assessments") if "module_assessments" not in db.list_collection_names() else None
    db.module_assessments.create_index([("module_id", 1), ("status", 1)])
    
    # Create assessment_submissions collection
    db.create_collection("assessment_submissions") if "assessment_submissions" not in db.list_collection_names() else None
    db.assessment_submissions.create_index([("assessment_id", 1), ("student_id", 1)])
    db.assessment_submissions.create_index([("grading_status", 1), ("classroom_id", 1)])
    
    # Create activity_feed collection
    db.create_collection("activity_feed") if "activity_feed" not in db.list_collection_names() else None
    db.activity_feed.create_index([("classroom_id", 1), ("created_at", -1)])
    
    print("✓ Database migration 001 completed successfully")

def migrate_down(db):
    """Rollback: This is not recommended for production. Document decision."""
    print("⚠️  Rollback for migration 001 not implemented. Manual cleanup required.")
```

**How to Execute:**
- Call this migration at startup in `Backend/database.py` initialization, or via a CLI command.
- The migration is idempotent (safe to run multiple times).

---

## 1.4 Validation Tests for Phase 1

**File:** `Backend/tests/test_schema_creation.py` (NEW)

```python
import pytest
from pymongo import MongoClient

@pytest.fixture
def db():
    client = MongoClient("mongodb://localhost:27017/")
    yield client["test_quasar"]
    client.drop_database("test_quasar")

def test_student_progress_collection_created(db):
    """Verify the student_progress collection exists and has proper indexes."""
    assert "student_progress" in db.list_collection_names()
    indexes = db.student_progress.index_information()
    assert any("student_id_1_classroom_id_1_module_id_1" in name for name in indexes)

def test_quiz_attempts_collection_created(db):
    """Verify the quiz_attempts collection exists and has proper indexes."""
    assert "quiz_attempts" in db.list_collection_names()
    indexes = db.quiz_attempts.index_information()
    assert any("resource_id_1" in name for name in indexes)

def test_module_assessments_collection_created(db):
    """Verify the module_assessments collection exists."""
    assert "module_assessments" in db.list_collection_names()

def test_assessment_submissions_collection_created(db):
    """Verify the assessment_submissions collection exists."""
    assert "assessment_submissions" in db.list_collection_names()

def test_activity_feed_collection_created(db):
    """Verify the activity_feed collection exists."""
    assert "activity_feed" in db.list_collection_names()

def test_resources_fields_updated(db):
    """Verify the resources collection has new fields."""
    db.resources.insert_one({
        "classroom_id": "cls_1",
        "module_id": "mod_1",
        "title": "Test Video",
        "url": "https://youtube.com/watch?v=test"
    })
    
    result = db.resources.find_one()
    assert "order_index" in result or result.get("order_index") == 0
    assert "cached_summary" in result or result.get("cached_summary") is None
```

---

---

# PHASE 2: BACKEND API RESTRUCTURING

## 2.1 Modified Routes: `Backend/routes/youtube_quiz_routes.py`

### Endpoint 1: Generate Quiz (Dynamic, Per-Attempt)
**Route:** `POST /api/youtube-quiz/generate`
**Purpose:** Generate a *brand new* quiz every time this endpoint is called.

**Request:**
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "resource_id": "res_abc123",
  "module_id": "mod_xyz789",
  "classroom_id": "cls_def456"
}
```

**Response:**
```json
{
  "quiz_attempt_id": "qa_12345",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question_text": "What is the main topic discussed in the video?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "points": 10
    },
    {
      "id": "q2",
      "type": "fill_blank",
      "question_text": "The capital of France is ________.",
      "points": 5
    }
  ],
  "total_points": 15,
  "time_limit_minutes": null
}
```

**Backend Logic:**
1. Extract transcript from `youtube_url`.
2. Use LLM to generate 5-8 questions (mix of MCQs, fill-blanks, short answers).
3. Create a `QuizAttempt` record in MongoDB with status `started`.
4. Return the quiz to the frontend.

---

### Endpoint 2: Submit Quiz & Get Feedback
**Route:** `POST /api/youtube-quiz/submit`
**Purpose:** Grade the quiz, provide feedback, and update student progress.

**Request:**
```json
{
  "quiz_attempt_id": "qa_12345",
  "student_id": "stu_xyz",
  "answers": [
    {"question_id": "q1", "answer": "Option A"},
    {"question_id": "q2", "answer": "Paris"}
  ]
}
```

**Response:**
```json
{
  "score_obtained": 12,
  "total_points": 15,
  "score_percentage": 0.8,
  "passed": true,
  "ai_feedback": "Great job! You correctly answered 8 out of 10 questions. You seemed confused about...",
  "correct_answers": [
    {"question_id": "q1", "correct_answer": "Option A", "you_answered": "Option A", "is_correct": true},
    {"question_id": "q2", "correct_answer": "Paris", "you_answered": "Paris", "is_correct": true}
  ],
  "progress_update": {
    "passed_tests_count": 1,
    "highest_score": 0.8,
    "is_unlocked": false,
    "message": "You passed 1 out of 2 required tests. Take one more test to unlock the next resource!"
  }
}
```

**Backend Logic:**
1. Fetch the `QuizAttempt` record.
2. Grade each answer against the correct answer.
3. Calculate score and passed status.
4. Update `QuizAttempt.submitted_at`, `score_obtained`, etc.
5. Fetch or create the `StudentProgress` record for this `student_id` + `resource_id`.
6. Increment `passed_tests_count` if `score_percentage >= 0.80`.
7. Update `highest_score` if needed.
8. If `passed_tests_count == 2`:
   - Set `StudentProgress.is_unlocked = True`.
   - Find the next resource in the module and create a `StudentProgress` record for it (unlocked = False initially).
9. Generate AI feedback explaining what they got right, wrong, and where to review the video.
10. Log an activity feed entry: "Student X passed Quiz for Resource Y".
11. Return the response with progress update.

---

## 2.2 Modified Routes: `Backend/routes/rag_route.py`

### Endpoint 1: Get or Create Summary
**Route:** `GET /api/resource/summary/get-or-create`
**Purpose:** Lazy-load the summary. First call generates it, subsequent calls return the cached version.

**Request:**
```json
{
  "resource_id": "res_abc123",
  "resource_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response (First Call - Generated):**
```json
{
  "summary": "This video discusses the fundamentals of cloud computing...",
  "cached_at": "2025-01-15T10:30:00Z",
  "is_cached": false
}
```

**Response (Subsequent Calls - Cached):**
```json
{
  "summary": "This video discusses the fundamentals of cloud computing...",
  "cached_at": "2025-01-15T10:30:00Z",
  "is_cached": true
}
```

**Backend Logic:**
1. Fetch the `Resource` by `resource_id`.
2. If `Resource.cached_summary` is not null, return it immediately with `is_cached: true`.
3. If null:
   a. Extract transcript from `resource_url`.
   b. Generate summary using LLM.
   c. Update `Resource.cached_summary` and `cached_summary_generated_at` in MongoDB.
   d. Return the newly generated summary with `is_cached: false`.

---

### Endpoint 2: Ask a Question (Single-Turn)
**Route:** `POST /api/youtube-qa/ask`
**Purpose:** Ask a single question about the resource. Strict single-turn (no multi-turn context).

**Request:**
```json
{
  "resource_id": "res_abc123",
  "resource_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "student_id": "stu_xyz",
  "question": "What does IaaS mean?"
}
```

**Response:**
```json
{
  "answer": "IaaS stands for Infrastructure as a Service. It refers to cloud services...",
  "question": "What does IaaS mean?",
  "asked_at": "2025-01-15T11:00:00Z",
  "chat_history": [
    {
      "question": "What does IaaS mean?",
      "answer": "IaaS stands for Infrastructure as a Service...",
      "asked_at": "2025-01-15T11:00:00Z"
    },
    {
      "question": "Can you give an example of IaaS?",
      "answer": "Yes, examples include AWS EC2, Microsoft Azure VMs...",
      "asked_at": "2025-01-15T11:05:00Z"
    }
  ]
}
```

**Backend Logic:**
1. Extract transcript from `resource_url`.
2. Create a RAG prompt: "Based on this transcript: [transcript], answer this question: [question]".
3. Use LLM to generate the answer (strict single-turn, don't feed previous chat history into the prompt).
4. Append `{question, answer, asked_at}` to `StudentProgress.single_turn_chat_history[resource_id]`.
5. Return the answer + full chat history for this resource.
6. Log an activity feed entry: "Student X asked: '[question]' about Resource Y".

---

### Endpoint 3: Get Chat History
**Route:** `GET /api/resource/chat-history/:resourceId/:studentId`
**Purpose:** Fetch all past Q&A for a student on a specific resource.

**Response:**
```json
{
  "chat_history": [
    {
      "question": "What does IaaS mean?",
      "answer": "IaaS stands for Infrastructure as a Service...",
      "asked_at": "2025-01-15T11:00:00Z"
    },
    {
      "question": "Can you give an example of IaaS?",
      "answer": "Yes, examples include AWS EC2, Microsoft Azure VMs...",
      "asked_at": "2025-01-15T11:05:00Z"
    }
  ]
}
```

**Backend Logic:**
1. Fetch `StudentProgress` for `(student_id, resource_id)`.
2. Return `StudentProgress.single_turn_chat_history`.

---

## 2.3 New Routes: Student Progress

### Endpoint: Get Student Progress
**Route:** `GET /api/student/progress/:moduleId`
**Purpose:** Fetch the student's progression data for a specific module.

**Response:**
```json
{
  "module_id": "mod_xyz",
  "resources": [
    {
      "resource_id": "res_1",
      "resource_title": "Intro to Cloud",
      "order_index": 0,
      "is_unlocked": true,
      "unlocked_at": "2025-01-14T15:00:00Z",
      "tests_taken": 2,
      "passed_tests_count": 2,
      "highest_score": 0.92,
      "status": "completed"
    },
    {
      "resource_id": "res_2",
      "resource_title": "Cloud Services",
      "order_index": 1,
      "is_unlocked": false,
      "tests_taken": 0,
      "passed_tests_count": 0,
      "highest_score": null,
      "status": "locked"
    }
  ],
  "final_assessment": {
    "status": "coming_soon",
    "published": false,
    "valid_from": null,
    "valid_until": null
  }
}
```

**Backend Logic:**
1. Fetch all `StudentProgress` records for `(student_id, module_id)`.
2. Sort by `order_index`.
3. Add resource metadata (title, type).
4. Determine status based on `is_unlocked` and `passed_tests_count`.
5. Fetch the `ModuleAssessment` status for this module.

---

## 2.4 New Routes: Module Assessments (Teacher)

### Endpoint 1: Generate Draft Final Assessment
**Route:** `POST /api/module-assessment/draft-generate`
**Purpose:** Teacher clicks "Generate Assessment". AI extracts from all video transcripts in the module and creates a draft.

**Request:**
```json
{
  "module_id": "mod_xyz",
  "num_questions": 20,
  "question_types": ["mcq", "fill_blank", "short_answer"]
}
```

**Response:**
```json
{
  "assessment_id": "ma_abc123",
  "status": "draft",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question_text": "What is the difference between IaaS and PaaS?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "points": 10
    },
    ...
  ],
  "total_points": 200,
  "message": "Draft assessment generated successfully. You can now edit the questions and publish when ready."
}
```

**Backend Logic:**
1. Fetch all `Resource` records for the `module_id`, ordered by `order_index`.
2. Extract transcripts for all YouTube resources.
3. Concatenate transcripts and send to LLM with a prompt like: "Based on these transcripts from a module on [module_topic], generate 20 comprehensive assessment questions of varying difficulty, mixing MCQs, fill-in-the-blanks, and short-answer questions. Ensure questions test deep understanding and can discriminate between students who understand vs don't."
4. Create a `ModuleAssessment` record with `status: "draft"`, `is_draft: true`, `is_published: false`.
5. Return the draft for teacher editing.

---

### Endpoint 2: Update Draft Assessment
**Route:** `PATCH /api/module-assessment/:assessmentId`
**Purpose:** Teacher edits the draft (add/remove/modify questions, set time limits, etc.).

**Request:**
```json
{
  "title": "Module 1: Cloud Computing Final Assessment",
  "description": "Comprehensive test covering all cloud service models.",
  "time_limit_minutes": 60,
  "valid_from": "2025-01-20T09:00:00Z",
  "valid_until": "2025-01-21T18:00:00Z",
  "passing_score_percentage": 0.70,
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question_text": "What does IaaS stand for?",
      "options": ["Infrastructure as a Service", "Internet as a Service", ...],
      "correct_answer": "Infrastructure as a Service",
      "points": 10
    },
    ...
  ]
}
```

**Response:**
```json
{
  "assessment_id": "ma_abc123",
  "status": "draft",
  "message": "Assessment updated successfully."
}
```

---

### Endpoint 3: Publish Assessment
**Route:** `POST /api/module-assessment/:assessmentId/publish`
**Purpose:** Teacher publishes the assessment. Students can now see it (as "Coming Soon" until `valid_from` time).

**Response:**
```json
{
  "assessment_id": "ma_abc123",
  "status": "published",
  "message": "Assessment published successfully. Students will see it after 2025-01-20 09:00 AM."
}
```

**Backend Logic:**
1. Update `ModuleAssessment.is_draft = false`, `is_published = true`, `published_at = now()`.
2. Log activity: "Teacher X published Final Assessment for Module Y".

---

## 2.5 New Routes: Assessment Submissions (Student)

### Endpoint 1: Start Assessment
**Route:** `POST /api/assessment-submission/start`
**Purpose:** Student begins the final assessment. A timer starts.

**Request:**
```json
{
  "assessment_id": "ma_abc123",
  "student_id": "stu_xyz"
}
```

**Response:**
```json
{
  "submission_id": "as_xyz123",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question_text": "...",
      "options": ["A", "B", "C", "D"]
    },
    ...
  ],
  "time_limit_minutes": 60,
  "started_at": "2025-01-20T09:00:00Z",
  "expires_at": "2025-01-20T10:00:00Z"
}
```

**Backend Logic:**
1. Verify all resources in the module are unlocked for this student (else return 403).
2. Create `AssessmentSubmission` record with `started_at = now()`, `grading_status = "auto_graded"` (placeholder).
3. Shuffle questions if `ModuleAssessment.shuffle_questions = true`.
4. Return the shuffled questions (without correct answers, obviously).

---

### Endpoint 2: Submit Assessment
**Route:** `POST /api/assessment-submission/:submissionId/submit`
**Purpose:** Student submits their answers. Grading begins (auto-grade MCQs/blanks immediately).

**Request:**
```json
{
  "answers": [
    {"question_id": "q1", "student_answer": "Option A"},
    {"question_id": "q2", "student_answer": "Paris"},
    {"question_id": "q3", "student_answer": "Cloud computing is..."}
  ]
}
```

**Response:**
```json
{
  "submission_id": "as_xyz123",
  "auto_graded_score": 70,
  "manual_graded_score": 0,
  "total_score": 70,
  "score_percentage": 0.70,
  "passed": true,
  "grading_status": "pending_manual_grade",
  "message": "Your assessment has been submitted! Auto-graded questions scored 70/100. Your essay/subjective answers are pending teacher review.",
  "auto_graded_results": [
    {"question_id": "q1", "student_answer": "Option A", "correct_answer": "Option A", "is_correct": true, "points": 10},
    {"question_id": "q2", "student_answer": "Paris", "correct_answer": "Paris", "is_correct": true, "points": 20}
  ],
  "pending_manual_grade_questions": [
    {"question_id": "q3", "type": "essay", "points": 30}
  ]
}
```

**Backend Logic:**
1. Fetch `AssessmentSubmission` and `ModuleAssessment`.
2. Verify submission is within time window and hasn't exceeded `time_limit_minutes`.
3. Store all `answers` in `AssessmentSubmission.answers`.
4. For each MCQ/fill-blank question, compare `student_answer` with `correct_answer` and grade.
5. Sum auto-graded points into `auto_graded_score`.
6. Update `submitted_at`, `auto_graded_at`, `auto_graded_score`.
7. For essay/subjective questions, flag them as `pending_manual_grade`.
8. Update `grading_status`:
   - If no subjective questions: `fully_graded`.
   - If subjective questions exist: `pending_manual_grade`.
9. Log activity: "Student X submitted Final Assessment for Module Y".
10. Notify teacher: "Pending grading for Student X".

---

## 2.6 New Routes: Manual Grading (Teacher)

### Endpoint 1: Get Pending Submissions to Grade
**Route:** `GET /api/teacher/pending-grades/:classroomId`
**Purpose:** Fetch all submissions pending teacher grading.

**Response:**
```json
{
  "pending_submissions": [
    {
      "submission_id": "as_xyz123",
      "student_name": "John Doe",
      "module_title": "Cloud Computing Basics",
      "submitted_at": "2025-01-20T10:45:00Z",
      "auto_graded_score": 70,
      "pending_questions_count": 2
    },
    ...
  ]
}
```

---

### Endpoint 2: Grade Subjective Answers
**Route:** `PATCH /api/assessment-submission/:submissionId/grade`
**Purpose:** Teacher assigns points to essay/subjective answers.

**Request:**
```json
{
  "grades": [
    {
      "question_id": "q3",
      "points_awarded": 28,
      "teacher_comment": "Excellent explanation of the architecture."
    },
    {
      "question_id": "q5",
      "points_awarded": 18,
      "teacher_comment": "Good attempt, but missed some key details."
    }
  ],
  "overall_feedback": "Well done overall! Your understanding of cloud services is solid."
}
```

**Response:**
```json
{
  "submission_id": "as_xyz123",
  "manual_graded_score": 46,
  "total_score": 116,
  "score_percentage": 0.86,
  "passed": true,
  "is_final_score": true,
  "grading_status": "fully_graded",
  "message": "Grading complete and submitted to student."
}
```

**Backend Logic:**
1. For each grade, update `AssessmentSubmission.answers[question_id].points_awarded`.
2. Sum `manual_graded_score` from all subjective grades.
3. Calculate `total_score = auto_graded_score + manual_graded_score`.
4. Calculate `score_percentage` and `passed` status.
5. Update `grading_status = "fully_graded"`.
6. Set `is_final_score = true` (final, no further changes allowed).
7. Log activity: "Teacher X graded submission for Student Y".
8. Return response. (The student will receive a notification that their grade is ready.)

---

---

# PHASE 3: FRONTEND COMPONENTS

## 3.1 New Components to Create

### Component 1: `InteractiveLessonViewer.jsx`
**Path:** `frontend/src/components/Classroom/InteractiveLessonViewer.jsx`
**Purpose:** The main learning interface. Displays video, AI chat, summary, and embedded quiz.

**Props:**
```javascript
{
  classroomId: String,
  moduleId: String,
  resourceId: String
}
```

**Component Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Module Name > Resource Name" + Back Button         │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│                          │  AI Q&A Panel                   │
│   YouTube Video Player   │  - Chat History                 │
│   (60% width)            │  - Input box                    │
│                          │  - "Summary" button              │
│                          │                                  │
├──────────────────────────┴──────────────────────────────────┤
│ Below Video: Progress Bar (X/2 tests passed)                │
│ Below Video: "Take Test" button (if not yet 2/2)            │
│ Below Video: "All tests passed! Next resource unlocked soon" │
└──────────────────────────────────────────────────────────────┘
```

**State:**
```javascript
const [videoUrl, setVideoUrl] = useState(null);
const [resource, setResource] = useState(null);
const [studentProgress, setStudentProgress] = useState(null);
const [chatHistory, setChatHistory] = useState([]);
const [summary, setSummary] = useState(null);
const [loadingSummary, setLoadingSummary] = useState(false);
const [askingAI, setAskingAI] = useState(false);
const [showQuizModal, setShowQuizModal] = useState(false);
const [currentQuestion, setCurrentQuestion] = useState("");
```

**Key Functions:**
1. `handleFetchProgress()` - Fetch student progress on mount.
2. `handleGenerateSummary()` - Call `/api/resource/summary/get-or-create`.
3. `handleAskQuestion()` - Call `/api/youtube-qa/ask`.
4. `handleTakeTest()` - Call `/api/youtube-quiz/generate` and open quiz modal.
5. `handleSubmitQuiz()` - Call `/api/youtube-quiz/submit` and update progress.

---

### Component 2: `QuizModal.jsx`
**Path:** `frontend/src/components/Classroom/QuizModal.jsx`
**Purpose:** Displays quiz questions, tracks answers, and handles submission.

**Props:**
```javascript
{
  quizAttemptId: String,
  questions: Array<Question>,
  totalPoints: Integer,
  onSubmit: Function,
  onClose: Function
}
```

**Features:**
- Display questions one-by-one or all on one page (your choice).
- Radio buttons for MCQs.
- Text input for fill-blanks.
- Textarea for short answers.
- "Submit Quiz" button at the end.
- Live score preview (optional).

---

### Component 3: `QuizFeedbackModal.jsx`
**Path:** `frontend/src/components/Classroom/QuizFeedbackModal.jsx`
**Purpose:** Shows feedback after quiz submission.

**Props:**
```javascript
{
  score: Float,
  totalPoints: Integer,
  passed: Boolean,
  aiFeedback: String,
  correctAnswers: Array,
  progressUpdate: Object,
  onClose: Function
}
```

**Display:**
- Score banner (green if passed, red if failed).
- AI Feedback text.
- Table showing each question with:
  - Question text.
  - Your answer.
  - Correct answer.
  - Whether you got it right.
- Progress update: "Passed 1/2 tests" or "All tests passed!".

---

### Component 4: `LearningModulesStudent.jsx` (Refactored)
**Path:** `frontend/src/pages/Classroom/LearningModulesStudent.jsx`
**Purpose:** Student view of modules. Shows locked/unlocked resources, allows opening them.

**Changes from Current LearningModules.jsx:**
- Add visual lock icon for locked resources.
- Show progress bar for each resource (X/2 tests).
- Clicking a resource opens `InteractiveLessonViewer.jsx` (if unlocked).
- Show Final Assessment status:
  - "Coming Soon" if not published.
  - "Take Final Assessment" if published and all resources unlocked.
  - "Completed (Score: 92%)" if already taken.

---

### Component 5: `ModuleAssessmentEditor.jsx`
**Path:** `frontend/src/components/Classroom/ModuleAssessmentEditor.jsx`
**Purpose:** Teacher interface to edit the draft assessment before publishing.

**Features:**
- Display all questions in an editable format.
- Add/remove/reorder questions.
- Set time limit, valid dates, passing score.
- Preview button (shows as it will appear to students).
- "Save as Draft" and "Publish" buttons.

---

### Component 6: `StudentAssessmentTaker.jsx`
**Path:** `frontend/src/components/Classroom/StudentAssessmentTaker.jsx`
**Purpose:** Student takes the final module assessment with a countdown timer.

**Features:**
- Timer showing remaining time (red alert if < 5 minutes).
- Display all questions (randomized).
- Autosave answers every 30 seconds.
- "Submit Assessment" button (with confirmation).
- Disable submit if time is up.

---

### Component 7: `TeacherGradingDashboard.jsx`
**Path:** `frontend/src/components/Classroom/TeacherGradingDashboard.jsx`
**Purpose:** Teacher dashboard for grading pending subjective answers.

**Features:**
- List of pending submissions.
- For each submission:
  - Student name, module name, submitted time.
  - Click to expand and see:
    - Auto-graded questions and their scores.
    - Subjective questions with text boxes for teacher to enter points.
    - Optional: Text area for teacher feedback.
  - "Save Grades" button.

---

### Component 8: `StudentProgressTimeline.jsx`
**Path:** `frontend/src/components/Classroom/StudentProgressTimeline.jsx`
**Purpose:** Detailed view of a single student's progress for teachers.

**Features:**
- Module name + overall completion status.
- Timeline:
  - Resource 1: Unlocked on [date]. Tests: 2/2 passed. Highest score: 92%.
  - Resource 2: Unlocked on [date]. Tests: 1/2 passed. Highest score: 75%.
  - Resource 3: Locked. 0 tests taken.
  - AI Questions Asked: 4 (with questions listed).
  - Final Assessment: Not yet available.

---

### Component 9: `ActivityFeed.jsx`
**Path:** `frontend/src/components/Classroom/ActivityFeed.jsx`
**Purpose:** Displays recent classroom activity on the teacher dashboard.

**Example Feed Items:**
- "Student John Doe passed Quiz for Resource 1 (89%)".
- "Student Jane Smith unlocked Resource 2".
- "Student Mark Wilson asked AI: 'What is IaaS?'".
- "Pending Grading: 3 submissions awaiting your review".

---

## 3.2 Modified Components

### `ClassroomDashboard.jsx` (Teacher View)
**Changes:**
- Simplify the layout.
- Add `ActivityFeed` component.
- Add "Pending Grading" badge linking to `TeacherGradingDashboard`.
- Add "View Roster" button to drill into individual students.

---

### `App.jsx`
**Route Updates:**

```javascript
// Remove these:
<Route path="/classroom/:classroomId/resources" element={<ClassroomResources />} />
<Route path="/classroom/:classroomId/quiz/create" element={<QuizGenerator />} />
<Route path="/classroom/:classroomId/quiz/take/:quizId" element={<QuizTaker />} />
<Route path="/classroom/:classroomId/skills" element={<SkillAssessmentRecommendations />} />

// Add these:
<Route path="/classroom/:classroomId/modules/:moduleId/learn/:resourceId" element={<InteractiveLessonViewer />} />
<Route path="/classroom/:classroomId/modules/manage" element={<LearningModulesTeacher />} /> // Teacher only
<Route path="/classroom/:classroomId/roster/:studentId" element={<StudentProgressTimeline />} /> // Teacher only
<Route path="/classroom/:classroomId/grading" element={<TeacherGradingDashboard />} /> // Teacher only
```

---

---

# PHASE 4: MODULE FINAL ASSESSMENT

## 4.1 Teacher Workflow (Design)

1. Teacher goes to `Modules` → clicks a specific module.
2. At the bottom of the module (after all resources listed), there's a "Draft Final Assessment" button.
3. Clicking it calls `/api/module-assessment/draft-generate`. A loading spinner appears.
4. Backend extracts all video transcripts, sends to LLM, generates 20 questions.
5. Teacher is taken to `ModuleAssessmentEditor.jsx` with the draft loaded.
6. Teacher can:
   - Edit questions.
   - Add/remove questions.
   - Set time limit (e.g., 60 minutes).
   - Set valid dates (e.g., "Available Jan 20-21").
   - Set passing score (e.g., 70%).
7. "Save as Draft" to keep editing later.
8. "Publish" when ready. Assessment becomes visible to students as "Coming Soon" until the valid date.

---

## 4.2 Student Workflow (Design)

1. Student goes to a module.
2. All resources are displayed with progress bars. Once all resources show "2/2 tests passed", the Final Assessment section appears.
3. If not published yet: "Final Assessment: Coming Soon (Available Jan 20 at 9 AM)".
4. Once available: "Take Final Assessment" button appears.
5. Clicking it:
   - Confirms the student is ready (timer cannot be paused once started).
   - Calls `/api/assessment-submission/start`.
   - Backend shuffles questions, creates a submission record, starts the timer.
   - `StudentAssessmentTaker.jsx` displays the quiz with a countdown timer.
6. Student answers all questions and clicks "Submit Assessment".
7. Backend auto-grades MCQs/fill-blanks, flags subjective answers for teacher.
8. Student sees a score banner immediately:
   - "You scored 86%. Your subjective answers are being reviewed by your teacher."
9. Once teacher grades subjective answers, student's final score is locked in. They receive a notification.

---

---

# PHASE 5: TEACHER DASHBOARD & ANALYTICS

## 5.1 Teacher Dashboard Layout (Design)

```
┌─────────────────────────────────────────────────────────────┐
│ Classroom: "CS 101: Cloud Computing"                        │
│ Students: 45 | Modules: 5                                   │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Pending Grading: 3 submissions                            │
│ [View Grading Dashboard]                                     │
├─────────────────────────────────────────────────────────────┤
│ ACTIVITY FEED (Last 10 Actions)                              │
│                                                              │
│ Jan 20, 10:45 AM - John Doe passed Quiz for Resource 1 (89%)│
│ Jan 20, 10:30 AM - Jane Smith unlocked Resource 2            │
│ Jan 20, 09:15 AM - Mark Wilson asked: "What is PaaS?"       │
│ Jan 20, 09:00 AM - Sarah Chen passed Quiz for Resource 1    │
│ ...                                                          │
│ [View Full Activity Log]                                     │
├─────────────────────────────────────────────────────────────┤
│ QUICK LINKS                                                  │
│ [View Modules] [View Roster] [Grading Dashboard]            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5.2 Roster View (Design)

```
┌─────────────────────────────────────────────────────────────┐
│ Classroom Roster: CS 101                                     │
├─────┬──────────────────┬────────────────┬────────────────────┤
│ No. │ Student Name     │ Overall Status │ Action             │
├─────┼──────────────────┼────────────────┼────────────────────┤
│ 1   │ John Doe         │ ⭐⭐⭐⭐ (67%)  │ [View Progress]    │
│ 2   │ Jane Smith       │ ⭐⭐⭐ (45%)    │ [View Progress]    │
│ 3   │ Mark Wilson      │ ⭐⭐⭐⭐⭐ (100%)│ [View Progress]    │
│ ... │ ...              │ ...            │ ...                │
└─────┴──────────────────┴────────────────┴────────────────────┘
```

Clicking [View Progress] opens `StudentProgressTimeline.jsx` for that student.

---

---

# PHASE 6: E2E TESTING & VALIDATION

## 6.1 Test Specifications

### Test Suite 1: Student Progression Lock (`test_student_progression_lock.py`)

```python
def test_student_cannot_access_locked_resource():
    """Student cannot fetch quiz or chat for Resource 2 if Resource 1 not passed."""
    # Setup: Create module with 2 resources.
    # Student attempts to hit /api/youtube-quiz/generate for Resource 2.
    # Expected: 403 Forbidden with message "Resource locked. Complete previous resource first."

def test_student_unlocks_after_two_passes():
    """Resource is unlocked after student passes 2 tests with ≥80%."""
    # Setup: Submit 2 successful quizzes for Resource 1.
    # Verify: StudentProgress.is_unlocked = True for Resource 2.
    # Verify: StudentProgress.is_unlocked = False for Resource 3.
```

---

### Test Suite 2: Summary Caching (`test_summary_caching.py`)

```python
def test_summary_cached_after_first_generation():
    """First call generates and caches summary. Second call returns cached."""
    # Call 1: /api/resource/summary/get-or-create → Generated (is_cached: False).
    # Call 2: /api/resource/summary/get-or-create → Cached (is_cached: True).
    # Verify: Both return identical summary text.

def test_summary_same_for_all_students():
    """All students see the same cached summary."""
    # Student A requests summary. It's generated.
    # Student B requests summary. They get the cached version.
    # Verify: identical content.
```

---

### Test Suite 3: Quiz Uniqueness (`test_quiz_uniqueness.py`)

```python
def test_each_quiz_attempt_different():
    """Every time a student clicks 'Take Test', a new, different quiz is generated."""
    # Student takes Quiz Attempt 1: Questions Q1, Q2, Q3, Q4, Q5.
    # Student takes Quiz Attempt 2: Questions Q1', Q2', Q3', Q4', Q5'.
    # Verify: Questions are different (at least 80% different).
```

---

### Test Suite 4: Assessment Grading (`test_assessment_grading.py`)

```python
def test_auto_grade_mcq_and_blanks():
    """MCQ and fill-blank questions are auto-graded immediately."""
    # Student submits assessment with 5 MCQs and 3 fill-blanks.
    # Response: auto_graded_score populated, pending_manual_grade = True.

def test_subjective_questions_pending():
    """Essay/subjective questions are flagged as pending."""
    # Student submits assessment with 2 essays.
    # Verify: grading_status = "pending_manual_grade".

def test_final_score_locked_after_teacher_grades():
    """Once teacher grades, score is locked. No further edits allowed."""
    # Teacher grades subjective questions and saves.
    # Verify: is_final_score = True.
    # Attempt to regrade: 403 Forbidden (already graded).
```

---

### Test Suite 5: Activity Feed (`test_activity_feed.py`)

```python
def test_activity_logged_on_quiz_pass():
    """Passing a quiz creates an activity feed entry."""
    # Student passes Quiz for Resource 1.
    # Verify: ActivityFeed entry created with action_type = "quiz_passed".

def test_activity_logged_on_resource_unlock():
    """Unlocking a resource creates an activity feed entry."""
    # StudentProgress.is_unlocked set to True.
    # Verify: ActivityFeed entry created.
```

---

## 6.2 Frontend Testing Scenarios

### Scenario 1: Complete End-to-End Student Flow
1. Student logs in, enters module.
2. Resource 1 shows "Unlocked". Resource 2 shows "Locked".
3. Student clicks "Take Test" for Resource 1.
4. Quiz modal appears with 5 questions.
5. Student answers and submits.
6. Feedback shows score. Progress shows "1/2 tests passed".
7. Student takes test again, passes with ≥80%.
8. Feedback shows "All tests passed! Resource 2 is now unlocked."
9. Student navigates back to module. Resource 2 is now "Unlocked".
10. Student clicks Resource 2, sees video + chat + summary button.

---

### Scenario 2: Final Assessment Flow
1. All resources unlocked. Final Assessment shows "Take Final Assessment".
2. Click button. Timer starts.
3. Questions are shuffled randomly.
4. Student answers all questions.
5. Submit. Auto-graded questions show score immediately.
6. Message: "Pending teacher review for subjective answers."

---

---

# CLEANUP CHECKLIST (Phase 0)

- [ ] Delete `QuizGenerator.jsx`.
- [ ] Delete `QuizTaker.jsx`.
- [ ] Delete `ClassroomResources.jsx`.
- [ ] Delete `YoutubeAssessment.jsx`.
- [ ] Delete `SkillAssessmentRecommendations.jsx`.
- [ ] Remove old routes from `App.jsx`.
- [ ] Update `ClassroomDashboard.jsx`.
- [ ] Remove `youtube_quiz_cache` from `youtube_quiz_routes.py`.
- [ ] Run `npm run build` in `frontend/` - verify no errors.
- [ ] Run `pytest Backend/tests/ -v` - all tests pass.
- [ ] Commit with message "Phase 0: System Debloat".

---

# IMPLEMENTATION SEQUENCE

**Recommended Order (to minimize blocked dependencies):**

1. **Phase 0**: Debloat (remove old files).
2. **Phase 1**: Database schemas + Pydantic models.
3. **Phase 2**: Backend API restructuring.
4. **Phase 3**: Frontend components.
5. **Phase 4**: Final assessment logic.
6. **Phase 5**: Teacher dashboards.
7. **Phase 6**: E2E testing.

Each phase should be fully tested before moving to the next.

---

**END OF IMPLEMENTATION DOCUMENT**
