# 🔧 Quasar LMS - Technical Architecture Deep Dive

**Audience**: Developers, Technical Stakeholders, System Architects  
**Last Updated**: April 20, 2026

---

## 📐 System Architecture in Detail

### Three-Tier Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ PRESENTATION TIER (What Users See)                            │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ React Frontend (Modern JavaScript UI Framework)          │  │
│ │ ├─ Teacher Dashboard                                    │  │
│ │ ├─ Student Learning Interface                          │  │
│ │ ├─ Assessment Taker                                    │  │
│ │ ├─ Grading Interface                                   │  │
│ │ └─ Analytics & Reporting                               │  │
│ └──────────────────────────────────────────────────────────┘  │
│              (Browser-based, runs on user's device)           │
└────────────────────────────────────────────────────────────────┘
                           │ HTTP/HTTPS
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ APPLICATION TIER (Business Logic)                             │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ FastAPI Backend (Python Async Web Framework)            │  │
│ │ ├─ Authentication Service (JWT)                         │  │
│ │ ├─ Classroom Service                                    │  │
│ │ ├─ Module Management Service                            │  │
│ │ ├─ Quiz Generation & Grading Service                    │  │
│ │ ├─ Assessment Service                                   │  │
│ │ ├─ Progress Tracking Service                            │  │
│ │ ├─ RAG / Q&A Service (AI Integration)                   │  │
│ │ ├─ Enrollment Service                                   │  │
│ │ ├─ Analytics Service                                    │  │
│ │ ├─ Announcements Service                                │  │
│ │ └─ RBAC Authorization                                   │  │
│ └──────────────────────────────────────────────────────────┘  │
│              (Server-side, processes all logic)               │
└────────────────────────────────────────────────────────────────┘
                           │ TCP/IP
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ DATA TIER (Persistent Storage)                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ MongoDB (NoSQL Database)                                │  │
│ │ ├─ Users Collection                                     │  │
│ │ ├─ Classrooms Collection                                │  │
│ │ ├─ Learning Modules Collection                          │  │
│ │ ├─ Resources Collection                                 │  │
│ │ ├─ Student Progress Collection (Core for Rule of 2)     │  │
│ │ ├─ Quiz Attempts Collection                             │  │
│ │ ├─ Module Assessments Collection                        │  │
│ │ ├─ Assessment Submissions Collection                    │  │
│ │ ├─ Announcements Collection                             │  │
│ │ ├─ Activity Feed Collection                             │  │
│ │ └─ Vector DB (Chroma - for semantic search)             │  │
│ └──────────────────────────────────────────────────────────┘  │
│           (Persistent storage, survives restarts)            │
└────────────────────────────────────────────────────────────────┘

External Services (Integrated):
├─ YouTube API (transcript extraction)
├─ LM Studio (local AI, runs on educator's machine)
├─ Google Gemini API (cloud AI fallback)
├─ Groq API (fast cloud AI fallback)
└─ Chroma Vector DB (semantic search storage)
```

---

## 🔄 Request Processing Pipeline

### How a Request Flows Through the System

```
USER ACTION
    ↓
    │ Click button in React app
    │ (e.g., "Take Quiz")
    ↓
FRONTEND LAYER
    ├─ Event Handler triggered
    ├─ State validated
    ├─ API request built (HTTP + JWT token)
    └─ Request sent to backend
    ↓
NETWORK LAYER
    │ HTTP POST request over the internet
    │ Secured with HTTPS (encryption)
    ↓
BACKEND API GATEWAY
    ├─ Extract JWT token from request header
    ├─ Verify token (not expired, signature valid)
    ├─ Extract user ID and role from token
    └─ Route request to appropriate handler
    ↓
AUTHORIZATION CHECK
    ├─ Verify user has permission (RBAC)
    ├─ Check: Is this teacher in this classroom?
    ├─ Check: Is this student enrolled in this classroom?
    └─ Reject if unauthorized (403 Forbidden)
    ↓
BUSINESS LOGIC SERVICE
    ├─ Example: Quiz Generation Service
    ├─ Step 1: Fetch resource from database
    ├─ Step 2: Extract YouTube transcript (or fetch cached)
    ├─ Step 3: Create database record for quiz attempt
    ├─ Step 4: Call AI service to generate questions
    │  └─ Step 4a: Try local LM Studio
    │  └─ Step 4b: If down, try Groq
    │  └─ Step 4c: If down, try Google Gemini
    ├─ Step 5: Format quiz response
    └─ Return data to API layer
    ↓
API RESPONSE FORMATTING
    ├─ Convert data to JSON
    ├─ Add HTTP headers (200 OK, Content-Type, etc.)
    ├─ Include any error messages
    └─ Send response to frontend
    ↓
NETWORK LAYER
    │ HTTP response travels over internet
    │ Data encrypted with HTTPS
    ↓
FRONTEND RECEIVES RESPONSE
    ├─ Parse JSON response
    ├─ Update component state
    ├─ Trigger re-render
    ├─ Display quiz to user
    └─ User sees new screen
    ↓
USER SEES RESULT
```

---

## 🎯 Core Algorithms & Business Logic

### Algorithm 1: Quiz Question Generation

**Purpose**: Create unique quiz questions from video transcript  
**Triggered**: When student clicks "Take Quiz"

```python
def generate_quiz(resource_id: str, attempt_number: int) -> QuizResponse:
    # Step 1: Fetch the resource
    resource = db.resources.find_one({"_id": resource_id})
    youtube_url = resource.youtube_url

    # Step 2: Get or extract transcript
    transcript = cache.get(f"transcript:{youtube_url}")
    if not transcript:
        transcript = youtube_api.get_transcript(youtube_url)
        cache.set(f"transcript:{youtube_url}", transcript, ttl=7_days)

    # Step 3: Create LLM prompt
    prompt = f"""
    Based on this video transcript:
    ---
    {transcript}
    ---

    Generate 5-8 quiz questions testing understanding of the material.
    Vary question types:
    - 3 Multiple choice questions (4 options each)
    - 2 Fill-in-the-blank questions
    - 1-2 Short answer questions

    Make sure questions:
    1. Test comprehension, not just memory
    2. Can't be answered by someone who didn't watch
    3. Have clear correct answers
    4. Are different from previous attempts

    Return as JSON.
    """

    # Step 4: Call AI to generate questions
    try:
        questions = llm.generate(prompt, model="local")
    except:
        try:
            questions = llm.generate(prompt, provider="groq")
        except:
            questions = llm.generate(prompt, provider="gemini")

    # Step 5: Create quiz attempt record in DB
    quiz_attempt = {
        "_id": ObjectId(),
        "resource_id": resource_id,
        "student_id": current_user.id,
        "classroom_id": current_user.active_classroom,
        "module_id": resource.module_id,
        "questions": questions,
        "status": "started",
        "attempt_number": attempt_number,
        "created_at": datetime.now()
    }
    db.quiz_attempts.insert_one(quiz_attempt)

    # Step 6: Return quiz to frontend
    return QuizResponse(
        quiz_attempt_id=str(quiz_attempt["_id"]),
        questions=questions,
        time_limit_minutes=None  # No time limit for practice quizzes
    )
```

**Why This Matters**:

- Each quiz is unique (new questions every time)
- Questions generated from actual video content
- Fallback chain ensures AI always works
- Transcript cached to save API calls

---

### Algorithm 2: Rule of 2 Progress Update

**Purpose**: Track quiz passes and unlock next resource  
**Triggered**: When student submits quiz answers

```python
def submit_quiz(quiz_attempt_id: str, answers: List[StudentAnswer]) -> SubmissionResponse:
    # Step 1: Fetch quiz attempt
    quiz = db.quiz_attempts.find_one({"_id": ObjectId(quiz_attempt_id)})

    # Step 2: Grade the quiz
    score = 0
    total_points = 0
    for question in quiz.questions:
        total_points += question.points
        if evaluate_answer(question, answers[question.id]):
            score += question.points

    score_percentage = score / total_points
    passed = score_percentage >= 0.80  # 80% threshold

    # Step 3: Save graded quiz
    db.quiz_attempts.update_one(
        {"_id": ObjectId(quiz_attempt_id)},
        {
            "$set": {
                "submitted_at": datetime.now(),
                "score_obtained": score,
                "total_points": total_points,
                "score_percentage": score_percentage,
                "passed": passed,
                "feedback": generate_ai_feedback(quiz, answers)
            }
        }
    )

    # Step 4: Update student progress (CRITICAL RULE OF 2)
    resource_id = quiz.resource_id
    student_id = quiz.student_id

    # Check if student already has progress record for this resource
    progress = db.student_progress.find_one({
        "student_id": student_id,
        "resource_id": resource_id
    })

    if progress is None:
        # First time taking quiz on this resource
        progress = {
            "_id": ObjectId(),
            "student_id": student_id,
            "classroom_id": quiz.classroom_id,
            "module_id": quiz.module_id,
            "resource_id": resource_id,
            "is_unlocked": True,
            "passed_tests_count": 0,
            "highest_score": 0,
            "single_turn_chat_history": []
        }
        db.student_progress.insert_one(progress)

    # Step 5: Update passed tests count if passed
    if passed:
        db.student_progress.update_one(
            {"_id": progress["_id"]},
            {
                "$inc": {"passed_tests_count": 1},
                "$set": {"highest_score": max(progress["highest_score"], score_percentage)}
            }
        )
        progress["passed_tests_count"] += 1

    # Step 6: If 2 tests passed, unlock next resource
    unlocked_next = False
    if progress["passed_tests_count"] >= 2:
        # Find next resource in sequence
        current_resource = db.resources.find_one({"_id": ObjectId(resource_id)})
        next_resource = db.resources.find_one({
            "module_id": quiz.module_id,
            "order_index": current_resource.order_index + 1
        })

        if next_resource:
            # Create progress record for next resource (unlocked by default)
            next_progress = {
                "_id": ObjectId(),
                "student_id": student_id,
                "classroom_id": quiz.classroom_id,
                "module_id": quiz.module_id,
                "resource_id": str(next_resource["_id"]),
                "is_unlocked": True,  # Automatically unlocked!
                "passed_tests_count": 0,
                "highest_score": 0,
                "single_turn_chat_history": []
            }
            db.student_progress.insert_one(next_progress)
            unlocked_next = True

    # Step 7: Log activity
    db.activity_feed.insert_one({
        "_id": ObjectId(),
        "classroom_id": quiz.classroom_id,
        "activity_type": "quiz_passed" if passed else "quiz_failed",
        "student_id": student_id,
        "resource_id": resource_id,
        "score": score_percentage,
        "passed_tests_count": progress["passed_tests_count"],
        "message": f"Student {student_id} passed Quiz for Resource {resource_id} ({score_percentage*100:.0f}%)" if passed else f"Student {student_id} failed Quiz ({score_percentage*100:.0f}%)",
        "created_at": datetime.now()
    })

    # Step 8: Return response
    return SubmissionResponse(
        score_percentage=score_percentage,
        passed=passed,
        passed_tests_count=progress["passed_tests_count"],
        feedback=feedback_text,
        unlocked_next_resource=unlocked_next,
        next_resource_name=next_resource.title if unlocked_next else None
    )
```

**Key Points**:

- Incrementally counts passes (doesn't reset)
- Unlocks next resource automatically at 2/2
- Logs all activity for analytics
- Returns progress info to frontend

---

### Algorithm 3: Assessment Autograde

**Purpose**: Grade objective questions immediately, flag subjective ones for teacher  
**Triggered**: When student submits final assessment

```python
def grade_assessment(submission_id: str, answers: List[StudentAnswer]) -> GradingResponse:
    # Step 1: Fetch submission and assessment
    submission = db.assessment_submissions.find_one({"_id": ObjectId(submission_id)})
    assessment = db.module_assessments.find_one({"_id": ObjectId(submission.assessment_id)})

    # Step 2: Separate questions by type
    auto_gradeable = []  # MCQ, fill-blank
    manual_gradeable = []  # Essay, short answer

    # Step 3: Auto-grade objective questions
    auto_graded_score = 0
    for question in assessment.questions:
        if question.type in ["mcq", "fill_blank"]:
            student_answer = answers[question.id]
            # Normalize answer (lowercase, trim, etc.)
            student_answer_normalized = normalize(student_answer)
            correct_answer_normalized = normalize(question.correct_answer)

            if student_answer_normalized == correct_answer_normalized:
                auto_graded_score += question.points
                db.assessment_submissions.update_one(
                    {"_id": ObjectId(submission_id)},
                    {"$set": {f"answers.{question.id}.is_correct": True,
                              f"answers.{question.id}.points_awarded": question.points}}
                )
            else:
                db.assessment_submissions.update_one(
                    {"_id": ObjectId(submission_id)},
                    {"$set": {f"answers.{question.id}.is_correct": False,
                              f"answers.{question.id}.points_awarded": 0}}
                )
        else:
            manual_gradeable.append(question.id)

    # Step 4: Update submission with auto-graded results
    if manual_gradeable:
        # Has subjective questions - needs manual grading
        grading_status = "pending_manual_grade"
        total_score = None  # Will be finalized after manual grading
    else:
        # All auto-graded - we're done
        grading_status = "fully_graded"
        total_score = auto_graded_score

    # Step 5: Save submission status
    db.assessment_submissions.update_one(
        {"_id": ObjectId(submission_id)},
        {
            "$set": {
                "submitted_at": datetime.now(),
                "auto_graded_at": datetime.now(),
                "auto_graded_score": auto_graded_score,
                "manual_graded_score": None,
                "grading_status": grading_status,
                "is_final_score": (grading_status == "fully_graded")
            }
        }
    )

    # Step 6: Notify teacher if manual grading needed
    if manual_gradeable:
        db.activity_feed.insert_one({
            "classroom_id": submission.classroom_id,
            "activity_type": "grading_pending",
            "submission_id": submission_id,
            "teacher_id": assessment.teacher_id,
            "message": f"Submission from {submission.student_id} pending manual grading",
            "created_at": datetime.now()
        })

    # Step 7: Return response
    return GradingResponse(
        auto_graded_score=auto_graded_score,
        grading_status=grading_status,
        fully_graded=(grading_status == "fully_graded"),
        requires_manual_grading=bool(manual_gradeable),
        message=f"Auto-graded complete. {len(manual_gradeable)} questions pending teacher review." if manual_gradeable else "All questions graded!"
    )
```

---

### Algorithm 4: RAG (Retrieval Augmented Generation) Q&A

**Purpose**: Answer questions using video content (not generic AI)  
**Triggered**: When student asks a question in chat

```python
def ask_question_rag(resource_id: str, question: str, student_id: str) -> QAResponse:
    # Step 1: Fetch resource and transcript
    resource = db.resources.find_one({"_id": ObjectId(resource_id)})
    youtube_url = resource.youtube_url

    # Get cached transcript
    transcript = cache.get(f"transcript:{youtube_url}")
    if not transcript:
        transcript = youtube_api.get_transcript(youtube_url)
        cache.set(f"transcript:{youtube_url}", transcript, ttl=7_days)

    # Step 2: Create RAG context prompt
    # (Uses Chroma vector DB to find most relevant transcript chunks)
    vector_db = Chroma(collection_name=f"resource_{resource_id}")

    # Find most relevant transcript chunks
    relevant_chunks = vector_db.search(query=question, top_k=3)

    context = "\n---\n".join([chunk.text for chunk in relevant_chunks])

    # Step 3: Create RAG prompt for LLM
    rag_prompt = f"""
    You are a helpful tutor. A student has asked a question about a video.

    VIDEO CONTENT (excerpt):
    {context}

    STUDENT QUESTION:
    {question}

    Based ONLY on the video content provided, answer the student's question.
    If the video doesn't cover this topic, say "This topic wasn't covered in the video."
    Keep your answer concise (2-3 sentences).
    """

    # Step 4: Call LLM for answer
    try:
        answer = llm.generate(rag_prompt, model="local")
    except:
        answer = llm.generate(rag_prompt, provider="gemini")

    # Step 5: Save Q&A to student progress
    progress = db.student_progress.find_one({
        "student_id": student_id,
        "resource_id": resource_id
    })

    db.student_progress.update_one(
        {"_id": progress["_id"]},
        {
            "$push": {
                "single_turn_chat_history": {
                    "question": question,
                    "answer": answer,
                    "asked_at": datetime.now()
                }
            }
        }
    )

    # Step 6: Log activity
    db.activity_feed.insert_one({
        "classroom_id": progress.classroom_id,
        "activity_type": "student_asked_question",
        "student_id": student_id,
        "resource_id": resource_id,
        "message": f"Student asked: '{question[:50]}...'",
        "created_at": datetime.now()
    })

    # Step 7: Return response with chat history
    return QAResponse(
        answer=answer,
        chat_history=progress["single_turn_chat_history"]
    )
```

**Why RAG?**

- Answers based on video content (not generic AI)
- More accurate and relevant
- Shows source material
- Private (doesn't leak user data to cloud if using local AI)

---

## 🗄️ Database Optimization

### Indexes for Performance

**Index 1: Student Progress Lookup**

```javascript
db.student_progress.createIndex({
  student_id: 1,
  classroom_id: 1,
  module_id: 1,
});
// Why: Frequently query "get all progress for this student in this module"
```

**Index 2: Quiz History**

```javascript
db.quiz_attempts.createIndex({
  resource_id: 1,
  student_id: 1,
  submitted_at: -1,
});
// Why: "Get all quiz attempts for this student on this resource, newest first"
```

**Index 3: Assessment Lookup**

```javascript
db.module_assessments.createIndex({
  module_id: 1,
  is_published: 1,
});
// Why: "Get all published assessments for this module"
```

**Index 4: Activity Feed**

```javascript
db.activity_feed.createIndex({
  classroom_id: 1,
  created_at: -1,
});
// Why: "Get recent activity in this classroom"
// Sorts by date (descending) - newest first
```

### Query Examples

**Query 1: Get student's progress on all resources in a module**

```javascript
db.student_progress
  .find({
    student_id: "stu_123",
    module_id: "mod_456",
  })
  .sort({ order_index: 1 });

// Uses index: (student_id, classroom_id, module_id)
// Speed: ~1ms even with millions of records
```

**Query 2: Get all quizzes a student took on a resource**

```javascript
db.quiz_attempts
  .find({
    resource_id: "res_789",
    student_id: "stu_123",
  })
  .sort({ submitted_at: -1 });

// Uses index: (resource_id, student_id, submitted_at)
// Sorts newest first
// Speed: ~1ms
```

**Query 3: Get pending grading for teacher**

```javascript
db.assessment_submissions
  .find({
    classroom_id: "cls_abc",
    grading_status: "pending_manual_grade",
  })
  .sort({ submitted_at: -1 });

// Finds all submissions waiting for teacher grading
// Speed: ~5ms (no index needed if few submissions)
```

### Caching Strategy

**Level 1: Browser Cache (Frontend)**

```javascript
// Cache student's progress for 5 minutes
localStorage.setItem("progress_cache_key", JSON.stringify(data));
localStorage.setItem("progress_cache_time", Date.now());

// Check if cache is fresh before making API call
if (isCacheFresh()) {
  return getCachedProgress();
} else {
  return fetchProgressFromAPI();
}
```

**Level 2: Server Cache (Backend - Redis style)**

```python
# Cache YouTube transcript for 7 days
cache_key = f"transcript:{youtube_url}"
transcript = cache.get(cache_key)
if not transcript:
    transcript = youtube_api.get_transcript(youtube_url)
    cache.set(cache_key, transcript, ttl=7*24*60*60)
```

**Level 3: Database (MongoDB)**

```javascript
// Cache summary in resource document
db.resources.update(
  { _id: "res_123" },
  { $set: { cached_summary: "...", cached_summary_generated_at: Date.now() } },
);

// Next time, return cached summary immediately (< 1ms)
```

---

## 🔐 Security Architecture

### Authentication & Authorization Flow

```
CLIENT SIDE
├─ User enters email/password
├─ Request sent to /api/auth/login
└─ Password never stored in browser

SERVER SIDE
├─ Hash password with bcrypt
├─ Compare to stored hash
├─ If match:
│  ├─ Create JWT token containing:
│  │  ├─ User ID
│  │  ├─ Email
│  │  ├─ Role (teacher/student)
│  │  ├─ Active classroom ID
│  │  ├─ Issued time (iat)
│  │  └─ Expiration time (exp = now + 24h)
│  ├─ Sign token with SECRET_KEY
│  └─ Send token to client
└─ If no match: Return 401 Unauthorized

CLIENT STORES TOKEN
├─ In secure HTTP-only cookie (BEST)
├─ Or in browser memory (if no cookie support)
└─ Token automatically sent with every request

EVERY API REQUEST
├─ Extract token from header/cookie
├─ Verify signature (proves it wasn't tampered with)
├─ Check expiration time (hasn't expired)
├─ Extract user info from token
└─ Use that info to authorize request

TOKEN VALIDATION (per request)
├─ Decode JWT
├─ Verify signature matches SECRET_KEY
├─ Check exp < now (hasn't expired)
├─ Extract claims (user_id, role, classroom_id)
└─ If all valid: proceed; else: 401 Unauthorized
```

### Role-Based Access Control (RBAC)

**Permission Matrix**:

```
                    Teacher     Student     Admin
Create Module         ✓           ✗          ✓
Edit Module           ✓           ✗          ✓
Grade Assignment      ✓           ✗          ✓
View Analytics        ✓           ✗          ✓
View Own Progress     ✓           ✓          ✓
View Others' Progress ✓           ✗          ✓
Create Announcement   ✓           ✗          ✓
Take Quiz             ✗           ✓          ✓
View Grades           ✓           ✓ (own)    ✓
```

**RBAC Check in Backend**:

```python
@router.get("/api/classroom/{classroom_id}/analytics")
async def get_analytics(
    classroom_id: str,
    current_user: User = Depends(get_current_user)
):
    # Check: Is this user a teacher in this classroom?
    is_teacher = await rbac_service.is_teacher(
        user_id=current_user.id,
        classroom_id=classroom_id
    )

    if not is_teacher:
        raise HTTPException(
            status_code=403,
            detail="You must be a teacher to view analytics"
        )

    # Proceed with analytics fetch
    return await analytics_service.get_classroom_analytics(classroom_id)
```

### Data Privacy

**Student Data Privacy**:

```
├─ Student A can see:
│  ├─ Their own scores
│  ├─ Their own progress
│  └─ Their own feedback
├─ Student A CANNOT see:
│  ├─ Student B's scores
│  ├─ Student B's progress
│  └─ Student B's answers
└─ Even if student A knows student B's ID

├─ Teacher can see:
│  ├─ All student scores in their classroom
│  ├─ All student progress
│  └─ All student feedback
└─ Teacher CANNOT see other teachers' classrooms
```

**Password Security**:

```
1. Password received from user
2. Hash with bcrypt (slow, security-focused hashing)
3. Store hash in database (NOT the password)
4. When user logs in:
   a. Get hash from database
   b. Compare user's input to hash
   c. Never store or log password anywhere
5. Passwords never appear in logs, API responses, or database backups
```

**Encryption In Transit**:

```
├─ All API calls use HTTPS (not HTTP)
├─ Data encrypted using TLS/SSL
├─ Certificate prevents man-in-the-middle attacks
├─ Even if network is intercepted, data is unreadable
└─ Browser shows 🔒 lock icon
```

---

## ⚡ Performance Optimization

### Async/Concurrency

**Why Async Matters**:

```
Synchronous (Old Way):
Request 1: Wait for DB (500ms) ❌ BLOCKED
Request 2: Waiting... ❌ BLOCKED
Request 3: Waiting... ❌ BLOCKED
Total time: 1.5 seconds for 3 requests

Asynchronous (New Way):
Request 1: Start DB query (don't wait)
Request 2: Start DB query (don't wait)
Request 3: Start DB query (don't wait)
(All 3 running in parallel)
Total time: 500ms for 3 requests ✅
```

**FastAPI Async Example**:

```python
@router.post("/api/youtube-quiz/generate")
async def generate_quiz(request: QuizGenerateRequest):
    # These all run in parallel, not sequentially
    resource = await db.resources.find_one_async(...)
    transcript = await youtube_api.get_transcript_async(...)
    questions = await llm.generate_async(...)
    quiz_record = await db.quiz_attempts.insert_async(...)

    # All 4 operations happen at the same time
    # Instead of waiting for each one to finish
```

### Query Optimization

**Bad Query** (Slow):

```python
# Gets ALL students in all classrooms, then filters in Python
all_students = db.students.find({})
my_students = [s for s in all_students if s.classroom_id == "cls_123"]
# Slow! Loads millions of records then filters
```

**Good Query** (Fast):

```python
# Filter in database - only get what we need
my_students = db.students.find({"classroom_id": "cls_123"})
# Fast! Database does filtering, returns only 30 records
```

### Caching Layers

```
User Request
    ↓
┌─ Browser Cache (IndexedDB) ─────────────────── 1ms
│  └─ If cached and fresh, return immediately
│
└─ Server Cache (Redis/Memory) ─────────────── 5-10ms
   └─ If cached and fresh, return immediately

└─ Database Query ────────────────────────── 50-100ms
   └─ Get data, cache it for next request
```

**Transcript Caching Strategy**:

```
First request for video transcript:
├─ Check cache: Miss ❌
├─ Fetch from YouTube API: 2 seconds
├─ Save to cache: 0.1 seconds
├─ Return to user: 2.1 seconds total

Second request for same video (within 7 days):
├─ Check cache: Hit ✓
├─ Return immediately: 0.01 seconds
└─ 210x faster! ✅
```

---

## 🔄 Deployment & DevOps

### Docker Containerization

**Why Docker?**

- Same environment everywhere (dev, staging, production)
- Easy scaling (run multiple containers)
- Fast deployment (no setup required)
- Isolation (one container failure doesn't affect others)

**Container Architecture**:

```
┌─────────────────────────────────┐
│         Docker Container 1       │
│ ┌───────────────────────────────┐│
│ │ Frontend (React app)          ││
│ │ Running on port 3000          ││
│ └───────────────────────────────┘│
│ ┌───────────────────────────────┐│
│ │ Nginx (reverse proxy)         ││
│ │ Routes requests to backend    ││
│ │ Serves static files           ││
│ └───────────────────────────────┘│
└─────────────────────────────────┘

┌─────────────────────────────────┐
│         Docker Container 2       │
│ ┌───────────────────────────────┐│
│ │ Backend (FastAPI app)         ││
│ │ Running on port 8000          ││
│ │ Handles all API requests      ││
│ └───────────────────────────────┘│
└─────────────────────────────────┘

┌─────────────────────────────────┐
│         Docker Container 3       │
│ ┌───────────────────────────────┐│
│ │ Database (MongoDB)            ││
│ │ Running on port 27017         ││
│ │ Persistent volume mounted     ││
│ └───────────────────────────────┘│
└─────────────────────────────────┘

All connected via Docker Network
```

### Environment Configuration

**Development (.env.dev)**:

```env
DEBUG=true
DATABASE_URL=mongodb://localhost:27017/quasar_dev
LM_STUDIO_URL=http://localhost:1234
CORS_ORIGINS=http://localhost:3000
JWT_EXPIRATION_HOURS=24
```

**Production (.env.prod)**:

```env
DEBUG=false
DATABASE_URL=mongodb://prod-db.internal:27017/quasar
LM_STUDIO_URL=http://lm-studio:1234  (internal container network)
CORS_ORIGINS=https://quasar.example.com
JWT_EXPIRATION_HOURS=24
ENABLE_CLOUD_LLM_FALLBACK=true
GOOGLE_API_KEY=<secret>
GROQ_API_KEY=<secret>
```

---

## 🧪 Testing Strategy

### Unit Tests (Test Single Functions)

**Example: Quiz Generation**

```python
def test_generate_quiz_creates_database_record():
    # Arrange
    resource_id = "test_resource_123"

    # Act
    response = generate_quiz(resource_id)

    # Assert
    assert response.quiz_attempt_id is not None

    # Verify saved to database
    saved_quiz = db.quiz_attempts.find_one({
        "_id": ObjectId(response.quiz_attempt_id)
    })
    assert saved_quiz is not None
    assert len(saved_quiz.questions) >= 5
```

### Integration Tests (Test Multiple Components Together)

**Example: Full Quiz Flow**

```python
def test_quiz_flow_end_to_end():
    # Student takes quiz and passes

    # Step 1: Generate quiz
    quiz_response = generate_quiz("res_123")

    # Step 2: Student answers (simulated)
    answers = [
        {"question_id": "q1", "answer": "correct_answer"},
        # ...more answers
    ]

    # Step 3: Submit quiz
    submission_response = submit_quiz(
        quiz_response.quiz_attempt_id,
        answers
    )

    # Verify
    assert submission_response.passed == True
    assert submission_response.progress_update.passed_tests_count == 1

    # Step 4: Take quiz again and pass
    quiz_response2 = generate_quiz("res_123")
    submission_response2 = submit_quiz(
        quiz_response2.quiz_attempt_id,
        answers  # Same answers, different questions
    )

    # Verify: Now should have 2 passes and unlock next resource
    assert submission_response2.progress_update.passed_tests_count == 2
    assert submission_response2.unlocked_next_resource == True
```

### Load Testing (Test Under Heavy Traffic)

**Simulates 100 concurrent students**:

```python
def test_system_with_100_concurrent_users():
    import concurrent.futures

    def simulate_student():
        # Each "student" generates a quiz and submits answers
        generate_quiz("res_123")
        submit_quiz(...)
        ask_question(...)

    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        futures = [executor.submit(simulate_student) for _ in range(100)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    # Verify all succeeded
    assert len(results) == 100
    assert all(r.success == True for r in results)

    # Check database integrity
    assert db.quiz_attempts.count_documents({}) == 100
```

---

## 🚨 Error Handling & Monitoring

### Error Handling Strategy

**Try/Except with Fallbacks**:

```python
async def generate_quiz(resource_id):
    try:
        # Try local AI first (fast, private)
        return await llm.generate_with_provider("local")
    except ConnectionError:
        logging.warning("Local LM Studio unavailable, trying Groq...")
        try:
            return await llm.generate_with_provider("groq")
        except ConnectionError:
            logging.warning("Groq unavailable, trying Gemini...")
            try:
                return await llm.generate_with_provider("gemini")
            except ConnectionError:
                # All AI providers failed
                logging.error("All AI providers unavailable!")
                raise HTTPException(
                    status_code=503,
                    detail="AI services temporarily unavailable. Try again in a few minutes."
                )
```

### Monitoring & Logging

**What Gets Logged**:

```
[2026-04-20 14:30:45] INFO: User stu_123 started quiz qa_abc123
[2026-04-20 14:31:20] INFO: Quiz generation took 2.3 seconds
[2026-04-20 14:35:10] INFO: Student submitted quiz with 92% score
[2026-04-20 14:35:11] INFO: Next resource unlocked for student
[2026-04-20 14:35:12] INFO: Activity logged to feed

[2026-04-20 14:36:00] ERROR: Database connection timeout
[2026-04-20 14:36:00] INFO: Retrying database operation...
[2026-04-20 14:36:02] INFO: Database reconnected, resuming

[2026-04-20 14:37:00] WARNING: LM Studio API timeout (5s)
[2026-04-20 14:37:00] INFO: Falling back to Groq API
[2026-04-20 14:37:02] INFO: Successfully generated quiz via Groq
```

**Metrics Tracked**:

- Response times (API latency)
- Error rates (% of failed requests)
- Database query times
- AI API response times
- User engagement (logins, quizzes taken, etc.)

---

## 📈 Scalability Considerations

### Current Capacity

**Single Server**:

- ~100 concurrent students
- ~50,000 total students
- ~10,000 modules
- ~500 classrooms

### Scaling Strategies

**Strategy 1: Horizontal Scaling (Add More Servers)**

```
Server 1: Handle students 1-50
Server 2: Handle students 51-100
Server 3: Handle students 101-150
(Load balancer routes requests)
```

**Strategy 2: Database Sharding**

```
Shard 1: Classrooms A-M
Shard 2: Classrooms N-Z
(Each shard is a separate MongoDB instance)
```

**Strategy 3: Caching Layer**

```
Add Redis cache between frontend and database
├─ Frequently accessed data cached
├─ 1000x faster reads
└─ Less load on database
```

---

## 🔮 Future Enhancements

### Planned Features

1. **WebSocket Real-Time Updates**
   - Live activity feed for teachers
   - Real-time notifications

2. **Advanced Analytics**
   - Learning analytics dashboard
   - Predictive failure detection
   - Personalized recommendations

3. **Gamification**
   - XP system
   - Badges and achievements
   - Leaderboards

4. **Video Upload**
   - Instead of just YouTube, teachers can upload videos

5. **Mobile Apps**
   - Native iOS/Android apps
   - Offline learning support

---

## 📚 Additional Resources

- [Backend README](../../Backend/README.md) - Backend setup and development
- [Frontend README](../../frontend/README.md) - Frontend setup and development
- [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) - Detailed technical specs
- [API_REFERENCE.md](../API_REFERENCE.md) - Complete API documentation

---

**Document Created**: April 20, 2026  
**Version**: 1.0  
**Maintained By**: Development Team
