const CSV_URL = './data.csv';

let allRows = [];
let typingTimer = null;
let selectedQuickStat = '';
let searchRequestId = 0;

const MIN_SEARCH_FEEDBACK_MS = 360;

const MACHINE_COLORS = {
  'thi tran xanh': '#2F9E44',
  'rung phap thuat': '#8B5CF6',
  'cao nguyen du muc': '#F97316',
  'ben cang cuop bien': '#2563EB',
  'rung ngu say': '#EC4899',
  'thanh dia nam': '#A16207',
  'suoi nuoc nong': '#06B6D4',
  'thanh pho la moi': '#10B981',
  'lang tuyet': '#60A5FA',
  'singapore': '#1D4ED8',
  'thanh pho hon loan': '#EF4444'
};


const elements = {
  itemName: document.getElementById('itemName'),
  basicStat: document.getElementById('basicStat'),
  upgrade: document.getElementById('upgrade'),
  category: document.getElementById('category'),
  job: document.getElementById('job'),
  machine: document.getElementById('machine'),

  resetButton: document.getElementById('resetButton'),

  status: document.getElementById('status'),
  resultBody: document.getElementById('resultBody'),
  content: document.querySelector('.content'),
  tableCard: document.querySelector('.table-card'),
  tableScroll: document.querySelector('.table-scroll'),
  searchProgress: document.getElementById('searchProgress'),

  quickChips: [...document.querySelectorAll('.quick-chip')]
};

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  loadData();
  window.addEventListener('resize', updateTableHeightMode);
});

function attachEvents() {
  elements.resetButton.addEventListener('click', loadData);

  elements.itemName.addEventListener('input', () => {
    clearTimeout(typingTimer);
    searchRequestId++;

    elements.status.textContent = 'Đang tìm...';
    setSearchProgress(true);

    typingTimer = setTimeout(() => {
      syncQuickChips();
      filterWithFeedback();
    }, 180);
  });

  [
    elements.basicStat,
    elements.upgrade,
    elements.category,
    elements.job,
    elements.machine
  ].forEach(select => {
    select.addEventListener('change', () => {
      if (select === elements.basicStat) {
        selectedQuickStat = '';
      }

      syncQuickChips();
      syncSelectIcons();
      filterWithFeedback();
    });
  });

  elements.quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      applyQuickFilter(chip);
    });
  });
}

async function loadData() {
  searchRequestId++;
  setSearchProgress(false);
  showMessage('Đang tải dữ liệu...');
  elements.status.textContent = 'Đang tải dữ liệu...';

  try {
    const response = await fetch(`${CSV_URL}?t=${Date.now()}`);

    if (!response.ok) {
      throw new Error(
        `Không tải được data.csv: HTTP ${response.status}`
      );
    }

    const csvText = await response.text();
    const parsedRows = parseCsv(csvText);

    if (parsedRows.length < 2) {
      throw new Error('File data.csv không có dữ liệu.');
    }

    allRows = parsedRows
      .slice(1)
      .map(row => normalizeRowLength(row, 7))
      .map(row =>
        row.map(value => String(value ?? '').trim())
      )
      .filter(row => row[0] !== '');

    createDropdowns();
    resetFilters(false);
    syncSelectIcons();
    filterAndRender();
  } catch (error) {
    elements.status.textContent = 'Không thể tải dữ liệu';
    showMessage(`Lỗi: ${error.message}`);
  }
}

function createDropdowns() {
  fillSelect(elements.basicStat, uniqueValues(1));
  fillSelect(elements.upgrade, uniqueValues(2));
  fillSelect(elements.category, uniqueValues(4));
  fillSelect(elements.job, uniqueJobValues());
  fillSelect(elements.machine, uniqueMachineValues());
}

function uniqueValues(columnIndex) {
  const values = allRows
    .map(row => String(row[columnIndex] ?? '').trim())
    .filter(Boolean);

  return [...new Set(values)].sort(compareVietnamese);
}

