// ── Card constants ────────────────────────────────────────────────────────────

const RANK_LABELS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
                      '10':10,'J':11,'Q':12,'K':13,'A':14 };

const SUITS = [
  { key: 's', symbol: '♠', color: 'black' },
  { key: 'h', symbol: '♥', color: 'red'   },
  { key: 'd', symbol: '♦', color: 'red'   },
  { key: 'c', symbol: '♣', color: 'black' },
];

const COMMUNITY_LABELS = ['Flop 1','Flop 2','Flop 3','Turn','River'];

// ── App state ─────────────────────────────────────────────────────────────────

const state = {
  hole:       [null, null],
  community:  [null, null, null, null, null],
  numPlayers: 4,
  activeSlot: null,   // { group: 'hole'|'community', index: number }
  mode:       'basic',
  position:   null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardKey(card) {
  return `${card.rank}-${card.suit}`;
}

function getUsedKeys(excludeGroup = null, excludeIndex = null) {
  const keys = new Set();
  ['hole', 'community'].forEach(group => {
    state[group].forEach((card, i) => {
      if (card && !(group === excludeGroup && i === excludeIndex)) {
        keys.add(cardKey(card));
      }
    });
  });
  return keys;
}

function suitInfo(key) {
  return SUITS.find(s => s.key === key);
}

function rankLabel(rankValue) {
  return RANK_LABELS.find(r => RANK_VALUES[r] === rankValue);
}

// ── Slot rendering ────────────────────────────────────────────────────────────

function renderSlot(group, index) {
  const slot = document.querySelector(`.card-slot[data-group="${group}"][data-index="${index}"]`);
  const card = state[group][index];

  if (card) {
    const suit = suitInfo(card.suit);
    const rank = rankLabel(card.rank);
    slot.classList.add('filled');
    slot.innerHTML = `
      <div class="card-face ${suit.color}">
        <span class="cf-rank">${rank}</span>
        <span class="cf-suit">${suit.symbol}</span>
      </div>`;
  } else {
    slot.classList.remove('filled');
    const label = group === 'hole' ? `Card ${index + 1}` : COMMUNITY_LABELS[index];
    slot.innerHTML = `<span class="slot-label">${label}</span>`;
  }

  // Update pre-flop assessment whenever a hole card changes
  if (group === 'hole') updateAssessment();
}

// ── Pre-flop hand assessment ──────────────────────────────────────────────────

function assessHoleCards(c1, c2) {
  const hi     = Math.max(c1.rank, c2.rank);
  const lo     = Math.min(c1.rank, c2.rank);
  const suited = c1.suit === c2.suit;
  const gap    = hi - lo;
  const rl     = r => rankLabel(r);

  // Hand name in poker shorthand (e.g. "AKs", "JTo", "99")
  const name = (gap === 0)
    ? `${rl(hi)}${rl(hi)}`
    : suited ? `${rl(hi)}${rl(lo)}s` : `${rl(hi)}${rl(lo)}o`;

  // Pocket pairs
  if (gap === 0) {
    if (hi >= 10) return { name, tier: 'premium', advice: 'Premium pair — raise and apply pressure 🔥' };
    if (hi >= 7)  return { name, tier: 'good',    advice: 'Mid pair — solid starting hand, watch for overcards' };
                  return { name, tier: 'ok',      advice: 'Small pair — best played cheap and set-mining' };
  }

  // Ace-high hands
  if (hi === 14) {
    if (lo === 13) return { name, tier: suited ? 'premium' : 'good',
      advice: suited ? 'Suited AK — as good as it gets. Play it big 🚀' : 'Big Slick — strong, but it misses the board a lot' };
    if (lo >= 11)  return { name, tier: suited ? 'good' : 'ok',
      advice: suited ? `${name} — great hand, strong draw potential` : `${name} — playable, but watch out for dominated aces` };
    if (lo >= 9)   return { name, tier: suited ? 'ok' : 'warn',
      advice: suited ? `${name} — decent suited ace, good implied odds` : `Weak ace — danger zone if another ace hits` };
                   return { name, tier: suited ? 'ok' : 'fold',
      advice: suited ? `${name} — ace-rag suited, proceed carefully` : `Ace-rag offsuit — lean toward folding, especially out of position` };
  }

  // King-high hands
  if (hi === 13) {
    if (lo >= 12) return { name, tier: suited ? 'good' : 'ok',
      advice: suited ? `${name} — strong broadway, good for straights and flushes` : `${name} — playable in position, be careful vs. aces` };
    if (lo >= 10) return { name, tier: suited ? 'ok' : 'warn',
      advice: suited ? `${name} — decent suited king` : `${name} — marginal, position matters a lot here` };
  }

  // Queen-high hands
  if (hi === 12 && lo >= 11) return { name, tier: suited ? 'ok' : 'warn',
    advice: suited ? `${name} — playable broadway hand` : `${name} — can play in position, fold to heavy action` };

  // Suited connectors (consecutive)
  if (suited && gap === 1 && lo >= 5) return { name, tier: 'ok',
    advice: `${name} — suited connector, great implied odds 🎯` };

  // Suited one-gappers
  if (suited && gap === 2 && lo >= 6) return { name, tier: 'ok',
    advice: `${name} — suited one-gapper, solid draw potential` };

  // Other high suited cards
  if (suited && lo >= 10) return { name, tier: 'ok',
    advice: `${name} — playable suited broadway cards` };

  // Offsuit connectors with high cards
  if (!suited && gap === 1 && lo >= 9) return { name, tier: 'warn',
    advice: `${name} — connected but offsuit, position is key` };

  // Everything else
  return { name, tier: 'fold',
    advice: `${name} — weak hand, fold and wait for better spots 🗑️` };
}

function updateAssessment() {
  const [c1, c2] = state.hole;
  const el = document.getElementById('hole-assessment');

  if (!c1 || !c2) {
    el.classList.add('hidden');
    return;
  }

  const { name, tier, advice } = assessHoleCards(c1, c2);
  document.getElementById('ha-name').textContent   = name;
  document.getElementById('ha-advice').textContent = advice;
  el.dataset.tier = tier;
  el.classList.remove('hidden');
}

// ── Mode & position ───────────────────────────────────────────────────────────

function setMode(mode) {
  state.mode = mode;
  document.getElementById('btn-basic').classList.toggle('active', mode === 'basic');
  document.getElementById('btn-advanced').classList.toggle('active', mode === 'advanced');
  document.getElementById('advanced-panel').classList.toggle('hidden', mode === 'basic');
  if (mode === 'basic') {
    document.getElementById('adv-results').classList.add('hidden');
  }
}

function setPosition(pos) {
  state.position = (state.position === pos) ? null : pos;  // tap again to deselect
  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pos === state.position);
  });
}

