/**
 * BaBa Computer - Land Valuation Web App
 * Core Application Logic (app.js)
 */

'use strict';

const App = {
  // Application State
  state: {
    villages: [],
    rates: {},
    activeVillage: null,
    activeSection: '',
    activeRates: [],
    calculatedResult: null,
    history: [],
    adminActiveSubtab: 'villages'
  },

  // Initialize App
  init() {
    this.loadData();
    this.bindEvents();
    this.renderVillageDirectory();
    this.renderHistoryTable();
    this.initAdminPanel();
    this.showScreen('directory');
  },

  // Load data from localStorage or fallback to data.js defaults
  loadData() {
    const savedVillages = localStorage.getItem('baba_villages');
    if (savedVillages) {
      this.state.villages = JSON.parse(savedVillages);
    } else {
      this.state.villages = [...DEFAULT_VILLAGES];
      localStorage.setItem('baba_villages', JSON.stringify(DEFAULT_VILLAGES));
    }

    const savedRates = localStorage.getItem('baba_rates');
    if (savedRates) {
      this.state.rates = JSON.parse(savedRates);
    } else {
      this.state.rates = JSON.parse(JSON.stringify(DEFAULT_RATES));
      localStorage.setItem('baba_rates', JSON.stringify(DEFAULT_RATES));
    }

    const savedHistory = localStorage.getItem('baba_history');
    if (savedHistory) {
      this.state.history = JSON.parse(savedHistory);
    }
  },

  // Save to localStorage
  saveData() {
    localStorage.setItem('baba_villages', JSON.stringify(this.state.villages));
    localStorage.setItem('baba_rates', JSON.stringify(this.state.rates));
  },

  // Bind UI Events
  bindEvents() {
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const screenName = tab.getAttribute('data-tab');
        this.showScreen(screenName);
      });
    });

    const searchInput = document.getElementById('village-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterVillageDirectory(searchInput.value);
      });
    }

    const btnCalc = document.getElementById('btn-calculate');
    if (btnCalc) {
      btnCalc.addEventListener('click', () => {
        this.runCalculation();
      });
    }

    const liveInputs = ['input-x', 'input-y', 'input-divisor'];
    liveInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => {
          this.calculateLiveAakar();
        });
      }
    });

    document.querySelectorAll('input[name="multiplier"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.calculateLiveAakar();
      });
    });

    const btnCopy = document.getElementById('btn-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => this.copyToClipboard());
    }

    const btnPrint = document.getElementById('btn-print');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }

    const btnNew = document.getElementById('btn-new-calc');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        this.showScreen('directory');
        this.resetCalculatorForm();
      });
    }

    const btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', () => {
        if (confirm('सर्व जुना इतिहास डिलीट करायचा आहे का?')) {
          this.state.history = [];
          localStorage.removeItem('baba_history');
          this.renderHistoryTable();
          this.showToast('इतिहास साफ केला!', 'success');
        }
      });
    }
  },

  showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(scr => scr.classList.remove('active'));
    document.querySelectorAll('[data-tab]').forEach(tab => tab.classList.remove('active'));

    const targetScreen = document.getElementById(`screen-${screenName}`);
    const targetTab = document.querySelector(`[data-tab="${screenName}"]`);

    if (targetScreen) targetScreen.classList.add('active');
    if (targetTab) targetTab.classList.add('active');

    if (screenName === 'admin') {
      this.renderAdminPanel();
    } else if (screenName === 'history') {
      this.renderHistoryTable();
    }
  },

  resetCalculatorForm() {
    document.getElementById('input-x').value = '';
    document.getElementById('input-y').value = '';
    document.getElementById('input-divisor').value = '1';
    document.getElementById('radio-m1').checked = true;
    document.getElementById('calculated-aakar').textContent = '—';
    document.getElementById('live-matched-range').textContent = '—';
    document.getElementById('results-wrapper').style.display = 'none';

    document.querySelectorAll('#rate-table-body tr').forEach(row => {
      row.classList.remove('active-row');
    });
  },

  renderVillageDirectory() {
    const grid = document.getElementById('directory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const sortedVillages = [...this.state.villages].sort((a, b) =>
      a.name.localeCompare(b.name, 'mr')
    );
    sortedVillages.forEach(v => {
      const vCard = document.createElement('div');
      vCard.className = 'village-card';
      vCard.setAttribute('data-id', v.id);
      vCard.innerHTML = `
        <div class="village-name">${v.name}</div>
        <div class="sec-tag">विभाग ${v.section}</div>
      `;
      vCard.addEventListener('click', () => this.selectVillage(v));
      grid.appendChild(vCard);
    });
  },

  filterVillageDirectory(query) {
    const q = query.trim().toLowerCase();
    const cards = document.querySelectorAll('#directory-grid .village-card');
    cards.forEach(card => {
      const name = card.querySelector('.village-name').textContent.toLowerCase();
      const section = card.querySelector('.sec-tag').textContent.toLowerCase();
      if (name.includes(q) || section.includes(q)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  },

  selectVillage(village) {
    this.state.activeVillage = village;
    this.state.activeSection = village.section;
    this.state.activeRates = this.state.rates[village.section] || [];
    document.getElementById('calc-village-name').textContent = village.name;
    document.getElementById('calc-section-num').textContent = `विभाग ${village.section}`;
    this.renderRatesTable();
    this.resetCalculatorForm();
    this.showScreen('valuation');
    this.showToast(`${village.name} निवडले!`, 'success');
  },

  renderRatesTable() {
    const tbody = document.getElementById('rate-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!this.state.activeRates.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">दर उपलब्ध नाहीत. कृपया ॲडमिन पॅनेल तपासा.</td></tr>`;
      return;
    }
    this.state.activeRates.forEach((slab, index) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-index', index);
      tr.innerHTML = `
        <td><strong>${slab.description}</strong></td>
        <td>₹${slab.rate.toLocaleString('en-IN')}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  calculateLiveAakar() {
    const xVal = parseFloat(document.getElementById('input-x').value);
    const yVal = parseFloat(document.getElementById('input-y').value);
    const aakarText = document.getElementById('calculated-aakar');
    const rangeText = document.getElementById('live-matched-range');

    if (isNaN(xVal) || isNaN(yVal) || yVal === 0) {
      aakarText.textContent = '—';
      rangeText.textContent = '—';
      document.querySelectorAll('#rate-table-body tr').forEach(row => row.classList.remove('active-row'));
      return;
    }
    const aakar = xVal / yVal;
    aakarText.textContent = aakar.toFixed(4) + ' (आकर)';
    const matchIndex = this.findSlabIndex(aakar);
    if (matchIndex !== -1) {
      const matchedSlab = this.state.activeRates[matchIndex];
      rangeText.textContent = `श्रेणी: ${matchedSlab.description} (दर: ₹${matchedSlab.rate.toLocaleString('en-IN')})`;
      document.querySelectorAll('#rate-table-body tr').forEach((row, idx) => {
        if (idx === matchIndex) row.classList.add('active-row');
        else row.classList.remove('active-row');
      });
    } else {
      rangeText.textContent = 'रेंज जुळली नाही';
      document.querySelectorAll('#rate-table-body tr').forEach(row => row.classList.remove('active-row'));
    }
  },

  findSlabIndex(aakar) {
    if (!this.state.activeRates.length) return -1;
    for (let i = 0; i < this.state.activeRates.length; i++) {
      const slab = this.state.activeRates[i];
      if (aakar >= slab.slabMin && aakar <= slab.slabMax) return i;
    }
    return this.state.activeRates.length - 1;
  },

  runCalculation() {
    const xInput = document.getElementById('input-x');
    const yInput = document.getElementById('input-y');
    const divInput = document.getElementById('input-divisor');

    const x = parseFloat(xInput.value);
    const y = parseFloat(yInput.value);
    const divisor = parseFloat(divInput.value) || 1;

    let hasError = false;
    if (isNaN(x) || x < 0) { xInput.closest('.form-group').classList.add('has-error'); hasError = true; } else { xInput.closest('.form-group').classList.remove('has-error'); }
    if (isNaN(y) || y <= 0) { yInput.closest('.form-group').classList.add('has-error'); hasError = true; } else { yInput.closest('.form-group').classList.remove('has-error'); }
    if (isNaN(divisor) || divisor <= 0) { divInput.closest('.form-group').classList.add('has-error'); hasError = true; } else { divInput.closest('.form-group').classList.remove('has-error'); }

    if (!this.state.activeVillage) {
      this.showToast('कृपया प्रथम गाव निवडा!', 'error');
      this.showScreen('directory');
      return;
    }

    if (hasError) {
      this.showToast('कृपया सर्व रकाने योग्यरित्या भरा!', 'error');
      return;
    }

    // Step 1: Aakar & Base Valuation
    const aakar = x / y;
    const slabIndex = this.findSlabIndex(aakar);
    if (slabIndex === -1) {
      this.showToast('दर चार्टमध्ये जुळणारी रेंज सापडली नाही.', 'error');
      return;
    }

    const matchedSlab = this.state.activeRates[slabIndex];
    const baseValuation = matchedSlab.rate;

    // Step 2: Multiplier Calculation
    const multiplier = parseFloat(document.querySelector('input[name="multiplier"]:checked').value);
    const multipliedValuation = baseValuation * multiplier;

    // Step 3: Value per 100 (Divided by 100)
    const valuePer100 = multipliedValuation / 100;

    // Step 4: Final Value (Multiply Value per 100 by Divisor text input)
    const finalDividedValue = valuePer100 * divisor;

    const valuePerUnit = multipliedValuation; // Hectare rate for display

    // Step 5: Duties calculated ONLY on the final divided value
    const duty6Div = Math.round(finalDividedValue * 0.06);
    const duty5Div = Math.round(finalDividedValue * 0.05);
    const duty1Div = Math.round(finalDividedValue * 0.01);

    const result = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString('mr-IN'),
      villageName: this.state.activeVillage.name,
      section: this.state.activeSection,
      x: x,
      y: y,
      aakar: aakar.toFixed(4),
      matchedRange: matchedSlab.description,
      baseValuation: baseValuation,
      multiplier: multiplier,
      multipliedValuation: multipliedValuation,
      divisor: divisor,
      finalDividedValue: finalDividedValue,
      valuePer100: valuePer100,
      valuePerUnit: valuePerUnit,
      duties: {
        divided: { duty6: duty6Div, duty5: duty5Div, duty1: duty1Div }
      }
    };

    this.state.calculatedResult = result;
    this.state.history.unshift(result);
    if (this.state.history.length > 50) this.state.history.pop();
    localStorage.setItem('baba_history', JSON.stringify(this.state.history));

    this.renderResultCard(result);
    this.showToast('मूल्यांकन यशस्वीरित्या मोजले!', 'success');
  },

  renderResultCard(res) {
    const wrapper = document.getElementById('results-wrapper');
    wrapper.style.display = 'block';

    document.getElementById('res-village').textContent = res.villageName;
    document.getElementById('res-section').textContent = `विभाग ${res.section}`;
    document.getElementById('res-aakar-calc').textContent = `${res.x} ÷ ${res.y} = ${res.aakar}`;
    document.getElementById('res-matched-range').textContent = res.matchedRange;
    document.getElementById('res-base-val').textContent = `₹${res.baseValuation.toLocaleString('en-IN')}`;

    document.getElementById('res-multiplier').textContent = `${res.multiplier}x`;
    document.getElementById('res-multiplied-val').textContent = `₹${res.multipliedValuation.toLocaleString('en-IN')}`;

    document.getElementById('res-divisor').textContent = res.divisor;
    document.getElementById('res-value-100').textContent = `₹${res.valuePer100.toLocaleString('en-IN')}`;
    document.getElementById('res-value-1').textContent = `₹${res.valuePerUnit.toLocaleString('en-IN')}`;

    // Final divided value (Value per 100 * Divisor)
    document.getElementById('res-divided-value').textContent = `₹${Math.round(res.finalDividedValue).toLocaleString('en-IN')}`;

    // Duties Table
    document.getElementById('res-duty-6-div').textContent = `₹${res.duties.divided.duty6.toLocaleString('en-IN')}`;
    document.getElementById('res-duty-5-div').textContent = `₹${res.duties.divided.duty5.toLocaleString('en-IN')}`;
    document.getElementById('res-duty-1-div').textContent = `₹${res.duties.divided.duty1.toLocaleString('en-IN')}`;

    setTimeout(() => {
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  },

  renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!this.state.history.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--clr-text-muted);padding:2rem;">अद्याप कोणताही इतिहास उपलब्ध नाही.</td></tr>`;
      return;
    }
    this.state.history.forEach((h) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${h.timestamp}</td>
        <td><strong>${h.villageName}</strong> (वि. ${h.section})</td>
        <td>${h.x} ÷ ${h.y} = ${h.aakar}</td>
        <td>₹${h.baseValuation.toLocaleString('en-IN')}</td>
        <td>${h.multiplier}</td>
        <td><strong>₹${Math.round(h.finalDividedValue).toLocaleString('en-IN')}</strong></td>
        <td>
          <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.9rem;" onclick="App.recallHistoryItem('${h.id}')">🔄 वापरा</button>
          <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.9rem; border-color: var(--clr-danger); color: var(--clr-danger);" onclick="App.deleteHistoryItem('${h.id}')">❌</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  recallHistoryItem(id) {
    const item = this.state.history.find(h => h.id === id);
    if (!item) return;

    const village = this.state.villages.find(v => v.name === item.villageName);
    if (village) {
      this.state.activeVillage = village;
      this.state.activeSection = village.section;
      this.state.activeRates = this.state.rates[village.section] || [];
      document.getElementById('calc-village-name').textContent = village.name;
      document.getElementById('calc-section-num').textContent = `विभाग ${village.section}`;
      this.renderRatesTable();
    }

    document.getElementById('input-x').value = item.x;
    document.getElementById('input-y').value = item.y;
    document.getElementById('input-divisor').value = item.divisor;
    document.querySelectorAll('input[name="multiplier"]').forEach(radio => {
      if (parseFloat(radio.value) === item.multiplier) radio.checked = true;
    });

    this.showScreen('valuation');
    this.calculateLiveAakar();
    this.runCalculation();
    this.showToast('इतिहास मोजणी पुन्हा लोड केली!', 'success');
  },

  deleteHistoryItem(id) {
    this.state.history = this.state.history.filter(h => h.id !== id);
    localStorage.setItem('baba_history', JSON.stringify(this.state.history));
    this.renderHistoryTable();
    this.showToast('इतिहास नोंद काढली!', 'success');
  },

  initAdminPanel() {
    document.querySelectorAll('.admin-subtab').forEach(subtab => {
      subtab.addEventListener('click', () => {
        document.querySelectorAll('.admin-subtab').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.admin-subscreen').forEach(scr => scr.classList.remove('active'));
        subtab.classList.add('active');
        const subscreenName = subtab.getAttribute('data-admin-subtab');
        document.getElementById(`admin-${subscreenName}`).classList.add('active');
        this.state.adminActiveSubtab = subscreenName;
      });
    });

    const btnAddVil = document.getElementById('btn-admin-add-village');
    if (btnAddVil) btnAddVil.addEventListener('click', () => this.openVillageModal());

    const formVillage = document.getElementById('form-village-modal');
    if (formVillage) formVillage.addEventListener('submit', (e) => { e.preventDefault(); this.saveVillageModal(); });

    const btnSaveRates = document.getElementById('btn-admin-save-rates');
    if (btnSaveRates) btnSaveRates.addEventListener('click', () => this.saveAdminRates());

    const btnResetData = document.getElementById('btn-admin-reset-default');
    if (btnResetData) {
      btnResetData.addEventListener('click', () => {
        if (confirm('सर्व माहिती (गावे आणि दर) मूळ स्वरूपात रिसेट करायची आहे का? तुम्ही केलेले बदल नष्ट होतील.')) {
          localStorage.removeItem('baba_villages');
          localStorage.removeItem('baba_rates');
          this.loadData();
          this.renderVillageDirectory();
          this.renderAdminPanel();
          this.showToast('डेटा मूळ स्वरूपात रिसेट केला!', 'success');
        }
      });
    }

    const selectSec = document.getElementById('admin-rate-section-select');
    if (selectSec) selectSec.addEventListener('change', () => this.renderAdminRatesEditor(selectSec.value));

    const btnExport = document.getElementById('btn-admin-export');
    if (btnExport) btnExport.addEventListener('click', () => this.exportDatabase());

    const fileImportInput = document.getElementById('admin-import-file');
    if (fileImportInput) fileImportInput.addEventListener('change', (e) => this.importDatabase(e));
  },

  renderAdminPanel() {
    this.renderAdminVillagesList();
    const selectSec = document.getElementById('admin-rate-section-select');
    if (selectSec) this.renderAdminRatesEditor(selectSec.value);
  },

  renderAdminVillagesList() {
    const tbody = document.getElementById('admin-villages-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const sorted = [...this.state.villages].sort((a, b) => a.name.localeCompare(b.name, 'mr'));
    sorted.forEach((v, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${v.name}</strong></td>
        <td>विभाग ${v.section}</td>
        <td>
          <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;" onclick="App.openVillageModal('${v.id}')">✏️ एडिट</button>
          <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.85rem; border-color:var(--clr-danger); color:var(--clr-danger);" onclick="App.deleteVillage('${v.id}')">🗑️ डिलीट</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  renderAdminRatesEditor(section) {
    const container = document.getElementById('admin-rates-editor-container');
    if (!container) return;
    container.innerHTML = '';
    const slabs = this.state.rates[section] || [];
    if (!slabs.length) {
      container.innerHTML = `<p style="padding: 1rem; color:var(--clr-danger);">या विभागासाठी दर उपलब्ध नाहीत.</p>`;
      return;
    }
    slabs.forEach((slab, idx) => {
      const div = document.createElement('div');
      div.className = 'form-group';
      div.style.display = 'grid';
      div.style.gridTemplateColumns = '1.5fr 1fr 1fr';
      div.style.gap = '1rem';
      div.style.alignItems = 'center';
      div.style.borderBottom = '1px solid var(--clr-border-light)';
      div.style.paddingBottom = '0.75rem';
      div.innerHTML = `
        <div><span style="font-weight:600;">आकर श्रेणी:</span> ${slab.description}</div>
        <div>
          <label style="font-size:0.85rem; color:var(--clr-text-muted);">किमान आकार</label>
          <input type="number" class="form-control text-en slab-min-input" step="0.01" value="${slab.slabMin}" data-idx="${idx}">
        </div>
        <div>
          <label style="font-size:0.85rem; color:var(--clr-text-muted);">दर (₹ प्रति हेक्टर)</label>
          <input type="number" class="form-control text-en slab-rate-input" value="${slab.rate}" data-idx="${idx}">
        </div>
      `;
      container.appendChild(div);
    });
  },

  saveAdminRates() {
    const selectSec = document.getElementById('admin-rate-section-select');
    if (!selectSec) return;
    const section = selectSec.value;
    const slabs = this.state.rates[section];
    if (!slabs) return;
    const minInputs = document.querySelectorAll('.slab-min-input');
    const rateInputs = document.querySelectorAll('.slab-rate-input');
    let validationFailed = false;

    minInputs.forEach(input => {
      const idx = parseInt(input.getAttribute('data-idx'));
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 0) { input.classList.add('has-error'); validationFailed = true; }
      else { input.classList.remove('has-error'); slabs[idx].slabMin = val; }
    });

    rateInputs.forEach(input => {
      const idx = parseInt(input.getAttribute('data-idx'));
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 0) { input.classList.add('has-error'); validationFailed = true; }
      else { input.classList.remove('has-error'); slabs[idx].rate = val; }
    });

    if (validationFailed) { this.showToast('दर किंवा आकर मूल्यांमध्ये त्रुटी आढळली!', 'error'); return; }

    for (let i = 0; i < slabs.length; i++) {
      if (i < slabs.length - 1) {
        const nextMin = slabs[i + 1].slabMin;
        slabs[i].slabMax = nextMin;
        slabs[i].description = `${slabs[i].slabMin.toFixed(2)} ते ${nextMin.toFixed(2)}`;
      } else {
        slabs[i].slabMax = 99999.00;
        slabs[i].description = `${slabs[i].slabMin.toFixed(2)} पेक्षा जास्त`;
      }
    }
    this.saveData();
    this.renderAdminRatesEditor(section);
    this.renderRatesTable();
    this.showToast('नवीन दर यशस्वीरित्या जतन केले!', 'success');
  },

  openVillageModal(villageId = '') {
    const modal = document.getElementById('village-modal');
    const title = document.getElementById('modal-title');
    const idInput = document.getElementById('modal-village-id');
    const nameInput = document.getElementById('modal-village-name');
    const secInput = document.getElementById('modal-village-section');
    if (villageId) {
      const v = this.state.villages.find(vil => vil.id === villageId);
      if (!v) return;
      title.textContent = 'गाव एडिट करा';
      idInput.value = v.id;
      nameInput.value = v.name;
      secInput.value = v.section;
    } else {
      title.textContent = 'नवीन गाव जोडा';
      idInput.value = '';
      nameInput.value = '';
      secInput.value = '2';
    }
    modal.style.display = 'flex';
  },

  closeVillageModal() {
    const modal = document.getElementById('village-modal');
    if (modal) modal.style.display = 'none';
  },

  saveVillageModal() {
    const id = document.getElementById('modal-village-id').value;
    const name = document.getElementById('modal-village-name').value.trim();
    const section = document.getElementById('modal-village-section').value;
    if (!name) { alert('कृपया गावाचे नाव प्रविष्ट करा!'); return; }
    if (id) {
      const v = this.state.villages.find(vil => vil.id === id);
      if (v) { v.name = name; v.section = section; this.showToast('गाव एडिट केले!', 'success'); }
    } else {
      const newId = 'V' + (this.state.villages.length + 1).toString().padStart(3, '0');
      this.state.villages.push({ id: newId, name: name, section: section });
      this.showToast('नवीन गाव जोडले!', 'success');
    }
    this.saveData();
    this.closeVillageModal();
    this.renderVillageDirectory();
    this.renderAdminVillagesList();
  },

  deleteVillage(id) {
    if (confirm('तुम्हाला हे गाव डिलीट करायचे आहे का?')) {
      this.state.villages = this.state.villages.filter(v => v.id !== id);
      this.saveData();
      this.renderVillageDirectory();
      this.renderAdminVillagesList();
      this.showToast('गाव डिलीट केले!', 'success');
    }
  },

  exportDatabase() {
    const db = { villages: this.state.villages, rates: this.state.rates };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `baba_computer_rates_backup_${Date.now()}.json`);
    dlAnchorElem.click();
    this.showToast('डेटाबेस बॅकअप फाईल डाउनलोड झाली!', 'success');
  },

  importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.villages && imported.rates) {
          this.state.villages = imported.villages;
          this.state.rates = imported.rates;
          this.saveData();
          this.renderVillageDirectory();
          this.renderAdminPanel();
          this.showToast('डेटाबेस यशस्वीरित्या इंपोर्ट केला!', 'success');
        } else { this.showToast('अवैध डेटाबेस फाईल स्वरूप!', 'error'); }
      } catch (err) { this.showToast('फाईल वाचण्यात त्रुटी!', 'error'); }
    };
    reader.readAsText(file);
  },

  copyToClipboard() {
    const res = this.state.calculatedResult;
    if (!res) { this.showToast('प्रथम मोजणी करा!', 'error'); return; }

    const text = `
------------------------------------------------
🏛️ बाबा कॉम्प्युटर (BaBa Computer) - जमिनीचे मूल्यांकन
------------------------------------------------
दिनांक व वेळ: ${res.timestamp}
गाव: ${res.villageName}
विभाग: विभाग ${res.section}
श्रेणी (आकर रेंज): ${res.matchedRange}
------------------------------------------------
१) आकार मोजणी: X ÷ Y = आकार
   ${res.x} ÷ ${res.y} = ${res.aakar}
२) पायाभूत दर (प्रति हेक्टर): ₹${res.baseValuation.toLocaleString('en-IN')}
३) गुणांक (Multiplier): ${res.multiplier}x
४) गुणीत मूल्यांकन दर: ₹${res.multipliedValuation.toLocaleString('en-IN')}
------------------------------------------------
📐 प्रति १०० दर (Value per 100): ₹${res.valuePer100.toLocaleString('en-IN')}
   वाटेकरी/संख्या इनपुट: ${res.divisor}
------------------------------------------------
💰 अंतिम हिस्सा मूल्यांकन: ₹${Math.round(res.finalDividedValue).toLocaleString('en-IN')}
------------------------------------------------
🔖 शासकीय शुल्क (स्टॅम्प ड्युटी) - अंतिम मूल्यांकनावर:
- ६% स्टॅम्प ड्युटी: ₹${res.duties.divided.duty6.toLocaleString('en-IN')}
- ५% स्टॅम्प ड्युटी (कृषी): ₹${res.duties.divided.duty5.toLocaleString('en-IN')}
- १% नोंदणी फी: ₹${res.duties.divided.duty1.toLocaleString('en-IN')}
------------------------------------------------
नोंद: हे मूल्य केवळ अंदाजित शासकीय दरांवर आधारित आहे.
    `;
    navigator.clipboard.writeText(text.trim()).then(() => {
      this.showToast('रिपोर्ट क्लिपबोर्डवर कॉपी केला!', 'success');
    }).catch(err => {
      this.showToast('कॉपी करण्यास अडचण आली!', 'error');
    });
  },

  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => { toast.remove(); }, 300);
    }, 3000);
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => { App.init(); });