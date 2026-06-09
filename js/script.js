let locationData = {};

const PRINT_PAGE_MARGIN_MM = 8;
const PRINT_SHEET_WIDTH_MM = 210;
const PRINT_CONTENT_WIDTH_MM = PRINT_SHEET_WIDTH_MM - PRINT_PAGE_MARGIN_MM * 2;
const PDF_CAPTURE_SCALE = 2;
const PDF_IMAGE_FORMAT = "JPEG";
const PDF_JPEG_QUALITY = 0.92;

const LOCATION_DATA_URL = "/data/ap-locations.json";

const DRAFT_KEY = "political_registration_draft";

const FIELD_LABELS = {
    full_name: "Full Name",
    date_of_birth: "Date of Birth",
    gender: "Gender",
    occupation: "Occupation",
    religion: "Religion",
    caste_community: "Caste / Community",
    additional_identity: "Additional Identity",
    mobile: "Mobile Number (Primary)",
    whatsapp: "WhatsApp Number",
    state: "State",
    district: "District",
    parliament: "Parliament Constituency",
    assembly: "Assembly Constituency",
    village: "Village",
    panchayat: "Panchayat",
    party_affiliation: "Party Affiliation",
    krishna_sir_follower: "Krishna Sir Follower",
    position_role: "Position / Role",
    area_of_influence: "Area of Influence",
    last_interaction_date: "Last Interaction Date",
    grievances_1: "Open Grievances 1",
    grievances_2: "Open Grievances 2",
    grievances_3: "Open Grievances 3"
};

const REQUIRED_FIELDS = [
    "full_name",
    "date_of_birth",
    "gender",
    "occupation",
    "religion",
    "caste_community",
    "mobile",
    "whatsapp",
    "village",
    "party_affiliation",
    "krishna_sir_follower",
    "position_role",
    "area_of_influence"
];

const CASCADE_SELECTS = [
    { id: "state", key: "state" },
    { id: "district", key: "district" },
    { id: "parliament", key: "parliament" },
    { id: "assembly", key: "assembly" },
    { id: "panchayat", key: "panchayat" },
    { id: "village", key: "village" }
];

function getAssemblyNode(state, parliament, assembly) {
    return locationData[state]?.parliaments?.[parliament]?.[assembly] ?? null;
}

function panchayatCompositeKey(mandal, panchayat) {
    return `${mandal}|${panchayat}`;
}

function parsePanchayatComposite(value) {
    const parts = (value || "").split("|");
    if (parts.length !== 2) return null;
    return { mandal: parts[0], panchayat: parts[1] };
}

function populatePanchayatSelect(assemblyNode) {
    panchayatSelect.innerHTML = '<option value="">—</option>';
    const entries = [];
    Object.keys(assemblyNode).forEach(mandal => {
        Object.keys(assemblyNode[mandal]).forEach(panchayat => {
            entries.push({ mandal, panchayat });
        });
    });
    entries.sort((a, b) => compareLabels(a.panchayat, b.panchayat));
    entries.forEach(({ mandal, panchayat }) => {
        const option = document.createElement("option");
        option.value = panchayatCompositeKey(mandal, panchayat);
        option.textContent = panchayat;
        panchayatSelect.appendChild(option);
    });
}

function compareLabels(a, b) {
    return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
}

function populateSelect(select, options, placeholder = "—") {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    [...options].sort(compareLabels).forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
}

function sortStaticSelects() {
    const cascadeIds = new Set(["state", "district", "parliament", "assembly", "panchayat", "village"]);
    document.querySelectorAll(".gov-select").forEach(select => {
        if (cascadeIds.has(select.id)) return;
        const options = [...select.options];
        if (options.length <= 1) return;
        const placeholder = options[0]?.value === "" ? options.shift() : null;
        options.sort((a, b) => compareLabels(a.textContent, b.textContent));
        select.innerHTML = "";
        if (placeholder) select.appendChild(placeholder);
        options.forEach(opt => select.appendChild(opt));
    });
}

function getDistrictParliaments(state, district) {
    return locationData[state]?.districtParliaments?.[district] || [];
}

function resetSelects(selects) {
    selects.forEach(select => {
        select.innerHTML = '<option value="">—</option>';
        select.disabled = true;
        select.value = "";
    });
}

function findCharGrid(field) {
    return document.querySelector(`#form-container .char-grid[data-field="${field}"]`)
        || document.querySelector(`[data-field-row="${field}"] .char-grid`)
        || document.querySelector(`#form-container [data-field-row="${field}"] .char-grid`);
}

function cleanupPdfCaptureHost() {
    document.querySelectorAll(".pdf-capture-host").forEach(el => el.remove());
}

function getCharGridValue(field) {
    const grid = findCharGrid(field);
    if (!grid) return "";
    const raw = [...grid.querySelectorAll("input")]
        .map(input => (input.value || "").toUpperCase())
        .join("");

    if (field === "mobile" || field === "whatsapp" || field === "date_of_birth" || field === "last_interaction_date") {
        return raw.replace(/\D/g, "");
    }

    return raw.replace(/\s+/g, " ").trim();
}

function setCharGridValue(field, value) {
    const grid = findCharGrid(field);
    if (!grid) return;
    let chars = (value || "").toUpperCase();
    if (grid.dataset.datePattern) {
        chars = chars.replace(/\D/g, "");
    } else {
        chars = chars.split("");
    }
    if (typeof chars === "string") {
        chars = chars.split("");
    }
    const inputs = grid.querySelectorAll("input");
    inputs.forEach((input, i) => {
        input.value = chars[i] || "";
    });
}

