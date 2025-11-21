# Firebase Integration Setup Guide for MedCityAI

## Overview
This guide will help you set up Firebase to track likes and views on each PMID card.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard
4. Once created, click on "Web" icon (</>) to add Firebase to your web app
5. Register your app (you can name it "MedCityAI")
6. Copy the Firebase configuration object

## Step 2: Update Firebase Configuration

In `index.html`, find this section (around line 1250):

```javascript
// Initialize Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Replace with YOUR actual Firebase configuration values.

## Step 3: Enable Firestore Database

1. In Firebase Console, go to "Build" → "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" for development (update rules later for production)
4. Select a location for your database
5. Click "Enable"

## Step 4: Set Firestore Security Rules

In Firestore Database → Rules tab, use these rules for testing:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /publications/{pmid} {
      // Allow anyone to read
      allow read: if true;
      // Allow anyone to create/update (for likes and views)
      allow create, update: if true;
    }
  }
}
```

**IMPORTANT**: For production, implement stricter security rules.

## Step 5: Update Publication Cards

You need to update TWO locations in `index.html` where cards are rendered:

### Location 1: Around line 2045
### Location 2: Around line 2315

For **BOTH** locations, make these changes:

### Change 1: Add `data-pmid` attribute
Find:
```html
<div class="result-item">
```

Change to:
```html
<div class="result-item" data-pmid="${pmid}">
```

### Change 2: Add Like Button and View Counter

Find this section (after the `result-citation` div):
```html
<div class="result-citation"><em>${citation}</em></div>
<div style="margin-top: 8px; margin-bottom: 10px;">
    <a href="${url}" target="_blank" onclick="event.stopPropagation();" ...>
```

Change to:
```html
<div class="result-citation"><em>${citation}</em></div>

<!-- Firebase Interaction Tracking -->
<div class="card-interactions" onclick="event.stopPropagation();">
    <div class="interaction-item">
        <button class="like-button" onclick="toggleLike('${pmid}', this)" aria-label="Like this publication">
            ♡ <span class="like-count">0</span>
        </button>
    </div>
    <div class="interaction-item view-count">
        <span>👁</span>
        <span>0</span> views
    </div>
</div>

<div style="margin-top: 8px; margin-bottom: 10px;">
    <a href="${url}" target="_blank" onclick="event.stopPropagation(); trackView('${pmid}');" ...>
```

### Change 3: Load Counts After Rendering

Find these two lines (there are 2 instances):
```javascript
document.getElementById("pubmed-results").innerHTML = `<div class="results">${resultsHTML}</div>`;
```

After **EACH** of these lines, add:
```javascript
// Load Firebase interaction counts for all cards
loadInteractionCounts();
```

## Step 6: Test the Implementation

1. Open `index.html` in a browser
2. You should see:
   - A heart icon (♡) with "0" next to it on each card
   - An eye icon (👁) with "0 views" on each card
3. Click the heart - it should turn into ♥ and increment the count
4. Click "View on PubMed" link - the view count should increment

## Step 7: Verify in Firebase

1. Go to Firebase Console → Firestore Database
2. You should see a `publications` collection
3. Click on any document (PMID)
4. You should see fields like:
   - `likes`: number
   - `views`: number
   - `pmid`: string
   - `lastUpdated`: timestamp

## How It Works

### Like Tracking
- When user clicks the heart button, `toggleLike()` function is called
- It increments/decrements the `likes` field in Firestore
- The PMID they've liked is stored in localStorage so they can't like multiple times
- The heart fills in (♥) when liked

### View Tracking
- When user clicks "View on PubMed", `trackView()` function is called
- It increments the `views` field in Firestore
- Each click is counted (not limited like likes)

### Count Display
- After cards are rendered, `loadInteractionCounts()` fetches current counts from Firestore
- Updates the UI with real counts
- Checks localStorage to show which cards the user has liked

## Extending to Other Pages

To add this to `search.html` and other pages:

1. Copy the Firebase SDK script tags from `<head>`
2. Copy the entire Firebase configuration script from `<body>`
3. Copy the CSS styles for `.card-interactions`, `.like-button`, etc.
4. Update the card HTML in those pages following the same pattern

## Production Considerations

### Security Rules
Update Firestore rules to prevent abuse:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /publications/{pmid} {
      allow read: if true;
      // Limit write operations
      allow create, update: if request.resource.data.keys().hasAll(['pmid']) &&
                               request.resource.data.likes is number &&
                               request.resource.data.views is number &&
                               request.resource.data.likes >= 0 &&
                               request.resource.data.views >= 0;
    }
  }
}
```

### Rate Limiting
Consider implementing rate limiting to prevent users from rapidly clicking likes/views.

### Analytics
Use Firebase Analytics to track user engagement patterns.

## Troubleshooting

### Likes/Views not saving
- Check browser console for errors
- Verify Firebase configuration is correct
- Check Firestore security rules allow writes

### Counts show as 0
- Verify `loadInteractionCounts()` is being called
- Check browser console for errors
- Ensure `data-pmid` attribute is on the card elements

### Heart doesn't fill when clicked
- Check localStorage in browser DevTools
- Verify `toggleLike()` function is running without errors
- Check CSS `.like-button.liked` style is present

## Cost Considerations

Firebase Free Tier includes:
- 50,000 reads/day
- 20,000 writes/day
- 20,000 deletes/day
- 1GB storage

For a small to medium site, this should be sufficient. Monitor usage in Firebase Console.

## Questions?

If you encounter issues:
1. Check browser console for JavaScript errors
2. Check Firebase Console → Firestore → Data to verify writes are happening
3. Verify the Firebase SDK scripts are loading (check Network tab in DevTools)
