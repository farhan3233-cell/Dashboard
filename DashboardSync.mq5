//+------------------------------------------------------------------+
//|                                                DashboardSync.mq5 |
//|        Full sync: auto-detect broker, account type & telemetry   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property version   "2.31"

input string ApiUrl              = "https://dashboard-ten-delta-53.vercel.app/api/update_account"; // Live Vercel API URL
input string AccountNickname     = "";   // Custom Account Nickname / Holder Name (Optional)
input int    SyncIntervalSeconds  = 5;   // Sync interval in seconds
input int    MaxHistoryDeals      = 300; // Max recent history deals to send

//+------------------------------------------------------------------+
void OnInit() {
    Print("DashboardSync v2.31 initialized. Syncing to: ", ApiUrl);
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
        case ORDER_TYPE_SELL_STOP:  typeStr = "Sell Stop";  break;
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
    long type = HistoryDealGetInteger(ticket, DEAL_TYPE);

    // Skip non-trade deals (deposits, balance, credit)
    if (type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) return "";

    string sym    = HistoryDealGetString(ticket, DEAL_SYMBOL);
    long   entry  = HistoryDealGetInteger(ticket, DEAL_ENTRY);
    double lots   = HistoryDealGetDouble(ticket, DEAL_VOLUME);
    double price  = HistoryDealGetDouble(ticket, DEAL_PRICE);
    double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
    double swap   = HistoryDealGetDouble(ticket, DEAL_SWAP);
    double comm   = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
    long   time   = HistoryDealGetInteger(ticket, DEAL_TIME);

    string typeStr  = (type == DEAL_TYPE_BUY) ? "Buy" : "Sell";
    string entryStr = (entry == DEAL_ENTRY_IN) ? "in" : (entry == DEAL_ENTRY_OUT) ? "out" : (entry == DEAL_ENTRY_INOUT) ? "inout" : "out_by";
    double totalPnl = profit + swap + comm;

    return StringFormat(
        "{\"ticket\":%d,\"symbol\":\"%s\",\"type\":\"%s\",\"entry\":\"%s\",\"lots\":%.2f,\"price\":%.5f,\"profit\":%.2f,\"swap\":%.2f,\"commission\":%.2f,\"totalPnl\":%.2f,\"time\":%d}",
        ticket, sym, typeStr, entryStr, lots, price, profit, swap, comm, totalPnl, time
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

    // Auto-detect broker & account type natively from MT5
    string broker = AccountInfoString(ACCOUNT_COMPANY);
    if (broker == "") broker = AccountInfoString(ACCOUNT_SERVER);
    if (broker == "") broker = "MetaTrader 5";

    ENUM_ACCOUNT_TRADE_MODE tradeMode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
    string accType = (tradeMode == ACCOUNT_TRADE_MODE_REAL) ? "Real" : "Demo";

    double balance     = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity      = AccountInfoDouble(ACCOUNT_EQUITY);
    double marginUsed  = AccountInfoDouble(ACCOUNT_MARGIN);
    double marginFree  = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
    double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
    int    openPos     = PositionsTotal();
    int    totalOrders = OrdersTotal();

    // ── Calculate REAL trading P/L from ALL history ──
    MqlDateTime dtNow;
    TimeToStruct(TimeCurrent(), dtNow);
    dtNow.hour = 0; dtNow.min = 0; dtNow.sec = 0;
    datetime todayStart = StructToTime(dtNow);

    double plToday   = 0.0;
    double plAllTime = 0.0;

    // Load ALL history deals from beginning of account time (0 to now)
    HistorySelect(0, TimeCurrent());
    int totalDealsAll = HistoryDealsTotal();

    int countBuySell = 0;
    int countOutLegs = 0;
    int countTodayDeals = 0;

    for (int i = 0; i < totalDealsAll; i++) {
        ulong dTicket = HistoryDealGetTicket(i);
        if (dTicket == 0) continue;

        long   dType   = HistoryDealGetInteger(dTicket, DEAL_TYPE);
        long   dEntry  = HistoryDealGetInteger(dTicket, DEAL_ENTRY);
        long   dTime   = HistoryDealGetInteger(dTicket, DEAL_TIME);
        double dProfit = HistoryDealGetDouble(dTicket, DEAL_PROFIT);
        double dSwap   = HistoryDealGetDouble(dTicket, DEAL_SWAP);
        double dComm   = HistoryDealGetDouble(dTicket, DEAL_COMMISSION);

        if (dType == DEAL_TYPE_BUY || dType == DEAL_TYPE_SELL) {
            countBuySell++;
            // Count closing legs or any deal with profit/loss/swap/commission
            if (dEntry == DEAL_ENTRY_OUT || dEntry == DEAL_ENTRY_OUT_BY || dEntry == DEAL_ENTRY_INOUT || dProfit != 0 || dSwap != 0 || dComm != 0) {
                countOutLegs++;
                double dealTotal = dProfit + dSwap + dComm;
                plAllTime += dealTotal;
                if ((datetime)dTime >= todayStart) {
                    plToday += dealTotal;
                    countTodayDeals++;
                }
            }
        }
    }

    Print(StringFormat("[DIAG] Account %s | TotalDeals: %d | BuySell: %d | ClosingDeals: %d | TodayDeals: %d | P/L Today: $%.2f | P/L AllTime: $%.2f",
        accountId, totalDealsAll, countBuySell, countOutLegs, countTodayDeals, plToday, plAllTime));

    double plTodayPct   = balance > 0 ? (plToday   / balance) * 100.0 : 0.0;
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
    for (int i = 0; i < totalOrders; i++) {
        ulong ticket = OrderGetTicket(i);
        if (ticket > 0) {
            if (i > 0) ordersJson += ",";
            ordersJson += OrderToJson(i);
        }
    }
    ordersJson += "]";

    // ── Build history array (recent deals, up to MaxHistoryDeals) ──
    string historyJson = "[";
    datetime histFrom = TimeCurrent() - 90 * 24 * 3600; // Last 90 days
    HistorySelect(histFrom, TimeCurrent());
    int totalDeals = HistoryDealsTotal();
    int startIdx = MathMax(0, totalDeals - MaxHistoryDeals);
    bool firstDeal = true;
    for (int i = startIdx; i < totalDeals; i++) {
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
        Print("Synced '", holderName, "' (", accountId, ") | P/L Today: $", DoubleToString(plToday, 2),
              " | P/L All-Time: $", DoubleToString(plAllTime, 2),
              " | Open Positions: ", openPos);
    } else {
        int err = GetLastError();
        if (err == 4014) {
            Print("Sync failed (Error 4014). Add '", ApiUrl, "' in MT5: Tools -> Options -> Expert Advisors -> Allow WebRequest!");
        } else {
            Print("Sync failed. Error: ", err, " | HTTP: ", res);
        }
    }
}
