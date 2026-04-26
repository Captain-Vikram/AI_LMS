# 📚 Quasar EduSaarthi - Complete System Overview

**Last Updated**: April 24, 2026  
**Project Status**: Phase 3 Substantially Complete, Phase 4 In Development  
**Target Audience**: Teachers, Students, Developers, Non-Technical Stakeholders

---

## 🎯 What is Quasar EduSaarthi?

Quasar EduSaarthi is a **modern Learning Management System (LMS)** designed to help teachers create interactive, structured learning experiences and help students learn effectively through a **sequential module-based approach**.

### In Simple Terms:

Think of it as a **digital classroom platform** where:

- **Teachers** organize learning content into structured modules with videos, quizzes, and assessments
- **Students** learn step-by-step through these modules, must pass knowledge checks, and take final assessments
- **Both** can track progress, get feedback, and see what's working

---

## 💡 Why This Project Matters

### The Problem It Solves:

Traditional online learning is chaotic:

- Students skip around randomly between resources
- There's no guaranteed progression or mastery checking
- Teachers can't easily track who learned what
- Content gets disconnected from assessment
- Feedback is delayed or non-existent

### Our Solution:

**Structured, Sequential Learning** with:
✅ **Progressive Unlocking** - Resources unlock only when students show mastery  
✅ **AI-Powered Support** - Real-time Q&A about the content  
✅ **Built-in Assessment** - Knowledge checks + final module exams  
✅ **Clear Progress Tracking** - Teachers and students always know where everyone stands  
✅ **Personalized Learning** - Content summaries, AI explanations, and guided practice

---

## 🛠️ Technology Stack

### Frontend (What Users See)

| Technology           | Purpose                                 |
| -------------------- | --------------------------------------- |
| **React**            | Interactive user interface framework    |
| **Vite**             | Fast development and build tool         |
| **TailwindCSS**      | Beautiful styling and responsive design |
| **Quasar Framework** | Reusable UI components and layouts      |
| **JavaScript/ES6**   | Interactive features and logic          |
| **Axios**            | Safe communication with backend         |

**Browser Target**: Modern browsers (Chrome, Firefox, Safari, Edge)

### Backend (What Powers Everything)

| Technology      | Purpose                            |
| --------------- | ---------------------------------- |
| **FastAPI**     | Modern, fast Python web framework  |
| **Python 3.9+** | Backend programming language       |
| **Async/Await** | Handle many users at the same time |
| **Motor**       | Non-blocking MongoDB driver        |
| **PyJWT**       | Secure user authentication         |
| **LangChain**   | AI language model integration      |

**Performance**: Handles concurrent requests efficiently - multiple users can use the system simultaneously without slowdowns

### Database (Where Data Lives)

| Technology      | Purpose                                  |
| --------------- | ---------------------------------------- |
| **MongoDB**     | NoSQL database for flexible data storage |
| **IndexedDB**   | Browser-side caching for speed           |
| **Collections** | Organized data storage tables            |

**Why MongoDB?** Flexible schema allows the system to evolve without complex migrations.

### AI & Content Processing

| Technology                 | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| **LM Studio**              | Local AI model (runs on your machine, private) |
| **Google Gemini API**      | Cloud AI fallback (faster, more powerful)      |
| **Groq API**               | Alternative cloud AI provider                  |
| **YouTube Transcript API** | Extract video content                          |
| **Chroma**                 | Vector database for semantic search            |
| **Portable RAG**           | Retrieve Augmented Generation (smart search)   |

**RAG** = "Retrieve Augmented Generation" - finds relevant video content to answer questions

### Deployment

| Technology                | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| **Docker**                | Container packaging for consistent deployment |
| **Docker Compose**        | Orchestrate multiple services                 |
| **Nginx**                 | Web server and reverse proxy                  |
| **Environment Variables** | Configuration management                      |

---

## 🏗️ System Architecture

### How Everything Connects

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (Frontend)                 │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │   Teacher View   │  │   Student View   │                │
│  │ - Manage Modules │  │ - Learn Content  │                │
│  │ - Grade Students │  │ - Take Quizzes   │                │
│  │ - View Analytics │  │ - See Progress   │                │
│  └──────────────────┘  └──────────────────┘                │
└──────────────────┬───────────────────┬──────────────────────┘
                   │ HTTP Requests     │
                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY & AUTHENTICATION                    │
│              (JWT Tokens - Secure Entry Point)              │
└──────────────────┬───────────────────┬──────────────────────┘
                   │ Route Requests    │
                   ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│   BACKEND SERVICES       │  │   AI SERVICES               │
│ ┌────────────────────┐   │  │ ┌──────────────────────┐    │
│ │ Learning Modules   │   │  │ │ AI Q&A Engine       │    │
│ │ Quiz Management    │   │  │ │ Content Summarizer  │    │
│ │ Progress Tracking  │   │  │ │ Question Generator  │    │
│ │ Grading System     │   │  │ │ Smart Search (RAG)  │    │
│ │ Enrollment         │   │  │ └──────────────────────┘    │
│ │ Announcements      │   │  │ (Uses Local/Cloud LLM)      │
│ └────────────────────┘   │  └──────────────────────────────┘
└──────────┬───────────────┴─────────────────┬────────────────┘
           │ Store & Retrieve Data          │
           ▼                                ▼
      ┌──────────────────┐            ┌──────────────────┐
      │    MongoDB       │            │  Vector DB       │
      │   (Main Data)    │            │  (Smart Search)  │
      │ - Users          │            │ - Video Content  │
      │ - Modules        │            │ - Embeddings     │
      │ - Progress       │            │ - Semantic Index │
      │ - Grades         │            └──────────────────┘
      └──────────────────┘
```

### Data Flow Example: Student Taking a Quiz

```
1. Student clicks "Take Quiz"
   ↓
2. Frontend asks Backend: "Generate a quiz for Resource X"
   ↓
3. Backend:
   - Fetches video transcript
   - Calls AI: "Generate 5 questions from this video"
   - Stores quiz attempt in database
   - Returns quiz to student
   ↓
4. Student answers questions
   ↓
5. Frontend sends answers to Backend
   ↓
