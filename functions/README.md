Deploy the Cloud Function to create user profiles on auth create events.

Steps:

1. cd functions
2. npm install
3. firebase login
4. firebase deploy --only functions:createUserProfile

This function uses the Admin SDK and will write Firestore user docs safely without client-side permission issues.
