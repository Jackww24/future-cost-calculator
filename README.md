# PokerSense

A Texas Hold'em poker odds calculator that uses Monte Carlo simulation to give you real-time equity estimates.

## Features

- **Monte Carlo simulation** — 5,000 trials per calculation for fast, accurate results
- **Win / Tie / Loss %** with animated equity bars
- **Current hand strength** — shows your best hand from known cards
- **Draw detection** — flush draws, open-ended straight draws, gutshots
- **Fun recommendation** — context-aware advice based on your equity
- **Visual card picker** — tap any slot to pick a card from a full 52-card grid
- **Duplicate prevention** — already-selected cards are greyed out in the picker
- **Mobile-friendly** — responsive dark poker-table design

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the app

```bash
python app.py
```

### 3. Open in your browser

```
http://127.0.0.1:5000
```

---

## How to Use

1. **Pick your 2 hole cards** — tap each slot, then choose a rank + suit from the grid
2. **Optionally add community cards** — Flop (3), Turn (1), River (1)
3. **Set number of players** (2–9, including yourself)
4. **Hit Calculate Odds**
5. Read your equity, hand strength, draws, and recommendation

---

## File Structure

```
pokersense/
├── app.py                  # Flask server + poker logic
├── templates/
│   └── index.html          # Single-page UI
├── static/
│   ├── style.css           # Dark poker-table styling
│   └── script.js           # Card picker + API call
├── requirements.txt
└── README.md
```

---

## How the Simulation Works

1. A full 52-card deck is built.
2. All known cards (hole + community) are removed from the deck.
3. For each of 5,000 trials:
   - The board is randomly completed to 5 community cards.
   - Each opponent is randomly dealt 2 hole cards.
   - Every player's best 5-card hand is evaluated from their 2 hole cards + the 5 board cards.
   - The result (win / tie / loss) is recorded.
4. Percentages are calculated from the trial counts.

Hand evaluation uses standard poker hand rankings, with full comparison tiebreakers (kicker logic, pair rank, etc.).

---

## Recommendation Key

| Equity     | Message                                   |
|------------|-------------------------------------------|
| 65%+       | Apply pressure 😈                          |
| 45–65%     | Playable, but don't get reckless          |
| 25–45%     | You're alive, but don't fall in love      |
| Under 25%  | Fold and pretend it was discipline        |

Draw alerts are appended to the recommendation when a flush or straight draw is detected.
