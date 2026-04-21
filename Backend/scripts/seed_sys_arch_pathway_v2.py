import os
from pymongo import MongoClient

def get_mongo_url():
    return os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")


def get_db_name():
    return os.getenv("MONGO_DB_NAME", "quasar")

client = MongoClient(get_mongo_url())
db = client[get_db_name()]

sys_arch_pathway_v2 = {
  "_id": "pathway_system_architecture",
  "title": "System Architecture Engineer Masterclass",
  "description": "Transition your mindset from merely writing code to designing, scaling, and managing massive, fault-tolerant distributed systems.",
  "badges": [
    {"stage_index": 2, "badge_name": "CAP Theorist", "trigger": "completion"},
    {"stage_index": 5, "badge_name": "Data Scaler", "trigger": "completion"},
    {"stage_index": 10, "badge_name": "Chief Architect", "trigger": "completion"}
  ],
  "stages": [
    {
      "stage_index": 1,
      "title": "Phase 1: Understanding the Architect Role & Baseline Concepts",
      "prerequisites": [],
      "topics": [
        {"name": "Architecture Scales", "subtopics": ["Application Architecture", "Solution Architecture", "Enterprise Architecture"]},
        {"name": "Core Responsibilities", "subtopics": ["Requirements Elicitation", "Technical Documentation", "Enforcing Standards", "Tech Decision Making"]}
      ],
      "resource_generation_prompt": "Find 5 top articles and 5 videos explaining the differences between Application, Solution, and Enterprise Architects, as well as their core responsibilities in technical documentation and standard enforcement.",
      "quiz_generation_prompt": "Generate 10 questions testing the scope of a Solution Architect versus an Enterprise Architect, and best practices for technical documentation.",
      "project_assessment_prompt": "Provide a scenario where a startup is expanding to a multi-product enterprise. Ask the student to outline the responsibilities of the newly hired Enterprise Architect, detailing how they should enforce engineering standards.",
      "max_regenerations": 3
    },
    {
      "stage_index": 2,
      "title": "Phase 2: System Design Principles & The CAP Theorem",
      "prerequisites": [1],
      "topics": [
        {"name": "System Metrics", "subtopics": ["Performance vs. Scalability", "Latency vs. Throughput"]},
        {"name": "The CAP Theorem", "subtopics": ["Consistency (Weak, Eventual, Strong)", "Availability (Fail-Over, Active-Active)"]}
      ],
      "resource_generation_prompt": "Find top resources explaining system metrics (Latency vs Throughput) and deep dives into the CAP theorem and Eventual Consistency.",
      "quiz_generation_prompt": "Generate 10 multiple-choice questions assessing the tradeoffs between Eventual and Strong consistency, and when to prioritize Scalability over Performance.",
      "project_assessment_prompt": "Present a healthcare banking application and a global chat app. Ask the student to apply the CAP theorem to justify whether each should favor Availability or Consistency.",
      "max_regenerations": 3
    },
    {
      "stage_index": 3,
      "title": "Phase 3: High-Level Architectural Patterns",
      "prerequisites": [2],
      "topics": [
        {"name": "Architectural Styles", "subtopics": ["Monoliths", "Distributed Systems", "Microservices", "Serverless", "SOA"]},
        {"name": "Design Principles", "subtopics": ["Domain-Driven Design (DDD)", "Test-Driven Development (TDD)", "SOLID principles", "CQRS"]}
      ],
      "resource_generation_prompt": "Find 5 articles and 5 videos detailing the transition from Monoliths to Microservices, and the fundamentals of CQRS and Domain-Driven Design.",
      "quiz_generation_prompt": "Generate 10 questions evaluating when a monolith is superior to microservices, and how CQRS segregates read/write operations.",
      "project_assessment_prompt": "Ask the student to architect the migration of a legacy monolithic online store into microservices, defining the bounded contexts using DDD.",
      "max_regenerations": 3
    },
    {
      "stage_index": 4,
      "title": "Phase 4: Network Infrastructure & Traffic Routing",
      "prerequisites": [3],
      "topics": [
        {"name": "Networking Basics", "subtopics": ["OSI and TCP/IP models", "HTTP/HTTPS", "Firewalls", "Proxies", "DNS", "Push vs. Pull CDNs"]},
        {"name": "Load Balancing", "subtopics": ["Layer 4 vs. Layer 7", "Balancing Algorithms", "Reverse Proxies"]}
      ],
      "resource_generation_prompt": "Find top resources explaining the OSI model, DNS resolution, Reverse Proxies, and Layer 4 vs Layer 7 load balancing.",
      "quiz_generation_prompt": "Generate 10 questions testing the difference between a forward and reverse proxy, CDN push/pull mechanisms, and OSI Layer 7 inspection.",
      "project_assessment_prompt": "Design a global routing strategy for a streaming platform focusing on CDN cache mechanisms, DNS georouting, and Layer 7 load balancing.",
      "max_regenerations": 3
    },
    {
      "stage_index": 5,
      "title": "Phase 5: Data Storage, Scaling, & Big Data",
      "prerequisites": [4],
      "topics": [
        {"name": "Databases", "subtopics": ["RDBMS (SQL)", "NoSQL (Key-Value, Document, Wide Column, Graph)"]},
        {"name": "Scaling Databases", "subtopics": ["Database Replication (Master-Slave, Master-Master)", "Sharding", "Federation", "Denormalization", "SQL Tuning"]},
        {"name": "Big Data", "subtopics": ["Hadoop", "Apache Spark", "MapReduce", "ETL processes", "Datawarehouses"]}
      ],
      "resource_generation_prompt": "Find best tutorials on Master-Master DB replication, Database Sharding strategies, and Apache Spark/ETL pipelines.",
      "quiz_generation_prompt": "Generate 10 challenging questions on SQL query tuning, Sharding strategies, and the MapReduce programming model.",
      "project_assessment_prompt": "Present a scenario of a social network user table exceeding 100 million rows. Ask the student to design a horizontal scaling solution using Sharding and Master-Slave replication.",
      "max_regenerations": 3
    },
    {
      "stage_index": 6,
      "title": "Phase 6: Caching & Asynchronism",
      "prerequisites": [5],
      "topics": [
        {"name": "Caching", "subtopics": ["Cache-Aside", "Write-Through", "Write-Behind", "Refresh-Ahead"]},
        {"name": "Asynchronism", "subtopics": ["Task Queues", "Message Queues (RabbitMQ, Kafka)", "Background Jobs", "Back Pressure"]}
      ],
      "resource_generation_prompt": "Find top 5 articles and 5 videos explaining caching invalidation strategies (Write-Through vs Cache-Aside) and Kafka vs RabbitMQ message brokers.",
      "quiz_generation_prompt": "Generate 10 questions testing the lifecycle of a Write-Behind cache and the publish-subscribe pattern in Kafka.",
      "project_assessment_prompt": "Ask the student to re-architect a video rendering application to be fully asynchronous, utilizing a message broker for tasks and a Cache-Aside pattern for metadata.",
      "max_regenerations": 3
    },
    {
      "stage_index": 7,
      "title": "Phase 7: System Communication & APIs",
      "prerequisites": [6],
      "topics": [
        {"name": "Protocols", "subtopics": ["TCP", "UDP", "RPC"]},
        {"name": "APIs", "subtopics": ["REST", "GraphQL", "gRPC", "ESB/SOAP"]}
      ],
      "resource_generation_prompt": "Find resources exclusively comparing REST vs GraphQL, gRPC architecture, and RPC over TCP vs UDP.",
      "quiz_generation_prompt": "Generate 10 technical questions specifying when to use UDP over TCP, and the payload advantages of Protocol Buffers in gRPC vs JSON in REST.",
      "project_assessment_prompt": "Provide a scenario involving an IoT dashboard and a mobile client app. Ask the student to specify and justify their API protocol choices (e.g., MQTT, GraphQL, REST).",
      "max_regenerations": 3
    },
    {
      "stage_index": 8,
      "title": "Phase 8: Operations, Security, & Monitoring",
      "prerequisites": [7],
      "topics": [
        {"name": "Security", "subtopics": ["PKI", "Hashing", "Authentication", "OWASP vulnerabilities"]},
        {"name": "Operations", "subtopics": ["Infrastructure as Code (IaC)", "Containers", "CI/CD", "Service Mesh", "Cloud Providers"]},
        {"name": "Observability", "subtopics": ["Health", "Availability", "Performance", "Security", "Usage monitoring"]}
      ],
      "resource_generation_prompt": "Find 5 articles and videos on Infrastructure as Code (Terraform), CI/CD pipelines, Service Meshes, and OWASP top 10.",
      "quiz_generation_prompt": "Generate 10 questions on the benefits of a Service Mesh, defining IaC state, and protecting against CSRF/XSS vulnerabilities.",
      "project_assessment_prompt": "Ask the student to draft a deployment architecture using Docker, CI/CD, and a Service Mesh that ensures zero-downtime updates and monitors telemetry.",
      "max_regenerations": 3
    },
    {
      "stage_index": 9,
      "title": "Phase 9: Recognizing Performance Antipatterns",
      "prerequisites": [8],
      "topics": [
        {"name": "Antipatterns", "subtopics": ["Noisy Neighbor", "Busy Database", "Chatty I/O", "Retry Storm", "Synchronous I/O"]}
      ],
      "resource_generation_prompt": "Find articles and videos deeply analyzing architectural antipatterns like Retry Storms, Chatty I/O, and the Noisy Neighbor effect in the cloud.",
      "quiz_generation_prompt": "Generate 10 scenario-based questions diagnosing a Retry Storm collapse and the latency effects of Chatty I/O.",
      "project_assessment_prompt": "Provide a system log showing exponential failing requests taking down a microservice. Ask the student to diagnose a Retry Storm and implement a Circuit Breaker and Exponential Backoff fix.",
      "max_regenerations": 3
    },
    {
      "stage_index": 10,
      "title": "Phase 10: Management, Frameworks & Soft Skills",
      "prerequisites": [9],
      "topics": [
        {"name": "Frameworks", "subtopics": ["TOGAF", "BABOK", "UML", "SaFE", "Scrum"]},
        {"name": "Soft Skills", "subtopics": ["Timeline estimation", "Stakeholder communication", "Developer coaching"]}
      ],
      "resource_generation_prompt": "Find resources explaining enterprise frameworks like TOGAF, and leadership soft skills regarding developer coaching and stakeholder management.",
      "quiz_generation_prompt": "Generate 10 questions on the pillars of TOGAF and Agile timeline estimation techniques.",
      "project_assessment_prompt": "Provide a scenario where product managers demand a major feature in 2 weeks while technical debt is alarming. Ask the student to formulate an architectural compromise communicating risk and negotiating phased deliverables.",
      "max_regenerations": 3
    }
  ]
}

db.global_learning_pathways.update_one(
    {"_id": sys_arch_pathway_v2["_id"]},
    {"$set": sys_arch_pathway_v2},
    upsert=True
)

print("✅ Successfully synchronized the System Architecture pathway (10 Phases) to MongoDB!")
