(() => {
  const state = {
    token: localStorage.getItem('accessToken') || null,
    email: localStorage.getItem('userEmail') || '',
    status: '',
    page: 1,
    limit: 20,
    total: 0,
    pollTimer: null,
  };

  const $ = (id) => document.getElementById(id);

  const authView = $('authView');
  const dashboardView = $('dashboardView');
  const toast = $('toast');

  function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.hidden = true;
    }, 3500);
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Session expired, please sign in again');
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      const message = (body && (body.message || body.error)) || `Request failed (${res.status})`;
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    return body;
  }

  function setToken(token, email) {
    state.token = token;
    state.email = email;
    localStorage.setItem('accessToken', token);
    localStorage.setItem('userEmail', email);
  }

  function logout() {
    state.token = null;
    state.email = '';
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userEmail');
    stopPolling();
    showAuthView();
  }

  function showAuthView() {
    authView.hidden = false;
    dashboardView.hidden = true;
  }

  function showDashboardView() {
    authView.hidden = true;
    dashboardView.hidden = false;
    $('userEmail').textContent = state.email;
    loadJobs();
    startPolling();
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(loadJobs, 5000);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  // ---- Auth ----
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`${btn.dataset.tab}Form`).classList.add('active');
    });
  });

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const email = form.get('email');
    const password = form.get('password');
    try {
      const { accessToken } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(accessToken, email);
      showDashboardView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const email = form.get('email');
    const password = form.get('password');
    try {
      const { accessToken } = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(accessToken, email);
      showDashboardView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('logoutBtn').addEventListener('click', logout);

  // ---- Jobs ----
  function statusBadge(status) {
    return `<span class="badge ${status}">${status}</span>`;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  async function loadJobs() {
    try {
      const params = new URLSearchParams({ page: state.page, limit: state.limit });
      if (state.status) params.set('status', state.status);
      const { items, total, page, limit } = await api(`/jobs?${params.toString()}`);
      state.total = total;
      state.page = page;
      state.limit = limit;
      renderJobs(items);
      renderPagination();
    } catch (err) {
      if (err.message.includes('Session expired')) return;
      showToast(err.message, 'error');
    }
  }

  function renderJobs(jobs) {
    const body = $('jobsBody');
    if (!jobs.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty">No jobs found</td></tr>';
      return;
    }
    body.innerHTML = jobs
      .map((job) => {
        const id = job._id || job.id;
        return `
        <tr data-id="${id}">
          <td>${escapeHtml(job.name)}</td>
          <td>${statusBadge(job.status)}</td>
          <td>${job.attemptsMade}/${job.maxAttempts}</td>
          <td>${formatDate(job.createdAt)}</td>
          <td class="row-actions">
            <button class="btn ghost" data-view="${id}">View</button>
            ${job.status === 'failed' ? `<button class="btn ghost" data-retry="${id}">Retry</button>` : ''}
            <button class="btn danger" data-delete="${id}">Delete</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    $('pageInfo').textContent = `Page ${state.page} of ${totalPages} · ${state.total} job(s)`;
    $('prevPageBtn').disabled = state.page <= 1;
    $('nextPageBtn').disabled = state.page >= totalPages;
  }

  $('jobsBody').addEventListener('click', async (e) => {
    const viewId = e.target.dataset.view;
    const retryId = e.target.dataset.retry;
    const deleteId = e.target.dataset.delete;
    try {
      if (viewId) return openJobDetail(viewId);
      if (retryId) {
        await api(`/jobs/${retryId}/retry`, { method: 'POST' });
        showToast('Job queued for retry', 'success');
        loadJobs();
      }
      if (deleteId) {
        if (!confirm('Delete this job?')) return;
        await api(`/jobs/${deleteId}`, { method: 'DELETE' });
        showToast('Job deleted', 'success');
        loadJobs();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  async function openJobDetail(id) {
    try {
      const job = await api(`/jobs/${id}`);
      $('jobDetailBody').innerHTML = `
        <dl>
          <dt>Name</dt><dd>${escapeHtml(job.name)}</dd>
          <dt>Status</dt><dd>${statusBadge(job.status)}</dd>
          <dt>Attempts</dt><dd>${job.attemptsMade}/${job.maxAttempts}</dd>
          <dt>Created</dt><dd>${formatDate(job.createdAt)}</dd>
          <dt>Updated</dt><dd>${formatDate(job.updatedAt)}</dd>
          <dt>Payload</dt><dd><pre>${escapeHtml(JSON.stringify(job.payload, null, 2))}</pre></dd>
          ${job.result != null ? `<dt>Result</dt><dd><pre>${escapeHtml(JSON.stringify(job.result, null, 2))}</pre></dd>` : ''}
          ${job.error ? `<dt>Error</dt><dd><pre>${escapeHtml(job.error)}</pre></dd>` : ''}
        </dl>`;
      openModal('jobDetailModal');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  $('statusFilter').addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    loadJobs();
  });

  $('refreshBtn').addEventListener('click', loadJobs);

  $('prevPageBtn').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadJobs();
    }
  });

  $('nextPageBtn').addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    if (state.page < totalPages) {
      state.page += 1;
      loadJobs();
    }
  });

  // ---- New job modal ----
  function openModal(id) {
    $(id).hidden = false;
  }

  function closeModal(id) {
    $(id).hidden = true;
  }

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      closeModal(e.target.closest('.modal-overlay').id);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  $('newJobBtn').addEventListener('click', () => {
    $('newJobForm').reset();
    $('newJobForm').payload.value = '{}';
    openModal('newJobModal');
  });

  $('newJobForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const name = form.get('name');
    const maxAttempts = Number(form.get('maxAttempts')) || undefined;
    let payload;
    try {
      payload = JSON.parse(form.get('payload') || '{}');
    } catch {
      showToast('Payload must be valid JSON', 'error');
      return;
    }
    try {
      await api('/jobs', {
        method: 'POST',
        body: JSON.stringify({ name, payload, maxAttempts }),
      });
      showToast('Job created', 'success');
      closeModal('newJobModal');
      state.page = 1;
      loadJobs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---- Init ----
  if (state.token) {
    showDashboardView();
  } else {
    showAuthView();
  }
})();
