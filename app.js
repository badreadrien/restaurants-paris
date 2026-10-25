(function () {
  'use strict';

  var KEY_STORAGE = 'restaurantsEditKey';

  // --- Edit key handling -------------------------------------------------
  // Editing is unlocked by visiting the site once with ?edit=<key>.
  // The key is then kept in this browser only; the public link stays read-only.
  var params = new URLSearchParams(window.location.search);
  if (params.has('edit')) {
    var k = params.get('edit');
    if (k) localStorage.setItem(KEY_STORAGE, k);
    params.delete('edit');
    var clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', clean);
  }
  function editKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
  function isEditor() { return !!editKey(); }

  var editbar = document.getElementById('editbar');
  if (isEditor()) editbar.hidden = false;
  document.getElementById('lockBtn').addEventListener('click', function () {
    localStorage.removeItem(KEY_STORAGE);
    window.location.reload();
  });

  // --- State ---------------------------------------------------------------
  var restaurants = []; // from /api/restaurants (server-side list)
  var ratings = {};     // id -> { rating: 0..5, comment: string, updatedAt: string }
  var submissions = []; // from /api/submissions (edit mode only)

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  // --- Restaurant cards ------------------------------------------------------
  function starsHtml(id, value, editable) {
    var out = '<span class="stars" role="img" aria-label="Note : ' + value + ' sur 5">';
    for (var i = 1; i <= 5; i++) {
      var on = i <= value ? ' on' : '';
      if (editable) {
        out += '<button type="button" class="star' + on + '" data-id="' + esc(id) + '" data-value="' + i + '" aria-label="' + i + ' étoile' + (i > 1 ? 's' : '') + '">★</button>';
      } else {
        out += '<span class="star' + on + '">★</span>';
      }
    }
    return out + '</span>';
  }

  function cardHtml(r) {
    var mine = ratings[r.id] || { rating: 0, comment: '', updatedAt: '' };
    var editable = isEditor();
    var links = [];
    if (r.maps) links.push('<a href="' + esc(r.maps) + '" target="_blank" rel="noopener">📍 Google Maps</a>');
    if (r.menu) links.push('<a href="' + esc(r.menu) + '" target="_blank" rel="noopener">📋 Menu</a>');
    if (r.wineMenu) links.push('<a href="' + esc(r.wineMenu) + '" target="_blank" rel="noopener">🍷 Carte des vins</a>');
    if (r.website) links.push('<a href="' + esc(r.website) + '" target="_blank" rel="noopener">🌐 Site</a>');

    var avis = '<h3>Mon avis</h3>' + starsHtml(r.id, mine.rating || 0, editable);
    if (editable) {
      avis += '<textarea data-comment-for="' + esc(r.id) + '" placeholder="Ton commentaire après la visite…" maxlength="1000">' + esc(mine.comment || '') + '</textarea>'
           + '<div class="save-state" data-state-for="' + esc(r.id) + '"></div>';
    } else if (mine.comment) {
      avis += '<p class="comment">' + esc(mine.comment) + '</p>';
    } else if (mine.rating) {
      avis += '<p class="comment empty">Noté, sans commentaire.</p>';
    } else {
      avis += '<p class="comment empty">Pas encore visité.</p>';
    }
    if (mine.updatedAt && (mine.rating || mine.comment)) {
      avis += '<div class="updated">Mis à jour le ' + esc(fmtDate(mine.updatedAt)) + '</div>';
    }

    return '<article class="card">'
      + '<div class="main">'
      + '<h2>' + (r.website ? '<a href="' + esc(r.website) + '" target="_blank" rel="noopener">' + esc(r.name) + '</a>' : esc(r.name)) + '</h2>'
      + '<p class="addr">' + esc(r.address) + '</p>'
      + '<div class="badges"><span class="badge">' + esc(r.type) + '</span><span class="badge price">' + esc(r.price) + '</span></div>'
      + '<p class="desc">' + esc(r.description) + '</p>'
      + '<div class="links">' + links.join('') + '</div>'
      + '</div>'
      + '<aside class="avis">' + avis + '</aside>'
      + '</article>';
  }

  function render() {
    var list = document.getElementById('list');
    list.innerHTML = restaurants.length
      ? restaurants.map(cardHtml).join('')
      : '<p class="loading">Aucun restaurant pour le moment.</p>';
    wireEditors();
  }

  // --- Rating saving -----------------------------------------------------------
  var timers = {};
  function setState(id, text, cls) {
    var el = document.querySelector('[data-state-for="' + CSS.escape(id) + '"]');
    if (el) { el.textContent = text; el.className = 'save-state' + (cls ? ' ' + cls : ''); }
  }

  function saveRating(id) {
    var current = ratings[id] || { rating: 0, comment: '' };
    setState(id, 'Enregistrement…', '');
    fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-edit-key': editKey() },
      body: JSON.stringify({ id: id, rating: current.rating || 0, comment: current.comment || '' })
    }).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem(KEY_STORAGE);
        setState(id, 'Lien d’édition invalide — recharge la page avec ton lien d’édition.', 'err');
        throw new Error('unauthorized');
      }
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(function (data) {
      if (data && data.ratings) ratings = data.ratings;
      setState(id, 'Enregistré ✓', 'ok');
    }).catch(function () {
      setState(id, 'Échec de l’enregistrement, réessaie.', 'err');
    });
  }

  function scheduleSave(id) {
    clearTimeout(timers[id]);
    timers[id] = setTimeout(function () { saveRating(id); }, 700);
  }

  function wireEditors() {
    if (!isEditor()) return;
    document.querySelectorAll('button.star').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var value = parseInt(btn.getAttribute('data-value'), 10);
        var current = ratings[id] || { rating: 0, comment: '' };
        current.rating = (current.rating === value) ? 0 : value; // click same star again to clear
        ratings[id] = current;
        render();
        saveRating(id);
      });
    });
    document.querySelectorAll('textarea[data-comment-for]').forEach(function (ta) {
      ta.addEventListener('input', function () {
        var id = ta.getAttribute('data-comment-for');
        var current = ratings[id] || { rating: 0, comment: '' };
        current.comment = ta.value;
        ratings[id] = current;
        setState(id, 'Modifié…', '');
        scheduleSave(id);
      });
    });
  }

  // --- Add-a-restaurant form (edit mode only) -----------------------------------
  function renderSubmissions() {
    var ul = document.getElementById('subList');
    if (!ul) return;
    var visible = submissions.filter(function (s) { return s.status !== 'cancelled'; }).slice().reverse().slice(0, 8);
    ul.innerHTML = visible.map(function (s) {
      var label = s.status === 'done' ? 'ajouté ✓' : (s.status === 'cancelled' ? 'annulé' : 'en attente…');
      var cls = s.status === 'done' ? 'done' : (s.status === 'cancelled' ? 'cancelled' : 'pending');
      return '<li><span class="sub-name">' + esc(s.name) + '</span>'
        + (s.note ? ' <span class="sub-note">(' + esc(s.note) + ')</span>' : '')
        + ' <span class="sub-status ' + cls + '">' + label + '</span></li>';
    }).join('');
  }

  function loadSubmissions() {
    fetch('/api/submissions', { headers: { 'x-edit-key': editKey(), 'Accept': 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : []; })
      .catch(function () { return []; })
      .then(function (data) { submissions = Array.isArray(data) ? data : []; renderSubmissions(); });
  }

  function wireAddForm() {
    if (!isEditor()) return;
    var box = document.getElementById('addbox');
    box.hidden = false;
    var btn = document.getElementById('addBtn');
    var nameInput = document.getElementById('addName');
    var noteInput = document.getElementById('addNote');
    var state = document.getElementById('addState');
    btn.addEventListener('click', function () {
      var name = nameInput.value.trim();
      if (!name) { state.textContent = 'Écris d’abord le nom du restaurant.'; state.className = 'save-state err'; return; }
      btn.disabled = true;
      state.textContent = 'Envoi…'; state.className = 'save-state';
      fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-edit-key': editKey() },
        body: JSON.stringify({ name: name, note: noteInput.value.trim() })
      }).then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      }).then(function (data) {
        if (data && data.entry) submissions.push(data.entry);
        nameInput.value = ''; noteInput.value = '';
        renderSubmissions();
        state.textContent = 'Bien reçu ! Je le vérifie et je l’ajoute au prochain passage (toutes les ~15 min).';
        state.className = 'save-state ok';
      }).catch(function () {
        state.textContent = 'Échec de l’envoi, réessaie.';
        state.className = 'save-state err';
      }).then(function () { btn.disabled = false; });
    });
    loadSubmissions();
  }

  // --- Load -----------------------------------------------------------------------
  Promise.all([
    fetch('/api/restaurants', { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; }),
    fetch('/api/ratings', { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : {}; }).catch(function () { return {}; })
  ]).then(function (results) {
    restaurants = Array.isArray(results[0]) ? results[0] : [];
    ratings = results[1] || {};
    render();
    wireAddForm();
  });
})();
