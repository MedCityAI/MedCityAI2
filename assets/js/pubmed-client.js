// MedCityAI PubMed client with queue throttling, retries, cache, and de-duplication
(function () {
    'use strict';

    const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const API_KEY = window.PUBMED_API_KEY || '';
    const MIN_INTERVAL_MS = API_KEY ? 110 : 350;
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
    const REQUEST_TIMEOUT_MS = 20000;

    const queue = [];
    const inFlight = new Map();
    let isRunning = false;
    let lastRun = 0;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function toCacheKey(url, responseType) {
        return `pubmed:${responseType}:${url}`;
    }

    function cacheGet(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) {
                return null;
            }

            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.ts || (Date.now() - parsed.ts) > CACHE_TTL_MS) {
                localStorage.removeItem(key);
                return null;
            }

            return parsed.data;
        } catch (_) {
            return null;
        }
    }

    function cacheSet(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
        } catch (_) {
            // ignore storage quota issues
        }
    }

    async function runQueue() {
        if (isRunning) {
            return;
        }

        isRunning = true;

        while (queue.length > 0) {
            const job = queue.shift();
            const elapsed = Date.now() - lastRun;
            if (elapsed < MIN_INTERVAL_MS) {
                await sleep(MIN_INTERVAL_MS - elapsed);
            }
            lastRun = Date.now();

            try {
                const data = await job.fn();
                job.resolve(data);
            } catch (error) {
                job.reject(error);
            }
        }

        isRunning = false;
    }

    function enqueue(fn) {
        return new Promise((resolve, reject) => {
            queue.push({ fn, resolve, reject });
            runQueue();
        });
    }

    async function fetchWithRetry(url, responseType, maxRetries = 4) {
        let attempt = 0;

        while (true) {
            let response;
            let timeoutId;
            try {
                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
                response = await fetch(url, { signal: controller.signal });
            } catch (error) {
                const canRetry = attempt < maxRetries;
                if (!canRetry) {
                    throw new Error(`PubMed network error after retries: ${error && error.message ? error.message : 'request failed'}`);
                }

                const networkDelayMs = Math.min(8000, 500 * Math.pow(2, attempt));
                attempt += 1;
                await sleep(networkDelayMs);
                continue;
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }

            if (response.ok) {
                if (responseType === 'text') {
                    return response.text();
                }
                return response.json();
            }

            const isRetriable = response.status === 429 || (response.status >= 500 && response.status <= 599);
            if (!isRetriable || attempt >= maxRetries) {
                throw new Error(`PubMed request failed (${response.status}): ${url}`);
            }

            const retryAfterHeader = response.headers.get('Retry-After');
            const retryAfterSeconds = Number(retryAfterHeader);
            const delayMs = Number.isFinite(retryAfterSeconds)
                ? retryAfterSeconds * 1000
                : Math.min(8000, 400 * Math.pow(2, attempt));

            attempt += 1;
            await sleep(delayMs);
        }
    }

    function buildUrl(path, params) {
        const query = new URLSearchParams(params || {});
        if (API_KEY) {
            query.set('api_key', API_KEY);
        }

        return `${PUBMED_BASE}/${path}?${query.toString()}`;
    }

    function request(path, params, responseType) {
        const url = buildUrl(path, params);
        const inflightKey = `${responseType}:${url}`;
        const cacheKey = toCacheKey(url, responseType);

        const cached = cacheGet(cacheKey);
        if (cached !== null) {
            return Promise.resolve(cached);
        }

        if (inFlight.has(inflightKey)) {
            return inFlight.get(inflightKey);
        }

        const promise = enqueue(() => fetchWithRetry(url, responseType))
            .then(data => {
                cacheSet(cacheKey, data);
                return data;
            })
            .finally(() => {
                inFlight.delete(inflightKey);
            });

        inFlight.set(inflightKey, promise);
        return promise;
    }

    function requestJson(path, params) {
        return request(path, params, 'json');
    }

    function requestText(path, params) {
        return request(path, params, 'text');
    }

    async function fetchEfetchXmlByPmids(pmids, chunkSize = 150) {
        const uniquePmids = Array.from(new Set((pmids || []).filter(Boolean)));
        const xmlChunks = [];

        for (let index = 0; index < uniquePmids.length; index += chunkSize) {
            const chunk = uniquePmids.slice(index, index + chunkSize);
            const xml = await requestText('efetch.fcgi', {
                db: 'pubmed',
                id: chunk.join(','),
                retmode: 'xml'
            });
            xmlChunks.push(xml);
        }

        return xmlChunks;
    }

    window.PubMedClient = {
        requestJson,
        requestText,
        fetchEfetchXmlByPmids: (pmids, chunkSize = 75) => fetchEfetchXmlByPmids(pmids, chunkSize),
        settings: {
            apiKeyEnabled: Boolean(API_KEY),
            minIntervalMs: MIN_INTERVAL_MS,
            cacheTtlMs: CACHE_TTL_MS,
            requestTimeoutMs: REQUEST_TIMEOUT_MS
        }
    };
})();
