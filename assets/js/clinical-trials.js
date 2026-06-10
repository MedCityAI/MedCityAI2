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
        nextPageToken: ''
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

    function hasRochesterMinnesotaLocation(study) {
        const locations = getNested(study, 'protocolSection.contactsLocationsModule.locations', []);
        if (!Array.isArray(locations)) {
            return false;
        }

        for (let i = 0; i < locations.length; i++) {
            const city = String(locations[i].city || '').trim().toLowerCase();
            const stateName = String(locations[i].state || '').trim().toLowerCase();
            if (city === 'rochester' && (stateName === 'mn' || stateName === 'minnesota')) {
                return true;
            }
        }

        return false;
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

    async function requestSearch(query, pageToken) {
        const headers = {};

        const params = new URLSearchParams({
            format: 'json',
            pageSize: String(CLINICAL_TRIALS_API.pageSize),
            'query.locn': CLINICAL_TRIALS_API.defaultLocation
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
        const response = await fetch(url, { headers: headers });

        if (!response.ok) {
            throw new Error(`Search request failed (${response.status})`);
        }

        return response.json();
    }

    function renderPagination() {
        const holder = byId('pagination');
        const prevBtn = byId('prevPageBtn');
        const nextBtn = byId('nextPageBtn');
        const indicator = byId('pageIndicator');

        holder.style.display = 'flex';
        prevBtn.disabled = state.page <= 1;
        nextBtn.disabled = !state.nextPageToken;
        indicator.textContent = state.totalPages > 0
            ? `Page ${state.page} of ${state.totalPages}`
            : `Page ${state.page}`;

        if (state.page === 1 && !state.nextPageToken && state.items.length === 0) {
            holder.style.display = 'none';
        }
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

    async function runSearch(pageOverride) {
        const input = byId('trial-search-input');
        const query = input.value.trim();

        state.query = query;
        state.page = Number(pageOverride || 1);
        const pageToken = state.pageTokens[state.page] || '';
        showLoading(true);
        setStatus('Searching Rochester, Minnesota clinical trials...', false);

        try {
            const json = await requestSearch(state.query, pageToken);
            const rawStudies = Array.isArray(json.studies) ? json.studies : [];
            const items = rawStudies
                .filter(hasRochesterMinnesotaLocation)
                .map(mapStudy);
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
            }

            updateResultCount(total);
            renderResults();
            updateUrlParams();

            const queryPart = state.query ? ` for "${state.query}"` : '';
            const keyPart = CLINICAL_TRIALS_API.apiKey ? ' (public API key enabled).' : ' (public endpoint).';
            setStatus(`Showing ${items.length} Rochester, MN trials${queryPart}${keyPart}`, false);
        } catch (error) {
            state.items = [];
            state.totalResults = 0;
            state.totalPages = 0;
            state.nextPageToken = '';
            updateResultCount(0);
            renderResults();
            setStatus(error && error.message ? error.message : 'Search failed. Try again.', true);
        } finally {
            showLoading(false);
        }
    }

    function bindEvents() {
        byId('search-icon').addEventListener('click', function () {
            runSearch(1);
        });

        byId('trial-search-input').addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                runSearch(1);
            }
        });

        byId('prevPageBtn').addEventListener('click', function () {
            if (state.page > 1) {
                runSearch(state.page - 1);
            }
        });

        byId('nextPageBtn').addEventListener('click', function () {
            if (state.nextPageToken) {
                runSearch(state.page + 1);
            }
        });
    }

    function initFromQueryString() {
        const params = new URLSearchParams(window.location.search);
        const q = (params.get('q') || '').trim();
        const page = Number(params.get('page') || '1');

        if (q) {
            byId('trial-search-input').value = q;
        }

        runSearch(Number.isFinite(page) && page > 0 ? page : 1);
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
