const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const adaInput = document.querySelector("#ada-code");
const percentInput = document.querySelector("#percent");
const amountInput = document.querySelector("#amount");
const previewPatientPercent = document.querySelector("#preview-patient-percent");
const previewPatient = document.querySelector("#preview-patient");
const previewInsurance = document.querySelector("#preview-insurance");
const previewPatientCard = document.querySelector("#preview-patient-card");
const previewInsuranceCard = document.querySelector("#preview-insurance-card");
const addButton = document.querySelector("#add-service");
const entryHint = document.querySelector("#entry-hint");
const servicesEl = document.querySelector("#services");
const serviceCountEl = document.querySelector("#service-count");
const serviceTemplate = document.querySelector("#service-template");
const totalPatientEl = document.querySelector("#total-patient");
const totalInsuranceEl = document.querySelector("#total-insurance");
const totalChargesEl = document.querySelector("#total-charges");
const barPatientEl = document.querySelector("#bar-patient");
const barDeductibleEl = document.querySelector("#bar-deductible");
const barInsuranceEl = document.querySelector("#bar-insurance");
const barCaptionEl = document.querySelector("#bar-caption");
const totalPatientServicesEl = document.querySelector("#total-patient-services");
const deductibleRowEl = document.querySelector("#deductible-row");
const totalDeductibleEl = document.querySelector("#total-deductible");
const deductibleDialog = document.querySelector("#deductible-dialog");
const deductibleForm = document.querySelector("#deductible-form");
const deductibleAmountWrap = document.querySelector("#deductible-amount-wrap");
const deductibleAmountInput = document.querySelector("#deductible-amount");
const deductibleErrorEl = document.querySelector("#deductible-error");
const editDeductibleBtn = document.querySelector("#edit-deductible");
const patientNameInput = document.querySelector("#patient-name");
const officeNameInput = document.querySelector("#office-name");
const serviceDateInput = document.querySelector("#service-date");
const serviceDateNativeInput = document.querySelector("#service-date-native");
const serviceDateCalendarBtn = document.querySelector("#service-date-calendar");
const visitBannerEl = document.querySelector("#visit-banner");
const visitPatientNameEl = document.querySelector("#visit-patient-name");
const visitOfficeNameEl = document.querySelector("#visit-office-name");
const visitServiceDateEl = document.querySelector("#visit-service-date");
const editVisitBtn = document.querySelector("#edit-visit");
const printEstimateBtn = document.querySelector("#print-estimate");
const form = document.querySelector("#entry-form");
const adaSuggestionsEl = document.querySelector("#ada-suggestions");
const adaCodeErrorEl = document.querySelector("#ada-code-error");

const ADA_DEFAULT_PREFIX = "D";
const ADA_SUGGESTION_LIMIT = 8;
const ADA_CODE_INDEX = Array.isArray(window.ADA_CDT_CODES)
  ? window.ADA_CDT_CODES.map(({ c, d }) => ({ code: c, desc: d }))
  : [];
const ADA_CODE_SET = new Set(ADA_CODE_INDEX.map((item) => item.code));

let adaSuggestionIndex = -1;
let adaSuggestionMatches = [];

let nextId = 1;
const services = [];
const visit = {
  patientName: "",
  officeName: "",
  serviceDateIso: "",
  deductibleApplicable: false,
  deductibleCents: 0,
};

let visitReady = false;
let dialogGuardPaused = false;
const DEFAULT_DOCUMENT_TITLE = document.title;

