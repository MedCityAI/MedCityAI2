(function () {
    "use strict";

    const MAX_ROWS = 500;
    const REFRESH_INTERVAL_MS = 180000;
    const MAX_CONCEPTS = 6;
    const CARDS_PER_SPECIALTY = 10;
    const ROTATE_INTERVAL_MS = 5200;
    const WANDER_PATH_COUNT = 16;
    const MOMENTUM_STORAGE_KEY = "index2MomentumCount";

    const SPECIALTY_NODE_POSITIONS = [
        { x: 18, y: 18 },
        { x: 50, y: 12 },
        { x: 82, y: 18 },
        { x: 88, y: 50 },
        { x: 82, y: 82 },
        { x: 50, y: 88 },
        { x: 18, y: 82 },
        { x: 12, y: 50 }
    ];

    const CONCEPT_NODE_POSITIONS = [
        { x: 34, y: 34 },
        { x: 66, y: 34 },
        { x: 66, y: 66 },
        { x: 34, y: 66 },
        { x: 50, y: 28 },
        { x: 72, y: 50 },
        { x: 50, y: 72 },
        { x: 28, y: 50 }
    ];

    const STOP_WORDS = new Set([
        "the", "and", "for", "with", "from", "this", "that", "was", "were", "are", "have", "has",
        "using", "use", "used", "into", "over", "under", "between", "among", "during", "after", "before",
        "study", "research", "article", "summary", "clinical", "patients", "patient", "rochester", "mayo",
        "clinic", "medical", "health", "disease", "treatment", "analysis", "new", "data", "show", "shows",
        "than", "their", "they", "into", "through", "also", "more", "less", "than", "which", "within",
        "based", "about", "these", "those", "among", "including", "associated", "outcomes", "result"
    ]);

    const state = {
        rows: [],
        filtered: [],
        query: "",
        specialty: "all",
        feedFingerprint: "",
        lastRefreshLabel: "",
        mode: "zoom",
        rotateTimer: null,
        rotateIndex: 0,
        neuralAnimId: null,
        neuralPaths: [],
        currentMission: null,
        momentumCount: 0
    };

    const els = {};

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        cacheElements();
        wireEvents();
        window.addEventListener("beforeunload", stopNeuralMotion);
        state.momentumCount = loadMomentum();
        renderMomentum();

        try {
            await refreshData(false, true);
            window.setInterval(() => {
                refreshData(true, false);
            }, REFRESH_INTERVAL_MS);
        } catch (error) {
            showLoadError(error);
        }
    }

    function cacheElements() {
        els.queryInput = document.getElementById("queryInput");
        els.specialtyFilter = document.getElementById("specialtyFilter");
        els.resetFilters = document.getElementById("resetFilters");
        els.surpriseMe = document.getElementById("surpriseMe");

        els.visibleCount = document.getElementById("visibleCount");
        els.loadedCount = document.getElementById("loadedCount");
        els.activeFiltersText = document.getElementById("activeFiltersText");
        els.feedStatus = document.getElementById("feedStatus");
        els.neuralMap = document.getElementById("neuralMap");
        els.modeRotate = document.getElementById("modeRotate");
        els.modeZoom = document.getElementById("modeZoom");
        els.adventureCaption = document.getElementById("adventureCaption");
        els.missionTitle = document.getElementById("missionTitle");
        els.missionPrompt = document.getElementById("missionPrompt");
        els.missionAction = document.getElementById("missionAction");
        els.momentumValue = document.getElementById("momentumValue");
        els.momentumNote = document.getElementById("momentumNote");
        els.statSpecialties = document.getElementById("statSpecialties");
        els.statConcepts = document.getElementById("statConcepts");
        els.statJournals = document.getElementById("statJournals");
        els.pathwayButtons = document.getElementById("pathwayButtons");

        els.specialtySections = document.getElementById("specialtySections");
        els.emptyState = document.getElementById("emptyState");
    }

    function wireEvents() {
        els.queryInput.addEventListener("input", () => {
            state.query = els.queryInput.value.trim().toLowerCase();
            applyFilters();
        });

        els.specialtyFilter.addEventListener("change", () => {
            state.specialty = els.specialtyFilter.value;
            if (state.specialty !== "all") {
                setMode("zoom");
            }
            applyFilters();
        });

        els.resetFilters.addEventListener("click", () => {
            state.query = "";
            state.specialty = "all";

            els.queryInput.value = "";
            els.specialtyFilter.value = "all";
            setMode("zoom");
            applyFilters();
        });

        els.surpriseMe.addEventListener("click", () => {
            if (!state.filtered.length) {
                return;
            }
            incrementMomentum();
            const randomIndex = Math.floor(Math.random() * state.filtered.length);
            const randomArticle = state.filtered[randomIndex];
            window.open(randomArticle.url, "_blank", "noopener");
        });

        els.modeRotate.addEventListener("click", () => {
            setMode("rotate");
        });

        els.modeZoom.addEventListener("click", () => {
            setMode("zoom");
        });

        els.neuralMap.addEventListener("click", (event) => {
            const node = event.target.closest("[data-neural-type]");
            if (!node) {
                return;
            }

            if (node.dataset.neuralType === "specialty") {
                const specialty = node.dataset.specialty || "all";
                if (specialty !== "all") {
                    setMode("zoom");
                    incrementMomentum();
                }
                state.specialty = specialty;
                els.specialtyFilter.value = specialty;
                applyFilters();
            }

            if (node.dataset.neuralType === "concept") {
                const concept = node.dataset.query || "";
                setMode("zoom");
                incrementMomentum();
                state.query = concept.toLowerCase();
                els.queryInput.value = concept;
                applyFilters();
            }

            if (node.dataset.neuralType === "hub") {
                state.specialty = "all";
                state.query = "";
                els.specialtyFilter.value = "all";
                els.queryInput.value = "";
                applyFilters();
            }
        });

        els.missionAction.addEventListener("click", runCurrentMission);

        els.pathwayButtons.addEventListener("click", (event) => {
            const button = event.target.closest("[data-pathway]");
            if (!button) {
                return;
            }

            const type = button.dataset.pathwayType;
            const value = button.dataset.pathwayValue || "";

            if (type === "specialty") {
                setMode("zoom");
                state.specialty = value;
                els.specialtyFilter.value = value;
                incrementMomentum();
                applyFilters();
            }

            if (type === "concept") {
                setMode("zoom");
                state.query = value.toLowerCase();
                els.queryInput.value = value;
                incrementMomentum();
                applyFilters();
            }
        });

        els.specialtySections.addEventListener("click", (event) => {
            const link = event.target.closest(".card-title");
            if (link) {
                incrementMomentum();
            }
        });
    }

    async function refreshData(silent, isInitialLoad) {
        const csvText = await fetchCsv();
        const parsed = parseCsv(csvText);
        const normalized = normalizeRows(parsed).slice(0, MAX_ROWS);
        const newFingerprint = createFingerprint(normalized);

        if (silent && state.feedFingerprint === newFingerprint) {
            updateFeedStatus("Listening for new Rochester publications...");
            return;
        }

        state.rows = normalized;
        state.filtered = normalized.slice();
        state.feedFingerprint = newFingerprint;
        state.lastRefreshLabel = formatTime(new Date());

        fillSpecialties(state.rows);
        applyFilters();

        if (isInitialLoad) {
            updateFeedStatus("Live feed loaded at " + state.lastRefreshLabel);
            renderNeuralMap();
            renderLaunchpad();
            updateAdventureUi();
            runAutoRotateStep();
        } else {
            updateFeedStatus("Feed refreshed at " + state.lastRefreshLabel);
            renderNeuralMap();
            renderLaunchpad();
        }
    }

    async function fetchCsv() {
        const response = await fetch("pubmed_data.csv", { cache: "no-cache" });
        if (!response.ok) {
            throw new Error("Could not load pubmed_data.csv");
        }
        return response.text();
    }

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let cell = "";
        let inQuotes = false;

        for (let i = 0; i < text.length; i += 1) {
            const ch = text[i];
            const next = text[i + 1];

            if (ch === '"') {
                if (inQuotes && next === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === "," && !inQuotes) {
                row.push(cell);
                cell = "";
            } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
                if (ch === "\r" && next === "\n") {
                    i += 1;
                }
                row.push(cell);
                if (row.length > 1 || row[0] !== "") {
                    rows.push(row);
                }
                row = [];
                cell = "";
            } else {
                cell += ch;
            }
        }

        if (cell.length > 0 || row.length > 0) {
            row.push(cell);
            rows.push(row);
        }

        if (!rows.length) {
            return [];
        }

        const headers = rows[0].map((h) => h.trim());
        return rows.slice(1).map((line) => {
            const obj = {};
            headers.forEach((header, idx) => {
                obj[header] = line[idx] || "";
            });
            return obj;
        });
    }

    function normalizeRows(rows) {
        return rows
            .map((row) => {
                const pmid = clean(row.pmid);
                const title = clean(row.title);
                if (!pmid || !title) {
                    return null;
                }

                const primary = clean(row.primary_specialty) || "General Medicine";
                const secondary = clean(row.secondary_specialty);

                return {
                    pmid,
                    title,
                    authors: (clean(row.authors_display) || clean(row.authors)).replace(/\|/g, ", "),
                    summary: clean(row.llm_summary) || clean(row.abstract) || "No summary available.",
                    pubdate: clean(row.pubdate) || inferYear(row),
                    journal: clean(row.journal),
                    primarySpecialty: primary,
                    secondarySpecialty: secondary,
                    url: clean(row.url) || ("https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/")
                };
            })
            .filter(Boolean);
    }

    function inferYear(row) {
        const direct = clean(row.year).replace(/\.0$/, "");
        if (/^\d{4}$/.test(direct)) {
            return direct;
        }
        const fromDate = clean(row.pubdate).match(/(19|20)\d{2}/);
        return fromDate ? fromDate[0] : "Unknown";
    }

    function fillSpecialties(rows) {
        const previousValue = state.specialty;
        const set = new Set();
        rows.forEach((item) => {
            if (item.primarySpecialty) {
                set.add(item.primarySpecialty);
            }
            if (item.secondarySpecialty) {
                set.add(item.secondarySpecialty);
            }
        });

        els.specialtyFilter.innerHTML = "<option value=\"all\">All specialties</option>";

        Array.from(set)
            .sort((a, b) => a.localeCompare(b))
            .forEach((value) => {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                els.specialtyFilter.appendChild(option);
            });

        if (previousValue !== "all" && set.has(previousValue)) {
            els.specialtyFilter.value = previousValue;
            state.specialty = previousValue;
        } else {
            els.specialtyFilter.value = "all";
            state.specialty = "all";
        }
    }

    function applyFilters() {
        state.filtered = state.rows.filter((row) => {
            if (state.specialty !== "all") {
                const specialtyMatch = row.primarySpecialty === state.specialty || row.secondarySpecialty === state.specialty;
                if (!specialtyMatch) {
                    return false;
                }
            }

            if (state.query) {
                const haystack = [row.title, row.authors, row.summary, row.journal, row.primarySpecialty, row.secondarySpecialty]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(state.query)) {
                    return false;
                }
            }

            return true;
        });

        renderSummary();
        renderResults();
        updateAdventureUi();
        renderNeuralMap();
        renderLaunchpad();
    }

    function renderSummary() {
        els.visibleCount.textContent = Number(state.filtered.length || 0).toLocaleString();
        els.loadedCount.textContent = Number(state.rows.length || 0).toLocaleString();

        const activeParts = [];
        if (state.query) {
            activeParts.push('"' + state.query + '"');
        }
        if (state.specialty !== "all") {
            activeParts.push(state.specialty);
        }

        els.activeFiltersText.textContent = activeParts.length
            ? "Filtered by: " + activeParts.join(" / ")
            : "Grouped by specialty. Zoom in on key concepts and scan fast.";
    }

    function setMode(mode) {
        state.mode = mode === "rotate" ? "rotate" : "zoom";
        updateAdventureUi();

        if (state.mode === "rotate") {
            startAutoRotate();
        } else {
            stopAutoRotate();
            updateFeedStatus("Zoom mode active • Pick a node to focus your feed.");
        }
    }

    function updateAdventureUi() {
        els.modeRotate.classList.toggle("is-active", state.mode === "rotate");
        els.modeZoom.classList.toggle("is-active", state.mode === "zoom");

        if (state.mode === "rotate") {
            els.adventureCaption.textContent = "Auto Explore is hopping specialties every few seconds.";
        } else {
            els.adventureCaption.textContent = "Zoom into a specialty node or concept chip to focus your feed.";
        }
    }

    function startAutoRotate() {
        stopAutoRotate();
        runAutoRotateStep();
        state.rotateTimer = window.setInterval(runAutoRotateStep, ROTATE_INTERVAL_MS);
    }

    function stopAutoRotate() {
        if (state.rotateTimer) {
            window.clearInterval(state.rotateTimer);
            state.rotateTimer = null;
        }
    }

    function runAutoRotateStep() {
        if (state.mode !== "rotate") {
            return;
        }

        const groups = groupBySpecialty(state.rows).slice(0, SPECIALTY_NODE_POSITIONS.length);
        if (!groups.length) {
            return;
        }

        const target = groups[state.rotateIndex % groups.length];
        state.rotateIndex += 1;

        state.specialty = target.specialty;
        els.specialtyFilter.value = target.specialty;
        applyFilters();
        updateFeedStatus("Auto exploring: " + target.specialty + " • " + state.lastRefreshLabel);
    }

    function renderResults() {
        els.specialtySections.innerHTML = "";

        if (!state.filtered.length) {
            els.emptyState.hidden = false;
            return;
        }

        els.emptyState.hidden = true;

        const grouped = groupBySpecialty(state.filtered);
        grouped.forEach((group) => {
            els.specialtySections.appendChild(renderSpecialtySection(group));
        });
    }

    function renderNeuralMap() {
        const specialtyGroups = groupBySpecialty(state.rows).slice(0, SPECIALTY_NODE_POSITIONS.length);
        const conceptTokens = extractTopConcepts(state.rows, CONCEPT_NODE_POSITIONS.length);

        const tethers = [];
        const nodes = [];

        nodes.push('<button type="button" class="neural-node hub" data-neural-type="hub">Rochester Research</button>');

        specialtyGroups.forEach((group, idx) => {
            const position = SPECIALTY_NODE_POSITIONS[idx];
            tethers.push(renderCurvedTether(50, 50, position.x, position.y));

            const active = state.specialty === group.specialty ? " is-active" : "";
            nodes.push(
                '<button type="button" class="neural-node specialty' + active + '" ' +
                'style="--x:' + position.x + '%;--y:' + position.y + '%" ' +
                'data-neural-type="specialty" data-specialty="' + escapeHtml(group.specialty) + '">' +
                escapeHtml(group.specialty) + "</button>"
            );
        });

        conceptTokens.forEach((concept, idx) => {
            const position = CONCEPT_NODE_POSITIONS[idx];
            tethers.push(renderCurvedTether(50, 50, position.x, position.y));

            const active = state.query && concept.toLowerCase() === state.query ? " is-active" : "";
            nodes.push(
                '<button type="button" class="neural-node concept' + active + '" ' +
                'style="--x:' + position.x + '%;--y:' + position.y + '%" ' +
                'data-neural-type="concept" data-query="' + escapeHtml(concept) + '">' +
                escapeHtml(concept) + "</button>"
            );
        });

        els.neuralMap.innerHTML = [
            '<svg class="neural-line-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">',
            '<g class="neural-tether-layer">',
            tethers.join(""),
            "</g>",
            '<g class="neural-wander-layer"></g>',
            "</svg>",
            nodes.join(""),
            ""
        ].join("");

        startNeuralMotion();
    }

    function renderLaunchpad() {
        const allGroups = groupBySpecialty(state.rows);
        const allConcepts = extractTopConcepts(state.rows, 12);
        const journals = new Set(state.rows.map((row) => row.journal).filter(Boolean));

        els.statSpecialties.textContent = String(allGroups.length || 0);
        els.statConcepts.textContent = String(allConcepts.length || 0);
        els.statJournals.textContent = String(journals.size || 0);

        renderPathwayButtons(allGroups, allConcepts);
        chooseMission(allGroups, allConcepts);
        renderMomentum();
    }

    function renderPathwayButtons(groups, concepts) {
        const specialtyButtons = groups.slice(0, 5).map((group) => {
            return '<button type="button" class="pathway-btn specialty" data-pathway="1" data-pathway-type="specialty" data-pathway-value="' +
                escapeHtml(group.specialty) + '">Explore ' + escapeHtml(group.specialty) + "</button>";
        });

        const conceptButtons = concepts.slice(0, 5).map((concept) => {
            return '<button type="button" class="pathway-btn concept" data-pathway="1" data-pathway-type="concept" data-pathway-value="' +
                escapeHtml(concept) + '">Concept: ' + escapeHtml(concept) + "</button>";
        });

        els.pathwayButtons.innerHTML = specialtyButtons.concat(conceptButtons).join("");
    }

    function chooseMission(groups, concepts) {
        if (!groups.length) {
            setMission({
                title: "Research Scout",
                prompt: "No specialty lanes yet. Refresh to load the newest publications.",
                actionLabel: "Refresh",
                actionType: "reset",
                actionValue: ""
            });
            return;
        }

        const leadSpecialty = groups[0].specialty;
        const secondary = groups[Math.min(1, groups.length - 1)].specialty;
        const leadConcept = concepts[0] || "innovation";

        const missions = [
            {
                title: "Pathfinder Sprint",
                prompt: "Start in " + leadSpecialty + " and spot one paper tied to " + leadConcept + ".",
                actionLabel: "Open " + leadSpecialty,
                actionType: "specialty",
                actionValue: leadSpecialty
            },
            {
                title: "Bridge Builder",
                prompt: "Compare " + leadSpecialty + " with " + secondary + " to find a cross-specialty idea.",
                actionLabel: "Jump to " + secondary,
                actionType: "specialty",
                actionValue: secondary
            },
            {
                title: "Concept Hunter",
                prompt: "Dive into the concept node for " + leadConcept + " and trace related summaries.",
                actionLabel: "Zoom on " + leadConcept,
                actionType: "concept",
                actionValue: leadConcept
            }
        ];

        const seed = (new Date().getDate() + state.momentumCount) % missions.length;
        setMission(missions[seed]);
    }

    function setMission(mission) {
        state.currentMission = mission;
        els.missionTitle.textContent = mission.title;
        els.missionPrompt.textContent = mission.prompt;
        els.missionAction.textContent = mission.actionLabel;
    }

    function runCurrentMission() {
        const mission = state.currentMission;
        if (!mission) {
            return;
        }

        if (mission.actionType === "specialty") {
            setMode("zoom");
            state.specialty = mission.actionValue;
            els.specialtyFilter.value = mission.actionValue;
            incrementMomentum();
            applyFilters();
            return;
        }

        if (mission.actionType === "concept") {
            setMode("zoom");
            state.query = mission.actionValue.toLowerCase();
            els.queryInput.value = mission.actionValue;
            incrementMomentum();
            applyFilters();
            return;
        }

        state.specialty = "all";
        state.query = "";
        els.specialtyFilter.value = "all";
        els.queryInput.value = "";
        applyFilters();
    }

    function incrementMomentum() {
        state.momentumCount += 1;
        saveMomentum(state.momentumCount);
        renderMomentum();
    }

    function renderMomentum() {
        if (!els.momentumValue) {
            return;
        }

        els.momentumValue.textContent = String(state.momentumCount || 0);

        if (state.momentumCount < 5) {
            els.momentumNote.textContent = "Every click builds your research intuition.";
            return;
        }

        if (state.momentumCount < 15) {
            els.momentumNote.textContent = "You are in explorer mode. Keep connecting concepts.";
            return;
        }

        els.momentumNote.textContent = "High momentum: you are navigating like a research lead.";
    }

    function loadMomentum() {
        try {
            const raw = window.localStorage.getItem(MOMENTUM_STORAGE_KEY);
            const parsed = Number(raw);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        } catch (_error) {
            return 0;
        }
    }

    function saveMomentum(value) {
        try {
            window.localStorage.setItem(MOMENTUM_STORAGE_KEY, String(value));
        } catch (_error) {
            // Ignore storage errors to keep the feed usable in restricted contexts.
        }
    }

    function renderCurvedTether(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const cx1 = x1 + (dx * 0.33) - (dy * 0.18);
        const cy1 = y1 + (dy * 0.33) + (dx * 0.18);
        const cx2 = x1 + (dx * 0.66) + (dy * 0.16);
        const cy2 = y1 + (dy * 0.66) - (dx * 0.16);
        return '<path class="neural-tether" d="M' + x1 + ' ' + y1 + ' C' + cx1.toFixed(2) + ' ' + cy1.toFixed(2) + ' ' + cx2.toFixed(2) + ' ' + cy2.toFixed(2) + ' ' + x2 + ' ' + y2 + '"></path>';
    }

    function startNeuralMotion() {
        stopNeuralMotion();

        const svg = els.neuralMap.querySelector(".neural-line-layer");
        if (!svg) {
            return;
        }

        const layer = svg.querySelector(".neural-wander-layer");
        if (!layer) {
            return;
        }

        state.neuralPaths = Array.from({ length: WANDER_PATH_COUNT }, (_, index) => createWanderPath(layer, index));

        let lastTick = performance.now();
        const animate = (now) => {
            const dt = Math.min((now - lastTick) / 1000, 0.05);
            lastTick = now;

            state.neuralPaths.forEach((pathState) => {
                advanceWanderPath(pathState, dt, now);
            });

            state.neuralAnimId = window.requestAnimationFrame(animate);
        };

        state.neuralAnimId = window.requestAnimationFrame(animate);
    }

    function stopNeuralMotion() {
        if (state.neuralAnimId) {
            window.cancelAnimationFrame(state.neuralAnimId);
            state.neuralAnimId = null;
        }
        state.neuralPaths = [];
    }

    function createWanderPath(layer, index) {
        const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.setAttribute("class", "neural-wander" + (index % 3 === 0 ? " pulse" : ""));
        layer.appendChild(pathEl);

        return {
            el: pathEl,
            x1: randomRange(8, 92),
            y1: randomRange(8, 92),
            x2: randomRange(8, 92),
            y2: randomRange(8, 92),
            vx1: randomRange(-7, 7),
            vy1: randomRange(-7, 7),
            vx2: randomRange(-7, 7),
            vy2: randomRange(-7, 7),
            amp1: randomRange(3, 9),
            amp2: randomRange(3, 9),
            freq1: randomRange(0.7, 1.8),
            freq2: randomRange(0.7, 1.8),
            phase: randomRange(0, Math.PI * 2)
        };
    }

    function advanceWanderPath(pathState, dt, nowMs) {
        pathState.x1 += pathState.vx1 * dt;
        pathState.y1 += pathState.vy1 * dt;
        pathState.x2 += pathState.vx2 * dt;
        pathState.y2 += pathState.vy2 * dt;

        bounce(pathState, "x1", "vx1");
        bounce(pathState, "y1", "vy1");
        bounce(pathState, "x2", "vx2");
        bounce(pathState, "y2", "vy2");

        if (Math.random() < 0.01) {
            pathState.vx1 += randomRange(-1.5, 1.5);
            pathState.vy1 += randomRange(-1.5, 1.5);
            pathState.vx2 += randomRange(-1.5, 1.5);
            pathState.vy2 += randomRange(-1.5, 1.5);
            clampVelocity(pathState, "vx1");
            clampVelocity(pathState, "vy1");
            clampVelocity(pathState, "vx2");
            clampVelocity(pathState, "vy2");
        }

        const t = nowMs / 1000;
        const mx = (pathState.x1 + pathState.x2) * 0.5;
        const my = (pathState.y1 + pathState.y2) * 0.5;

        const cx1 = mx + Math.cos(t * pathState.freq1 + pathState.phase) * pathState.amp1;
        const cy1 = my + Math.sin(t * pathState.freq2 + pathState.phase) * pathState.amp2;
        const cx2 = mx + Math.sin(t * pathState.freq1 + pathState.phase + 1.2) * pathState.amp2;
        const cy2 = my + Math.cos(t * pathState.freq2 + pathState.phase + 1.2) * pathState.amp1;

        pathState.el.setAttribute(
            "d",
            "M" + pathState.x1.toFixed(2) + " " + pathState.y1.toFixed(2) +
            " C" + cx1.toFixed(2) + " " + cy1.toFixed(2) +
            " " + cx2.toFixed(2) + " " + cy2.toFixed(2) +
            " " + pathState.x2.toFixed(2) + " " + pathState.y2.toFixed(2)
        );
    }

    function bounce(pathState, posKey, velKey) {
        if (pathState[posKey] < 4) {
            pathState[posKey] = 4;
            pathState[velKey] = Math.abs(pathState[velKey]);
        } else if (pathState[posKey] > 96) {
            pathState[posKey] = 96;
            pathState[velKey] = -Math.abs(pathState[velKey]);
        }
    }

    function clampVelocity(pathState, velKey) {
        const value = pathState[velKey];
        const clamped = Math.max(-10, Math.min(10, value));
        pathState[velKey] = clamped;
    }

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function groupBySpecialty(rows) {
        const map = new Map();

        rows.forEach((row) => {
            const specialty = row.primarySpecialty || "General Medicine";
            if (!map.has(specialty)) {
                map.set(specialty, []);
            }
            map.get(specialty).push(row);
        });

        return Array.from(map.entries())
            .map((entry) => ({ specialty: entry[0], rows: entry[1] }))
            .sort((a, b) => b.rows.length - a.rows.length || a.specialty.localeCompare(b.specialty));
    }

    function renderSpecialtySection(group) {
        const section = document.createElement("section");
        section.className = "specialty-section";

        const concepts = extractTopConcepts(group.rows, MAX_CONCEPTS);
        const cards = group.rows.slice(0, CARDS_PER_SPECIALTY);

        section.innerHTML = [
            '<div class="specialty-top">',
            '<h3 class="specialty-title">' + escapeHtml(group.specialty) + "</h3>",
            '<span class="specialty-count">' + escapeHtml(String(group.rows.length)) + " articles</span>",
            "</div>",
            '<div class="concept-row">' + renderConcepts(concepts) + "</div>",
            '<div class="cards-grid">' + cards.map(renderCardHtml).join("") + "</div>",
            "</section>"
        ].join("");

        return section;
    }

    function renderCardHtml(row) {
        return [
            '<article class="result-card">',
            '<a class="card-title" href="' + escapeHtml(row.url) + '" target="_blank" rel="noopener">' + escapeHtml(row.title) + "</a>",
            '<p class="card-meta">PMID ' + escapeHtml(row.pmid) + " | " + escapeHtml(row.pubdate) + "</p>",
            '<p class="card-authors">' + escapeHtml(compactAuthors(row.authors)) + "</p>",
            '<p class="ai-kicker">AI Summary Snippet</p>',
            '<p class="card-summary">' + escapeHtml(makeSnippet(row.summary)) + "</p>",
            '<div class="card-tags">' + renderTags(row) + "</div>",
            "</article>"
        ].join("");
    }

    function compactAuthors(value) {
        if (!value) {
            return "Unknown authors";
        }
        if (value.length <= 130) {
            return value;
        }
        return value.slice(0, 126).trim() + "...";
    }

    function makeSnippet(value) {
        const cleaned = String(value || "").replace(/\s+/g, " ").trim();
        if (!cleaned) {
            return "No summary available.";
        }
        if (cleaned.length <= 360) {
            return cleaned;
        }
        return cleaned.slice(0, 356).trim() + "...";
    }

    function extractTopConcepts(rows, maxConcepts) {
        const freq = new Map();

        rows.forEach((row) => {
            const source = (row.title + " " + row.summary)
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, " ")
                .split(/\s+/)
                .filter(Boolean);

            const seen = new Set();
            source.forEach((token) => {
                if (token.length < 4 || token.length > 18) {
                    return;
                }
                if (STOP_WORDS.has(token)) {
                    return;
                }
                if (seen.has(token)) {
                    return;
                }
                seen.add(token);
                freq.set(token, (freq.get(token) || 0) + 1);
            });
        });

        return Array.from(freq.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, maxConcepts)
            .map((entry) => entry[0]);
    }

    function renderConcepts(concepts) {
        if (!concepts.length) {
            return '<span class="concept-chip">emerging concepts</span>';
        }

        return concepts
            .map((concept) => '<span class="concept-chip">' + escapeHtml(concept) + "</span>")
            .join("");
    }

    function renderTags(row) {
        const tags = [row.primarySpecialty];
        if (row.secondarySpecialty && row.secondarySpecialty !== row.primarySpecialty) {
            tags.push(row.secondarySpecialty);
        }

        return tags
            .filter(Boolean)
            .slice(0, 2)
            .map((tag) => '<span class="tag">' + escapeHtml(tag) + "</span>")
            .join("");
    }

    function showLoadError(error) {
        console.error(error);
        els.emptyState.hidden = false;
        els.emptyState.innerHTML = "<h3>Unable to load articles</h3><p>Please refresh and try again.</p>";
        updateFeedStatus("Feed unavailable right now.");
    }

    function updateFeedStatus(message) {
        if (els.feedStatus) {
            els.feedStatus.textContent = message;
        }
    }

    function createFingerprint(rows) {
        return rows.slice(0, 10).map((row) => row.pmid).join("|") + "::" + String(rows.length);
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    function clean(value) {
        return String(value || "").trim();
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
})();
