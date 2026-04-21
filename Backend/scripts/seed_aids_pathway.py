import os
from pymongo import MongoClient

def get_mongo_url():
    return os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")


def get_db_name():
    return os.getenv("MONGO_DB_NAME", "quasar")

client = MongoClient(get_mongo_url())
db = client[get_db_name()]

aids_pathway = {
  "_id": "pathway_ai_data_science",
  "title": "AI & Data Science Expert",
  "description": "Master everything from foundational mathematics and A/B testing to deploying LLMs and agentic AI systems.",
  "badges": [
    {"stage_index": 3, "badge_name": "Statistical Modeler", "trigger": "completion"},
    {"stage_index": 8, "badge_name": "Deep Learning Visionary", "trigger": "completion"},
    {"stage_index": 12, "badge_name": "AI Engineer & Data Scientist", "trigger": "completion"}
  ],
  "stages": [
    {
      "stage_index": 1,
      "title": "Phase 1: Mathematical Foundations",
      "prerequisites": [],
      "topics": [
        {"name": "Core Mathematics", "subtopics": ["Linear Algebra", "Calculus", "Mathematical Analysis"]},
        {"name": "Calculus Deep Dive", "subtopics": ["Differential Calculus"]}
      ],
      "resource_generation_prompt": "Find top resources and tutorials explaining Linear Algebra and Differential Calculus specifically tailored for understanding machine learning algorithms.",
      "quiz_generation_prompt": "Generate 10 multiple-choice questions assessing the fundamentals of Linear Algebra (vectors, matrices) and basic Differential Calculus.",
      "project_assessment_prompt": "Ask the student to mathematically define a simple linear equation and manually calculate its derivative, explaining how it relates to algorithm optimization.",
      "max_regenerations": 3
    },
    {
      "stage_index": 2,
      "title": "Phase 2: Statistics & A/B Testing",
      "prerequisites": [1],
      "topics": [
        {"name": "Core Statistics", "subtopics": ["Probability and Sampling", "Central Limit Theorem (CLT)"]},
        {"name": "Hypothesis Testing", "subtopics": ["Formulation", "Statistical Significance"]},
        {"name": "A/B Testing Mastery", "subtopics": ["Experiment Design", "Minimum Detectable Effect (MDE)"]},
        {"name": "Increasing Test Sensitivity", "subtopics": ["CUPED", "Stratification"]},
        {"name": "Ratio Metrics", "subtopics": ["Delta Method"]}
      ],
      "resource_generation_prompt": "Find advanced tutorials and articles on A/B Testing experiment design, the Delta Method for ratio metrics, and variance reduction using CUPED.",
      "quiz_generation_prompt": "Generate 10 rigorous questions on the Central Limit Theorem, calculating Minimum Detectable Effect, and the mathematical purpose of CUPED in A/B testing.",
      "project_assessment_prompt": "Present a hypothetical e-commerce checkout page scenario. Ask the student to design an A/B test, identify the Minimum Detectable Effect, and propose a stratification strategy to handle weekend vs weekday traffic.",
      "max_regenerations": 3
    },
    {
      "stage_index": 3,
      "title": "Phase 3: Econometrics & Time Series",
      "prerequisites": [2],
      "topics": [
        {"name": "Fundamentals", "subtopics": ["Econometrics Basics"]},
        {"name": "Forecasting Models", "subtopics": ["Linear Regression", "Fitting Distributions", "Time Series"]},
        {"name": "Advanced Time Series", "subtopics": ["ARIMA Model"]}
      ],
      "resource_generation_prompt": "Find 5 exhaustive articles and videos explaining Econometrics fundamentals, Linear Regression fitting, and the math behind ARIMA models for Time Series forecasting.",
      "quiz_generation_prompt": "Generate 10 questions evaluating the student's understanding of Linear Regression assumptions, fitting distributions, and the components (AR, I, MA) of an ARIMA model.",
      "project_assessment_prompt": "Provide a scenario involving monthly store sales data showing seasonality. Ask the student to explain how they would transform the data and configure an ARIMA model to forecast the upcoming quarter.",
      "max_regenerations": 3
    },
    {
      "stage_index": 4,
      "title": "Phase 4: Coding & Programming",
      "prerequisites": [3],
      "topics": [
        {"name": "Python Programming", "subtopics": ["Core Python", "Data Structures", "Algorithms"]},
        {"name": "Database Querying", "subtopics": ["SQL"]}
      ],
      "resource_generation_prompt": "Find practical coding resources teaching Python Data Structures for data science, and advanced SQL querying for analytical data extraction.",
      "quiz_generation_prompt": "Generate 10 coding-centric questions on Python dictionary/list operations and complex SQL aggregations (JOINs, GROUP BY, Window Functions).",
      "project_assessment_prompt": "Provide a complex data extraction scenario requiring the student to write a nested SQL window function query to retrieve top customers, followed by pseudo-code explaining how to process that data in Python.",
      "max_regenerations": 3
    },
    {
      "stage_index": 5,
      "title": "Phase 5: Data Collection & Cleaning",
      "prerequisites": [4],
      "topics": [
        {"name": "Collecting Data", "subtopics": ["Web Scraping", "APIs", "Database Extraction"]},
        {"name": "Cleaning Data", "subtopics": ["Formatting", "Handling Missing Values", "Outlier Removal"]}
      ],
      "resource_generation_prompt": "Find top guides on Python web scraping, API data extraction, and programmatic techniques for handling missing values and removing statistical outliers.",
      "quiz_generation_prompt": "Generate 10 questions testing methodologies for imputing missing values (Mean vs Median) and identifying outliers using Interquartile Range (IQR).",
      "project_assessment_prompt": "Give the student a hypothetical dirty dataset scenario (e.g., ages of employees showing negatives and nulls). Have them write a Python script demonstrating how they would clean and impute the data logically.",
      "max_regenerations": 3
    },
    {
      "stage_index": 6,
      "title": "Phase 6: Exploratory Data Analysis (EDA)",
      "prerequisites": [5],
      "topics": [
        {"name": "Understanding & Visualizing", "subtopics": ["Initial Patterns", "Trends Identification"]},
        {"name": "Python EDA Tools", "subtopics": ["Pandas", "Seaborn"]}
      ],
      "resource_generation_prompt": "Find 5 interactive tutorials and videos on conducting Exploratory Data Analysis (EDA) exclusively using Python, Pandas, and Seaborn visual plotting.",
      "quiz_generation_prompt": "Generate 10 questions assessing knowledge of Pandas DataFrame filtering, Seaborn correlation heatmaps, and identifying confounding variables during EDA.",
      "project_assessment_prompt": "Assign an EDA project where the student is given a mock 'Titanic' dataset. They must output Python code using Pandas and Seaborn to visualize the survival rate by gender and class.",
      "max_regenerations": 3
    },
    {
      "stage_index": 7,
      "title": "Phase 7: Machine Learning (ML)",
      "prerequisites": [6],
      "topics": [
        {"name": "Classic ML", "subtopics": ["Supervised Learning", "Unsupervised Learning"]},
        {"name": "Advanced ML", "subtopics": ["Ensembles"]},
        {"name": "Pattern Recognition", "subtopics": ["Classification", "Interpretation Techniques"]}
      ],
      "resource_generation_prompt": "Find top conceptual articles and practical Python ML overviews covering Supervised vs Unsupervised modeling, and the logic behind Ensemble methods like Random Forests.",
      "quiz_generation_prompt": "Generate 10 advanced questions evaluating the mathematical differences between clustering (unsupervised) and classification (supervised) algorithms, and the voting mechanism in ML Ensembles.",
      "project_assessment_prompt": "Present a churn prediction problem. Ask the student to design an Ensemble learning pipeline, explaining which foundational models they will combine and why it prevents overfitting.",
      "max_regenerations": 3
    },
    {
      "stage_index": 8,
      "title": "Phase 8: Deep Learning",
      "prerequisites": [7],
      "topics": [
        {"name": "Neural Network Architectures", "subtopics": ["Fully Connected Networks", "CNNs", "RNNs", "LSTMs"]},
        {"name": "Transformers & TL", "subtopics": ["Transformers", "Attention is all you need", "Transfer Learning"]}
      ],
      "resource_generation_prompt": "Find 5 comprehensive videos and 5 articles deeply explaining Convolutional Neural Networks (CNNs), LSTMs, and the mathematical mechanics of Attention blocks within Transformers.",
      "quiz_generation_prompt": "Generate 10 highly technical questions evaluating the vanishing gradient problem in RNNs, pooling layers in CNNs, and the self-attention mechanism in Transformers.",
      "project_assessment_prompt": "Provide an image classification scenario and an NLP translation scenario. Instruct the student to justify deploying a CNN versus a Transformer, outlining the Transfer Learning process for the latter.",
      "max_regenerations": 3
    },
    {
      "stage_index": 9,
      "title": "Phase 9: MLOps (Machine Learning Operations)",
      "prerequisites": [8],
      "topics": [
        {"name": "Deployment", "subtopics": ["Deployment Models", "Machine Learning CI/CD Pipelines"]}
      ],
      "resource_generation_prompt": "Find resources explaining MLOps frameworks, model drift monitoring, and deploying ML models as scalable APIs via CI/CD pipelines.",
      "quiz_generation_prompt": "Generate 10 questions testing concepts like data drift, model registry management, and continuous training triggers in an MLOps pipeline.",
      "project_assessment_prompt": "Provide a scenario where a production model's accuracy rapidly degrades over two months. Ask the student to formulate an MLOps CI/CD intervention plan covering retraining and shadow deployment.",
      "max_regenerations": 3
    },
    {
      "stage_index": 10,
      "title": "Phase 10: AI Engineering",
      "prerequisites": [9],
      "topics": [
        {"name": "Working with LLMs", "subtopics": ["Prompt Engineering", "Large Language Models"]},
        {"name": "Advanced Implementations", "subtopics": ["RAG (Retrieval-Augmented Generation)", "Fine-tuning", "Autonomous AI Agents"]}
      ],
      "resource_generation_prompt": "Find the best technical tutorials explaining Prompt Engineering logic, vector databases for RAG, and fine-tuning open-source LLMs.",
      "quiz_generation_prompt": "Generate 10 demanding questions assessing the architecture of a RAG pipeline (document chunking, embeddings), hyperparameter tuning in LLMs, and agentic tool-use logic.",
      "project_assessment_prompt": "Instruct the student to design the system architecture for a legal document chatbot. They must detail the exact RAG process, from chunking strategy to the semantic vector search query process.",
      "max_regenerations": 3
    },
    {
      "stage_index": 11,
      "title": "Phase 11: Vibe Coding",
      "prerequisites": [10],
      "topics": [
        {"name": "AI Assistants", "subtopics": ["Vibe Coding Fundamentals", "AI Coding Assistants", "AI App Builders"]},
        {"name": "Agentic Coding", "subtopics": ["Claude Code", "Agentic Coding Handbook"]}
      ],
      "resource_generation_prompt": "Find 5 modern instructional resources demonstrating 'Vibe Coding', integrating Claude Code/Agentic handbooks into workflows, and rapidly prototyping via AI App Builders.",
      "quiz_generation_prompt": "Generate 10 questions on effectively steering AI coding assistants to prevent hallucination, establishing testing loops within AI workflows, and iterative prompting.",
      "project_assessment_prompt": "Provide a scenario where an engineer must build an internal data dashboard in 2 days. The student must write an exact workflow and meta-prompt sequence for their AI Assistant to structure the app securely.",
      "max_regenerations": 3
    },
    {
      "stage_index": 12,
      "title": "Phase 12: Real-World Application & Sharing Insights",
      "prerequisites": [11],
      "topics": [
        {"name": "Sharing Insights", "subtopics": ["Explaining complex algorithms", "Data Storytelling", "Visualizations"]},
        {"name": "Building a Portfolio & Experience", "subtopics": ["Solving real-world problems", "Internships", "Entry-level roles"]}
      ],
      "resource_generation_prompt": "Find top resources on Data Storytelling, effectively summarizing ML insights for non-technical business leaders, and strategies for building a standout Data Science portfolio.",
      "quiz_generation_prompt": "Generate 10 scenario-based questions evaluating the student's ability to simplify 'black box' AI explanations into business value (ROI) without using complex jargon.",
      "project_assessment_prompt": "Provide a complex confusion matrix showing high recall but low precision. The student must write a brief, non-technical email to the CEO explaining what this means financially for the company and recommending an action.",
      "max_regenerations": 3
    }
  ]
}

db.global_learning_pathways.update_one(
    {"_id": aids_pathway["_id"]},
    {"$set": aids_pathway},
    upsert=True
)

print("✅ Successfully seeded the AI & Data Science Developer pathway to MongoDB!")
