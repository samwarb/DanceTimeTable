# Dance Timetable

A mobile-friendly timetable for Aubree, Nelly & Winnie's dance lessons.
Hosted on GitHub Pages. Private lessons can be added and edited, and sync live across all devices via Firebase.

---

## Setting up live sync (Firebase)

Without Firebase, the app still works but private lessons are saved locally per device only. To get cross-device sync:

### 1. Create a free Firebase project

1. Go to [firebase.google.com](https://firebase.google.com) and sign in with a Google account.
2. Click **Add project**, name it (e.g. `dance-timetable`), follow the prompts.

### 2. Enable Realtime Database

1. In your project, go to **Build → Realtime Database**.
2. Click **Create database** → choose a region → start in **test mode** (you can add rules later).

### 3. Get your config

1. Go to **Project settings** (gear icon) → **General** tab → scroll to **Your apps**.
2. Click **Add app** → choose **Web** (the `</>` icon).
3. Register the app, then copy the `firebaseConfig` object shown.

### 4. Paste your config into the app

Open `js/app.js` and replace the `FIREBASE_CONFIG` block at the top with your values:

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIza...",
  authDomain:        "your-app.firebaseapp.com",
  databaseURL:       "https://your-app-default-rtdb.firebaseio.com",
  projectId:         "your-app",
  storageBucket:     "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc"
};
```

### 5. (Optional) Secure your database

In Firebase → Realtime Database → **Rules**, set:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

This keeps it open for your family. If you want to restrict it further, Firebase offers authentication rules.

---

## Hosting options

### Option A — GitHub Pages (simplest)

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, choose `main` branch, root folder (`/`).
4. Click **Save** — your site will be live at `https://<username>.github.io/<repo>/`.

### Option B — Firebase Hosting (recommended with Firebase database)

Hosting the app on Firebase gives you a clean `*.web.app` URL and keeps everything in one place.

#### Prerequisites
- [Node.js](https://nodejs.org) (v18+) installed on your machine
- Firebase CLI — install once with: `npm install -g firebase-tools`

#### Steps

1. **Log in to Firebase**
   ```bash
   firebase login
   ```

2. **Set your project ID in `.firebaserc`**

   Open `.firebaserc` and replace `REPLACE_WITH_YOUR_PROJECT_ID` with your actual Firebase project ID (found in **Project settings → General → Project ID**):
   ```json
   {
     "projects": {
       "default": "dance-timetable"
     }
   }
   ```

3. **Deploy**
   ```bash
   firebase deploy --only hosting
   ```
   The CLI will print your live URL — something like:
   ```
   Hosting URL: https://dance-timetable.web.app
   ```

4. **Re-deploy after any change**
   ```bash
   firebase deploy --only hosting
   ```

> **Tip:** Add the live URL as the authorized domain in Firebase → Authentication → Settings → Authorized domains if you later add Firebase Auth.

---

## Using the app

| Feature | How |
|---|---|
| View by day | Tap **By Day**, then select a day tab |
| View by child | Tap **By Child**, then select a name |
| Add private lesson | Tap the **＋** button (bottom-right) |
| Edit/delete a private | Tap the ✏️ pencil icon on the lesson card |
| Live sync | Happens automatically when Firebase is configured |
