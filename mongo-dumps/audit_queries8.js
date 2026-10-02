print("=== users document for 69dd247998962d064c8c87ce ===");
printjson(db.users.findOne({_id: ObjectId('69dd247998962d064c8c87ce')}));

print("=== user_profiles document for 69dd247998962d064c8c87ce ===");
printjson(db.user_profiles.findOne({user_id: ObjectId('69dd247998962d064c8c87ce')}));
