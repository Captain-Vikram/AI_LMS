// Sample user_skills
print("=== user_skills sample docs ===");
printjson(db.user_skills.find().limit(3).toArray());

// Join user_skills to users
print("=== user_skills user lookup ===");
db.user_skills.find().limit(3).forEach(function(s) {
  var u = db.users.findOne({_id: s.user_id}, {email:1, clerk_id:1, registration_date:1});
  print("skill_id:", s.skill_id, "| user:", u ? u.email : "NOT FOUND", "| clerk_id:", u ? (u.clerk_id || "none") : "N/A");
});

// Sample user_preferences
print("=== user_preferences sample docs ===");
printjson(db.user_preferences.find().limit(3).toArray());

// Join user_preferences to users
print("=== user_preferences user lookup ===");
db.user_preferences.find().limit(3).forEach(function(p) {
  var u = db.users.findOne({_id: p.user_id}, {email:1, clerk_id:1, registration_date:1});
  print("learning_style:", p.learning_style, "| user:", u ? u.email : "NOT FOUND", "| clerk_id:", u ? (u.clerk_id || "none") : "N/A");
});
