# MedCityAI Article Page - Usage Guide

## Overview

The new **Article Page** (`article.html`) is a dynamic, shareable page for individual research articles. Each article gets its own beautiful, customizable page that can be shared on social media and accessed via a simple URL parameter.

## Features

### Dynamic Content Loading
- **URL Parameter-based**: Uses `?id=PMID` to load any article from the database
- **CSV Integration**: Automatically pulls all article metadata from `pubmed_data.csv`
- **No Backend Required**: Entirely client-side rendering

### Visual Design
- **Hero Section**: Eye-catching gradient background with article metadata at the top
- **Specialty Badges**: Color-coded medical specialties
- **Author Highlighting**: Rochester authors marked with ★ and distinct styling
- **AI Summary Display**: Yellow-highlighted section with AI generation badge
- **Comprehensive Disclaimers**: Clear warnings about AI-generated content

### Data Displayed
- Article title (large, prominent)
- Publication date, journal, and PMID
- All authors with Rochester author highlighting
- Primary and secondary specialties
- Full abstract
- AI-generated summary (if available)
- Citation information
- Direct links to PubMed

### Social Integration
- **LinkedIn Sharing**: Pre-filled share text with:
  - Last two sentences of AI summary
  - PubMed link with UTM tracking
  - Website URL
  - @MedCityAI mention
- **Copy to Clipboard**: Share text can be copied for manual posting
- **Open Graph Tags**: Automatically updated for rich social media previews

### User Experience
- Clean, professional layout with responsive design
- Smooth loading with spinner
- Error handling with helpful messages
- Back-to-feed navigation
- Accessibility features (ARIA labels, semantic HTML)

## Usage

### Direct URL Access

Visit any article directly:

```
https://medcityai.com/article.html?id=41634122
https://medcityai.com/article.html?id=41478859
https://medcityai.com/article.html?id=40961344
```

Simply replace the PMID number with any valid PMID from your database.

### From the Main Feed

Each article card now includes a **"Read Article"** button that links to the article page:

```html
<a href="article.html?id=${pmid}">
  <i class="fas fa-arrow-right"></i>Read Article
</a>
```

## Technical Details

### File Structure

```
article.html                    - Main article page
pubmed_data.csv               - Data source (unchanged)
assets/css/main.css           - Styling
assets/js/jquery.min.js       - jQuery
assets/js/main.js             - Navigation scripts
```

### Key Functions

#### `getUrlParameter(name)`
Extracts URL query parameters (e.g., `?id=PMID`)

#### `parseCSVLine(line)`
Parses CSV data with proper quote handling

#### `loadArticle()`
Main function that:
1. Extracts PMID from URL
2. Fetches and parses CSV
3. Searches for matching article
4. Displays article or error

#### `displayArticle(article)`
Renders the complete article page with all metadata and styling

#### `updateMetaTags(article)`
Updates Open Graph and meta tags for social media sharing

#### `shareOnLinkedIn(shareText, pubmedUrl)`
Handles LinkedIn sharing:
- Copies share text to clipboard
- Opens LinkedIn share dialog
- Includes fallback prompt if clipboard API unavailable

### Data Fields Used

From CSV columns:
- `pmid` - Article identifier
- `title` - Article title
- `authors_display` - All authors (pipe-separated)
- `rochester_authors` - Rochester-affiliated authors
- `journal` - Publication journal
- `pubdate` - Publication date
- `abstract` - Full abstract
- `llm_summary` - AI-generated summary
- `primary_specialty` - Main medical specialty
- `secondary_specialty` - Secondary specialty
- `url` - PubMed URL

## Customization

### Styling

All styles are inline in the `<style>` tag. Key color variables:
- Purple gradient: `#667eea` to `#764ba2` (primary)
- Yellow accent: `#ffc107` (AI summary)
- Blue accent: `#0056a3` (PubMed)
- LinkedIn blue: `#0a66c2`

### Modifying Layout

Edit these CSS classes:
- `.article-hero` - Top section
- `.article-main-card` - Content card
- `.specialty-badges` - Specialty display
- `.ai-summary-section` - AI summary box
- `.action-buttons` - Button area

### Adding Fields

To display additional CSV columns:

1. Add field to `displayArticle()` function
2. Extract from article object: `article.fieldName`
3. Add HTML section with appropriate class
4. Style with existing classes or new CSS

## Error Handling

The page handles several error scenarios:

1. **No PMID provided**: Shows helpful message with back button
2. **Invalid PMID**: Displays "Article not found" error
3. **CSV loading failure**: Shows error with details
4. **Missing data fields**: Gracefully shows "Unknown" or omits section

## Responsive Design

The page is fully responsive:

- **Desktop (>768px)**: Full layout with side-by-side content
- **Mobile (<768px)**: Stacked layout, single-column buttons
- **Hero section**: Scales typography and spacing
- **Button area**: Full-width on mobile

## Social Media Integration

### LinkedIn Sharing

When users click "Share on LinkedIn":

1. Share text is copied to clipboard with:
   ```
   New research worth noting:
   
   [Last two sentences of AI summary]
   
   [PubMed URL with UTM parameters]
   https://medcityai.com
   @MedCityAI
   ```

2. LinkedIn share dialog opens with article URL

3. User pastes text into post (LinkedIn no longer supports pre-filled text)

### Open Graph Tags

Automatically set for each article:
- `og:title` - Article title
- `og:description` - First two sentences of summary
- `og:url` - Article page URL
- `og:type` - "article"

## Example Articles

Test with these PMIDs:

- **41634122** - Broadband/telehealth cancer study
- **41478859** - Childhood kidney tumors (HARMONICA)
- **40961344** - Collegiate wrestler weight loss
- **40998187** - Tirzepatide effects on atrial fibrillation
- **40993340** - ATase autism spectrum disorder research

## Performance

- **Page Load**: CSV parsed on-demand (~100-300ms typical)
- **Search**: Linear search through articles (~50-100ms for 2000+ articles)
- **Rendering**: Immediate after article found
- **Optimization**: Consider pagination if CSV grows >5000 articles

## Future Enhancements

Possible improvements:
1. Add citation download (BibTeX, RIS format)
2. Related articles section
3. Comments/discussion
4. "Save article" functionality with localStorage
5. Search similar articles by specialty
6. Print-friendly version
7. Email share option
8. Bookmark feature with browser storage

## Troubleshooting

### Article not found error
- Verify PMID exists in CSV
- Check PMID formatting (no spaces)
- Ensure CSV file is in same directory

### Missing AI summary
- Check if `llm_summary` is populated in CSV
- Page shows abstract instead if summary unavailable

### Share buttons not working
- Check browser console for errors
- Verify LinkedIn URL is correct
- Check clipboard API support (older browsers)

### Styling not loading
- Verify CSS files are in `assets/css/`
- Check browser console for CSS load errors
- Ensure FontAwesome is loaded correctly

---

**Version**: 1.0  
**Last Updated**: February 4, 2026  
**Author**: MedCityAI Team
