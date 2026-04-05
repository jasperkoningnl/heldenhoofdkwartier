// Helden Hoofdkwartier — Game Logic
// Missie 1: De Vloedgolf

const state = {
  turn: 1,
  score: 100,
  phase: 1,
  heroes: HEROES.map(h => ({
    id: h.id,
    location: 'amsterdam',
    traveling: null,          // { to, turnsLeft } or null
    actedThisTurn: false,
    mudApplied: {}            // { cityId: true } — once per travel
  })),
  locations: makeInitialLocations(),
  mitigationTurns: 0,
  boss: null,                 // { requiredIN } while phase 2
  log: [],
  gameOver: false
};

function heroDef(id) { return HEROES.find(h => h.id === id); }
function heroState(id) { return state.heroes.find(h => h.id === id); }

function log(msg) {
  state.log.unshift(msg);
  if (state.log.length > 30) state.log.pop();
}

// ============================================================
// Stats with Water Might
// ============================================================
function effectiveStat(hero, stat, loc) {
  const def = heroDef(hero.id);
  let val = def[stat];
  if (hero.id === 'kapitein_holland' && loc && loc.waterLevel > 0) {
    val += 1;
  }
  return val;
}

function meetsRequirement(hero, loc) {
  const req = loc.requirement;
  if (req.or) {
    return req.or.some(r => effectiveStat(hero, r.stat, loc) >= r.min);
  }
  return effectiveStat(hero, req.stat, loc) >= req.min;
}

function requirementText(loc) {
  const req = loc.requirement;
  if (req.or) return req.or.map(r => `${r.stat} ${r.min}`).join(' of ');
  return `${req.stat} ${req.min}`;
}

// ============================================================
// Actions
// ============================================================
function canMove(hero) {
  return !hero.actedThisTurn && !hero.traveling;
}

function doMove(heroId, cityId) {
  const hero = heroState(heroId);
  if (!canMove(hero)) return;
  if (cityId === hero.location) return;
  // determine travel time: from Amsterdam use table, otherwise mirror (return trip)
  let turns;
  if (hero.location === 'amsterdam') {
    turns = TRAVEL_TIMES[heroId][cityId];
  } else if (cityId === 'amsterdam') {
    turns = TRAVEL_TIMES[heroId][hero.location];
  } else {
    // city-to-city: sum (via HQ conceptually)
    turns = TRAVEL_TIMES[heroId][hero.location] + TRAVEL_TIMES[heroId][cityId];
  }
  hero.traveling = { to: cityId, turnsLeft: turns, from: hero.location };
  hero.location = null;          // in transit
  hero.actedThisTurn = true;
  hero.mudApplied = {};
  log(`${heroDef(heroId).name} reist naar ${state.locations[cityId].name} (${turns} beurt${turns===1?'':'en'}).`);
}

function canAnalyze(hero) {
  if (hero.actedThisTurn || hero.traveling) return false;
  // Gloeidraad at HQ: always allowed (Data Hack)
  if (hero.id === 'gloeidraad' && hero.location === 'amsterdam') {
    return Object.values(state.locations).some(l => !l.analyzed);
  }
  // Any hero on a non-HQ, non-analyzed location
  if (hero.location && hero.location !== 'amsterdam') {
    return !state.locations[hero.location].analyzed;
  }
  return false;
}

function doAnalyze(heroId) {
  const hero = heroState(heroId);
  if (!canAnalyze(hero)) return;
  if (hero.id === 'gloeidraad' && hero.location === 'amsterdam') {
    Object.values(state.locations).forEach(l => l.analyzed = true);
    log(`Gloeidraad gebruikt DATA HACK — alle steden geanalyseerd!`);
  } else {
    const loc = state.locations[hero.location];
    loc.analyzed = true;
    log(`${heroDef(heroId).name} analyseert ${loc.name}. Vereiste: ${requirementText(loc)}.`);
  }
  hero.actedThisTurn = true;
}

function canIntervene(hero) {
  if (hero.actedThisTurn || hero.traveling || !hero.location) return false;
  if (state.phase === 2 && hero.location === 'amsterdam') return true; // boss fight
  const loc = state.locations[hero.location];
  if (!loc || loc.saved || loc.flooded) return false;
  if (!loc.analyzed) return false;
  return true;
}

