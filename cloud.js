
(()=>{
'use strict';

const $ = id => document.getElementById(id);
const cfg = window.CTT_CLOUD || {};

const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || '') &&
  !!cfg.anonKey;

const DATA_KEY = 'ctt_research_v2_records';
const SYNC_KEY = 'ctt_cloud_synced_ids_v1';

let token = null;
let user = null;
let busy = false;

const status = s => {
  $('cloudStatus').textContent = s;
};

const records = () => {
  try {
    return JSON.parse(localStorage.getItem(DATA_KEY) || '[]');
  } catch {
    return [];
  }
};

const synced = () => {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(SYNC_KEY) || '[]')
    );
  } catch {
    return new Set();
  }
};

const saveSynced = s =>
  localStorage.setItem(SYNC_KEY, JSON.stringify([...s]));

const pending = () =>
  records().filter(r => !synced().has(r.record_id));

const base = (cfg.url || '').replace(/\/$/, '');

async function request(path, opts = {}) {
  const headers = {
    'apikey': cfg.anonKey,
    'Content-Type': 'application/json',
    ...(token ? {'Authorization': 'Bearer ' + token} : {}),
    ...(opts.headers || {})
  };

  let r;

  try {
    r = await fetch(base + path, {...opts, headers});
  } catch {
    throw new Error('網路無法連線，資料保留於本機');
  }

  const raw = await r.text();
  let data;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!r.ok) {
    throw new Error(
      (data && (
        data.msg ||
        data.message ||
        data.error_description ||
        data.error
      )) || 'HTTP ' + r.status
    );
  }

  return data;
}

function updateStatus(extra = '') {
  const p = pending().length;

  status(
    (user ? '已登入：' + user.email : '尚未登入') +
    '｜待上傳 ' + p + ' 筆' +
    (extra ? '｜' + extra : '')
  );
}

async function login() {
  if (!configured) {
    status('請先在 config.js 填入 Supabase URL 與 publishable key。');
    return;
  }

  const email = $('cloudEmail').value.trim();
  const password = $('cloudPassword').value;

  if (!email || !password) {
    status('請輸入研究人員 Email 與密碼');
    return;
  }

  try {
    const d = await request(
      '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        body: JSON.stringify({email, password})
      }
    );

    token = d.access_token;
    user = d.user;

    $('cloudPassword').value = '';
    $('cloudLogout').disabled = false;

    updateStatus('登入成功');
    await sync();

  } catch(e) {
    token = null;
    user = null;
    status('登入失敗：' + e.message);
  }
}

function logout() {
  token = null;
  user = null;
  $('cloudLogout').disabled = true;
  updateStatus('已登出');
}