6. Backend:
   - Grades the quiz
   - Calls AI: "Provide feedback on student's answers"
   - Updates student progress (locked/unlocked status)
   - Saves score to database
   ↓
7. Student sees results with AI feedback
```

---

## ⭐ Key Features

### For Teachers

#### 1. **Module Management**

- Create learning modules with a sequence of video resources
- Arrange resources in the order students must complete them
- Specify how many quizzes students must pass before moving forward
- Publish assessments when students are ready

**Example**: A Cloud Computing module has:

- Resource 1: "What is Cloud Computing?" (requires 2/2 quiz passes)
- Resource 2: "IaaS vs PaaS vs SaaS" (requires 2/2 quiz passes)
- Resource 3: "Cloud Security" (requires 2/2 quiz passes)
- **Then**: Final Module Assessment (traditional exam)

#### 2. **Classroom Roster Management**

- Easily add students (one-by-one or bulk CSV upload)
- Create student groups for differentiation
- Remove students or manage enrollment status
- Track who is in the classroom

#### 3. **Announcements & Communication**

- Post classroom-wide announcements
- Track who has read announcements
- Update or delete announcements
- Real-time communication with students

#### 4. **Grading & Assessment Management**

- AI auto-generates draft assessments from video transcripts
- Edit and customize assessments before publishing
- Set time limits and passing scores
- Grade student submissions (auto + manual)
- Provide feedback to students

#### 5. **Analytics & Insights**

- See overall class progress at a glance
- Track individual student progress
- Identify students who are struggling
- View completion rates and scores
- Real-time activity feed showing student actions

---

### For Students

#### 1. **Structured Learning Path**

- See exactly what you need to learn in each module
- Resources are locked until you've mastered the previous ones
- Clear progress indicators showing your status
- Know exactly what's expected of you

#### 2. **Interactive Video Learning**

- Watch YouTube videos inside the platform
- Get AI-powered summaries of video content
- Ask questions about the video content and get instant answers
- No need to search for information - it's all in context

#### 3. **Knowledge Checks (Quizzes)**

- Take automatic quizzes generated from video content
- Questions include multiple choice, fill-in-the-blank, and short answer
- Get immediate feedback with explanations
- See your score and what you got wrong
- Must pass 2 consecutive quizzes to unlock the next resource

#### 4. **Chat History**

- All your questions and answers are saved
- Review what you asked and learned
- Build your own learning record

#### 5. **Module Assessment**

- Take a comprehensive final exam when ready
- Covers all content from the module
- Teacher may grade essay questions
- See your final score and pass/fail status

#### 6. **Progress Tracking**

- Always know where you stand in the module
- See which resources are locked/unlocked
- Track your scores and improvements
- View your dashboard with all classrooms

---

## 🆕 What's New & Different

### Traditional LMS

- 🔴 Resources are presented randomly, no forced progression
- 🔴 Quizzes are optional or disconnected from content
- 🔴 No evidence students actually understand the material
- 🔴 Teachers manually grade everything
- 🔴 Limited feedback to students

### Quasar EduSaarthi

- ✅ **Strict Sequential Progression** - Resources unlock only after mastery (2 passing quizzes)
- ✅ **AI-Powered Assessment** - Quizzes auto-generated from actual video content
- ✅ **Proven Mastery** - "Rule of 2" ensures students pass the same test twice
- ✅ **AI Auto-Grading** - Multiple choice and fill-in-the-blank graded instantly
- ✅ **Personalized Support** - Students can ask questions about content and get AI-powered answers
- ✅ **Semantic Search (RAG)** - Finds exact parts of videos relevant to questions
- ✅ **Content Summaries** - AI creates summaries of long videos on first request (cached for speed)
- ✅ **Activity Feed** - Teachers see real-time student engagement
- ✅ **Flexible AI Backend** - Works with local models (privacy) or cloud AI (performance)

### Innovation Highlights

| Feature                    | Why It Matters                                                                  |
| -------------------------- | ------------------------------------------------------------------------------- |
| **Rule of 2**              | Students must pass the same quiz twice - proves they understand, not just lucky |
| **Auto-Generated Quizzes** | Different questions each attempt - prevents memorization, tests real learning   |
| **Async Architecture**     | 100+ students can learn simultaneously without slowdowns                        |
| **RAG-Enhanced Q&A**       | Questions answered from actual video content, not generic AI responses          |
| **Cached Summaries**       | Expensive AI operations done once, results reused - saves costs and time        |
| **Portable RAG**           | Can work offline with local AI models - complete privacy                        |
| **RBAC Security**          | Teachers can't see other classrooms; students see only their own                |

---

## 📄 Pages & Screens (Frontend)

### For Teachers

#### 1. **Classroom Dashboard**

**Purpose**: See everything at a glance  
**Shows**:

- Classroom name and description
- Total students enrolled
- Recent student activity feed
- Pending grading alerts
- Quick links to key sections
- Announcements and messages

#### 2. **Module Management Page**

**Purpose**: Create and organize learning modules  
**Shows**:

- List of all modules in the classroom
- Add new module button
- Reorder modules (drag-and-drop)
- Edit/delete module options
- Approved resources list to add to modules

**Actions**:

- Create new module with name, description, topic
- Add YouTube resources to the module
- Set the order resources must be completed
- View how many students have completed each module

#### 3. **Module Assessment Editor**

**Purpose**: Create and manage final module exams  
**Shows**:

- AI-generated draft questions
- Question editor (multiple choice, fill-in, essay, etc.)
- Question order and weight (point values)
- Time limit and passing score settings
- Publish button when ready
- Edit button if published

**Actions**:

- Generate draft assessment (AI creates questions from all videos in module)
- Add/remove/reorder questions
- Set correct answers and point values
- Preview how students will see it
- Publish when ready (students can then see "Coming Soon")

#### 4. **Roster & Groups Page**

**Purpose**: Manage who's in the classroom  
**Shows**:

- List of all enrolled students
- Add student button
- Bulk upload button (CSV file)
- Remove student option
- Create student groups (for differentiation)
- View which students are in each group

**Actions**:

- Add one student manually
- Upload CSV with multiple students
- Create groups (e.g., "Advanced", "Support")
- Add/remove students from groups
- Remove student from classroom

#### 5. **Grading Dashboard**

**Purpose**: Grade student submissions  
**Shows**:

- Pending submissions needing manual grading
- Student name, module name, submission time
- Auto-graded score (if applicable)
- Essay/short answer questions to grade
- Overall feedback text box

**Actions**:

- Open student's submission
- Grade essay questions (assign points)
- Write overall feedback
- Submit grades (student gets notification)

#### 6. **Analytics Page**

**Purpose**: Track class and individual progress  
**Shows**:

- Overall class statistics (completion %, average scores)
- Chart showing progress over time
- Individual student card showing:
  - Name, enrolled date, current status
  - Module progress (which are complete)
  - Overall grade
  - Last activity time

**Actions**:

- Click student to see detailed progress
- Filter by module or status
- Export analytics (future feature)

#### 7. **Announcements Panel**

**Purpose**: Communicate with the whole classroom  
**Shows**:

- Announcement list (newest first)
- Create new announcement button
- Delete/edit options for existing announcements
- View count (how many students have read it)

**Actions**:

- Write and post announcement
- Edit existing announcement
- Delete announcement
- See who has read each announcement

---

### For Students

#### 1. **Student Dashboard**

**Purpose**: See all your classrooms and overall progress  
**Shows**:

- List of classrooms you're enrolled in
- Quick stats for each classroom (modules complete, current grade)
- Recent announcements from all classrooms
- Your total XP/gamification score (if enabled)
- Quick access links

#### 2. **Classroom View**

**Purpose**: See a specific classroom's modules  
**Shows**:

- Classroom name and description
- List of all modules in the classroom
- Your progress on each module (% complete)
- Module status (not started, in progress, complete)
- Start learning button for each module

#### 3. **Interactive Lesson Viewer** ⭐

**Purpose**: Learn from a video resource with AI support  
**Layout**:

```
┌─────────────────────────────────────────────────┐
│ Module Name > Resource Title                    │
├──────────────────────────┬──────────────────────┤
│                          │  Q&A Chat Panel     │
│  YouTube Video Player    │  - Ask questions    │
│  (Left side, 60%)        │  - See answers      │
│                          │  - View history     │
│                          │  - Summary button   │
├──────────────────────────┴──────────────────────┤
│ ✅ Passed Tests: 1/2                            │
│ [Take Next Test]  OR  [Next Resource Unlocked!]│
└─────────────────────────────────────────────────┘
```

**Features**:

- YouTube video player with full controls
- Real-time Q&A chat about the video
- AI generates content summary (first request cached)
- Chat history shows all your past questions
- Progress indicator (1/2 or 2/2 tests passed)
- "Take Test" button when you feel ready
- Auto-unlock message when you pass 2 tests

**AI Q&A Panel**:

- Type any question about the video
- Get instant answer from AI that read the video transcript
- See your full conversation history with the AI
- Reload summary if needed

#### 4. **Quiz Modal**

**Purpose**: Take knowledge check quizzes  
**Shows**:

- Questions one at a time or all together
- Question type: multiple choice, fill-in-the-blank, short answer
- Your current answers
- Submit button when done
- Time remaining (if there's a time limit)

**After Submission**:

- Score: "You got 4/5 correct (80%)"
- Status: "✅ PASSED! (≥80%)" or "❌ Failed. Try again!"
- Feedback: AI explains what you got wrong
- Progress: "You have passed 1/2 quizzes. Pass one more to unlock the next resource!"

#### 5. **Quiz Feedback Page**

**Purpose**: Review your quiz performance  
**Shows**:

- Your overall score (large, colored)
- Pass/fail status with emoji
- AI feedback about your performance
- Question-by-question breakdown:
  - Your answer
  - Correct answer
  - Whether you got it right
  - Topic (which part of video it relates to)

#### 6. **Module Assessment Taker**

**Purpose**: Take the final module exam  
**Shows**:

- Module name
- Countdown timer (red if < 5 minutes left)
- All questions (randomized)
- Question number indicator ("Question 5 of 20")
- Your answers (auto-saved every 30 seconds)
- Submit button with confirmation

**After Submission**:

- Message: "Your submission has been received!"
- Status: "Waiting for automatic grading..."
- Auto-graded questions show immediately with score
- Essay questions show: "Pending teacher grading"
- Notification when teacher finishes grading

#### 7. **My Progress Page**

**Purpose**: Track your learning journey  
**Shows**:

- Timeline of your module progress
- For each module:
  - Start date, completion date
  - Which resources completed
  - Number of quizzes passed for each
  - Final assessment score (if taken)
  - Overall grade for the module
  - Badges or achievement icons

---

## 🔌 Backend APIs (The Communication Language)

### What Are APIs?

APIs are like telephone lines between the frontend (what you see) and backend (what powers it). When you click a button, your browser sends a request through an API.

### Main API Categories

#### Authentication APIs

**Purpose**: Keep the system secure - verify who you are

| Endpoint                                   | Purpose                 |
| ------------------------------------------ | ----------------------- |
| `POST /api/auth/register`                  | Create a new account    |
| `POST /api/auth/login`                     | Sign in to your account |
| `GET /api/auth/user-profile`               | Get your profile info   |
| `POST /api/auth/set-active-classroom/{id}` | Switch to a classroom   |

**How It Works**:

1. You log in with email/password
2. Server creates a secure token (JWT)
3. You use this token for every request (proof you're logged in)
4. Token expires after 24 hours (you must login again)

---

#### Classroom APIs

**Purpose**: Manage classroom membership and information

| Endpoint                          | Purpose                         |
| --------------------------------- | ------------------------------- |
| `POST /api/classroom/create`      | Teacher creates a new classroom |
| `GET /api/classroom/{id}`         | Get classroom details           |
| `POST /api/classroom/{id}/join`   | Student joins with code         |
| `GET /api/classroom/{id}/members` | See roster (teacher only)       |
| `POST /api/classroom/{id}/enroll` | Add/manage students             |
| `POST /api/classroom/{id}/groups` | Create student groups           |

---

#### Learning Module APIs

**Purpose**: Structure and manage learning content

| Endpoint                                                  | Purpose                       |
| --------------------------------------------------------- | ----------------------------- |
| `POST /api/classroom/{id}/modules/generate`               | Create new module             |
| `GET /api/classroom/{id}/modules`                         | List all modules in classroom |
| `POST /api/classroom/{id}/modules/{mid}/resources/assign` | Add videos to module          |
| `GET /api/classroom/{id}/modules/{mid}`                   | Get module details            |
| `PATCH /api/classroom/{id}/modules/reorder`               | Rearrange module order        |

**Data Sent/Received**:

```
Sending to create module:
{
  "title": "Cloud Computing Basics",
  "description": "Learn the fundamentals",
  "topic": "cloud"
}

