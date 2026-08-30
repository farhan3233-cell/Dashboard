//+------------------------------------------------------------------+
//|                                                DashboardSync.mq5 |
//|        Full sync: auto-detect broker, account type & telemetry   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property version   "2.10"

input string ApiUrl              = "https://dashboard-ten-delta-53.vercel.app/api/update_account"; // Live Vercel API URL
input string AccountNickname     = "";  // Custom Account Nickname / Holder Name (Optional)
input int    SyncIntervalSeconds  = 5;   // Sync interval in seconds
input int    MaxHistoryDeals      = 50;  // Max recent history deals to send

//+------------------------------------------------------------------+
void OnInit() {
    Print("DashboardSync v2.1 initialized. Syncing to: ", ApiUrl);
    EventSetTimer(SyncIntervalSeconds);
}

void OnDeinit(const int reason) {
    EventKillTimer();
}

void OnTimer() {
    SendFullTelemetry();
}

//+------------------------------------------------------------------+
//| Build JSON string for a single position                          |
//+------------------------------------------------------------------+
string PositionToJson(int idx) {
    string sym      = PositionGetSymbol(idx);
    long   type     = PositionGetInteger(POSITION_TYPE);
    double lots     = PositionGetDouble(POSITION_VOLUME);
    double openPx   = PositionGetDouble(POSITION_PRICE_OPEN);
    double curPx    = PositionGetDouble(POSITION_PRICE_CURRENT);
    double sl       = PositionGetDouble(POSITION_SL);
    double tp       = PositionGetDouble(POSITION_TP);
    double profit   = PositionGetDouble(POSITION_PROFIT);
    double swap     = PositionGetDouble(POSITION_SWAP);
    long   ticket   = PositionGetInteger(POSITION_TICKET);
    string typeStr  = (type == POSITION_TYPE_BUY) ? "Buy" : "Sell";
    return StringFormat(
        "{\"ticket\":%d,\"symbol\":\"%s\",\"type\":\"%s\",\"lots\":%.2f,\"openPrice\":%.5f,\"currentPrice\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f,\"swap\":%.2f}",
        ticket, sym, typeStr, lots, openPx, curPx, sl, tp, profit, swap
    );
}

//+------------------------------------------------------------------+
//| Build JSON string for a single pending order                     |
//+------------------------------------------------------------------+
string OrderToJson(int idx) {
    ulong  ticket  = OrderGetTicket(idx);
    string sym     = OrderGetString(ORDER_SYMBOL);
    long   type    = OrderGetInteger(ORDER_TYPE);
    double lots    = OrderGetDouble(ORDER_VOLUME_CURRENT);
    double price   = OrderGetDouble(ORDER_PRICE_OPEN);
    double sl      = OrderGetDouble(ORDER_SL);
    double tp      = OrderGetDouble(ORDER_TP);
    string typeStr;
    switch((int)type) {
        case ORDER_TYPE_BUY_LIMIT:   typeStr = "Buy Limit";  break;
        case ORDER_TYPE_SELL_LIMIT:  typeStr = "Sell Limit"; break;
        case ORDER_TYPE_BUY_STOP:    typeStr = "Buy Stop";   break;
        case ORDER_TYPE_SELL_STOP:   typeStr = "Sell Stop";  break;
        default:                     typeStr = "Unknown";    break;
    }
    return StringFormat(
        "{\"ticket\":%d,\"symbol\":\"%s\",\"type\":\"%s\",\"lots\":%.2f,\"price\":%.5f,\"sl\":%.5f,\"tp\":%.5f}",
        ticket, sym, typeStr, lots, price, sl, tp
    );
}

//+------------------------------------------------------------------+
//| Build JSON string for a history deal                             |
//+------------------------------------------------------------------+
string DealToJson(ulong ticket) {
    if (!HistoryDealSelect(ticket)) return "";
    string sym    = HistoryDealGetString(ticket, DEAL_SYMBOL);
    long   type   = HistoryDealGetInteger(ticket, DEAL_TYPE);
    double lots   = HistoryDealGetDouble(ticket, DEAL_VOLUME);
    double price  = HistoryDealGetDouble(ticket, DEAL_PRICE);
    double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
    double swap   = HistoryDealGetDouble(ticket, DEAL_SWAP);
    long   time   = HistoryDealGetInteger(ticket, DEAL_TIME);
    string typeStr = (type == DEAL_TYPE_BUY) ? "Buy" : (type == DEAL_TYPE_SELL) ? "Sell" : "Other";
    return StringFormat(
        "{\"ticket\":%d,\"symbol\":\"%s\",\"type\":\"%s\",\"lots\":%.2f,\"price\":%.5f,\"profit\":%.2f,\"swap\":%.2f,\"time\":%d}",
        ticket, sym, typeStr, lots, price, profit, swap, time
    );
}

