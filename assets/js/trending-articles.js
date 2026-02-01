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

            // 1. Articles with likes in last 14 days
            let trending = Object.entries(likeData).map(([pmid, likes]) => {
                const meta = articleMap[pmid];
                if (!meta) return null;
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
            trending.sort((a, b) => (b.likes || 0) - (a.likes || 0));

            // 2. If fewer than 5, fill with most recent articles from last 14 days (even if 0 likes)
            if (trending.length < 5) {
                // Find all articles from last 14 days not already in trending
                let recent = articles.filter(a => {
                    const pub = parseDate(a.pubdate);
                    return pub && pub >= cutoff && !trending.find(t => t.pmid === a.pmid);
                }).map(a => ({
                    pmid: a.pmid,
                    likes: Number(likeData[a.pmid] || 0),
                    title: a.title,
                    authors_display: a["authors_display"] || a["authors"] || '',
                    pubdate: a.pubdate,
                    url: a.url || `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`
                }));
                // Sort by pubdate descending
                recent.sort((a, b) => parseDate(b.pubdate) - parseDate(a.pubdate));
                trending = trending.concat(recent.slice(0, 5 - trending.length));
            }

            // 3. If still fewer than 5, fill with most recent articles overall
            if (trending.length < 5) {
                let recentAll = articles.filter(a => !trending.find(t => t.pmid === a.pmid)).map(a => ({
                    pmid: a.pmid,
                    likes: Number(likeData[a.pmid] || 0),
                    title: a.title,
                    authors_display: a["authors_display"] || a["authors"] || '',
                    pubdate: a.pubdate,
                    url: a.url || `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`
                }));
                recentAll.sort((a, b) => parseDate(b.pubdate) - parseDate(a.pubdate));
                trending = trending.concat(recentAll.slice(0, 5 - trending.length));
            }

            trending = trending.slice(0, 5);

            if (!trending.length) {
                emptyMsg.style.display = '';
                return;
            }
            list.innerHTML = '';
            trending.forEach(article => {
                // Get first author last name
                let firstAuthor = 'Unknown';
                if (article.authors_display) {
                    const first = article.authors_display.split(',')[0].trim();
                    firstAuthor = first.split(' ').slice(-1)[0];
                }
                const li = document.createElement('li');
                li.style.marginBottom = '12px';
                li.style.fontSize = '13px';
                li.innerHTML = `
                    <span style="font-weight:700;color:#e74c3c;margin-right:7px;font-size:1em;vertical-align:middle;">${article.likes || 0} <i class='fas fa-heart'></i></span>
                    <span style="color:#0056a3;font-weight:600;font-size:1em;vertical-align:middle;">${firstAuthor} et al. \"${article.title}\"</span> article
                `;
                list.appendChild(li);
            });
            
            // Auto-scroll functionality - scroll one entry every 3 seconds
            const container = document.getElementById('trending-articles');
            if (container && trending.length > 0) {
                let scrollInterval = setInterval(() => {
                    const currentScroll = container.scrollTop;
                    const maxScroll = container.scrollHeight - container.clientHeight;
                    
                    // Estimate height of one list item (approximately 40-45px with margins)
                    const itemHeight = 45;
                    
                    if (currentScroll >= maxScroll - 5) {
                        // At bottom, scroll back to top
                        container.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                        // Scroll to next item
                        container.scrollTo({ top: currentScroll + itemHeight, behavior: 'smooth' });
                    }
                }, 3000); // Every 3 seconds
                
                // Pause auto-scroll on hover
                container.addEventListener('mouseenter', () => {
                    clearInterval(scrollInterval);
                });
                
                container.addEventListener('mouseleave', () => {
                    scrollInterval = setInterval(() => {
                        const currentScroll = container.scrollTop;
                        const maxScroll = container.scrollHeight - container.clientHeight;
                        const itemHeight = 45;
                        
                        if (currentScroll >= maxScroll - 5) {
                            container.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                            container.scrollTo({ top: currentScroll + itemHeight, behavior: 'smooth' });
                        }
                    }, 3000);
                });
            }
        }).catch(() => {
            emptyMsg.style.display = '';
        });
    });

    // Optional: Add highlight style for scroll target
    const style = document.createElement('style');
    style.textContent = `.highlight-article { box-shadow: 0 0 0 4px #e74c3c, 0 4px 24px rgba(231,76,60,0.15); transition: box-shadow 0.3s; }`;
    document.head.appendChild(style);
})();
