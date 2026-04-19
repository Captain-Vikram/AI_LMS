export const normalizeClassroomRole = (rawRole) => {
  const role = String(rawRole || '').trim().toLowerCase();

  if (role === 'teacher' || role === 'admin' || role === 'student') {
    return role;
  }

  if (role === 'educator' || role === 'instructor' || role === 'faculty') {
    return 'teacher';
  }

  return 'student';
};

export const canManageClassroom = (rawRole) => {
  const normalizedRole = normalizeClassroomRole(rawRole);
  return normalizedRole === 'teacher' || normalizedRole === 'admin';
};