function printEstimateDocumentTitle() {
  const name = sanitizeName(visit.patientName);
  if (name === "") return DEFAULT_DOCUMENT_TITLE;
  const safe = name.replace(/[/\\:*?"<>|]/g, "").trim();
  return safe === "" ? DEFAULT_DOCUMENT_TITLE : `${safe} estimation`;
}

function setDocumentTitle(title) {
  document.title = title;
  const titleEl = document.querySelector("title");
  if (titleEl) titleEl.textContent = title;
}

function applyPrintDocumentTitle() {
  setDocumentTitle(printEstimateDocumentTitle());
}

function restoreDocumentTitle() {
  setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
}

let printFrameEl = null;

function removePrintFrame() {
  if (printFrameEl) {
    printFrameEl.remove();
    printFrameEl = null;
  }
}

function runPrintEstimate() {
  if (!visitReady) return;

  const title = printEstimateDocumentTitle();
  removePrintFrame();

  printFrameEl = document.createElement("iframe");
  printFrameEl.className = "print-frame";
  printFrameEl.setAttribute("aria-hidden", "true");
  printFrameEl.setAttribute("title", title);
  document.body.appendChild(printFrameEl);

  const frameDoc = printFrameEl.contentDocument;
  const frameWindow = printFrameEl.contentWindow;
  if (!frameDoc || !frameWindow) {
    removePrintFrame();
    applyPrintDocumentTitle();
    window.print();
    return;
  }

  const stylesHref = new URL("styles.css", window.location.href).href;
  const appClone = document.querySelector(".app").cloneNode(true);

  frameDoc.open();
  frameDoc.write(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title></title><link rel="stylesheet" href="${stylesHref}"></head><body></body></html>`
  );
  frameDoc.close();
  frameDoc.title = title;
  const frameTitleEl = frameDoc.querySelector("title");
  if (frameTitleEl) frameTitleEl.textContent = title;
  frameDoc.body.appendChild(appClone);

  let printed = false;
  const printFromFrame = () => {
    if (printed) return;
    printed = true;
    frameDoc.title = title;
    if (frameTitleEl) frameTitleEl.textContent = title;
    frameWindow.focus();
    frameWindow.print();
  };

  frameWindow.addEventListener("afterprint", removePrintFrame, { once: true });

  const stylesheet = frameDoc.querySelector('link[rel="stylesheet"]');
  if (stylesheet) {
    if (stylesheet.sheet) {
      window.setTimeout(printFromFrame, 50);
    } else {
      stylesheet.addEventListener("load", () => window.setTimeout(printFromFrame, 50), {
        once: true,
      });
      stylesheet.addEventListener("error", printFromFrame, { once: true });
      window.setTimeout(printFromFrame, 800);
    }
  } else {
    window.setTimeout(printFromFrame, 50);
  }

  applyPrintDocumentTitle();
}

function sanitizeName(raw) {
  return String(raw).replace(/\s+/g, " ").trim().slice(0, 80);
}

function sanitizeAmount(raw) {
  let value = String(raw).replace(/[^0-9.]/g, "");
  const dot = value.indexOf(".");
  if (dot !== -1) {
    value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, "");
  }
  const [whole, frac] = value.split(".");
  if (frac === undefined) return whole;
  return `${whole}.${frac.slice(0, 2)}`;
}

function sanitizePercent(raw) {
  let value = String(raw).replace(/[^0-9.]/g, "");
  const dot = value.indexOf(".");
  if (dot !== -1) {
    value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, "");
  }
  const [whole, frac] = value.split(".");
  const next = frac === undefined ? whole : `${whole}.${frac.slice(0, 2)}`;
  if (next === "" || next === ".") return next;
  const numeric = Number(next);
  if (!Number.isFinite(numeric)) return "";
  if (numeric > 100) return "100";
  return next;
}

const ADA_CODE_PATTERN = /^D\d{4}$/;

function sanitizeAdaCode(raw) {
  const text = String(raw).toUpperCase();
  if (text === "") return "";
  const digits = text.replace(/^D?/i, "").replace(/[^0-9]/g, "").slice(0, 4);
  if (digits === "" && text.includes("D")) return ADA_DEFAULT_PREFIX;
  if (digits === "") return "";
  return `${ADA_DEFAULT_PREFIX}${digits}`;
}

function isAdaCodeFormatValid(code) {
  return ADA_CODE_PATTERN.test(code);
}

function isKnownAdaCode(code) {
  return ADA_CODE_SET.has(code);
}

function isAdaCodeEntryReady(code) {
  return isAdaCodeFormatValid(code) && isKnownAdaCode(code);
}

function adaCatalogErrorMessage(code) {
  if (isAdaCodeFormatValid(code) && !isKnownAdaCode(code)) {
    return `${code} is not in the ADA code list. Pick a code from the suggestions.`;
  }
  return "";
}

function setAdaCodeFieldError(message) {
  const text = message || "";
  adaCodeErrorEl.textContent = text;
  const invalid = Boolean(text);
  adaInput.classList.toggle("is-invalid", invalid);
  adaInput.setAttribute("aria-invalid", invalid ? "true" : "false");
}

function ensureAdaDefaultOnFocus() {
  const code = sanitizeAdaCode(adaInput.value);
  if (code === "") {
    adaInput.value = ADA_DEFAULT_PREFIX;
    adaInput.setSelectionRange(1, 1);
  }
}

function resetAdaInputForNextService() {
  adaInput.value = ADA_DEFAULT_PREFIX;
  closeAdaSuggestions();
}

function filterAdaCodes(query) {
  const q = sanitizeAdaCode(query);
  if (q.length < 2) return [];
  const qUpper = q.toUpperCase();
  const qDigits = qUpper.replace(/^D/, "");
  const results = [];
  for (const item of ADA_CODE_INDEX) {
    if (item.code.startsWith(qUpper)) {
      results.push({ ...item, rank: 0 });
      continue;
    }
    if (qDigits && item.code.slice(1).startsWith(qDigits)) {
      results.push({ ...item, rank: 1 });
      continue;
    }
    const descUpper = item.desc.toUpperCase();
    if (descUpper.includes(qUpper) || (qDigits && descUpper.includes(qDigits))) {
      results.push({ ...item, rank: 2 });
    }
  }
  results.sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code));
  return results.slice(0, ADA_SUGGESTION_LIMIT);
}

function closeAdaSuggestions() {
  adaSuggestionsEl.classList.add("is-hidden");
  adaSuggestionsEl.replaceChildren();
  adaSuggestionMatches = [];
  adaSuggestionIndex = -1;
  adaInput.setAttribute("aria-expanded", "false");
  adaInput.removeAttribute("aria-activedescendant");
}

function highlightAdaSuggestion(index) {
  const items = adaSuggestionsEl.querySelectorAll(".ada-suggestion");
  items.forEach((el, i) => {
    el.classList.toggle("is-active", i === index);
    if (i === index) el.scrollIntoView({ block: "nearest" });
  });
  if (index >= 0 && items[index]) {
    adaInput.setAttribute("aria-activedescendant", items[index].id);
  } else {
    adaInput.removeAttribute("aria-activedescendant");
  }
}

function selectAdaSuggestion(code) {
  adaInput.value = code;
  closeAdaSuggestions();
  updatePreview();
  adaInput.focus();
  adaInput.setSelectionRange(code.length, code.length);
}

function renderAdaSuggestions(matches) {
  adaSuggestionMatches = matches;
  adaSuggestionIndex = -1;
  if (matches.length === 0) {
    closeAdaSuggestions();
    return;
  }
  adaSuggestionsEl.replaceChildren(
    ...matches.map((item, index) => {
      const row = document.createElement("li");
      row.className = "ada-suggestion";
      row.role = "option";
      row.id = `ada-suggestion-${index}`;
      row.dataset.code = item.code;
      const codeEl = document.createElement("span");
      codeEl.className = "ada-suggestion-code";
      codeEl.textContent = item.code;
      const descEl = document.createElement("span");
      descEl.className = "ada-suggestion-desc";
      descEl.textContent = item.desc;
      row.append(codeEl, descEl);
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectAdaSuggestion(item.code);
      });
      return row;
    })
  );
  adaSuggestionsEl.classList.remove("is-hidden");
  adaInput.setAttribute("aria-expanded", "true");
}

function adaSuggestionsAreOpen() {
  return adaSuggestionMatches.length > 0 && !adaSuggestionsEl.classList.contains("is-hidden");
}

function updateAdaSuggestions() {
  const code = sanitizeAdaCode(adaInput.value);
  if (code.length < 2) {
    closeAdaSuggestions();
    return;
  }
  renderAdaSuggestions(filterAdaCodes(code));
}

function todayIsoLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeServiceDateInput(raw) {
  const digits = String(raw).replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isoToDisplayDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${month}/${day}/${year}`;
}

function parseDisplayDate(text) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(text).trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || year < 1900 || year > 2100) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function setServiceDateFields(iso) {
  serviceDateInput.value = isoToDisplayDate(iso);
  serviceDateNativeInput.value = iso || "";
}

function readServiceDateFromForm() {
  const fromText = parseDisplayDate(serviceDateInput.value);
  if (fromText) return fromText;
  const native = serviceDateNativeInput.value;
  if (native && parseDisplayDate(isoToDisplayDate(native))) return native;
  return null;
}

function openServiceDateCalendar() {
  const iso =
    parseDisplayDate(serviceDateInput.value) ||
    serviceDateNativeInput.value ||
    todayIsoLocal();
  serviceDateNativeInput.value = iso;
  if (typeof serviceDateNativeInput.showPicker === "function") {
    try {
      serviceDateNativeInput.showPicker();
      return;
    } catch {
      /* fall through */
    }
  }
  serviceDateNativeInput.focus();
}

function amountToCents(raw) {
  const sanitized = sanitizeAmount(raw);
  if (sanitized === "" || sanitized === ".") return 0;
  const [whole, frac = ""] = sanitized.split(".");
  const dollars = whole === "" ? 0 : Number(whole);
  const cents = Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(dollars) || !Number.isFinite(cents)) return 0;
  return dollars * 100 + cents;
}

function percentToBasisPoints(raw) {
  const sanitized = sanitizePercent(raw);
  if (sanitized === "" || sanitized === ".") return null;
  const [whole, frac = ""] = sanitized.split(".");
  const percent = whole === "" ? 0 : Number(whole);
  const hundredths = Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(percent) || !Number.isFinite(hundredths)) return null;
  return Math.min(10000, Math.max(0, percent * 100 + hundredths));
}