Receiving:
{
  "module_id": "mod_abc123",
  "created_at": "2026-04-20T10:30:00Z",
  "status": "active"
}
```

---

#### Student Progress APIs

**Purpose**: Track what students have learned

| Endpoint                                         | Purpose                            |
| ------------------------------------------------ | ---------------------------------- |
| `GET /api/student/progress/{module_id}`          | Get your progress in a module      |
| `GET /api/student/progress/resources/unlocked`   | See which resources you can access |
| `GET /api/classroom/{id}/modules/{mid}/progress` | Teacher sees class progress        |

**Example Response** (Student's Module Progress):

```json
{
  "module_id": "mod_cloud",
  "module_name": "Cloud Computing Basics",
  "completion_percentage": 75,
  "resources": [
    {
      "resource_id": "res_1",
      "title": "What is Cloud Computing?",
      "status": "unlocked",
      "passed_tests": 2,
      "highest_score": 92,
      "locked_reason": null
    },
    {
      "resource_id": "res_2",
      "title": "IaaS vs PaaS vs SaaS",
      "status": "locked",
      "passed_tests": 0,
      "highest_score": 0,
      "locked_reason": "Must pass 2/2 tests on previous resource first"
    }
  ],
  "final_assessment": {
    "status": "published",
    "available_at": "2026-04-22T00:00:00Z",
    "score": null,
    "grading_status": null
  }
}
```

---

#### Quiz APIs

**Purpose**: Generate and grade knowledge checks

| Endpoint                           | Purpose                         |
| ---------------------------------- | ------------------------------- |
| `POST /api/youtube-quiz/generate`  | Create a new quiz for a video   |
| `POST /api/youtube-quiz/submit`    | Submit quiz answers for grading |
| `GET /api/quiz/assessment-history` | See your past quiz attempts     |

**Generate Quiz Request**:

```json
{
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "classroom_id": "cls_123",
  "module_id": "mod_456",
  "resource_id": "res_789"
}
```

**Generate Quiz Response** (What Student Sees):

```json
{
  "quiz_attempt_id": "qa_abc123",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "What does IaaS stand for?",
      "options": [
        "Infrastructure as a Service",
        "Internet as a Service",
        "Integration as a Service",
        "Interface as a Service"
      ]
    },
    {
      "id": "q2",
      "type": "fill_blank",
      "question": "Cloud computing models include SaaS, PaaS, and ___",
      "blank_position": 3
    }
  ]
}
```

**Submit Quiz Request** (Student's Answers):

```json
{
  "quiz_attempt_id": "qa_abc123",
  "answers": [
    { "question_id": "q1", "student_answer": "Infrastructure as a Service" },
    { "question_id": "q2", "student_answer": "IaaS" }
  ]
}
```

**Submit Quiz Response** (Grading & Feedback):

```json
{
  "score_obtained": 2,
  "total_questions": 2,
  "score_percentage": 100,
  "passed": true,
  "feedback": "Excellent work! You demonstrated a strong understanding of cloud computing models.",
  "question_feedback": [
    {
      "question_id": "q1",
      "is_correct": true,
      "feedback": "✓ Correct! IaaS provides computing infrastructure over the internet."
    },
    {
      "question_id": "q2",
      "is_correct": true,
      "feedback": "✓ Correct! The three main cloud models are SaaS, PaaS, and IaaS."
    }
  ],
  "progress_update": {
    "passed_tests_count": 2,
    "status": "All tests passed! Next resource unlocked!",
    "next_resource_unlocked": true
  }
}
```

---

#### Q&A / RAG APIs

**Purpose**: Answer questions about video content using AI

| Endpoint                                                    | Purpose                       |
| ----------------------------------------------------------- | ----------------------------- |
| `GET /api/resource/summary/get-or-create`                   | Get or generate video summary |
| `POST /api/resource/qa/ask`                                 | Ask a question about a video  |
| `GET /api/resource/chat-history/{resource_id}/{student_id}` | Get all past Q&A              |

**Ask Question Request**:

```json
{
  "resource_id": "res_123",
  "resource_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "student_id": "stu_456",
  "question": "What is the difference between IaaS and PaaS?"
}
```

**Ask Question Response**:

```json
{
  "answer": "IaaS (Infrastructure as a Service) provides virtualized computing resources over the internet, like servers and storage. You manage applications and data. PaaS (Platform as a Service) goes further - it provides a platform for building applications, so you don't have to manage the infrastructure. PaaS is more 'hands-off' for developers.",
  "chat_history": [
    {
      "question": "What is cloud computing?",
      "answer": "Cloud computing is delivering computing services like servers, storage, and software over the internet...",
      "asked_at": "2026-04-20T10:15:00Z"
    },
    {
      "question": "What is the difference between IaaS and PaaS?",
      "answer": "IaaS (Infrastructure as a Service)...",
      "asked_at": "2026-04-20T10:25:00Z"
    }
  ]
}
```

---

#### Module Assessment APIs

**Purpose**: Create, publish, and grade final module exams

| Endpoint                                              | Purpose                           |
| ----------------------------------------------------- | --------------------------------- |
| `POST /api/module-assessment/draft-generate`          | AI generates draft assessment     |
| `GET /api/module-assessment/{assessment_id}`          | Get assessment details            |
| `PATCH /api/module-assessment/{assessment_id}`        | Edit assessment (teacher)         |
| `POST /api/module-assessment/{assessment_id}/publish` | Make assessment available         |
| `POST /api/module-assessment/submission/start`        | Student begins assessment         |
| `POST /api/module-assessment/submission/{sid}/submit` | Student submits answers           |
| `PATCH /api/module-assessment/submission/{sid}/grade` | Teacher grades subjective answers |

**Draft Generation** (AI Creates Questions):

```json
Request:
{
  "module_id": "mod_cloud",
  "num_questions": 20,
  "question_types": ["mcq", "fill_blank", "essay"]
}

