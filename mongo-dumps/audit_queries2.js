// Query 1: For all user_profiles docs that have non-empty bio,
// join to users collection and show email, registration_date, created_date
// to determine if they're seeded or real registrations.
var profilesWithBio = db.user_profiles.find(
  {bio: {$nin: [null, ""]}},
  {user_id: 1, bio: 1, skills: 1, created_date: 1}
).toArray();

print("=== user_profiles with bio — count:", profilesWithBio.length, "===");

// For each, fetch the corresponding user doc
var results = profilesWithBio.map(function(p) {
  var u = db.users.findOne({_id: p.user_id}, {email: 1, registration_date: 1, clerk_id: 1, status: 1});
  return {
    profile_id: p._id,
    user_id: p.user_id,
    email: u ? u.email : "USER NOT FOUND",
    registration_date: u ? u.registration_date : null,
    has_clerk_id: u ? (u.clerk_id ? true : false) : null,
    profile_created_date: p.created_date || null
  };
});

printjson(results);

// Summary: count how many have clerk_id (Clerk auth = real user) vs not (seed script = fake)
var withClerk = results.filter(function(r) { return r.has_clerk_id === true; }).length;
var withoutClerk = results.filter(function(r) { return r.has_clerk_id === false; }).length;
var notFound = results.filter(function(r) { return r.email === "USER NOT FOUND"; }).length;
print("=== SUMMARY ===");
print("Has clerk_id (real/Clerk user):", withClerk);
print("No clerk_id (seed/password user):", withoutClerk);
print("user_id not found in users:", notFound);

// Also check registration date distribution
print("=== registration_date range ===");
var dates = results.filter(function(r){ return r.registration_date; }).map(function(r){ return r.registration_date; });
dates.sort();
if(dates.length > 0) {
  print("Earliest:", dates[0]);
  print("Latest:", dates[dates.length-1]);
}

// Query 2: user_goals — show all 4 docs in full
print("=== user_goals — all documents ===");
printjson(db.user_goals.find().toArray());

// Also check if user_goals user_ids resolve to real users
print("=== user_goals — user lookups ===");
db.user_goals.find().forEach(function(g) {
  var u = db.users.findOne({_id: g.user_id}, {email:1, registration_date:1, clerk_id:1});
  print("goal_title:", g.goal_title, "| user email:", u ? u.email : "NOT FOUND", "| clerk_id:", u ? (u.clerk_id || "none") : "N/A");
});