function currentSplit() {
  const insuranceBp = percentToBasisPoints(percentInput.value);
  const chargeCents = amountToCents(amountInput.value);
  if (insuranceBp === null || chargeCents <= 0) return null;
  const insuranceCents = Math.round((chargeCents * insuranceBp) / 10000);
  return {
    chargeCents,
    insuranceCents,
    patientCents: chargeCents - insuranceCents,
    insuranceBp,
    patientBp: 10000 - insuranceBp,
  };
}

function formatCents(cents) {
  return money.format(cents / 100);
}

function formatPercent(basisPoints) {
  const whole = Math.floor(basisPoints / 100);
  const frac = basisPoints % 100;
  if (frac === 0) return `${whole}%`;
  if (frac % 10 === 0) return `${whole}.${frac / 10}%`;
  return `${whole}.${String(frac).padStart(2, "0")}%`;
}

function setCaret(input, next) {
  if (input.value === next) return;
  const pos = input.selectionStart ?? next.length;
  input.value = next;
  const caret = Math.min(pos, next.length);
  input.setSelectionRange(caret, caret);
}

function updatePreview() {
  const adaCode = sanitizeAdaCode(adaInput.value);
  const insuranceBp = percentToBasisPoints(percentInput.value);
  const split = currentSplit();
  const ready = isAdaCodeEntryReady(adaCode) && split !== null;

  previewPatientPercent.textContent =
    insuranceBp === null ? "—" : formatPercent(10000 - insuranceBp);
  previewPatient.textContent = formatCents(split ? split.patientCents : 0);
  previewInsurance.textContent = formatCents(split ? split.insuranceCents : 0);
  previewPatientCard.classList.toggle("is-zero", !ready);
  previewInsuranceCard.classList.toggle("is-zero", !ready);
  addButton.disabled = !ready;

  const catalogError = adaCatalogErrorMessage(adaCode);
  setAdaCodeFieldError(catalogError);

  const untouched =
    !isAdaCodeEntryReady(adaCode) && percentInput.value === "" && amountInput.value === "";
  if (ready) {
    entryHint.textContent = `${adaCode} is ready. Add it, then enter the next service.`;
  } else if (untouched) {
    entryHint.textContent = "Enter an ADA code, a percent, and an amount, then add it to the visit.";
  } else if (catalogError) {
    entryHint.textContent = "Choose a valid ADA code from the list to add this service.";
  } else if (adaCode === ADA_DEFAULT_PREFIX || adaCode.length < 5) {
    entryHint.textContent = "Enter the ADA code as D plus four digits (example: D0120).";
  } else if (!isAdaCodeFormatValid(adaCode)) {
    entryHint.textContent = "Use D followed by exactly four digits for the ADA code.";
  } else if (insuranceBp === null) {
    entryHint.textContent = "Enter the insurance percent for this service.";
  } else {
    entryHint.textContent = "Enter the dollar amount for this service.";
  }
}

