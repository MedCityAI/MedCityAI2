// Trending Articles Script
// Populates the trending articles list in the hero section


(function() {
    // Helper: Get date N days ago as YYYY-MM-DD
    function getDateNDaysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d.toISOString().split('T')[0];
    }

    // Helper: Parse date string ("Nov 21, 2025" or ISO)
    function parseDate(str) {
        if (!str) return null;
        // Try ISO first
        const iso = Date.parse(str);
        if (!isNaN(iso)) return new Date(iso);
        // Try "Mon DD, YYYY"
        const parts = str.match(/([A-Za-z]+) (\d{1,2}), (\d{4})/);
        if (parts) {
            return new Date(`${parts[1]} ${parts[2]}, ${parts[3]}`);
        }
        return null;
    }

    // Helper: Scroll to article in results grid
    function scrollToArticle(pmid) {
        const el = document.querySelector(`[data-pmid="${pmid}"]`);
        if (el) {
            const headerHeight = 70;
            const rect = el.getBoundingClientRect();
            const offset = rect.top + window.pageYOffset - headerHeight;
            window.scrollTo({ top: offset, behavior: 'smooth' });
            el.classList.add('highlight-article');
            setTimeout(() => el.classList.remove('highlight-article'), 2000);
        } else {
            // If not found, scroll to results grid
            const results = document.getElementById('pubmed-results');
            if (results) results.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Helper: Parse CSV to array of objects
    function parseCSV(csv) {
        const lines = csv.split(/\r?\n/).filter(Boolean);
        const header = lines[0].split(',');
        return lines.slice(1).map(line => {
            const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
            const obj = {};
            header.forEach((h, i) => {
                obj[h.trim()] = (cols[i] || '').replace(/^"|"$/g, '');
            });
            return obj;
        });
    }

    // Main logic
    document.addEventListener('DOMContentLoaded', function() {
        const list = document.getElementById('trending-articles-list');
        const emptyMsg = document.getElementById('trending-articles-empty');
        if (!list) return;

        // 1. Fetch live like counts from Google Sheets endpoint
        const likesUrl = 'https://script.google.com/macros/s/AKfycbw2g5z_1ALbqWjcdY7YsCkwpOpztGJhjOgfRxhGhB8dDA1nwtvySoB5nivNpCnaxIz4/exec?action=getCounts';
        // 2. Fetch pubmed_data.csv for article metadata
        const csvUrl = 'pubmed_data.csv';

        Promise.all([
            fetch(likesUrl).then(r => r.json()),
            fetch(csvUrl).then(r => r.text())
        ]).then(([likeData, csvText]) => {
            // likeData: { pmid: likeCount, ... }
            // csvText: CSV string
            const articles = parseCSV(csvText);
            const now = new Date();
            const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

            // Build a map of pmid -> article
            const articleMap = {};
            articles.forEach(a => {
                articleMap[a.pmid] = a;
            });

            // Merge like counts into articles, filter for last 14 days
            let merged = Object.entries(likeData).map(([pmid, likes]) => {
                const meta = articleMap[pmid];
                if (!meta) return null;
                // Parse pubdate
                const pub = parseDate(meta.pubdate);
                if (!pub || pub < cutoff) return null;
                return {
                    pmid,
                    likes: Number(likes),
                    title: meta.title,
                    authors_display: meta["authors_display"] || meta["authors"] || '',
                    pubdate: meta.pubdate,
                    url: meta.url || `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
                };
            }).filter(Boolean);

            // Sort by likes descending, take top 5
            merged.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            merged = merged.slice(0, 5);

            if (!merged.length) {
                emptyMsg.style.display = '';
                return;
            }
            list.innerHTML = '';
            merged.forEach(article => {
                // Get first author last name
                let firstAuthor = 'Unknown';
                if (article.authors_display) {
                    const first = article.authors_display.split(',')[0].trim();
                    firstAuthor = first.split(' ').slice(-1)[0];
                }
                const li = document.createElement('li');
                li.style.marginBottom = '16px';
                li.innerHTML = `
                    <span style="font-weight:700;color:#e74c3c;margin-right:8px;">${article.likes || 0} <i class='fas fa-heart'></i></span>
                    <a href="#" class="trending-article-link" data-pmid="${article.pmid}" style="color:#0056a3;font-weight:600;text-decoration:underline;">${firstAuthor} et al. "${article.title}"</a>
                `;
                li.querySelector('a').addEventListener('click', function(e) {
                    e.preventDefault();
                    scrollToArticle(article.pmid);
                });
                list.appendChild(li);
            });
        }).catch(() => {
            emptyMsg.style.display = '';
        });
    });

    // Optional: Add highlight style for scroll target
    const style = document.createElement('style');
    style.textContent = `.highlight-article { box-shadow: 0 0 0 4px #e74c3c, 0 4px 24px rgba(231,76,60,0.15); transition: box-shadow 0.3s; }`;
    document.head.appendChild(style);
})();
