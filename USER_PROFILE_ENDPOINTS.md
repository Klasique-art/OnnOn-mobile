# User Profile Endpoints

Base URL: `http://localhost:3000/api`

For protected endpoints, send:

`Authorization: Bearer <JWT_TOKEN>`

---

## 1) Get My Profile

**Endpoint:** `GET /profile/me`  
**Auth:** Required  
**Payload:** None

### Success Response (`200`)
```json
{
  "success": true,
  "data": {
    "_id": "PROFILE_ID",
    "userId": "USER_ID",
    "displayName": "john",
    "avatar": "https://res.cloudinary.com/demo/image/upload/avatar-placeholder.png",
    "bio": "",
    "preferences": {
      "theme": "light",
      "notifications": true,
      "audioDefault": true,
      "videoDefault": true
    },
    "createdAt": "2026-03-02T10:00:00.000Z",
    "updatedAt": "2026-03-02T10:00:00.000Z"
  }
}
```

---

## 2) Update My Profile

**Endpoint:** `PUT /profile/me`  
**Auth:** Required  
**Payload (all fields optional):**
```json
{
  "displayName": "John Doe",
  "bio": "Backend engineer",
  "preferences": {
    "theme": "dark",
    "notifications": true,
    "audioDefault": false,
    "videoDefault": true
  }
}
```

### Success Response (`200`)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "PROFILE_ID",
    "userId": "USER_ID",
    "displayName": "John Doe",
    "avatar": "https://res.cloudinary.com/demo/image/upload/avatar-placeholder.png",
    "bio": "Backend engineer",
    "preferences": {
      "theme": "dark",
      "notifications": true,
      "audioDefault": false,
      "videoDefault": true
    },
    "createdAt": "2026-03-02T10:00:00.000Z",
    "updatedAt": "2026-03-02T10:05:00.000Z"
  }
}
```

### Validation Error Response (`400`)
```json
{
  "success": false,
  "message": "\"displayName\" length must be at least 2 characters long"
}
```

---

## 3) Upload Avatar

**Endpoint:** `POST /profile/avatar`  
**Auth:** Required  
**Content-Type:** `multipart/form-data`  
**Payload:** Form field named `avatar` (image file)

### Success Response (`200`)
```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "_id": "PROFILE_ID",
    "userId": "USER_ID",
    "displayName": "John Doe",
    "avatar": "https://res.cloudinary.com/.../onnon/avatars/avatar_USERID_12345.jpg",
    "bio": "Backend engineer",
    "preferences": {
      "theme": "dark",
      "notifications": true,
      "audioDefault": false,
      "videoDefault": true
    },
    "createdAt": "2026-03-02T10:00:00.000Z",
    "updatedAt": "2026-03-02T10:07:00.000Z"
  }
}
```

### Error Response (`400`)
```json
{
  "success": false,
  "message": "No file uploaded"
}
```

---

## 4) Remove Avatar

**Endpoint:** `DELETE /profile/avatar`  
**Auth:** Required  
**Payload:** None

### Success Response (`200`)
```json
{
  "success": true,
  "message": "Avatar removed successfully",
  "data": {
    "_id": "PROFILE_ID",
    "userId": "USER_ID",
    "displayName": "John Doe",
    "avatar": "https://res.cloudinary.com/demo/image/upload/avatar-placeholder.png",
    "bio": "Backend engineer",
    "preferences": {
      "theme": "dark",
      "notifications": true,
      "audioDefault": false,
      "videoDefault": true
    },
    "createdAt": "2026-03-02T10:00:00.000Z",
    "updatedAt": "2026-03-02T10:09:00.000Z"
  }
}
```

---

## 5) Get Public Profile By User ID

**Endpoint:** `GET /profile/:userId`  
**Auth:** Not required  
**Payload:** None

### Success Response (`200`)
```json
{
  "success": true,
  "data": {
    "_id": "PROFILE_ID",
    "userId": "USER_ID",
    "displayName": "John Doe",
    "avatar": "https://res.cloudinary.com/demo/image/upload/avatar-placeholder.png",
    "bio": "Backend engineer",
    "preferences": {
      "theme": "dark",
      "notifications": true,
      "audioDefault": false,
      "videoDefault": true
    },
    "createdAt": "2026-03-02T10:00:00.000Z",
    "updatedAt": "2026-03-02T10:09:00.000Z"
  }
}
```

---

## Common Auth Error Responses

### Unauthorized (`401`)
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### Internal Server Error (`500`)
```json
{
  "success": false,
  "message": "Internal server error"
}
```