function renderServices() {
  if (services.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Services you add will collect here.";
    servicesEl.replaceChildren(empty);
    serviceCountEl.textContent = "No services yet";
  } else {
    serviceCountEl.textContent =
      services.length === 1 ? "1 service" : `${services.length} services`;
    servicesEl.replaceChildren(
      ...services.map((service, index) => {
        const row = serviceTemplate.content.firstElementChild.cloneNode(true);
        row.querySelector(".service-code").textContent = service.adaCode;
        row.querySelector(".service-charge").textContent = formatCents(service.chargeCents);
        row.querySelector(".service-ins").textContent = formatPercent(service.insuranceBp);
        row.querySelector(".patient-amount").textContent = formatCents(service.patientCents);
        row.querySelector(".insurance-amount").textContent = formatCents(service.insuranceCents);
        if (index === services.length - 1) row.classList.add("is-latest");
        row.querySelector(".remove").addEventListener("click", () => {
          const at = services.findIndex((item) => item.id === service.id);
          if (at !== -1) services.splice(at, 1);
          renderServices();
          updateFinal();
        });
        return row;
      })
    );
  }

  updateFinal();
}

function updateFinal() {
  const sum = services.reduce(
    (total, service) => {
      total.chargeCents += service.chargeCents;
      total.insuranceCents += service.insuranceCents;
      total.patientCents += service.patientCents;
      return total;
    },
    { chargeCents: 0, insuranceCents: 0, patientCents: 0 }
  );

  const deductibleCents = visit.deductibleApplicable ? visit.deductibleCents : 0;
  const patientOwesCents = sum.patientCents + deductibleCents;

  totalPatientServicesEl.textContent = formatCents(sum.patientCents);
  totalPatientEl.textContent = formatCents(patientOwesCents);
  totalInsuranceEl.textContent = formatCents(sum.insuranceCents);
  totalChargesEl.textContent = formatCents(sum.chargeCents);

  deductibleRowEl.classList.toggle("is-hidden", !visit.deductibleApplicable);
  totalDeductibleEl.textContent = formatCents(deductibleCents);

  const barTotal =
    sum.patientCents + deductibleCents + sum.insuranceCents;
  if (barTotal === 0) {
    barPatientEl.style.width = "0%";
    barDeductibleEl.style.width = "0%";
    barInsuranceEl.style.width = "0%";
  } else {
    barPatientEl.style.width = `${(sum.patientCents / barTotal) * 100}%`;
    barDeductibleEl.style.width = `${(deductibleCents / barTotal) * 100}%`;
    barInsuranceEl.style.width = `${(sum.insuranceCents / barTotal) * 100}%`;
  }

  if (sum.chargeCents === 0 && deductibleCents === 0) {
    barCaptionEl.textContent = "The final is the sum of every service above.";
  } else if (visit.deductibleApplicable && deductibleCents > 0) {
    barCaptionEl.textContent = `${formatCents(sum.patientCents)} services + ${formatCents(deductibleCents)} deductible · ${formatCents(sum.insuranceCents)} insurance`;
  } else {
    barCaptionEl.textContent = `${formatCents(sum.patientCents)} patient · ${formatCents(sum.insuranceCents)} insurance`;
  }
}

