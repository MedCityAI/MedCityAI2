#!/usr/bin/env python3
"""
Weekly Featured Articles Update Script

Runs every Sunday to:
1. Fetch like data from Google Sheets
2. Filter articles from the prior week (Sunday-Saturday)
3. Sort by number of likes and select top 10
4. Query PubMed API for full metadata
5. Write results to featured_weekly.json
"""

import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import requests
import time
import xml.etree.ElementTree as ET


def get_prior_week_range():
    """
    Calculate the date range for the prior week (Sunday to Saturday).
    Returns: (start_date, end_date) as datetime objects
    """
    today = datetime.now()
    
    # Find the most recent Saturday (end of prior week)
    days_since_saturday = (today.weekday() + 2) % 7  # Sunday=0, Saturday=6
    last_saturday = today - timedelta(days=days_since_saturday)
    
    # Prior week starts 7 days before that Saturday
    prior_sunday = last_saturday - timedelta(days=6)
    
    # Set to beginning/end of day
    start_date = prior_sunday.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = last_saturday.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    return start_date, end_date


def fetch_google_sheets_likes():
    """
    Fetch like data from Google Sheets using the Apps Script endpoint.
    Returns: List of dicts with {pmid, likes, last_like_date}
    """
    # Google Apps Script endpoint
    sheets_url = "https://script.google.com/macros/s/AKfycbw2g5z_1ALbqWjcdY7YsCkwpOpztGJhjOgfRxhGhB8dDA1nwtvySoB5nivNpCnaxIz4/exec?action=getCounts"
    
    try:
        print(f"Fetching like counts from Google Sheets...")
        response = requests.get(sheets_url, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Convert from {pmid: count} to list format
        # Note: The current endpoint only returns counts, not dates
        # You may need to modify your Google Apps Script to return dates as well
        articles = []
        for pmid, likes in data.items():
            articles.append({
                'pmid': pmid,
                'likes': likes,
                'last_like_date': None  # Will be populated if available
            })
        
        print(f"Fetched {len(articles)} articles with likes")
        return articles
        
    except Exception as e:
        print(f"Error fetching from Google Sheets: {e}")
        return []


def fetch_pubmed_metadata(pmid: str) -> Optional[Dict]:
    """
    Fetch article metadata from PubMed API.
    
    Args:
        pmid: PubMed ID
        
    Returns:
        Dict with article metadata or None if not found
    """
    try:
        # PubMed E-utilities API
        base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        params = {
            'db': 'pubmed',
            'id': pmid,
            'retmode': 'xml'
        }
        
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(response.content)
        article = root.find('.//PubmedArticle')
        
        if not article:
            return None
        
        # Extract metadata
        medline_citation = article.find('.//MedlineCitation')
        pubmed_data = article.find('.//PubmedData')
        
        # Title
        title_elem = medline_citation.find('.//ArticleTitle')
        title = ''.join(title_elem.itertext()) if title_elem is not None else 'No title available'
        
        # Abstract
        abstract_elem = medline_citation.find('.//Abstract/AbstractText')
        abstract = ''.join(abstract_elem.itertext()) if abstract_elem is not None else 'No abstract available'
        
        # Journal
        journal_elem = medline_citation.find('.//Journal/Title')
        journal = journal_elem.text if journal_elem is not None else 'Unknown Journal'
        
        # Publication date
        pub_date_elem = medline_citation.find('.//PubDate')
        year = pub_date_elem.find('Year').text if pub_date_elem.find('Year') is not None else ''
        month = pub_date_elem.find('Month').text if pub_date_elem.find('Month') is not None else ''
        day = pub_date_elem.find('Day').text if pub_date_elem.find('Day') is not None else ''
        pubdate = f"{month} {day}, {year}".strip(', ')
        
        # Authors
        authors_list = []
        authors_elem = medline_citation.findall('.//Author')
        for author in authors_elem:
            last_name = author.find('LastName')
            initials = author.find('Initials')
            if last_name is not None and initials is not None:
                authors_list.append(f"{last_name.text} {initials.text}")
        
        authors_display = ', '.join(authors_list[:10])  # Limit to first 10 authors
        if len(authors_list) > 10:
            authors_display += ', et al.'
        
        # Affiliations (first author's affiliation)
        affiliation_elem = medline_citation.find('.//AffiliationInfo/Affiliation')
        affiliations = affiliation_elem.text if affiliation_elem is not None else ''
        
        # Construct URL
        url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
        
        metadata = {
            'pmid': pmid,
            'title': title,
            'abstract': abstract,
            'journal': journal,
            'pubdate': pubdate,
            'year': year,
            'month': month,
            'day': day,
            'authors': '|'.join(authors_list),
            'authors_display': authors_display,
            'affiliations': affiliations,
            'url': url
        }
        
        return metadata
        
    except Exception as e:
        print(f"Error fetching PubMed data for PMID {pmid}: {e}")
        return None


def main():
    """Main execution function."""
    
    print("=" * 60)
    print("Weekly Featured Articles Update")
    print(f"Run date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Get prior week date range
    start_date, end_date = get_prior_week_range()
    print(f"\nPrior week range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    
    # Fetch like data from Google Sheets
    articles_with_likes = fetch_google_sheets_likes()
    
    if not articles_with_likes:
        print("No articles found with likes. Exiting.")
        return
    
    # Filter for prior week (if dates are available)
    # Note: Current Google Sheets endpoint doesn't return dates
    # For now, we'll process all articles and sort by likes
    print(f"\nProcessing {len(articles_with_likes)} articles...")
    
    # Sort by likes (descending) and take top 10
    articles_with_likes.sort(key=lambda x: x['likes'], reverse=True)
    top_articles = articles_with_likes[:10]
    
    print(f"\nTop 10 most-liked articles:")
    for i, article in enumerate(top_articles, 1):
        print(f"  {i}. PMID {article['pmid']}: {article['likes']} likes")
    
    # Fetch full metadata from PubMed for top 10
    print("\nFetching metadata from PubMed...")
    featured_articles = []
    
    for article in top_articles:
        pmid = article['pmid']
        likes = article['likes']
        
        metadata = fetch_pubmed_metadata(pmid)
        
        if metadata:
            metadata['likes'] = likes
            metadata['featured_date'] = datetime.now().strftime('%Y-%m-%d')
            metadata['week_start'] = start_date.strftime('%Y-%m-%d')
            metadata['week_end'] = end_date.strftime('%Y-%m-%d')
            featured_articles.append(metadata)
            print(f"  ✓ PMID {pmid}: {metadata['title'][:60]}...")
        else:
            print(f"  ✗ PMID {pmid}: Failed to fetch metadata")
        
        # Be nice to NCBI servers
        time.sleep(0.5)
    
    # Write to JSON file
    output_file = 'featured_weekly.json'
    output_data = {
        'generated_date': datetime.now().isoformat(),
        'week_start': start_date.strftime('%Y-%m-%d'),
        'week_end': end_date.strftime('%Y-%m-%d'),
        'total_articles_processed': len(articles_with_likes),
        'featured_count': len(featured_articles),
        'articles': featured_articles
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Successfully wrote {len(featured_articles)} featured articles to {output_file}")
    print("=" * 60)


if __name__ == '__main__':
    main()