function buildCharGrid(grid) {
    const datePattern = grid.dataset.datePattern;
    const dateSep = grid.dataset.dateSep || "/";

    if (datePattern) {
        grid.classList.add("char-grid-date");
        const groups = datePattern.split("-").map(n => parseInt(n, 10));
        grid.dataset.length = groups.reduce((sum, n) => sum + n, 0);

        groups.forEach((count, groupIndex) => {
            for (let i = 0; i < count; i++) {
                const input = document.createElement("input");
                input.type = "text";
                input.maxLength = 1;
                input.inputMode = "numeric";
                input.addEventListener("input", () => {
                    input.value = input.value.replace(/\D/g, "");
                });
                grid.appendChild(input);
            }
            if (groupIndex < groups.length - 1) {
                const sep = document.createElement("span");
                sep.className = "char-grid-separator";
                sep.textContent = dateSep;
                sep.setAttribute("aria-hidden", "true");
                grid.appendChild(sep);
            }
        });
        return;
    }

    const length = parseInt(grid.dataset.length, 10);
    const cols = parseInt(grid.dataset.cols, 10);

    if (cols) {
        grid.style.setProperty("--cols", cols);
    }

    for (let i = 0; i < length; i++) {
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 1;
        if (grid.dataset.field === "mobile" || grid.dataset.field === "whatsapp") {
            input.inputMode = "numeric";
            input.addEventListener("input", () => {
                input.value = input.value.replace(/\D/g, "");
            });
        }
        grid.appendChild(input);
    }
}

function getCheckboxGroupValue(field) {
    const group = document.querySelector(`#form-container [data-field="${field}"][data-type="checkbox-group"]`);
    if (!group) return "";
    return [...group.querySelectorAll('input[type="checkbox"]:checked')]
        .map(cb => cb.value)
        .join(", ");
}

function setCheckboxGroupValue(field, value) {
    const group = document.querySelector(`#form-container [data-field="${field}"][data-type="checkbox-group"]`);
    if (!group) return;
    const selected = (value || "").split(",").map(v => v.trim()).filter(Boolean);
    group.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = selected.includes(cb.value);
    });
}

function getSelectValue(field) {
    const el = document.querySelector(`#form-container select[data-field="${field}"]`);
    if (!el) return "";
    const value = (el.value || "").trim();
    if (field === "panchayat") {
        const parsed = parsePanchayatComposite(value);
        return parsed ? parsed.panchayat : value;
    }
    return value;
}

function setSelectValue(field, value) {
    const el = document.querySelector(`#form-container select[data-field="${field}"]`);
    if (!el) return;
    el.value = value || "";
}

function getLineInputValue(field) {
    const el = document.querySelector(`.gov-line-input[data-field="${field}"]`);
    return el ? el.value.trim() : "";
}

function setLineInputValue(field, value) {
    const el = document.querySelector(`.gov-line-input[data-field="${field}"]`);
    if (el) el.value = value || "";
}

function collectFormData() {
    cleanupPdfCaptureHost();
    const data = {};
    Object.keys(FIELD_LABELS).forEach(field => {
        const grid = findCharGrid(field);
        const checkboxGroup = document.querySelector(`#form-container [data-field="${field}"][data-type="checkbox-group"]`);
        const select = document.querySelector(`#form-container select[data-field="${field}"]`);
        const lineInput = document.querySelector(`#form-container .gov-line-input[data-field="${field}"]`);

        if (grid) data[field] = getCharGridValue(field);
        else if (checkboxGroup) data[field] = getCheckboxGroupValue(field);
        else if (select) data[field] = getSelectValue(field);
        else if (lineInput) data[field] = getLineInputValue(field);
    });
    return data;
}

function validateForm(data) {
    const errors = [];

    REQUIRED_FIELDS.forEach(field => {
        if (!(data[field] || "").trim()) {
            errors.push(`${FIELD_LABELS[field]} is required.`);
        }
    });

    if (data.mobile && (!/^\d{10}$/.test(data.mobile))) {
        errors.push("Mobile Number must be exactly 10 digits.");
    }
    if (data.whatsapp && (!/^\d{10}$/.test(data.whatsapp))) {
        errors.push("WhatsApp Number must be exactly 10 digits.");
    }
    if (data.date_of_birth && data.date_of_birth.length < 8) {
        errors.push("Date of Birth must be at least 8 characters (DDMMYYYY).");
    }

    return errors;
}

function clearFieldErrors() {
    document.querySelectorAll(".field-error").forEach(el => el.classList.remove("field-error"));
    showValidationErrors([]);
}

function markFieldErrors(errors) {
    clearFieldErrors();
    errors.forEach(msg => {
        const normalized = msg.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        Object.entries(FIELD_LABELS).forEach(([field, label]) => {
            const labelNorm = label.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
            if (normalized.includes(labelNorm) || normalized.includes(field.replace(/_/g, " "))) {
                document.querySelector(`[data-field-row="${field}"]`)?.classList.add("field-error");
            }
        });
        if (msg.includes("Mobile")) {
            document.querySelector('[data-field-row="mobile"]')?.classList.add("field-error");
        }
        if (msg.includes("WhatsApp")) {
            document.querySelector('[data-field-row="whatsapp"]')?.classList.add("field-error");
        }
    });
}