function updateVisitBanner() {
  const ready =
    visit.patientName !== "" && visit.officeName !== "" && visit.serviceDateIso !== "";
  visitBannerEl.classList.toggle("is-hidden", !ready);
  visitPatientNameEl.textContent = ready ? visit.patientName : "—";
  visitOfficeNameEl.textContent = ready ? visit.officeName : "—";
  visitServiceDateEl.textContent = ready ? isoToDisplayDate(visit.serviceDateIso) : "—";
  updateVisitControls();
}

function updateVisitControls() {
  printEstimateBtn.disabled = !visitReady;
}

function clearVisitSetupForm() {
  patientNameInput.value = "";
  officeNameInput.value = "";
  setServiceDateFields(todayIsoLocal());
  deductibleAmountInput.value = "";
  deductibleForm.querySelectorAll('input[name="deductible-applicable"]').forEach((input) => {
    input.checked = input.value === "no";
  });
  deductibleAmountWrap.classList.add("is-hidden");
  deductibleErrorEl.textContent = "";
}

function syncDeductibleForm() {
  patientNameInput.value = visit.patientName;
  officeNameInput.value = visit.officeName;
  setServiceDateFields(visit.serviceDateIso || todayIsoLocal());
  const yes = visit.deductibleApplicable;
  deductibleForm.querySelectorAll('input[name="deductible-applicable"]').forEach((input) => {
    input.checked = input.value === (yes ? "yes" : "no");
  });
  deductibleAmountWrap.classList.toggle("is-hidden", !yes);
  if (yes && visit.deductibleCents > 0) {
    deductibleAmountInput.value = sanitizeAmount(String(visit.deductibleCents / 100));
  } else {
    deductibleAmountInput.value = "";
  }
  deductibleErrorEl.textContent = "";
}

