#!/usr/bin/env python3
"""Detect and fix duplicate `clerk_id` values in `users`.

Default behavior: print a preview of planned changes.
Use `--apply` to perform the unset operations.

Safe heuristics:
- Choose canonical document per `clerk_id` by scoring: has email (+100), onboarding_complete (+50), number of classroom_memberships (+len).
- Unset `clerk_id` on other documents in the group.
- Creates a JSON backup of affected documents before applying changes.
"""

import os
import sys
import json
import argparse
from datetime import datetime
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


def serialize(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


def to_jsonable(doc: dict):
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if isinstance(v, dict):
            out[k] = to_jsonable(v)
        elif isinstance(v, list):
            out[k] = [to_jsonable(x) if isinstance(x, dict) else serialize(x) for x in v]
        else:
            out[k] = serialize(v)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Apply the planned changes')
    args = parser.parse_args()

    load_dotenv(override=True)
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
    DB_NAME = os.getenv('MONGO_DB_NAME', os.getenv('MONGO_DB', 'SkillMaster'))

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    pipeline = [
        {"$match": {"clerk_id": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$clerk_id", "count": {"$sum": 1}, "ids": {"$push": "$_id"}}},
        {"$match": {"count": {"$gt": 1}}}
    ]

    dup_groups = list(db.users.aggregate(pipeline))
    if not dup_groups:
        print('No duplicate clerk_id values found.')
        return

    print(f'Found {len(dup_groups)} duplicate clerk_id groups')

    planned = []

    for g in dup_groups:
        clerk_id = g['_id']
        ids = g['ids']
        docs = list(db.users.find({"_id": {"$in": ids}}))

        def score(doc):
            s = 0
            if doc.get('email'):
                s += 100
            if doc.get('onboarding_complete'):
                s += 50
            s += len(doc.get('classroom_memberships') or [])
            return s

        scored = [(score(d), d) for d in docs]
        scored.sort(key=lambda x: (-x[0], str(x[1].get('_id'))))
        canonical = scored[0][1]
        others = [d for _, d in scored[1:]]

        planned.append({
            'clerk_id': clerk_id,
            'canonical': to_jsonable(canonical),
            'others': [to_jsonable(o) for o in others]
        })

    # Backup affected docs
    backup = {
        'timestamp': datetime.utcnow().isoformat(),
        'planned_count': len(planned),
        'planned': planned
    }
    backup_dir = os.path.join(os.getcwd(), 'mongo-dumps')
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, f'duplicate_clerk_id_backup_{datetime.utcnow().strftime("%Y%m%d%H%M%S")}.json')
    with open(backup_path, 'w', encoding='utf-8') as f:
        json.dump(backup, f, indent=2)

    print(f'Preview written and backed up to: {backup_path}')

    # Print preview
    for p in planned:
        print('\n---')
        print('clerk_id:', p['clerk_id'])
        print(' canonical _id:', p['canonical'].get('_id'), ' email:', p['canonical'].get('email'))
        for o in p['others']:
            print('  -> other _id:', o.get('_id'), ' email:', o.get('email'), ' onboarding_complete:', o.get('onboarding_complete'))

    if not args.apply:
        print('\nRun with --apply to unset `clerk_id` on the secondary documents above.')
        return

    # Apply changes: unset clerk_id on others
    total_modified = 0
    for p in planned:
        for o in p['others']:
            oid = ObjectId(o.get('_id'))
            res = db.users.update_one({'_id': oid}, {'$unset': {'clerk_id': ''}})
            print(f"Unset clerk_id on {str(oid)} (modified_count={res.modified_count})")
            total_modified += res.modified_count

    print(f'Finished. Total modified documents: {total_modified}')
    print('Backup is available at', backup_path)


if __name__ == '__main__':
    main()
