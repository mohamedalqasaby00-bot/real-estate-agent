const SUPABASE_URL = 'https://vhfgpmpmkctzpwxtbogi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZmdwbXBta2N0enB3eHRib2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTAzMjYsImV4cCI6MjA5OTg4NjMyNn0.eTJ-lKs04SdiC-uPdmCApJfBEGElIx9tsT61gUgLdyQ';
const REST = `${SUPABASE_URL}/rest/v1`;
const STORAGE = `${SUPABASE_URL}/storage/v1`;
const HEADERS = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

let currentPage = 'dashboard';
let uploadedFiles = [];

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

async function sbQuery(table, opts = {}) {
  let url = `${REST}/${table}?select=${opts.select || '*'}`;
  if (opts.order) url += `&order=${opts.order}`;
  if (opts.limit) url += `&limit=${opts.limit}`;
  if (opts.filter) url += `&${opts.filter}`;
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbInsert(table, data) {
  const r = await fetch(`${REST}/${table}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbUpdate(table, id, data) {
  const r = await fetch(`${REST}/${table}?id=eq.${id}`, { method: 'PATCH', headers: HEADERS, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbDelete(table, id) {
  const r = await fetch(`${REST}/${table}?id=eq.${id}`, { method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(await r.text());
}

async function sbUpload(fileName, file) {
  const r = await fetch(`${STORAGE}/object/media-uploads/${fileName}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type },
    body: file
  });
  if (!r.ok) throw new Error(await r.text());
  return `${STORAGE}/object/public/media-uploads/${fileName}`;
}

