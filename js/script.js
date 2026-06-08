const locationData = {
    "Telangana": {
        "Hyderabad": {
            "Hyderabad": {
                "Malakpet": {
                    "Malakpet Mandal": {
                        "Malakpet Panchayat": {
                            "Chanchalguda": {},
                            "Azampura": {}
                        }
                    },
                    "Charminar": {
                        "Charminar Mandal": {
                            "Charminar Panchayat": {
                                "Ghansi Bazaar": {}
                            }
                        }
                    }
                }
            },
            "Secunderabad": {
                "Secunderabad": {
                    "Amberpet": {
                        "Amberpet Mandal": {
                            "Amberpet Panchayat": {
                                "Barkatpura": {}
                            }
                        }
                    }
                }
            }
        },
        "Rangareddy": {
            "Malkajgiri": {
                "Malkajgiri": {
                    "Malkajgiri Mandal": {
                        "Malkajgiri Panchayat": {
                            "Anandbagh": {}
                        }
                    },
                    "Kukatpally": {
                        "Kukatpally Mandal": {
                            "Kukatpally Panchayat": {
                                "Balanagar": {}
                            }
                        }
                    }
                }
            }
        }
    }
};

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
    mandal: "Mandal",
    village: "Village",
    panchayat: "Panchayat",
    party_affiliation: "Party Affiliation",
    krishna_sir_follower: "Krishna Sir Follower",
    position_role: "Position / Role",
    area_of_influence: "Area of Influence",
    last_interaction_date: "Last Interaction Date",
    remarks_1: "Remarks 1",
    remarks_2: "Remarks 2",
    remarks_3: "Remarks 3",
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
    "area_of_influence",
    "remarks_1"
];

const CASCADE_SELECTS = [
    { id: "state", key: "state" },
    { id: "district", key: "district" },
    { id: "parliament", key: "parliament" },
    { id: "assembly", key: "assembly" },
    { id: "mandal", key: "mandal" },
    { id: "panchayat", key: "panchayat" },
    { id: "village", key: "village" }
];