function uniqueMachineValues() {
  const values = [];

  allRows.forEach(row => {
    splitMachines(row[6]).forEach(machine => {
      values.push(machine);
    });
  });

  return [...new Set(values)].sort(compareVietnamese);
}

function uniqueJobValues() {
  const values = [];

  allRows.forEach(row => {
    splitJobs(row[5]).forEach(job => {
      values.push(job);
    });
  });

  return [...new Set(values)].sort(compareVietnamese);
}

function compareVietnamese(a, b) {
  return a.localeCompare(
    b,
    'vi',
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}

function fillSelect(selectElement, values) {
  selectElement.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = '';
  allOption.setAttribute('aria-label', 'Tất cả');
  selectElement.appendChild(allOption);

  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function applyQuickFilter(chip) {
  const filterType = chip.dataset.filterType;
  const filterValue = chip.dataset.filterValue;

  if (filterType === 'category') {
    const selectedIsSame =
      normalize(elements.category.value) === normalize(filterValue);

    elements.category.value = selectedIsSame
      ? ''
      : findRealOptionValue(elements.category, filterValue);
  }

  if (filterType === 'stat') {
    selectedQuickStat =
      selectedQuickStat === filterValue
        ? ''
        : filterValue;

    elements.basicStat.value = '';
  }

  if (filterType === 'item-name') {
    const selectedIsSame =
      normalize(elements.itemName.value) === normalize(filterValue);

    elements.itemName.value = selectedIsSame
      ? ''
      : filterValue;
  }

  syncQuickChips();
  syncSelectIcons();
  filterWithFeedback();
}

function findRealOptionValue(selectElement, wantedValue) {
  const wanted = normalize(wantedValue);

  const matchingOption = [...selectElement.options]
    .find(option => normalize(option.value) === wanted);

  return matchingOption ? matchingOption.value : '';
}

function syncQuickChips() {
  elements.quickChips.forEach(chip => {
    const filterType = chip.dataset.filterType;
    const filterValue = chip.dataset.filterValue;

    let isActive = false;

    if (filterType === 'category') {
      isActive =
        normalize(elements.category.value) === normalize(filterValue);
    }

    if (filterType === 'stat') {
      isActive = selectedQuickStat === filterValue;
    }

    if (filterType === 'item-name') {
      isActive =
        normalize(elements.itemName.value) === normalize(filterValue);
    }

    chip.classList.toggle('active', isActive);
  });
}

function syncSelectIcons() {
  [
    elements.basicStat,
    elements.upgrade,
    elements.category,
    elements.job,
    elements.machine
  ].forEach(select => {
    const wrapper = select.closest('.select-wrapper');

    if (!wrapper) return;

    wrapper.classList.toggle(
      'has-value',
      String(select.value ?? '').trim() !== ''
    );
  });
}

async function filterWithFeedback() {
  const requestId = ++searchRequestId;
  const startedAt = performance.now();

  elements.status.textContent = 'Đang tìm...';
  setSearchProgress(true);

  // Nhường một khung hình để trạng thái và thanh chạy hiện ra rõ ràng.
  await nextFrame();

  const groupedRows = getFilteredRows();
  const elapsed = performance.now() - startedAt;
  const remaining = Math.max(0, MIN_SEARCH_FEEDBACK_MS - elapsed);

  if (remaining > 0) {
    await wait(remaining);
  }

  // Bỏ kết quả cũ nếu người dùng đã nhập/chọn thêm trong lúc chờ.
  if (requestId !== searchRequestId) return;

  elements.tableScroll.scrollTop = 0;
  renderRows(groupedRows, {
    showCheck: true,
    highlightFirstRow: true
  });
  setSearchProgress(false);
}

function getFilteredRows() {
  const filters = {
    itemName: normalize(elements.itemName.value),
    basicStat: normalize(elements.basicStat.value),
    upgrade: normalize(elements.upgrade.value),
    category: normalize(elements.category.value),
    job: normalize(elements.job.value),
    machine: normalize(elements.machine.value)
  };

  const filteredRows = allRows.filter(row =>
    contains(row[0], filters.itemName) &&
    exactMatch(row[1], filters.basicStat) &&
    quickStatMatch(row[1], selectedQuickStat) &&
    exactMatch(row[2], filters.upgrade) &&
    exactMatch(row[4], filters.category) &&
    jobMatch(row[5], filters.job) &&
    machineMatch(row[6], filters.machine)
  );

  return groupDuplicateItems(filteredRows);
}

function setSearchProgress(isActive) {
  if (!elements.searchProgress) return;

  if (isActive) {
    elements.searchProgress.classList.remove('active');
    void elements.searchProgress.offsetWidth;
    elements.searchProgress.classList.add('active');
    return;
  }

  elements.searchProgress.classList.remove('active');
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function filterAndRender() {
  renderRows(getFilteredRows());
}

function quickStatMatch(sourceValue, quickStat) {
  if (!quickStat) return true;

  const value = normalize(sourceValue)
    .replace(/\s+/g, '');

  if (quickStat === '+ATT') {
    const hasMagicAttack =
      value.includes('m.att') ||
      value.includes('matt') ||
      value.includes('magicattack');

    const hasAttack =
      value.includes('+att') ||
      value.includes('att+');

    return hasAttack && !hasMagicAttack;
  }

  if (quickStat === '+M.ATT') {
    return (
      value.includes('+m.att') ||
      value.includes('m.att+') ||
      value.includes('+matt') ||
      value.includes('matt+') ||
      value.includes('magicattack')
    );
  }

  return true;
}

function groupDuplicateItems(rows) {
  const groups = new Map();

  rows.forEach(row => {
    const key = row
      .slice(0, 6)
      .map(normalize)
      .join('|||');

    if (!groups.has(key)) {
      groups.set(key, {
        values: row.slice(0, 6),
        machines: [],
        machineKeys: new Set()
      });
    }

    const group = groups.get(key);

    splitMachines(row[6]).forEach(machine => {
      const machineKey = normalize(machine);

      if (!group.machineKeys.has(machineKey)) {
        group.machines.push(machine);
        group.machineKeys.add(machineKey);
      }
    });
  });

  return [...groups.values()].map(group => [
    ...group.values,
    group.machines.join(', ')
  ]);
}

function renderRows(
  rows,
  { showCheck = false, highlightFirstRow = false } = {}
) {
  elements.resultBody.innerHTML = '';

  const statusPrefix = showCheck ? '✓ ' : '';
  elements.status.textContent =
    `${statusPrefix}${formatNumber(rows.length)} kết quả`;

  if (rows.length === 0) {
    showMessage('Không có dữ liệu phù hợp');
    updateTableHeightMode();
    return;
  }

  const fragment = document.createDocumentFragment();

  rows.forEach((rowData, index) => {
    const row = document.createElement('tr');

    if (highlightFirstRow && index === 0) {
      row.classList.add('result-row-updated');
    }

    appendCell(row, index + 1, 'column-number');

    const columnClasses = [
      'column-name',
      'column-stats',
      'column-upgrade',
      'column-requirement',
      'column-category',
      'column-job'
    ];

    rowData.forEach((value, columnIndex) => {
      if (columnIndex === 6) {
        appendMachineCell(row, value);
        return;
      }

      appendCell(
        row,
        value,
        columnClasses[columnIndex] || ''
      );
    });

    fragment.appendChild(row);
  });

  elements.resultBody.appendChild(fragment);
  updateTableHeightMode();
}

function appendCell(row, value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = String(value ?? '');

  if (className) {
    cell.className = className;
  }

  row.appendChild(cell);
}

function appendMachineCell(row, value) {
  const cell = document.createElement('td');
  cell.className = 'column-machine';

  splitMachines(value).forEach(machine => {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'machine-badge';
    badge.dataset.machine = machine;

    if (
      normalize(elements.machine.value) ===
      normalize(machine)
    ) {
      badge.classList.add('active');
    }

    const dot = document.createElement('span');
    dot.className = 'machine-dot';
    dot.style.setProperty(
      '--machine-color',
      getMachineColor(machine)
    );

    const label = document.createElement('span');
    label.textContent = machine;

    badge.appendChild(dot);
    badge.appendChild(label);

    badge.addEventListener('click', () => {
      toggleMachineFilter(machine);
    });

    cell.appendChild(badge);
  });

  row.appendChild(cell);
}

function toggleMachineFilter(machine) {
  const selectedIsSame =
    normalize(elements.machine.value) === normalize(machine);

  elements.machine.value = selectedIsSame
    ? ''
    : findRealOptionValue(elements.machine, machine);

  syncQuickChips();
  syncSelectIcons();
  filterWithFeedback();
}

function getMachineColor(machine) {
  const key = normalize(machine);

  return MACHINE_COLORS[key] || '#9CA3AF';
}

function resetFilters(renderAfterReset = true) {
  clearTimeout(typingTimer);

  elements.itemName.value = '';
  elements.basicStat.value = '';
  elements.upgrade.value = '';
  elements.category.value = '';
  elements.job.value = '';
  elements.machine.value = '';

  selectedQuickStat = '';

  syncQuickChips();
  syncSelectIcons();

  if (renderAfterReset) {
    filterWithFeedback();
  }
}

function showMessage(message) {
  elements.resultBody.innerHTML = '';

  const row = document.createElement('tr');
  const cell = document.createElement('td');

  cell.colSpan = 8;
  cell.className = 'message';
  cell.textContent = message;

  row.appendChild(cell);
  elements.resultBody.appendChild(row);
  updateTableHeightMode();
}

function updateTableHeightMode() {
  if (!elements.content || !elements.tableScroll) return;

  // Đo ở trạng thái đầy đủ trước, rồi chỉ thu gọn khi toàn bộ nội dung
  // thực sự vừa trong phần chiều cao còn lại của khu vực kết quả.
  elements.content.classList.remove('table-compact');

  requestAnimationFrame(() => {
    const availableHeight = elements.tableScroll.clientHeight;
    const contentHeight = elements.tableScroll.scrollHeight;
    const shouldCompact = contentHeight <= availableHeight + 1;

    elements.content.classList.toggle('table-compact', shouldCompact);
  });
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

function contains(sourceValue, searchValue) {
  if (!searchValue) return true;

  return normalize(sourceValue).includes(searchValue);
}

function exactMatch(sourceValue, selectedValue) {
  if (!selectedValue) return true;

  return normalize(sourceValue) === selectedValue;
}

function jobMatch(sourceValue, selectedValue) {
  if (!selectedValue) return true;

  return splitJobs(sourceValue)
    .map(normalize)
    .includes(selectedValue);
}

function machineMatch(sourceValue, selectedValue) {
  if (!selectedValue) return true;

  return splitMachines(sourceValue)
    .map(normalize)
    .includes(selectedValue);
}

function splitJobs(value) {
  return String(value ?? '')
    .split(/[,;/|]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function splitMachines(value) {
  return String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeRowLength(row, expectedLength) {
  const result = row.slice(0, expectedLength);

  while (result.length < expectedLength) {
    result.push('');
  }

  return result;
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function parseCsv(text) {
  const rows = [];

  let row = [];
  let field = '';
  let insideQuotes = false;

  for (
    let index = 0;
    index < text.length;
    index++
  ) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (insideQuotes) {
      if (
        character === '"' &&
        nextCharacter === '"'
      ) {
        field += '"';
        index++;
      } else if (character === '"') {
        insideQuotes = false;
      } else {
        field += character;
      }
    } else {
      if (character === '"') {
        insideQuotes = true;
      } else if (character === ',') {
        row.push(field);
        field = '';
      } else if (character === '\n') {
        row.push(field);
        rows.push(row);

        row = [];
        field = '';
      } else if (character !== '\r') {
        field += character;
      }
    }
  }

  row.push(field);

  if (row.some(value => value !== '')) {
    rows.push(row);
  }

  return rows;
}