Response:
{
  "assessment_id": "ma_xyz789",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "Which cloud service model allows you to rent virtual servers?",
      "options": [...],
      "points": 5
    },
    {
      "id": "q2",
      "type": "essay",
      "question": "Explain the differences between public, private, and hybrid clouds.",
      "points": 10
    }
  ],
  "status": "draft",
  "message": "Edit the questions above and click Publish when ready."
}
```

---

#### Grading APIs

**Purpose**: View and submit grades

| Endpoint                                         | Purpose                             |
| ------------------------------------------------ | ----------------------------------- |
| `GET /api/teacher/pending-grades/{classroom_id}` | See submissions waiting for grading |
| `GET /api/classroom/{id}/pending-grading-count`  | Number of pending submissions       |

---

#### Announcements APIs

**Purpose**: Post classroom-wide messages

| Endpoint                                            | Purpose               |
| --------------------------------------------------- | --------------------- |
| `POST /api/classroom/{id}/announcements`            | Create announcement   |
| `GET /api/classroom/{id}/announcements`             | Get all announcements |
| `PUT /api/classroom/{id}/announcements/{aid}`       | Edit announcement     |
| `DELETE /api/classroom/{id}/announcements/{aid}`    | Delete announcement   |
| `POST /api/classroom/{id}/announcements/{aid}/view` | Mark as read          |

---

#### Analytics APIs

**Purpose**: View insights and progress

| Endpoint                                          | Purpose                                  |
| ------------------------------------------------- | ---------------------------------------- |
| `GET /api/analytics/classroom/{id}`               | Teacher sees class-wide analytics        |
| `GET /api/analytics/classroom/{id}/student/{sid}` | Teacher sees individual student progress |
| `GET /api/analytics/classroom/{id}/my-progress`   | Student sees own progress                |
| `GET /api/classroom/{id}/activity-feed`           | Teacher sees real-time activity          |

---

## 🗄️ Database Structure

### What Is MongoDB?

A database is like a filing cabinet where data is organized. MongoDB stores data as flexible documents (similar to JSON).

### Collections (Filing Drawers)

#### 1. **users** Collection

**Stores**: User account information  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "email": "teacher@school.com",
  "password_hash": "encrypted",
  "first_name": "John",
  "last_name": "Smith",
  "role": "teacher",
  "profile_picture": "url",
  "classroom_memberships": [
    {
      "classroom_id": "cls_123",
      "role": "teacher",
      "joined_at": "2026-01-15"
    }
  ],
  "created_at": "2026-01-15",
  "updated_at": "2026-04-20"
}
```

