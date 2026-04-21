import os
import sys
from pymongo import MongoClient

def get_mongo_url():
    # Attempting to load from .env or using default
  return os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")


def get_db_name():
    return os.getenv("MONGO_DB_NAME", "quasar")

client = MongoClient(get_mongo_url())
db = client[get_db_name()]

ml_pathway = {
  "_id": "pathway_machine_learning",
  "title": "Machine Learning Masterclass",
  "description": "Transitions you from foundational mathematics to advanced deep learning architectures.",
  "badges": [
    {"stage_index": 1, "badge_name": "Math Whiz", "trigger": "completion"},
    {"stage_index": 3, "badge_name": "Data Wrangler", "trigger": "completion"},
    {"stage_index": 6, "badge_name": "Deep Learning Initiate", "trigger": "completion"}
  ],
  "stages": [
    {
      "stage_index": 1,
      "title": "Phase 1: Mathematical Foundations",
      "prerequisites": [],
      "topics": [
        {
          "name": "Linear Algebra", 
          "subtopics": ["Scalars, Vectors, Tensors", "Matrix Operations", "Singular Value Decomposition"]
        },
        {
          "name": "Calculus", 
          "subtopics": ["Derivatives", "Partial Derivatives", "Gradient, Jacobian, Hessian", "Chain Rule"]
        },
        {
          "name": "Statistics", 
          "subtopics": ["Descriptive Statistics", "Inferential Statistics", "Probability Distributions", "Bayes Theorem"]
        },
        {
          "name": "Discrete Mathematics", 
          "subtopics": ["Discrete Structures"]
        }
      ],
      "resource_generation_prompt": "Find top 5 articles and 5 videos explaining Linear Algebra (Tensors, Matrices), Calculus (Gradients, Chain Rule), Statistics (Bayes Theorem, Distributions), and Discrete Math specifically tailored for machine learning beginners building mathematical foundations.",
      "quiz_generation_prompt": "Generate 10 advanced multiple-choice questions focusing on mathematical applications in ML, specifically focusing on partial derivatives, probability distributions, matrix operations, and eigenvalues.",
      "project_assessment_prompt": None,
      "max_regenerations": 3
    },
    {
      "stage_index": 2,
      "title": "Phase 2: Programming Fundamentals (Python)",
      "prerequisites": [1],
      "topics": [
        {
          "name": "Python Basics", 
          "subtopics": ["Core Syntax", "Data Types", "Loops & Conditionals", "Functions", "Object Oriented Programming (OOP)"]
        },
        {
          "name": "Essential Libraries", 
          "subtopics": ["Numpy", "Pandas", "Matplotlib", "Seaborn"]
        }
      ],
      "resource_generation_prompt": "Find top interactive tutorials and videos for learning Python OOP, loops, conditionals, and data manipulation/visualization with Numpy, Pandas, Matplotlib and Seaborn.",
      "quiz_generation_prompt": "Generate 10 multiple-choice questions on Python data structures, vector operations in Numpy, and Pandas dataframe operations.",
      "project_assessment_prompt": "Generate a hands-on coding task where the user must load a raw dataset using Pandas, clean it using loops/conditionals, perform basic group-by operations, and plot a distribution chart using Seaborn.",
      "max_regenerations": 3
    },
    {
      "stage_index": 3,
      "title": "Phase 3: Data Collection & Cleaning",
      "prerequisites": [1, 2],
      "topics": [
        {
          "name": "Data Collection", 
          "subtopics": ["SQL/NoSQL databases", "APIs", "Web data formats (JSON, CSV, Excel, Parquet)", "IoT devices"]
        },
        {
          "name": "Data Cleaning", 
          "subtopics": ["Preprocessing Techniques", "Dimensionality Reduction"]
        },
        {
          "name": "Feature Engineering", 
          "subtopics": ["Feature Selection", "Feature Scaling", "Normalization"]
        }
      ],
      "resource_generation_prompt": "Find top 5 practical videos and 5 articles on data scraping from APIs/SQL, feature scaling, normalization techniques, and handling missing data in Python.",
      "quiz_generation_prompt": "Generate 10 challenging questions about the differences between data formats (JSON vs Parquet), SQL querying principles, and the math behind dimensionality reduction or scaling techniques.",
      "project_assessment_prompt": "Create a scenario where the user receives a dirty CSV file and an API endpoint. Ask them to write a Python script that merges data from both sources, removes null values, scales numerical features using Min-Max Normalization, and exports the clean data to a Parquet file.",
      "max_regenerations": 3
    },
    {
      "stage_index": 4,
      "title": "Phase 4: Core Machine Learning Algorithms",
      "prerequisites": [3],
      "topics": [
        {
          "name": "Supervised Learning", 
          "subtopics": ["Logistic Regression", "Support Vector Machines (SVM)", "K-Nearest Neighbors (KNN)", "Decision Trees", "Random Forests", "Gradient Boosting Machines", "Linear and Polynomial Regression"]
        },
        {
          "name": "Unsupervised Learning", 
          "subtopics": ["Clustering (Hierarchical, Exclusive, Probabilistic)", "Principal Component Analysis (PCA)"]
        },
        {
          "name": "Reinforcement Learning", 
          "subtopics": ["Policy Gradients", "Actor-Critic Methods", "Deep-Q Networks", "Q-Learning"]
        }
      ],
      "resource_generation_prompt": "Find top 5 articles and 5 videos explaining Supervised, Unsupervised, and Reinforcement ML models. Focus heavily on Decision Trees, Random Forests, SVMs, PCA, and Q-Learning.",
      "quiz_generation_prompt": "Generate 10 advanced multiple-choice questions assessing the student's ability to choose the correct model for a given dataset, covering PCA, SVM kernels, and Q-Learning updates.",
      "project_assessment_prompt": "Provide a classification problem dataset (e.g., Titanic or Iris). Ask the student to implement a Random Forest and an SVM classifier, compare their predictions, and explain the algorithmic differences.",
      "max_regenerations": 3
    },
    {
      "stage_index": 5,
      "title": "Phase 5: Model Evaluation & Validation",
      "prerequisites": [4],
      "topics": [
        {
          "name": "Evaluation Metrics", 
          "subtopics": ["Accuracy, Precision, Recall, F1-Score", "ROC-AUC", "Log Loss", "Confusion Matrices"]
        },
        {
          "name": "Validation Techniques", 
          "subtopics": ["K-Fold Cross Validation", "Leave-One-Out Cross-Validation (LOOCV)"]
        }
      ],
      "resource_generation_prompt": "Find top 5 practical guides and 5 video tutorials explaining Precision vs Recall tradeoffs, ROC-AUC curves, and implementing K-Fold Cross validation.",
      "quiz_generation_prompt": "Generate 10 scenario-based questions where the student must calculate Precision/Recall from a confusion matrix or identify why ROC-AUC is preferred over Accuracy for imbalanced datasets.",
      "project_assessment_prompt": "Ask the student to evaluate their previously built Random Forest model by generating a confusion matrix, plotting an ROC Curve, and performing 5-Fold Cross Validation using Scikit-learn.",
      "max_regenerations": 3
    },
    {
      "stage_index": 6,
      "title": "Phase 6: Deep Learning",
      "prerequisites": [4, 5],
      "topics": [
        {
          "name": "Neural Network Basics", 
          "subtopics": ["Perceptrons", "Multi-layer Perceptrons", "Forward/Backpropagation", "Loss Functions", "Activation Functions"]
        },
        {
          "name": "Deep Learning Architectures", 
          "subtopics": ["CNNs (Pooling, Padding, Strides)", "RNNs (GRU, LSTM)", "Attention Mechanisms", "Transformers", "Autoencoders", "GANs"]
        },
        {
          "name": "Libraries",
          "subtopics": ["TensorFlow", "Keras", "PyTorch"]
        }
      ],
      "resource_generation_prompt": "Find top 5 visual videos and 5 conceptual articles explaining Backpropagation calculus, CNN convolutions, LSTMs, Transformers, and building networks in PyTorch or TensorFlow.",
      "quiz_generation_prompt": "Generate 10 technical multiple-choice questions regarding vanishing gradients in RNNs, CNN stride calculations, and the mathematical difference between Softmax and ReLU.",
      "project_assessment_prompt": "Design a PyTorch or TensorFlow challenge where the user must construct a simple CNN to classify images from the MNIST or CIFAR-10 dataset, logging the training loss over 10 epochs.",
      "max_regenerations": 3
    },
    {
      "stage_index": 7,
      "title": "Phase 7: Advanced Concepts in ML",
      "prerequisites": [6],
      "topics": [
        {
          "name": "Natural Language Processing (NLP)", 
          "subtopics": ["Tokenization", "Lemmatization", "Stemming", "Embeddings"]
        },
        {
          "name": "Explainable AI", 
          "subtopics": ["Model Interpretability", "Black Box Decisions"]
        }
      ],
      "resource_generation_prompt": "Find 5 advanced articles and 5 lectures focusing heavily on NLP text embeddings (Word2Vec, BERT) and Explainable AI (SHAP, LIME).",
      "quiz_generation_prompt": "Generate 10 deep questions regarding Word Embeddings dimensions, the difference between Stemming and Lemmatization, and how SHAP values explain individual predictions.",
      "project_assessment_prompt": "Create an NLP task where the student must tokenize a text corpus, convert it to embeddings, run a simple sentiment analysis model, and then interpret a single prediction using SHAP or LIME.",
      "max_regenerations": 3
    }
  ]
}

# Upsert the document
db.global_learning_pathways.update_one(
    {"_id": ml_pathway["_id"]},
    {"$set": ml_pathway},
    upsert=True
)

print("✅ Successfully seeded the Machine Learning pathway to 'global_learning_pathways' collection!")
