import os
import json
import time
import requests
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(BASE_DIR, 'index.html')):
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({
        "status": "error",
        "message": str(e),
        "traceback": traceback.format_exc(),
        "path": request.path
    }), 500

# ── In-memory data stores ──────────────────────────────────────────────────────
accounts_db   = {}  # { account_id: { ...account_info... } }
positions_db  = {}  # { account_id: [ ...positions... ] }
orders_db     = {}  # { account_id: [ ...orders... ] }
history_db    = {}  # { account_id: [ ...deals... ] }
alerts_db     = []  # [ ...alerts... ]
deleted_accounts_db = set()  # set of explicitly deleted account_id strings

DB_FILE = '/tmp/db.json' if (os.environ.get('VERCEL') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME')) else 'db.json'
UPSTASH_URL = os.environ.get('UPSTASH_REDIS_REST_URL')
UPSTASH_TOKEN = os.environ.get('UPSTASH_REDIS_REST_TOKEN')

def load_db():
    global accounts_db, positions_db, orders_db, history_db, alerts_db, deleted_accounts_db
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
                    deleted_accounts_db = set(data.get('deleted_accounts', []))
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
                deleted_accounts_db = set(data.get('deleted_accounts', []))
        except Exception as e:
            print(f"[WARNING] Failed to load {DB_FILE}: {e}")

def save_db():
    data = {
        'accounts': accounts_db,
        'positions': positions_db,
        'orders': orders_db,
        'history': history_db,
        'alerts': alerts_db,
        'deleted_accounts': list(deleted_accounts_db)
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

try:
    load_db()
except Exception as _err:
    pass

def recalc_account_pnl(account_id):
    """Fallback: Calculate plToday and plAllTime from history deals if not provided by EA"""
    import datetime as _dt
    try:
        all_deals = history_db.get(account_id, [])
        today_date_str = _dt.datetime.utcnow().strftime('%Y-%m-%d')

        pl_today_calc = 0.0
        pl_alltime_calc = 0.0
        has_closed_deals = False

        for deal in all_deals:
            deal_type = str(deal.get('type', '')).lower()
            if deal_type not in ('buy', 'sell'):
                continue
            
            entry = str(deal.get('entry', '')).lower()
            if entry in ('in', '0'):
                continue
            
            deal_pnl = float(deal.get('totalPnl', 0) or 0)
            if deal_pnl == 0.0:
                deal_pnl = (float(deal.get('profit', 0) or 0) +
                            float(deal.get('swap', 0) or 0) +
                            float(deal.get('commission', 0) or 0))
            
            pl_alltime_calc += deal_pnl
            has_closed_deals = True
            
            deal_time = int(deal.get('time', 0))
            if deal_time > 0:
                deal_date_str = _dt.datetime.utcfromtimestamp(deal_time).strftime('%Y-%m-%d')
                if deal_date_str == today_date_str:
                    pl_today_calc += deal_pnl

        if account_id in accounts_db and has_closed_deals:
            balance_val = float(accounts_db[account_id].get('balance', 1) or 1)
            accounts_db[account_id]['plToday']      = round(pl_today_calc, 2)
            accounts_db[account_id]['plTodayPct']   = round((pl_today_calc / balance_val) * 100, 4) if balance_val > 0 else 0.0
            accounts_db[account_id]['plAllTime']     = round(pl_alltime_calc, 2)
            accounts_db[account_id]['plAllTimePct']  = round((pl_alltime_calc / balance_val) * 100, 4) if balance_val > 0 else 0.0
    except Exception as calc_err:
        print(f"[WARNING] P&L recalc failed for {account_id}: {calc_err}")

@app.route('/api/update_account', methods=['POST', 'OPTIONS'])
@app.route('/update_account', methods=['POST', 'OPTIONS'])
def update_account():
    try:
        load_db()
        data = request.get_json(force=True, silent=True)
        if data is None:
            raw_bytes = request.get_data()
            if raw_bytes:
                clean_str = raw_bytes.decode('utf-8', errors='ignore').rstrip('\x00\r\n\t ')
                if clean_str:
                    data = json.loads(clean_str)

        if not data or 'account' not in data:
            return jsonify({"status": "error", "message": "'account' field is required."}), 400

        account_id = str(data['account'])

        # Ignore incoming EA telemetry if account was deleted from dashboard
        if account_id in deleted_accounts_db:
            return jsonify({"status": "ignored", "message": f"Account {account_id} has been deleted."}), 200

        account_info = {k: v for k, v in data.items() if k not in ('positions', 'orders', 'history')}
        account_info['lastSeen'] = int(time.time())

        incoming_holder = str(account_info.get('holderName', '')).strip()
        existing_holder = str(accounts_db.get(account_id, {}).get('holderName', '')).strip()

        if existing_holder and not existing_holder.startswith('Account #') and (not incoming_holder or incoming_holder.startswith('Account #')):
            account_info['holderName'] = existing_holder
        elif not incoming_holder:
            account_info['holderName'] = existing_holder or f"Account #{account_id}"

        # Clean numeric types for EA P&L metrics
        if 'plToday' in account_info:
            account_info['plToday'] = round(float(account_info['plToday'] or 0), 2)
        if 'plAllTime' in account_info:
            account_info['plAllTime'] = round(float(account_info['plAllTime'] or 0), 2)
        if 'plTodayPct' in account_info:
            account_info['plTodayPct'] = float(account_info['plTodayPct'] or 0)
        if 'plAllTimePct' in account_info:
            account_info['plAllTimePct'] = float(account_info['plAllTimePct'] or 0)

        if account_id in accounts_db:
            accounts_db[account_id].update(account_info)
        else:
            accounts_db[account_id] = account_info

        if 'positions' in data and isinstance(data['positions'], list):
            positions_db[account_id] = data['positions']
        if 'orders' in data and isinstance(data['orders'], list):
            orders_db[account_id] = data['orders']
        if 'history' in data and isinstance(data['history'], list):
            history_db[account_id] = data['history']

        # Fallback recalc only if EA sent 0 or missing
        if float(accounts_db[account_id].get('plAllTime', 0)) == 0.0:
            recalc_account_pnl(account_id)

        save_db()
        return jsonify({"status": "success", "message": f"Account {account_id} updated."}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/accounts', methods=['GET'])
@app.route('/accounts', methods=['GET'])
def get_accounts():
    load_db()
    now = int(time.time())
    filtered_accounts = []
    for k, a in accounts_db.items():
        if str(k) in ('888888', '999999') or str(k) in deleted_accounts_db:
            continue
        acc = dict(a)
        last_seen = int(acc.get('lastSeen', 0))
        diff = now - last_seen if last_seen > 0 else 999999

        if diff <= 25:
            acc['status'] = 'Active'
        elif diff <= 65:
            acc['status'] = 'Processing'
        else:
            acc['status'] = 'Disconnected'

        filtered_accounts.append(acc)

    # Pure deterministic sorting by Account ID string so account row positions NEVER change when disconnected
    filtered_accounts.sort(key=lambda x: str(x.get('account', '')))
    return jsonify({"status": "success", "data": filtered_accounts}), 200

@app.route('/api/positions', methods=['GET'])
@app.route('/positions', methods=['GET'])
def get_positions():
    load_db()
    all_positions = []
    for acc_id, positions in positions_db.items():
        if str(acc_id) in deleted_accounts_db:
            continue
        for p in positions:
            p['_account'] = acc_id
            p['_broker']  = accounts_db.get(acc_id, {}).get('broker', '')
            all_positions.append(p)
    return jsonify({"status": "success", "data": all_positions}), 200

@app.route('/api/orders', methods=['GET'])
@app.route('/orders', methods=['GET'])
def get_orders():
    load_db()
    all_orders = []
    for acc_id, orders in orders_db.items():
        if str(acc_id) in deleted_accounts_db:
            continue
        for o in orders:
            o['_account'] = acc_id
            o['_broker']  = accounts_db.get(acc_id, {}).get('broker', '')
            all_orders.append(o)
    return jsonify({"status": "success", "data": all_orders}), 200

@app.route('/api/history', methods=['GET'])
@app.route('/history', methods=['GET'])
def get_history():
    load_db()
    all_history = []
    for acc_id, deals in history_db.items():
        if str(acc_id) in deleted_accounts_db:
            continue
        for d in deals:
            d['_account'] = acc_id
            d['_broker']  = accounts_db.get(acc_id, {}).get('broker', '')
            all_history.append(d)
    return jsonify({"status": "success", "data": all_history}), 200

@app.route('/api/alerts', methods=['GET'])
@app.route('/alerts', methods=['GET'])
def get_alerts():
    load_db()
    return jsonify({"status": "success", "data": alerts_db}), 200

@app.route('/api/summary', methods=['GET'])
@app.route('/summary', methods=['GET'])
def get_summary():
    load_db()
    accounts = [a for k, a in accounts_db.items() if str(k) not in deleted_accounts_db]
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

@app.route('/api/delete_account/<account_id>', methods=['DELETE', 'POST', 'GET'])
@app.route('/delete_account/<account_id>', methods=['DELETE', 'POST', 'GET'])
def delete_account(account_id):
    load_db()
    acc_str = str(account_id)
    accounts_db.pop(acc_str, None)
    positions_db.pop(acc_str, None)
    orders_db.pop(acc_str, None)
    history_db.pop(acc_str, None)
    deleted_accounts_db.add(acc_str)
    save_db()
    return jsonify({"status": "success", "message": f"Account {acc_str} deleted"}), 200

@app.route('/api/set_nickname', methods=['POST', 'OPTIONS'])
@app.route('/set_nickname', methods=['POST', 'OPTIONS'])
def set_nickname():
    load_db()
    data = request.get_json(force=True, silent=True) or {}
    acc_id = str(data.get('account', ''))
    nickname = str(data.get('holderName', '')).strip()
    if acc_id and nickname:
        if acc_id not in accounts_db:
            accounts_db[acc_id] = {'account': acc_id}
        accounts_db[acc_id]['holderName'] = nickname
        save_db()
        return jsonify({"status": "success", "message": f"Updated nickname for {acc_id}"}), 200
    return jsonify({"status": "error", "message": "Account not found or invalid name"}), 400

# ── Static file serving & SPA fallback ─────────────────────────────────────────
@app.route('/', methods=['GET'])
@app.route('/index.html', methods=['GET'])
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>', methods=['GET'])
def serve_static(filename):
    file_path = os.path.join(BASE_DIR, filename)
    if os.path.exists(file_path):
        return send_from_directory(BASE_DIR, filename)
    return send_from_directory(BASE_DIR, 'index.html')
