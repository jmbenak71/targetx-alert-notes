/* TargetX Alert Notes — Canvas bookmarklet
   Version 1.1
   Run from any page inside a Canvas course (instructor/TA/admin view).
   Uses your logged-in Canvas session; no API token needed.
   Builds a per-student overview (grade, missing, late, last activity)
   and copy-ready plain-text notes for TargetX comments / early alerts. */
(async () => {
  const VERSION = '1.1';
  const m = location.pathname.match(/\/courses\/(\d+)/);
  if (!m) { alert('Open a Canvas course first, then run TargetX Alert Notes.'); return; }
  const courseId = m[1];
  const old = document.getElementById('txan-root'); if (old) old.remove();

  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', {month:'numeric', day:'numeric', year:'numeric'}) : '—';
  const daysAgo = d => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : null;
  async function getAll(url) {
    let out = [], next = url;
    while (next) {
      const r = await fetch(next, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`${r.status} on ${next.split('?')[0]}`);
      const data = await r.json(); out = out.concat(data);
      const link = r.headers.get('Link') || '';
      const nm = link.split(',').find(p => p.includes('rel="next"'));
      next = nm ? nm.match(/<([^>]+)>/)[1] : null;
    }
    return out;
  }
  const TX_ALERTS = 'https://lakemichigancollege.lightning.force.com/lightning/n/TgtX_Retention__Faculty_Alerts';
  // Synchronous copy so it runs inside the click before the TargetX tab takes focus
  function copySync(t) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok;
  }
  const openTX = () => window.open(TX_ALERTS, 'targetx'); // reuses one TargetX tab
  // ---- Adjunct Faculty Early Alert Form (FormAssembly), pre-filled via URL ----
  const ADJ_FORM = 'https://lakemichigancollege.tfaforms.net/217811';
  const ADJ_TERM = { Fall: 'tfa_424', Spring: 'tfa_425', Summer: 'tfa_426' };
  const ADJ_CAT = { missing: 'tfa_419', attendance: 'tfa_420' };
  function adjTermYear() {
    const tn = course.term?.name || '', now = new Date();
    const season = (tn.match(/fall|spring|summer/i) || [])[0];
    const term = season ? season[0].toUpperCase() + season.slice(1).toLowerCase()
      : (now.getMonth() <= 3 ? 'Spring' : now.getMonth() <= 6 ? 'Summer' : 'Fall');
    const year = (tn.match(/\b(20\d{2})\b/) || [])[1] || String(now.getFullYear());
    return { term, year };
  }
  function adjCourseId() { // "CIS-113-01" -> "CIS113"
    const m = String(course.course_code || course.name || '').match(/([A-Za-z]{2,5})[\s_-]*(\d{3}[A-Za-z]?)/);
    return m ? (m[1] + m[2]).toUpperCase() : '';
  }
  function adjCRN(s) { // first 5-digit number 10000-39999 in SIS IDs or names
    for (const src of [s.sectionSis, course.sis_course_id, s.section, course.name, course.course_code]) {
      const m = String(src || '').match(/(?<!\d)([1-3]\d{4})(?!\d)/); if (m) return m[1];
    }
    return '';
  }
  function adjCategory(s) {
    if ((s.score != null && s.score < val('#tx-g')) || s.missing.length >= val('#tx-m')) return ADJ_CAT.missing;
    if (reasons(s).length) return ADJ_CAT.attendance; // inactivity / no submissions only
    return '';
  }
  function adjURL(s) {
    const { term, year } = adjTermYear(), p = new URLSearchParams();
    const add = (k, v) => { if (v) p.set(k, v); };
    add('tfa_423', ADJ_TERM[term]);
    add('tfa_427', year);
    add('tfa_422', adjCourseId());
    add('tfa_431', adjCRN(s));
    add('tfa_11', (s.display || s.name).slice(0, 40));
    if (/^[1-9]\d{7}$/.test(s.sis)) add('tfa_12', s.sis); // form requires an 8-digit LMC ID
    add('tfa_417', adjCategory(s));
    add('tfa_421', note(s));
    return `${ADJ_FORM}?${p.toString()}`;
  }
  const TX_SEARCH = q => `https://lakemichigancollege.my.salesforce.com/_ui/search/ui/UnifiedSearchResults?str=${encodeURIComponent(q)}`;
  try { localStorage.removeItem('txan-contact-map'); } catch {} // clear any previously imported IDs
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok; }
  }

  // ---------- shell UI ----------
  const root = document.createElement('div'); root.id = 'txan-root';
  root.innerHTML = `
  <style>
    #txan-root{position:fixed;inset:0;z-index:99999;background:rgba(22,32,44,.45);display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow:auto;font:14px/1.45 "Segoe UI",Lato,Helvetica,Arial,sans-serif;color:#1d2733}
    #txan-root *{box-sizing:border-box}
    .tx-panel{background:#fff;width:min(1100px,100%);border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden}
    .tx-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px 22px;border-bottom:3px solid #2c5f7c;background:#f3f6f8}
    .tx-head h2{margin:0;font-size:19px;font-weight:600}
    .tx-head p{margin:2px 0 0;color:#566472;font-size:13px}
    .tx-x{border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:#566472}
    .tx-ctrl{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-end;padding:14px 22px;border-bottom:1px solid #dde3e8}
    .tx-ctrl label{display:flex;flex-direction:column;font-size:12px;color:#566472;gap:3px}
    .tx-ctrl label.inl{flex-direction:row;align-items:center;gap:6px;font-size:13px;color:#1d2733}
    .tx-ctrl input[type=number]{width:70px;padding:5px 6px;border:1px solid #b9c3cc;border-radius:4px}
    .tx-ctrl textarea{width:320px;height:52px;padding:5px 7px;border:1px solid #b9c3cc;border-radius:4px;font:inherit;resize:vertical}
    .tx-btn{padding:7px 12px;border-radius:4px;border:1px solid #2c5f7c;background:#2c5f7c;color:#fff;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
    .tx-btn.alt{background:#fff;color:#2c5f7c}
    .tx-btn:focus-visible,.tx-x:focus-visible{outline:3px solid #f0b429;outline-offset:2px}
    .tx-btn.done{background:#2f7d4f;border-color:#2f7d4f;color:#fff}
    .tx-body{padding:6px 22px 22px;overflow-x:auto}
    table.tx{width:100%;border-collapse:collapse;margin-top:8px}
    .tx th{text-align:left;font-size:12px;color:#566472;font-weight:600;padding:8px 8px;border-bottom:2px solid #dde3e8;white-space:nowrap}
    .tx td{padding:9px 8px;border-bottom:1px solid #eef1f4;vertical-align:top}
    .tx tr.flag td:first-child{box-shadow:inset 4px 0 0 #c2410c}
    .tx .num{text-align:right;font-variant-numeric:tabular-nums}
    .tx .bad{color:#b42318;font-weight:600}
    .tx .reason{font-size:12px;color:#b42318}
    .tx .sub{font-size:12px;color:#566472}
    .tx details summary{cursor:pointer;color:#2c5f7c;font-size:12px}
    .tx details ul{margin:4px 0 0 16px;padding:0;font-size:12px}
    .tx-msg{padding:28px 0;color:#566472}
    .tx-err{color:#b42318}
  </style>
  <div class="tx-panel" role="dialog" aria-label="TargetX alert notes">
    <div class="tx-head"><div><h2>TargetX alert notes <span style="font-size:12px;font-weight:400;color:#566472">v${VERSION}</span></h2><p id="tx-sub">Loading course data…</p></div>
      <button class="tx-x" aria-label="Close">×</button></div>
    <div class="tx-ctrl">
      <label>Flag if grade below (%)<input type="number" id="tx-g" value="70" min="0" max="100"></label>
      <label>Flag if missing at least<input type="number" id="tx-m" value="2" min="1"></label>
      <label>Flag if inactive for (days)<input type="number" id="tx-d" value="7" min="1"></label>
      <label class="inl"><input type="checkbox" id="tx-only" checked> Show flagged students only</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="tx-btn" id="tx-all">Copy all flagged notes</button>
        <button class="tx-btn alt" id="tx-csv">Download CSV</button>
        <button class="tx-btn alt" id="tx-open">Open TargetX Faculty Alerts</button>
      </div>
    </div>
    <div class="tx-body"><div class="tx-msg" id="tx-out">Pulling enrollments and submissions…</div></div>
  </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  $('.tx-x').onclick = () => root.remove();
  root.addEventListener('click', e => { if (e.target === root) root.remove(); });
  document.addEventListener('keydown', function k(e){ if (e.key === 'Escape'){ root.remove(); document.removeEventListener('keydown', k);} });

  // ---------- data ----------
  let course, students = [], secMap = {}, groupName = {}, teachers = [];
  try {
    const base = `/api/v1/courses/${courseId}`;
    const [c, enr, subs, secs, tch, groups] = await Promise.all([
      fetch(`${base}?include[]=term`, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(r => r.json()),
      getAll(`${base}/enrollments?type[]=StudentEnrollment&state[]=active&include[]=current_points&per_page=100`),
      getAll(`${base}/students/submissions?student_ids[]=all&include[]=assignment&per_page=100`),
      getAll(`${base}/sections?per_page=100`).catch(() => []),
      getAll(`${base}/enrollments?type[]=TeacherEnrollment&state[]=active&per_page=100`).catch(() => []),
      getAll(`${base}/assignment_groups?per_page=100`).catch(() => [])
    ]);
    secMap = Object.fromEntries(secs.map(x => [x.id, x]));
    groupName = Object.fromEntries(groups.map(g => [g.id, g.name]));
    teachers = tch;
    course = c;
    const now = Date.now();
    const byUser = {};
    const lastSub = {};
    for (const s of subs) {
      if (s.submitted_at && (!lastSub[s.user_id] || s.submitted_at > lastSub[s.user_id])) lastSub[s.user_id] = s.submitted_at;
      const a = s.assignment || {};
      if (s.excused || a.omit_from_final_grade || !(a.points_possible > 0)) continue; // skip excused + 0-point work
      const u = (byUser[s.user_id] ||= { missing: [], late: 0, pastDue: 0, earned: 0, possible: 0, groups: {} });
      const due = s.cached_due_date || a.due_at; // the student's own due date (honors overrides/extensions)
      if (due && new Date(due) < now) u.pastDue++;
      const graded = s.score != null && s.workflow_state === 'graded';
      const zero = graded && Number(s.score) === 0;
      if (graded) { // assignment-group breakdown on graded work (zeros included)
        const gg = (u.groups[a.assignment_group_id] ||= { earned: 0, possible: 0 });
        gg.earned += Number(s.score); gg.possible += Number(a.points_possible);
      }
      if (s.missing || zero) {
        // Any recorded 0 counts as missing, submitted or not; kept out of the submitted average
        u.missing.push({ name: a.name || `Assignment ${s.assignment_id}`, due, zero: zero && !s.missing });
      } else if (graded) {
        u.earned += Number(s.score); u.possible += Number(a.points_possible); // points-based average
      }
      if (s.late) u.late++;
    }
    const seen = new Set();
    for (const e of enr) {
      if (seen.has(e.user_id)) continue; seen.add(e.user_id); // skip duplicate section enrollments
      const g = e.grades || {}, u = byUser[e.user_id] || { missing: [], late: 0, pastDue: 0, earned: 0, possible: 0, groups: {} };
      u.missing.sort((a, b) => new Date(a.due || 0) - new Date(b.due || 0));
      const sec = secMap[e.course_section_id] || {};
      const secTeachers = teachers.filter(t => t.course_section_id === e.course_section_id);
      const full = e.user?.name || '';
      students.push({
        id: e.user_id,
        name: e.user?.sortable_name || full || `User ${e.user_id}`,
        display: full,
        first: (e.user?.short_name || full).split(' ')[0] || 'The student',
        sis: e.user?.sis_user_id || '',
        login: e.user?.login_id || '',
        // Match the Gradebook Total: include grades entered but not yet posted (instructor view)
        score: g.unposted_current_score ?? g.current_score,
        letter: g.unposted_current_grade ?? g.current_grade,
        lastAct: e.last_activity_at,
        lastSub: lastSub[e.user_id] || null,
        avg: u.possible > 0 ? (u.earned / u.possible) * 100 : null,
        section: sec.name || '',
        sectionSis: sec.sis_section_id || '',
        instructors: [...new Set((secTeachers.length ? secTeachers : teachers).map(t => t.user?.name).filter(Boolean))],
        ...u
      });
    }
  } catch (err) {
    $('#tx-out').innerHTML = `<span class="tx-err">Couldn't load course data (${esc(err.message)}). Make sure you're enrolled as a teacher, TA, or admin in this course.</span>`;
    return;
  }
  $('#tx-sub').textContent = `${course.course_code || ''} ${course.name ? '– ' + course.name : ''} · ${students.length} active students`;

  // ---------- logic ----------
  const val = id => Number($(id).value);
  function reasons(s) {
    const r = [];
    if (s.score != null && s.score < val('#tx-g')) r.push(`Grade below ${val('#tx-g')}%`);
    if (s.missing.length >= val('#tx-m')) r.push(`${s.missing.length} missing assignment${s.missing.length === 1 ? '' : 's'}`);
    const d = daysAgo(s.lastAct);
    if (!s.lastSub && s.pastDue > 0) r.push('No submissions this term');
    if (d === null) r.push('No Canvas activity recorded');
    else if (d >= val('#tx-d')) r.push(`No Canvas activity in ${d} days`);
    return r;
  }
  const pct = (v, l) => v != null ? `${v.toFixed(1)}%${l ? ` (${l})` : ''}` : 'n/a';
  const ago = dt => { const d = daysAgo(dt); return `${fmtDate(dt)} (${d} day${d === 1 ? '' : 's'} ago)`; };
  function summary(s) {
    const n = s.missing.length, code = course.course_code || course.name, today = fmtDate(new Date());
    const g = s.score != null
      ? `${s.first} has a current grade of ${pct(s.score, s.letter)} in ${code} as of ${today}.`
      : `${s.first} has no graded work in ${code} as of ${today}.`;
    const m = n ? `${s.first} has not submitted ${n} assignment${n === 1 ? '' : 's'}.` : `${s.first} has no missing assignments.`;
    return `${g} ${m}`;
  }
  const DAY = 86400000;
  function note(s) {
    const now = Date.now();
    const lines = [
      `Canvas Academic Update – ${course.course_code || course.name} – ${fmtDate(new Date())}`,
      `Student: ${s.display || s.name}${s.sis ? ` (ID ${s.sis})` : ''}`
    ];
    const ctx = [s.section && `Section: ${s.section}`, s.instructors.length && `Instructor: ${s.instructors.join(', ')}`].filter(Boolean);
    if (ctx.length) lines.push(ctx.join(' | '));
    lines.push('', summary(s), '');
    // Skill vs. engagement
    if (s.avg != null) lines.push(`Average on submitted work: ${s.avg.toFixed(1)}% (excludes missing and zero-graded work)`);
    // New vs. ongoing
    if (s.missing.length) {
      const recent = s.missing.filter(a => a.due && now - new Date(a.due) <= 14 * DAY).length;
      lines.push(`Missing work timing: ${recent} in the last 14 days, ${s.missing.length - recent} earlier`);
    }
    // Where in the course
    const gs = Object.entries(s.groups).filter(([, g]) => g.possible > 0)
      .map(([id, g]) => `${groupName[id] || 'Other'} ${(g.earned / g.possible * 100).toFixed(0)}%`);
    if (gs.length) lines.push(`By category (graded work): ${gs.join(' · ')}`);
    lines.push('',
      `Last Canvas activity: ${s.lastAct ? ago(s.lastAct) : 'None recorded'}`,
      `Last Canvas submission: ${s.lastSub ? ago(s.lastSub) : 'None this term'}`);
    return lines.join('\n');
  }

  function render() {
    const rows = students
      .map(s => ({ s, r: reasons(s) }))
      .filter(x => !$('#tx-only').checked || x.r.length)
      .sort((a, b) => b.r.length - a.r.length || (a.s.score ?? 999) - (b.s.score ?? 999));
    if (!rows.length) { $('#tx-out').outerHTML = `<div class="tx-msg" id="tx-out">No students meet the current flag settings. Loosen the thresholds or uncheck "Show flagged students only".</div>`; return; }
    const html = `<table class="tx" id="tx-out"><thead><tr>
      <th>Student</th><th class="num">Current</th><th class="num">Missing</th><th class="num">Late</th><th>Last activity</th><th>Concerns</th><th></th></tr></thead><tbody>
      ${rows.map(({ s, r }) => {
        const d = daysAgo(s.lastAct);
        return `<tr class="${r.length ? 'flag' : ''}">
          <td>${esc(s.name)}<div class="sub">${esc(s.sis || s.login || '')}</div></td>
          <td class="num ${s.score != null && s.score < val('#tx-g') ? 'bad' : ''}">${s.score != null ? s.score.toFixed(1) + '%' : '—'}<div class="sub">${esc(s.letter || '')}</div></td>
          <td class="num ${s.missing.length >= val('#tx-m') ? 'bad' : ''}">${s.missing.length}${s.missing.length ? `<details><summary>View</summary><ul>${s.missing.map(a => `<li>${esc(a.name)}${a.due ? ` – ${fmtDate(a.due)}` : ''}${a.zero ? ' (graded 0)' : ''}</li>`).join('')}</ul></details>` : ''}</td>
          <td class="num">${s.late}</td>
          <td>${s.lastAct ? fmtDate(s.lastAct) : '—'}<div class="sub">${d != null ? d + ' days ago' : 'never'}</div></td>
          <td class="reason">${esc(r.join('; '))}</td>
          <td style="white-space:nowrap"><button class="tx-btn alt" data-copy="${s.id}">Copy note</button>
            <button class="tx-btn" data-tx="${s.id}" title="Copies the note, then opens TargetX Faculty Alerts">Copy + TargetX</button>
            ${(s.sis || s.display) ? `<a class="tx-btn alt" style="text-decoration:none" target="targetx" data-link="${s.id}" data-label="Search TargetX" href="${TX_SEARCH(s.sis || s.display)}" title="Copies the note and searches TargetX for this student">Search TargetX</a>` : ''}
            <a class="tx-btn alt" style="text-decoration:none" target="lmcalert" data-link="${s.id}" data-label="Adjunct Alert" href="${esc(adjURL(s))}" title="Copies the note and opens the Faculty Early Alert Form, pre-filled">Adjunct Alert</a></td></tr>`;
      }).join('')}</tbody></table>`;
    $('#tx-out').outerHTML = html;
  }

  // Profile / Search TargetX links: copy the note during the click, then let the link open TargetX
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-link]'); if (!a) return;
    const s = students.find(x => String(x.id) === a.dataset.link);
    const ok = copySync(note(s));
    a.textContent = ok ? 'Note copied' : 'Copy failed'; a.classList.add('done');
    setTimeout(() => { a.textContent = a.dataset.label; a.classList.remove('done'); }, 3000);
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-tx]'); if (!b) return;
    const s = students.find(x => String(x.id) === b.dataset.tx);
    const ok = copySync(note(s));
    openTX();
    b.textContent = ok ? `Copied – find ${s.sis || s.display}` : 'Copy failed – use Copy note';
    b.classList.add('done'); setTimeout(() => { b.textContent = 'Copy + TargetX'; b.classList.remove('done'); }, 4000);
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const s = students.find(x => String(x.id) === b.dataset.copy);
    if (await copyText(note(s))) { b.textContent = 'Copied'; b.classList.add('done'); setTimeout(() => { b.textContent = 'Copy note'; b.classList.remove('done'); }, 1800); }
  });
  $('#tx-all').onclick = async () => {
    const flagged = students.filter(s => reasons(s).length);
    if (!flagged.length) { alert('No flagged students to copy.'); return; }
    const sep = '\n\n----------------------------------------\n\n';
    if (await copyText(flagged.map(note).join(sep))) { $('#tx-all').textContent = `Copied ${flagged.length} notes`; setTimeout(() => $('#tx-all').textContent = 'Copy all flagged notes', 2000); }
  };
  $('#tx-open').onclick = openTX;
  $('#tx-csv').onclick = () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Student', 'SIS ID', 'Login', 'Course', 'Current %', 'Current letter', 'Missing', 'Past due', 'Late', 'Last activity', 'Concerns', 'Summary', 'Note'];
    const body = students.map(s => [s.display || s.name, s.sis, s.login, course.course_code, s.score?.toFixed(1), s.letter, s.missing.length, s.pastDue, s.late, fmtDate(s.lastAct), reasons(s).join('; '), summary(s), note(s)].map(q).join(','));
    const blob = new Blob([[head.map(q).join(','), ...body].join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `targetx-alerts_${(course.course_code || courseId).replace(/\W+/g, '-')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  ['#tx-g', '#tx-m', '#tx-d', '#tx-only'].forEach(id => $(id).addEventListener('input', render));
  render();
})();