// ── Clear all selections ──────────────────────────────────────────────────────

function clearAll() {
  state.hole      = [null, null];
  state.community = [null, null, null, null, null];
  state.hole.forEach((_, i)      => renderSlot('hole', i));
  state.community.forEach((_, i) => renderSlot('community', i));
  hideResults();
  hideError();
  // assessment hides itself via updateAssessment() called from renderSlot
}

// ── Card picker ───────────────────────────────────────────────────────────────

function openPicker(group, index) {
  state.activeSlot = { group, index };

  const title = group === 'hole' ? `Hole Card ${index + 1}` : COMMUNITY_LABELS[index];
  document.getElementById('picker-title').textContent = title;

  buildPickerGrid();
  document.getElementById('picker-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePicker() {
  document.getElementById('picker-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  state.activeSlot = null;
}

function buildPickerGrid() {
  const { group, index } = state.activeSlot;
  const used = getUsedKeys(group, index);
  const grid = document.getElementById('picker-grid');
  grid.innerHTML = '';

  SUITS.forEach(suit => {
    RANK_LABELS.forEach(rank => {
      const rv       = RANK_VALUES[rank];
      const key      = `${rv}-${suit.key}`;
      const disabled = used.has(key);

      const btn = document.createElement('button');
      btn.className = `picker-card ${suit.color}${disabled ? ' disabled' : ''}`;
      btn.disabled  = disabled;
      btn.innerHTML = `<span class="pk-rank">${rank}</span><span class="pk-suit">${suit.symbol}</span>`;

      if (!disabled) btn.addEventListener('click', () => selectCard(rv, suit.key));
      grid.appendChild(btn);
    });
  });
}

function selectCard(rank, suit) {
  if (!state.activeSlot) return;
  const { group, index } = state.activeSlot;
  state[group][index] = { rank, suit };
  renderSlot(group, index);

  // Hole cards: advance Card 1 → Card 2, then close
  if (group === 'hole' && index === 0) {
    state.activeSlot = { group: 'hole', index: 1 };
    document.getElementById('picker-title').textContent = 'Hole Card 2';
    buildPickerGrid();
    return;
  }

  // Flop: advance Flop 1 → Flop 2 → Flop 3, then close
  if (group === 'community' && index < 2) {
    state.activeSlot = { group: 'community', index: index + 1 };
    document.getElementById('picker-title').textContent = COMMUNITY_LABELS[index + 1];
    buildPickerGrid();
    return;
  }

  closePicker();

  // Auto-calculate after the 3rd, 4th, or 5th community card
  if (group === 'community' && index >= 2 && state.hole[0] && state.hole[1]) {
    calculate();
  }
}

function clearSlot() {
  if (!state.activeSlot) return;
  const { group, index } = state.activeSlot;
  state[group][index] = null;
  renderSlot(group, index);
  closePicker();
}

// ── Player count ──────────────────────────────────────────────────────────────

function adjustPlayers(delta) {
  state.numPlayers = Math.max(2, Math.min(9, state.numPlayers + delta));
  document.getElementById('player-count').textContent = state.numPlayers;
  document.getElementById('btn-dec').disabled = state.numPlayers <= 2;
  document.getElementById('btn-inc').disabled = state.numPlayers >= 9;
}

// ── Calculate ─────────────────────────────────────────────────────────────────

async function calculate() {
  if (!state.hole[0] || !state.hole[1]) {
    showError('Please select both hole cards before calculating.');
    return;
  }

  const communityCards = state.community.filter(Boolean);
  hideError();
  hideResults();

  const btn = document.getElementById('calc-btn');
  btn.disabled    = true;
  btn.textContent = 'Simulating…';

  try {
    const res = await fetch('/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hole_cards:      state.hole,
        community_cards: communityCards,
        num_players:     state.numPlayers,
      }),
    });

    const data = await res.json();
    if (!res.ok) { showError(data.error || 'Something went wrong.'); return; }
    showResults(data);

  } catch {
    showError('Could not reach the server. Is Flask running?');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Calculate Odds';
  }
}

