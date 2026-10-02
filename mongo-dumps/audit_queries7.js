print("=== users document for aka.vigi@gmail.com ===");
printjson(db.users.findOne({_id: ObjectId('69df50b11aeca3b24a42cf11')}));

print("=== user_profiles document for aka.vigi@gmail.com ===");
printjson(db.user_profiles.findOne({user_id: ObjectId('69df50b11aeca3b24a42cf11')}));