function showPage(name) {
  currentPage = name;
  $$('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.page === name));
  loadPage(name);
}

function loadPage(name) {
  const el = $('#page-content');
  switch (name) {
    case 'compose': renderCompose(el); break;
    case 'dashboard': renderDashboard(el); break;
    case 'groups': renderGroups(el); break;
    case 'tasks': renderTasks(el); break;
    case 'media': renderMedia(el); break;
    case 'logs': renderLogs(el); break;
    case 'settings': renderSettings(el); break;
  }
}

// Compose (Post)
async function renderCompose(el) {
  uploadedFiles = [];
  const groups = await sbQuery('groups', { order: 'name' });
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

  el.innerHTML = `
    <h1>نشر منشور جديد</h1>
    <div class="card compose-box">
      <textarea id="compose-text" placeholder="اكتب منشورك هنا..." rows="5"></textarea>
      <div id="compose-preview" class="compose-preview"></div>
      <div class="compose-actions">
        <label class="btn btn-primary" style="cursor:pointer;">
          📷 صورة / فيديو
          <input type="file" id="compose-files" multiple accept="image/*,video/*" style="display:none;" onchange="handleFileUpload(event)">
        </label>
        <span id="compose-file-count" style="color:#888;font-size:13px;"></span>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <h2 style="margin-bottom:12px;">اختر المجموعات</h2>
      <div style="margin-bottom:12px;">
        <button class="btn btn-primary btn-sm" onclick="selectAllGroups()">تحديد الكل</button>
        <button class="btn btn-danger btn-sm" onclick="deselectAllGroups()">إلغاء التحديد</button>
        <span id="compose-selected-count" style="color:#7c5cfc;margin-right:12px;font-size:13px;"></span>
      </div>
      ${catOrder.map(cat => `
        <div class="compose-category">
          <label style="cursor:pointer;font-weight:600;">
            <input type="checkbox" onchange="toggleCategory('${cat}', this.checked)" style="margin-left:6px;">
            ${cat} (${categories[cat].length})
          </label>
          <div class="compose-group-list">
            ${categories[cat].map(g => `
              <label class="compose-group-item">
                <input type="checkbox" class="group-checkbox" value="${g.id}" onchange="updateSelectedCount()">
                ${g.name}
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    <div class="card" style="margin-top:16px;">
      <button id="compose-submit" class="btn btn-primary" style="font-size:16px;padding:12px 32px;width:100%;" onclick="submitPost()">
        ابدأ النشر 🚀
      </button>
      <p style="color:#888;font-size:12px;text-align:center;margin-top:8px;">سيتم النشر في المجموعات المحددة بفاصل عشوائي 3-5 دقائق</p>
    </div>
    <div id="compose-status" class="card" style="margin-top:16px;display:none;">
      <h2>حالة النشر</h2>
      <div id="compose-status-content"></div>
    </div>
  `;
}

async function handleFileUpload(event) {
  const files = Array.from(event.target.files);
  const preview = $('#compose-preview');
  const countEl = $('#compose-file-count');

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const isVideo = file.type.startsWith('video/');
      const thumb = isVideo
        ? `<div class="compose-thumb compose-thumb-video">🎬</div>`
        : `<img src="${e.target.result}" class="compose-thumb">`;
      const idx = uploadedFiles.length;
      uploadedFiles.push({ file, name: file.name });
      preview.innerHTML += `<div class="compose-thumb-wrap" id="thumb-${idx}">${thumb}<span class="compose-thumb-name">${file.name}</span><button class="compose-thumb-remove" onclick="removeFile(${idx})">&times;</button></div>`;
    };
    reader.readAsDataURL(file);
  }
  countEl.textContent = files.length ? `${uploadedFiles.length} ملف(ات) مرفوع(ة)` : '';
  event.target.value = '';
}

function removeFile(idx) {
  uploadedFiles[idx] = null;
  const el = $(`#thumb-${idx}`);
  if (el) el.remove();
  const count = uploadedFiles.filter(f => f !== null).length;
  $('#compose-file-count').textContent = count ? `${count} ملف(ات) مرفوع(ة)` : '';
}

function selectAllGroups() {
  $$('.group-checkbox').forEach(cb => cb.checked = true);
  $$('.compose-category input[type="checkbox"]').forEach(cb => cb.checked = true);
  updateSelectedCount();
}

function deselectAllGroups() {
  $$('.group-checkbox').forEach(cb => cb.checked = false);
  $$('.compose-category > label input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateSelectedCount();
}

function toggleCategory(cat, checked) {
  $$('.group-checkbox').forEach(cb => {
    const label = cb.closest('.compose-group-item');
    if (label) cb.checked = checked;
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = $$('.group-checkbox:checked').length;
  const el = $('#compose-selected-count');
  if (el) el.textContent = count ? `${count} مجموعة محددة` : '';
}

async function submitPost() {
  const text = $('#compose-text').value.trim();
  if (!text) return alert('اكتب نص المنشور أولاً');

  const selectedGroups = Array.from($$('.group-checkbox:checked')).map(cb => cb.value);
  if (!selectedGroups.length) return alert('اختر مجموعة واحدة على الأقل');

  const btn = $('#compose-submit');
  btn.disabled = true;
  btn.textContent = 'جاري الرفع...';

  try {
    const mediaPaths = [];
    const filesToUpload = uploadedFiles.filter(f => f !== null);

    for (let i = 0; i < filesToUpload.length; i++) {
      btn.textContent = `جاري رفع الملف ${i + 1} / ${filesToUpload.length}...`;
      const file = filesToUpload[i].file;
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${i}.${ext}`;

      const publicUrl = await sbUpload(fileName, file);
      mediaPaths.push(publicUrl);
    }

    btn.textContent = 'جاري إنشاء المهمة...';

    const { error } = await sbInsert('tasks', {
      type: 'post',
      status: 'pending',
      group_ids: selectedGroups,
      text_content: text,
      media_paths: mediaPaths,
      max_retries: 3
    });

    if (error) throw new Error(error.message || error);

    btn.textContent = 'تم النشر بنجاح! ✅';
    btn.style.background = '#27ae60';

    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'ابدأ النشر 🚀';
      btn.style.background = '';
      uploadedFiles = [];
      $('#compose-preview').innerHTML = '';
      $('#compose-text').value = '';
      deselectAllGroups();
      $('#compose-file-count').textContent = '';
    }, 3000);

  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'ابدأ النشر 🚀';
    alert('خطأ: ' + e.message);
  }
}

async function renderDashboard(el) {
  el.innerHTML = '<h1>لوحة التحكم</h1><p style="color:#888;">جاري التحميل...</p>';
  try {
    const [groups, tasks, media, history] = await Promise.all([
      sbQuery('groups'),
      sbQuery('tasks'),
      sbQuery('media'),
      sbQuery('history', { select: '*', order: 'created_at.desc', limit: 5 }),
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
            ${h.group_name || ''} - ${new Date(h.created_at).toLocaleString('ar-EG')}
          </div>
        `).join('') : '<p style="color:#888;">لا يوجد نشاط بعد</p>'}
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<h1>لوحة التحكم</h1><div class="card"><p style="color:#ff6b6b;">خطأ: ${e.message}</p></div>`;
  }
}

async function renderGroups(el) {
  el.innerHTML = '<h1>المجموعات</h1><p style="color:#888;">جاري التحميل...</p>';
  try {
    const groups = await sbQuery('groups', { order: 'name' });

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
      <div class="groups-grid">
        ${list.map((g, i) => `
          <div class="group-card">
            <div class="group-card-name">${g.name}</div>
            <a href="${g.url}" target="_blank" class="group-card-url">${g.url.split('/').pop()}</a>
            <div class="group-card-actions">
              <button class="btn btn-primary btn-sm" onclick='editGroup(${JSON.stringify(g).replace(/'/g, "&#39;")})'>تعديل</button>
              <button class="btn btn-danger btn-sm" onclick="deleteGroup('${g.id}')">حذف</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    el.innerHTML = `
      <h1>المجموعات (${groups.length})</h1>
      <button class="btn btn-primary" onclick="showAddGroupForm()">+ إضافة مجموعة</button>
      <div id="add-group-form" style="display:none;" class="card">
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
  } catch (e) {
    el.innerHTML = `<h1>المجموعات</h1><div class="card"><p style="color:#ff6b6b;">خطأ: ${e.message}</p></div>`;
  }
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
  await sbInsert('groups', { name, url, category: category || null });
  renderGroups($('#page-content'));
}

async function deleteGroup(id) {
  if (!confirm('حذف المجموعة؟')) return;
  await sbDelete('groups', id);
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
  await sbUpdate('groups', id, { name, url, category: category || null });
  $('#edit-group-form').style.display = 'none';
  renderGroups($('#page-content'));
}

async function renderTasks(el) {
  el.innerHTML = '<h1>المهام</h1><p style="color:#888;">جاري التحميل...</p>';
  try {
    const tasks = await sbQuery('tasks', { order: 'created_at.desc' });

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
  } catch (e) {
    el.innerHTML = `<h1>المهام</h1><div class="card"><p style="color:#ff6b6b;">خطأ: ${e.message}</p></div>`;
  }
}

async function deleteTask(id) {
  if (!confirm('إلغاء المهمة؟')) return;
  await sbDelete('tasks', id);
  renderTasks($('#page-content'));
}

async function renderMedia(el) {
  el.innerHTML = '<h1>الميديا</h1><p style="color:#888;">جاري التحميل...</p>';
  try {
    const media = await sbQuery('media', { order: 'created_at.desc' });

    el.innerHTML = `
      <h1>الميديا</h1>
      <div class="card">
        <table>
          <thead><tr><th>الملف</th><th>النوع</th><th>الحجم</th></tr></thead>
          <tbody>
            ${media.map(m => `
              <tr>
                <td>${m.original_name}</td>
                <td>${m.mime_type}</td>
                <td>${(m.file_size / 1024).toFixed(1)} KB</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<h1>الميديا</h1><div class="card"><p style="color:#ff6b6b;">خطأ: ${e.message}</p></div>`;
  }
}

async function renderLogs(el) {
  el.innerHTML = '<h1>سجل النشاط</h1><p style="color:#888;">جاري التحميل...</p>';
  try {
    const logs = await sbQuery('history', { select: '*', order: 'created_at.desc', limit: 200 });

    el.innerHTML = `
      <h1>سجل النشاط</h1>
      <div class="card">
        <table>
          <thead><tr><th>التاريخ</th><th>المجموعة</th><th>الحالة</th><th>عدد الملفات</th></tr></thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td>${new Date(l.created_at).toLocaleString('ar-EG')}</td>
                <td>${l.group_name || '-'}</td>
                <td><span class="badge badge-${l.status}">${l.status}</span></td>
                <td>${l.media_count || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<h1>سجل النشاط</h1><div class="card"><p style="color:#ff6b6b;">خطأ: ${e.message}</p></div>`;
  }
}

async function renderSettings(el) {
  el.innerHTML = '<h1>الإعدادات</h1><p style="color:#888;">جاري التحميل...</p>';
  try {
    const settings = await sbQuery('settings');

    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    el.innerHTML = `
      <h1>الإعدادات</h1>
      <div class="card">
        <h2>عامة</h2>
        <label>Supabase URL</label>
        <input value="${SUPABASE_URL}" disabled style="color:#888;">
        <label>حالة الاتصال</label>
        <input value="متصل" disabled style="color:#7c5cfc;">
      </div>
      <div class="card">
        <h2>بيانات محفوظة</h2>
        ${Object.entries(settingsMap).length ? Object.entries(settingsMap).map(([k, v]) => `
          <label>${k}</label>
          <input value="${v}" disabled style="color:#888;">
        `).join('') : '<p style="color:#888;">لا توجد إعدادات محفوظة</p>'}
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<h1>الإعدادات</h1><div class="card"><p style="color:#ff6b6b;">خطأ: ${e.message}</p></div>`;
  }
}

$$('.nav-links a').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); });
});

document.addEventListener('DOMContentLoaded', () => showPage('dashboard'));
