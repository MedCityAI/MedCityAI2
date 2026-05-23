(function () {
    'use strict';

    const CSV_PATH = 'assets/data/clinical_trials_recent.csv';
    const API_URL = 'https://clinicaltrials.gov/api/v2/studies?query.locn=Rochester,%20Minnesota&pageSize=100&format=json';

    const state = {
        allTrials: [],
        filteredTrials: []
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

    function parseCsvLine(line) {
        const out = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            const next = line[i + 1];

            if (ch === '"') {
                if (inQuotes && next === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                out.push(current);
                current = '';
            } else {
                current += ch;
            }
        }

        out.push(current);
        return out;
    }

    function parseCsv(csvText) {
        const lines = csvText
            .replace(/^\uFEFF/, '')
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0);

        if (lines.length < 2) {
            return [];
        }

        const headers = parseCsvLine(lines[0]).map((h) => h.trim());

        return lines.slice(1).map((line) => {
            const cols = parseCsvLine(line);
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = (cols[idx] || '').trim();
            });
            return normalizeTrial(row);
        });
    }

    function normalizeTrial(trial) {
        return {
            nct_id: trial.nct_id || '',
            title: trial.title || 'Untitled trial',
            subject: trial.subject || 'Not specified',
            author: trial.author || 'Unknown sponsor',
            status: trial.status || 'UNKNOWN',
            last_update: trial.last_update || '',
            city: trial.city || '',
            state: trial.state || '',
            facility: trial.facility || '',
            study_url: trial.study_url || ''
        };
    }

    function formatDate(isoDate) {
        if (!isoDate) {
            return 'Date unavailable';
        }

        const date = new Date(isoDate);
        if (Number.isNaN(date.getTime())) {
            return isoDate;
        }

        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function statusLabel(raw) {
        return String(raw || '')
            .toLowerCase()
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function sortMostRecent(trials) {
        return [...trials].sort((a, b) => {
            const aTs = Date.parse(a.last_update || '') || 0;
            const bTs = Date.parse(b.last_update || '') || 0;
            return bTs - aTs;
        });
    }

    function renderGrid(trials) {
        const grid = byId('trial-grid');
        const empty = byId('empty-state');

        if (!trials.length) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';

        grid.innerHTML = trials.map((trial) => {
            const subjectPreview = trial.subject.length > 280
                ? trial.subject.slice(0, 277) + '...'
                : trial.subject;

            return `
                <article class="trial-card">
                    <div class="trial-card-top">
                        <span class="trial-status">${escapeHtml(statusLabel(trial.status))}</span>
                        <span class="trial-updated">Updated ${escapeHtml(formatDate(trial.last_update))}</span>
                    </div>
                    <h3 class="trial-title">${escapeHtml(trial.title)}</h3>
                    <p class="trial-subject"><strong>Subject:</strong> ${escapeHtml(subjectPreview)}</p>
                    <p class="trial-author"><strong>Author/Sponsor:</strong> ${escapeHtml(trial.author)}</p>
                    <p class="trial-location"><strong>Location:</strong> ${escapeHtml(trial.city)}, ${escapeHtml(trial.state)}${trial.facility ? ' - ' + escapeHtml(trial.facility) : ''}</p>
                    <div class="trial-card-bottom">
                        <span class="trial-id">${escapeHtml(trial.nct_id)}</span>
                        <a class="trial-link" href="${escapeHtml(trial.study_url)}" target="_blank" rel="noopener noreferrer">View on ClinicalTrials.gov</a>
                    </div>
                </article>
            `;
        }).join('');
    }

    function updateCount(count) {
        byId('trial-count').textContent = String(count);
    }

    function applyFilters() {
        const input = byId('trial-search-input').value.trim().toLowerCase();
        const mode = byId('search-mode').value;

        state.filteredTrials = state.allTrials.filter((trial) => {
            if (!input) {
                return true;
            }

            const author = (trial.author || '').toLowerCase();
            const subject = (trial.subject || '').toLowerCase();

            if (mode === 'author') {
                return author.includes(input);
            }

            if (mode === 'subject') {
                return subject.includes(input);
            }

            return author.includes(input) || subject.includes(input);
        });

        renderGrid(state.filteredTrials);
        updateCount(state.filteredTrials.length);
    }

    function mapApiStudy(study) {
        const protocol = study.protocolSection || {};
        const ident = protocol.identificationModule || {};
        const cond = protocol.conditionsModule || {};
        const sponsor = protocol.sponsorCollaboratorsModule || {};
        const status = protocol.statusModule || {};
        const locationsModule = protocol.contactsLocationsModule || {};
        const locations = Array.isArray(locationsModule.locations) ? locationsModule.locations : [];

        const mnLocations = locations.filter((loc) => /^(mn|minnesota)$/i.test(String(loc.state || '').trim()));
        if (!mnLocations.length) {
            return null;
        }

        const first = mnLocations[0];

        return normalizeTrial({
            nct_id: ident.nctId,
            title: ident.briefTitle,
            subject: Array.isArray(cond.conditions) ? cond.conditions.join('; ') : '',
            author: sponsor.leadSponsor && sponsor.leadSponsor.name ? sponsor.leadSponsor.name : 'Unknown sponsor',
            status: status.overallStatus,
            last_update: status.lastUpdatePostDateStruct && status.lastUpdatePostDateStruct.date ? status.lastUpdatePostDateStruct.date : '',
            city: first.city || '',
            state: first.state || '',
            facility: first.facility || '',
            study_url: ident.nctId ? `https://clinicaltrials.gov/study/${ident.nctId}` : ''
        });
    }

    async function loadFromApiFallback() {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const json = await response.json();
        const studies = Array.isArray(json.studies) ? json.studies : [];

        const mapped = studies
            .map(mapApiStudy)
            .filter(Boolean);

        const dedup = [];
        const seen = new Set();

        mapped.forEach((trial) => {
            if (trial.nct_id && !seen.has(trial.nct_id)) {
                seen.add(trial.nct_id);
                dedup.push(trial);
            }
        });

        return sortMostRecent(dedup).slice(0, 25);
    }

    async function loadTrials() {
        const sourceBadge = byId('data-source-badge');

        try {
            const response = await fetch(CSV_PATH, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`CSV load failed with status ${response.status}`);
            }

            const text = await response.text();
            const rows = parseCsv(text);
            state.allTrials = sortMostRecent(rows).slice(0, 25);
            sourceBadge.textContent = 'Loaded from local CSV snapshot (API-derived)';
        } catch (error) {
            console.warn('CSV unavailable. Falling back to API fetch.', error);
            state.allTrials = await loadFromApiFallback();
            sourceBadge.textContent = 'Live API fallback (not persisted)';
        }

        state.filteredTrials = [...state.allTrials];
        renderGrid(state.filteredTrials);
        updateCount(state.filteredTrials.length);
    }

    function bindEvents() {
        byId('trial-search-input').addEventListener('input', applyFilters);
        byId('search-mode').addEventListener('change', applyFilters);

        byId('clear-search').addEventListener('click', function () {
            byId('trial-search-input').value = '';
            byId('search-mode').value = 'all';
            applyFilters();
        });
    }

    async function init() {
        byId('trial-year').textContent = new Date().getFullYear();
        bindEvents();
        await loadTrials();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();