function doIntervene(heroId) {
  const hero = heroState(heroId);
  if (!canIntervene(hero)) return;

  // Boss fight
  if (state.phase === 2 && hero.location === 'amsterdam') {
    const heroesInAms = state.heroes
      .filter(h => !h.traveling && h.location === 'amsterdam')
      .map(h => heroDef(h.id));
    const totalIN = heroesInAms.reduce((s, d) => s + d.IN, 0);
    log(`${heroDef(heroId).name} leidt de aanval op STORMVLOED — gecombineerde IN: ${totalIN} / ${state.boss.requiredIN}.`);
    hero.actedThisTurn = true;
    if (totalIN >= state.boss.requiredIN) {
      log(`STORMVLOED VERSLAGEN! Nederland is gered!`);
      state.score += 50;
      endGame(true);
    } else {
      log(`Niet genoeg intelligentie om Stormvloed te verslaan. Verzamel meer helden in Amsterdam!`);
    }
    return;
  }

  const loc = state.locations[hero.location];
  hero.actedThisTurn = true;
  if (meetsRequirement(hero, loc)) {
    loc.saved = true;
    state.score += 20;
    log(`${heroDef(heroId).name} GRIJPT IN bij ${loc.name} — GERED! (+20)`);
    checkPhaseTransition();
  } else {
    log(`${heroDef(heroId).name} faalt de ingreep in ${loc.name}. Vereist: ${requirementText(loc)}.`);
  }
}

function canMitigate(hero) {
  if (hero.actedThisTurn || hero.traveling) return false;
  return hero.id === 'polder_parel' && hero.location === 'amsterdam' && state.mitigationTurns === 0;
}

function doMitigate(heroId) {
  const hero = heroState(heroId);
  if (!canMitigate(hero)) return;
  state.mitigationTurns = 2;
  hero.actedThisTurn = true;
  log(`Polder Parel gebruikt LAND RECLAMATION — waterstijging gepauzeerd voor 2 beurten!`);
}

// ============================================================
// Turn loop
// ============================================================
function endTurn() {
  if (state.gameOver) return;

  // 1. Decrease travel timers
  state.heroes.forEach(h => {
    if (h.traveling) {
      h.traveling.turnsLeft -= 1;
      if (h.traveling.turnsLeft <= 0) {
        h.location = h.traveling.to;
        log(`${heroDef(h.id).name} komt aan in ${state.locations[h.location]?.name || 'Amsterdam'}.`);
        h.traveling = null;
      }
    }
  });

  // 2. Water rises (if not mitigated)
  const mitigated = state.mitigationTurns > 0;
  Object.values(state.locations).forEach(loc => {
    if (loc.saved || loc.flooded) return;
    if (!mitigated) {
      loc.waterLevel = Math.min(3, loc.waterLevel + 1);
      // Mud penalty: any hero traveling TO this city, first time water>=1
      if (loc.waterLevel >= 1) {
        state.heroes.forEach(h => {
          if (h.traveling && h.traveling.to === loc.id && !h.mudApplied[loc.id]) {
            h.traveling.turnsLeft += 1;
            h.mudApplied[loc.id] = true;
            log(`MUD! ${heroDef(h.id).name}'s reis naar ${loc.name} vertraagd (+1 beurt).`);
          }
        });
      }
      if (loc.waterLevel >= 3) {
        loc.flooded = true;
        state.score -= 10;
        log(`${loc.name} is OVERSTROOMD! (-10)`);
      }
    }
  });

  // 3. Mitigation timer
  if (state.mitigationTurns > 0) {
    state.mitigationTurns -= 1;
    if (state.mitigationTurns === 0) log(`Land Reclamation is uitgewerkt.`);
  }

  // 4. Advance turn
  state.turn += 1;

  // 5. Auto-flood after turn 3 for unsaved cities
  if (state.turn > 3 && state.phase === 1) {
    Object.values(state.locations).forEach(loc => {
      if (loc.id === 'amsterdam') return; // HQ handled via boss phase
      if (!loc.saved && !loc.flooded) {
        loc.flooded = true;
        loc.waterLevel = 3;
        state.score -= 10;
        log(`Tijd is op! ${loc.name} is OVERSTROOMD! (-10)`);
      }
    });
  }

  // 6. Reset actions
  state.heroes.forEach(h => h.actedThisTurn = false);

  // 7. Boss scaling
  if (state.phase === 2 && state.boss) {
    if (state.turn > 4) {
      state.boss.requiredIN = 15 + (state.turn - 4);
    }
  }

  checkPhaseTransition();
  checkLoss();
  render();
}

