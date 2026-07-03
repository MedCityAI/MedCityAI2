(function () {
    'use strict';

    const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const PUBMED_SEARCH_PAGE_SIZE = 5000;
    const PUBMED_FETCH_CHUNK_SIZE = 100;
    const PUBMED_MAX_PMIDS = 50000;

    const STATE_MAP = {
        AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
        DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
        IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
        MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
        NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
        ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
        SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
        WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia'
    };

    const STOPWORDS = new Set([
        'the', 'and', 'for', 'with', 'that', 'from', 'this', 'were', 'have', 'has', 'into', 'their', 'among', 'using',
        'study', 'studies', 'analysis', 'clinical', 'patients', 'associated', 'between', 'within', 'after', 'before',
        'during', 'based', 'through', 'these', 'those', 'while', 'than', 'also', 'into', 'such', 'used', 'use', 'may',
        'can', 'our', 'its', 'they', 'them', 'more', 'less', 'results', 'result', 'journal', 'pubmed', 'research',
        'medical', 'mayo', 'rochester', 'minnesota', 'model', 'models', 'data', 'outcomes'
    ]);

    const COUNTRY_HINTS = [
        'United Kingdom', 'Netherlands', 'Switzerland', 'Germany', 'France', 'Italy', 'Spain', 'Portugal', 'Belgium',
        'Austria', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Ireland', 'Poland', 'Czech Republic', 'Hungary',
        'Romania', 'Bulgaria', 'Greece', 'Turkey', 'Israel', 'India', 'China', 'Japan', 'South Korea', 'Korea',
        'Taiwan', 'Singapore', 'Thailand', 'Malaysia', 'Indonesia', 'Philippines', 'Vietnam', 'Pakistan', 'Bangladesh',
        'Sri Lanka', 'Australia', 'New Zealand', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia',
        'Peru', 'South Africa', 'Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Nigeria',
        'Kenya', 'Ethiopia', 'Ghana', 'Iran', 'Iraq', 'Ukraine', 'Russia'
    ];

    const palette = ['#0b5ea8', '#14a2a8', '#f28c28', '#e23a62', '#7e57c2', '#28a745', '#d16b00', '#00a7d0', '#7f8c8d', '#f39c12', '#16a085'];

    const appState = {
        rows: [],
        filteredRows: [],
        currentQuery: '',
        currentKeywordList: [],
        currentAuthorList: [],
        currentYearStart: null,
        currentYearEnd: null,
        analytics: null,
        charts: {}
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function setStatus(message, isError) {
        const node = byId('statusBar');
        node.textContent = message || '';
        node.classList.toggle('error', Boolean(isError));
    }

    function normalizeText(value) {
        return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function safeNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function splitPipe(value) {
        return String(value || '')
            .split('|')
            .map(part => part.trim())
            .filter(Boolean);
    }

    function parseAuthors(value) {
        return splitPipe(value)
            .map(name => name.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
    }

    function parseCommaList(value) {
        return String(value || '')
            .split(',')
            .map(part => part.trim())
            .filter(Boolean);
    }

    function parseYear(row) {
        const direct = safeNumber(row.year);
        if (direct && direct > 1900 && direct < 2100) {
            return String(Math.round(direct));
        }

        const pubDate = String(row.pubdate || '');
        const match = pubDate.match(/(19|20)\d{2}/);
        return match ? match[0] : '';
    }

    function toCountMap(items) {
        const map = new Map();
        items.forEach((item) => {
            const key = String(item || '').trim();
            if (!key) {
                return;
            }
            map.set(key, (map.get(key) || 0) + 1);
        });
        return map;
    }

    function topEntries(map, limit) {
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
    }

    function percent(value) {
        if (!Number.isFinite(value)) {
            return '0.0%';
        }
        return `${value.toFixed(1)}%`;
    }

    function capLabels(entries, maxLength) {
        return entries.map(item => {
            const text = String(item || '');
            if (text.length <= maxLength) {
                return text;
            }
            return `${text.slice(0, maxLength - 1)}...`;
        });
    }

    function ensureSeries(labels, values, fallbackLabel) {
        if (labels.length && values.length) {
            return { labels, values };
        }
        return { labels: [fallbackLabel || 'No data'], values: [0] };
    }

    async function pubmedJson(path, params) {
        if (window.PubMedClient && typeof window.PubMedClient.requestJson === 'function') {
            return window.PubMedClient.requestJson(path, params);
        }

        const query = new URLSearchParams(params || {});
        const url = `${PUBMED_BASE}/${path}?${query.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`PubMed request failed (${response.status})`);
        }
        return response.json();
    }

    async function pubmedText(path, params) {
        if (window.PubMedClient && typeof window.PubMedClient.requestText === 'function') {
            return window.PubMedClient.requestText(path, params);
        }

        const query = new URLSearchParams(params || {});
        const url = `${PUBMED_BASE}/${path}?${query.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`PubMed request failed (${response.status})`);
        }
        return response.text();
    }

    function escapePubMedTerm(value) {
        return String(value || '').replace(/["']/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function buildPubMedTerm(keywordList, authorList) {
        const rochesterMinnesotaScope = '(Rochester[AD] AND (Minnesota[AD] OR MN[AD]))';
        const keywordQuery = keywordList
            .map((item) => {
                const term = escapePubMedTerm(item);
                return term
                    ? `(${term}[All Fields] OR ${term}[Title/Abstract] OR ${term}[MeSH Terms])`
                    : '';
            })
            .filter(Boolean)
            .join(' OR ');

        const authorQuery = authorList
            .map((item) => {
                const term = escapePubMedTerm(item);
                return term ? `(${term}[Author] OR ${term}[Author - Full])` : '';
            })
            .filter(Boolean)
            .join(' OR ');

        const clauses = [];
        if (keywordQuery) {
            clauses.push(`(${keywordQuery})`);
        }
        if (authorQuery) {
            clauses.push(`(${authorQuery})`);
        }
        clauses.push(rochesterMinnesotaScope);

        return clauses.join(' AND ');
    }

    function textContentFrom(node, selector) {
        const target = node ? node.querySelector(selector) : null;
        return target && target.textContent ? target.textContent.trim() : '';
    }

    function parsePubMedArticles(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        const articleNodes = xmlDoc.querySelectorAll('PubmedArticle');
        const rows = [];

        articleNodes.forEach((articleNode) => {
            const pmid = textContentFrom(articleNode, 'PMID');
            const title = textContentFrom(articleNode, 'ArticleTitle');
            const journal = textContentFrom(articleNode, 'Journal > Title') || textContentFrom(articleNode, 'ISOAbbreviation');
            const abstract = Array.from(articleNode.querySelectorAll('AbstractText'))
                .map(node => (node.textContent || '').trim())
                .filter(Boolean)
                .join(' ');

            const year = textContentFrom(articleNode, 'PubDate > Year')
                || textContentFrom(articleNode, 'ArticleDate > Year')
                || textContentFrom(articleNode, 'DateCompleted > Year')
                || textContentFrom(articleNode, 'DateRevised > Year');
            const month = textContentFrom(articleNode, 'PubDate > Month');
            const day = textContentFrom(articleNode, 'PubDate > Day');
            const pubdate = [month, day, year].filter(Boolean).join(' ').trim() || year;

            const authors = [];
            const affiliations = [];
            const rochesterAuthors = [];

            articleNode.querySelectorAll('AuthorList > Author').forEach((authorNode) => {
                const fore = textContentFrom(authorNode, 'ForeName');
                const last = textContentFrom(authorNode, 'LastName');
                const collective = textContentFrom(authorNode, 'CollectiveName');
                const authorName = normalizeText(`${fore} ${last}`) ? `${fore} ${last}`.trim() : collective;
                if (authorName) {
                    authors.push(authorName);
                }

                const authorAffs = Array.from(authorNode.querySelectorAll('AffiliationInfo > Affiliation'))
                    .map(node => (node.textContent || '').trim())
                    .filter(Boolean);
                authorAffs.forEach((aff) => affiliations.push(aff));

                const hasRochesterAff = authorAffs.some((aff) => /rochester/i.test(aff) && /(minnesota|\bmn\b)/i.test(aff));
                if (hasRochesterAff && authorName) {
                    rochesterAuthors.push(authorName);
                }
            });

            const meshTerms = Array.from(articleNode.querySelectorAll('MeshHeadingList > MeshHeading > DescriptorName'))
                .map(node => (node.textContent || '').trim())
                .filter(Boolean);

            rows.push({
                pmid,
                title,
                abstract,
                journal,
                pubdate,
                year,
                month,
                day,
                authors: authors.join('|'),
                rochester_authors: Array.from(new Set(rochesterAuthors)).join('|'),
                affiliations: Array.from(new Set(affiliations)).join('|'),
                authors_display: authors.slice(0, 12).join(', '),
                url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/` : 'https://pubmed.ncbi.nlm.nih.gov/',
                llm_summary: '',
                primary_specialty: meshTerms[0] || '',
                secondary_specialty: meshTerms[1] || ''
            });
        });

        return rows;
    }

    function prettifyState(abbrev) {
        return STATE_MAP[abbrev] || abbrev;
    }

    function detectUSState(aff) {
        const source = String(aff || '');
        const normalized = source.toUpperCase();

        const allCodes = Object.keys(STATE_MAP);
        for (let i = 0; i < allCodes.length; i += 1) {
            const code = allCodes[i];
            const pattern = new RegExp(`[,\\s]${code}(?:[,\\s]|$)`);
            if (pattern.test(normalized)) {
                return code;
            }
        }

        const names = Object.entries(STATE_MAP);
        for (let i = 0; i < names.length; i += 1) {
            const stateName = names[i][1];
            const pattern = new RegExp(`\\b${stateName}\\b`, 'i');
            if (pattern.test(source)) {
                return names[i][0];
            }
        }

        return '';
    }

    function detectCountry(aff) {
        const source = String(aff || '');
        const lowered = source.toLowerCase();

        if (/\b(united states|u\.s\.a\.|usa|u\.s\.)\b/i.test(source)) {
            return 'United States';
        }

        if (/\bmn\b/i.test(source) || /\bminnesota\b/i.test(source)) {
            return 'United States';
        }

        for (let i = 0; i < COUNTRY_HINTS.length; i += 1) {
            const country = COUNTRY_HINTS[i];
            if (lowered.includes(country.toLowerCase())) {
                return country === 'Korea' ? 'South Korea' : country;
            }
        }

        const parts = source.split(',').map(part => part.trim()).filter(Boolean);
        if (!parts.length) {
            return '';
        }

        const tail = parts[parts.length - 1];
        if (/^[A-Za-z ]{3,30}$/.test(tail) && !/^\d+$/.test(tail)) {
            return tail;
        }

        return '';
    }

    function extractKeywords(rows, queryTokens) {
        const counts = new Map();
        rows.forEach((row) => {
            const text = `${row.title || ''} ${row.abstract || ''}`.toLowerCase();
            const terms = text.split(/[^a-z0-9-]+/g);
            terms.forEach((term) => {
                const cleaned = term.trim();
                if (!cleaned || cleaned.length < 4 || STOPWORDS.has(cleaned) || queryTokens.includes(cleaned)) {
                    return;
                }
                counts.set(cleaned, (counts.get(cleaned) || 0) + 1);
            });
        });
        return topEntries(counts, 16);
    }

    function buildBins(authorCounts) {
        const bins = {
            '1-3 authors': 0,
            '4-6 authors': 0,
            '7-10 authors': 0,
            '11-15 authors': 0,
            '16+ authors': 0
        };

        authorCounts.forEach((count) => {
            if (count <= 3) {
                bins['1-3 authors'] += 1;
            } else if (count <= 6) {
                bins['4-6 authors'] += 1;
            } else if (count <= 10) {
                bins['7-10 authors'] += 1;
            } else if (count <= 15) {
                bins['11-15 authors'] += 1;
            } else {
                bins['16+ authors'] += 1;
            }
        });

        return bins;
    }

    function calculateAnalytics(rows, query, keywordList, authorList, filterWindowText) {
        const queryTokens = normalizeText(query).split(/\s+/g).filter(Boolean);

        const yearMap = new Map();
        const allAuthors = [];
        const allJournals = [];
        const allSpecialties = [];
        const allCountries = [];
        const allStates = [];
        const allInstitutions = [];
        const authorsPerPaper = [];
        const keywordCoverageMap = new Map();
        const authorCoverageMap = new Map();

        keywordList.forEach((kw) => keywordCoverageMap.set(kw, 0));
        authorList.forEach((auth) => authorCoverageMap.set(auth, 0));

        rows.forEach((row) => {
            const year = parseYear(row);
            if (year) {
                yearMap.set(year, (yearMap.get(year) || 0) + 1);
            }

            const haystack = row.__searchText || '';
            keywordList.forEach((kw) => {
                if (haystack.includes(normalizeText(kw))) {
                    keywordCoverageMap.set(kw, (keywordCoverageMap.get(kw) || 0) + 1);
                }
            });

            const authors = parseAuthors(row.authors);
            authorsPerPaper.push(authors.length || 1);
            authors.forEach(a => allAuthors.push(a));

            const authorHaystack = normalizeText((row.authors || '') + ' ' + (row.rochester_authors || ''));
            authorList.forEach((authorFilter) => {
                if (authorHaystack.includes(normalizeText(authorFilter))) {
                    authorCoverageMap.set(authorFilter, (authorCoverageMap.get(authorFilter) || 0) + 1);
                }
            });

            if (row.journal) {
                allJournals.push(String(row.journal).trim());
            }

            const primary = String(row.primary_specialty || '').trim();
            const secondary = String(row.secondary_specialty || '').trim();
            if (primary) {
                allSpecialties.push(primary);
            }
            if (secondary) {
                allSpecialties.push(secondary);
            }

            splitPipe(row.affiliations).forEach((aff) => {
                const firstPart = aff.split(',')[0] ? aff.split(',')[0].trim() : '';
                if (firstPart) {
                    allInstitutions.push(firstPart);
                }

                const country = detectCountry(aff);
                const state = detectUSState(aff);

                if (country && country !== 'United States') {
                    allCountries.push(country);
                }

                if (country === 'United States' && state && state !== 'MN') {
                    allStates.push(prettifyState(state));
                }
            });
        });

        const sortedYears = Array.from(yearMap.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
        const topAuthors = topEntries(toCountMap(allAuthors), 20);
        const topJournals = topEntries(toCountMap(allJournals), 15);
        const topSpecialties = topEntries(toCountMap(allSpecialties), 12);
        const topCountries = topEntries(toCountMap(allCountries), 12);
        const topStates = topEntries(toCountMap(allStates), 12);
        const topInstitutions = topEntries(toCountMap(allInstitutions), 15);
        const topKeywords = extractKeywords(rows, queryTokens);
        const keywordCoverage = topEntries(keywordCoverageMap, 30);
        const authorCoverage = topEntries(authorCoverageMap, 30);

        const uniqueAuthors = new Set(allAuthors).size;
        const uniqueJournals = new Set(allJournals).size;
        const avgAuthorsPerPaper = authorsPerPaper.length
            ? (authorsPerPaper.reduce((acc, n) => acc + n, 0) / authorsPerPaper.length)
            : 0;

        const medianAuthorsPerPaper = authorsPerPaper.length
            ? (() => {
                const sorted = authorsPerPaper.slice().sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                if (sorted.length % 2 === 0) {
                    return (sorted[mid - 1] + sorted[mid]) / 2;
                }
                return sorted[mid];
            })()
            : 0;

        const top10AuthorTotal = topAuthors.slice(0, 10).reduce((acc, item) => acc + item[1], 0);
        const totalAuthorMentions = allAuthors.length || 1;
        const top10AuthorSharePct = (top10AuthorTotal / totalAuthorMentions) * 100;

        const dateWindow = sortedYears.length
            ? `${sortedYears[0][0]}-${sortedYears[sortedYears.length - 1][0]}`
            : 'N/A';

        const yoyGrowth = [];
        for (let i = 1; i < sortedYears.length; i += 1) {
            const previousCount = sortedYears[i - 1][1];
            const currentCount = sortedYears[i][1];
            const growth = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : 0;
            yoyGrowth.push([sortedYears[i][0], growth]);
        }

        const latestYoY = yoyGrowth.length ? yoyGrowth[yoyGrowth.length - 1][1] : 0;

        const collaborationBins = buildBins(authorsPerPaper);

        return {
            total: rows.length,
            uniqueAuthors,
            uniqueJournals,
            avgAuthorsPerPaper,
            medianAuthorsPerPaper,
            dateWindow,
            filterWindowText,
            timeline: sortedYears,
            yoyGrowth,
            latestYoY,
            topAuthors,
            topJournals,
            topSpecialties,
            topCountries,
            topStates,
            topInstitutions,
            topKeywords,
            keywordCoverage,
            authorCoverage,
            collaborationBins,
            top10AuthorSharePct
        };
    }

    function chartOptionsBase() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#2b4f67',
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#49667f' },
                    grid: { color: 'rgba(76, 122, 159, 0.12)' }
                },
                y: {
                    ticks: { color: '#49667f' },
                    grid: { color: 'rgba(76, 122, 159, 0.12)' }
                }
            }
        };
    }

    function upsertChart(key, config) {
        if (appState.charts[key]) {
            appState.charts[key].destroy();
        }
        const ctx = byId(key);
        if (!ctx) {
            return;
        }
        appState.charts[key] = new Chart(ctx, config);
    }

    function barConfig(labels, data, label, horizontal) {
        const options = chartOptionsBase();
        if (horizontal) {
            options.indexAxis = 'y';
        }

        return {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    backgroundColor: labels.map((_, idx) => palette[idx % palette.length]),
                    borderRadius: 6
                }]
            },
            options
        };
    }

    function doughnutConfig(labels, data, label) {
        return {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    backgroundColor: labels.map((_, idx) => palette[idx % palette.length])
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#2b4f67',
                            font: { size: 11 }
                        }
                    }
                }
            }
        };
    }

    function lineConfig(labels, data, label) {
        const options = chartOptionsBase();
        options.plugins.legend.display = false;

        return {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    borderColor: '#0b5ea8',
                    backgroundColor: 'rgba(11, 94, 168, 0.22)',
                    fill: true,
                    tension: 0.28,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options
        };
    }

    function renderMetrics(a) {
        byId('metricCount').textContent = String(a.total);
        byId('metricDateRange').textContent = a.filterWindowText;
        byId('metricObservedYears').textContent = a.dateWindow;
        byId('metricAuthors').textContent = String(a.uniqueAuthors);
        byId('metricJournals').textContent = String(a.uniqueJournals);
        byId('metricAuthorsPerPaper').textContent = a.avgAuthorsPerPaper.toFixed(1);
        byId('metricAuthorShare').textContent = percent(a.top10AuthorSharePct);
        byId('metricYoY').textContent = percent(a.latestYoY);
    }

    function renderTable(id, headers, rows) {
        const table = byId(id);
        if (!table) {
            return;
        }

        const headerHtml = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        const bodyRows = rows.length
            ? rows.map((row) => `<tr>${row.map(col => `<td>${String(col)}</td>`).join('')}</tr>`).join('')
            : '<tr><td colspan="3">No data available</td></tr>';
        table.innerHTML = `${headerHtml}<tbody>${bodyRows}</tbody>`;
    }

    function createInsights(a, query, keywords, authors) {
        const list = [];

        if (!a.total) {
            list.push('No publications matched this query from live PubMed results.');
            return list;
        }

        list.push(`Filter window is ${a.filterWindowText}; observed publication years in results are ${a.dateWindow}.`);

        const peakYear = a.timeline.length
            ? a.timeline.reduce((best, row) => (row[1] > best[1] ? row : best), a.timeline[0])
            : null;

        if (peakYear) {
            list.push(`Peak publication year is ${peakYear[0]} with ${peakYear[1]} publications for "${query}".`);
        }

        if (a.topAuthors[0]) {
            list.push(`Most frequent author is ${a.topAuthors[0][0]} (${a.topAuthors[0][1]} publications).`);
        }

        list.push(`Top 10 authors account for ${percent(a.top10AuthorSharePct)} of all author mentions in this result set.`);

        if (a.topJournals[0]) {
            list.push(`Top outlet is ${a.topJournals[0][0]} with ${a.topJournals[0][1]} records.`);
        }

        if (a.topInstitutions[0]) {
            list.push(`Most represented institution segment is ${a.topInstitutions[0][0]} (${a.topInstitutions[0][1]} affiliation mentions).`);
        }

        if (a.topCountries[0]) {
            list.push(`Strong international footprint from ${a.topCountries[0][0]} (${a.topCountries[0][1]} affiliations, US excluded).`);
        } else {
            list.push('No non-US country affiliations were detected for this query.');
        }

        if (a.topStates[0]) {
            list.push(`US collaboration outside Minnesota is led by ${a.topStates[0][0]} (${a.topStates[0][1]} affiliations).`);
        } else {
            list.push('No US state signals outside Minnesota were detected for this query.');
        }

        list.push(`Average team size is ${a.avgAuthorsPerPaper.toFixed(1)} authors per publication (median ${a.medianAuthorsPerPaper.toFixed(1)}).`);

        if (a.yoyGrowth.length) {
            list.push(`Latest year-over-year publication growth is ${percent(a.latestYoY)}.`);
        }

        if (keywords.length) {
            const topKeyword = a.keywordCoverage[0];
            if (topKeyword) {
                list.push(`Most represented keyword from your list is "${topKeyword[0]}" (${topKeyword[1]} matched publications).`);
            }
        }

        if (authors.length) {
            const topAuthor = a.authorCoverage[0];
            if (topAuthor) {
                list.push(`Most represented author from your list is "${topAuthor[0]}" (${topAuthor[1]} matched publications).`);
            }
        }
        return list;
    }

    function renderInsights(list) {
        const node = byId('insightsList');
        node.innerHTML = list.map(item => `<li>${item}</li>`).join('');
    }

    function renderCharts(a) {
        const timeline = ensureSeries(
            a.timeline.map(item => item[0]),
            a.timeline.map(item => item[1]),
            'No data'
        );

        upsertChart('chartTimeline', lineConfig(
            timeline.labels,
            timeline.values,
            'Publication count'
        ));

        const topAuthors = ensureSeries(
            capLabels(a.topAuthors.slice(0, 14).map(item => item[0]), 28),
            a.topAuthors.slice(0, 14).map(item => item[1]),
            'No data'
        );
        upsertChart('chartAuthors', barConfig(
            topAuthors.labels,
            topAuthors.values,
            'Publications',
            true
        ));

        const topJournals = ensureSeries(
            capLabels(a.topJournals.slice(0, 12).map(item => item[0]), 30),
            a.topJournals.slice(0, 12).map(item => item[1]),
            'No data'
        );
        upsertChart('chartJournals', barConfig(
            topJournals.labels,
            topJournals.values,
            'Publications',
            true
        ));

        const topSpecialties = ensureSeries(
            capLabels(a.topSpecialties.slice(0, 8).map(item => item[0]), 24),
            a.topSpecialties.slice(0, 8).map(item => item[1]),
            'No data'
        );
        upsertChart('chartSpecialties', doughnutConfig(
            topSpecialties.labels,
            topSpecialties.values,
            'Specialty count'
        ));

        const topCountries = ensureSeries(
            a.topCountries.slice(0, 10).map(item => item[0]),
            a.topCountries.slice(0, 10).map(item => item[1]),
            'No data'
        );
        upsertChart('chartCountries', doughnutConfig(
            topCountries.labels,
            topCountries.values,
            'Affiliations'
        ));

        const topStates = ensureSeries(
            a.topStates.slice(0, 10).map(item => item[0]),
            a.topStates.slice(0, 10).map(item => item[1]),
            'No data'
        );
        upsertChart('chartStates', barConfig(
            topStates.labels,
            topStates.values,
            'Affiliations',
            true
        ));

        const topKeywords = ensureSeries(
            a.topKeywords.slice(0, 12).map(item => item[0]),
            a.topKeywords.slice(0, 12).map(item => item[1]),
            'No data'
        );
        upsertChart('chartKeywords', barConfig(
            topKeywords.labels,
            topKeywords.values,
            'Mentions',
            true
        ));

        const bins = a.collaborationBins;
        upsertChart('chartCollaboration', barConfig(
            Object.keys(bins),
            Object.values(bins),
            'Publication count',
            false
        ));

        const topInstitutions = ensureSeries(
            capLabels(a.topInstitutions.slice(0, 12).map(item => item[0]), 32),
            a.topInstitutions.slice(0, 12).map(item => item[1]),
            'No data'
        );
        upsertChart('chartInstitutions', barConfig(
            topInstitutions.labels,
            topInstitutions.values,
            'Affiliation mentions',
            true
        ));

        const yoy = ensureSeries(
            a.yoyGrowth.map(item => item[0]),
            a.yoyGrowth.map(item => Number(item[1].toFixed(1))),
            'No data'
        );
        upsertChart('chartYoY', barConfig(
            yoy.labels,
            yoy.values,
            'Growth %',
            false
        ));
    }

    function updateTables(a) {
        renderTable(
            'authorsTable',
            ['Rank', 'Author', 'Publication Count'],
            a.topAuthors.slice(0, 20).map((item, idx) => [idx + 1, item[0], item[1]])
        );

        const geoRows = [];
        a.topCountries.slice(0, 10).forEach((item, idx) => {
            geoRows.push([`Country ${idx + 1}`, item[0], item[1]]);
        });
        a.topStates.slice(0, 10).forEach((item, idx) => {
            geoRows.push([`State ${idx + 1}`, item[0], item[1]]);
        });

        renderTable('geoTable', ['Type/Rank', 'Location', 'Count'], geoRows);

        renderTable(
            'authorCoverageTable',
            ['Rank', 'Input Author', 'Matched Publications'],
            a.authorCoverage.length
                ? a.authorCoverage.map((item, idx) => [idx + 1, item[0], item[1]])
                : [['-', 'No author filter provided', '-']]
        );

        const concentrationRows = [];
        a.topInstitutions.slice(0, 10).forEach((item, idx) => {
            concentrationRows.push([`Institution ${idx + 1}`, item[0], item[1]]);
        });
        a.topJournals.slice(0, 10).forEach((item, idx) => {
            concentrationRows.push([`Journal ${idx + 1}`, item[0], item[1]]);
        });

        renderTable('concentrationTable', ['Type/Rank', 'Name', 'Count'], concentrationRows);
    }

    function queryRows(rows, keywordList, authorList, yearStart, yearEnd) {
        if (!keywordList.length) {
            return [];
        }

        const normalizedKeywords = keywordList.map(item => normalizeText(item));
        const normalizedAuthors = authorList.map(item => normalizeText(item));

        return rows.filter((row) => {
            const year = Number(parseYear(row));
            if (Number.isFinite(year)) {
                if (year < yearStart || year > yearEnd) {
                    return false;
                }
            }

            const haystack = row.__searchText || '';
            const keywordMatch = normalizedKeywords.some(token => haystack.includes(token));
            if (!keywordMatch) {
                return false;
            }

            if (!normalizedAuthors.length) {
                return true;
            }

            const authorField = normalizeText((row.authors || '') + ' ' + (row.rochester_authors || ''));
            return normalizedAuthors.some(author => authorField.includes(author));
        });
    }

    function buildSearchText(row) {
        const bucket = [
            row.title,
            row.abstract,
            row.journal,
            row.authors,
            row.rochester_authors,
            row.affiliations,
            row.llm_summary,
            row.primary_specialty,
            row.secondary_specialty
        ];
        return normalizeText(bucket.join(' '));
    }

    async function fetchPmidsForYear(pubmedTerm, year) {
        const pmids = [];
        let retstart = 0;

        while (pmids.length < PUBMED_MAX_PMIDS) {
            const searchJson = await pubmedJson('esearch.fcgi', {
                db: 'pubmed',
                term: `${pubmedTerm} AND ("${year}/01/01"[Date - Publication] : "${year}/12/31"[Date - Publication])`,
                retmode: 'json',
                retmax: PUBMED_SEARCH_PAGE_SIZE,
                retstart,
                sort: 'pub+date'
            });

            const result = (searchJson || {}).esearchresult || {};
            const idList = Array.isArray(result.idlist) ? result.idlist : [];
            if (!idList.length) {
                break;
            }

            pmids.push(...idList);
            if (idList.length < PUBMED_SEARCH_PAGE_SIZE) {
                break;
            }

            retstart += PUBMED_SEARCH_PAGE_SIZE;
        }

        return pmids.slice(0, PUBMED_MAX_PMIDS);
    }

    async function fetchRowsFromPubMed(keywordList, authorList, yearStart, yearEnd) {
        const term = buildPubMedTerm(keywordList, authorList);
        const allPmids = [];

        for (let year = yearStart; year <= yearEnd; year += 1) {
            const yearPmids = await fetchPmidsForYear(term, year);
            allPmids.push(...yearPmids);
        }

        const uniquePmids = Array.from(new Set(allPmids)).slice(0, PUBMED_MAX_PMIDS);
        if (!uniquePmids.length) {
            return [];
        }

        let xmlChunks = [];
        if (window.PubMedClient && typeof window.PubMedClient.fetchEfetchXmlByPmids === 'function') {
            xmlChunks = await window.PubMedClient.fetchEfetchXmlByPmids(uniquePmids, PUBMED_FETCH_CHUNK_SIZE);
        } else {
            for (let index = 0; index < uniquePmids.length; index += PUBMED_FETCH_CHUNK_SIZE) {
                const chunk = uniquePmids.slice(index, index + PUBMED_FETCH_CHUNK_SIZE);
                const xml = await pubmedText('efetch.fcgi', {
                    db: 'pubmed',
                    id: chunk.join(','),
                    retmode: 'xml'
                });
                xmlChunks.push(xml);
            }
        }

        const rows = [];
        xmlChunks.forEach((xml) => {
            parsePubMedArticles(xml).forEach((row) => {
                row.__searchText = buildSearchText(row);
                rows.push(row);
            });
        });

        return rows;
    }

    function resolveYearWindow() {
        const startInput = byId('yearStartInput');
        const endInput = byId('yearEndInput');
        const nowYear = new Date().getFullYear();

        let yearStart = Number(startInput.value);
        let yearEnd = Number(endInput.value);

        if (!Number.isFinite(yearStart)) {
            yearStart = nowYear - 9;
        }
        if (!Number.isFinite(yearEnd)) {
            yearEnd = nowYear;
        }
        if (yearStart > yearEnd) {
            const temp = yearStart;
            yearStart = yearEnd;
            yearEnd = temp;
        }

        startInput.value = String(yearStart);
        endInput.value = String(yearEnd);
        return { yearStart, yearEnd };
    }

    function keywordSummary(keywordList, authorList) {
        const k = keywordList.length ? keywordList.join(', ') : '(no keywords)';
        const a = authorList.length ? ` | authors: ${authorList.join(', ')}` : ' | authors: (none)';
        return `${k}${a}`;
    }

    async function runAnalysis() {
        const keywordList = parseCommaList(byId('keywordsInput').value);
        const authorList = parseCommaList(byId('authorsInput').value);
        const yearWindow = resolveYearWindow();

        appState.currentKeywordList = keywordList;
        appState.currentAuthorList = authorList;
        appState.currentYearStart = yearWindow.yearStart;
        appState.currentYearEnd = yearWindow.yearEnd;
        appState.currentQuery = keywordSummary(keywordList, authorList);

        if (!keywordList.length && !authorList.length) {
            setStatus('Enter at least one keyword or one author of interest.', true);
            return;
        }

        try {
            setStatus('Querying PubMed on demand and building analytics...', false);
            const liveRows = await fetchRowsFromPubMed(
                keywordList,
                authorList,
                yearWindow.yearStart,
                yearWindow.yearEnd
            );

            appState.rows = liveRows;

            // PubMed query already applies keyword/author/date constraints, so avoid extra client-side narrowing.
            const filtered = liveRows;
            appState.filteredRows = filtered;

            const filterWindowText = `${yearWindow.yearStart}-${yearWindow.yearEnd}`;
            const analytics = calculateAnalytics(filtered, appState.currentQuery, keywordList, authorList, filterWindowText);
            appState.analytics = analytics;

            renderMetrics(analytics);
            renderCharts(analytics);
            updateTables(analytics);

            const insights = createInsights(analytics, appState.currentQuery, keywordList, authorList);
            renderInsights(insights);

            if (!analytics.total) {
                setStatus('No matching publications were returned by PubMed for this query and date range.', true);
                return;
            }

            setStatus(`Completed analysis for ${analytics.total} PubMed publications in ${filterWindowText}.`, false);
        } catch (error) {
            const message = error && error.message ? error.message : 'Unknown PubMed request error';
            setStatus(`PubMed query failed: ${message}`, true);
        }
    }

    function chartImage(id) {
        const chart = appState.charts[id];
        if (!chart) {
            return '';
        }
        return chart.toBase64Image();
    }

    function formatTableRows(entries, headers) {
        const head = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        const body = entries.length
            ? entries.map(row => `<tr>${row.map(col => `<td>${String(col)}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${headers.length}">No data</td></tr>`;

        return `<table>${head}${body}</table>`;
    }

    function buildWordHtml() {
        const a = appState.analytics;
        const query = appState.currentQuery;
        const today = new Date().toLocaleDateString();
        const insights = createInsights(a, query, appState.currentKeywordList, appState.currentAuthorList);

        const keywordLine = appState.currentKeywordList.join(', ');
        const authorLine = appState.currentAuthorList.length ? appState.currentAuthorList.join(', ') : 'None specified';

        return [
            '<!DOCTYPE html>',
            '<html>',
            '<head>',
            '<meta charset="utf-8"/>',
            '<style>',
            'body{font-family:Segoe UI, Arial, sans-serif;color:#1f3447;line-height:1.35;}',
            'h1{color:#0b5ea8;font-size:30px;margin-bottom:6px;}',
            'h2{color:#0f5f8f;font-size:20px;margin-top:24px;}',
            '.meta{font-size:13px;color:#5f6f7d;margin-bottom:18px;}',
            '.kpi{display:inline-block;padding:10px 12px;margin:4px;border:1px solid #d4e3ef;border-radius:8px;background:#f7fbff;}',
            '.chart{margin:14px 0 22px;page-break-inside:avoid;}',
            '.chart img{max-width:100%;height:auto;border:1px solid #d7e4ef;border-radius:8px;}',
            'table{border-collapse:collapse;width:100%;margin:8px 0 18px;font-size:12px;}',
            'th,td{border:1px solid #d9e7f2;padding:6px;text-align:left;}',
            'th{background:#f3f8fc;}',
            'ul{margin-top:6px;}',
            '</style>',
            '</head>',
            '<body>',
            `<h1>MedCityAI Explore Report</h1>`,
            `<div class="meta">Query Summary: <strong>${query}</strong><br/>Keywords: ${keywordLine}<br/>Authors of Interest: ${authorLine}<br/>Date Filter: ${a.filterWindowText}<br/>Observed Years: ${a.dateWindow}<br/>Generated: ${today}<br/>Data Source: PubMed E-utilities (live query)</div>`,
            `<div class="kpi"><strong>Matched Publications</strong><br/>${a.total}</div>`,
            `<div class="kpi"><strong>Filter Window</strong><br/>${a.filterWindowText}</div>`,
            `<div class="kpi"><strong>Observed Years</strong><br/>${a.dateWindow}</div>`,
            `<div class="kpi"><strong>Unique Authors</strong><br/>${a.uniqueAuthors}</div>`,
            `<div class="kpi"><strong>Unique Journals</strong><br/>${a.uniqueJournals}</div>`,
            `<div class="kpi"><strong>Avg Authors/Paper</strong><br/>${a.avgAuthorsPerPaper.toFixed(1)}</div>`,
            `<div class="kpi"><strong>Median Authors/Paper</strong><br/>${a.medianAuthorsPerPaper.toFixed(1)}</div>`,
            `<div class="kpi"><strong>Top 10 Author Share</strong><br/>${percent(a.top10AuthorSharePct)}</div>`,
            `<div class="kpi"><strong>Latest YoY Growth</strong><br/>${percent(a.latestYoY)}</div>`,
            '<h2>Executive Insights</h2>',
            `<ul>${insights.map(i => `<li>${i}</li>`).join('')}</ul>`,
            '<h2>Visual Analytics</h2>',
            `<div class="chart"><h3>Publication Volume Over Time</h3><img src="${chartImage('chartTimeline')}"/></div>`,
            `<div class="chart"><h3>Most Frequent Authors</h3><img src="${chartImage('chartAuthors')}"/></div>`,
            `<div class="chart"><h3>Top Journals</h3><img src="${chartImage('chartJournals')}"/></div>`,
            `<div class="chart"><h3>Specialty Mix</h3><img src="${chartImage('chartSpecialties')}"/></div>`,
            `<div class="chart"><h3>Country Distribution (Excluding US)</h3><img src="${chartImage('chartCountries')}"/></div>`,
            `<div class="chart"><h3>US State Distribution (Excluding MN)</h3><img src="${chartImage('chartStates')}"/></div>`,
            `<div class="chart"><h3>Top Technical Terms</h3><img src="${chartImage('chartKeywords')}"/></div>`,
            `<div class="chart"><h3>Co-Author Depth Distribution</h3><img src="${chartImage('chartCollaboration')}"/></div>`,
            `<div class="chart"><h3>Top Institutions</h3><img src="${chartImage('chartInstitutions')}"/></div>`,
            `<div class="chart"><h3>Year-over-Year Growth %</h3><img src="${chartImage('chartYoY')}"/></div>`,
            '<h2>Top Author Table</h2>',
            formatTableRows(a.topAuthors.slice(0, 30).map((item, idx) => [idx + 1, item[0], item[1]]), ['Rank', 'Author', 'Publication Count']),
            '<h2>Top Journals Table</h2>',
            formatTableRows(a.topJournals.slice(0, 25).map((item, idx) => [idx + 1, item[0], item[1]]), ['Rank', 'Journal', 'Publication Count']),
            '<h2>Keyword and Author Coverage</h2>',
            formatTableRows(a.keywordCoverage.map((item, idx) => [idx + 1, item[0], item[1]]), ['Rank', 'Keyword', 'Matched Publications']),
            formatTableRows(a.authorCoverage.map((item, idx) => [idx + 1, item[0], item[1]]), ['Rank', 'Author', 'Matched Publications']),
            '<h2>Geography Table</h2>',
            formatTableRows(
                a.topCountries.slice(0, 20).map((item, idx) => [`Country ${idx + 1}`, item[0], item[1]])
                    .concat(a.topStates.slice(0, 20).map((item, idx) => [`State ${idx + 1}`, item[0], item[1]])),
                ['Type/Rank', 'Location', 'Count']
            ),
            '<h2>Specialty and Institution Table</h2>',
            formatTableRows(a.topSpecialties.slice(0, 20).map((item, idx) => [idx + 1, item[0], item[1]]), ['Rank', 'Specialty', 'Count']),
            formatTableRows(a.topInstitutions.slice(0, 20).map((item, idx) => [idx + 1, item[0], item[1]]), ['Rank', 'Institution Segment', 'Count']),
            '<p style="font-size:11px;color:#6b7d8c;">Geographic parsing is based on affiliation-string heuristics and may include minor normalization errors.</p>',
            '</body>',
            '</html>'
        ].join('');
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function toSafeFileLabel(value) {
        return String(value || 'report').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 70);
    }

    function exportWordReport() {
        if (!appState.analytics || !appState.analytics.total) {
            setStatus('Run an analysis first, then export the Word report.', true);
            return;
        }

        const html = buildWordHtml();
        const stamp = new Date().toISOString().slice(0, 10);
        const queryLabel = toSafeFileLabel(appState.currentQuery || 'topic');

        if (window.htmlDocx && typeof window.htmlDocx.asBlob === 'function') {
            const blob = window.htmlDocx.asBlob(html);
            downloadBlob(blob, `Explore_Report_${queryLabel}_${stamp}.docx`);
            setStatus('Word report exported successfully with embedded charts and tables.', false);
            return;
        }

        const fallbackBlob = new Blob([html], { type: 'application/msword' });
        downloadBlob(fallbackBlob, `Explore_Report_${queryLabel}_${stamp}.doc`);
        setStatus('Exported as .doc (fallback mode).', false);
    }

    function bindEvents() {
        byId('runExploreBtn').addEventListener('click', runAnalysis);
        byId('exportWordBtn').addEventListener('click', exportWordReport);

        byId('keywordsInput').addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                runAnalysis();
            }
        });

        byId('authorsInput').addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                runAnalysis();
            }
        });

        document.querySelectorAll('.quick-tag').forEach((button) => {
            button.addEventListener('click', () => {
                byId('keywordsInput').value = button.getAttribute('data-query') || '';
                runAnalysis();
            });
        });
    }

    function initializeDefaultDateWindow() {
        const nowYear = new Date().getFullYear();
        byId('yearStartInput').value = String(nowYear - 9);
        byId('yearEndInput').value = String(nowYear);
    }

    async function initialize() {
        setStatus('Explore is ready. Enter keywords to fetch PubMed data on demand.', false);
        bindEvents();
        initializeDefaultDateWindow();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
