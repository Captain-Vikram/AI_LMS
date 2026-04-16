"""
Test script to verify learning module system end-to-end
Tests auto-generation, progress tracking, and analytics
"""
import sys
from datetime import datetime
from bson import ObjectId

# Mock database setup
class MockDB:
    def __init__(self):
        self.classrooms = MockCollection()
        self.learning_modules = MockCollection()
        self.resource_engagement = MockCollection()
        self.assignment_submissions = MockCollection()

class MockCollection:
    def __init__(self):
        self.data = []
    
    def find_one(self, query, *args, **kwargs):
        for doc in self.data:
            match = True
            for key, value in query.items():
                if doc.get(key) != value:
                    match = False
                    break
            if match:
                return doc
        return None
    
    def find(self, query, *args, **kwargs):
        results = []
        for doc in self.data:
            match = True
            for key, value in query.items():
                if isinstance(value, dict):
                    # Handle $in operator
                    if "$in" in value:
                        if doc.get(key) not in value["$in"]:
                            match = False
                            break
                elif doc.get(key) != value:
                    match = False
                    break
            if match:
                results.append(doc)
        return MockFindResult(results)
    
    def insert_one(self, doc):
        self.data.append(doc)
        return MockInsertResult(doc.get("_id"))
    
    def update_one(self, query, update, *args, **kwargs):
        for doc in self.data:
            match = True
            for key, value in query.items():
                if doc.get(key) != value:
                    match = False
                    break
            if match:
                if "$set" in update:
                    doc.update(update["$set"])
                return MockUpdateResult(matched=1)
        if kwargs.get("upsert"):
            self.data.append(update.get("$set", {}))
            return MockUpdateResult(upserted=1)
        return MockUpdateResult(matched=0)
    
    def count_documents(self, query):
        count = 0
        for doc in self.data:
            match = True
            for key, value in query.items():
                if doc.get(key) != value:
                    match = False
                    break
            if match:
                count += 1
        return count
    
    def create_index(self, *args, **kwargs):
        pass

class MockFindResult:
    def __init__(self, data):
        self.data = data
        self.index = 0
    
    def __iter__(self):
        return iter(self.data)
    
    def sort(self, *args, **kwargs):
        return self
    
    def __next__(self):
        if self.index >= len(self.data):
            raise StopIteration
        result = self.data[self.index]
        self.index += 1
        return result

class MockInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class MockUpdateResult:
    def __init__(self, matched=0, upserted=0):
        self.matched_count = matched
        self.upserted_id = upserted

# Setup test data
def setup_test_classroom():
    db = MockDB()
    
    classroom_id = ObjectId()
    
    # Create a test classroom with approved resources
    classroom = {
        "_id": classroom_id,
        "name": "Test Classroom",
        "subject": "Computer Science",
        "teacher_id": ObjectId(),
        "ai_resources": [
            {
                "resource_id": "res_1",
                "title": "Python Basics Video",
                "skill": "Python Basics",
                "resource_type": "video",
                "url": "https://youtube.com/test1",
                "description": "Learn Python fundamentals",
                "approval_status": "approved",
                "created_date": datetime.utcnow()
            },
            {
                "resource_id": "res_2",
                "title": "Python Functions Article",
                "skill": "Python Basics",
                "resource_type": "document",
                "url": "https://example.com/python-functions",
                "description": "Deep dive into Python functions",
                "approval_status": "approved",
                "created_date": datetime.utcnow()
            },
            {
                "resource_id": "res_3",
                "title": "Data Structures Overview",
                "skill": "Data Structures",
                "resource_type": "video",
                "url": "https://youtube.com/test3",
                "description": "Introduction to data structures",
                "approval_status": "approved",
                "created_date": datetime.utcnow()
            },
            {
                "resource_id": "res_4",
                "title": "Lists and Tuples",
                "skill": "Data Structures",
                "resource_type": "article",
                "url": "https://example.com/lists",
                "description": "Working with lists and tuples",
                "approval_status": "approved",
                "created_date": datetime.utcnow()
            },
        ]
    }
    
    db.classrooms.insert_one(classroom)
    return db, str(classroom_id)

