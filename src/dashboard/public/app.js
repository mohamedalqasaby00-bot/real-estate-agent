const API = '/api';
let currentPage = 'dashboard';

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showPage(name) {
  currentPage = name;
  $$('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.page === name));
  loadPage(name);
}

function loadPage(name) {
  const el = $('#page-content');
  switch (name) {
    case 'dashboard': renderDashboard(el); break;
    case 'groups': renderGroups(el); break;
    case 'tasks': renderTasks(el); break;
    case 'media': renderMedia(el); break;
    case 'logs': renderLogs(el); break;
    case 'settings': renderSettings(el); break;
  }
}

// Dashboard
async function renderDashboard(el) {
  const [groups, tasks, media, history] = await Promise.all([
    fetch(`${API}/groups`).then(r => r.json()),
    fetch(`${API}/tasks`).then(r => r.json()),
    fetch(`${API}/media`).then(r => r.json()),
    fetch(`${API}/logs?limit=5`).then(r => r.json()),
  ]);

  const pending = tasks.filter(t => t.status === 'pending').length;
  const done = tasks.filter(t => t.status === 'done').length;
  const failed = tasks.filter(t => t.status === 'failed').length;

  el.innerHTML = `
    <h1>لوحة التحكم</h1>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${groups.length}</div><div class="stat-label">المجموعات</div></div>
      <div class="stat-card"><div class="stat-number">${pending}</div><div class="stat-label">مهام pending</div></div>
      <div class="stat-card"><div class="stat-number">${done}</div><div class="stat-label">مهام done</div></div>
      <div class="stat-card"><div class="stat-number">${failed}</div><div class="stat-label">مهام failed</div></div>
      <div class="stat-card"><div class="stat-number">${media.length}</div><div class="stat-label">ملفات الميديا</div></div>
    </div>
    <h2 style="margin-top:24px;">آخر النشاطات</h2>
    <div class="card">
      ${history.length ? history.map(h => `
        <div style="padding:8px 0;border-bottom:1px solid #2a2a4a;">
          <span class="badge badge-${h.status}">${h.status}</span>
          ${h.group_name} - ${new Date(h.created_at).toLocaleString('ar-EG')}
        </div>
      `).join('') : '<p style="color:#888;">لا يوجد نشاط بعد</p>'}
    </div>
  `;
}

// Groups
async function renderGroups(el) {
  const groups = await fetch(`${API}/groups`).then(r => r.json());

  const categories = {};
  groups.forEach(g => {
    const cat = g.category || 'غير مصنف';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(g);
  });

  const catOrder = Object.keys(categories).sort((a, b) => {
    if (a === 'غير مصنف') return 1;
    if (b === 'غير مصنف') return -1;
    return a.localeCompare(b, 'ar');
  });

  const renderTable = (list) => `
    <table>
      <thead><tr><th>#</th><th>الاسم</th><th>الرابط</th><th>التصنيف</th><th></th></tr></thead>
      <tbody>
        ${list.map((g, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${g.name}</td>
            <td><a href="${g.url}" target="_blank" style="color:#7c5cfc;">${g.url.slice(0, 40)}...</a></td>
            <td>${g.category || '-'}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick='editGroup(${JSON.stringify(g).replace(/'/g, "&#39;")})'>تعديل</button>
              <button class="btn btn-danger btn-sm" onclick="deleteGroup('${g.id}')">حذف</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  el.innerHTML = `
    <h1>المجموعات (${groups.length})</h1>
    <button class="btn btn-primary" onclick="showAddGroupForm()">+ إضافة مجموعة</button>
    <div id="add-group-form" style="display:none;" class="card" style="margin-top:16px;">
      <div class="form-row">
        <div><label>اسم المجموعة</label><input id="g-name" placeholder="اسم المجموعة"></div>
        <div><label>رابط المجموعة</label><input id="g-url" placeholder="https://www.facebook.com/groups/..."></div>
        <div><label>تصنيف (اختياري)</label><input id="g-cat" placeholder="مثلاً: منصورة جديدة"></div>
      </div>
      <button class="btn btn-primary" onclick="addGroup()">حفظ</button>
    </div>
    <div id="edit-group-form" style="display:none;" class="card">
      <input type="hidden" id="eg-id">
      <div class="form-row">
        <div><label>اسم المجموعة</label><input id="eg-name"></div>
        <div><label>رابط المجموعة</label><input id="eg-url"></div>
        <div><label>تصنيف</label><input id="eg-cat"></div>
      </div>
      <button class="btn btn-primary" onclick="saveEditGroup()">حفظ التعديل</button>
      <button class="btn btn-danger" onclick="$('#edit-group-form').style.display='none'" style="margin-right:8px;">إلغاء</button>
    </div>
    ${catOrder.map(cat => `
      <div class="card" style="margin-top:16px;">
        <h2 style="margin-bottom:8px;">${cat} <span style="color:#7c5cfc;">(${categories[cat].length})</span></h2>
        ${renderTable(categories[cat])}
      </div>
    `).join('')}
  `;
}

function showAddGroupForm() {
  const form = $('#add-group-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function addGroup() {
  const name = $('#g-name').value;
  const url = $('#g-url').value;
  const category = $('#g-cat').value;
  if (!name || !url) return alert('الاسم والرابط مطلوبان');
  await fetch(`${API}/groups`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name, url, category}) });
  renderGroups($('#page-content'));
}

async function deleteGroup(id) {
  if (!confirm('حذف المجموعة؟')) return;
  await fetch(`${API}/groups/${id}`, { method: 'DELETE' });
  renderGroups($('#page-content'));
}

function editGroup(g) {
  const form = $('#edit-group-form');
  form.style.display = 'block';
  $('#eg-id').value = g.id;
  $('#eg-name').value = g.name;
  $('#eg-url').value = g.url;
  $('#eg-cat').value = g.category || '';
  form.scrollIntoView({ behavior: 'smooth' });
}

async function saveEditGroup() {
  const id = $('#eg-id').value;
  const name = $('#eg-name').value;
  const url = $('#eg-url').value;
  const category = $('#eg-cat').value;
  if (!name || !url) return alert('الاسم والرابط مطلوبان');
  await fetch(`${API}/groups/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name, url, category}) });
  $('#edit-group-form').style.display = 'none';
  renderGroups($('#page-content'));
}