function populateSelect(select, options, placeholder = "—") {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
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

function cleanupPdfRenderRoot() {
    document.querySelectorAll(".pdf-render-root").forEach(el => el.remove());
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
    return el ? (el.value || "").trim() : "";
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
    cleanupPdfRenderRoot();
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

function showValidationErrors(errors) {
    const box = document.getElementById("validation-errors");
    if (!box) return;

    if (!errors.length) {
        box.classList.add("hidden");
        box.innerHTML = "";
        return;
    }

    box.innerHTML = `<strong>Please fix the following before submitting:</strong><ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;
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

async function setCascadeValues(data) {
    const chain = [
        { id: "state", key: "state" },
        { id: "district", key: "district" },
        { id: "parliament", key: "parliament" },
        { id: "assembly", key: "assembly" },
        { id: "mandal", key: "mandal" },
        { id: "panchayat", key: "panchayat" },
        { id: "village", key: "village" }
    ];

    for (const { id, key } of chain) {
        const value = (data[key] || "").trim();
        if (!value) break;

        const select = document.getElementById(id);
        if (!select) continue;

        await new Promise(resolve => setTimeout(resolve, 10));

        if (![...select.options].some(opt => opt.value === value)) {
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = value;
            select.appendChild(opt);
        }

        select.disabled = false;
        select.value = value;
        select.dispatchEvent(new Event("change"));
    }
}

async function fillForm(data) {
    resetSelects([districtSelect, parliamentSelect, assemblySelect, mandalSelect, panchayatSelect, villageSelect]);
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
    if (!confirm("Clear all form fields? This cannot be undone.")) {
        return;
    }
    exitPreviewMode();
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
    document.getElementById("preview-banner").classList.remove("hidden");
    setFormInteraction(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function exitPreviewMode() {
    document.body.classList.remove("preview-mode");
    document.body.classList.remove("form-frozen");
    document.getElementById("preview-banner").classList.add("hidden");
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

async function generateFormPdf() {
    if (typeof html2pdf === "undefined") {
        throw new Error("PDF library not loaded");
    }

    cleanupPdfRenderRoot();
    const source = document.getElementById("form-container");
    const wrapper = document.createElement("div");
    wrapper.className = "pdf-render-root";
    const clone = source.cloneNode(true);

    clone.querySelectorAll("select").forEach((sel, index) => {
        const original = source.querySelectorAll("select")[index];
        const text = document.createElement("div");
        text.className = "pdf-field-text";
        const selected = original.options[original.selectedIndex];
        text.textContent = selected && selected.value ? selected.textContent : "—";
        sel.replaceWith(text);
    });

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const opt = {
        margin: [4, 4, 4, 4],
        filename: "registration.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
            scale: 2,
            scrollY: 0,
            useCORS: true,
            width: source.offsetWidth
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    };

    try {
        return await html2pdf().set(opt).from(clone).outputPdf("blob");
    } finally {
        wrapper.remove();
    }
}

async function submitForm() {
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
    showToast("Generating PDF from your form...", "info");

    let pdfBlob;
    try {
        pdfBlob = await generateFormPdf();
    } catch {
        showToast("Could not generate PDF. Use Preview → Print / Save PDF, then try again.", "error");
        return;
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
            showServerErrors(result);
            return;
        }
        showToast(result.message, "success");
        exitPreviewMode();
        clearForm();
    } catch {
        showToast("Cannot reach server. Start the app with: python app.py", "error");
    }
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
        await fillForm(result.data);
        showToast("Form filled from file. Review and click Submit.", "success");
    } catch {
        showToast("Cannot reach server. Start the app with: python app.py", "error");
    }
}

/* Cascading dropdowns */
const stateSelect = document.getElementById("state");
const districtSelect = document.getElementById("district");
const parliamentSelect = document.getElementById("parliament");
const assemblySelect = document.getElementById("assembly");
const mandalSelect = document.getElementById("mandal");
const panchayatSelect = document.getElementById("panchayat");
const villageSelect = document.getElementById("village");

populateSelect(stateSelect, Object.keys(locationData));

stateSelect.addEventListener("change", () => {
    resetSelects([districtSelect, parliamentSelect, assemblySelect, mandalSelect, panchayatSelect, villageSelect]);
    if (!stateSelect.value) return;
    populateSelect(districtSelect, Object.keys(locationData[stateSelect.value]));
    districtSelect.disabled = false;
});

districtSelect.addEventListener("change", () => {
    resetSelects([parliamentSelect, assemblySelect, mandalSelect, panchayatSelect, villageSelect]);
    if (!districtSelect.value) return;
    populateSelect(parliamentSelect, Object.keys(locationData[stateSelect.value][districtSelect.value]));
    parliamentSelect.disabled = false;
});

parliamentSelect.addEventListener("change", () => {
    resetSelects([assemblySelect, mandalSelect, panchayatSelect, villageSelect]);
    if (!parliamentSelect.value) return;
    const assemblies = Object.keys(
        locationData[stateSelect.value][districtSelect.value][parliamentSelect.value]
    );
    populateSelect(assemblySelect, assemblies);
    assemblySelect.disabled = false;
});

assemblySelect.addEventListener("change", () => {
    resetSelects([mandalSelect, panchayatSelect, villageSelect]);
    if (!assemblySelect.value) return;
    const mandals = Object.keys(
        locationData[stateSelect.value][districtSelect.value][parliamentSelect.value][assemblySelect.value]
    );
    populateSelect(mandalSelect, mandals);
    mandalSelect.disabled = false;
});

mandalSelect.addEventListener("change", () => {
    resetSelects([panchayatSelect, villageSelect]);
    if (!mandalSelect.value) return;
    const panchayats = Object.keys(
        locationData[stateSelect.value][districtSelect.value][parliamentSelect.value][assemblySelect.value][mandalSelect.value]
    );
    populateSelect(panchayatSelect, panchayats);
    panchayatSelect.disabled = false;
});

panchayatSelect.addEventListener("change", () => {
    resetSelects([villageSelect]);
    if (!panchayatSelect.value) return;
    const villages = Object.keys(
        locationData[stateSelect.value][districtSelect.value][parliamentSelect.value][assemblySelect.value][mandalSelect.value][panchayatSelect.value]
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
document.getElementById("preview-print").addEventListener("click", () => window.print());
document.getElementById("preview-submit").addEventListener("click", submitForm);

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

document.getElementById("btn-export").addEventListener("click", () => {
    const key = prompt("Enter export key to download all submissions (CSV):");
    if (!key) return;
    window.location.href = `/api/export/submissions?key=${encodeURIComponent(key)}`;
});

document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importFile(file);
    e.target.value = "";
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("preview-mode")) {
        exitPreviewMode();
    }
});

/* Auto-save draft periodically */
setInterval(saveDraft, 30000);
window.addEventListener("beforeunload", saveDraft);

loadDraft();

/* Server connectivity check */
fetch("/api/health")
    .then(r => r.json())
    .then(() => {})
    .catch(() => {
        showToast("Server not detected. Run: python app.py — then open http://127.0.0.1:8080/", "error");
    });
