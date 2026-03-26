// ── Shared Utilities ──────────────────────────────────────────────────────

// Update clock
function updateClock() {
  const el = document.getElementById('currentTime');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Shanghai' });
  }
}
setInterval(updateClock, 1000);
updateClock();

// API helpers
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost(url, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// HTML escape
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Status label mapping
function statusLabel(status) {
  const map = { pending: '待审核', approved: '已通过', rejected: '已拒绝', published: '已发布' };
  return map[status] || status;
}

// ── Toasts ────────────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Counter Animation ─────────────────────────────────────────────────────

function animateCount(elementId, target, duration = 800) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Pipeline Modal ─────────────────────────────────────────────────────────

let pipelineRunning = false;

function triggerPipeline() {
  if (pipelineRunning) {
    showToast('流水线正在运行中...', 'info');
    return;
  }
  document.getElementById('pipelineModal').classList.remove('hidden');
}

function closePipelineModal() {
  document.getElementById('pipelineModal').classList.add('hidden');
}

async function confirmPipeline() {
  const useMock = document.querySelector('input[name="pipelineMode"]:checked').value === 'mock';
  closePipelineModal();

  pipelineRunning = true;
  const btn = document.getElementById('runPipelineBtn');
  const btnIcon = document.getElementById('pipelineBtnIcon');
  const btnText = document.getElementById('pipelineBtnText');

  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
  }
  if (btnIcon) btnIcon.innerHTML = '<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';
  if (btnText) btnText.textContent = '运行中...';

  showToast(`流水线启动 (${useMock ? '模拟' : '真实'}模式)...`, 'info', 5000);

  try {
    const result = await apiPost('/api/run-pipeline', { use_mock: useMock });

    if (result.success) {
      const steps = result.steps || {};
      const posts = steps.scrape?.posts || 0;
      const candidates = steps.classify?.candidates || 0;
      const content = steps.generate?.content_items || 0;
      showToast(`✅ 完成！抓取${posts}帖子，${candidates}候选，${content}内容`, 'success', 6000);

      // Reload page data
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast(`流水线失败: ${result.error || '未知错误'}`, 'error', 5000);
    }
  } catch(e) {
    showToast(`请求失败: ${e.message}`, 'error');
  } finally {
    pipelineRunning = false;
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
    if (btnIcon) btnIcon.textContent = '⚡';
    if (btnText) btnText.textContent = '执行流水线';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePipelineModal();
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.classList.add('hidden');
    const detailModal = document.getElementById('detailModal');
    if (detailModal) detailModal.classList.add('hidden');
    const newProjectModal = document.getElementById('newProjectModal');
    if (newProjectModal) newProjectModal.classList.add('hidden');
    const newPersonaModal = document.getElementById('newPersonaModal');
    if (newPersonaModal) newPersonaModal.classList.add('hidden');
    const scrapeSettingsModal = document.getElementById('scrapeSettingsModal');
    if (scrapeSettingsModal) scrapeSettingsModal.classList.add('hidden');
  }
});

// ── Scrape Settings Modal ──────────────────────────────────────────────────────

let currentScrapeProjectId = null;

function openScrapeSettingsModal() {
  currentScrapeProjectId = currentProjectId || 'default-project-1';
  document.getElementById('scrapeSettingsModal').classList.remove('hidden');
  document.getElementById('scrapeSettingsLoading').classList.remove('hidden');
  document.getElementById('scrapeSettingsContent').classList.add('hidden');
  
  // Set webhook URL
  const appUrl = document.location.origin;
  document.getElementById('webhookUrl').textContent = `${appUrl}/api/apify-webhook`;
  
  // Load current settings
  loadScrapeSettings(currentScrapeProjectId);
}

function closeScrapeSettingsModal() {
  document.getElementById('scrapeSettingsModal').classList.add('hidden');
}