function checkPhaseTransition() {
  if (state.phase !== 1) return;
  const dh = state.locations.den_helder;
  const re = state.locations.renesse;
  const dhDone = dh.saved || dh.flooded;
  const reDone = re.saved || re.flooded;
  if (dhDone && reDone) {
    // Need at least one saved city to trigger boss; otherwise total loss
    if (dh.saved || re.saved) {
      state.phase = 2;
      state.boss = { requiredIN: state.turn > 4 ? 15 + (state.turn - 4) : 15 };
      log(`FASE 2: STORMVLOED verschijnt in Amsterdam! Vereist gecombineerde IN ${state.boss.requiredIN}.`);
    } else {
      log(`Alle steden verloren. Nederland valt.`);
      endGame(false);
    }
  }
}

function checkLoss() {
  if (state.gameOver) return;
  if (state.locations.amsterdam.flooded) {
    log(`Amsterdam is gevallen. Missie mislukt.`);
    endGame(false);
    return;
  }
  if (state.score <= 0) {
    log(`Score uitgeput. Missie mislukt.`);
    endGame(false);
  }
}

function endGame(victory) {
  state.gameOver = true;
  render();
  showEndScreen(victory);
}

// ============================================================
// Rendering
// ============================================================
function render() {
  renderBriefing();
  renderTurnBox();
  renderMap();
  renderHand();
  renderLog();
}

function renderBriefing() {
  document.getElementById('briefing-text').textContent = MISSION1_BRIEFING;
  const phaseEl = document.getElementById('phase-indicator');
  if (state.phase === 1) {
    phaseEl.textContent = '» FASE 1: DE VLOEDGOLF';
  } else if (state.phase === 2) {
    phaseEl.textContent = `» FASE 2: STORMVLOED (IN ≥ ${state.boss.requiredIN})`;
  }
}

function renderTurnBox() {
  document.getElementById('turn-number').textContent = state.turn;
  document.getElementById('score-number').textContent = state.score;
}

function renderMap() {
  const layer = document.getElementById('locations-layer');
  layer.innerHTML = '';

  Object.values(state.locations).forEach(loc => {
    const pin = document.createElement('div');
    pin.className = 'loc-pin';
    if (loc.id === 'amsterdam') pin.classList.add('hq');
    if (loc.saved) pin.classList.add('saved');
    if (loc.flooded) pin.classList.add('flooded');
    pin.style.left = loc.x + '%';
    pin.style.top = loc.y + '%';

    const heroesHere = state.heroes
      .filter(h => !h.traveling && h.location === loc.id)
      .map(h => `<span class="hero-token ${heroDef(h.id).color}" title="${heroDef(h.id).name}"></span>`)
      .join('');

    let statusText = '';
    if (loc.saved) statusText = 'GERED';
    else if (loc.flooded) statusText = 'VERLOREN';
    else if (loc.analyzed) statusText = requirementText(loc);
    else statusText = '???';

    pin.innerHTML = `
      <div class="pin-marker"></div>
      <div class="pin-label">${loc.name}${loc.subtitle ? ` <span class="pin-sub">(${loc.subtitle})</span>` : ''}</div>
      <div class="water-dial">
        <div class="seg ${loc.waterLevel >= 1 ? 'on-1' : ''}"></div>
        <div class="seg ${loc.waterLevel >= 2 ? 'on-2' : ''}"></div>
        <div class="seg ${loc.waterLevel >= 3 ? 'on-3' : ''}"></div>
      </div>
      <div class="pin-label" style="font-size:10px;margin-top:2px">${statusText}</div>
      <div class="tokens-on-loc">${heroesHere}</div>
    `;
    layer.appendChild(pin);
  });

  // Traveling heroes floating in ocean
  const traveling = state.heroes.filter(h => h.traveling);
  if (traveling.length) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:4%;top:48%;background:#fff8e1;border:2px solid #1a0f05;padding:4px 6px;font-size:10px;box-shadow:2px 2px 0 #1a0f05;max-width:90px;';
    box.innerHTML = '<b style="font-family:Bangers;letter-spacing:1px">ONDERWEG</b><br>' +
      traveling.map(h => `${heroDef(h.id).name}<br><span style="font-size:9px">→ ${state.locations[h.traveling.to].name} (${h.traveling.turnsLeft})</span>`).join('<br>');
    layer.appendChild(box);
  }

  // Boss banner
  if (state.phase === 2 && state.boss) {
    const banner = document.createElement('div');
    banner.className = 'boss-banner';
    banner.textContent = `⚡ STORMVLOED • IN ${state.boss.requiredIN} ⚡`;
    layer.appendChild(banner);
  }
}

