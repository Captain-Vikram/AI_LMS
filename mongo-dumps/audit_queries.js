db.runCommand({ ping: 1 });

print("=== user_goals ===");
print("count:", db.user_goals.countDocuments({}));
printjson(db.user_goals.find().sort({_id:-1}).limit(1).toArray());

print("=== quizzes ===");
print("count:", db.quizzes.countDocuments({}));
printjson(db.quizzes.find().sort({_id:-1}).limit(1).toArray());

print("=== user_profiles ===");
print("total count:", db.user_profiles.countDocuments({}));
print("docs with non-null/empty bio:", db.user_profiles.countDocuments({bio: {$nin: [null, ""]}}));
print("docs with non-null/empty skills:", db.user_profiles.countDocuments({skills: {$nin: [null, [], ""]}}));
printjson(db.user_profiles.find({}, {bio:1, skills:1}).limit(5).toArray());

print("=== teacher_onboarding ===");
print("count:", db.teacher_onboarding.countDocuments({}));
printjson(db.teacher_onboarding.find().sort({_id:-1}).limit(1).toArray());

print("=== skill_pathways ===");
print("count:", db.skill_pathways.countDocuments({}));

print("=== all collections in db ===");
printjson(db.getCollectionNames());