async function loadScrapeSettings(projectId) {
  try {
    const res = await fetch(`/api/projects/${projectId}/scrape-settings`);
    if (!res.ok) throw new Error('Failed to load settings');
    const data = await res.json();
    
    document.getElementById('autoScrapeToggle').checked = data.auto_scrape_enabled;
    document.getElementById('scrapeScheduleTime').value = data.scrape_schedule_time || '09:00';
    document.getElementById('scrapeTimezone').value = data.scrape_schedule_timezone || 'Asia/Shanghai';
    
    document.getElementById('scrapeSettingsLoading').classList.add('hidden');
    document.getElementById('scrapeSettingsContent').classList.remove('hidden');
  } catch(e) {
    console.error(e);
    showToast('加载设置失败: ' + e.message, 'error');
    closeScrapeSettingsModal();
  }
}

async function saveScrapeSettings() {
  const autoScrapeEnabled = document.getElementById('autoScrapeToggle').checked;
  const scheduleTime = document.getElementById('scrapeScheduleTime').value;
  const scheduleTimezone = document.getElementById('scrapeTimezone').value;
  
  try {
    const res = await apiPost(`/api/projects/${currentScrapeProjectId}/scrape-settings`, {
      auto_scrape_enabled: autoScrapeEnabled,
      scrape_schedule_time: scheduleTime,
      scrape_schedule_timezone: scheduleTimezone
    });
    
    if (res.ok) {
      showToast('设置已保存，调度器已重启', 'success');
      closeScrapeSettingsModal();
    } else {
      throw new Error(res.error || '保存失败');
    }
  } catch(e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

// ── Project & Persona Management ───────────────────────────────────────────

function changeProject(pid) {
  const url = new URL(window.location);
  url.searchParams.set('project_id', pid);
  window.location.href = url.toString();
}

function openNewProjectModal() {
  document.getElementById('newProjectModal').classList.remove('hidden');
}

function closeNewProjectModal() {
  document.getElementById('newProjectModal').classList.add('hidden');
}

async function submitNewProject() {
  const btn = event.currentTarget;
  const originalText = btn.textContent;
  btn.textContent = '创建中...';
  btn.disabled = true;

  const data = {
    name: document.getElementById('newProjectName').value,
    background_info: document.getElementById('newProjectBg').value,
    search_query: document.getElementById('newProjectQuery').value,
    subreddits: document.getElementById('newProjectSubreddits').value.split(',').map(s => s.trim()).filter(s => s)
  };

  if (!data.name) {
    showToast('项目名称不能为空', 'error');
    btn.textContent = originalText;
    btn.disabled = false;
    return;
  }

  try {
    const res = await apiPost('/api/projects', data);
    if (res.ok) {
      showToast('项目创建成功！', 'success');
      setTimeout(() => changeProject(res.project_id), 1000);
    }
  } catch (e) {
    showToast('创建失败: ' + e.message, 'error');
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function openNewPersonaModal() {
  document.getElementById('newPersonaModal').classList.remove('hidden');
}

function closeNewPersonaModal() {
  document.getElementById('newPersonaModal').classList.add('hidden');
}

async function submitNewPersona() {
  const btn = event.currentTarget;
  const originalText = btn.textContent;
  btn.textContent = '创建中...';
  btn.disabled = true;

  const data = {
    name: document.getElementById('nPName').value,
    username: document.getElementById('nPUser').value,
    platform: document.getElementById('nPPlatform') ? document.getElementById('nPPlatform').value : 'Reddit',
    avatar_emoji: document.getElementById('nPEmoji').value,
    avatar_color: document.getElementById('nPColor').value,
    description: document.getElementById('nPDesc').value,
    background: document.getElementById('nPBg').value,
    tone: document.getElementById('nPTone').value,
    writing_style: document.getElementById('nPStyle').value,
    focus: [],
    post_types: []
  };

  if (!data.name) {
    showToast('人设名称不能为空', 'error');
    btn.textContent = originalText;
    btn.disabled = false;
    return;
  }

  const pidSelect = document.getElementById('projectSelect');
  let pid = pidSelect ? pidSelect.value : null;
  if (!pid) {
      pid = new URLSearchParams(window.location.search).get('project_id');
  }

  try {
    const res = await apiPost(`/api/projects/${pid}/personas`, data);
    if (res.ok) {
      showToast('人设创建成功！', 'success');
      setTimeout(() => window.location.reload(), 1000);
    }
  } catch (e) {
    showToast('创建失败: ' + e.message, 'error');
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

