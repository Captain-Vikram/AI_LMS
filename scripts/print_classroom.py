#!/usr/bin/env python3
from dotenv import load_dotenv
from pymongo import MongoClient
import os, json
load_dotenv(override=True)
MONGO_URI = os.getenv('MONGO_URI','mongodb://localhost:27017')
DB = os.getenv('MONGO_DB_NAME', os.getenv('MONGO_DB','SkillMaster'))
client = MongoClient(MONGO_URI)
db = client[DB]
cid = '69dfdf3275790f24cc300c9b'
doc = db.classrooms.find_one({'_id': cid})
if not doc:
    # try ObjectId
    from bson import ObjectId
    try:
        doc = db.classrooms.find_one({'_id': ObjectId(cid)})
    except Exception:
        doc = None
print(json.dumps(doc, default=str, indent=2))
