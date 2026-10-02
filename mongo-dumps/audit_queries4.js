print("=== login_logs and users stats ===");
print("total login_logs count:", db.login_logs.countDocuments({}));
print("total users count:", db.users.countDocuments({}));

print("=== oldest login_log ===");
printjson(db.login_logs.find().sort({login_time:1}).limit(1).toArray());

print("=== newest login_log ===");
printjson(db.login_logs.find().sort({login_time:-1}).limit(1).toArray());