#### 2. **classrooms** Collection

**Stores**: Classroom information  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "name": "Cloud Computing 101",
  "description": "Introduction to cloud services",
  "teacher_id": "usr_123",
  "enrollment_code": "CLOUD2026",
  "students": ["stu_1", "stu_2", "stu_3"],
  "status": "active",
  "created_at": "2026-01-15",
  "settings": {
    "allow_self_enrollment": true,
    "max_students": 50
  }
}
```

#### 3. **learning_modules** Collection

**Stores**: Module structure and metadata  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "classroom_id": "cls_123",
  "title": "Cloud Computing Basics",
  "description": "Learn fundamental cloud concepts",
  "topic": "cloud",
  "order_index": 1,
  "resources": [
    {
      "resource_id": "res_1",
      "title": "What is Cloud Computing?",
      "url": "https://youtube.com/...",
      "order_index": 0,
      "type": "video"
    }
  ],
  "status": "active",
  "created_at": "2026-01-15"
}
```

#### 4. **resources** Collection

**Stores**: Individual video resources  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "classroom_id": "cls_123",
  "module_id": "mod_456",
  "title": "What is Cloud Computing?",
  "youtube_url": "https://youtube.com/watch?v=xyz",
  "order_index": 0,
  "passing_score_threshold": 0.8,
  "cached_summary": "Cloud computing is delivering computing services...",
  "cached_summary_generated_at": "2026-04-19",
  "created_at": "2026-01-15"
}
```

#### 5. **student_progress** Collection ⭐

**Stores**: Each student's progress on each resource  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "student_id": "stu_123",
  "classroom_id": "cls_456",
  "module_id": "mod_789",
  "resource_id": "res_abc",
  "is_unlocked": true,
  "passed_tests_count": 2,
  "highest_score": 92,
  "last_attempted_at": "2026-04-20T10:30:00Z",
  "single_turn_chat_history": [
    {
      "question": "What is IaaS?",
      "answer": "Infrastructure as a Service...",
      "asked_at": "2026-04-20T10:15:00Z"
    }
  ],
  "created_at": "2026-04-15",
  "last_accessed_at": "2026-04-20T10:30:00Z"
}
```

**Why Important**: This table is the heart of the "Rule of 2" system - it tracks how many tests each student passed.

#### 6. **quiz_attempts** Collection

**Stores**: Individual quiz takes (each quiz is a separate record)  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "resource_id": "res_123",
  "student_id": "stu_456",
  "classroom_id": "cls_789",
  "module_id": "mod_abc",
  "questions": [
    {
      "id": "q1",
      "question": "What does IaaS stand for?",
      "type": "mcq",
      "student_answer": "Infrastructure as a Service",
      "correct_answer": "Infrastructure as a Service",
      "is_correct": true,
      "points": 5
    }
  ],
  "score_obtained": 20,
  "total_points": 25,
  "score_percentage": 80,
  "passed": true,
  "attempt_number": 1,
  "submitted_at": "2026-04-20T10:30:00Z",
  "feedback": "Excellent work! You demonstrated..."
}
```

#### 7. **module_assessments** Collection

**Stores**: Final module exam templates  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "module_id": "mod_123",
  "title": "Cloud Computing Final Assessment",
  "description": "Comprehensive exam covering all module topics",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "Which cloud model...",
      "options": [...],
      "correct_answer": "IaaS",
      "points": 5
    },
    {
      "id": "q2",
      "type": "essay",
      "question": "Explain the differences...",
      "points": 15,
      "rubric": "Rubric criteria for grading"
    }
  ],
  "time_limit_minutes": 60,
  "passing_score": 0.70,
  "shuffle_questions": true,
  "is_draft": false,
  "is_published": true,
  "published_at": "2026-04-18",
  "valid_from": "2026-04-20",
  "created_at": "2026-04-18"
}
```

