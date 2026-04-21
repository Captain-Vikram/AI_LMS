import os
from pymongo import MongoClient

def get_mongo_url():
    return os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")


def get_db_name():
    return os.getenv("MONGO_DB_NAME", "quasar")

client = MongoClient(get_mongo_url())
db = client[get_db_name()]

fullstack_pathway = {
  "_id": "pathway_fullstack_developer",
  "title": "Full Stack Developer",
  "description": "Become a 'jack of all trades' capable of building a full-featured web application from start to finish.",
  "badges": [
    {"stage_index": 1, "badge_name": "Frontend Wizard", "trigger": "completion"},
    {"stage_index": 2, "badge_name": "Backend Engineer", "trigger": "completion"},
    {"stage_index": 4, "badge_name": "Full Stack Master", "trigger": "completion"}
  ],
  "stages": [
    {
      "stage_index": 1,
      "title": "Phase 1: Frontend Development (The User Interface)",
      "prerequisites": [],
      "topics": [
        {"name": "The Foundational Languages", "subtopics": ["HTML", "CSS", "JavaScript"]},
        {"name": "Package Management", "subtopics": ["npm"]},
        {"name": "Modern Frameworks and Styling", "subtopics": ["React", "Vue", "Tailwind CSS"]}
      ],
      "resource_generation_prompt": "Find top tutorials and videos for beginner frontend web development focusing on HTML, CSS, JavaScript, and building UI components with React and Tailwind CSS.",
      "quiz_generation_prompt": "Generate 10 multiple-choice questions testing core JavaScript concepts, CSS layouts, and React component state management.",
      "project_assessment_prompt": "Ask the student to build a responsive portfolio webpage using React and Tailwind CSS that utilizes dynamic state for a contact form.",
      "max_regenerations": 3
    },
    {
      "stage_index": 2,
      "title": "Phase 2: Backend Development (The Business Logic)",
      "prerequisites": [1],
      "topics": [
        {"name": "Backend Languages", "subtopics": ["Node.js", "Python", "Ruby", "Java", "PHP", "C#"]},
        {"name": "APIs", "subtopics": ["RESTful APIs"]},
        {"name": "Databases", "subtopics": ["PostgreSQL", "NoSQL"]},
        {"name": "Authentication & Caching", "subtopics": ["JWT Auth", "Redis"]},
        {"name": "Full Stack Frameworks", "subtopics": ["NextJS", "Django"]}
      ],
      "resource_generation_prompt": "Find 5 articles and 5 videos teaching Backend Development with Node.js or Python, designing RESTful APIs, and implementing JWT authentication and Redis caching.",
      "quiz_generation_prompt": "Generate 10 questions testing REST API design principles, SQL vs NoSQL basics, and how JWT stateless authentication works.",
      "project_assessment_prompt": "Assign a project to build a secure REST API using Node.js and PostgreSQL, including endpoints for user registration and login that return a valid JWT.",
      "max_regenerations": 3
    },
    {
      "stage_index": 3,
      "title": "Phase 3: DevOps & Infrastructure (Production & Deployment)",
      "prerequisites": [2],
      "topics": [
        {"name": "Server Basics", "subtopics": ["Linux Commands"]},
        {"name": "Cloud Hosting", "subtopics": ["AWS EC2", "AWS VPC", "AWS S3", "AWS Route53", "AWS SES"]},
        {"name": "Automation (CI/CD)", "subtopics": ["GitHub Actions"]},
        {"name": "Infrastructure as Code & Configuration", "subtopics": ["Terraform", "Ansible"]},
        {"name": "Monitoring", "subtopics": ["Monit"]}
      ],
      "resource_generation_prompt": "Find top resources explaining basic Linux commands, AWS services (EC2, S3, Route53), setting up CI/CD pipelines with GitHub Actions, and Terraform.",
      "quiz_generation_prompt": "Generate 10 multiple-choice questions assessing knowledge of Linux file navigation, the difference between AWS EC2 and S3, and basic Terraform states.",
      "project_assessment_prompt": "Create a scenario where the student must write a GitHub Actions workflow file that builds a Node.js app and deploys it to an AWS EC2 instance.",
      "max_regenerations": 3
    },
    {
      "stage_index": 4,
      "title": "Phase 4: Supporting Skills",
      "prerequisites": [3],
      "topics": [
        {"name": "Version Control", "subtopics": ["Git", "GitHub"]},
        {"name": "Continuous Practice", "subtopics": ["Static webpages", "CLI apps", "CRUD apps"]}
      ],
      "resource_generation_prompt": "Find comprehensive guides on Git version control, branching strategies, and resolving merge conflicts.",
      "quiz_generation_prompt": "Generate 10 questions covering Git merge conflicts, branching concepts, and standard practices for GitHub pull requests.",
      "project_assessment_prompt": "Ask the student to initialize a Git repository, create a separate feature branch, commit a basic CRUD application, and push it to GitHub explaining their changes.",
      "max_regenerations": 3
    }
  ]
}

db.global_learning_pathways.update_one(
    {"_id": fullstack_pathway["_id"]},
    {"$set": fullstack_pathway},
    upsert=True
)

print("✅ Successfully seeded the Full Stack Developer pathway to MongoDB!")
