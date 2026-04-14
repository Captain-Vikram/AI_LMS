from database import get_db
from bson import ObjectId
from datetime import datetime

def create_gamification_collection():
    """Create and populate the gamification collection with comprehensive gamification elements"""
    db = get_db()
    
    # Check if collection already exists
    if "gamification" in db.list_collection_names():
        print("Gamification collection already exists. Do you want to replace it? (y/n)")
        response = input().lower()
        if response != 'y':
            print("Operation cancelled.")
            return
        else:
            db.gamification.drop()
            print("Existing gamification collection dropped.")
    
    # Create the collection
    db.create_collection("gamification")
    print("Created gamification collection.")
    
    # =========== BADGES ===========
    badges = [
        {
            "_id": ObjectId(),
            "resource_type": "badge",
            "name": "Learning Pioneer",
            "description": "Completed your first learning module and started your journey.",
            "short_description": "First module completed",
            "category": "learning",
            "color": "#4CAF50",
            "icon": "school",
            "xp_awarded": 50,
            "conditions": {
                "type": "module_completion",
                "threshold": 1
            }
        },
        {
            "_id": ObjectId(),
            "resource_type": "badge",
            "name": "Quiz Master",
            "description": "Achieved a perfect score on 5 different quizzes.",
            "short_description": "5 perfect quiz scores",
            "category": "assessment",
            "color": "#2196F3",
            "icon": "quiz",
            "xp_awarded": 100,
            "conditions": {
                "type": "perfect_quiz",
                "threshold": 5
            }
        },
        {
            "_id": ObjectId(),
            "resource_type": "badge",
            "name": "Consistent Learner",
            "description": "Maintained a 7-day learning streak.",
            "short_description": "7-day streak",
            "category": "engagement",
            "color": "#FF9800",
            "icon": "calendar_month",
            "xp_awarded": 75,
            "conditions": {
                "type": "login_streak",
                "threshold": 7
            },
            "reward": "25% XP boost for the next 3 days"
        },
        {
            "_id": ObjectId(),
            "resource_type": "badge",
            "name": "Skill Improver",
            "description": "Improved at least one skill to level 3.",
            "short_description": "Skill at level 3",
            "category": "skill",
            "color": "#9C27B0",
            "icon": "trending_up",
            "xp_awarded": 150,
            "conditions": {
                "type": "skill_level",
                "threshold": 3
            }
        },
        {
            "_id": ObjectId(),
            "resource_type": "badge",
            "name": "Community Helper",
            "description": "Made 5 helpful contributions to the community.",
            "short_description": "5 community contributions",
            "category": "community",
            "color": "#E91E63",
            "icon": "people",
            "xp_awarded": 125,
            "conditions": {
                "type": "community_contribution",
                "threshold": 5
            }
        },
        {
            "_id": ObjectId(),
            "resource_type": "badge",
            "name": "Assessment Ace",
            "description": "Score 90% or higher on an assessment.",
            "short_description": "90%+ on assessment",
            "category": "assessment",
            "color": "#00BCD4",
            "icon": "military_tech",
            "xp_awarded": 200,
            "conditions": {
                "type": "assessment_score",
                "threshold": 90
            }
        },
        {
            "_id": ObjectId(),
            "resource_type": "badge",
            "name": "Fast Learner",
            "description": "Complete 5 modules in a single week.",
            "short_description": "5 modules in a week",
            "category": "learning",
            "color": "#8BC34A",
            "icon": "speed",
            "xp_awarded": 150,
            "conditions": {
                "type": "module_completion_timed",
                "threshold": 5,
                "timeframe": "7d"
            }
        },
        {
            "_id": ObjectId(),
            "resource_type": "badge",
            "name": "Study Marathon",
            "description": "Spend more than 10 hours learning in a single week.",
            "short_description": "10+ hours in a week",
            "category": "engagement",
            "color": "#FF5722",
            "icon": "timer",
            "xp_awarded": 175,
            "conditions": {
                "type": "time_spent",
                "threshold": 10,
                "timeframe": "7d"
            }
        }
    ]
    
    # =========== XP RULES ===========
    xp_rules = [
        {
            "_id": ObjectId(),
            "resource_type": "xp_rule",
            "activity_type": "complete_assessment",
            "xp_amount": 100,
            "description": "Complete a skill assessment",
            "cooldown": None  # No cooldown
        },
        {
            "_id": ObjectId(),
            "resource_type": "xp_rule",
            "activity_type": "improve_skill_level",
            "xp_amount": 150,
            "description": "Improve a skill to a new level",
            "cooldown": None  # No cooldown
        },
        {
            "_id": ObjectId(),
            "resource_type": "xp_rule",
            "activity_type": "complete_module",
            "xp_amount": 50,
            "description": "Complete a learning module",
            "cooldown": None  # No cooldown
        },
        {
            "_id": ObjectId(),
            "resource_type": "xp_rule",
            "activity_type": "perfect_quiz_score",
            "xp_amount": 75,
            "description": "Achieve 100% score on a quiz",
            "cooldown": None  # No cooldown
        },
        {
            "_id": ObjectId(),
            "resource_type": "xp_rule",
            "activity_type": "daily_login",
            "xp_amount": 10,
            "description": "Log in daily",
            "cooldown": "24h"  # Can only earn once per 24 hours
        },
        {
            "_id": ObjectId(),
            "resource_type": "xp_rule",
            "activity_type": "learning_streak_day",
            "xp_amount": 15,
            "description": "Per day in a learning streak",
            "cooldown": "24h"  # Can only earn once per 24 hours
        },
        {
            "_id": ObjectId(),
            "resource_type": "xp_rule",
            "activity_type": "contribute_to_community",
            "xp_amount": 25,
            "description": "Make a contribution to the community",
            "cooldown": None  # No cooldown
        }
    ]
    
    # =========== LEVELS ===========
    levels = [
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 1,
            "xp_threshold": 0,
            "title": "Beginner",
            "description": "Just starting out on your learning journey.",
            "icon": "school",
            "color": "#4CAF50",
            "rewards": ["Access to basic learning paths"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 2,
            "xp_threshold": 100,
            "title": "Learner",
            "description": "Taking the first steps in your knowledge quest.",
            "icon": "menu_book",
            "color": "#4CAF50",
            "rewards": ["Unlock daily challenges"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 3,
            "xp_threshold": 300,
            "title": "Student",
            "description": "Developing foundational skills and knowledge.",
            "icon": "psychology",
            "color": "#2196F3",
            "rewards": ["Unlock intermediate learning paths"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 4,
            "xp_threshold": 600,
            "title": "Scholar",
            "description": "Building deeper understanding and connections.",
            "icon": "lightbulb",
            "color": "#2196F3",
            "rewards": ["25% XP bonus on assessments"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 5,
            "xp_threshold": 1000,
            "title": "Expert",
            "description": "Mastering concepts and applying them effectively.",
            "icon": "insights",
            "color": "#9C27B0",
            "rewards": ["Unlock advanced learning paths"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 6,
            "xp_threshold": 1500,
            "title": "Master",
            "description": "Demonstrating advanced proficiency and understanding.",
            "icon": "workspace_premium",
            "color": "#9C27B0",
            "rewards": ["50% XP bonus on perfect quiz scores"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 7,
            "xp_threshold": 2200,
            "title": "Guru",
            "description": "Showing exceptional mastery and insight.",
            "icon": "military_tech",
            "color": "#FF9800",
            "rewards": ["Unlock special learning challenges"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 8,
            "xp_threshold": 3000,
            "title": "Luminary",
            "description": "A beacon of knowledge, inspiration, and skill.",
            "icon": "auto_awesome",
            "color": "#FF9800",
            "rewards": ["Community mentor status"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 9,
            "xp_threshold": 4000,
            "title": "Virtuoso",
            "description": "Achieving remarkable excellence and sophistication.",
            "icon": "stars",
            "color": "#E91E63",
            "rewards": ["75% XP bonus on all activities"]
        },
        {
            "_id": ObjectId(),
            "resource_type": "level",
            "level": 10,
            "xp_threshold": 5500,
            "title": "Sage",
            "description": "The pinnacle of wisdom and accomplishment.",
            "icon": "emoji_events",
            "color": "#E91E63",
            "rewards": ["Custom learning path creation"]
        }
    ]

    # =========== CHALLENGES ===========
    challenges = [
        {
            "_id": ObjectId(),
            "resource_type": "challenge",
            "name": "Weekly Skills Sprint",
            "description": "Complete 3 skill assessments within a week",
            "short_description": "3 assessments in 7 days",
            "category": "assessment",
            "difficulty": "medium",
            "start_date": datetime(2025, 3, 1),
            "end_date": datetime(2025, 3, 31),
            "recurring": "weekly",
            "requirements": {
                "type": "assessment_completion", 
                "count": 3,
                "timeframe": "7d"
            },
            "rewards": {
                "xp": 150,
                "badge_id": None,
                "special_reward": "25% XP boost for 1 day"
            },
            "icon": "speed",
            "color": "#2196F3"
        },
        {
            "_id": ObjectId(),
            "resource_type": "challenge",
            "name": "Coding Marathon",
            "description": "Spend at least 5 hours on coding exercises within 3 days",
            "short_description": "5 hours coding in 3 days",
            "category": "coding",
            "difficulty": "hard",
            "start_date": datetime(2025, 3, 5),
            "end_date": datetime(2025, 3, 15),
            "recurring": None,
            "requirements": {
                "type": "time_spent_coding", 
                "hours": 5,
                "timeframe": "3d"
            },
            "rewards": {
                "xp": 250,
                "badge_id": None,
                "special_reward": "Unlock exclusive coding project"
            },
            "icon": "code",
            "color": "#9C27B0"
        },
        {
            "_id": ObjectId(),
            "resource_type": "challenge",
            "name": "Streak Master",
            "description": "Log in and complete at least one activity for 7 consecutive days",
            "short_description": "7-day perfect streak",
            "category": "engagement",
            "difficulty": "easy",
            "start_date": datetime(2025, 3, 1),
            "end_date": datetime(2025, 12, 31),
            "recurring": "monthly",
            "requirements": {
                "type": "daily_activity_streak", 
                "days": 7
            },
            "rewards": {
                "xp": 175,
                "badge_id": None,
                "special_reward": "50% XP boost for 2 days"
            },
            "icon": "calendar_month",
            "color": "#FF9800"
        },
        {
            "_id": ObjectId(),
            "resource_type": "challenge",
            "name": "Knowledge Breadth",
            "description": "Complete modules across at least 3 different subject areas within 14 days",
            "short_description": "3 subjects in 2 weeks",
            "category": "learning",
            "difficulty": "medium",
            "start_date": datetime(2025, 3, 1),
            "end_date": datetime(2025, 12, 31),
            "recurring": "monthly",
            "requirements": {
                "type": "diverse_learning", 
                "subject_count": 3,
                "timeframe": "14d"
            },
            "rewards": {
                "xp": 200,
                "badge_id": None,
                "special_reward": "Unlock cross-disciplinary learning path"
            },
            "icon": "hub",
            "color": "#4CAF50"
        }
    ]
    
    # Combine all gamification elements
    all_elements = badges + xp_rules + levels + challenges
    
    # Insert all gamification data
    db.gamification.insert_many(all_elements)
    print(f"Added {len(all_elements)} gamification elements to the collection:")
    print(f" - {len(badges)} badges")
    print(f" - {len(xp_rules)} XP rules")
    print(f" - {len(levels)} levels")
    print(f" - {len(challenges)} challenges")

if __name__ == "__main__":
    create_gamification_collection()