#### 8. **assessment_submissions** Collection

**Stores**: Student answers to final assessments  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "assessment_id": "ma_123",
  "module_id": "mod_456",
  "classroom_id": "cls_789",
  "student_id": "stu_abc",
  "answers": [
    {
      "question_id": "q1",
      "student_answer": "Infrastructure as a Service",
      "type": "mcq",
      "is_correct": true,
      "points_awarded": 5
    },
    {
      "question_id": "q2",
      "student_answer": "Cloud computing offers flexibility...",
      "type": "essay",
      "is_correct": null,
      "points_awarded": null
    }
  ],
  "auto_graded_score": 5,
  "manual_graded_score": null,
  "total_score": 5,
  "score_percentage": null,
  "passed": null,
  "grading_status": "pending_manual_grade",
  "started_at": "2026-04-20T10:00:00Z",
  "submitted_at": "2026-04-20T10:45:00Z",
  "is_final_score": false
}
```

#### 9. **announcements** Collection

**Stores**: Classroom announcements  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "classroom_id": "cls_123",
  "teacher_id": "usr_456",
  "title": "Welcome to Cloud Computing!",
  "content": "I'm excited to have you in class...",
  "viewers": ["stu_1", "stu_2"],
  "created_at": "2026-04-20",
  "updated_at": "2026-04-20",
  "pinned": false
}
```

#### 10. **activity_feed** Collection

**Stores**: Real-time class activity logs  
**Sample Record**:

```json
{
  "_id": "ObjectId",
  "classroom_id": "cls_123",
  "activity_type": "quiz_passed",
  "student_id": "stu_456",
  "resource_id": "res_789",
  "details": {
    "score": 92,
    "passed_tests_count": 2
  },
  "message": "Student John Doe passed Quiz for Resource 1 (92%)",
  "created_at": "2026-04-20T10:30:00Z"
}
```

### Database Indexes (Speed Optimization)

Indexes are like bookmarks - they help find data faster.

**Key Indexes**:

- `student_progress(student_id, classroom_id, module_id)` - Fast progress lookup
- `quiz_attempts(resource_id, student_id)` - Fast quiz history lookup
- `module_assessments(module_id, is_published)` - Fast assessment lookup
- `activity_feed(classroom_id, created_at)` - Fast activity feed retrieval

---

## 🎓 How the Learning System Works (Rule of 2)

### The Student Journey in One Module

#### Step 1: Module Unlocked

- Teacher publishes module with resources
- All resources are initially **locked**
- Student can see them but can't access yet

#### Step 2: First Resource Available

- First resource is **unlocked** by default
- Student can view the video
- Student can chat with AI about the video

#### Step 3: First Quiz

- Student clicks "Take Quiz"
- AI generates a unique quiz from video content (5-8 questions)
- Student answers questions
- System grades it immediately

**Scenario A - Student Scores < 80%:**

- ❌ Quiz failed, "Come back and try again"
- Passed tests: still 0/2
- Resource remains locked for next student

**Scenario B - Student Scores ≥ 80%:**

- ✅ First test passed!
- Message: "Great job! You passed the first quiz. Take it one more time to prove you understand."
- Passed tests: 1/2
- Resource remains locked until second quiz passes

#### Step 4: Second Quiz (Different Questions)

- Student takes quiz again
- AI generates completely different questions from the same video
- Student answers

**Scenario A - Student Scores < 80%:**