function showServerErrors(result) {
    const errors = result.errors || ["Submission failed."];
    markFieldErrors(errors);
    showValidationErrors(errors);
    showToast(errors[0], "error");
    scrollToFirstError();
}

function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    clearTimeout(showToast._timer);
    const duration = type === "error" ? 8000 : 4500;
    showToast._timer = setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}

function showValidationErrors(errors, title = "Please fix the following before submitting:") {
    const box = document.getElementById("validation-errors");
    if (!box) return;

    if (!errors.length) {
        box.classList.add("hidden");
        box.innerHTML = "";
        return;
    }

    box.innerHTML = `<strong>${escapeHtml(title)}</strong><ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function scrollToFirstError() {
    const first = document.querySelector(".field-error");
    if (first) {
        first.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

function getNestedOptions(level, values) {
    let node = locationData;
    for (const val of values) {
        if (!node[val]) return [];
        node = node[val];
    }
    return Object.keys(node);
}

function normalizeImportRow(row) {
    const data = { ...row };
    if (!(data.state || "").trim()) {
        data.state = "Andhra Pradesh";
    }
    ["mobile", "whatsapp", "date_of_birth", "last_interaction_date"].forEach(field => {
        if (data[field]) {
            data[field] = String(data[field]).replace(/\D/g, "");
        }
    });
    Object.keys(data).forEach(key => {
        if (typeof data[key] === "string") {
            data[key] = data[key].trim();
        }
    });
    return data;
}

function findSelectOption(select, value) {
    const target = (value || "").trim();
    if (!target) return null;
    return [...select.options].find(opt =>
        opt.value === target || compareLabels(opt.value, target) === 0
        || compareLabels(opt.textContent, target) === 0
    ) || null;
}

function mergeFormData(imported, collected) {
    const merged = normalizeImportRow(imported);
    Object.entries(collected).forEach(([key, value]) => {
        if ((value || "").trim()) {
            merged[key] = value;
        }
    });
    return merged;
}

const CASCADE_STEP_MS = 50;

async function setCascadeValues(data) {
    const stateValue = (data.state || "").trim();
    if (stateValue) {
        await new Promise(resolve => setTimeout(resolve, CASCADE_STEP_MS));
        if (![...stateSelect.options].some(opt => opt.value === stateValue)) {
            const opt = document.createElement("option");
            opt.value = stateValue;
            opt.textContent = stateValue;
            stateSelect.appendChild(opt);
        }
        stateSelect.value = stateValue;
        stateSelect.dispatchEvent(new Event("change"));
    }

    const districtValue = (data.district || "").trim();
    if (districtValue) {
        await new Promise(resolve => setTimeout(resolve, CASCADE_STEP_MS));
        let districtOpt = findSelectOption(districtSelect, districtValue);
        if (!districtOpt) {
            districtOpt = document.createElement("option");
            districtOpt.value = districtValue;
            districtOpt.textContent = districtValue;
            districtSelect.appendChild(districtOpt);
        }
        districtSelect.disabled = false;
        districtSelect.value = districtOpt.value;
        districtSelect.dispatchEvent(new Event("change"));
    }

    const parliamentValue = (data.parliament || "").trim();
    if (parliamentValue) {
        await new Promise(resolve => setTimeout(resolve, CASCADE_STEP_MS));
        let parliamentOpt = findSelectOption(parliamentSelect, parliamentValue);
        if (!parliamentOpt) {
            parliamentOpt = document.createElement("option");
            parliamentOpt.value = parliamentValue;
            parliamentOpt.textContent = parliamentValue;
            parliamentSelect.appendChild(parliamentOpt);
        }
        parliamentSelect.disabled = false;
        parliamentSelect.value = parliamentOpt.value;
        parliamentSelect.dispatchEvent(new Event("change"));
    }

    const assemblyValue = (data.assembly || "").trim();
    if (assemblyValue) {
        await new Promise(resolve => setTimeout(resolve, CASCADE_STEP_MS));
        let assemblyOpt = findSelectOption(assemblySelect, assemblyValue);
        if (!assemblyOpt) {
            assemblyOpt = document.createElement("option");
            assemblyOpt.value = assemblyValue;
            assemblyOpt.textContent = assemblyValue;
            assemblySelect.appendChild(assemblyOpt);
        }
        assemblySelect.disabled = false;
        assemblySelect.value = assemblyOpt.value;
        assemblySelect.dispatchEvent(new Event("change"));
    }

    const panchayatValue = data.mandal && data.panchayat
        ? panchayatCompositeKey(data.mandal, data.panchayat)
        : (data.panchayat || "").trim();
    if (!panchayatValue) return;

    await new Promise(resolve => setTimeout(resolve, CASCADE_STEP_MS));

    let selectedPanchayat = panchayatValue;
    const panchayatOpt = findSelectOption(panchayatSelect, panchayatValue);
    if (panchayatOpt) {
        selectedPanchayat = panchayatOpt.value;
    } else if (![...panchayatSelect.options].some(opt => opt.value === panchayatValue)) {
        const parsed = parsePanchayatComposite(panchayatValue);
        const opt = document.createElement("option");
        opt.value = panchayatValue;
        opt.textContent = parsed ? parsed.panchayat : panchayatValue;
        panchayatSelect.appendChild(opt);
    }

    panchayatSelect.disabled = false;
    panchayatSelect.value = selectedPanchayat;
    panchayatSelect.dispatchEvent(new Event("change"));

    const villageValue = (data.village || "").trim();
    if (!villageValue) return;

    await new Promise(resolve => setTimeout(resolve, CASCADE_STEP_MS));

    let villageOpt = findSelectOption(villageSelect, villageValue);
    if (!villageOpt) {
        villageOpt = document.createElement("option");
        villageOpt.value = villageValue;
        villageOpt.textContent = villageValue;
        villageSelect.appendChild(villageOpt);
    }

    villageSelect.disabled = false;
    villageSelect.value = villageOpt.value;
}

async function fillFormAndWait(data) {
    await fillForm(data);
    await new Promise(resolve => setTimeout(resolve, 400));
}

async function fillForm(data) {
    resetSelects([districtSelect, parliamentSelect, assemblySelect, panchayatSelect, villageSelect]);
    stateSelect.value = "";

    Object.keys(FIELD_LABELS).forEach(field => {
        const value = data[field] || "";
        const grid = document.querySelector(`.char-grid[data-field="${field}"]`);
        const checkboxGroup = document.querySelector(`[data-field="${field}"][data-type="checkbox-group"]`);
        const select = document.querySelector(`select[data-field="${field}"]`);
        const lineInput = document.querySelector(`.gov-line-input[data-field="${field}"]`);

        if (grid) setCharGridValue(field, value);
        else if (checkboxGroup) setCheckboxGroupValue(field, value);
        else if (lineInput) setLineInputValue(field, value);
        else if (select && !CASCADE_SELECTS.some(c => c.key === field)) setSelectValue(field, value);
    });

    await setCascadeValues(data);
    clearFieldErrors();
}

function clearForm() {
    fillForm({});
    localStorage.removeItem(DRAFT_KEY);
    clearFieldErrors();
}

function clearFormWithConfirm() {
    if (importQueue) {
        if (!confirm("Cancel import review and clear the form?")) {
            return;
        }
        exitImportReview();
        exitPreviewMode();
        exitSubmittedMode();
        clearForm();
        window.scrollTo({ top: 0, behavior: "smooth" });
        showToast("Import cancelled.", "info");
        return;
    }
    if (!confirm("Clear all form fields? This cannot be undone.")) {
        return;
    }
    exitPreviewMode();
    exitSubmittedMode();
    clearForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Form cleared. You can start again.", "info");
}

function saveDraft() {
    const data = collectFormData();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function loadDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        fillForm(data);
        showToast("Draft restored from last save.", "info");
    } catch {
        localStorage.removeItem(DRAFT_KEY);
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function setFormInteraction(enabled) {
    document.body.classList.toggle("form-frozen", !enabled);
}

function enterPreviewMode() {
    document.body.classList.add("preview-mode");
    document.getElementById("form-container").classList.add("print-view");
    document.getElementById("preview-banner").classList.remove("hidden");
    setFormInteraction(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function exitPreviewMode() {
    document.body.classList.remove("preview-mode");
    if (!document.body.classList.contains("submitted-mode")) {
        document.body.classList.remove("form-frozen");
        document.getElementById("form-container").classList.remove("print-view");
    }
    document.getElementById("preview-banner").classList.add("hidden");
}

function updateSuccessBannerActions() {
    const nextBtn = document.getElementById("success-new");
    if (!nextBtn) return;
    if (!importQueue) {
        nextBtn.textContent = "New Registration";
        return;
    }
    const isLast = findNextImportIndex(importQueue.index + 1) < 0;
    nextBtn.textContent = isLast ? "Finish Import" : "Next Candidate";
}

function updateSuccessBannerHint() {
    const hint = document.querySelector("#success-banner .status-banner-hint");
    if (!hint) return;
    if (importQueue) {
        const current = importQueue.index + 1;
        const total = importQueue.rows.length;
        const isLast = findNextImportIndex(importQueue.index + 1) < 0;
        const nextStep = isLast ? "Finish Import" : "Next Candidate";
        hint.textContent = `Candidate ${current} of ${total} saved. Click Print PDF to print this form, then ${nextStep} to continue.`;
        return;
    }
    hint.textContent = "PDF and CSV have been saved. Use Print PDF to save a copy (same as Ctrl+P).";
}

function enterSubmittedMode(message = "Registration submitted successfully.") {
    exitPreviewMode();
    localStorage.removeItem(DRAFT_KEY);
    document.body.classList.add("submitted-mode");
    document.getElementById("form-container").classList.add("print-view");
    setFormInteraction(false);

    const textEl = document.getElementById("success-banner-text");
    if (textEl) {
        textEl.textContent = message;
    }
    updateSuccessBannerActions();
    updateSuccessBannerHint();
    document.getElementById("success-banner").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function exitSubmittedMode() {
    document.body.classList.remove("submitted-mode");
    document.getElementById("form-container").classList.remove("print-view");
    document.getElementById("success-banner").classList.add("hidden");
    setFormInteraction(true);
}

function triggerPrintPdf() {
    document.getElementById("toast")?.classList.remove("show");
    window.print();
}

function startNewRegistration() {
    exitSubmittedMode();
    clearForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleSuccessContinue() {
    if (importQueue) {
        exitSubmittedMode();
        advanceImportAfterAction();
        return;
    }
    startNewRegistration();
}

function openPreview() {
    const data = collectFormData();
    const errors = validateForm(data);
    if (errors.length) {
        markFieldErrors(errors);
        showValidationErrors(errors);
        showToast(`${errors.length} required field(s) missing. See list above.`, "error");
        scrollToFirstError();
        return;
    }

    showValidationErrors([]);
    enterPreviewMode();
}

let importQueue = null;

function saveCurrentImportEdits() {
    if (!importQueue) return;
    const edited = collectFormData();
    importQueue.rows[importQueue.index] = mergeFormData(importQueue.rows[importQueue.index], edited);
}

function updateImportBanner() {
    if (!importQueue) return;
    const total = importQueue.rows.length;
    const current = importQueue.index + 1;
    const row = importQueue.rows[importQueue.index];
    const name = row.full_name || `Row ${current}`;
    const status = importQueue.statuses[importQueue.index];
    const statusNote = status === "submitted" ? " — submitted" : status === "skipped" ? " — skipped" : "";
    document.getElementById("import-banner-text").textContent =
        `Candidate ${current} of ${total}: ${name}${statusNote} (${importQueue.submitted} submitted, ${importQueue.skipped} skipped)`;
    document.getElementById("import-prev").disabled = importQueue.index === 0;
    document.getElementById("import-next").disabled = importQueue.index >= total - 1;
}

function showImportBanner() {
    document.getElementById("import-banner").classList.remove("hidden");
    document.body.classList.add("import-review-mode");
}

function exitImportReview() {
    importQueue = null;
    document.getElementById("import-banner").classList.add("hidden");
    document.body.classList.remove("import-review-mode");
}

async function loadImportCandidate(index, { skipSave = false } = {}) {
    if (!importQueue || index < 0 || index >= importQueue.rows.length) return;

    exitSubmittedMode();
    exitPreviewMode();

    if (!skipSave && importQueue.formReady) {
        saveCurrentImportEdits();
    }
    importQueue.index = index;
    clearFieldErrors();
    showValidationErrors([]);

    await fillFormAndWait(importQueue.rows[index]);
    importQueue.formReady = true;
    updateImportBanner();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function findNextImportIndex(startIndex) {
    if (!importQueue) return -1;
    for (let i = startIndex; i < importQueue.rows.length; i++) {
        if (importQueue.statuses[i] === "pending") return i;
    }
    return -1;
}

function finishImportReview() {
    if (!importQueue) return;
    const total = importQueue.rows.length;
    const pending = importQueue.statuses.filter(s => s === "pending").length;
    const parts = [`${importQueue.submitted} submitted`];
    if (importQueue.skipped) parts.push(`${importQueue.skipped} skipped`);
    if (pending) parts.push(`${pending} not reviewed`);
    showToast(`Import complete: ${parts.join(", ")} of ${total}.`, importQueue.submitted ? "success" : "info");
    exitSubmittedMode();
    exitImportReview();
    clearForm();
}

function advanceImportAfterAction() {
    const nextIndex = findNextImportIndex(importQueue.index + 1);
    if (nextIndex >= 0) {
        loadImportCandidate(nextIndex);
        return;
    }
    finishImportReview();
}

async function startImportReview(rows) {
    if (importQueue) {
        showToast("Import review already in progress. Finish or cancel it first.", "error");
        return;
    }
    if (!rows.length) {
        showToast("No valid candidate rows in file.", "error");
        return;
    }

    const normalizedRows = rows.map(row => normalizeImportRow(row));
    const label = normalizedRows.length === 1
        ? `Loaded 1 candidate (${normalizedRows[0].full_name || "row 1"}).\n\nReview the form, edit if needed, then Preview and Submit.`
        : `Loaded ${normalizedRows.length} candidates.\n\nReview each one: edit if needed, then Preview and Submit before moving to the next.`;
    if (!confirm(label)) {
        return;
    }

    importQueue = {
        rows: normalizedRows,
        index: 0,
        statuses: normalizedRows.map(() => "pending"),
        submitted: 0,
        skipped: 0,
        formReady: false
    };

    exitPreviewMode();
    showImportBanner();
    await loadImportCandidate(0, { skipSave: true });
    showToast(`Import ready — candidate 1 of ${normalizedRows.length}. Edit, Preview, then Submit.`, "info");
}

function skipImportCandidate() {
    if (!importQueue) return;
    if (importQueue.formReady) {
        saveCurrentImportEdits();
    }
    if (importQueue.statuses[importQueue.index] === "pending") {
        importQueue.statuses[importQueue.index] = "skipped";
        importQueue.skipped++;
    }
    showToast("Candidate skipped.", "info");
    advanceImportAfterAction();
}

function prevImportCandidate() {
    if (!importQueue || importQueue.index <= 0) return;
    loadImportCandidate(importQueue.index - 1);
}

function nextImportCandidate() {
    if (!importQueue || importQueue.index >= importQueue.rows.length - 1) return;
    loadImportCandidate(importQueue.index + 1);
}

function cancelImportReview() {
    if (!importQueue) return;
    if (!confirm("Cancel import review? Unsubmitted candidates will not be saved.")) {
        return;
    }
    exitPreviewMode();
    exitSubmittedMode();
    exitImportReview();
    clearForm();
    showToast("Import cancelled.", "info");
}

function syncCloneFormState(source, clone) {
    const sourceControls = source.querySelectorAll("input, textarea, select");
    const cloneControls = clone.querySelectorAll("input, textarea, select");
    cloneControls.forEach((control, index) => {
        const original = sourceControls[index];
        if (!original) return;
        if (control.tagName === "SELECT") {
            control.value = original.value;
            return;
        }
        if (control.type === "checkbox" || control.type === "radio") {
            control.checked = original.checked;
            return;
        }
        control.value = original.value;
    });
}

function getJsPDF() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    if (window.jspdf?.default?.jsPDF) return window.jspdf.default.jsPDF;
    if (window.jsPDF?.jsPDF) return window.jsPDF.jsPDF;
    if (typeof window.jsPDF === "function") return window.jsPDF;
    throw new Error("jsPDF not loaded — refresh the page");
}

function ensureSinglePdfPage(pdf) {
    try {
        while (pdf.internal.getNumberOfPages() > 1) {
            pdf.deletePage(pdf.internal.getNumberOfPages());
        }
    } catch {
        // keep single page created by addImage
    }
}

function flattenCloneForPdfCapture(source, clone) {
    const sourceGrids = source.querySelectorAll(".char-grid");
    const cloneGrids = clone.querySelectorAll(".char-grid");
    sourceGrids.forEach((origGrid, index) => {
        const grid = cloneGrids[index];
        if (!grid) return;
        const cols = origGrid.style.getPropertyValue("--cols") || origGrid.dataset.cols;
        if (cols) {
            grid.style.setProperty("--cols", cols);
        }
        const origInputs = origGrid.querySelectorAll("input");
        grid.querySelectorAll("input").forEach((input, inputIndex) => {
            const box = document.createElement("div");
            box.className = "char-cell-print";
            box.textContent = (origInputs[inputIndex]?.value || "").toUpperCase();
            input.replaceWith(box);
        });
    });

    const sourceLines = source.querySelectorAll(".gov-line-input");
    const cloneLines = clone.querySelectorAll(".gov-line-input");
    sourceLines.forEach((origLine, index) => {
        const line = cloneLines[index];
        if (!line) return;
        const text = document.createElement("div");
        text.className = "gov-line-print";
        text.textContent = origLine.value || "";
        line.replaceWith(text);
    });
}

function getPdfHtml2CanvasOptions() {
    return {
        scale: PDF_CAPTURE_SCALE,
        useCORS: true,
        letterRendering: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        logging: false,
        imageTimeout: 0
    };
}

function canvasToImageData(canvas) {
    if (PDF_IMAGE_FORMAT === "PNG") {
        return { data: canvas.toDataURL("image/png"), format: "PNG" };
    }
    return {
        data: canvas.toDataURL("image/jpeg", PDF_JPEG_QUALITY),
        format: "JPEG"
    };
}

function cropCanvasToHeight(canvas, heightPx) {
    if (!heightPx || heightPx >= canvas.height) {
        return canvas;
    }
    const trimmed = document.createElement("canvas");
    trimmed.width = canvas.width;
    trimmed.height = heightPx;
    trimmed.getContext("2d").drawImage(
        canvas,
        0, 0, canvas.width, heightPx,
        0, 0, canvas.width, heightPx
    );
    return trimmed;
}

function cropCanvasToElementHeight(canvas, elementHeightPx) {
    const targetHeight = Math.ceil(elementHeightPx * PDF_CAPTURE_SCALE);
    return cropCanvasToHeight(canvas, targetHeight);
}

function preparePdfCanvas(canvas, elementHeightPx = 0) {
    if (!elementHeightPx) {
        return canvas;
    }
    return cropCanvasToElementHeight(canvas, elementHeightPx);
}

async function renderPdfCanvas(element) {
    if (typeof html2pdf === "undefined") {
        throw new Error("PDF library not loaded");
    }
    const worker = html2pdf()
        .set({ html2canvas: getPdfHtml2CanvasOptions() })
        .from(element);
    await worker.toCanvas();
    const canvas = await worker.get("canvas");
    if (!canvas || !canvas.width || !canvas.height) {
        throw new Error("Canvas capture failed");
    }
    return canvas;
}

function canvasToA4PdfBlob(canvas, elementHeightPx = 0) {
    const JsPDF = getJsPDF();
    const marginMm = PRINT_PAGE_MARGIN_MM;
    const pageHeightMm = 297;
    const contentWidthMm = PRINT_CONTENT_WIDTH_MM;
    const contentHeightMm = pageHeightMm - marginMm * 2;
    const trimmedCanvas = preparePdfCanvas(canvas, elementHeightPx);

    if (!trimmedCanvas.width || !trimmedCanvas.height) {
        throw new Error("Canvas has no dimensions");
    }

    const { data: imgData, format: imgFormat } = canvasToImageData(trimmedCanvas);
    if (!imgData || imgData.length < 100) {
        throw new Error("Could not encode canvas image");
    }

    const imgHeightMm = (trimmedCanvas.height * contentWidthMm) / trimmedCanvas.width;
    const pdf = new JsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait"
    });

    let drawWidth = contentWidthMm;
    let drawHeight = Math.min(imgHeightMm, contentHeightMm);
    let x = marginMm;
    const y = marginMm;

    if (imgHeightMm > contentHeightMm) {
        const fitScale = contentHeightMm / imgHeightMm;
        drawWidth = contentWidthMm * fitScale;
        drawHeight = contentHeightMm;
        x = marginMm + (contentWidthMm - drawWidth) / 2;
    }

    pdf.addImage(imgData, imgFormat, x, y, drawWidth, drawHeight);
    ensureSinglePdfPage(pdf);

    return pdf.output("blob");
}

async function generateFormPdf(candidateName = "registration") {
    cleanupPdfCaptureHost();
    const source = document.getElementById("form-container");
    const host = document.createElement("div");
    host.className = "pdf-capture-host";
    const clone = source.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("print-view");
    syncCloneFormState(source, clone);
    flattenCloneForPdfCapture(source, clone);

    clone.querySelectorAll("select").forEach((sel, index) => {
        const original = source.querySelectorAll("select")[index];
        const text = document.createElement("div");
        text.className = "gov-field-print";
        const selected = original.options[original.selectedIndex];
        text.textContent = selected && selected.value ? selected.textContent : "—";
        sel.replaceWith(text);
    });

    host.appendChild(clone);
    document.body.appendChild(host);
    host.style.opacity = "1";
    host.style.visibility = "visible";

    await new Promise(resolve => setTimeout(resolve, 400));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const captureWidth = clone.offsetWidth;
    const captureHeight = clone.offsetHeight;
    if (captureWidth < 280 || captureHeight < 120) {
        host.remove();
        throw new Error(`PDF layout failed (${captureWidth}x${captureHeight}px)`);
    }

    try {
        const canvas = await renderPdfCanvas(clone);
        const blob = canvasToA4PdfBlob(canvas, captureHeight);
        if (!blob || blob.size < 1500) {
            throw new Error("PDF capture produced an empty document");
        }
        return blob;
    } finally {
        host.remove();
    }
}

async function submitCurrentForm({ bulk = false, importRow = null } = {}) {
    const collected = collectFormData();
    const data = importRow ? mergeFormData(importRow, collected) : collected;
    const errors = validateForm(data);
    if (errors.length) {
        if (!bulk) {
            markFieldErrors(errors);
            showValidationErrors(errors);
            showToast(`${errors.length} required field(s) missing. See list above.`, "error");
            scrollToFirstError();
        }
        return { success: false, errors, data };
    }

    if (!bulk) {
        showValidationErrors([]);
        showToast("Generating high-quality PDF...", "info");
    }

    const candidateName = data.full_name || "registration";

    let pdfBlob;
    try {
        pdfBlob = await generateFormPdf(candidateName);
    } catch (error) {
        console.error("PDF generation failed:", error);
        if (!bulk) {
            showToast("Could not generate PDF. Use Preview → Print / Save PDF, then try again.", "error");
        }
        return { success: false, errors: ["Could not generate PDF."], data };
    }

    const formData = new FormData();
    formData.append("data", JSON.stringify(data));
    const safeName = (data.full_name || "registration").replace(/[^\w\-]+/g, "_").slice(0, 40);
    formData.append("pdf", pdfBlob, `${safeName}.pdf`);

    try {
        const res = await fetch("/api/submit", {
            method: "POST",
            body: formData
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
            if (!bulk) {
                showServerErrors(result);
            }
            return { success: false, errors: result.errors || ["Submission failed."], data };
        }
        return { success: true, data, message: result.message };
    } catch {
        if (!bulk) {
            showToast("Cannot reach server. Start the app with: python app.py", "error");
        }
        return { success: false, errors: ["Cannot reach server."], data };
    }
}

async function submitForm() {
    const result = await submitCurrentForm({ bulk: false });
    if (!result.success) return;

    const message = result.message || "Registration submitted successfully.";
    showToast(message, "success");
    exitPreviewMode();

    if (importQueue) {
        if (importQueue.statuses[importQueue.index] !== "submitted") {
            importQueue.statuses[importQueue.index] = "submitted";
            importQueue.submitted++;
        }
        updateImportBanner();
    }

    enterSubmittedMode(message);
}

async function importFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/import", { method: "POST", body: formData });
        const result = await res.json();
        if (!res.ok || !result.success) {
            const errors = result.errors || ["Import failed."];
            showValidationErrors(errors);
            showToast(errors[0], "error");
            return;
        }

        const rows = result.rows || (result.data ? [result.data] : []);
        if (result.warnings?.length) {
            console.warn("Import warnings:", result.warnings);
        }

        await startImportReview(rows);
    } catch {
        showToast("Cannot reach server. Start the app with: python app.py", "error");
    }
}

/* Cascading dropdowns */
const stateSelect = document.getElementById("state");
const districtSelect = document.getElementById("district");
const parliamentSelect = document.getElementById("parliament");
const assemblySelect = document.getElementById("assembly");
const panchayatSelect = document.getElementById("panchayat");
const villageSelect = document.getElementById("village");

function initLocationDropdowns() {
    populateSelect(stateSelect, Object.keys(locationData));

    if (locationData["Andhra Pradesh"]) {
        stateSelect.value = "Andhra Pradesh";
        stateSelect.dispatchEvent(new Event("change"));
    }
}

async function loadLocationData() {
    const res = await fetch(`${LOCATION_DATA_URL}?v=5`);
    if (!res.ok) {
        throw new Error(`Could not load location data (${res.status})`);
    }
    locationData = await res.json();
    initLocationDropdowns();
}

stateSelect.addEventListener("change", () => {
    resetSelects([districtSelect, parliamentSelect, assemblySelect, panchayatSelect, villageSelect]);
    if (!stateSelect.value) return;

    const stateNode = locationData[stateSelect.value];
    if (!stateNode) return;

    populateSelect(districtSelect, stateNode.districts || []);
    districtSelect.disabled = false;
});

districtSelect.addEventListener("change", () => {
    resetSelects([parliamentSelect, assemblySelect, panchayatSelect, villageSelect]);
    if (!districtSelect.value || !stateSelect.value) return;
    populateSelect(parliamentSelect, getDistrictParliaments(stateSelect.value, districtSelect.value));
    parliamentSelect.disabled = false;
});

parliamentSelect.addEventListener("change", () => {
    resetSelects([assemblySelect, panchayatSelect, villageSelect]);
    if (!parliamentSelect.value) return;
    const assemblies = Object.keys(
        locationData[stateSelect.value].parliaments[parliamentSelect.value] || {}
    );
    populateSelect(assemblySelect, assemblies);
    assemblySelect.disabled = false;
});

assemblySelect.addEventListener("change", () => {
    resetSelects([panchayatSelect, villageSelect]);
    if (!assemblySelect.value) return;
    const assemblyNode = getAssemblyNode(
        stateSelect.value,
        parliamentSelect.value,
        assemblySelect.value
    );
    if (!assemblyNode) return;
    populatePanchayatSelect(assemblyNode);
    panchayatSelect.disabled = false;
});

panchayatSelect.addEventListener("change", () => {
    resetSelects([villageSelect]);
    if (!panchayatSelect.value) return;
    const parsed = parsePanchayatComposite(panchayatSelect.value);
    if (!parsed) return;
    const assemblyNode = getAssemblyNode(
        stateSelect.value,
        parliamentSelect.value,
        assemblySelect.value
    );
    const villages = Object.keys(
        assemblyNode[parsed.mandal][parsed.panchayat]
    );
    populateSelect(villageSelect, villages);
    villageSelect.disabled = false;
});

/* Char grids */
document.querySelectorAll(".char-grid").forEach(buildCharGrid);

document.addEventListener("input", (e) => {
    if (!e.target.closest(".char-grid")) return;

    const current = e.target;
    const inputs = [...current.parentElement.querySelectorAll("input")];
    const index = inputs.indexOf(current);

    if (current.value.length === 1 && inputs[index + 1]) {
        inputs[index + 1].focus();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key !== "Backspace" || !e.target.closest(".char-grid")) return;

    const current = e.target;
    if (current.value !== "") return;

    const inputs = [...current.parentElement.querySelectorAll("input")];
    const index = inputs.indexOf(current);

    if (inputs[index - 1]) {
        inputs[index - 1].focus();
    }
});

/* Single-select behavior for gender/religion checkboxes */
document.querySelectorAll('[data-type="checkbox-group"]').forEach(group => {
    group.addEventListener("change", (e) => {
        if (e.target.type !== "checkbox" || !e.target.checked) return;
        group.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb !== e.target) cb.checked = false;
        });
    });
});

/* Action buttons */
document.getElementById("btn-preview").addEventListener("click", openPreview);
document.getElementById("btn-clear").addEventListener("click", clearFormWithConfirm);
document.getElementById("btn-submit").addEventListener("click", submitForm);
document.getElementById("preview-exit").addEventListener("click", exitPreviewMode);
document.getElementById("preview-clear").addEventListener("click", clearFormWithConfirm);
document.getElementById("preview-print").addEventListener("click", triggerPrintPdf);
document.getElementById("preview-submit").addEventListener("click", submitForm);
document.getElementById("success-print").addEventListener("click", triggerPrintPdf);
document.getElementById("success-new").addEventListener("click", handleSuccessContinue);

document.getElementById("btn-save-exit").addEventListener("click", () => {
    saveDraft();
    showToast("Draft saved. You can close this tab and return later.", "success");
    setTimeout(() => {
        window.location.href = "about:blank";
    }, 1200);
});

document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importFile(file);
    e.target.value = "";
});

document.getElementById("import-prev").addEventListener("click", prevImportCandidate);
document.getElementById("import-next").addEventListener("click", nextImportCandidate);
document.getElementById("import-skip").addEventListener("click", skipImportCandidate);
document.getElementById("import-cancel").addEventListener("click", cancelImportReview);

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("preview-mode")) {
        exitPreviewMode();
    }
});

/* Auto-save draft periodically */
setInterval(saveDraft, 30000);
window.addEventListener("beforeunload", saveDraft);

function initSideMenu() {
    const toggle = document.getElementById("side-menu-toggle");
    const backdrop = document.getElementById("side-menu-backdrop");

    const setOpen = (open) => {
        document.body.classList.toggle("side-menu-open", open);
        toggle?.setAttribute("aria-expanded", open ? "true" : "false");
        if (backdrop) {
            if (open) {
                backdrop.removeAttribute("hidden");
            } else {
                backdrop.setAttribute("hidden", "");
            }
        }
    };

    toggle?.addEventListener("click", () => {
        setOpen(!document.body.classList.contains("side-menu-open"));
    });

    backdrop?.addEventListener("click", () => setOpen(false));

    document.querySelectorAll(".side-menu-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (window.innerWidth <= 900) {
                setOpen(false);
            }
        });
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            setOpen(false);
        }
    });
}

async function bootstrapApp() {
    initSideMenu();
    sortStaticSelects();
    try {
        await loadLocationData();
        loadDraft();
    } catch {
        showToast("Could not load Andhra Pradesh location data. Refresh the page.", "error");
    }

    fetch("/api/health")
        .then(r => r.json())
        .then(() => {})
        .catch(() => {
            showToast("Server not detected. Run: python app.py — then open http://127.0.0.1:8080/", "error");
        });
}

bootstrapApp();
