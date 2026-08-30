// ── Formatting Helpers ──────────────────────────────────────────
function fmt$(v) {
    const neg = v < 0, a = Math.abs(v);
    const s = "$" + a.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    return neg ? "-"+s : "+"+s;
}
function fmtPlain$(v) {
    const neg = v < 0, a = Math.abs(v);
    const s = "$" + a.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    return neg ? "-"+s : s;
}
function fmtPct(v) {
    const neg = v < 0, a = Math.abs(v);
    return (neg ? "-" : "+") + a.toFixed(2) + "%";
}
function fmtPctPlain(v) {
    return parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+"%";
}
function todayLabel() {
    return new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function tsToDate(ts) {
    if(!ts) return "—";
    const d = new Date(parseInt(ts)*1000);
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
function getBrokerStyle(name) {
    const n = (name||"").toLowerCase();
    if(n.includes('ftmo'))       return {color:"#0D2C54",icon:"ph-diamond"};
    if(n.includes('exness'))     return {color:"#D97706",icon:"ph-currency-dollar-simple"};
    if(n.includes('fund'))       return {color:"#4F46E5",icon:"ph-chart-polar"};
    if(n.includes('vantage'))    return {color:"#E11D48",icon:"ph-vignette"};
    if(n.includes('ic market'))  return {color:"#2563EB",icon:"ph-chart-bar"};
    if(n.includes('startrader')) return {color:"#1E88E5",icon:"ph-star"};
    if(n.includes('pepperstone'))return {color:"#0284C7",icon:"ph-shield-check"};
    if(n.includes('metaquotes')) return {color:"#3B82F6",icon:"ph-cpu"};
    if(n.includes('deriv'))      return {color:"#EF4444",icon:"ph-globe"};
    if(n.includes('eightcap'))   return {color:"#10B981",icon:"ph-number-eight"};
    if(n.includes('xm'))         return {color:"#DC2626",icon:"ph-lightning"};
    if(n.includes('roboforex'))  return {color:"#2563EB",icon:"ph-robot"};
    return {color:"#3B82F6",icon:"ph-buildings"};
}
function emptyRow(cols, msg, sub) {
    return `<tr><td colspan="${cols}" class="empty-state"><i class="ph ph-plugs-connected"></i><p>${msg}</p><small>${sub||""}</small></td></tr>`;
}
