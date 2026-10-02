db.user_profiles.find().forEach(p => {
  const u = db.users.findOne({_id: p.user_id});
  if (!u) { print("ORPHAN:", p._id); return; }
  ["first_name","last_name","location","role"].forEach(f => {
    // Handle potential null vs undefined mismatch
    const valP = p[f] === undefined ? null : p[f];
    const valU = u[f] === undefined ? null : u[f];
    if (valP !== valU) {
      print("MISMATCH", f, "profile:", valP, "user:", valU, "user_id:", p.user_id);
    }
  });
});
