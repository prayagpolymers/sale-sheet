const CONFIG={
  sales:{id:"1QIpcfgOVCFjcCmgU_DXKn8h7Bfa8rm2q2wB2HneTvKs",sheet:"Sheet1"},
  accounts:{id:"1oHFpXqVDPRF3Vi3WV9MdNcxkHNjgytLPxXUQgM6o1ok",sheets:{
    returns:"SALE RETURN",cn:"CN SAP",dn:"DN SAP",payment:"DEBTOR"
  }},
  gstRate:.18
};

let SALES=[], TXNS=[], PARTY_MAP=new Map(), charts={}, currentRole="ADMIN", selectedUser="";
const $=id=>document.getElementById(id);
const norm=s=>String(s??"").trim().toLowerCase().replace(/\s+/g," ");
const money=n=>"₹"+(Number(n)||0).toLocaleString("en-IN",{maximumFractionDigits:0});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function key(h, words){let a=Object.keys(h); for(const w of words){let x=a.find(k=>norm(k)===norm(w));if(x)return x} for(const w of words){let x=a.find(k=>norm(k).includes(norm(w)));if(x)return x} return null}
function num(v){if(v===null||v===undefined||v==="")return 0;let s=String(v).replace(/,/g,"").replace(/[₹\s]/g,"");let n=parseFloat(s);return isNaN(n)?0:n}
function parseDate(v){if(!v)return null;let s=String(v).trim();let d=new Date(s);if(!isNaN(d))return d;let m=s.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1])}return null}
function iso(d){return d?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10):""}
function monthKey(d){return d?d.toLocaleString("en-IN",{month:"short"})+"-"+String(d.getFullYear()).slice(-2):""}
function fyOf(d){if(!d)return"";let y=d.getFullYear(),m=d.getMonth()+1;return m>=4?`FY-${y}-${String(y+1).slice(-2)}`:`FY-${y-1}-${String(y).slice(-2)}`}
async function csv(sheetId,sheet){const u=`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;const r=await fetch(u);if(!r.ok)throw new Error(`Could not read ${sheet}`);return r.text()}
function csvParse(text){let rows=[],row=[],cell="",q=false;for(let i=0;i<text.length;i++){let c=text[i],n=text[i+1];if(c=='"'&&q&&n=='"'){cell+='"';i++;continue}if(c=='"'){q=!q;continue}if(c==","&&!q){row.push(cell);cell="";continue}if((c=="\n"||c=="\r")&&!q){if(c=="\r"&&n=="\n")i++;row.push(cell);cell="";if(row.some(x=>x.trim()!==''))rows.push(row);row=[];continue}cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}let heads=(rows.shift()||[]).map(x=>x.trim());return rows.map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]??""])) )}
function showLoad(x){$("loading").classList.toggle("hidden",!x)}

function normalizeSales(rows){
  if(!rows.length)return[];
  const h=Object.fromEntries(Object.keys(rows[0]).map(k=>[k,k]));
  const party=key(h,["CUSTOMER","PARTY NAME","PARTY","ACCOUNT NAME"]);
  const date=key(h,["DATE","DOCUMENT DATE"]);
  const amount=key(h,["AMOUNT","SALE AMOUNT","TAXABLE AMOUNT"]);
  const invoice=key(h,["INVOICE NO","INVOICE","DOCUMENT"]);
  const state=key(h,["STATE"]);
  const sh=key(h,["STATE HEAD A","STATE HEAD"]);
  const group=key(h,["GROUP"]);
  const code=key(h,["CODE","ITEM CODE"]);
  const qty=key(h,["QTY","QUANTITY"]);
  const rate=key(h,["SALE RATE","RATE"]);
  const fy=key(h,["FY-2025-26","FY"]);
  const type=key(h,["TYPE"]);
  return rows.map(r=>{let d=parseDate(r[date]);let taxable=num(r[amount]);return{type:"SALE",date:d,party:String(r[party]||"").trim(),doc:String(r[invoice]||"").trim(),taxable,total:taxable*(1+CONFIG.gstRate),state:String(r[state]||"").trim(),sh:String(r[sh]||"").trim(),group:String(r[group]||"").trim(),code:String(r[code]||"").trim(),qty:num(r[qty]),rate:num(r[rate]),fy:String(r[fy]||fyOf(d)).trim()||fyOf(d),raw:r}})
}

function normalizeAcct(rows,type){
  if(!rows.length)return[];
  const h=Object.fromEntries(Object.keys(rows[0]).map(k=>[k,k]));
  const party=key(h,["PARTY ACCOUNT NAME","ACCOUNT NAME","PARTY NAME","ACCOUNT"]);
  const date=key(h,["DOCUMENT DATE","DATE"]);
  const amount=key(h,["TOTAL AMOUNT","AMOUNT","DEBIT AMOUNT"]);
  const doc=key(h,["DOCUMENT","VOUCHER"]);
  const state=key(h,["STATE"]);
  const sh=key(h,["STATE HEAD"]);
  return rows.map(r=>{let d=parseDate(r[date]);return{type,date:d,party:String(r[party]||"").trim(),doc:String(r[doc]||"").trim(),amount:num(r[amount]),state:String(r[state]||"").trim(),sh:String(r[sh]||"").trim(),fy:fyOf(d),raw:r}})
}

async function loadAll(){
  showLoad(true);
  try{
    const [s,ret,cn,dn,pay]=await Promise.all([
      csv(CONFIG.sales.id,CONFIG.sales.sheet),
      csv(CONFIG.accounts.id,CONFIG.accounts.sheets.returns),
      csv(CONFIG.accounts.id,CONFIG.accounts.sheets.cn),
      csv(CONFIG.accounts.id,CONFIG.accounts.sheets.dn),
      csv(CONFIG.accounts.id,CONFIG.accounts.sheets.payment)
    ]);
    SALES=normalizeSales(csvParse(s));
    TXNS=[
      ...SALES,
      ...normalizeAcct(csvParse(dn),"DEBIT NOTE").map(x=>({...x,type:"DEBIT NOTE"})),
      ...normalizeAcct(csvParse(pay),"PAYMENT").map(x=>({...x,type:"PAYMENT"})),
      ...normalizeAcct(csvParse(cn),"CREDIT NOTE").map(x=>({...x,type:"CREDIT NOTE"})),
      ...normalizeAcct(csvParse(ret),"SALES RETURN").map(x=>({...x,type:"SALES RETURN"}))
    ];
    buildPartyMap(); populateFilters(); render();
  }catch(e){alert("Data load error: "+e.message+"\n\nCheck that both Google Sheets are shared as Anyone with the link → Viewer and that tab names match.");console.error(e)}
  finally{showLoad(false)}
}

function buildPartyMap(){
  PARTY_MAP=new Map();
  for(const t of TXNS){let p=norm(t.party);if(!p)continue;if(!PARTY_MAP.has(p))PARTY_MAP.set(p,{name:t.party,states:new Set(),sh:new Set()});if(t.state)PARTY_MAP.get(p).states.add(t.state);if(t.sh)PARTY_MAP.get(p).sh.add(t.sh)}
}
function uniq(a){return [...new Set(a.filter(Boolean))].sort((x,y)=>String(x).localeCompare(String(y)))}
function fillSelect(id,vals,all="ALL"){let el=$(id),cur=el.value;el.innerHTML=`<option value="${all}">All</option>`+uniq(vals).map(v=>`<option>${esc(v)}</option>`).join("");if([...el.options].some(o=>o.value===cur))el.value=cur}
function populateFilters(){
  fillSelect("fyFilter",TXNS.map(x=>x.fy));
  fillSelect("monthFilter",TXNS.map(x=>x.date?monthKey(x.date):""));
  fillSelect("stateHeadFilter",TXNS.map(x=>x.sh));
  fillSelect("stateFilter",TXNS.map(x=>x.state));
  fillSelect("partyFilter",TXNS.map(x=>x.party));
  const users=$("loginUser");users.innerHTML=`<option value="">All / Select</option>`+uniq(TXNS.flatMap(x=>[x.sh,x.party])).map(v=>`<option>${esc(v)}</option>`).join("");
}
function filters(){return{fy:$("fyFilter").value,month:$("monthFilter").value,sh:$("stateHeadFilter").value,state:$("stateFilter").value,party:$("partyFilter").value,from:$("fromDate").value,to:$("toDate").value,search:norm($("searchBox").value)}}
function allowed(t){
  if(currentRole==="PARTY"&&selectedUser&&norm(t.party)!==norm(selectedUser))return false;
  if(currentRole==="STATE_HEAD"&&selectedUser&&norm(t.sh)!==norm(selectedUser))return false;
  return true;
}
function filtered(){
  const f=filters();
  return TXNS.filter(t=>{
    if(!allowed(t))return false;
    if(f.fy!=="ALL"&&t.fy!==f.fy)return false;
    if(f.month!=="ALL"&&monthKey(t.date)!==f.month)return false;
    if(f.sh!=="ALL"&&norm(t.sh)!==norm(f.sh))return false;
    if(f.state!=="ALL"&&norm(t.state)!==norm(f.state))return false;
    if(f.party!=="ALL"&&norm(t.party)!==norm(f.party))return false;
    if(f.from&&iso(t.date)<f.from)return false;
    if(f.to&&iso(t.date)>f.to)return false;
    if(f.search){let z=norm([t.party,t.doc,t.state,t.sh,t.group,t.code,t.type].join(" "));if(!z.includes(f.search))return false}
    return true;
  })
}
function ledgerAmount(t){return t.type==="SALE"?t.total:num(t.amount)}
function signed(t){return ["SALE","DEBIT NOTE"].includes(t.type)?ledgerAmount(t):-ledgerAmount(t)}
function currentMonthTransactions(){let now=new Date(),m=now.getMonth(),y=now.getFullYear();return filtered().filter(t=>t.date&&t.date.getMonth()===m&&t.date.getFullYear()===y)}
function computeAgeing(txns){
  const debits=txns.filter(t=>["SALE","DEBIT NOTE"].includes(t.type)).sort((a,b)=>a.date-b.date).map(t=>({date:t.date,party:t.party,doc:t.doc,amt:ledgerAmount(t)}));
  const credits=txns.filter(t=>["PAYMENT","CREDIT NOTE","SALES RETURN"].includes(t.type)).sort((a,b)=>a.date-b.date).map(t=>({date:t.date,amt:ledgerAmount(t)}));
  for(const c of credits){let left=c.amt;for(const d of debits){if(left<=0)break;let use=Math.min(left,d.amt);d.amt-=use;left-=use}}
  const now=new Date(), buckets={"0-30":0,"31-60":0,"61-90":0,"91-180":0,"181+":0};
  for(const d of debits){if(d.amt<=.01)continue;let days=Math.max(0,Math.floor((now-d.date)/86400000));let k=days<=30?"0-30":days<=60?"31-60":days<=90?"61-90":days<=180?"91-180":"181+";buckets[k]+=d.amt}
  return{buckets,total:Object.values(buckets).reduce((a,b)=>a+b,0)}
}
function render(){
  const tx=filtered(), cm=currentMonthTransactions(), sales=cm.filter(x=>x.type==="SALE").reduce((a,b)=>a+b.total,0), col=cm.filter(x=>x.type==="PAYMENT").reduce((a,b)=>a+b.amount,0);
  const allAge=computeAgeing(tx);
  $("kpiSales").textContent=money(sales);$("kpiCollection").textContent=money(col);$("kpiOutstanding").textContent=money(allAge.total);$("kpiOverdue").textContent=money(allAge.buckets["91-180"]+allAge.buckets["181+"]);
  $("kpiCN").textContent=money(tx.filter(x=>x.type==="CREDIT NOTE").reduce((a,b)=>a+b.amount,0));
  $("kpiDN").textContent=money(tx.filter(x=>x.type==="DEBIT NOTE").reduce((a,b)=>a+b.amount,0));
  $("kpiReturn").textContent=money(tx.filter(x=>x.type==="SALES RETURN").reduce((a,b)=>a+b.amount,0));
  renderParty(tx);renderRecent(tx);renderCharts(tx);
}
function renderParty(tx){
  const map=new Map();
  for(const t of tx){let p=norm(t.party);if(!p)continue;if(!map.has(p))map.set(p,{party:t.party,state:t.state,sh:t.sh,sales:0,col:0});let x=map.get(p);x.sales+=t.type==="SALE"?t.total:0;x.col+=t.type==="PAYMENT"?t.amount:0}
  const rows=[...map.values()].map(x=>{let pt=tx.filter(t=>norm(t.party)===norm(x.party));let age=computeAgeing(pt);return {...x,out:age.total,over:age.buckets["91-180"]+age.buckets["181+"]}}).sort((a,b)=>b.out-a.out);
  $("partyTable").querySelector("tbody").innerHTML=rows.slice(0,100).map(x=>`<tr><td class="link party-link" data-party="${esc(x.party)}">${esc(x.party)}</td><td>${esc(x.state)}</td><td>${esc(x.sh)}</td><td>${money(x.sales)}</td><td>${money(x.col)}</td><td><b>${money(x.out)}</b></td><td>${money(x.over)}</td></tr>`).join("");
  document.querySelectorAll(".party-link").forEach(e=>e.onclick=()=>openParty(e.dataset.party));
}
function renderRecent(tx){
  const a=[...tx].sort((x,y)=>(y.date||0)-(x.date||0)).slice(0,80);
  $("transactionCount").textContent=`${tx.length.toLocaleString("en-IN")} transactions`;
  $("recentTable").querySelector("tbody").innerHTML=a.map(t=>`<tr><td>${t.date?iso(t.date):""}</td><td>${esc(t.type)}</td><td>${esc(t.party)}</td><td>${esc(t.doc)}</td><td>${signed(t)>0?money(signed(t)):""}</td><td>${signed(t)<0?money(-signed(t)):""}</td><td>${money(Math.abs(signed(t)))}</td></tr>`).join("");
}
function destroyChart(id){if(charts[id])charts[id].destroy()}
function makeChart(id,type,labels,data,opts={}){destroyChart(id);charts[id]=new Chart($(id),{type,data:{labels,datasets:[{label:opts.label||"",data,borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==="doughnut"}},scales:type==="doughnut"?{}:{y:{beginAtZero:true}}}})}
function renderCharts(tx){
  const months=uniq(tx.map(x=>monthKey(x.date))).sort((a,b)=>new Date("1 "+a)-new Date("1 "+b));
  makeChart("monthChart","bar",months,months.map(m=>tx.filter(x=>x.type==="SALE"&&monthKey(x.date)===m).reduce((a,b)=>a+b.total,0)),{label:"Sales"});
  makeChart("collectionChart","bar",months,months.map(m=>[["SALE",1],["PAYMENT",-1]].reduce((z,_)=>z,0)+tx.filter(x=>monthKey(x.date)===m&&x.type==="PAYMENT").reduce((a,b)=>a+b.amount,0)),{label:"Collection"});
  const states=uniq(tx.map(x=>x.state)).slice(0,15);makeChart("stateChart","bar",states,states.map(s=>tx.filter(x=>x.state===s&&x.type==="SALE").reduce((a,b)=>a+b.total,0)),{label:"Sales"});
  const age=computeAgeing(tx);makeChart("ageingChart","doughnut",Object.keys(age.buckets),Object.values(age.buckets),{label:"Outstanding"});
}
function openModal(title,html){$("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden")}
function openParty(party){
  const tx=TXNS.filter(t=>allowed(t)&&norm(t.party)===norm(party)).sort((a,b)=>a.date-b.date), age=computeAgeing(tx);
  const ledger=tx.map(t=>({t,b:signed(t)}));let bal=0;ledger.forEach(x=>bal+=x.b);
  const total=age.total;
  const ageBoxes=Object.entries(age.buckets).map(([k,v])=>`<div class="age-box"><span>${k} Days</span><b>${money(v)}</b></div>`).join("");
  const rows=ledger.slice(-300).reverse().map(x=>`<tr><td>${iso(x.t.date)}</td><td>${esc(x.t.type)}</td><td>${esc(x.t.doc)}</td><td>${x.b>0?money(x.b):""}</td><td>${x.b<0?money(-x.b):""}</td><td>${esc(x.t.state||"")}</td></tr>`).join("");
  openModal(esc(party),`<div class="ageing-grid">${ageBoxes}</div><div class="card"><b>Total Outstanding: ${money(total)}</b><span class="subtle"> Ageing is calculated by allocating credits against the oldest debit entries (FIFO).</span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Document</th><th>Debit</th><th>Credit</th><th>State</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}
