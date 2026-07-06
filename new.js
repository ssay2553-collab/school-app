match /attendanceSummary/{id} {
  allow read: if isSignedIn();
  allow write: if isAdmin() || 
    (isSignedIn() && (isTeacher() || isStaff()) && 
    (
      // Allow if they are the teacher for the class being updated
      isClassTeacher(request.resource.data.classId) ||
      // Or if the resource already exists and they are the teacher
      isClassTeacher(resource.data.classId)
    ));
}