function renderHand() {
  const hand = document.getElementById('hand');
  hand.innerHTML = '';
  state.heroes.forEach(h => {
    const def = heroDef(h.id);
    const card = document.createElement('div');
    card.className = `hero-card color-${def.color}`;
    if (h.actedThisTurn) card.classList.add('acted');
    if (h.traveling) card.classList.add('traveling');

    let statusFlag = '';
    if (h.traveling) statusFlag = `<div class="status-flag">REIST ${h.traveling.turnsLeft}</div>`;
    else if (h.actedThisTurn) statusFlag = `<div class="status-flag">KLAAR</div>`;

    card.innerHTML = `
      ${statusFlag}
      <div class="card-header">${def.name}</div>
      <div class="card-portrait" style="background-image:url('${def.portrait}')">
        <div class="no-img">${def.name.charAt(0)}</div>
      </div>
      <div class="card-stats">
        <div class="stat"><span class="stat-label">KR</span><span class="stat-val">${def.KR}</span></div>
        <div class="stat"><span class="stat-label">IN</span><span class="stat-val">${def.IN}</span></div>
        <div class="stat"><span class="stat-label">SN</span><span class="stat-val">${def.SN}</span></div>
      </div>
      <div class="card-footer"><b>${def.power.toUpperCase()}</b><br>${def.powerDesc}</div>
    `;
    // Hide "no-img" placeholder if image loads
    const portrait = card.querySelector('.card-portrait');
    const img = new Image();
    img.onload = () => portrait.querySelector('.no-img').style.display = 'none';
    img.src = def.portrait;

    card.addEventListener('click', () => {
      if (state.gameOver) return;
      if (h.traveling || h.actedThisTurn) return;
      openHeroMenu(h.id);
    });
    hand.appendChild(card);
  });
}

function renderLog() {
  const list = document.getElementById('log-list');
  list.innerHTML = state.log.slice(0, 8).map(m => `<li>${m}</li>`).join('');
}

// ============================================================
// Action menu
// ============================================================
function openHeroMenu(heroId) {
  const hero = heroState(heroId);
  const def = heroDef(heroId);
  const root = document.getElementById('modal-root');
  root.classList.add('active');

  const menu = document.createElement('div');
  menu.className = 'action-menu';

  const locName = hero.location ? state.locations[hero.location].name : 'onderweg';
  menu.innerHTML = `
    <button class="close-x" id="close-menu">✕</button>
    <h3>${def.name.toUpperCase()}<br><span style="font-size:11px;font-family:'Special Elite';letter-spacing:0">Locatie: ${locName}</span></h3>
    <div id="menu-body"></div>
  `;
  root.innerHTML = '';
  root.appendChild(menu);
  document.getElementById('close-menu').onclick = closeMenu;
  root.onclick = (e) => { if (e.target === root) closeMenu(); };

  renderMenuBody(heroId);
}