function openDrill(type){
  let tx=type==="sales"?currentMonthTransactions().filter(t=>t.type==="SALE"):type==="collection"?currentMonthTransactions().filter(t=>t.type==="PAYMENT"):filtered();
  if(type==="outstanding"||type==="overdue"){
    const m=new Map();for(const t of tx){let p=norm(t.party);if(!p)continue;if(!m.has(p))m.set(p,t.party);};const rows=[...m.values()].map(p=>{let a=computeAgeing(tx.filter(t=>norm(t.party)===norm(p)));return{p,a}}).filter(x=>type==="outstanding"||x.a.buckets["91-180"]+x.a.buckets["181+"]>0).sort((a,b)=>b.a.total-a.a.total);openModal(type==="outstanding"?"Outstanding":"Overdue Outstanding",`<div class="table-wrap"><table><thead><tr><th>Party</th><th>0-30</th><th>31-60</th><th>61-90</th><th>91-180</th><th>181+</th><th>Total</th></tr></thead><tbody>${rows.map(x=>`<tr><td class="link drill-party" data-party="${esc(x.p)}">${esc(x.p)}</td>${["0-30","31-60","61-90","91-180","181+"].map(k=>`<td>${money(x.a.buckets[k])}</td>`).join("")}<td><b>${money(x.a.total)}</b></td></tr>`).join("")}</tbody></table></div>`);document.querySelectorAll(".drill-party").forEach(e=>e.onclick=()=>openParty(e.dataset.party));return}
  const map=new Map();tx.forEach(t=>{let p=norm(t.party);if(!map.has(p))map.set(p,{p:t.party,n:0,amt:0});let x=map.get(p);x.n++;x.amt+=ledgerAmount(t)});openModal(type==="sales"?"This Month Sales":"This Month Collection",`<div class="table-wrap"><table><thead><tr><th>Party</th><th>Transactions</th><th>Amount</th></tr></thead><tbody>${[...map.values()].sort((a,b)=>b.amt-a.amt).map(x=>`<tr><td class="link drill-party" data-party="${esc(x.p)}">${esc(x.p)}</td><td>${x.n}</td><td><b>${money(x.amt)}</b></td></tr>`).join("")}</tbody></table></div>`);document.querySelectorAll(".drill-party").forEach(e=>e.onclick=()=>openParty(e.dataset.party));
}
document.querySelectorAll(".filters select,.filters input").forEach(e=>e.addEventListener("change",render));
$("searchBox").addEventListener("input",render);
document.querySelectorAll("[data-drill]").forEach(e=>e.addEventListener("click",()=>openDrill(e.dataset.drill)));
$("closeModal").onclick=()=>$("modal").classList.add("hidden");$("modal").addEventListener("click",e=>{if(e.target.id==="modal")$("modal").classList.add("hidden")});
$("refreshBtn").onclick=loadAll;
$("logoutBtn").onclick=()=>{location.reload()};
$("loginRole").onchange=()=>{$("loginUser").value="";};
$("enterPortal").onclick=()=>{currentRole=$("loginRole").value;selectedUser=$("loginUser").value; if(currentRole!=="ADMIN"&&!selectedUser){alert("Please select a State Head / Party.");return} $("loginScreen").classList.add("hidden");$("app").classList.remove("hidden");$("roleBadge").textContent=currentRole;loadAll()};
