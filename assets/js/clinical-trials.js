(function () {
    'use strict';

    const CLINICAL_TRIALS_API = {
        endpoint: window.CLINICALTRIALS_API_ENDPOINT || 'https://clinicaltrials.gov/api/v2/studies',
        apiKey: window.CLINICALTRIALS_API_KEY || window.CTGOV_API_KEY || '',
        defaultLocation: 'Rochester, Minnesota',
        pageSize: 20
    };

    const state = {
        query: '',
        page: 1,
        totalResults: 0,
        totalPages: 0,
        items: [],
        pageTokens: { 1: '' },
        nextPageToken: '',
        pageCache: new Map(),
        prefetching: new Set()
    };

    let activeController = null;
    let latestRequestSeq = 0;
    let searchDebounceTimer = null;

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

    function formatCount(value) {
        const number = Number(value || 0);
        if (!Number.isFinite(number)) {
            return '0';
        }
        return number.toLocaleString();
    }

    function setStatus(message, isError) {
        const bar = byId('statusBar');
        bar.textContent = message || '';
        bar.classList.toggle('error', Boolean(isError));
    }

    function showLoading(on) {
        byId('loadingState').style.display = on ? 'block' : 'none';
    }

    function showEmpty(on) {
        byId('emptyState').style.display = on ? 'block' : 'none';
    }

    function updateResultCount(total) {
        byId('resultCount').textContent = formatCount(total);
    }

    function getNested(obj, path, fallback) {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length; i++) {
            if (!current || typeof current !== 'object' || !(parts[i] in current)) {
                return fallback;
            }
            current = current[parts[i]];
        }

        return current;
    }

    function firstNonEmpty() {
        for (let i = 0; i < arguments.length; i++) {
            const value = arguments[i];
            if (value === null || value === undefined) {
                continue;
            }
            const text = String(value).trim();
            if (text) {
                return text;
            }
        }
        return '';
    }

    function updateUrlParams() {
        const params = new URLSearchParams(window.location.search);

        if (state.query) {
            params.set('q', state.query);
        } else {
            params.delete('q');
        }

        params.set('page', String(state.page));

        const next = window.location.pathname + '?' + params.toString();
        window.history.replaceState({}, '', next);
    }

    function normalizeQuery(value) {
        return String(value || '').trim();
    }

    function cacheKey(query, pageToken) {
        return `${normalizeQuery(query).toLowerCase()}::${String(pageToken || '')}`;
    }

    function getCachedResponse(query, pageToken) {
        const key = cacheKey(query, pageToken);
        if (!state.pageCache.has(key)) {
            return null;
        }

        const cached = state.pageCache.get(key);
        state.pageCache.delete(key);
        state.pageCache.set(key, cached);
        return cached;
    }

    function setCachedResponse(query, pageToken, response) {
        const key = cacheKey(query, pageToken);
        state.pageCache.set(key, response);

        if (state.pageCache.size > 40) {
            const oldestKey = state.pageCache.keys().next().value;
            state.pageCache.delete(oldestKey);
        }
    }

    function resetPaginationState() {
        state.page = 1;
        state.pageTokens = { 1: '' };
        state.nextPageToken = '';
        state.items = [];
        state.totalPages = 0;
        state.totalResults = 0;
    }

    function parseDate(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return 'Date unavailable';
        }
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            return raw;
        }
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function mapStudy(study) {
        const ident = getNested(study, 'protocolSection.identificationModule', {});
        const status = getNested(study, 'protocolSection.statusModule', {});
        const cond = getNested(study, 'protocolSection.conditionsModule', {});
        const sponsor = getNested(study, 'protocolSection.sponsorCollaboratorsModule', {});
        const design = getNested(study, 'protocolSection.designModule', {});

        const nctId = firstNonEmpty(ident.nctId, 'NCT unavailable');
        const title = firstNonEmpty(ident.briefTitle, ident.officialTitle, 'Untitled clinical trial');
        const leadSponsor = firstNonEmpty(getNested(sponsor, 'leadSponsor.name', ''), 'Sponsor unavailable');
        const conditions = Array.isArray(cond.conditions) ? cond.conditions.join(', ') : '';
        const phase = Array.isArray(design.phases) ? design.phases.join(', ') : firstNonEmpty(design.phase, '');
        const overallStatus = firstNonEmpty(status.overallStatus, 'Status unavailable');
        const updatedDate = firstNonEmpty(getNested(status, 'lastUpdatePostDateStruct.date', ''), status.lastUpdatePostDate, '');

        return {
            title,
            nctId,
            leadSponsor,
            conditions: firstNonEmpty(conditions, 'Condition unavailable'),
            phase: firstNonEmpty(phase, 'Phase not specified'),
            overallStatus,
            updatedDate: parseDate(updatedDate),
            url: ident.nctId
                ? 'https://clinicaltrials.gov/study/' + encodeURIComponent(ident.nctId)
                : 'https://clinicaltrials.gov/'
        };
    }

    async function requestSearch(query, pageToken, signal) {
        const headers = {};

        const params = new URLSearchParams({
            format: 'json',
            pageSize: String(CLINICAL_TRIALS_API.pageSize),
            'query.locn': CLINICAL_TRIALS_API.defaultLocation,
            'filter.advanced': 'AREA[LocationState]Minnesota',
            countTotal: 'true'
        });

        const cleanQuery = String(query || '').trim();
        if (cleanQuery) {
            params.set('query.term', cleanQuery);
        }

        const cleanToken = String(pageToken || '').trim();
        if (cleanToken) {
            params.set('pageToken', cleanToken);
        }

        if (CLINICAL_TRIALS_API.apiKey) {
            params.set('apiKey', CLINICAL_TRIALS_API.apiKey);
            headers['x-api-key'] = CLINICAL_TRIALS_API.apiKey;
        }

        const url = CLINICAL_TRIALS_API.endpoint + '?' + params.toString();
        const response = await fetch(url, {
            headers: headers,
            signal: signal
        });

        if (!response.ok) {
            throw new Error(`Search request failed (${response.status})`);
        }

        return response.json();
    }

    function prefetchNextPage(query, nextPageToken) {
        const token = String(nextPageToken || '').trim();
        if (!token) {
            return;
        }

        const key = cacheKey(query, token);
        if (state.pageCache.has(key) || state.prefetching.has(key)) {
            return;
        }

        state.prefetching.add(key);

        requestSearch(query, token)
            .then((json) => {
                setCachedResponse(query, token, json);
            })
            .catch(function () {
                // Prefetch failures are non-critical; interactive requests still run normally.
            })
            .finally(function () {
                state.prefetching.delete(key);
            });
    }

    async function ensureTokenForPage(query, targetPage) {
        if (targetPage <= 1) {
            return true;
        }

        let safetyCounter = 0;

        while (!state.pageTokens[targetPage] && safetyCounter < 300) {
            let highestKnownPage = 1;
            while (state.pageTokens[highestKnownPage + 1]) {
                highestKnownPage += 1;
            }

            const tokenForHighest = state.pageTokens[highestKnownPage];
            if (tokenForHighest === undefined) {
                return false;
            }

            const cached = getCachedResponse(query, tokenForHighest);
            const json = cached || await requestSearch(query, tokenForHighest);
            if (!cached) {
                setCachedResponse(query, tokenForHighest, json);
            }

            const nextToken = String(json && json.nextPageToken ? json.nextPageToken : '').trim();
            if (!nextToken) {
                return false;
            }

            state.pageTokens[highestKnownPage + 1] = nextToken;
            safetyCounter += 1;
        }

        return Boolean(state.pageTokens[targetPage]);
    }

    function renderPagination() {
        const holder = byId('paginationContainer');
        const totalPages = Math.max(1, state.totalPages || 1);

        if (!state.items.length || totalPages <= 1) {
            holder.style.display = 'none';
            holder.innerHTML = '';
            return;
        }

        holder.style.display = 'flex';

        let paginationHTML = '';

        paginationHTML += `<button class="nav-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>` +
            `<i class="fas fa-chevron-left" aria-hidden="true"></i> Previous</button>`;

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                paginationHTML += `<button class="page-num ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
        } else {
            const startPage = Math.max(2, state.page - 2);
            const endPage = Math.min(totalPages - 1, state.page + 2);

            paginationHTML += `<button class="page-num ${state.page === 1 ? 'active' : ''}" data-page="1">1</button>`;

            if (startPage > 2) {
                paginationHTML += '<button class="ellipsis" disabled>...</button>';
            }

            for (let i = startPage; i <= endPage; i++) {
                paginationHTML += `<button class="page-num ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }

            if (endPage < totalPages - 1) {
                paginationHTML += '<button class="ellipsis" disabled>...</button>';
            }

            paginationHTML += `<button class="page-num ${state.page === totalPages ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button>`;
        }

        const atLastPage = state.page >= totalPages || !state.nextPageToken;
        paginationHTML += `<button class="nav-btn" data-page="${state.page + 1}" ${atLastPage ? 'disabled' : ''}>` +
            `Next <i class="fas fa-chevron-right" aria-hidden="true"></i></button>`;

        holder.innerHTML = paginationHTML;
    }

    function renderResults() {
        const resultsEl = byId('resultsList');

        if (!state.items.length) {
            resultsEl.innerHTML = '';
            showEmpty(true);
            renderPagination();
            return;
        }

        showEmpty(false);

        resultsEl.innerHTML = state.items.map((item, index) => {
            const position = ((state.page - 1) * CLINICAL_TRIALS_API.pageSize) + index + 1;
            const title = escapeHtml(item.title || 'Untitled clinical trial');
            const link = escapeHtml(item.url || 'https://clinicaltrials.gov/');
            const snippet = escapeHtml(`Condition: ${item.conditions}. Sponsor: ${item.leadSponsor}.`);
            const nct = escapeHtml(item.nctId || 'NCT unavailable');
            const status = escapeHtml(item.overallStatus || 'Status unavailable');
            const updated = escapeHtml(item.updatedDate || 'Date unavailable');
            const phase = escapeHtml(item.phase || 'Phase not specified');

            return [
                '<article class="result-item">',
                `  <a class="result-title" href="${link}" target="_blank" rel="noopener noreferrer">${position}. ${title}</a>`,
                `  <p class="result-snippet">${snippet}</p>`,
                '  <div class="result-meta">',
                `      <span class="result-meta-item"><i class="fas fa-hashtag"></i>${nct}</span>`,
                `      <span class="result-meta-item"><i class="fas fa-wave-square"></i>${status}</span>`,
                `      <span class="result-meta-item"><i class="fas fa-vials"></i>${phase}</span>`,
                `      <span class="result-meta-item"><i class="fas fa-calendar"></i>${updated}</span>`,
                '  </div>',
                `  <a class="result-link" href="${link}" target="_blank" rel="noopener noreferrer">Open on ClinicalTrials.gov <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>`,
                '</article>'
            ].join('');
        }).join('');

        renderPagination();
    }

    function readTotalResults(json) {
        const total = Number(json && json.totalCount ? json.totalCount : 0);
        if (!Number.isFinite(total) || total < 0) {
            return 0;
        }
        return total;
    }

    async function runSearch(pageOverride, options) {
        const opts = options || {};
        const input = byId('trial-search-input');
        const query = normalizeQuery(input.value);

        if (opts.reset || query !== state.query) {
            resetPaginationState();
        }

        const requestedPage = Math.max(1, Number(pageOverride || 1));

        if (requestedPage > 1 && !state.pageTokens[requestedPage]) {
            setStatus(`Preparing page ${requestedPage}...`, false);
            const tokenReady = await ensureTokenForPage(query, requestedPage);
            if (!tokenReady) {
                setStatus(`Page ${requestedPage} is not available for this search.`, true);
                return;
            }
        }

        state.page = requestedPage;

        state.query = query;
        const pageToken = state.pageTokens[state.page] || '';

        const cached = getCachedResponse(state.query, pageToken);
        const requestSeq = ++latestRequestSeq;

        if (activeController) {
            activeController.abort();
        }

        activeController = new AbortController();

        showLoading(true);
        setStatus('Searching Rochester, Minnesota clinical trials...', false);

        try {
            const json = cached || await requestSearch(state.query, pageToken, activeController.signal);

            if (!cached) {
                setCachedResponse(state.query, pageToken, json);
            }

            if (requestSeq !== latestRequestSeq) {
                return;
            }

            const rawStudies = Array.isArray(json.studies) ? json.studies : [];
            const items = rawStudies.map(mapStudy);
            const total = readTotalResults(json);
            const nextToken = String(json && json.nextPageToken ? json.nextPageToken : '').trim();

            state.items = items;
            state.totalResults = total;
            state.nextPageToken = nextToken;
            state.totalPages = total > 0
                ? Math.ceil(total / CLINICAL_TRIALS_API.pageSize)
                : (nextToken ? state.page + 1 : state.page);

            if (nextToken) {
                state.pageTokens[state.page + 1] = nextToken;
                prefetchNextPage(state.query, nextToken);
            }

            updateResultCount(total);
            renderResults();
            updateUrlParams();

            const queryPart = state.query ? ` for "${state.query}"` : '';
            const keyPart = CLINICAL_TRIALS_API.apiKey ? ' (public API key enabled).' : ' (public endpoint).';
            const totalPart = state.totalResults > 0
                ? `Showing ${items.length} of ${formatCount(state.totalResults)} total Rochester, MN trials`
                : `Showing ${items.length} Rochester, MN trials`;
            setStatus(`${totalPart}${queryPart}${keyPart}`, false);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return;
            }

            state.items = [];
            state.totalResults = 0;
            state.totalPages = 0;
            state.nextPageToken = '';
            updateResultCount(0);
            renderResults();
            setStatus(error && error.message ? error.message : 'Search failed. Try again.', true);
        } finally {
            if (requestSeq !== latestRequestSeq) {
                return;
            }
            showLoading(false);
        }
    }

    function queueDebouncedSearch() {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }

        searchDebounceTimer = setTimeout(function () {
            runSearch(1, { reset: true });
        }, 350);
    }

    function bindEvents() {
        byId('search-icon').addEventListener('click', function () {
            runSearch(1, { reset: true });
        });

        byId('trial-search-input').addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                runSearch(1, { reset: true });
            }
        });

        byId('trial-search-input').addEventListener('input', function () {
            queueDebouncedSearch();
        });

        byId('paginationContainer').addEventListener('click', function (event) {
            const target = event.target.closest('button[data-page]');
            if (!target || target.disabled) {
                return;
            }

            const nextPage = Number(target.getAttribute('data-page') || '1');
            if (Number.isFinite(nextPage) && nextPage > 0 && nextPage !== state.page) {
                runSearch(nextPage);
            }
        });
    }

    function initFromQueryString() {
        const params = new URLSearchParams(window.location.search);
        const q = (params.get('q') || '').trim();

        if (q) {
            byId('trial-search-input').value = q;
        }

        runSearch(1, { reset: true });
    }

    function init() {
        byId('trial-year').textContent = String(new Date().getFullYear());
        byId('sourceBadge').textContent = CLINICAL_TRIALS_API.apiKey
            ? 'ClinicalTrials.gov API (Public Key)'
            : 'ClinicalTrials.gov API';
        bindEvents();
        initFromQueryString();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