//+------------------------------------------------------------------+
//| Main telemetry send function                                     |
//+------------------------------------------------------------------+
void SendFullTelemetry() {
    string accountId = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    
    // Auto-detect Account Holder Name / Nickname
    string holderName = AccountNickname;
    if (holderName == "") holderName = AccountInfoString(ACCOUNT_NAME);
    if (holderName == "") holderName = AccountInfoString(ACCOUNT_OWNER);

    // Auto-detect broker & account type natively from MT5
    string broker = AccountInfoString(ACCOUNT_COMPANY);
    if (broker == "") broker = AccountInfoString(ACCOUNT_SERVER);
    if (broker == "") broker = "MetaTrader 5";

    ENUM_ACCOUNT_TRADE_MODE mode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
    string accType = (mode == ACCOUNT_TRADE_MODE_REAL) ? "Real" : "Demo";

    double balance     = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity      = AccountInfoDouble(ACCOUNT_EQUITY);
    double marginUsed  = AccountInfoDouble(ACCOUNT_MARGIN);
    double marginFree  = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
    double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
    double profit      = AccountInfoDouble(ACCOUNT_PROFIT);
    int    openPos     = PositionsTotal();

    double plToday      = profit;
    double plTodayPct   = balance > 0 ? (plToday / balance) * 100.0 : 0.0;
    double plAllTime    = profit;
    double plAllTimePct = balance > 0 ? (plAllTime / balance) * 100.0 : 0.0;

    // ── Build positions array ──────────────────────────────────────
    string positionsJson = "[";
    for (int i = 0; i < PositionsTotal(); i++) {
        if (PositionGetSymbol(i) != "") {
            if (i > 0) positionsJson += ",";
            positionsJson += PositionToJson(i);
        }
    }
    positionsJson += "]";

    // ── Build pending orders array ─────────────────────────────────
    string ordersJson = "[";
    int totalOrders = OrdersTotal();
    for (int i = 0; i < totalOrders; i++) {
        ulong ticket = OrderGetTicket(i);
        if (ticket > 0) {
            if (i > 0) ordersJson += ",";
            ordersJson += OrderToJson(i);
        }
    }
    ordersJson += "]";

    // ── Build history array (last N deals) ─────────────────────────
    string historyJson = "[";
    datetime from = TimeCurrent() - 30 * 24 * 3600;
    HistorySelect(from, TimeCurrent());
    int totalDeals = HistoryDealsTotal();
    int start = MathMax(0, totalDeals - MaxHistoryDeals);
    bool firstDeal = true;
    for (int i = start; i < totalDeals; i++) {
        ulong ticket = HistoryDealGetTicket(i);
        string dealJson = DealToJson(ticket);
        if (dealJson != "") {
            if (!firstDeal) historyJson += ",";
            historyJson += dealJson;
            firstDeal = false;
        }
    }
    historyJson += "]";

    // ── Assemble full JSON payload ─────────────────────────────────
    string json = StringFormat(
        "{\"account\":\"%s\",\"holderName\":\"%s\",\"type\":\"%s\",\"broker\":\"%s\","
        "\"balance\":%.2f,\"equity\":%.2f,"
        "\"plToday\":%.2f,\"plTodayPct\":%.4f,"
        "\"plAllTime\":%.2f,\"plAllTimePct\":%.4f,"
        "\"marginUsed\":%.2f,\"marginFree\":%.2f,\"marginLevel\":%.2f,"
        "\"openPositions\":%d,\"status\":\"Active\","
        "\"positions\":%s,\"orders\":%s,\"history\":%s}",
        accountId, holderName, accType, broker,
        balance, equity,
        plToday, plTodayPct,
        plAllTime, plAllTimePct,
        marginUsed, marginFree, marginLevel,
        openPos,
        positionsJson, ordersJson, historyJson
    );

    // ── Send via WebRequest ────────────────────────────────────────
    char data[];
    StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
    char   result[];
    string resultHeaders;
    string headers = "Content-Type: application/json\r\n";
    int res = WebRequest("POST", ApiUrl, headers, 5000, data, result, resultHeaders);

    if (res == 200 || res == 201) {
        Print("Synced account ", accountId, " (Holder: '", holderName, "', Broker: '", broker, "') | Positions: ", openPos, " | Orders: ", totalOrders);
    } else {
        Print("Sync failed. Error: ", GetLastError(), " | HTTP: ", res);
    }
}
