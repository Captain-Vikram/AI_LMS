import os
from pymongo import MongoClient

def get_mongo_url():
    return os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")


def get_db_name():
    return os.getenv("MONGO_DB_NAME", "quasar")

client = MongoClient(get_mongo_url())
db = client[get_db_name()]

sys_arch_pathway = {
  "_id": "pathway_system_architecture",
  "title": "System Architecture Masterclass",
  "description": "Transitions you from writing functional code to designing, scaling, and managing massive, fault-tolerant distributed systems.",
  "badges": [
    {"stage_index": 1, "badge_name": "CAP Theorist", "trigger": "completion"},
    {"stage_index": 4, "badge_name": "Data Scaler", "trigger": "completion"},
    {"stage_index": 9, "badge_name": "Chief Architect", "trigger": "completion"}
  ],
  "stages": [
    {
      "stage_index": 1,
      "title": "Phase 1: Core Fundamentals & The CAP Theorem",
      "prerequisites": [],
      "topics": [
        {"name": "The Basics", "subtopics": ["Application Architecture", "Solution Architecture", "Enterprise Architecture"]},
        {"name": "System Metrics", "subtopics": ["Performance vs. Scalability", "Latency vs. Throughput"]},
        {"name": "The CAP Theorem", "subtopics": ["Consistency (Strong, Eventual, Weak)", "Availability (Fail-Over, Active-Active)"]}
      ],
      "resource_generation_prompt": "Find top 5 articles and 5 videos explaining the CAP theorem, system metrics (Performance vs Scalability), and the difference between Application and Enterprise architecture.",
      "quiz_generation_prompt": "Generate 10 multiple-choice questions testing the differences between Eventual and Strong consistency, and Latency vs Throughput tradeoffs.",
      "project_assessment_prompt": "Provide a scenario of a banking app and a social media feed. Ask the student to apply the CAP theorem to justify whether each app should prioritize Availability or Consistency, and map out the required fail-over strategy.",
      "max_regenerations": 3
    },
    {
      "stage_index": 2,
      "title": "Phase 2: High-Level Architectural Patterns",
      "prerequisites": [1],
      "topics": [
        {"name": "Architectural Styles", "subtopics": ["Monoliths", "Layered architectures", "Client/Server", "Microservices", "Serverless"]},
        {"name": "Design Principles", "subtopics": ["OOP", "SOLID principles", "TDD", "Domain-Driven Design (DDD)"]},
        {"name": "Advanced Patterns", "subtopics": ["CQRS", "MVC/MVVM"]}
      ],
      "resource_generation_prompt": "Find top 5 articles and videos breaking down Monoliths vs Microservices, CQRS patterns, and SOLID design principles in software architecture.",
      "quiz_generation_prompt": "Generate 10 advanced multiple-choice questions assessing knowledge of CQRS, DDD context boundaries, and when to use Microservices vs Monoliths.",
      "project_assessment_prompt": "Ask the student to design a high-level component diagram migrating a monolithic e-commerce application to microservices using Domain-Driven Design principles.",
      "max_regenerations": 3
    },
    {
      "stage_index": 3,
      "title": "Phase 3: Network Infrastructure & Traffic Routing",
      "prerequisites": [2],
      "topics": [
        {"name": "DNS & CDNs", "subtopics": ["Domain Name System", "Push vs. Pull CDNs", "Caching static assets globally"]},
        {"name": "Load Balancing", "subtopics": ["Layer 4 vs Layer 7", "Balancing Algorithms", "Reverse Proxies"]}
      ],
      "resource_generation_prompt": "Find top networking resources covering DNS resolution, CDN caching strategies, and practical explanations of Layer 4 vs Layer 7 Load Balancing.",
      "quiz_generation_prompt": "Generate 10 questions on DNS propagation, reverse proxy setups, and algorithms used by load balancers like Round Robin and Least Connections.",
      "project_assessment_prompt": "Design a load-balancing strategy for a global video streaming platform. The answer should map out the CDN integration and explain where reverse proxies and layer 7 load balancers fit in the pipeline.",
      "max_regenerations": 3
    },
    {
      "stage_index": 4,
      "title": "Phase 4: Data Storage, Scaling, & Big Data",
      "prerequisites": [3],
      "topics": [
        {"name": "Databases", "subtopics": ["RDBMS (SQL)", "NoSQL (Key-Value, Document, Wide Column, Graph)"]},
        {"name": "Scaling Databases", "subtopics": ["Sharding", "Federation", "Denormalization", "Data Replication"]},
        {"name": "Big Data & Analytics", "subtopics": ["Hadoop", "Apache Spark", "MapReduce", "ETL processes"]}
      ],
      "resource_generation_prompt": "Find 5 articles and 5 videos on SQL vs NoSQL, Database Sharding, Replication strategies (Master-Slave/Master-Master), and ETL pipelines.",
      "quiz_generation_prompt": "Generate 10 challenging multiple-choice questions on handling massive data sets, focusing on Sharding keys, Graph database use-cases, and MapReduce flows.",
      "project_assessment_prompt": "Provide a scenario where a rapidly growing blogging platform's single SQL database is freezing under read-heavy loads. Ask the student to design a scalable architecture using Read Replicas and Sharding.",
      "max_regenerations": 3
    },
    {
      "stage_index": 5,
      "title": "Phase 5: Caching & Asynchronism",
      "prerequisites": [4],
      "topics": [
        {"name": "Caching Strategies", "subtopics": ["Cache-Aside", "Write-Through", "Write-Behind", "Refresh-Ahead"]},
        {"name": "Asynchronous Processing", "subtopics": ["Task Queues", "Message Queues (RabbitMQ, Kafka)", "Back Pressure"]}
      ],
      "resource_generation_prompt": "Find best resources explaining different Caching Strategies (Cache-Aside, Write-Through) and Message Queues (Kafka vs RabbitMQ) for handling asynchronous tasks.",
      "quiz_generation_prompt": "Generate 10 questions evaluating when to use a Task Queue, differences between Kafka and RabbitMQ, and the lifecycle of a Cache-Aside pattern.",
      "project_assessment_prompt": "Present an architecture for an email notification system that currently crashes during traffic spikes. The student must redesign it using asynchronous Message Queues with a back pressure mechanism.",
      "max_regenerations": 3
    },
    {
      "stage_index": 6,
      "title": "Phase 6: System Communication & APIs",
      "prerequisites": [5],
      "topics": [
        {"name": "Protocols", "subtopics": ["HTTP", "TCP", "UDP"]},
        {"name": "APIs and Integration", "subtopics": ["REST", "GraphQL", "gRPC", "SOAP/ESB"]}
      ],
      "resource_generation_prompt": "Find 5 articles and 5 videos on API design, specifically comparing REST vs GraphQL vs gRPC, and underlying protocols like TCP and UDP.",
      "quiz_generation_prompt": "Generate 10 questions testing the differences between UDP and TCP packet delivery, REST statelessness, and GraphQL query advantages over REST.",
      "project_assessment_prompt": "Ask the student to define the API contract for a real-time multiplayer game. They must justify whether to use WebSockets, gRPC, or UDP for in-game movement data versus user profiles.",
      "max_regenerations": 3
    },
    {
      "stage_index": 7,
      "title": "Phase 7: Security & System Hardening",
      "prerequisites": [6],
      "topics": [
        {"name": "Security Implementations", "subtopics": ["Public Key Infrastructure (PKI)", "Hashing Algorithms", "Authentication Strategies", "OWASP vulnerabilities"]}
      ],
      "resource_generation_prompt": "Find top resources on OWASP top 10 vulnerabilities, PKI, and robust authentication strategy patterns (OAuth, JWT).",
      "quiz_generation_prompt": "Generate 10 critical multiple-choice questions covering CSRF/XSS, JWT lifecycle management, and PKI certificate validation.",
      "project_assessment_prompt": "Give a scenario of an API relying solely on basic auth without HTTPS. The student must draft a security hardening proposal encompassing TLS, JWT implementation, and OWASP protections.",
      "max_regenerations": 3
    },
    {
      "stage_index": 8,
      "title": "Phase 8: Operations, Monitoring, & Antipatterns",
      "prerequisites": [7],
      "topics": [
        {"name": "Observability", "subtopics": ["Health", "Availability", "Performance", "Security", "Usage monitoring"]},
        {"name": "Performance Antipatterns", "subtopics": ["Noisy Neighbor", "Busy Database", "Chatty I/O", "Synchronous I/O"]}
      ],
      "resource_generation_prompt": "Find 5 articles and 5 videos on cloud observability telemetry, plus explanations of system antipatterns like 'Noisy Neighbor' and 'Chatty I/O'.",
      "quiz_generation_prompt": "Generate 10 questions testing knowledge on setting up observability metrics and diagnosing the root causes for 'Chatty I/O' or 'Busy Database' antipatterns.",
      "project_assessment_prompt": "Provide a hypothetical system dashboard showing a sudden spike in latency. The student must write an incident response plan to determine if it is a 'Noisy Neighbor' or 'Synchronous I/O' block.",
      "max_regenerations": 3
    },
    {
      "stage_index": 9,
      "title": "Phase 9: The Architect's Role & Soft Skills",
      "prerequisites": [8],
      "topics": [
        {"name": "Leadership Responsibilities", "subtopics": ["Requirements elicitation", "Technical documentation", "Enforcing standards", "Final technical decisions"]},
        {"name": "Soft Skills", "subtopics": ["Simplifying complex concepts", "Project estimation", "Stakeholder communication", "Developer coaching"]}
      ],
      "resource_generation_prompt": "Find top resources on leadership for technical architects, focusing on stakeholder communication, requirements elicitation, and coaching developers.",
      "quiz_generation_prompt": "Generate 10 scenario-based questions focusing on conflict resolution, timeline estimation strategies, and navigating ambiguous business requirements.",
      "project_assessment_prompt": "Present a conflict where business stakeholders demand an impossible timeline for an architecture overhaul. The student must draft a response demonstrating how to simplify the technical realities, offer a phased MVP approach, and coach the dev team.",
      "max_regenerations": 3
    }
  ]
}

db.global_learning_pathways.update_one(
    {"_id": sys_arch_pathway["_id"]},
    {"$set": sys_arch_pathway},
    upsert=True
)

print("✅ Successfully seeded the System Architecture pathway to 'global_learning_pathways' collection!")
