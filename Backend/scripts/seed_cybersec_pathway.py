import os
from pymongo import MongoClient

def get_mongo_url():
    return os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")


def get_db_name():
    return os.getenv("MONGO_DB_NAME", "quasar")

client = MongoClient(get_mongo_url())
db = client[get_db_name()]

cybersec_pathway = {
  "_id": "pathway_cyber_security",
  "title": "Cyber Security Expert",
  "description": "Transitions you from basic IT knowledge to advanced threat management, cloud security, and incident response.",
  "badges": [
    {"stage_index": 3, "badge_name": "Cryptography Initiate", "trigger": "completion"},
    {"stage_index": 5, "badge_name": "Threat Hunter", "trigger": "completion"},
    {"stage_index": 10, "badge_name": "Cyber Sentinel", "trigger": "completion"}
  ],
  "stages": [
    {
      "stage_index": 1,
      "title": "Phase 1: Fundamental IT Skills & Operating Systems",
      "prerequisites": [],
      "topics": [
        {"name": "IT Fundamentals", "subtopics": ["Hardware Components", "Computer Networking (WiFi, Bluetooth)"]},
        {"name": "Operating Systems", "subtopics": ["Windows Admin", "Linux Admin", "MacOS", "GUI vs CLI", "File Permissions", "CRUD operations"]}
      ],
      "resource_generation_prompt": "Find top resources and tutorials explaining basic computer networking hardware, Linux CLI navigation, and Windows file permission structures for beginners.",
      "quiz_generation_prompt": "Generate 10 beginner multiple-choice questions assessing knowledge on OS file permissions, CLI commands, and fundamental networking hardware.",
      "project_assessment_prompt": "Provide a scenario where the student must write a bash script to perform basic CRUD operations securely on a Linux server, setting appropriate user and group permissions.",
      "max_regenerations": 3
    },
    {
      "stage_index": 2,
      "title": "Phase 2: Deep Networking Knowledge",
      "prerequisites": [1],
      "topics": [
        {"name": "Concepts & Topologies", "subtopics": ["OSI Model", "Network Topologies", "VLAN", "DMZ", "ARP", "DHCP", "DNS"]},
        {"name": "Protocols & IP", "subtopics": ["HTTP/HTTPS", "SSL/TLS", "SSH", "FTP", "Subnets", "CIDR"]},
        {"name": "Virtualization", "subtopics": ["VMWare", "VirtualBox", "Hypervisors"]},
        {"name": "Troubleshooting Tools", "subtopics": ["nmap", "wireshark", "tcpdump", "ping", "netstat", "Packet Sniffers"]}
      ],
      "resource_generation_prompt": "Find 5 top practical guides and 5 videos teaching the OSI Model, Subnetting/CIDR, and hands-on traffic analysis using Wireshark and Nmap.",
      "quiz_generation_prompt": "Generate 10 rigorous questions on OSI layer protocols, CIDR notation calculation, and diagnosing network issues with ARP and DNS.",
      "project_assessment_prompt": "Provide a hypothetical pcap (packet capture) layout. Ask the student to identify a suspicious lateral movement pattern using Wireshark display filters and TCP flags.",
      "max_regenerations": 3
    },
    {
      "stage_index": 3,
      "title": "Phase 3: Core Security Concepts & Cryptography",
      "prerequisites": [2],
      "topics": [
        {"name": "Foundations", "subtopics": ["CIA Triad", "Cyber Kill Chain", "Defense in Depth", "Authentication vs Authorization"]},
        {"name": "Team Dynamics", "subtopics": ["Blue Defense", "Red Offense", "Purple Teams", "Penetration Testing"]},
        {"name": "Cryptography", "subtopics": ["Salting", "Hashing", "PKI", "Symmetric vs Asymmetric Keys"]}
      ],
      "resource_generation_prompt": "Find top conceptual videos and articles explaining the CIA Triad, Red/Blue team dynamics, and the math/logic behind Asymmetric Cryptography and PKI.",
      "quiz_generation_prompt": "Generate 10 highly specific questions testing the difference between Authentication and Authorization, the stages of the Cyber Kill Chain, and hashing mechanisms.",
      "project_assessment_prompt": "Present an architecture that transmits passwords in plain text. Instruct the student to implement a secure hashing strategy using salting and explain how Public Key Infrastructure would further secure the transport layer.",
      "max_regenerations": 3
    },
    {
      "stage_index": 4,
      "title": "Phase 4: Threat Intelligence & Frameworks",
      "prerequisites": [3],
      "topics": [
        {"name": "Frameworks", "subtopics": ["MITRE ATT&CK", "ISO", "NIST", "CIS", "Diamond Model"]},
        {"name": "Security Operations", "subtopics": ["SIEM", "SOAR"]}
      ],
      "resource_generation_prompt": "Find 5 exhaustive articles and 5 videos thoroughly breaking down the MITRE ATT&CK framework, NIST principles, and how SIEM/SOAR platforms automate threat response.",
      "quiz_generation_prompt": "Generate 10 questions testing the student's ability to map adversarial behaviors to MITRE ATT&CK tactics, and the operational differences between a SIEM and SOAR.",
      "project_assessment_prompt": "Provide a scenario of a detected malware beacon. Ask the student to map the attack lifecycle using the Diamond Model and propose an automated response rule in a SOAR platform.",
      "max_regenerations": 3
    },
    {
      "stage_index": 5,
      "title": "Phase 5: Attack Types, Vulnerabilities & Malware",
      "prerequisites": [4],
      "topics": [
        {"name": "Social Engineering", "subtopics": ["Phishing", "Whaling", "Tailgating", "Dumpster Diving"]},
        {"name": "Network & Web Attacks", "subtopics": ["DDoS", "MITM", "DNS Poisoning", "SQL Injection", "XSS", "CSRF", "Buffer Overflows"]},
        {"name": "Threat Classification", "subtopics": ["Zero-Day", "Advanced Persistent Threats (APTs)", "OWASP Top 10"]}
      ],
      "resource_generation_prompt": "Find practical hacking demonstrations and articles explaining SQL Injection, Cross-Site Scripting (XSS), Buffer Overflows, and Advanced Persistent Threats.",
      "quiz_generation_prompt": "Generate 10 scenario-based questions diagnosing whether an attack is XSS or CSRF, how a Buffer Overflow corrupts memory, and identifying whaling attempts.",
      "project_assessment_prompt": "Provide a vulnerable web application snippet written in PHP/SQL. Ask the student to identify the SQL injection flaw and rewrite the code using prepared statements to sanitize inputs.",
      "max_regenerations": 3
    },
    {
      "stage_index": 6,
      "title": "Phase 6: System Hardening & Endpoint Security",
      "prerequisites": [5],
      "topics": [
        {"name": "Hardening", "subtopics": ["Port Blocking", "Group Policies", "ACLs", "Patching", "Jump Servers"]},
        {"name": "Endpoint Defense", "subtopics": ["Antivirus", "EDR", "DLP", "Firewalls (HIPS/NIDS/NIPS)"]},
        {"name": "Secure Protocols", "subtopics": ["SFTP", "TLS", "IPSEC", "DNSSEC"]}
      ],
      "resource_generation_prompt": "Find top resources detailing Enterprise System Hardening via Active Directory Group Policies, EDR deployments, and migrating to secure protocols like IPSEC and DNSSEC.",
      "quiz_generation_prompt": "Generate 10 questions evaluating knowledge of ACL configuration, NIDS vs HIPS deployment, and when to enforce a Jump Server.",
      "project_assessment_prompt": "Provide a mock enterprise network layout currently utilizing FTP and HTTP. Have the student draft a hardening proposal implementing TLS, SFTP, and Endpoint Detection and Response limits.",
      "max_regenerations": 3
    },
    {
      "stage_index": 7,
      "title": "Phase 7: Incident Response & Forensics",
      "prerequisites": [6],
      "topics": [
        {"name": "Incident Response Process", "subtopics": ["Preparation", "Identification", "Containment", "Eradication", "Recovery", "Lessons Learned"]},
        {"name": "Log Analysis", "subtopics": ["Event Logs", "syslogs", "netflow", "Firewall Logs"]},
        {"name": "Forensic Tools", "subtopics": ["FTK Imager", "autopsy", "winhex", "memdump"]}
      ],
      "resource_generation_prompt": "Find 5 tutorials and 5 demonstrations covering the Incident Response lifecycle, reading Windows Event Logs, and fundamental memory analysis with FTK Imager.",
      "quiz_generation_prompt": "Generate 10 questions testing the chronological steps of incident response and the critical artifacts extracted from syslogs and volatile memory dumps.",
      "project_assessment_prompt": "Present an ongoing ransomware attack scenario. Ask the student to outline an immediate incident response plan strictly following the Containment, Eradication, and Recovery phases.",
      "max_regenerations": 3
    },
    {
      "stage_index": 8,
      "title": "Phase 8: Cloud Security",
      "prerequisites": [7],
      "topics": [
        {"name": "Cloud Concepts", "subtopics": ["Public/Private/Hybrid Cloud", "IaaS PaaS SaaS (Models)"]},
        {"name": "Cloud Providers", "subtopics": ["AWS", "GCP", "Azure", "Infrastructure as Code Security"]}
      ],
      "resource_generation_prompt": "Find top resources explaining the IAM (Identity and Access Management) models in AWS/Azure, and securing Infrastructure as Code deployments.",
      "quiz_generation_prompt": "Generate 10 questions assessing the shared responsibility model between cloud providers and tenants, specifically comparing IaaS and SaaS risks.",
      "project_assessment_prompt": "Ask the student to audit an AWS S3 bucket configuration policy and apply least-privilege IAM roles to prevent public data exposure.",
      "max_regenerations": 3
    },
    {
      "stage_index": 9,
      "title": "Phase 9: Programming & Automation",
      "prerequisites": [8],
      "topics": [
        {"name": "Programming Languages", "subtopics": ["Python", "Go", "JavaScript", "C++"]},
        {"name": "Scripting", "subtopics": ["Bash", "PowerShell"]}
      ],
      "resource_generation_prompt": "Find resources demonstrating Python for Cybersecurity, Bash scripting for automation, and PowerShell for red-teaming/blue-teaming.",
      "quiz_generation_prompt": "Generate 10 applied questions on Python scripting for socket connections, identifying malicious PowerShell one-liners, and Bash string manipulation.",
      "project_assessment_prompt": "Provide a scenario where log files must be parsed daily for failed login attempts. Ask the student to write a Python or Bash script that searches for these indicators and alerts an admin.",
      "max_regenerations": 3
    },
    {
      "stage_index": 10,
      "title": "Phase 10: Practical CTFs and Certifications",
      "prerequisites": [9],
      "topics": [
        {"name": "CTFs", "subtopics": ["HackTheBox", "TryHackMe", "VulnHub", "picoCTF"]},
        {"name": "Certifications", "subtopics": ["CompTIA Security+", "CISSP", "OSCP", "CEH", "CISM"]}
      ],
      "resource_generation_prompt": "Find comprehensive roadmaps and methodologies for passing the OSCP and CISSP, alongside beginner-friendly CTF walkthroughs on TryHackMe or HackTheBox.",
      "quiz_generation_prompt": "Generate 10 questions summarizing advanced overarching cyber concepts typically found on the CISSP or CEH exams regarding risk management and offensive strategies.",
      "project_assessment_prompt": "Design a culminating mock-CTF report. The student must document a penetration test from initial reconnaissance to privilege escalation and exfiltration, providing remediation steps for each vulnerability.",
      "max_regenerations": 3
    }
  ]
}

db.global_learning_pathways.update_one(
    {"_id": cybersec_pathway["_id"]},
    {"$set": cybersec_pathway},
    upsert=True
)

print("✅ Successfully seeded the Cyber Security pathway to MongoDB!")
