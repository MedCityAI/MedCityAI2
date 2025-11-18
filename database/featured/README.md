# Featured Articles - Like Tracking

## Overview
This directory is designated for tracking article "likes" from users. Currently, likes are stored in the browser's localStorage for immediate client-side tracking.

## Current Implementation
- **Storage**: Browser localStorage (`articleLikes` key)
- **Format**: JSON object with PMID as keys and like counts as values
  ```json
  {
    "12345678": 5,
    "87654321": 12
  }
  ```

## Features
- ❤️ Like button on each article card (bottom-right corner)
- Confetti animation when clicked
- Like count display
- Visual feedback (button changes to green after liking)
- Persistent across page loads (localStorage)

## Future CSV Export Option
To export like data to CSV format in this directory:

1. **Option A: Manual Export**
   - Open browser console
   - Run: `console.log(localStorage.getItem('articleLikes'))`
   - Copy data and format as CSV

2. **Option B: Backend API** (requires server-side implementation)
   - Create Node.js/PHP endpoint to receive POST requests
   - Save data to `database/featured/likes.csv`
   - Format: `PMID,LikeCount`
   
   Example endpoint:
   ```javascript
   // In likeArticle() function, add:
   fetch('/api/like', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ pmid, count: newCount })
   });
   ```

## Data Privacy
- Like data is stored locally in user's browser only
- No personal information is collected
- Data can be cleared by clearing browser storage