// ── Results display ───────────────────────────────────────────────────────────

function showResults(data) {
  document.getElementById('win-pct').textContent  = `${data.win_pct}%`;
  document.getElementById('tie-pct').textContent  = `${data.tie_pct}%`;
  document.getElementById('loss-pct').textContent = `${data.loss_pct}%`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('win-bar').style.width  = `${data.win_pct}%`;
      document.getElementById('tie-bar').style.width  = `${data.tie_pct}%`;
      document.getElementById('loss-bar').style.width = `${data.loss_pct}%`;
    });
  });

  document.getElementById('hand-name').textContent  = data.hand_strength || 'High Card';
  document.getElementById('draws-text').textContent = data.draws.length ? data.draws.join(', ') : 'None';
  document.getElementById('rec-text').textContent   = data.recommendation;

  if (state.mode === 'advanced') showAdvancedResults(data.win_pct);

  const el = document.getElementById('results');
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showAdvancedResults(winPct) {
  const pot   = parseFloat(document.getElementById('inp-pot').value)   || 0;
  const bet   = parseFloat(document.getElementById('inp-bet').value)   || 0;
  const stack = parseFloat(document.getElementById('inp-stack').value) || 0;

  const chips = [];

  // ── Pot odds & call decision ──
  const potDecisionEl = document.getElementById('pot-decision');
  if (bet > 0 && pot > 0) {
    const potOddsPct   = (bet / (pot + bet)) * 100;
    const edge         = winPct - potOddsPct;

    chips.push({ label: 'Pot Odds',       value: `${potOddsPct.toFixed(1)}%` });
    chips.push({ label: 'Equity Needed',  value: `${potOddsPct.toFixed(1)}%` });

    let tier, msg;
    if (edge > 10) {
      tier = 'good';
      msg  = `Your ${winPct}% equity comfortably beats the ${potOddsPct.toFixed(1)}% needed — clear call.`;
    } else if (edge > 0) {
      tier = 'ok';
      msg  = `Marginally +EV by ${edge.toFixed(1)}% — factor in implied odds and position before calling.`;
    } else if (edge > -10) {
      tier = 'warn';
      msg  = `Slightly -EV — you're ${Math.abs(edge).toFixed(1)}% short. You'd need strong implied odds to justify a call.`;
    } else {
      tier = 'fold';
      msg  = `Clear fold — you're ${Math.abs(edge).toFixed(1)}% short of the equity needed. Don't chase.`;
    }

    potDecisionEl.textContent = msg;
    potDecisionEl.className   = `pot-decision tier-${tier}`;
    potDecisionEl.classList.remove('hidden');
  } else {
    potDecisionEl.classList.add('hidden');
  }

  // ── SPR ──
  if (stack > 0 && pot > 0) {
    const spr    = stack / pot;
    const sprTag = spr < 2 ? 'commit territory' : spr < 5 ? 'medium — think before stacking off' : 'deep — implied odds matter';
    chips.push({ label: 'SPR', value: `${spr.toFixed(1)}  (${sprTag})` });
  }

  // ── Render chips ──
  document.getElementById('adv-chips').innerHTML = chips.map(c => `
    <div class="info-chip">
      <span class="chip-label">${c.label}</span>
      <span class="chip-value">${c.value}</span>
    </div>`).join('');

  // ── Position note ──
  const posNoteEl = document.getElementById('pos-note');
  const posNotes  = {
    'Straddle': '⚠️ You straddled — there\'s extra dead money in the pot. You\'ll act first post-flop.',
    'UTG':  'UTG — first to act pre-flop. Tighten your range considerably; you have no info on anyone.',
    'MP':   'Middle position — several players left to act. Be selective; play strong hands and suited connectors.',
    'CO':   'Cutoff — near-position advantage. Good spot to open wide and steal blinds.',
    'BTN':  '🎯 Button — best seat at the table. You act last every street post-flop. Play wider and apply maximum pressure.',
    'SB':   'Small Blind — you\'ll be out of position against everyone post-flop. Tighten your 3-bet range.',
    'BB':   'Big Blind — you have a price discount to call pre-flop, but you play out of position. Defend selectively.',
  };

  if (state.position && posNotes[state.position]) {
    posNoteEl.textContent = posNotes[state.position];
    posNoteEl.classList.remove('hidden');
  } else {
    posNoteEl.classList.add('hidden');
  }

  // Show the advanced results block if there's anything to display
  const hasContent = chips.length > 0 || state.position;
  document.getElementById('adv-results').classList.toggle('hidden', !hasContent);
}

function hideResults() {
  document.getElementById('results').classList.add('hidden');
  ['win-bar','tie-bar','loss-bar'].forEach(id => {
    document.getElementById(id).style.width = '0';
  });
}

function showError(msg) {
  const box = document.getElementById('error-box');
  box.textContent = msg;
  box.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-box').classList.add('hidden');
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  adjustPlayers(0);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePicker(); });
});