- ❌ Still need to pass one more time
- Passed tests: 1/2 (doesn't reset)
- Student keeps trying until they pass again

**Scenario B - Student Scores ≥ 80%:**

- ✅ All tests passed!
- Next resource automatically **unlocked**
- Message: "Fantastic! You've mastered this resource. Resource 2 is now available."
- Passed tests: 2/2

#### Step 5: Next Resource Unlocked

- Resource 2 becomes available
- Process repeats (student must pass 2 quizzes on Resource 2)
- All resources must be completed this way

#### Step 6: All Resources Complete

- All resources have 2/2 passes
- Message: "You've completed all learning materials! The Final Assessment is now available."
- Final Module Assessment becomes visible

#### Step 7: Final Assessment

- Student takes comprehensive exam (created/graded by teacher)
- Auto-graded questions get immediate feedback
- Essay questions wait for teacher grading
- Final grade recorded

### Why "Rule of 2" Works

| Benefit                    | Why It Matters                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| **Prevents Lucky Guesses** | Students must pass twice - can't just get lucky once                   |
| **Ensures Deep Learning**  | Different questions each time - forces understanding, not memorization |
| **Reduces Test Anxiety**   | First pass doesn't make/break you - you have another chance            |
| **Consistent Baseline**    | All students must meet same standard before moving forward             |
| **Builds Confidence**      | "I passed it twice" feels more legitimate than "I passed it once"      |
| **Catches Cheating**       | Hard to get the same score twice if you didn't really learn            |

---

## 🔐 Security & Permissions (RBAC)

### Role-Based Access Control (RBAC)

The system uses roles to decide who can do what:

#### Teacher Permissions in Their Classroom

- ✅ Create modules and resources
- ✅ View all student progress
- ✅ Grade subjective answers
- ✅ Create announcements
- ✅ Add/remove students
- ✅ Create groups
- ✅ See analytics and activity feed
- ❌ Cannot view other teachers' classrooms
- ❌ Cannot change student responses

#### Student Permissions in Their Classroom

- ✅ View assigned modules and resources
- ✅ Take quizzes
- ✅ Ask AI questions
- ✅ View own progress
- ✅ Read announcements
- ✅ Take final assessment
- ❌ Cannot view other students' scores
- ❌ Cannot create modules
- ❌ Cannot grade anything
- ❌ Cannot see other classrooms they're not in

#### Administrator Permissions (Future)

- ✅ Everything
- ✅ View all classrooms
- ✅ Manage teachers
- ✅ Generate system reports

### Authentication Flow

```
1. User enters email/password
   ↓
2. System checks against database
   ↓
3. Password verified? Yes → Create JWT Token
              No → Show "Invalid password" error
   ↓
4. Token contains:
   - User ID
   - User role (teacher/student)
   - Classroom ID (if applicable)
   - Expiration time (24 hours)
   ↓
5. Token sent to browser (stored securely)
   ↓
6. Every request includes token as proof of identity
   ↓
7. Server verifies token is valid before processing request
   ↓
8. Token expires → User must login again
```

### Data Privacy

- **Your Data is Private**: Students only see their own scores/progress
- **Teacher Data Protected**: Teachers can only see classrooms they teach
- **Secure Passwords**: Passwords are encrypted, never stored in plain text
- **No Third-Party Access**: Your data isn't sold or shared

---

## 🚀 System Features at a Glance

### Content Management

- ✅ Structure learning into modules
- ✅ Sequence resources in order
- ✅ Link YouTube videos as resources
- ✅ Organize resources by topic
- ✅ Reorder modules and resources
- ✅ Archive or delete modules

### Assessment & Grading

- ✅ AI generates quizzes from video content
- ✅ Auto-grade multiple choice and fill-in questions
- ✅ Manual grading for essay questions
- ✅ Immediate feedback to students
- ✅ Score tracking over time
- ✅ Bulk assignment of resources

### Learning Support

- ✅ AI-powered Q&A about video content
- ✅ Content summarization (cached for speed)
- ✅ Chat history tracking
- ✅ Smart search (RAG) finds relevant content
- ✅ Multiple quiz attempts with different questions

### Communication

- ✅ Classroom announcements
- ✅ View tracking (who read announcements)
- ✅ Announcement editing/deletion
- ✅ Pin important announcements

### Progress Tracking

- ✅ Per-student, per-module progress
- ✅ Quiz attempt history
- ✅ Score trends
- ✅ Time spent on resources
- ✅ Completion status
- ✅ Activity feed (real-time)

### Enrollment

- ✅ Student self-enrollment (with code)
- ✅ Manual student addition
- ✅ Bulk upload (CSV)
- ✅ Student grouping
- ✅ Remove students
- ✅ Enrollment status tracking

### AI Integration

- ✅ Quiz question generation
- ✅ Content summarization
- ✅ Q&A answering
- ✅ Feedback generation
- ✅ Works with local AI (privacy) or cloud AI (speed)
- ✅ Automatic fallback if AI provider down

---

## 📊 How Data Flows Through the System

### Example: Student Taking a Quiz

```
Frontend (Browser)          Backend (Server)           Database (MongoDB)
┌──────────────────┐       ┌──────────────────┐       ┌──────────────┐
│ Student clicks   │       │                  │       │              │
│ "Take Quiz"      │──────▶│ Quiz route gets  │       │              │
└──────────────────┘       │ resource details │──────▶│ Fetch from   │
                           └──────────────────┘       │ resources    │
                                                      │ collection   │
                           ┌──────────────────┐       └──────────────┘
                           │ Extract video    │
                           │ transcript       │◀──────┐ YouTube API
                           └──────────────────┘       (faster than re-processing)
                                    ↓
                           ┌──────────────────┐
                           │ AI: Generate 5   │
                           │ unique questions │──────▶│ LM Studio or
                           │ from transcript  │       │ Google Gemini
                           └──────────────────┘
                                    ↓
                           ┌──────────────────┐       ┌──────────────┐
                           │ Create quiz      │──────▶│ Save to      │
                           │ attempt record   │       │ quiz_attempts│
                           │ in database      │       │ collection   │
                           └──────────────────┘       └──────────────┘
                                    ↓
┌──────────────────┐       ┌──────────────────┐
│ Student sees     │◀──────│ Return quiz      │
│ questions        │       │ with question    │
│ on screen        │       │ texts            │
└──────────────────┘       └──────────────────┘
         │
         │ Student answers questions
         │
┌──────────────────┐       ┌──────────────────┐
│ Click "Submit"   │──────▶│ Grade answers    │
│ Send answers     │       │ Compare to       │
└──────────────────┘       │ correct answers  │
                           └──────────────────┘
                                    ↓
                           ┌──────────────────┐
                           │ AI: Generate     │
                           │ feedback text    │
                           └──────────────────┘
                                    ↓
                           ┌──────────────────┐       ┌──────────────┐
                           │ Update quiz      │──────▶│ Update quiz  │
                           │ attempt with     │       │ attempt and  │
                           │ results          │       │ student prog │
                           └──────────────────┘       │ collections  │
                                    ↓                 └──────────────┘
                           ┌──────────────────┐
                           │ If passed ≥80%:  │
                           │ Increment passed │
                           │ tests counter    │
                           └──────────────────┘
                                    ↓
                           ┌──────────────────┐
                           │ If passed_count  │
                           │ == 2: Unlock     │
                           │ next resource    │
                           └──────────────────┘
                                    ↓
┌──────────────────┐       ┌──────────────────┐
│ Student sees:    │◀──────│ Return:          │
│ - Score (92%)    │       │ - Score          │
│ - Feedback       │       │ - Feedback       │
│ - Progress       │       │ - Progress       │
│ - Next steps     │       │ - Next resource  │
└──────────────────┘       │ - Unlock status  │
                           └──────────────────┘
```

---

## 🎯 Learning Paths (How to Learn About This System)

### For Non-Technical Stakeholders

1. **Read This Document** (pages 1-40)
2. **Watch System Demo** (if available)
3. **Explore as Teacher** - Create module, see student progress
4. **Explore as Student** - Take a quiz, see AI feedback
5. **Review Analytics** - See what data the system shows

### For Teachers Implementing the System

1. **System Overview** (this document, pages 1-30)
2. **Teacher Feature Guide** (pages 20-30)
3. **Enrollment & Setup Guide** (separate doc)
4. **Grading & Assessment Guide** (separate doc)
5. **Analytics & Reporting** (separate doc)

### For Technical Users / Developers

1. **System Architecture** (pages 35-40)
2. **Technology Stack** (pages 10-15)
3. **API Reference** (docs/API_REFERENCE.md)
4. **Database Schema** (pages 55-75)
5. **Backend Routes** (API_REFERENCE.md)
6. **Code Repository** - Explore Backend/ and frontend/ folders

### For Project Managers

1. **Project Vision** (pages 5-10)
2. **Key Features** (pages 25-35)
3. **Implementation Plan** (IMPLEMENTATION_PLAN.md)
4. **Phase 2 Summary** (Memory: phase2_implementation_summary.md)
5. **Timeline & Milestones** (Project tracking)

---

## 📋 System Checklist - What's Done vs What's Coming

### Phase 1: Foundation ✅ COMPLETE

- [x] User authentication (login/register)
- [x] Classroom creation and management
- [x] Basic enrollment system
- [x] JWT token security
- [x] Role-based access control

### Phase 2: Core Classroom Features ✅ COMPLETE

- [x] Announcements system
- [x] Bulk student enrollment
- [x] Student grouping
- [x] Dashboard (teacher & student)
- [x] Basic analytics
- [x] Activity feed
- [x] Enrollment routes & services

### Phase 3: Learning Modules & Assessment ✅ SUBSTANTIALLY COMPLETE

- [x] Module creation and management
- [x] Resource assignment to modules
- [x] Quiz generation from video content
- [x] Quiz submission and grading
- [x] Student progress tracking (Rule of 2)
- [x] Module assessment templates
- [x] Assessment submission workflow (Multi-Mode)
- [x] Manual grading interface
- [x] Final assessment grading
- [x] Resource Q&A (RAG)
- [x] Content summarization
- [x] Chat history tracking

### Phase 4: Gamification & Advanced Features 🔄 IN PROGRESS

- [x] XP and Leveling System
- [x] Badge and Achievement System
- [ ] Advanced Teacher Insights
- [ ] Predictive Analytics
- [x] Personal Notebooks (Portable RAG)
- [x] Skill Pathways
- [x] Activity Feed (Real-time)

---

## 🔗 Quick Links to Important Documents

| Document                                            | Purpose                                 |
| --------------------------------------------------- | --------------------------------------- |
| [API_REFERENCE.md](../API_REFERENCE.md)             | All backend APIs and how to use them    |
| [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) | Detailed technical implementation guide |
| [Frontend README](../../frontend/README.md)         | Frontend setup and components           |
| [Backend README](../../Backend/README.md)           | Backend setup and services              |

---

## ❓ FAQ - Common Questions

### Q: How is this different from Google Classroom?

**A**: Google Classroom is broad-purpose. Quasar LMS is specifically designed for:

- **Structured learning** (strict resource order)
- **Mastery verification** (Rule of 2 quizzes)
- **AI tutoring** (Q&A and summaries built-in)
- **Progressive unlocking** (students can't skip ahead)

### Q: How is this different from Canvas or Blackboard?

**A**: Canvas/Blackboard are enterprise systems. Quasar is:

- **Lighter weight** (focuses on learning quality, not administration)
- **AI-integrated** (AI generates quizzes, summarizes, answers questions)
- **Modern tech stack** (React, FastAPI, MongoDB - not legacy Java)
- **Privacy-first** (works with local AI models)

### Q: What if students cheat on quizzes?

**A**: Hard to cheat because:

1. **Different questions each attempt** - Memorizing answers doesn't help
2. **Must pass twice** - Can't just memorize one answer set
3. **Timed** - Less time to look up answers
4. **Random order** - Questions appear in random order
5. **AI detects** - Feedback is AI-generated, not just right/wrong

### Q: Can students go backward to easier resources?

**A**: Yes! The system tracks progress but doesn't prevent revisiting. Teachers can see if students are avoiding harder resources and can follow up.

### Q: What if the AI generates bad quiz questions?

**A**: Teachers review the draft assessment before publishing. Teachers can:

- Edit questions
- Remove questions
- Add new questions
- Set correct answers
- Then publish

### Q: What happens if the AI provider is down?

**A**: System has fallback:

1. Try local LM Studio first
2. Fall back to Groq
3. Fall back to Google Gemini
4. If all down: show message "AI temporarily unavailable, try later"

### Q: How much does this cost to run?

**A**: Depends on your setup:

- **Local-only**: Just server costs (~$0/month if self-hosted)
- **With cloud AI**: Pay per API call (~$0.001 per quiz, ~$0.01 per summarization)
- **Typical classroom (30 students)**: ~$5-20/month for cloud AI

### Q: How many students can the system handle?

**A**: System is built for async operations:

- **Single server**: 100+ concurrent users
- **Scalable**: Add more servers as needed
- **Database**: MongoDB handles millions of records

### Q: Can teachers create other types of assessments?

**A**: Current version focuses on module structure. Future versions will support:

- Standalone assignments
- Peer review assignments
- Discussion posts
- Project submissions

---

## 🛟 Getting Help

### For Technical Issues

- Check backend logs: `Backend/logs/`
- Check frontend console: Browser Developer Tools (F12)
- Search API_REFERENCE.md for the endpoint
- Check IMPLEMENTATION_PLAN.md for details

### For Feature Questions

- This document (SYSTEM_OVERVIEW.md)
- API_REFERENCE.md for what's available
- Feature Requests: Create an issue in project tracking

### For Training

- This document has full walkthroughs
- Video demos (if available)
- Live training sessions (schedule with team)

---

## 📞 Contact & Support

- **Project Lead**: [Project Manager]
- **Technical Support**: [Development Team]
- **Feedback**: [Project Tracking System]
- **Documentation**: See links section above

---

## 📝 Document History

| Date       | Version | Changes                               |
| ---------- | ------- | ------------------------------------- |
| 2026-04-20 | 1.0     | Initial comprehensive system overview |
| TBD        | 1.1     | Add Phase 3 final features            |
| TBD        | 2.0     | Add Phase 4 advanced features         |

---

**Last Updated**: April 20, 2026  
**Maintained By**: Development Team  
**Next Review**: May 20, 2026
