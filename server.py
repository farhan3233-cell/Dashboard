import os
import json
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# ── In-memory data stores ──────────────────────────────────────────────────────
accounts_db   = {}  # { account_id: { ...account_info... } }
positions_db  = {}  # { account_id: [ ...positions... ] }
orders_db     = {}  # { account_id: [ ...orders... ] }
history_db    = {}  # { account_id: [ ...deals... ] }
alerts_db     = []  # [ ...alerts... ]

DB_FILE = 'db.json'
UPSTASH_URL = os.environ.get('UPSTASH_REDIS_REST_URL')
UPSTASH_TOKEN = os.environ.get('UPSTASH_REDIS_REST_TOKEN')

# ── Data Persistence Functions ────────────────────────────────────────────────
def load_db():
    global accounts_db, positions_db, orders_db, history_db, alerts_db
    if UPSTASH_URL and UPSTASH_TOKEN:
        try:
            res = requests.get(
                f"{UPSTASH_URL}/get/dashboard_db",
                headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
                timeout=4
            )
            if res.status_code == 200:
                body = res.json()
                raw_result = body.get('result')
                if raw_result:
                    data = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
                    accounts_db = data.get('accounts', {})
                    positions_db = data.get('positions', {})
                    orders_db = data.get('orders', {})
                    history_db = data.get('history', {})
                    alerts_db = data.get('alerts', [])
                    print(f"[INIT] Loaded {len(accounts_db)} account(s) from Upstash Redis Cloud")
        except Exception as e:
            print(f"[WARNING] Failed to load from Upstash: {e}")
    elif os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                accounts_db = data.get('accounts', {})
                positions_db = data.get('positions', {})
                orders_db = data.get('orders', {})
                history_db = data.get('history', {})
                alerts_db = data.get('alerts', [])
                print(f"[INIT] Loaded {len(accounts_db)} persisted account(s) from {DB_FILE}")
        except Exception as e:
            print(f"[WARNING] Failed to load {DB_FILE}: {e}")

def save_db():
    data = {
        'accounts': accounts_db,
        'positions': positions_db,
        'orders': orders_db,
        'history': history_db,
        'alerts': alerts_db
    }
    if UPSTASH_URL and UPSTASH_TOKEN:
        try:
            requests.post(
                f"{UPSTASH_URL}/set/dashboard_db",
                headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
                json=json.dumps(data),
                timeout=4
            )
        except Exception as e:
            print(f"[ERROR] Failed to save to Upstash Redis: {e}")
    else:
        try:
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[ERROR] Failed to save {DB_FILE}: {e}")

# Load existing state on server launch
load_db()

# ── Static file serving ────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# ── EA → Server: Master update endpoint ───────────────────────────────────────
@app.route('/api/update_account', methods=['POST'])
def update_account():
    try:
        data = request.get_json(force=True, silent=True)
        if data is None:
            raw_bytes = request.get_data()
            if raw_bytes:
                # Strip trailing null bytes and whitespace from MQL5 WebRequest buffer
                clean_str = raw_bytes.decode('utf-8', errors='ignore').rstrip('\x00\r\n\t ')
                if clean_str:
                    data = json.loads(clean_str)

        if not data or 'account' not in data:
            print("Invalid data received:", request.get_data(as_text=True))
            return jsonify({"status": "error", "message": "'account' field is required."}), 400

        account_id = str(data['account'])

        # Store account-level info (everything except sub-lists)
        account_info = {k: v for k, v in data.items() if k not in ('positions', 'orders', 'history')}
        if account_id in accounts_db:
            accounts_db[account_id].update(account_info)
        else:
            accounts_db[account_id] = account_info

        # Store positions
        if 'positions' in data and isinstance(data['positions'], list):
            positions_db[account_id] = data['positions']

        # Store orders
        if 'orders' in data and isinstance(data['orders'], list):
            orders_db[account_id] = data['orders']

        # Store history / deals
        if 'history' in data and isinstance(data['history'], list):
            history_db[account_id] = data['history']

        save_db()

        print(f"[OK] Synced account {account_id} | Broker: '{data.get('broker')}' | Positions: {len(data.get('positions',[]))} | Orders: {len(data.get('orders',[]))}")
        return jsonify({"status": "success", "message": f"Account {account_id} updated."}), 200

    except Exception as e:
        print(f"[ERROR] update_account: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# ── GET endpoints ──────────────────────────────────────────────────────────────
@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    return jsonify({"status": "success", "data": list(accounts_db.values())}), 200

@app.route('/api/positions', methods=['GET'])
def get_positions():
    all_positions = []
    for acc_id, positions in positions_db.items():
        for p in positions:
            p['_account'] = acc_id
            p['_broker']  = accounts_db.get(acc_id, {}).get('broker', '')
            all_positions.append(p)
    return jsonify({"status": "success", "data": all_positions}), 200

@app.route('/api/orders', methods=['GET'])
def get_orders():
    all_orders = []
    for acc_id, orders in orders_db.items():
        for o in orders:
            o['_account'] = acc_id
            o['_broker']  = accounts_db.get(acc_id, {}).get('broker', '')
            all_orders.append(o)
    return jsonify({"status": "success", "data": all_orders}), 200

@app.route('/api/history', methods=['GET'])
def get_history():
    all_history = []
    for acc_id, deals in history_db.items():
        for d in deals:
            d['_account'] = acc_id
            d['_broker']  = accounts_db.get(acc_id, {}).get('broker', '')
            all_history.append(d)
    return jsonify({"status": "success", "data": all_history}), 200

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    return jsonify({"status": "success", "data": alerts_db}), 200

@app.route('/api/summary', methods=['GET'])
def get_summary():
    """Aggregated summary for dashboard cards"""
    accounts = list(accounts_db.values())
    total_balance    = sum(float(a.get('balance', 0)) for a in accounts)
    total_equity     = sum(float(a.get('equity', 0)) for a in accounts)
    total_pl_today   = sum(float(a.get('plToday', 0)) for a in accounts)
    total_pl_alltime = sum(float(a.get('plAllTime', 0)) for a in accounts)
    total_positions  = sum(int(a.get('openPositions', 0)) for a in accounts)
    active_count     = sum(1 for a in accounts if a.get('status','Active').lower() == 'active')
    return jsonify({
        "status": "success",
        "data": {
            "totalAccounts":   len(accounts),
            "activeAccounts":  active_count,
            "inactiveAccounts": len(accounts) - active_count,
            "totalBalance":    total_balance,
            "totalEquity":     total_equity,
            "totalPlToday":    total_pl_today,
            "totalPlAllTime":  total_pl_alltime,
            "openPositions":   total_positions,
        }
    }), 200

if __name__ == '__main__':
    print("=" * 50)
    print(" TradeMonitor Dashboard Server")
    print("=" * 50)
    print(" Local URL :  http://127.0.0.1:5000")
    print(" EA Endpoint: POST /api/update_account")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
