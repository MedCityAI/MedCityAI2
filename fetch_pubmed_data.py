"""
Fetch PubMed data for Rochester, MN publications and save to CSV file
"""
import requests
import xml.etree.ElementTree as ET
import pandas as pd
from datetime import datetime
import time

def fetch_all_pubmed_data():
    """Fetch all PubMed articles with Rochester, MN affiliation"""
    
    # Base search term for Rochester, MN
    base_location = '("Rochester"[AD] AND ("Minnesota"[AD] OR "MN"[AD]))'
    
    # First, get all article IDs (we'll fetch a large batch)
    # Getting last 1 day (24 hours) of data
    esearch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={base_location}&sort=pub+date&retmode=json&retmax=1000&datetype=pdat&reldate=1"
    
    print("Fetching article IDs from PubMed...")
    response = requests.get(esearch_url)
    data = response.json()
    
    article_ids = data['esearchresult']['idlist']
    print(f"Found {len(article_ids)} articles")
    
    # Fetch articles in batches (PubMed limits to 200 per request)
    all_articles = []
    batch_size = 200
    
    for i in range(0, len(article_ids), batch_size):
        batch_ids = article_ids[i:i+batch_size]
        print(f"Fetching batch {i//batch_size + 1} of {(len(article_ids)-1)//batch_size + 1}...")
        
        efetch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={','.join(batch_ids)}&retmode=xml"
        
        response = requests.get(efetch_url)
        xml_data = response.text
        
        # Parse XML
        root = ET.fromstring(xml_data)
        
        for article in root.findall('.//PubmedArticle'):
            article_data = parse_article(article)
            if article_data:
                all_articles.append(article_data)
        
        # Be nice to NCBI servers
        time.sleep(0.5)
    
    return all_articles

def parse_article(article):
    """Parse a single PubMed article XML element"""
    try:
        # PMID
        pmid_elem = article.find('.//PMID')
        pmid = pmid_elem.text if pmid_elem is not None else ""
        
        # Title
        title_elem = article.find('.//ArticleTitle')
        title = title_elem.text if title_elem is not None else "No title"
        if title_elem is not None:
            # Handle any inline tags in title
            title = ''.join(title_elem.itertext())
        
        # Abstract
        abstract_elem = article.find('.//Abstract')
        abstract = ""
        if abstract_elem is not None:
            abstract = ''.join(abstract_elem.itertext())
        if not abstract:
            abstract = "No abstract available."
        
        # Journal
        journal_elem = article.find('.//Journal/Title')
        journal = journal_elem.text if journal_elem is not None else ""
        
        journal_abbr_elem = article.find('.//Journal/ISOAbbreviation')
        journal_abbr = journal_abbr_elem.text if journal_abbr_elem is not None else ""
        
        # Use abbreviation if full name is too long
        if journal and len(journal.split()) > 10 and journal_abbr:
            journal = journal_abbr
        
        # Publication date
        year_elem = article.find('.//PubDate/Year')
        month_elem = article.find('.//PubDate/Month')
        day_elem = article.find('.//PubDate/Day')
        
        year = year_elem.text if year_elem is not None else ""
        month = month_elem.text if month_elem is not None else ""
        day = day_elem.text if day_elem is not None else ""
        
        # Convert numeric month to name
        month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        if month.isdigit():
            month = month_names[int(month)]
        
        # Format publication date
        if year and month and day:
            pubdate = f"{month} {day}, {year}"
            try:
                month_num = month_names.index(month)
                pub_datetime = datetime(int(year), month_num, int(day))
            except:
                pub_datetime = None
        elif year and month:
            pubdate = f"{month}, {year}"
            try:
                month_num = month_names.index(month)
                pub_datetime = datetime(int(year), month_num, 1)
            except:
                pub_datetime = None
        elif year:
            pubdate = year
            try:
                pub_datetime = datetime(int(year), 1, 1)
            except:
                pub_datetime = None
        else:
            pubdate = ""
            pub_datetime = None
        
        # Authors
        authors = []
        affiliations_list = []
        
        for author_elem in article.findall('.//Author'):
            lastname_elem = author_elem.find('LastName')
            forename_elem = author_elem.find('ForeName')
            
            lastname = lastname_elem.text if lastname_elem is not None else ""
            forename = forename_elem.text if forename_elem is not None else ""
            
            if forename:
                initials = ' '.join([n[0] for n in forename.split() if n])
                name = f"{lastname} {initials}" if lastname else ""
            else:
                name = lastname
            
            # Check affiliations
            author_affiliations = []
            for aff_elem in author_elem.findall('.//Affiliation'):
                aff_text = aff_elem.text if aff_elem is not None else ""
                if aff_text:
                    author_affiliations.append(aff_text)
                    if aff_text not in affiliations_list:
                        affiliations_list.append(aff_text)
            
            # Mark Rochester/Mayo authors
            is_rochester = any('rochester' in a.lower() or 'mayo' in a.lower() for a in author_affiliations)
            
            if name:
                authors.append({
                    'name': name,
                    'is_rochester': is_rochester
                })
        
        # Format authors for display
        author_names = [a['name'] for a in authors]
        rochester_authors = [a['name'] for a in authors if a['is_rochester']]
        
        if len(author_names) > 16:
            authors_display = ', '.join(author_names[:15]) + ', ' + author_names[-1] + ', et al.'
        else:
            authors_display = ', '.join(author_names)
        
        return {
            'pmid': pmid,
            'title': title,
            'abstract': abstract,
            'journal': journal,
            'pubdate': pubdate,
            'pub_datetime': pub_datetime,
            'year': year,
            'month': month,
            'day': day,
            'authors': '|'.join(author_names),  # Pipe-separated for Excel
            'rochester_authors': '|'.join(rochester_authors),  # Underlined in display
            'affiliations': '|'.join(affiliations_list),
            'authors_display': authors_display,
            'url': f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
        }
        
    except Exception as e:
        print(f"Error parsing article: {e}")
        return None

def main():
    """Main function to fetch data and save to CSV"""
    print("Starting PubMed data fetch...")
    
    articles = fetch_all_pubmed_data()
    
    print(f"\nProcessing {len(articles)} articles...")
    
    # Create DataFrame
    df = pd.DataFrame(articles)
    
    # Sort by publication date (most recent first)
    df = df.sort_values('pub_datetime', ascending=False, na_position='last')
    
    # Drop the datetime column (used for sorting only)
    df = df.drop(columns=['pub_datetime'])
    
    # Save to CSV
    output_file = 'pubmed_data.csv'
    df.to_csv(output_file, index=False, encoding='utf-8')
    
    print(f"\nData saved to {output_file}")
    print(f"Total articles: {len(df)}")
    print(f"\nColumns: {', '.join(df.columns.tolist())}")

if __name__ == "__main__":
    main()