function renderMenuBody(heroId) {
  const hero = heroState(heroId);
  const body = document.getElementById('menu-body');
  body.innerHTML = '';

  const addBtn = (label, sub, enabled, onClick, reason) => {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.innerHTML = `${label}<span class="sub">${enabled ? sub : reason}</span>`;
    btn.disabled = !enabled;
    if (enabled) btn.onclick = onClick;
    body.appendChild(btn);
  };

  // MOVE
  const movePossible = canMove(hero);
  addBtn('VERPLAATSEN', 'Reis naar een andere stad',
    movePossible,
    () => showCityPicker(heroId),
    'Niet beschikbaar');

  // ANALYZE
  const analyzePossible = canAnalyze(hero);
  let analyzeSub = 'Onthul stadsvereiste';
  if (hero.id === 'gloeidraad' && hero.location === 'amsterdam') analyzeSub = 'DATA HACK: analyseer alle steden';
  addBtn('ANALYSEREN', analyzeSub,
    analyzePossible,
    () => { doAnalyze(heroId); closeMenu(); render(); },
    hero.location === 'amsterdam' && hero.id !== 'gloeidraad'
      ? 'Alleen Gloeidraad kan vanuit HQ analyseren'
      : (hero.location && state.locations[hero.location]?.analyzed ? 'Al geanalyseerd' : 'Niet beschikbaar'));

  // INTERVENE
  const intervenePossible = canIntervene(hero);
  let interveneSub = 'Gebruik stats om stad te redden';
  let interveneReason = 'Niet op locatie of niet geanalyseerd';
  if (state.phase === 2 && hero.location === 'amsterdam') interveneSub = 'Val STORMVLOED aan (gecombineerde IN)';
  if (hero.location && hero.location !== 'amsterdam') {
    const loc = state.locations[hero.location];
    if (loc.saved) interveneReason = 'Stad al gered';
    else if (loc.flooded) interveneReason = 'Stad verloren';
    else if (!loc.analyzed) interveneReason = 'Eerst analyseren';
  }
  addBtn('INGRIJPEN', interveneSub,
    intervenePossible,
    () => { doIntervene(heroId); closeMenu(); render(); },
    interveneReason);

  // MITIGATE
  const mitPossible = canMitigate(hero);
  let mitReason = 'Alleen Polder Parel in Amsterdam';
  if (hero.id === 'polder_parel' && state.mitigationTurns > 0) mitReason = 'Al actief';
  addBtn('MITIGEREN', 'Pauzeer waterstijging (2 beurten)',
    mitPossible,
    () => { doMitigate(heroId); closeMenu(); render(); },
    mitReason);
}

function showCityPicker(heroId) {
  const hero = heroState(heroId);
  const body = document.getElementById('menu-body');
  body.innerHTML = '<div class="city-picker"></div>';
  const picker = body.querySelector('.city-picker');

  const backBtn = document.createElement('button');
  backBtn.className = 'menu-btn';
  backBtn.innerHTML = '← TERUG';
  backBtn.style.background = '#c9c5b0';
  backBtn.onclick = () => renderMenuBody(heroId);
  picker.appendChild(backBtn);

  Object.values(state.locations).forEach(loc => {
    if (loc.id === hero.location) return;
    let turns;
    if (hero.location === 'amsterdam') turns = TRAVEL_TIMES[heroId][loc.id];
    else if (loc.id === 'amsterdam') turns = TRAVEL_TIMES[heroId][hero.location];
    else turns = TRAVEL_TIMES[heroId][hero.location] + TRAVEL_TIMES[heroId][loc.id];

    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.innerHTML = `→ ${loc.name.toUpperCase()}<span class="sub">${turns} beurt${turns===1?'':'en'} reizen</span>`;
    btn.onclick = () => { doMove(heroId, loc.id); closeMenu(); render(); };
    picker.appendChild(btn);
  });
}

function closeMenu() {
  const root = document.getElementById('modal-root');
  root.classList.remove('active');
  root.innerHTML = '';
}

// ============================================================
// End screens
// ============================================================
function showEndScreen(victory) {
  const root = document.getElementById('modal-root');
  root.classList.add('active');
  const savedCities = Object.values(state.locations).filter(l => l.saved).length;
  const lostCities = Object.values(state.locations).filter(l => l.flooded).length;

  root.innerHTML = `
    <div class="endscreen ${victory ? 'victory' : 'defeat'}">
      <div class="panel">
        <h1>${victory ? 'OVERWINNING!' : 'MISSIE MISLUKT'}</h1>
        <p>${victory
          ? 'Nederland is gered! Stormvloed is verslagen door de gecombineerde kracht van jouw helden.'
          : 'Het water heeft gewonnen. Nederland zal deze dag lang herinneren.'}</p>
        <div class="final-score">EINDSCORE: ${state.score}</div>
        <p>Steden gered: ${savedCities} · Steden verloren: ${lostCities} · Beurten: ${state.turn}</p>
        <button onclick="location.reload()">NOG EEN KEER</button>
      </div>
    </div>
  `;
}

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  log('Missie 1 gestart. Brief je team en red Nederland!');
  document.getElementById('end-turn-btn').onclick = endTurn;
  render();
});