async function sync() {
  if (busy) return;

  if (!user || !token) {
    updateStatus('請先登入才可同步');
    return;
  }

  const jobs = pending();

  if (!jobs.length) {
    updateStatus('資料已同步');
    return;
  }

  busy = true;
  $('cloudSync').disabled = true;

  try {
    let success = 0;

    for (const r of jobs) {
      const payload = {
        record_id: String(r.record_id),
        owner_id: user.id,
        participant_id: r.participant_id,
        session_id: r.session_id,
        part: r.part,
        mode: r.mode,
        status: r.status,
        started_at: r.started_at,
        ended_at: r.ended_at,
        duration_sec: r.duration_sec,
        error_count: r.error_count,
        raw: r
      };

      await request(
        '/rest/v1/nvcst_records?on_conflict=record_id',
        {
          method: 'POST',
          headers: {
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(payload)
        }
      );

      const s = synced();
      s.add(r.record_id);
      saveSynced(s);

      success++;
    }

    updateStatus('成功同步 ' + success + ' 筆');

  } catch(e) {
    updateStatus(
      '同步未完成：' + e.message + '；資料仍保存在本機'
    );
  } finally {
    busy = false;
    $('cloudSync').disabled = false;
  }
}

function csv(rows, cols) {
  const quote = v =>
    '"' +
    String(
      v == null ? '' :
      typeof v === 'object' ? JSON.stringify(v) : v
    ).replaceAll('"', '""') +
    '"';

  return '\ufeff' +
    [
      cols.join(','),
      ...rows.map(r => cols.map(k => quote(r[k])).join(','))
    ].join('\r\n');
}

function download(name, contents, type) {
  const a = document.createElement('a');

  const url = URL.createObjectURL(
    new Blob([contents], {type})
  );

  a.href = url;
  a.download = name;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportCloud() {
  if (!token) {
    updateStatus('請先登入');
    return;
  }

  try {
    let all = [];
    let offset = 0;

    while (true) {
      const batch = await request(
        '/rest/v1/nvcst_records' +
        '?select=record_id,participant_id,session_id,' +
        'part,mode,status,started_at,ended_at,' +
        'duration_sec,error_count,raw' +
        '&order=started_at.asc' +
        '&limit=500&offset=' + offset
      );

      all.push(...batch);

      if (batch.length < 500) break;

      offset += 500;

      if (offset > 100000) {
        throw new Error(
          '超過安全批次上限，請使用資料庫後台匯出'
        );
      }
    }

    const rs = all.map(x => x.raw);

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

    const cols = [
      'schema_version',
      'record_id',
      'participant_id',
      'session_id',
      'part',
      'task_name',
      'condition',
      'mode',
      'status',
      'started_at',
      'ended_at',
      'duration_sec',
      'completed_targets',
      'total_targets',
      'error_count',
      'summary'
    ];

    download(
      'telenpa_cloud_summary_' + stamp + '.csv',
      csv(rs, cols),
      'text/csv;charset=utf-8'
    );

    const events = rs.flatMap(r =>
      (r.events || []).map(e => ({
        record_id: r.record_id,
        participant_id: r.participant_id,
        session_id: r.session_id,
        part: r.part,
        mode: r.mode,
        ...e
      }))
    );

    const eventCols = [
      'record_id',
      'participant_id',
      'session_id',
      'part',
      'mode',
      'trial_index',
      'condition',
      'rule',
      'transition',
      'set_size',
      'target',
      'options',
      'correct_index',
      'response_index',
      'response',
      'correct',
      'rt_ms',
      'pointer_type',
      'timestamp_iso',
      'event_index',
      'elapsed_ms',
      'event_type',
      'clicked_id',
      'clicked_number',
      'clicked_color',
      'expected_number',
      'expected_color',
      'x_svg',
      'y_svg',
      'inter_correct_ms'
    ];

    download(
      'telenpa_cloud_events_' + stamp + '.csv',
      csv(events, eventCols),
      'text/csv;charset=utf-8'
    );

    download(
      'telenpa_cloud_full_' + stamp + '.json',
      JSON.stringify(rs, null, 2),
      'application/json;charset=utf-8'
    );

    updateStatus(
      '成功下載 ' + rs.length +
      ' 筆；一般研究員只能讀取自己資料，管理員可讀取全部'
    );

  } catch(e) {
    updateStatus('匯出失敗：' + e.message);
  }
}

$('cloudLogin').onclick = login;
$('cloudLogout').onclick = logout;
$('cloudSync').onclick = sync;
$('cloudExport').onclick = exportCloud;

window.addEventListener('ctt:recordSaved', () => {
  updateStatus('新增施測紀錄');
  if (token) void sync();
});

window.addEventListener('online', () => {
  if (token) void sync();
});

$('clear').addEventListener('click', e => {
  if (pending().length) {
    e.stopImmediatePropagation();

    alert(
      '仍有 ' + pending().length +
      ' 筆尚未成功同步！請先備份或登入同步後再清除。'
    );
  }
}, true);

if (!configured) {
  status(
    '未設定雲端：請依 README 建立 Supabase，填寫 config.js。'
  );
} else {
  updateStatus();
}

})();
