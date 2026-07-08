(function(){
  'use strict';
  var TOKEN_KEY = 'aw_admin_token';
  var loginView = document.getElementById('login');
  var dashView = document.getElementById('dashboard');
  var loginForm = document.getElementById('login-form');
  var loginStatus = document.getElementById('login-status');
  var pwInput = document.getElementById('pw');
  var tabLeads = document.getElementById('tab-leads');
  var tabBookings = document.getElementById('tab-bookings');
  var tableLeads = document.getElementById('table-leads');
  var tableBookings = document.getElementById('table-bookings');
  var emptyEl = document.getElementById('empty');
  var countTotal = document.getElementById('count-total');
  var countToday = document.getElementById('count-today');
  var countWeek = document.getElementById('count-week');
  var refreshBtn = document.getElementById('refresh');
  var logoutBtn = document.getElementById('logout');
  var exportBtn = document.getElementById('export');

  var currentData = { leads: [], bookings: [] };
  var currentTab = 'leads';

  function getToken(){ return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t){
    sessionStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(TOKEN_KEY, t);
  }
  function clearToken(){
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function showLogin(){ loginView.classList.remove('hidden'); dashView.classList.add('hidden'); }
  function showDash(){ loginView.classList.add('hidden'); dashView.classList.remove('hidden'); load(); }

  function setStatus(msg, ok){
    loginStatus.textContent = msg || '';
    loginStatus.className = 'form-note' + (ok === true ? ' ok' : ok === false ? ' err' : '');
  }

  loginForm.addEventListener('submit', function(e){
    e.preventDefault();
    var pw = pwInput.value;
    if(!pw){ setStatus('Escribe tu contraseña.', false); return; }
    setStatus('Verificando…');
    fetch('/api/admin/login', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ password: pw })
    }).then(function(r){ return r.json(); })
      .then(function(j){
        if(j.ok && j.token){ setToken(j.token); setStatus(''); pwInput.value=''; showDash(); }
        else { setStatus(j.error || 'Contraseña incorrecta.', false); }
      })
      .catch(function(){ setStatus('Error de conexión.', false); });
  });

  function authHeaders(){
    return { 'Authorization':'Bearer ' + getToken(), 'Content-Type':'application/json' };
  }

  function load(){
    if(!getToken()){ showLogin(); return; }
    Promise.all([
      fetch('/api/admin/leads', { headers: authHeaders() }).then(handleAuth),
      fetch('/api/admin/bookings', { headers: authHeaders() }).then(handleAuth)
    ]).then(function(res){
      var leads = (res[0] && res[0].leads) || [];
      var bookings = (res[1] && res[1].bookings) || [];
      currentData = { leads: leads, bookings: bookings };
      render();
    }).catch(function(){ /* handled by handleAuth */ });
  }

  function handleAuth(r){
    if(r.status === 401){ clearToken(); showLogin(); setStatus('Sesión expirada. Vuelve a entrar.', false); throw new Error('401'); }
    return r.json();
  }

  function fmt(dateStr){
    try{
      var d = new Date(dateStr);
      return d.toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
    }catch{ return dateStr; }
  }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function render(){
    var rows = currentTab === 'leads' ? currentData.leads : currentData.bookings;
    var tbody = currentTab === 'leads' ? tableLeads.querySelector('tbody') : tableBookings.querySelector('tbody');
    tbody.innerHTML = '';
    if(!rows.length){
      emptyEl.classList.remove('hidden');
    } else {
      emptyEl.classList.add('hidden');
    }
    countTotal.textContent = rows.length;
    var now = new Date(); var today = now.toDateString();
    var weekAgo = now.getTime() - 7*24*3600*1000;
    var todayCount = 0, weekCount = 0;
    rows.forEach(function(it){
      var d = new Date(it.createdAt);
      if(d.toDateString() === today) todayCount++;
      if(d.getTime() >= weekAgo) weekCount++;
      var tr = document.createElement('tr');
      if(currentTab === 'leads'){
        tr.innerHTML = '<td>'+fmt(it.createdAt)+'</td><td>'+esc(it.name)+'</td><td><a href="mailto:'+esc(it.email)+'" style="color:var(--accent)">'+esc(it.email)+'</a></td><td>'+(it.phone?('<a href="https://wa.me/'+encodeURIComponent(it.phone.replace(/[^\d+]/g,''))+'" target="_blank" rel="noopener" style="color:var(--cta)">'+esc(it.phone)+'</a>'):'<span class="muted">—</span>')+'</td><td>'+esc(it.service||'')+'</td><td class="wrap">'+esc(it.message||'')+'</td>';
      } else {
        var when = it.date ? (esc(it.date) + (it.time ? ' ' + esc(it.time) : '')) : '<span class="muted">—</span>';
        tr.innerHTML = '<td>'+fmt(it.createdAt)+'</td><td>'+esc(it.name)+'</td><td><a href="mailto:'+esc(it.email)+'" style="color:var(--accent)">'+esc(it.email)+'</a></td><td>'+(it.phone?('<a href="https://wa.me/'+encodeURIComponent(it.phone.replace(/[^\d+]/g,''))+'" target="_blank" rel="noopener" style="color:var(--cta)">'+esc(it.phone)+'</a>'):'<span class="muted">—</span>')+'</td><td>'+when+'</td><td>'+esc(it.time||'')+'</td><td>'+esc(it.service||'')+'</td><td class="wrap">'+esc(it.notes||'')+'</td><td><span class="tag '+esc(it.status||'pendiente')+'">'+esc(it.status||'pendiente')+'</span></td>';
      }
      tbody.appendChild(tr);
    });
    countToday.textContent = todayCount;
    countWeek.textContent = weekCount;
  }

  function setTab(t){
    currentTab = t;
    tabLeads.classList.toggle('active', t === 'leads');
    tabBookings.classList.toggle('active', t === 'bookings');
    tableLeads.classList.toggle('hidden', t !== 'leads');
    tableBookings.classList.toggle('hidden', t !== 'bookings');
    render();
  }
  tabLeads.addEventListener('click', function(){ setTab('leads'); });
  tabBookings.addEventListener('click', function(){ setTab('bookings'); });
  refreshBtn.addEventListener('click', load);

  logoutBtn.addEventListener('click', function(){
    var t = getToken();
    fetch('/api/admin/logout', { method:'POST', headers: authHeaders() }).catch(function(){});
    clearToken();
    showLogin();
    setStatus('');
    pwInput.focus();
  });

  function toCSV(rows, fields){
    var head = fields.map(function(f){ return '"'+f+'"'; }).join(',');
    var lines = [head];
    rows.forEach(function(it){
      lines.push(fields.map(function(f){
        var v = it[f] == null ? '' : String(it[f]);
        return '"'+v.replace(/"/g,'""')+'"';
      }).join(','));
    });
    return lines.join('\n');
  }
  exportBtn.addEventListener('click', function(){
    var rows = currentTab === 'leads' ? currentData.leads : currentData.bookings;
    if(!rows.length){ return; }
    var fields = currentTab === 'leads'
      ? ['createdAt','name','email','phone','service','message']
      : ['createdAt','name','email','phone','date','time','service','notes','status'];
    var csv = toCSV(rows, fields);
    var blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = currentTab + '-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });

  if(getToken()){ showDash(); } else { showLogin(); }
})();