function setCalculatorLocked(locked) {
  document.body.classList.toggle("visit-dialog-open", locked);
}

function openDeductibleDialog({ preserveFields = visitReady } = {}) {
  if (preserveFields) syncDeductibleForm();
  else clearVisitSetupForm();

  if (typeof deductibleDialog.showModal === "function") {
    deductibleDialog.showModal();
  } else {
    deductibleDialog.setAttribute("open", "");
  }
  setCalculatorLocked(true);
  patientNameInput.focus();
}

function closeDeductibleDialog() {
  dialogGuardPaused = true;
  if (deductibleDialog.open) deductibleDialog.close();
  deductibleDialog.removeAttribute("open");
  dialogGuardPaused = false;
  setCalculatorLocked(false);
}

function onDeductibleChoiceChange() {
  const yes =
    deductibleForm.querySelector('input[name="deductible-applicable"]:checked')?.value ===
    "yes";
  deductibleAmountWrap.classList.toggle("is-hidden", !yes);
  deductibleErrorEl.textContent = "";
  if (yes) deductibleAmountInput.focus();
}

function saveDeductibleFromDialog() {
  const patientName = sanitizeName(patientNameInput.value);
  const officeName = sanitizeName(officeNameInput.value);
  if (patientName === "") {
    deductibleErrorEl.textContent = "Enter the patient name.";
    patientNameInput.focus();
    return;
  }
  if (officeName === "") {
    deductibleErrorEl.textContent = "Enter the office name.";
    officeNameInput.focus();
    return;
  }

  const serviceDateIso = readServiceDateFromForm();
  if (!serviceDateIso) {
    deductibleErrorEl.textContent = "Enter a valid date of service (MM/DD/YYYY).";
    serviceDateInput.focus();
    return;
  }

  visit.patientName = patientName;
  visit.officeName = officeName;
  visit.serviceDateIso = serviceDateIso;

  const yes =
    deductibleForm.querySelector('input[name="deductible-applicable"]:checked')?.value ===
    "yes";
  if (!yes) {
    visit.deductibleApplicable = false;
    visit.deductibleCents = 0;
    visitReady = true;
    closeDeductibleDialog();
    updateVisitBanner();
    updateFinal();
    ensureAdaDefaultOnFocus();
    adaInput.focus();
    return;
  }

  const cents = amountToCents(deductibleAmountInput.value);
  if (cents <= 0) {
    deductibleErrorEl.textContent = "Enter the deductible dollar amount.";
    deductibleAmountInput.focus();
    return;
  }

  visit.deductibleApplicable = true;
  visit.deductibleCents = cents;
  visitReady = true;
  closeDeductibleDialog();
  updateVisitBanner();
  updateFinal();
  ensureAdaDefaultOnFocus();
  adaInput.focus();
}

function addService() {
  if (!visitReady) return;
  const adaCode = sanitizeAdaCode(adaInput.value);
  const catalogError = adaCatalogErrorMessage(adaCode);
  if (catalogError) {
    setAdaCodeFieldError(catalogError);
    entryHint.textContent = "Choose a valid ADA code from the list to add this service.";
    adaInput.focus();
    return;
  }
  const split = currentSplit();
  if (!isAdaCodeEntryReady(adaCode) || !split) return;
  services.push({ id: nextId++, adaCode, ...split });
  resetAdaInputForNextService();
  percentInput.value = "";
  amountInput.value = "";
  renderServices();
  updatePreview();
  servicesEl.scrollTop = servicesEl.scrollHeight;
  adaInput.focus();
}

