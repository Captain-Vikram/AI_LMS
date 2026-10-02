import os
from pymongo import MongoClient

MONGO = os.getenv('MONGO_URI', 'mongodb://host.docker.internal:27017')
DBNAME = os.getenv('MONGO_DB', 'SkillMaster')

print('Connecting to', MONGO)
client = MongoClient(MONGO, serverSelectionTimeoutMS=5000)
db = client.get_database(DBNAME)

filter_q = {
    "classroom_memberships": {"$elemMatch": {"onboarding_complete": True}},
    "onboarding_complete": {"$ne": True}
}

count = db.users.count_documents(filter_q)
print(f"Users to update: {count}")

if count == 0:
    print('No users require updates.')
else:
    print('\nSample users BEFORE update (up to 10):')
    for u in db.users.find(filter_q, {"email":1, "classroom_memberships":1}).limit(10):
        print({"_id": str(u.get('_id')), "email": u.get('email')})

    res = db.users.update_many(filter_q, {"$set": {"onboarding_complete": True}})
    print(f"Matched: {res.matched_count}, Modified: {res.modified_count}")

    total_true = db.users.count_documents({"onboarding_complete": True})
    print(f"Total onboarding_complete == true after update: {total_true}")

print('Done.')
