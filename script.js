const state = { rows: [], filtered: [] };
const $ = id => document.getElementById(id);

function clean(v){ return v == null ? "" : String(v).trim(); }
function money(n){ return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0); }
function num(v){ const n=Number(String(v).replace(/,/g,"")); return Number.isFinite(n)?n:0; }
function unique(key){
  return [...new Set(state.rows.map(r=>clean(r[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
function fill(id,key){
  const el=$(id); unique(key).forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;el.appendChild(o);});
}
function escapeHtml(s){return clean(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

function apply(){
  const m=$("month").value,h=$("stateHead").value,s=$("state").value,g=$("group").value,q=$("search").value.toLowerCase().trim();
  state.filtered=state.rows.filter(r=>{
    if(m && clean(r["M0NTH"])!==m)return false;
    if(h && clean(r["STATE HEAD A "])!==h)return false;
    if(s && clean(r["STATE"])!==s)return false;
    if(g && clean(r["GROUP"])!==g)return false;
    if(q){
      const hay=[r["CUSTOMER"],r["CODE"],r["INVOICE NO"],r["STATION"]].map(clean).join(" ").toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });
  render();
}

function render(){
  const rows=state.filtered;
  const sales=rows.reduce((a,r)=>a+num(r["AMOUNT"]),0);
  const qty=rows.reduce((a,r)=>a+num(r["QTY"]),0);
  const inv=new Set(rows.map(r=>clean(r["INVOICE NO"])).filter(Boolean)).size;
  const cust=new Set(rows.map(r=>clean(r["CUSTOMER"])).filter(Boolean)).size;
  $("sales").textContent=money(sales); $("qty").textContent=qty.toLocaleString("en-IN");
  $("invoices").textContent=inv.toLocaleString("en-IN"); $("customers").textContent=cust.toLocaleString("en-IN");
  $("status").textContent=`${rows.length.toLocaleString("en-IN")} records selected`;

  const monthMap={}, headMap={};
  rows.forEach(r=>{
    const m=clean(r["M0NTH"])||"Blank", h=clean(r["STATE HEAD A "])||"Blank", a=num(r["AMOUNT"]);
    monthMap[m]=(monthMap[m]||0)+a; headMap[h]=(headMap[h]||0)+a;
  });
  $("monthTable").innerHTML=mini(monthMap);
  $("headTable").innerHTML=mini(headMap);

  const max=5000;
  $("dataBody").innerHTML=rows.slice(0,max).map(r=>`<tr>
    <td>${escapeHtml(r["INVOICE NO"])}</td><td>${escapeHtml(r["DATE"])}</td>
    <td>${escapeHtml(r["CUSTOMER"])}</td><td>${escapeHtml(r["CODE"])}</td>
    <td>${escapeHtml(r["M0NTH"])}</td><td>${num(r["QTY"]).toLocaleString("en-IN")}</td>
    <td>${money(num(r["SALE RATE"]))}</td><td>${money(num(r["AMOUNT"]))}</td>
    <td>${escapeHtml(r["GROUP"])}</td><td>${escapeHtml(r["STATE"])}</td>
    <td>${escapeHtml(r["STATE HEAD A "])}</td></tr>`).join("");
  $("tableNote").textContent=rows.length>max ? `Showing first ${max.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} filtered records.` : `Showing all ${rows.length.toLocaleString("en-IN")} filtered records.`;
}
function mini(obj){
  const arr=Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  return `<table class="mini"><thead><tr><th>Name</th><th>Sales</th></tr></thead><tbody>`+
    arr.slice(0,30).map(x=>`<tr><td>${escapeHtml(x[0])}</td><td>${money(x[1])}</td></tr>`).join("")+
    `</tbody></table>`;
}

const SHEET_ID = "1QIpcfgOVCFjcCmgU_DXKn8h7Bfa8rm2q2wB2HneTvKs";
const SHEET_NAME = "Sheet1";

async function load(){
  try{
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Google Sheet could not be read");
    const text = await res.text();
    state.rows = parseCSV(text);
    if(!state.rows.length) throw new Error("No rows found");
    fill("month","M0NTH");fill("stateHead","STATE HEAD A ");fill("state","STATE");fill("group","GROUP");
    state.filtered=state.rows;render();
    $("status").textContent=`${state.rows.length.toLocaleString("en-IN")} records loaded from Google Sheet`;
  }catch(e){
    console.error(e);
    $("status").textContent="Google Sheet load failed";
    alert("Google Sheet data load nahi ho raha. Sheet ko Share → Anyone with the link → Viewer karein, aur Sheet tab ka naam Sheet1 hi rakhein.");
  }
}

function parseCSV(text){
  const lines=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'){if(quoted&&n==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field="";}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field);if(row.some(x=>x!==""))lines.push(row);row=[];field="";}
    else field+=c;
  }
  if(field!==""||row.length){row.push(field);if(row.some(x=>x!==""))lines.push(row);}
  const headers=lines.shift().map(clean);
  return lines.map(a=>Object.fromEntries(headers.map((h,i)=>[h,a[i]??""])));
}
["month","stateHead","state","group","search"].forEach(id=>$(id).addEventListener("input",apply));
$("reset").onclick=()=>{["month","stateHead","state","group","search"].forEach(id=>$(id).value="");apply();};
load();
