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

## Enabling GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, choose `main` branch, root folder (`/`).
4. Click **Save** — your site will be live at `https://<username>.github.io/<repo>/`.

---

## Using the app

| Feature | How |
|---|---|
| View by day | Tap **By Day**, then select a day tab |
| View by child | Tap **By Child**, then select a name |
| Add private lesson | Tap the **＋** button (bottom-right) |
| Edit/delete a private | Tap the ✏️ pencil icon on the lesson card |
| Live sync | Happens automatically when Firebase is configured |