# Test the service
def test_auto_generation():
    from services.learning_module_service import LearningModuleService
    
    print("\n" + "="*60)
    print("TEST 1: Auto-Generate Modules from Resources")
    print("="*60)
    
    db, classroom_id = setup_test_classroom()
    service = LearningModuleService(db)
    
    # Generate modules
    result = service.auto_generate_modules_from_resources(classroom_id)
    
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"Modules Created: {result['modules_created']}")
    
    assert result['status'] == 'success', "Generation should succeed"
    assert result['modules_created'] == 2, "Should create 2 modules (Python Basics, Data Structures)"
    
    print("\n✅ Modules created successfully!")
    for module in result['modules']:
        print(f"  - {module['name']} ({module['resource_count']} resources)")
    
    return db, classroom_id, result['modules']

def test_module_retrieval():
    from services.learning_module_service import LearningModuleService
    
    print("\n" + "="*60)
    print("TEST 2: Retrieve Modules")
    print("="*60)
    
    db, classroom_id, created_modules = test_auto_generation()
    service = LearningModuleService(db)
    
    # Retrieve modules
    result = service.get_classroom_modules(classroom_id)
    
    print(f"Status: {result['status']}")
    print(f"Total Modules: {result['total']}")
    
    assert result['status'] == 'success', "Retrieval should succeed"
    assert len(result['modules']) == 2, "Should retrieve 2 modules"
    
    print("\n✅ Modules retrieved successfully!")
    for module in result['modules']:
        print(f"  - {module['name']} (Order: {module['order']}, Resources: {len(module['resources'])})")
    
    return db, classroom_id, result['modules']

def test_resource_engagement():
    from services.learning_module_service import LearningModuleService
    
    print("\n" + "="*60)
    print("TEST 3: Track Resource Engagement")
    print("="*60)
    
    db, classroom_id, modules = test_module_retrieval()
    service = LearningModuleService(db)
    
    # Get first module
    module = modules[0]
    module_id = module['module_id']
    
    # Simulate student engagement with a resource
    student_id = str(ObjectId())
    resource_id = module['resources'][0]['id'] if module['resources'] else 'res_1'
    
    engagement_data = {
        "viewed": True,
        "view_duration_seconds": 600,
        "completion_percentage": 85,
        "test_score": 90,
        "test_attempts": 1,
        "helpful": True
    }
    
    result = service.track_resource_engagement(
        student_id,
        resource_id,
        module_id,
        engagement_data
    )
    
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
    
    assert result['status'] == 'success', "Engagement tracking should succeed"
    
    print("\n✅ Resource engagement tracked successfully!")
    print(f"  - Student viewed resource for 10 minutes")
    print(f"  - Completion: 85%")
    print(f"  - Test Score: 90%")
    
    return db, classroom_id, module_id, student_id

def test_module_progress():
    from services.learning_module_service import LearningModuleService
    
    print("\n" + "="*60)
    print("TEST 4: Calculate Module Progress")
    print("="*60)
    
    db, classroom_id, module_id, student_id = test_resource_engagement()
    service = LearningModuleService(db)
    
    # Get module progress
    progress = service.get_module_progress(
        ObjectId(student_id),
        ObjectId(module_id)
    )
    
    print(f"Module Progress for {progress['module_id']}:")
    print(f"  - Progress: {progress['progress_percentage']}%")
    print(f"  - Resources Completed: {progress['resources_completed']}/{progress['total_resources']}")
    print(f"  - Average Test Score: {progress['average_score']}%")
    print(f"  - Status: {progress['status']}")
    
    assert progress['status'] in ['not_started', 'in_progress', 'completed'], "Status should be valid"
    
    print("\n✅ Module progress calculated successfully!")
    
    return db

def main():
    try:
        print("\n" + "🚀 LEARNING MODULE SYSTEM TEST SUITE 🚀".center(60, "="))
        
        test_auto_generation()
        test_module_retrieval()
        test_resource_engagement()
        db = test_module_progress()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        print("\nSummary:")
        print("  ✓ Auto-generation of modules from resources")
        print("  ✓ Module retrieval with proper structure")
        print("  ✓ Resource engagement tracking")
        print("  ✓ Progress calculation based on resource tests")
        print("\n")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
