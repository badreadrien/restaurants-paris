(function () {
  'use strict';

  // ============================== i18n =====================================
  var STRINGS = {
    fr: {
      title: 'Mes adresses',
      tagline: 'Restaurants, bistrots et tables repérés un par un, à Paris, à Boston et ailleurs. Après chaque visite, ma note et mon commentaire.',
      editBadge: '✏️ Mode édition actif sur cet appareil',
      lock: 'Verrouiller',
      allCities: 'Toutes les villes',
      allTypes: 'Tous les types',
      loading: 'Chargement…',
      myTake: 'Mon avis',
      commentPlaceholder: 'Ton commentaire après la visite…',
      notVisited: 'Pas encore visité.',
      ratedNoComment: 'Noté, sans commentaire.',
      updatedOn: 'Mis à jour le ',
      saving: 'Enregistrement…',
      saved: 'Enregistré ✓',
      saveFailed: 'Échec de l’enregistrement, réessaie.',
      edited: 'Modifié…',
      invalidKey: 'Lien d’édition invalide — recharge la page avec ton lien d’édition.',
      ratingLabel: 'Note : ',
      ratingOf: ' sur 5',
      wineList: '🍷 Carte des vins',
      website: '🌐 Site',
      addTitle: 'Ajouter un restaurant',
      addHelp: 'Tape un nom, choisis la ville (et une précision si besoin). Je le vérifie, je l’enrichis — adresse, menu, carte des vins — et il apparaît ici au prochain passage, toutes les ~15 minutes.',
      namePlaceholder: 'Nom du restaurant',
      cityLabel: 'Ville',
      otherCity: 'Autre',
      notePlaceholder: 'Précision (optionnel)',
      addButton: 'Ajouter',
      nameRequired: 'Écris d’abord le nom du restaurant.',
      sending: 'Envoi…',
      received: 'Bien reçu ! Je le vérifie et je l’ajoute au prochain passage (toutes les ~15 min).',
      sendFailed: 'Échec de l’envoi, réessaie.',
      subPending: 'en attente…',
      subDone: 'ajouté ✓',
      emptyCity: 'Aucune adresse ici pour l’instant.',
      footer: 'Liste personnelle. Les notes et commentaires sont synchronisés en ligne ; seule la personne disposant du lien d’édition peut les modifier.',
      locale: 'fr-FR'
    },
    en: {
      title: 'My addresses',
      tagline: 'Restaurants, bistros and tables I have spotted one by one, in Paris, Boston and beyond. After each visit, my rating and my comment.',
      editBadge: '✏️ Edit mode is on for this device',
      lock: 'Lock',
      allCities: 'All cities',
      allTypes: 'All types',
      loading: 'Loading…',
      myTake: 'My take',
      commentPlaceholder: 'Your comment after the visit…',
      notVisited: 'Not visited yet.',
      ratedNoComment: 'Rated, no comment.',
      updatedOn: 'Updated on ',
      saving: 'Saving…',
      saved: 'Saved ✓',
      saveFailed: 'Save failed, try again.',
      edited: 'Edited…',
      invalidKey: 'Invalid edit link — reload the page with your edit link.',
      ratingLabel: 'Rating: ',
      ratingOf: ' out of 5',
      wineList: '🍷 Wine list',
      website: '🌐 Website',
      addTitle: 'Add a restaurant',
      addHelp: 'Type a name, pick the city (and add a detail if needed). I verify it, enrich it — address, menu, wine list — and it shows up here on the next pass, every ~15 minutes.',
      namePlaceholder: 'Restaurant name',
      cityLabel: 'City',
      otherCity: 'Other',
      notePlaceholder: 'Detail (optional)',
      addButton: 'Add',
      nameRequired: 'First type the restaurant’s name.',
      sending: 'Sending…',
      received: 'Got it! I’ll verify it and add it on the next pass (every ~15 min).',
      sendFailed: 'Sending failed, try again.',
      subPending: 'pending…',
      subDone: 'added ✓',
      emptyCity: 'No addresses here yet.',
      footer: 'Personal list. Ratings and comments are synced online; only the holder of the edit link can change them.',
      locale: 'en-US'
    }
  };
  var KNOWN_CITIES = ['Paris', 'Boston'];

  var lang = localStorage.getItem('restaurantsLang')
    || ((navigator.language || 'fr').toLowerCase().indexOf('en') === 0 ? 'en' : 'fr');
  if (!STRINGS[lang]) lang = 'fr';
  function t() { return STRINGS[lang]; }
  function L(field) {
    if (field == null) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field.fr || field.en || '';
  }

  var cityFilter = localStorage.getItem('restaurantsCity') || 'all';
  var typeFilter = localStorage.getItem('restaurantsType') || 'all';
  var CATEGORY_ORDER = ['bistrot', 'steakhouse', 'sandwich', 'bar-a-vin', 'cafe', 'rotisserie', 'gastronomique', 'bistronomique', 'italien', 'pizza'];
  var CATEGORIES = {
    bistrot: { fr: 'Bistrot', en: 'Bistro' },
    steakhouse: { fr: 'Steakhouse', en: 'Steakhouse' },
    sandwich: { fr: 'Sandwich', en: 'Sandwich' },
    'bar-a-vin': { fr: 'Bar à vin', en: 'Wine bar' },
    cafe: { fr: 'Café-brasserie', en: 'Café-brasserie' },
    rotisserie: { fr: 'Rôtisserie', en: 'Rotisserie' },
    gastronomique: { fr: 'Gastronomique', en: 'Fine dining' },
    bistronomique: { fr: 'Bistronomique', en: 'Bistronomic' },
    italien: { fr: 'Italien', en: 'Italian' },
    pizza: { fr: 'Pizza', en: 'Pizza' }
  };

  // ============================ Edit key ===================================
  var KEY_STORAGE = 'restaurantsEditKey';
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

  // ============================ State ======================================
  var restaurants = [];
  var ratings = {};
  var submissions = [];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(t().locale, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  // ====================== Static strings & chrome ===========================
  function applyStrings() {
    document.documentElement.lang = lang;
    document.getElementById('siteTitle').textContent = t().title;
    document.getElementById('tagline').textContent = t().tagline;
    document.getElementById('editBadgeText').textContent = t().editBadge;
    document.getElementById('lockBtn').textContent = t().lock;
    document.getElementById('addTitle').textContent = t().addTitle;
    document.getElementById('addHelp').textContent = t().addHelp;
    document.getElementById('addName').placeholder = t().namePlaceholder;
    document.getElementById('addNote').placeholder = t().notePlaceholder;
    document.getElementById('addBtn').textContent = t().addButton;
    document.getElementById('addCityLabel').textContent = t().cityLabel;
    document.querySelector('#addCity option[value="__other"]').textContent = t().otherCity;
    document.getElementById('footerText').textContent = t().footer;
    document.getElementById('langFr').classList.toggle('active', lang === 'fr');
    document.getElementById('langEn').classList.toggle('active', lang === 'en');
    renderCityBar();
    renderTypeBar();
    render();
    renderSubmissions();
  }

  function setLang(next) {
    if (!STRINGS[next] || next === lang) return;
    lang = next;
    localStorage.setItem('restaurantsLang', lang);
    applyStrings();
  }
  document.getElementById('langFr').addEventListener('click', function () { setLang('fr'); });
  document.getElementById('langEn').addEventListener('click', function () { setLang('en'); });

  var editbar = document.getElementById('editbar');
  if (isEditor()) editbar.hidden = false;
  document.getElementById('lockBtn').addEventListener('click', function () {
    localStorage.removeItem(KEY_STORAGE);
    window.location.reload();
  });

  // ============================ City filter ==================================
  function citiesPresent() {
    var set = {};
    restaurants.forEach(function (r) { if (r.city) set[r.city] = true; });
    KNOWN_CITIES.forEach(function (c) { set[c] = true; });
    var list = Object.keys(set);
    list.sort(function (a, b) {
      var ia = KNOWN_CITIES.indexOf(a), ib = KNOWN_CITIES.indexOf(b);
      if (ia === -1) ia = 99; if (ib === -1) ib = 99;
      return ia - ib || a.localeCompare(b);
    });
    return list;
  }

  function renderCityBar() {
    var bar = document.getElementById('citybar');
    var cities = citiesPresent();
    var html = '<button type="button" class="chip' + (cityFilter === 'all' ? ' active' : '') + '" data-city="all">' + esc(t().allCities) + '</button>';
    cities.forEach(function (c) {
      var n = restaurants.filter(function (r) { return r.city === c; }).length;
      html += '<button type="button" class="chip' + (cityFilter === c ? ' active' : '') + '" data-city="' + esc(c) + '">' + esc(c) + (n ? ' · ' + n : '') + '</button>';
    });
    bar.innerHTML = html;
    bar.querySelectorAll('button.chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cityFilter = btn.getAttribute('data-city');
        localStorage.setItem('restaurantsCity', cityFilter);
        renderCityBar();
        renderTypeBar();
        render();
      });
    });
    document.getElementById('siteCity').textContent = '— ' + (cityFilter === 'all' ? cities.join(' · ') : cityFilter);
  }

  // ============================ Type filter ==================================
  function renderTypeBar() {
    var bar = document.getElementById('typebar');
    if (!bar) return;
    var inCity = restaurants.filter(function (r) { return cityFilter === 'all' || r.city === cityFilter; });
    var counts = {};
    inCity.forEach(function (r) { (r.types || []).forEach(function (k) { counts[k] = (counts[k] || 0) + 1; }); });
    if (typeFilter !== 'all' && !counts[typeFilter]) {
      typeFilter = 'all';
      localStorage.setItem('restaurantsType', 'all');
    }
    var html = '<button type="button" class="chip' + (typeFilter === 'all' ? ' active' : '') + '" data-type="all">' + esc(t().allTypes) + '</button>';
    CATEGORY_ORDER.forEach(function (k) {
      if (!counts[k]) return;
      var label = (CATEGORIES[k] && CATEGORIES[k][lang]) || k;
      html += '<button type="button" class="chip' + (typeFilter === k ? ' active' : '') + '" data-type="' + esc(k) + '">' + esc(label) + ' · ' + counts[k] + '</button>';
    });
    bar.innerHTML = html;
    bar.querySelectorAll('button.chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        typeFilter = btn.getAttribute('data-type');
        localStorage.setItem('restaurantsType', typeFilter);
        renderTypeBar();
        render();
      });
    });
  }

  // ============================ Cards ========================================
  function starsHtml(id, value, editable) {
    var out = '<span class="stars" role="img" aria-label="' + esc(t().ratingLabel + value + t().ratingOf) + '">';
    for (var i = 1; i <= 5; i++) {
      var on = i <= value ? ' on' : '';
      if (editable) {
        out += '<button type="button" class="star' + on + '" data-id="' + esc(id) + '" data-value="' + i + '" aria-label="' + i + ' ★">★</button>';
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
    if (r.wineMenu) links.push('<a href="' + esc(r.wineMenu) + '" target="_blank" rel="noopener">' + esc(t().wineList) + '</a>');
    if (r.website) links.push('<a href="' + esc(r.website) + '" target="_blank" rel="noopener">' + esc(t().website) + '</a>');

    var avis = '<h3>' + esc(t().myTake) + '</h3>' + starsHtml(r.id, mine.rating || 0, editable);
    if (editable) {
      avis += '<textarea data-comment-for="' + esc(r.id) + '" placeholder="' + esc(t().commentPlaceholder) + '" maxlength="1000">' + esc(mine.comment || '') + '</textarea>'
           + '<div class="save-state" data-state-for="' + esc(r.id) + '"></div>';
    } else if (mine.comment) {
      avis += '<p class="comment">' + esc(mine.comment) + '</p>';
    } else if (mine.rating) {
      avis += '<p class="comment empty">' + esc(t().ratedNoComment) + '</p>';
    } else {
      avis += '<p class="comment empty">' + esc(t().notVisited) + '</p>';
    }
    if (mine.updatedAt && (mine.rating || mine.comment)) {
      avis += '<div class="updated">' + esc(t().updatedOn) + esc(fmtDate(mine.updatedAt)) + '</div>';
    }

    return '<article class="card">'
      + '<div class="main">'
      + '<h2>' + (r.website ? '<a href="' + esc(r.website) + '" target="_blank" rel="noopener">' + esc(r.name) + '</a>' : esc(r.name)) + '</h2>'
      + '<p class="addr">' + esc(r.address) + '</p>'
      + '<div class="badges"><span class="badge">' + esc(L(r.type)) + '</span><span class="badge price">' + esc(L(r.price)) + '</span></div>'
      + '<p class="desc">' + esc(L(r.description)) + '</p>'
      + '<div class="links">' + links.join('') + '</div>'
      + '</div>'
      + '<aside class="avis">' + avis + '</aside>'
      + '</article>';
  }

  function render() {
    var list = document.getElementById('list');
    var visible = restaurants.filter(function (r) {
      if (cityFilter !== 'all' && r.city !== cityFilter) return false;
      if (typeFilter !== 'all' && (r.types || []).indexOf(typeFilter) === -1) return false;
      return true;
    });
    list.innerHTML = visible.length
      ? visible.map(cardHtml).join('')
      : '<p class="loading">' + esc(t().emptyCity) + '</p>';
    wireEditors();
  }

  // ============================ Rating saving =================================
  var timers = {};
  function setState(id, text, cls) {
    var el = document.querySelector('[data-state-for="' + CSS.escape(id) + '"]');
    if (el) { el.textContent = text; el.className = 'save-state' + (cls ? ' ' + cls : ''); }
  }

  function saveRating(id) {
    var current = ratings[id] || { rating: 0, comment: '' };
    setState(id, t().saving, '');
    fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-edit-key': editKey() },
      body: JSON.stringify({ id: id, rating: current.rating || 0, comment: current.comment || '' })
    }).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem(KEY_STORAGE);
        setState(id, t().invalidKey, 'err');
        throw new Error('unauthorized');
      }
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(function (data) {
      if (data && data.ratings) ratings = data.ratings;
      setState(id, t().saved, 'ok');
    }).catch(function () {
      setState(id, t().saveFailed, 'err');
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
        current.rating = (current.rating === value) ? 0 : value;
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
        setState(id, t().edited, '');
        scheduleSave(id);
      });
    });
  }

  // ============================ Add form ======================================
  function renderSubmissions() {
    var ul = document.getElementById('subList');
    if (!ul) return;
    var visible = submissions.filter(function (s) { return s.status !== 'cancelled'; }).slice().reverse().slice(0, 8);
    ul.innerHTML = visible.map(function (s) {
      var label = s.status === 'done' ? t().subDone : t().subPending;
      var cls = s.status === 'done' ? 'done' : 'pending';
      return '<li><span class="sub-name">' + esc(s.name) + '</span>'
        + ((s.city && s.city !== '__other') ? ' <span class="sub-note">(' + esc(s.city) + (s.note ? ' — ' + esc(s.note) : '') + ')</span>' : (s.note ? ' <span class="sub-note">(' + esc(s.note) + ')</span>' : ''))
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
    var citySelect = document.getElementById('addCity');
    var state = document.getElementById('addState');
    btn.addEventListener('click', function () {
      var name = nameInput.value.trim();
      if (!name) { state.textContent = t().nameRequired; state.className = 'save-state err'; return; }
      btn.disabled = true;
      state.textContent = t().sending; state.className = 'save-state';
      fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-edit-key': editKey() },
        body: JSON.stringify({ name: name, note: noteInput.value.trim(), city: citySelect.value })
      }).then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      }).then(function (data) {
        if (data && data.entry) submissions.push(data.entry);
        nameInput.value = ''; noteInput.value = '';
        renderSubmissions();
        state.textContent = t().received;
        state.className = 'save-state ok';
      }).catch(function () {
        state.textContent = t().sendFailed;
        state.className = 'save-state err';
      }).then(function () { btn.disabled = false; });
    });
    loadSubmissions();
  }

  // ============================ Load ===========================================
  applyStrings();
  document.getElementById('list').innerHTML = '<p class="loading">' + esc(t().loading) + '</p>';
  Promise.all([
    fetch('/api/restaurants', { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; }),
    fetch('/api/ratings', { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : {}; }).catch(function () { return {}; })
  ]).then(function (results) {
    restaurants = Array.isArray(results[0]) ? results[0] : [];
    ratings = results[1] || {};
    renderCityBar();
    renderTypeBar();
    render();
    wireAddForm();
  });
})();
