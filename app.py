import random
from collections import Counter
from itertools import combinations
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# Card constants
RANKS = list(range(2, 15))   # 2–14, where 14 = Ace
SUITS = ['s', 'h', 'd', 'c']

HAND_NAMES = {
    8: 'Straight Flush',
    7: 'Four of a Kind',
    6: 'Full House',
    5: 'Flush',
    4: 'Straight',
    3: 'Three of a Kind',
    2: 'Two Pair',
    1: 'One Pair',
    0: 'High Card',
}


# ── Hand evaluation ───────────────────────────────────────────────────────────

def score_five_card_hand(hand):
    """Return a comparable tuple for a 5-card hand (higher = better hand)."""
    ranks = sorted([c[0] for c in hand], reverse=True)
    suits = [c[1] for c in hand]
    is_flush = len(set(suits)) == 1

    unique_ranks = sorted(set(ranks))
    is_straight = False
    straight_high = 0
    if len(unique_ranks) == 5:
        if unique_ranks[4] - unique_ranks[0] == 4:
            is_straight = True
            straight_high = unique_ranks[4]
        elif set(unique_ranks) == {14, 2, 3, 4, 5}:  # wheel A-2-3-4-5
            is_straight = True
            straight_high = 5

    rank_counts = Counter(ranks)
    # Sort groups: highest count first, then highest rank first
    groups = sorted(rank_counts.items(), key=lambda x: (x[1], x[0]), reverse=True)
    sorted_ranks = [r for r, c in groups for _ in range(c)]
    counts = [c for _, c in groups]

    if is_straight and is_flush:
        return (8, straight_high)
    if counts[0] == 4:
        return (7,) + tuple(sorted_ranks)
    if counts[0] == 3 and len(counts) > 1 and counts[1] == 2:
        return (6,) + tuple(sorted_ranks)
    if is_flush:
        return (5,) + tuple(ranks)
    if is_straight:
        return (4, straight_high)
    if counts[0] == 3:
        return (3,) + tuple(sorted_ranks)
    if counts[0] == 2 and len(counts) > 1 and counts[1] == 2:
        return (2,) + tuple(sorted_ranks)
    if counts[0] == 2:
        return (1,) + tuple(sorted_ranks)
    return (0,) + tuple(ranks)


def evaluate_best_hand(cards):
    """Best 5-card score from 2–7 cards."""
    if len(cards) >= 5:
        return max(score_five_card_hand(combo) for combo in combinations(cards, 5))
    return _evaluate_partial(cards)


def _evaluate_partial(cards):
    """Score when fewer than 5 cards are known (pre-flop / partial board)."""
    ranks = sorted([c[0] for c in cards], reverse=True)
    rank_counts = Counter(ranks)
    groups = sorted(rank_counts.items(), key=lambda x: (x[1], x[0]), reverse=True)
    sorted_ranks = [r for r, c in groups for _ in range(c)]
    counts = [c for _, c in groups]
    if counts[0] == 4:
        return (7,) + tuple(sorted_ranks)
    if counts[0] == 3 and len(counts) > 1 and counts[1] == 2:
        return (6,) + tuple(sorted_ranks)
    if counts[0] == 3:
        return (3,) + tuple(sorted_ranks)
    if counts[0] == 2 and len(counts) > 1 and counts[1] == 2:
        return (2,) + tuple(sorted_ranks)
    if counts[0] == 2:
        return (1,) + tuple(sorted_ranks)
    return (0,) + tuple(ranks)


def get_hand_name(cards):
    score = evaluate_best_hand(cards)
    return HAND_NAMES.get(score[0], 'High Card')


# ── Draw detection ────────────────────────────────────────────────────────────

