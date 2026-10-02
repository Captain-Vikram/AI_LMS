print("Total activity_feed docs:", db.activity_feed.countDocuments({}));
print("activity_feed docs with visibility_until populated:", db.activity_feed.countDocuments({visibility_until: {$exists: true, $ne: null}}));