// Tasks
async function renderTasks(el) {
  const tasks = await fetch(`${API}/tasks`).then(r => r.json());

  el.innerHTML = `
    <h1>المهام</h1>
    <div class="card">
      <table>
        <thead><tr><th>المعرف</th><th>النوع</th><th>الحالة</th><th>المجموعات</th><th>الموعد</th><th>عدد المحاولات</th><th></th></tr></thead>
        <tbody>
          ${tasks.map(t => `
            <tr>
              <td style="font-family:monospace;font-size:12px;">${t.id.slice(0, 8)}...</td>
              <td>${t.type}</td>
              <td><span class="badge badge-${t.status}">${t.status}</span></td>
              <td>${JSON.parse(t.group_ids).length}</td>
              <td>${t.scheduled_at ? new Date(t.scheduled_at).toLocaleString('ar-EG') : 'فوراً'}</td>
              <td>${t.retries}/${t.max_retries}</td>
              <td>
                ${t.status === 'pending' ? `<button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')">إلغاء</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function deleteTask(id) {
  if (!confirm('إلغاء المهمة؟')) return;
  await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
  renderTasks($('#page-content'));
}

// Media
async function renderMedia(el) {
  const media = await fetch(`${API}/media`).then(r => r.json());

  el.innerHTML = `
    <h1>الميديا</h1>
    <div class="card">
      <h2>استيراد ملف</h2>
      <div class="form-row">
        <div><label>مسار الملف</label><input id="m-path" placeholder="C:\\Users\\...\\image.jpg"></div>
      </div>
      <button class="btn btn-primary" onclick="importMedia()">استيراد</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>الملف</th><th>النوع</th><th>الحجم</th><th></th></tr></thead>
        <tbody>
          ${media.map(m => `
            <tr>
              <td>${m.original_name}</td>
              <td>${m.mime_type}</td>
              <td>${(m.file_size / 1024).toFixed(1)} KB</td>
              <td><button class="btn btn-danger btn-sm" onclick="deleteMediaItem('${m.id}')">حذف</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function importMedia() {
  const filePath = $('#m-path').value;
  if (!filePath) return alert('ادخل مسار الملف');
  await fetch(`${API}/media/import`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({filePath}) });
  renderMedia($('#page-content'));
}

async function deleteMediaItem(id) {
  if (!confirm('حذف الملف؟')) return;
  await fetch(`${API}/media/${id}`, { method: 'DELETE' });
  renderMedia($('#page-content'));
}

// Logs
async function renderLogs(el) {
  const logs = await fetch(`${API}/logs?limit=200`).then(r => r.json());

  el.innerHTML = `
    <h1>سجل النشاط</h1>
    <div class="card">
      <table>
        <thead><tr><th>التاريخ</th><th>المجموعة</th><th>الحالة</th><th>عدد الملفات</th></tr></thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td>${new Date(l.created_at).toLocaleString('ar-EG')}</td>
              <td>${l.group_name}</td>
              <td><span class="badge badge-${l.status}">${l.status}</span></td>
              <td>${l.media_count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Settings
async function renderSettings(el) {
  const settings = await fetch(`${API}/settings`).then(r => r.json());

  el.innerHTML = `
    <h1>الإعدادات</h1>
    <div class="card">
      <h2>عام</h2>
      <label>Chrome Profile</label>
      <input value="${settings._chrome_profile || ''}" disabled style="color:#888;">
      <label>Media Directory</label>
      <input value="${settings._media_dir || ''}" disabled style="color:#888;">
      <label>Database</label>
      <input value="${settings._db_path || ''}" disabled style="color:#888;">
    </div>
    <div class="card">
      <h2>تحميل بيانات</h2>
      <button class="btn btn-primary" onclick="location.reload()">تحديث الصفحة</button>
    </div>
  `;
}

// Navigation
$$('.nav-links a').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); });
});

// Init
document.addEventListener('DOMContentLoaded', () => showPage('dashboard'));
