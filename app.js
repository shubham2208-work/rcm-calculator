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
const barInsuranceEl = document.querySelector("#bar-insurance");
const barCaptionEl = document.querySelector("#bar-caption");
const form = document.querySelector("#entry-form");

let nextId = 1;
const services = [];

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

function sanitizeAdaCode(raw) {
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
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
  const ready = adaCode !== "" && split !== null;

  previewPatientPercent.textContent =
    insuranceBp === null ? "—" : formatPercent(10000 - insuranceBp);
  previewPatient.textContent = formatCents(split ? split.patientCents : 0);
  previewInsurance.textContent = formatCents(split ? split.insuranceCents : 0);
  previewPatientCard.classList.toggle("is-zero", !ready);
  previewInsuranceCard.classList.toggle("is-zero", !ready);
  addButton.disabled = !ready;

  const untouched =
    adaCode === "" && percentInput.value === "" && amountInput.value === "";
  if (ready) {
    entryHint.textContent = `${adaCode} is ready. Add it, then enter the next service.`;
  } else if (untouched) {
    entryHint.textContent = "Enter an ADA code, a percent, and an amount, then add it to the visit.";
  } else if (adaCode === "") {
    entryHint.textContent = "Enter the ADA code for this service.";
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

  totalPatientEl.textContent = formatCents(sum.patientCents);
  totalInsuranceEl.textContent = formatCents(sum.insuranceCents);
  totalChargesEl.textContent = formatCents(sum.chargeCents);

  const charge = sum.chargeCents;
  const patientWidth = charge === 0 ? 0 : (sum.patientCents / charge) * 100;
  barPatientEl.style.width = `${patientWidth}%`;
  barInsuranceEl.style.width = `${charge === 0 ? 0 : 100 - patientWidth}%`;
  barCaptionEl.textContent =
    charge === 0
      ? "The final is the sum of every service above."
      : `${formatCents(sum.patientCents)} patient · ${formatCents(sum.insuranceCents)} insurance`;
}

function addService() {
  const adaCode = sanitizeAdaCode(adaInput.value);
  const split = currentSplit();
  if (adaCode === "" || !split) return;
  services.push({ id: nextId++, adaCode, ...split });
  adaInput.value = "";
  percentInput.value = "";
  amountInput.value = "";
  renderServices();
  updatePreview();
  servicesEl.scrollTop = servicesEl.scrollHeight;
  adaInput.focus();
}

function resetVisit() {
  services.splice(0, services.length);
  nextId = 1;
  adaInput.value = "";
  percentInput.value = "";
  amountInput.value = "";
  renderServices();
  updatePreview();
  adaInput.focus();
}

adaInput.addEventListener("input", () => {
  setCaret(adaInput, sanitizeAdaCode(adaInput.value));
  updatePreview();
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

renderServices();
updatePreview();
adaInput.focus();