function resetVisit() {
  visitReady = false;
  closeDeductibleDialog();

  services.length = 0;
  nextId = 1;
  visit.patientName = "";
  visit.officeName = "";
  visit.serviceDateIso = "";
  visit.deductibleApplicable = false;
  visit.deductibleCents = 0;

  resetAdaInputForNextService();
  percentInput.value = "";
  amountInput.value = "";
  clearVisitSetupForm();

  renderServices();
  updatePreview();
  updateVisitBanner();
  updateFinal();

  window.scrollTo({ top: 0, behavior: "smooth" });
  openDeductibleDialog({ preserveFields: false });
}

adaInput.addEventListener("focus", () => {
  ensureAdaDefaultOnFocus();
  updateAdaSuggestions();
});

adaInput.addEventListener("blur", () => {
  window.setTimeout(() => {
    closeAdaSuggestions();
    if (sanitizeAdaCode(adaInput.value) === "") {
      adaInput.value = ADA_DEFAULT_PREFIX;
    }
  }, 120);
});

adaInput.addEventListener("input", () => {
  setCaret(adaInput, sanitizeAdaCode(adaInput.value));
  updateAdaSuggestions();
  updatePreview();
});

adaInput.addEventListener("keydown", (event) => {
  if (!adaSuggestionsAreOpen()) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    adaSuggestionIndex = Math.min(adaSuggestionIndex + 1, adaSuggestionMatches.length - 1);
    highlightAdaSuggestion(adaSuggestionIndex);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    adaSuggestionIndex = Math.max(adaSuggestionIndex - 1, 0);
    highlightAdaSuggestion(adaSuggestionIndex);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const index = adaSuggestionIndex >= 0 ? adaSuggestionIndex : 0;
    selectAdaSuggestion(adaSuggestionMatches[index].code);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeAdaSuggestions();
  }
});

percentInput.addEventListener("input", () => {
  setCaret(percentInput, sanitizePercent(percentInput.value));
  updatePreview();
});

amountInput.addEventListener("input", () => {
  setCaret(amountInput, sanitizeAmount(amountInput.value));
  updatePreview();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addService();
});

document.querySelector("#reset").addEventListener("click", resetVisit);

printEstimateBtn.addEventListener("click", runPrintEstimate);

window.addEventListener("beforeprint", () => {
  if (!visitReady) return;
  applyPrintDocumentTitle();
});

window.addEventListener("afterprint", () => {
  window.setTimeout(restoreDocumentTitle, 300);
});

deductibleForm.querySelectorAll('input[name="deductible-applicable"]').forEach((input) => {
  input.addEventListener("change", onDeductibleChoiceChange);
});

deductibleAmountInput.addEventListener("input", () => {
  setCaret(deductibleAmountInput, sanitizeAmount(deductibleAmountInput.value));
  deductibleErrorEl.textContent = "";
});

deductibleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveDeductibleFromDialog();
});

deductibleDialog.addEventListener("cancel", (event) => {
  if (!visitReady) event.preventDefault();
});

deductibleDialog.addEventListener("close", () => {
  if (dialogGuardPaused) return;
  if (!visitReady) {
    openDeductibleDialog({ preserveFields: false });
    return;
  }
  setCalculatorLocked(false);
});

editDeductibleBtn.addEventListener("click", () => openDeductibleDialog());
editVisitBtn.addEventListener("click", () => openDeductibleDialog());

patientNameInput.addEventListener("input", () => {
  deductibleErrorEl.textContent = "";
});

officeNameInput.addEventListener("input", () => {
  deductibleErrorEl.textContent = "";
});

serviceDateInput.addEventListener("input", () => {
  setCaret(serviceDateInput, sanitizeServiceDateInput(serviceDateInput.value));
  deductibleErrorEl.textContent = "";
  const iso = parseDisplayDate(serviceDateInput.value);
  if (iso) serviceDateNativeInput.value = iso;
});

serviceDateNativeInput.addEventListener("input", () => {
  deductibleErrorEl.textContent = "";
  const iso = serviceDateNativeInput.value;
  if (iso) serviceDateInput.value = isoToDisplayDate(iso);
});

serviceDateNativeInput.addEventListener("change", () => {
  deductibleErrorEl.textContent = "";
  const iso = serviceDateNativeInput.value;
  if (iso) serviceDateInput.value = isoToDisplayDate(iso);
});

serviceDateCalendarBtn.addEventListener("click", () => {
  deductibleErrorEl.textContent = "";
  openServiceDateCalendar();
});

renderServices();
updatePreview();
visitReady = false;
updateVisitBanner();
openDeductibleDialog({ preserveFields: false });
