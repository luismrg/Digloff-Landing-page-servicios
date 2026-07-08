(function(){
  'use strict';
  var year = document.getElementById('year');
  if(year) year.textContent = new Date().getFullYear();

  var form = document.getElementById('lead-form');
  if(!form) return;
  var status = document.getElementById('form-status');

  function setStatus(msg, ok){
    if(!status) return;
    status.textContent = msg || '';
    status.className = 'form-note' + (ok === true ? ' ok' : ok === false ? ' err' : '');
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var data = {};
    new FormData(form).forEach(function(v,k){ data[k] = v; });
    if(!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)){
      setStatus('Revisa el email, parece no válido.', false); return;
    }
    if(!data.service){
      setStatus('Selecciona el servicio que necesitas.', false); return;
    }
    var btn = form.querySelector('button[type=submit]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Enviando…';
    setStatus('');
    fetch('/api/leads', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(data)
    }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(res){
        if(res.ok && res.j && res.j.ok){
          form.reset();
          setStatus('¡Recibido! Te respondemos en menos de 24 h. Gracias.', true);
        } else {
          setStatus((res.j && res.j.error) || 'No se pudo enviar. Inténtalo de nuevo.', false);
        }
      })
      .catch(function(){ setStatus('Error de conexión. ¿Probamos por WhatsApp?', false); })
      .finally(function(){ btn.disabled = false; btn.textContent = original; });
  });

  var nav = document.querySelector('.site-nav');
  if(nav && window.matchMedia('(max-width:860px)').matches){
    var cta = document.querySelector('.nav-cta');
    if(cta) nav.appendChild(cta);
  }

  // ============================================================
  // ANIMACIONES — reveal on scroll + micro-interacciones
  // ============================================================
  var prefersReduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  function revealOnScroll(){
    if(prefersReduced){
      // Sin animación: todo visible de inmediato
      document.querySelectorAll('.section,.cards,.stat-grid,.steps,.testimonial,.faq,.cta-grid,.reveal')
        .forEach(function(el){ el.classList.add('is-visible'); });
      return;
    }
    if(!('IntersectionObserver' in window)){
      document.querySelectorAll('.section,.cards,.stat-grid,.steps,.testimonial,.faq,.cta-grid,.reveal')
        .forEach(function(el){ el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, {threshold:0.15, rootMargin:'0px 0px -8% 0px'});

    var sel = '.section,.cards,.stat-grid,.steps,.testimonial,.faq,.cta-grid,.reveal';
    document.querySelectorAll(sel).forEach(function(el){ io.observe(el); });
  }
  revealOnScroll();

  // Brillo que sigue al cursor dentro de cada card de servicios
  if(!prefersReduced){
    document.querySelectorAll('.card').forEach(function(card){
      card.addEventListener('pointermove', function(ev){
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((ev.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((ev.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  // ---- Formulario de reserva de cita ----
  var bForm = document.getElementById('booking-form');
  if(bForm){
    var bStatus = document.getElementById('booking-status');
    var bDate = document.getElementById('b-date');
    var today = new Date();
    today.setHours(0,0,0,0);
    bDate.min = today.toISOString().slice(0,10);

    function setBStatus(msg, ok){
      if(!bStatus) return;
      bStatus.textContent = msg || '';
      bStatus.className = 'form-note' + (ok === true ? ' ok' : ok === false ? ' err' : '');
    }

    bForm.addEventListener('submit', function(e){
      e.preventDefault();
      var data = {};
      new FormData(bForm).forEach(function(v,k){ data[k] = v; });
      if(!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)){
        setBStatus('Revisa el email, parece no válido.', false); return;
      }
      if(!data.date || !data.time){ setBStatus('Elige día y hora de la cita.', false); return; }
      var chosen = new Date(data.date + 'T00:00:00');
      if(chosen < today){ setBStatus('Elige una fecha futura.', false); return; }
      var bBtn = bForm.querySelector('button[type=submit]');
      var orig = bBtn.textContent;
      bBtn.disabled = true; bBtn.textContent = 'Reservando…';
      setBStatus('');
      fetch('/api/bookings', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data)
      }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
        .then(function(res){
          if(res.ok && res.j && res.j.ok){
            bForm.reset();
            setBStatus('¡Cita reservada! Te contactamos para confirmar. Revisa tu email o WhatsApp.', true);
          } else {
            setBStatus((res.j && res.j.error) || 'No se pudo reservar. Inténtalo de nuevo o escríbenos por WhatsApp.', false);
          }
        })
        .catch(function(){ setBStatus('Error de conexión. ¿Reservamos por WhatsApp?', false); })
        .finally(function(){ bBtn.disabled = false; bBtn.textContent = orig; });
    });
  }
})();
