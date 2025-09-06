import requests
import csv
import os
from datetime import datetime, timedelta, timezone
import xml.etree.ElementTree as ET

CSV_FILE = "./database/pubmed_results.csv"
TXT_FILE = "./database/summary_stats.txt"

def get_pubmed_results():
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=1)
    start_str = start_date.strftime("%Y/%m/%d")
    end_str = end_date.strftime("%Y/%m/%d")
    date_query = f'("{start_str}" : "{end_str}"[edat])'

    aff_query = "'Rochester'[AD] AND 'Minnesota'[AD]"
    full_query = f"{date_query} AND {aff_query}"

    params = {
        "db": "pubmed",
        "term": full_query,
        "retmax": "100",
        "retmode": "json"
    }
    esearch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    r = requests.get(esearch_url, params=params)
    r.raise_for_status()
    pmids = r.json().get("esearchresult", {}).get("idlist", [])

    if not pmids:
        return []

    id_str = ",".join(pmids)
    esummary_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
    params = {
        "db": "pubmed",
        "id": id_str,
        "retmode": "json"
    }
    r2 = requests.get(esummary_url, params=params)
    r2.raise_for_status()
    docs = r2.json().get("result", {})

    results = []
    for pmid in pmids:
        doc = docs.get(pmid, {})
        title = doc.get("title", "")
        authors = ", ".join(a["name"] for a in doc.get("authors", []) if "name" in a)
        citation = ""
        first_author = doc.get("sortfirstauthor", "")
        journal_abbrev = doc.get("source", "")
        todaydate = datetime.today()
        formatted_date = todaydate.strftime("%Y/%m/%d")
        formatted_year = todaydate.strftime("%Y")
        year = formatted_year
        pubdate = formatted_date
        journal = doc.get("fulljournalname", "")
        affiliation = ""
        doi = ""
        results.append([pmid, title, authors, citation, first_author, journal_abbrev, year, pubdate, journal, affiliation, doi])

    return results


def get_summary_stats():
    end_date = datetime.now(timezone.utc)
    print(f"End date (UTC): {end_date}")
    start_date_day = end_date - timedelta(days=1)
    print(f"Start date (UTC): {start_date_day}")
    start_date_week = end_date - timedelta(days=7)
    start_date_month = end_date - timedelta(days=30)
    start_str_day = start_date_day.strftime("%Y/%m/%d")
    start_str_week = start_date_week.strftime("%Y/%m/%d")
    start_str_month = start_date_month.strftime("%Y/%m/%d")
    end_str = end_date.strftime("%Y/%m/%d")
    print(f"Start date string (day): {start_str_day}")
    date_query_day = f'("{start_str_day}" : "{end_str}"[edat])'
    date_query_week = f'("{start_str_week}" : "{end_str}"[edat])'
    date_query_month = f'("{start_str_month}" : "{end_str}"[edat])'

    aff_query = "'Rochester'[AD] AND 'Minnesota'[AD]"
    full_query_day = f"{date_query_day} AND {aff_query}"
    full_query_week = f"{date_query_week} AND {aff_query}"
    full_query_month = f"{date_query_month} AND {aff_query}"

    params_day = {
        "db": "pubmed",
        "term": full_query_day,
        "rettype": "count",
        "retmode": "json"
    }
    params_week = {
        "db": "pubmed",
        "term": full_query_week,
        "rettype": "count",
        "retmode": "json"
    }
    params_month = {
        "db": "pubmed",
        "term": full_query_month,
        "rettype": "count",
        "retmode": "json"
    }

    esearch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    r_day = requests.get(esearch_url, params=params_day).json()
    VarDay = int(r_day["esearchresult"]["count"])
    
    r_week = requests.get(esearch_url, params=params_week).json()
    VarWeek = int(r_week["esearchresult"]["count"])

    r_month = requests.get(esearch_url, params=params_month).json()
    VarMonth = int(r_month["esearchresult"]["count"])
    
    VarTot = VarDay + VarWeek + VarMonth

    open(TXT_FILE, "w").close()
    with open(TXT_FILE, "a") as f:
        f.write(f"VarTot={VarTot}\n")
        f.write(f"VarDay={VarDay}\n")
        f.write(f"VarWeek={VarWeek}\n")
        f.write(f"VarMonth={VarMonth}\n")


def save_to_csv(results):
    existing = set()
    if os.path.isfile(CSV_FILE):
        with open(CSV_FILE, newline="", encoding="utf-8") as f:
            for row in csv.reader(f):
                if row and row[0] != "PMID":
                    existing.add(row[0])
    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not existing:
            writer.writerow(["pmid", "title", "authors", "citation", "first_author", "journal_abbrev", "year", "pubdate", "journal", "affiliation", "doi"])
        for row in results:
            if row[0] not in existing:
                writer.writerow(row)


if __name__ == "__main__":
    new = get_pubmed_results()
    get_summary_stats()
    if new:
        save_to_csv(new)
        print(f"Added {len(new)} new results.")
    else:
        print("No new results found.")