def detect_draws(hole_cards, community_cards):
    """Identify flush / straight draws when the board isn't yet complete."""
    if len(community_cards) >= 5:
        return []

    all_cards = hole_cards + community_cards
    draws = []

    suits = [c[1] for c in all_cards]
    if max(Counter(suits).values()) >= 4:
        draws.append("flush draw")

    unique_ranks = sorted(set(c[0] for c in all_cards))
    # Include Ace as 1 to catch low-end straights
    candidates = ([1] + unique_ranks) if 14 in unique_ranks else unique_ranks

    found_oesd = found_gutshot = False
    if len(candidates) >= 4:
        for combo in combinations(candidates, 4):
            span = combo[3] - combo[0]
            if span == 3:
                found_oesd = True
            elif span == 4:
                found_gutshot = True

    if found_oesd:
        draws.append("open-ended straight draw")
    elif found_gutshot:
        draws.append("gutshot straight draw")

    return draws


# ── Monte Carlo simulation ────────────────────────────────────────────────────

def run_simulation(hole_cards, community_cards, num_players, num_simulations=5000):
    """Return (win_rate, tie_rate, loss_rate) via Monte Carlo."""
    full_deck = [(r, s) for r in RANKS for s in SUITS]
    known_set = set(map(tuple, hole_cards + community_cards))
    deck = [c for c in full_deck if c not in known_set]

    hole_t = [tuple(c) for c in hole_cards]
    comm_t = [tuple(c) for c in community_cards]

    board_needed = 5 - len(community_cards)
    opp_needed = (num_players - 1) * 2
    total_needed = board_needed + opp_needed

    wins = ties = losses = 0

    for _ in range(num_simulations):
        sample = random.sample(deck, total_needed)
        board = comm_t + sample[:board_needed]
        opp_samples = sample[board_needed:]

        my_score = evaluate_best_hand(hole_t + board)

        best_opp = None
        for i in range(num_players - 1):
            opp_score = evaluate_best_hand(list(opp_samples[i*2:(i+1)*2]) + board)
            if best_opp is None or opp_score > best_opp:
                best_opp = opp_score

        if my_score > best_opp:
            wins += 1
        elif my_score == best_opp:
            ties += 1
        else:
            losses += 1

    n = num_simulations
    return wins / n, ties / n, losses / n


# ── Recommendation copy ───────────────────────────────────────────────────────

def get_recommendation(win_pct, draws):
    draw_note = f" You have a {draws[0]}!" if draws else ""

    if win_pct >= 0.65:
        base = "Apply pressure 😈"
    elif win_pct >= 0.45:
        base = "Playable, but don't get reckless"
    elif win_pct >= 0.25:
        base = "You're alive, but don't fall in love"
    else:
        base = "Fold and pretend it was discipline"

    return base + draw_note


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('future_cost.html')


@app.route('/pokersense')
def pokersense():
    return render_template('index.html')


@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON.'}), 400

        hole_cards = data.get('hole_cards', [])
        community_cards = data.get('community_cards', [])
        num_players = int(data.get('num_players', 2))

        if len(hole_cards) != 2:
            return jsonify({'error': 'Select exactly 2 hole cards.'}), 400
        if not (0 <= len(community_cards) <= 5):
            return jsonify({'error': 'Community cards must be 0–5.'}), 400
        if not (2 <= num_players <= 9):
            return jsonify({'error': 'Players must be between 2 and 9.'}), 400

        # Convert dicts to (rank, suit) tuples
        hole = [(int(c['rank']), c['suit']) for c in hole_cards]
        community = [(int(c['rank']), c['suit']) for c in community_cards]

        all_known = hole + community
        if len(all_known) != len(set(all_known)):
            return jsonify({'error': 'Duplicate cards detected.'}), 400

        deck_remaining = 52 - len(all_known)
        cards_needed = (5 - len(community)) + (num_players - 1) * 2
        if cards_needed > deck_remaining:
            return jsonify({
                'error': f'Not enough cards in the deck for {num_players} players.'
            }), 400

        win_pct, tie_pct, loss_pct = run_simulation(hole, community, num_players)
        hand_name = get_hand_name(all_known)
        draws = detect_draws(hole, community)
        recommendation = get_recommendation(win_pct, draws)

        return jsonify({
            'win_pct': round(win_pct * 100, 1),
            'tie_pct': round(tie_pct * 100, 1),
            'loss_pct': round(loss_pct * 100, 1),
            'hand_strength': hand_name,
            'draws': draws,
            'recommendation': recommendation,
        })

    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=True, port=port)
