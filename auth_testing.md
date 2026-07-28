# Auth Testing Playbook (Emergent Google Auth)

## How to test auth-gated endpoints/pages:

### Step 1: Create Test User & Session in Mongo
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  role: 'admin',
  project_ids: [],
  is_active: true,
  password_reset_required: false,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

### Step 2: Test backend
```bash
curl -X GET "$REACT_APP_BACKEND_URL/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Step 3: Browser test
Set cookie `session_token` for the preview domain, path `/`, secure, httpOnly, sameSite None.
Then navigate to `/dashboard`.

## Notes
- The very first user to log in via Google auto-becomes Admin (bootstrap admin).
- Admin creates other users by email + role; they must log in with a Google account matching that email.
