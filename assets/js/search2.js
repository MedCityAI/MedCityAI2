(function () {
    'use strict';

    const SOURCE_CONFIG = {
        publications: {
            label: 'Publications',
            icon: 'fas fa-book-medical',
            loading: 'Searching PubMed for Rochester-linked publications...',
            subtitle: 'PubMed (NCBI) biomedical literature',
            placeholder: 'Try: stroke rehabilitation, CAR-T, Mayo Clinic AI'
        },
        clinical_trials: {
            label: 'Clinical Trials',
            icon: 'fas fa-vials',
            loading: 'Searching ClinicalTrials.gov studies...',
            subtitle: 'ClinicalTrials.gov interventional and observational studies',
            placeholder: 'Try: glioblastoma immunotherapy, type 1 diabetes, rare disease'
        },
        patents: {
            label: 'Patents',
            icon: 'fas fa-lightbulb',
            loading: 'Searching USPTO patent applications...',
            subtitle: 'USPTO open data for patent applications',
            placeholder: 'Try: medical imaging AI, robotic surgery, digital therapeutics'
        }
    };

    const state = {
        source: 'publications',
        query: '',
        lastError: ''
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function firstNonEmpty() {
        for (let i = 0; i < arguments.length; i++) {
            const value = arguments[i];
            if (value === null || value === undefined) {
                continue;
            }
            const trimmed = String(value).trim();
            if (trimmed) {
                return trimmed;
            }
        }
        return '';
    }

    function snippet(text, maxLen) {
        const raw = String(text || '').trim();
        if (!raw) {
            return '';
        }
        if (raw.length <= maxLen) {
            return raw;
        }
        return raw.slice(0, maxLen - 1).trim() + '...';
    }

    function formatDate(value) {
        const text = String(value || '').trim();
        if (!text) {
            return 'Date unavailable';
        }
        const date = new Date(text);
        if (Number.isNaN(date.getTime())) {
            return text;
        }
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function setSource(nextSource) {
        if (!SOURCE_CONFIG[nextSource]) {
            return;
        }
        state.source = nextSource;

        const sourceCards = document.querySelectorAll('.source-card');
        sourceCards.forEach((card) => {
            const isActive = card.getAttribute('data-source') === nextSource;
            card.classList.toggle('active', isActive);
            card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        const cfg = SOURCE_CONFIG[nextSource];
        byId('activeSourceName').textContent = cfg.label;
        byId('activeSourceSubtitle').textContent = cfg.subtitle;
        byId('queryInput').setAttribute('placeholder', cfg.placeholder);

        const params = new URLSearchParams(window.location.search);
        params.set('source', nextSource);
        if (state.query) {
            params.set('q', state.query);
        }
        const newUrl = window.location.pathname + '?' + params.toString();
        window.history.replaceState({}, '', newUrl);
    }

    function setStatus(message, isError) {
        const status = byId('statusBar');
        status.textContent = message || '';
        status.classList.toggle('error', Boolean(isError));
    }

    function showLoading(on) {
        byId('loadingState').style.display = on ? 'block' : 'none';
    }

    function renderResults(items) {
        const results = byId('resultsList');
        const count = byId('resultCount');
        count.textContent = String(items.length);

        if (!items.length) {
            results.innerHTML = [
                '<article class="empty-card">',
                '  <h3>No results found</h3>',
                '  <p>Try a broader concept, a disease synonym, or another source.</p>',
                '</article>'
            ].join('');
            return;
        }

        results.innerHTML = items.map((item, idx) => {
            const tags = (item.tags || []).slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
            const meta = (item.meta || []).map((entry) => `<span>${escapeHtml(entry)}</span>`).join('');
            const description = item.description
                ? `<p class="result-description">${escapeHtml(item.description)}</p>`
                : '';

            return [
                '<article class="result-card">',
                `  <div class="result-index">${idx + 1}</div>`,
                `  <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>`,
                `  <p class="result-subtitle">${escapeHtml(item.subtitle || '')}</p>`,
                `  ${description}`,
                `  <div class="result-meta">${meta}</div>`,
                `  <div class="result-tags">${tags}</div>`,
                `  <div class="result-actions"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open source record</a></div>`,
                '</article>'
            ].join('');
        }).join('');
    }

    async function requestJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Request failed (${response.status})`);
        }
        return response.json();
    }

    async function requestText(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Request failed (${response.status})`);
        }
        return response.text();
    }

    async function pubmedJson(path, params) {
        if (window.PubMedClient && typeof window.PubMedClient.requestJson === 'function') {
            return window.PubMedClient.requestJson(path, params);
        }
        const q = new URLSearchParams(params || {});
        const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${path}?${q.toString()}`;
        return requestJson(url);
    }

    async function pubmedText(path, params) {
        if (window.PubMedClient && typeof window.PubMedClient.requestText === 'function') {
            return window.PubMedClient.requestText(path, params);
        }
        const q = new URLSearchParams(params || {});
        const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${path}?${q.toString()}`;
        return requestText(url);
    }

    function parsePubMedArticles(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        const nodes = xmlDoc.querySelectorAll('PubmedArticle');
        const items = [];

        nodes.forEach((node) => {
            const pmid = firstNonEmpty(node.querySelector('PMID') && node.querySelector('PMID').textContent);
            const title = firstNonEmpty(node.querySelector('ArticleTitle') && node.querySelector('ArticleTitle').textContent, 'Untitled publication');

            let abstract = '';
            const abstractNodes = node.querySelectorAll('AbstractText');
            abstractNodes.forEach((absNode) => {
                if (absNode.textContent) {
                    abstract += (abstract ? ' ' : '') + absNode.textContent;
                }
            });

            const journal = firstNonEmpty(
                node.querySelector('Journal Title') && node.querySelector('Journal Title').textContent,
                node.querySelector('ISOAbbreviation') && node.querySelector('ISOAbbreviation').textContent,
                'Journal not specified'
            );

            const year = firstNonEmpty(node.querySelector('PubDate Year') && node.querySelector('PubDate Year').textContent);
            const month = firstNonEmpty(node.querySelector('PubDate Month') && node.querySelector('PubDate Month').textContent);
            const day = firstNonEmpty(node.querySelector('PubDate Day') && node.querySelector('PubDate Day').textContent);
            const pubDate = firstNonEmpty([month, day, year].filter(Boolean).join(' '), year, 'Date unavailable');

            const authors = [];
            node.querySelectorAll('Author').forEach((authorNode) => {
                const last = firstNonEmpty(authorNode.querySelector('LastName') && authorNode.querySelector('LastName').textContent);
                const fore = firstNonEmpty(authorNode.querySelector('ForeName') && authorNode.querySelector('ForeName').textContent);
                const collective = firstNonEmpty(authorNode.querySelector('CollectiveName') && authorNode.querySelector('CollectiveName').textContent);
                const fullName = firstNonEmpty((fore + ' ' + last).trim(), collective);
                if (fullName) {
                    authors.push(fullName);
                }
            });

            const authorText = authors.length ? authors.slice(0, 8).join(', ') + (authors.length > 8 ? ', et al.' : '') : 'Author information unavailable';

            items.push({
                title,
                subtitle: journal,
                description: snippet(abstract, 340),
                meta: [pubDate, `PMID ${pmid || 'N/A'}`, authorText],
                tags: ['Publication', 'PubMed', year || 'Recent'],
                url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/` : 'https://pubmed.ncbi.nlm.nih.gov/'
            });
        });

        return items;
    }

    async function searchPublications(query) {
        const rochesterScoped = `(${query}) AND (Rochester[AD] AND (Minnesota[AD] OR MN[AD]))`;
        const searchJson = await pubmedJson('esearch.fcgi', {
            db: 'pubmed',
            term: rochesterScoped,
            retmax: 20,
            sort: 'pub+date',
            retmode: 'json'
        });

        const ids = ((searchJson || {}).esearchresult || {}).idlist || [];
        if (!ids.length) {
            return [];
        }

        const xml = await pubmedText('efetch.fcgi', {
            db: 'pubmed',
            id: ids.join(','),
            retmode: 'xml'
        });

        return parsePubMedArticles(xml);
    }

    function mapTrial(study) {
        const protocol = study.protocolSection || {};
        const ident = protocol.identificationModule || {};
        const status = protocol.statusModule || {};
        const cond = protocol.conditionsModule || {};
        const design = protocol.designModule || {};
        const sponsorModule = protocol.sponsorCollaboratorsModule || {};

        const nctId = firstNonEmpty(ident.nctId);
        const title = firstNonEmpty(ident.briefTitle, ident.officialTitle, 'Untitled trial');
        const condition = Array.isArray(cond.conditions) ? cond.conditions.join(', ') : '';
        const sponsor = firstNonEmpty(sponsorModule.leadSponsor && sponsorModule.leadSponsor.name, 'Sponsor unavailable');
        const phase = Array.isArray(design.phases) ? design.phases.join(', ') : firstNonEmpty(design.phase);
        const overallStatus = firstNonEmpty(status.overallStatus, 'Status unavailable');
        const updated = firstNonEmpty(status.lastUpdatePostDateStruct && status.lastUpdatePostDateStruct.date, status.lastUpdatePostDate);

        return {
            title,
            subtitle: condition || 'Clinical trial record',
            description: snippet(`Sponsor: ${sponsor}. Status: ${overallStatus}.`, 280),
            meta: [
                `NCT ${nctId || 'N/A'}`,
                `Status: ${overallStatus}`,
                `Updated: ${formatDate(updated)}`
            ].concat(phase ? [`Phase: ${phase}`] : []),
            tags: ['Clinical Trial', phase || 'All phases'],
            url: nctId ? `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}` : 'https://clinicaltrials.gov/'
        };
    }

    async function searchClinicalTrials(query) {
        const url = 'https://clinicaltrials.gov/api/v2/studies?query.term=' + encodeURIComponent(query) + '&pageSize=20&format=json';
        const json = await requestJson(url);
        const studies = Array.isArray(json.studies) ? json.studies : [];
        return studies.map(mapTrial);
    }

    function normalizePatentRows(json) {
        if (Array.isArray(json.results)) {
            return json.results;
        }
        if (json.response && Array.isArray(json.response.docs)) {
            return json.response.docs;
        }
        if (Array.isArray(json.patents)) {
            return json.patents;
        }
        if (Array.isArray(json.patentFileWrapperDataBag)) {
            return json.patentFileWrapperDataBag;
        }
        return [];
    }

    function mapPatent(row) {
        const title = firstNonEmpty(row.inventionTitle, row.title, row.patentTitle, 'Untitled patent application');
        const appNum = firstNonEmpty(
            row.patentApplicationNumber,
            row.appNumber,
            row.applicationNumberText,
            row.applicationNumber,
            row.applId
        );
        const filingDate = firstNonEmpty(row.filingDate, row.applicationFilingDate, row.filedDate);
        const assignee = firstNonEmpty(
            row.assigneeEntityName,
            row.assigneeName,
            row.applicantName,
            row.inventorName,
            row.inventor
        );
        const artUnit = firstNonEmpty(row.artUnit, row.groupArtUnitNumberText);
        const status = firstNonEmpty(row.applicationStatusDescriptionText, row.status);

        const link = appNum
            ? `https://patentcenter.uspto.gov/applications/${encodeURIComponent(appNum)}`
            : 'https://www.uspto.gov/patents/search';

        return {
            title,
            subtitle: assignee || 'USPTO patent application',
            description: snippet('Patent application result from USPTO open data. Use Patent Center for full file history, office actions, and prosecution events.', 280),
            meta: [
                appNum ? `Application: ${appNum}` : 'Application number unavailable',
                filingDate ? `Filed: ${formatDate(filingDate)}` : 'Filing date unavailable',
                status ? `Status: ${status}` : 'Status unavailable'
            ].concat(artUnit ? [`Art Unit: ${artUnit}`] : []),
            tags: ['Patent', 'USPTO'],
            url: link
        };
    }

    async function searchPatents(query) {
        const base = 'https://developer.uspto.gov/ibd-api/v1/patent/application';
        const url = base + '?searchText=' + encodeURIComponent(query) + '&start=0&rows=20';
        const json = await requestJson(url);
        return normalizePatentRows(json).map(mapPatent);
    }

    async function runSearch() {
        const queryInput = byId('queryInput');
        const query = queryInput.value.trim();
        state.query = query;

        if (query.length < 2) {
            setStatus('Enter at least 2 characters to search.', true);
            renderResults([]);
            return;
        }

        const cfg = SOURCE_CONFIG[state.source];
        setStatus(cfg.loading, false);
        showLoading(true);
        byId('resultsSection').style.display = 'block';

        try {
            let items = [];
            if (state.source === 'publications') {
                items = await searchPublications(query);
            } else if (state.source === 'clinical_trials') {
                items = await searchClinicalTrials(query);
            } else {
                items = await searchPatents(query);
            }

            renderResults(items);
            setStatus(`Showing ${items.length} ${cfg.label.toLowerCase()} results for "${query}".`, false);

            const params = new URLSearchParams(window.location.search);
            params.set('source', state.source);
            params.set('q', query);
            const newUrl = window.location.pathname + '?' + params.toString();
            window.history.replaceState({}, '', newUrl);
        } catch (error) {
            state.lastError = error && error.message ? error.message : 'Unknown request error';
            setStatus(`Search failed: ${state.lastError}. If this persists, try a different source.`, true);
            renderResults([]);
        } finally {
            showLoading(false);
        }
    }

    function bindEvents() {
        document.querySelectorAll('.source-card').forEach((btn) => {
            btn.addEventListener('click', () => {
                setSource(btn.getAttribute('data-source') || 'publications');
            });
        });

        byId('searchForm').addEventListener('submit', (event) => {
            event.preventDefault();
            runSearch();
        });

        document.querySelectorAll('.quick-query').forEach((button) => {
            button.addEventListener('click', () => {
                byId('queryInput').value = button.getAttribute('data-query') || '';
                runSearch();
            });
        });
    }

    function initFromQueryString() {
        const params = new URLSearchParams(window.location.search);
        const source = params.get('source');
        const q = params.get('q');

        if (source && SOURCE_CONFIG[source]) {
            setSource(source);
        } else {
            setSource('publications');
        }

        if (q) {
            byId('queryInput').value = q;
            runSearch();
        }
    }

    function init() {
        bindEvents();
        initFromQueryString();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
