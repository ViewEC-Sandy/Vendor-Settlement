import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, addDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const clean=v=>String(v??"").trim(),num=v=>Number(String(v??"").replace(/[,，NT$￥¥\s]/g,""))||0,esc=v=>String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));
let state={user:null,role:"viewer",sales:[],logs:[],vendors:[],products:[],adjustments:[],params:[]};
const canWrite=()=>state.role==="admin"||state.role==="manager";
function setProgress(p,msg){const v=Math.max(0,Math.min(100,Math.round(p)));$("logProgressBar").style.width=v+"%";$("logProgressText").textContent=`${v}%　${msg}`}
function setVendorProgress(p,msg){
  const v=Math.max(0,Math.min(100,Math.round(Number(p)||0)));
  $("vendorProgressBar").style.width=v+"%";
  $("vendorProgressText").textContent=`${v}%　${msg}`;
}

document.querySelectorAll("#nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$(b.dataset.page).classList.add("active");$("pageTitle").textContent=b.textContent});
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("logDb").classList.toggle("active",b.dataset.tab==="db");$("logImport").classList.toggle("active",b.dataset.tab==="import")});
$("loginBtn").onclick=()=>signInWithEmailAndPassword(auth,$("email").value,$("password").value).catch(e=>alert(e.message));$("logoutBtn").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async u=>{state.user=u;state.role="viewer";if(u){const s=await getDoc(doc(db,"users",u.uid));state.role=s.exists()?(s.data().role||"viewer"):"viewer";$("authStatus").textContent=`${u.email} / ${state.role}`;await refresh()}else $("authStatus").textContent="未登入"});
async function refresh(){await Promise.all([loadSales(),loadLogs(),loadVendors(),loadProducts(),loadAdjustments(),loadParams()]);renderOverview();renderMonthly();renderLogs();renderVendors()}
async function loadSales(){const s=await getDocs(collection(db,"sales"));state.sales=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadLogs(){const s=await getDocs(collection(db,"shipmentCosts"));state.logs=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadVendors(){const s=await getDocs(collection(db,"vendorSettlementSettings"));state.vendors=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadProducts(){const s=await getDocs(collection(db,"products"));state.products=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadAdjustments(){const s=await getDocs(collection(db,"settlementAdjustments"));state.adjustments=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadParams(){const s=await getDocs(collection(db,"monthlySettlementParams"));state.params=s.docs.map(d=>({id:d.id,...d.data()}))}

function renderOverview(){const sales=state.sales.reduce((a,x)=>a+saleLineAmountJPY(x),0),ship=state.logs.reduce((a,x)=>a+num(x.amountTWD),0);$("overviewKpis").innerHTML=[["銷售筆數",state.sales.length],["銷售收入(JPY)",Math.round(sales).toLocaleString()],["物流筆數",state.logs.length],["物流總運費(TWD)",Math.round(ship).toLocaleString()]].map(([k,v])=>`<div class="kpi">${k}<b>${v}</b></div>`).join("")}
const MONTHLY_COLS=[
  {key:"select",label:"選取",kind:"select",default:true},
  {key:"month",label:"結算月份",kind:"system",default:true},
  {key:"purchaseDate",label:"叫貨日",kind:"edit",default:true},
  {key:"projectType",label:"專案類型",kind:"edit",default:true},
  {key:"vendorName",label:"廠商名",kind:"edit",default:true},
  {key:"orderId",label:"訂單編號",kind:"system",default:true},
  {key:"origin",label:"發貨地",kind:"edit",default:true},
  {key:"productName",label:"商品名",kind:"system",default:true},
  {key:"productId",label:"SKU管理番号",kind:"system",default:true},
  {key:"unitPriceJPY",label:"日幣單價",kind:"system",default:true},
  {key:"quantity",label:"商品件數",kind:"system",default:true},
  {key:"salesAmountJPY",label:"銷售額(JPY)",kind:"calc",default:true},
  {key:"vendorDiscountRate",label:"折數(廠商負擔)",kind:"edit",default:true},
  {key:"vendorCampaignName",label:"活動名稱(廠商負擔)",kind:"edit",default:true},
  {key:"ourDiscountJPY",label:"折扣額(我方負擔/JPY)",kind:"edit",default:true},
  {key:"ourCampaignName",label:"活動名稱(我方負擔)",kind:"edit",default:true},
  {key:"pointsMultiplier",label:"點數倍率",kind:"edit",default:false},
  {key:"pointsCostJPY",label:"點數成本(JPY)",kind:"edit",default:false},
  {key:"discountedFinalJPY",label:"折扣後日幣末售",kind:"calc",default:true},
  {key:"fxRate",label:"當月日幣匯率",kind:"calc",default:true},
  {key:"discountedTWD",label:"折扣後台幣供應價",kind:"calc",default:true},
  {key:"rakutenFeeTWD",label:"日本樂天成交手續費(TWD)",kind:"calc",default:true},
  {key:"settlementType",label:"結帳方式",kind:"calc",default:true},
  {key:"commissionRate",label:"適用抽成率",kind:"calc",default:true},
  {key:"vendorPaymentTWD",label:"支付給廠商的金額",kind:"calc",default:true},
  {key:"note",label:"備註",kind:"edit",default:true},
  {key:"action",label:"操作",kind:"action",default:true}
];
const monthlyVisible=new Set(JSON.parse(localStorage.getItem("vsdMonthlyColumns")||"null")||MONTHLY_COLS.filter(c=>c.default).map(c=>c.key));
function pickFirst(obj,keys,def=""){for(const k of keys){if(obj?.[k]!==undefined&&obj?.[k]!==null&&clean(obj[k])!=="")return obj[k]}return def}
function saleUnitPriceJPY(s){
  const direct=pickFirst(s,["unitPriceJPY","unitPrice","lineUnitPriceJPY","lineUnitPrice","itemUnitPrice","itemPrice","priceJPY","price","salePriceJPY","単価","商品単価"],"");
  if(clean(direct)!=="")return num(direct);
  const qty=saleQuantity(s);
  const lineTotal=pickFirst(s,["lineAmountJPY","itemAmountJPY","lineTotalJPY","itemTotalJPY"],"");
  if(qty>0&&clean(lineTotal)!=="")return num(lineTotal)/qty;
  return 0;
}
function saleQuantity(s){const v=pickFirst(s,["quantity","qty","units","count","個数"],1);return Math.max(0,num(v)||0)}
function saleLineAmountJPY(s){return saleUnitPriceJPY(s)*saleQuantity(s)}
function saleOrderId(s){return clean(pickFirst(s,["orderId","orderNumber","orderNo","注文番号"],""))}
function saleProductId(s){return clean(pickFirst(s,["productId","sku","itemNumber","商品番号"],""))}
function saleMonth(s){const direct=clean(pickFirst(s,["month","saleMonth"],""));if(direct)return direct.slice(0,7);const d=clean(pickFirst(s,["date","orderDate","saleDate","注文日"],""));const mm=d.match(/(\d{4})[-\/]?(\d{1,2})/);return mm?`${mm[1]}-${String(mm[2]).padStart(2,"0")}`:""}
function monthlyAdjFor(s){return state.adjustments.find(a=>a.salesId===s.id||a.id===s.id)||{}}
function productFor(s){
  const sku=saleProductId(s).toLowerCase();
  const mgmt=clean(pickFirst(s,["managementNumber","productManagementNumber","商品管理番号"],"")).toLowerCase();
  return state.products.find(p=>{
    const ids=[p.id,p.productId,p.productNumber,p.sku,p.specManagementId,p.商品番号].map(v=>clean(v).toLowerCase()).filter(Boolean);
    const mids=[p.managementNumber,p.productManagementId,p.productManagementNumber,p.商品管理番号].map(v=>clean(v).toLowerCase()).filter(Boolean);
    return (sku&&ids.includes(sku))||(mgmt&&mids.includes(mgmt));
  })||{};
}
function vendorSettingFor(name){const k=clean(name).toLowerCase();return state.vendors.find(v=>clean(v.vendorName).toLowerCase()===k)||{}}
function monthParamFor(month){return state.params.find(p=>clean(p.month||p.id).slice(0,7)===month)||{}}
function effectiveProductName(s,p){return clean(pickFirst(p,["nameZh","chineseName","nameZH","中文商品名","中文品名"],pickFirst(s,["productName","name","itemName","商品名"],pickFirst(p,["title","productName","name"],""))))}
function monthlyRow(s){
  const a=monthlyAdjFor(s),p=productFor(s),month=saleMonth(s),vname=clean(a.vendorName||pickFirst(p,["vendorName","vendor","supplierName"],""));
  const vs=vendorSettingFor(vname),mp=monthParamFor(month),unit=saleUnitPriceJPY(s),qty=saleQuantity(s),sales=unit*qty;
  let rate=a.vendorDiscountRate; if(rate===undefined||rate===null||rate==="")rate=1; rate=num(rate); if(rate>1)rate/=100; if(rate<=0)rate=1;
  const ourDisc=num(a.ourDiscountJPY),discounted=Math.max(0,sales*rate-ourDisc),fx=num(mp.fxAvg||mp.fxRate),discountedTWD=discounted*fx;
  const rkRate=num(mp.rakutenFeeRate||0.10),rkFee=discounted*rkRate*fx;
  const st=clean(a.settlementType||vs.settlementType||""); let comm=num(a.commissionRate??vs.resaleCommissionRate??0); if(comm>1)comm/=100;
  let payment=discountedTWD;
  if(st==="代銷售")payment=discountedTWD*(1-comm); else if(st==="有抽成")payment=discountedTWD-rkFee; else if(st==="無抽成")payment=discountedTWD;
  return {salesId:s.id,month,purchaseDate:a.purchaseDate||"",projectType:a.projectType||vs.defaultProject||"",vendorName:vname,orderId:saleOrderId(s),origin:a.origin||pickFirst(p,["origin","shippingOrigin"],""),productName:effectiveProductName(s,p),productId:saleProductId(s),unitPriceJPY:unit,quantity:qty,salesAmountJPY:sales,vendorDiscountRate:rate,vendorCampaignName:a.vendorCampaignName||"",ourDiscountJPY:ourDisc,ourCampaignName:a.ourCampaignName||"",pointsMultiplier:a.pointsMultiplier||"",pointsCostJPY:a.pointsCostJPY||"",discountedFinalJPY:discounted,fxRate:fx,discountedTWD,rakutenFeeTWD:rkFee,settlementType:st,commissionRate:comm,vendorPaymentTWD:payment,note:a.note||"",_sales:s,_adj:a};
}
function fmtMonthly(key,v){if(["unitPriceJPY","salesAmountJPY","ourDiscountJPY","pointsCostJPY","discountedFinalJPY"].includes(key))return v===""?"":Math.round(num(v)).toLocaleString();if(["discountedTWD","rakutenFeeTWD","vendorPaymentTWD"].includes(key))return v===""?"":num(v).toFixed(2);if(["vendorDiscountRate","commissionRate"].includes(key))return v===""?"":`${(num(v)*100).toFixed(1).replace(/\.0$/,"")}%`;if(key==="fxRate")return v?num(v).toFixed(6):"";return clean(v)}
const monthlyFieldFilters={};
let monthlyFieldFiltersVisible=true;
function monthlyRawFilterValue(key,v){
  if(v===undefined||v===null||v==="")return "（空白）";
  return fmtMonthly(key,v)||"（空白）";
}
function monthlyFilterOptions(rows,key){
  const values=[...new Set(rows.map(r=>monthlyRawFilterValue(key,r[key])))].sort((a,b)=>a.localeCompare(b,'zh-Hant',{numeric:true}));
  return values.slice(0,300);
}
function passesMonthlyFieldFilters(row){
  return Object.entries(monthlyFieldFilters).every(([key,value])=>!value||monthlyRawFilterValue(key,row[key])===value);
}
function monthlyBaseRows(){
  const q=clean($("monthlySearch").value).toLowerCase(),m=$("monthlyMonth").value,pr=clean($("monthlyProject").value).toLowerCase(),ve=clean($("monthlyVendor").value).toLowerCase(),st=$("monthlySettlement").value;
  return state.sales.map(monthlyRow).filter(r=>(!q||[r.orderId,r.productId,r.productName,r.vendorName].some(x=>clean(x).toLowerCase().includes(q)))&&(!m||r.month===m)&&(!pr||clean(r.projectType).toLowerCase().includes(pr))&&(!ve||clean(r.vendorName).toLowerCase().includes(ve))&&(!st||r.settlementType===st));
}
function monthlyFilteredRows(){return monthlyBaseRows().filter(passesMonthlyFieldFilters)}
function renderMonthly(){
  const cols=MONTHLY_COLS.filter(c=>monthlyVisible.has(c.key));
  const baseRows=monthlyBaseRows(),rows=baseRows.filter(passesMonthlyFieldFilters);
  const filterRow=monthlyFieldFiltersVisible?`<tr class="monthly-filter-row">${cols.map(c=>{
    if(["select","action"].includes(c.key))return '<th></th>';
    const options=monthlyFilterOptions(baseRows,c.key),selected=monthlyFieldFilters[c.key]||"";
    return `<th><select class="column-filter" data-month-filter="${esc(c.key)}" title="篩選 ${esc(c.label)}"><option value="">全部</option>${options.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('')}</select></th>`;
  }).join('')}</tr>`:'';
  $("monthlyTable").innerHTML=`<thead><tr>${cols.map(c=>`<th class="col-${esc(c.key)}">${esc(c.label)}</th>`).join("")}</tr>${filterRow}</thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>{
    if(c.key==="select")return `<td class="col-select"><input type="checkbox" class="monthly-select" value="${esc(r.salesId)}"></td>`;
    if(c.key==="action")return `<td class="col-action"><button data-edit-monthly="${esc(r.salesId)}">編輯</button></td>`;
    const cls=c.kind==="edit"?"cell-edit":"cell-"+c.kind;
    let display=fmtMonthly(c.key,r[c.key]);
    if(c.key==="productName"){
      const full=clean(r.productName),short=full.length>15?full.slice(0,15)+"…":full;
      return `<td class="${cls} product-name col-productName" title="${esc(full)}">${esc(short||'未對應商品主檔')}</td>`;
    }
    if(c.key==="unitPriceJPY"&&num(r.unitPriceJPY)===0)return `<td class="${cls} col-unitPriceJPY missing-value" title="原始 sales 明細缺少可辨識的單價欄位">—</td>`;
    return `<td class="${cls} col-${esc(c.key)}">${esc(display)}</td>`;
  }).join("")}</tr>`).join("")}</tbody>`;
  document.querySelectorAll("[data-edit-monthly]").forEach(b=>b.onclick=()=>editMonthlyAdjustment(b.dataset.editMonthly));
  document.querySelectorAll("[data-month-filter]").forEach(sel=>sel.onchange=()=>{
    if(sel.value)monthlyFieldFilters[sel.dataset.monthFilter]=sel.value;else delete monthlyFieldFilters[sel.dataset.monthFilter];
    renderMonthly();
  });
  const active=Object.entries(monthlyFieldFilters).filter(([,v])=>v);
  $("monthlyFilterSummary").innerHTML=`顯示 <strong>${rows.length.toLocaleString()}</strong> / ${baseRows.length.toLocaleString()} 筆${active.length?`　｜　欄位篩選：${active.map(([k,v])=>`${MONTHLY_COLS.find(c=>c.key===k)?.label||k}=${esc(v)}`).join('、')}`:''}`;
}
function renderMonthlyColumns(){const panel=$("monthlyColumnsPanel");panel.innerHTML=MONTHLY_COLS.filter(c=>!["select","action"].includes(c.key)).map(c=>`<label><input type="checkbox" data-month-col="${c.key}" ${monthlyVisible.has(c.key)?"checked":""}> ${esc(c.label)}</label>`).join("")+`<div><button id="monthlyColsDefault">恢復預設</button></div>`;document.querySelectorAll("[data-month-col]").forEach(x=>x.onchange=()=>{x.checked?monthlyVisible.add(x.dataset.monthCol):monthlyVisible.delete(x.dataset.monthCol);localStorage.setItem("vsdMonthlyColumns",JSON.stringify([...monthlyVisible]));renderMonthly()});$("monthlyColsDefault").onclick=()=>{monthlyVisible.clear();MONTHLY_COLS.filter(c=>c.default).forEach(c=>monthlyVisible.add(c.key));localStorage.setItem("vsdMonthlyColumns",JSON.stringify([...monthlyVisible]));renderMonthlyColumns();renderMonthly()}}
$("monthlyColumnsBtn").onclick=()=>{$("monthlyColumnsPanel").classList.toggle("hidden");renderMonthlyColumns()};
$("monthlyFilterToggle").onclick=()=>{monthlyFieldFiltersVisible=!monthlyFieldFiltersVisible;renderMonthly()};
$("monthlyClearFilters").onclick=()=>{Object.keys(monthlyFieldFilters).forEach(k=>delete monthlyFieldFilters[k]);$("monthlySearch").value="";$("monthlyMonth").value="";$("monthlyProject").value="";$("monthlyVendor").value="";$("monthlySettlement").value="";renderMonthly()};
["monthlySearch","monthlyProject","monthlyVendor"].forEach(id=>$(id).oninput=renderMonthly);$("monthlyMonth").onchange=renderMonthly;$("monthlySettlement").onchange=renderMonthly;
$("monthlyRefresh").onclick=async()=>{await Promise.all([loadSales(),loadProducts(),loadAdjustments(),loadVendors(),loadParams()]);renderMonthly()};
const ADJ_COLS=[["purchaseDate","叫貨日"],["projectType","專案類型"],["vendorName","廠商名"],["origin","發貨地(TW/JP)"],["vendorDiscountRate","折數(廠商負擔，例如80%或0.8)"],["vendorCampaignName","活動名稱(廠商負擔)"],["ourDiscountJPY","折扣額(我方負擔/JPY)"],["ourCampaignName","活動名稱(我方負擔)"],["pointsMultiplier","點數倍率"],["pointsCostJPY","點數成本(JPY)"],["settlementType","結帳方式"],["commissionRate","個別抽成率(選填)"],["note","備註"]];
function editMonthlyAdjustment(salesId){if(!canWrite())return alert("目前帳號沒有寫入權限");const row=monthlyRow(state.sales.find(s=>s.id===salesId)),old=monthlyAdjFor(row._sales);openEditor("月結人工調整",ADJ_COLS,row,async v=>{const payload={salesId,orderId:row.orderId,productId:row.productId,updatedAt:serverTimestamp()};ADJ_COLS.forEach(([k])=>{if(v[k]!=="")payload[k]=v[k]});if(payload.vendorDiscountRate!==undefined){let x=num(payload.vendorDiscountRate);if(x>1)x/=100;payload.vendorDiscountRate=x}if(payload.commissionRate!==undefined){let x=num(payload.commissionRate);if(x>1)x/=100;payload.commissionRate=x}await setDoc(doc(db,"settlementAdjustments",salesId),payload,{merge:true});await audit("settlementAdjustments",salesId,"edit",old,payload);await loadAdjustments();renderMonthly()})}
$("monthlyBatchBtn").onclick=()=>{if(!canWrite())return alert("目前帳號沒有寫入權限");const ids=[...document.querySelectorAll(".monthly-select:checked")].map(x=>x.value);if(!ids.length)return alert("請先勾選要修改的商品明細");openEditor(`批量修改 ${ids.length} 筆`,ADJ_COLS,{},async v=>{const b=writeBatch(db);ids.forEach(id=>{const s=state.sales.find(x=>x.id===id),r=monthlyRow(s),payload={salesId:id,orderId:r.orderId,productId:r.productId,updatedAt:serverTimestamp()};ADJ_COLS.forEach(([k])=>{if(v[k]!=="")payload[k]=v[k]});if(payload.vendorDiscountRate!==undefined){let x=num(payload.vendorDiscountRate);if(x>1)x/=100;payload.vendorDiscountRate=x}if(payload.commissionRate!==undefined){let x=num(payload.commissionRate);if(x>1)x/=100;payload.commissionRate=x}b.set(doc(db,"settlementAdjustments",id),payload,{merge:true})});await b.commit();await audit("settlementAdjustments","batch","batch-edit",{}, {count:ids.length});await loadAdjustments();renderMonthly()})};
function setAdjustmentProgress(p,msg){const v=Math.max(0,Math.min(100,Math.round(Number(p)||0)));$("adjustmentProgressBar").style.width=v+"%";$("adjustmentProgressText").textContent=`${v}%　${msg}`}
$("adjustmentImportBtn").onclick=async()=>{if(!canWrite())return alert("目前帳號沒有寫入權限");const file=$("adjustmentImportFile").files?.[0];if(!file)return alert("請先選擇檔案");try{setAdjustmentProgress(5,"讀取檔案");const rows=await readWorkbook(file);if(!rows.length)throw new Error("檔案沒有資料");const aliases={orderId:["訂單編號","注文番号","orderid"],productId:["SKU管理番号","商品番号","sku","productid"],purchaseDate:["叫貨日"],projectType:["專案類型"],vendorName:["廠商名"],origin:["發貨地"],vendorDiscountRate:["折數(廠商負擔)","廠商折數"],vendorCampaignName:["活動名稱(廠商負擔)"],ourDiscountJPY:["折扣額(我方負擔)","折扣額(我方負擔/JPY)"],ourCampaignName:["活動名稱(我方負擔)"],pointsMultiplier:["點數倍率"],pointsCostJPY:["點數成本(JPY)"],settlementType:["結帳方式"],commissionRate:["個別抽成率","適用抽成率"],note:["備註"]};let hr=-1,idx={};for(let i=0;i<Math.min(rows.length,20);i++){const hs=(rows[i]||[]).map(x=>clean(x).replace(/\s+/g,"").toLowerCase());const found={};Object.entries(aliases).forEach(([k,ls])=>{const targets=ls.map(x=>clean(x).replace(/\s+/g,"").toLowerCase()),j=hs.findIndex(h=>targets.includes(h));if(j>=0)found[k]=j});if(found.orderId!==undefined&&found.productId!==undefined){hr=i;idx=found;break}}if(hr<0)throw new Error("至少需要『訂單編號』與『SKU管理番号/商品番号』表頭");setAdjustmentProgress(25,`表頭第 ${hr+1} 列`);const parsed=rows.slice(hr+1).map((r,i)=>{const x={sourceRow:i+hr+2};Object.entries(idx).forEach(([k,j])=>x[k]=clean(r[j]));return x}).filter(x=>x.orderId&&x.productId);let matched=0,unmatched=0;const todo=[];parsed.forEach(x=>{const s=state.sales.find(s=>saleOrderId(s)===x.orderId&&saleProductId(s)===x.productId);if(!s){unmatched++;return}matched++;const payload={salesId:s.id,orderId:x.orderId,productId:x.productId,updatedAt:serverTimestamp()};ADJ_COLS.forEach(([k])=>{if(x[k]!==undefined&&x[k]!=="")payload[k]=x[k]});if(payload.vendorDiscountRate!==undefined){let v=num(payload.vendorDiscountRate);if(v>1)v/=100;payload.vendorDiscountRate=v}if(payload.commissionRate!==undefined){let v=num(payload.commissionRate);if(v>1)v/=100;payload.commissionRate=v}todo.push({id:s.id,payload})});setAdjustmentProgress(50,`匹配 ${matched} 筆，未匹配 ${unmatched} 筆`);if(!confirm(`將更新 ${todo.length} 筆人工調整資料，未匹配 ${unmatched} 筆。確定？`))return setAdjustmentProgress(0,"已取消");for(let i=0;i<todo.length;i+=200){const b=writeBatch(db);todo.slice(i,i+200).forEach(x=>b.set(doc(db,"settlementAdjustments",x.id),x.payload,{merge:true}));await b.commit();setAdjustmentProgress(55+40*Math.min(1,(i+200)/Math.max(1,todo.length)),`寫入 ${Math.min(i+200,todo.length)} / ${todo.length}`)}await audit("settlementAdjustments","batch","import",{}, {fileName:file.name,matched,unmatched});await loadAdjustments();renderMonthly();setAdjustmentProgress(100,`完成：更新 ${todo.length} 筆，未匹配 ${unmatched} 筆`)}catch(e){console.error(e);setAdjustmentProgress(100,"匯入失敗："+e.message)}};
const logCols=[["shipmentDate","出貨日期"],["shipmentNo","出貨單號"],["orderId","訂單編號"],["service","物流類型"],["origin","發貨地"],["destination","收件地"],["pieces","箱數"],["chargeWeightKg","計費重(kg)"],["amountTWD","運費(TWD)"]];
function renderLogs(){let q=clean($("logSearch").value).toLowerCase(),m=$("logMonth").value,rows=state.logs.filter(x=>(!q||clean(x.orderId).toLowerCase().includes(q)||clean(x.shipmentNo).toLowerCase().includes(q))&&(!m||clean(x.shipmentDate).slice(0,7)===m));$("logTable").innerHTML=`<thead><tr>${logCols.map(c=>`<th>${c[1]}</th>`).join("")}<th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr>${logCols.map(c=>`<td>${esc(r[c[0]])}</td>`).join("")}<td><button data-editlog="${r.id}">編輯</button></td></tr>`).join("")}</tbody>`;document.querySelectorAll("[data-editlog]").forEach(b=>b.onclick=()=>editLog(b.dataset.editlog))}
$("logSearch").oninput=renderLogs;$("logMonth").onchange=renderLogs;$("addLog").onclick=()=>editLog(null);
function editLog(id){if(!canWrite())return alert("目前帳號沒有寫入權限");const row=id?state.logs.find(x=>x.id===id):{};openEditor("物流資料",logCols,row,async v=>{const key=id||`${v.shipmentNo}__${v.orderId}`;await setDoc(doc(db,"shipmentCosts",key),{...v,updatedAt:serverTimestamp()},{merge:true});await audit("shipmentCosts",key,id?"edit":"create",row,v);await loadLogs();renderLogs()})}
const vendorCols=[["vendorName","廠商名"],["defaultProject","預設專案"],["settlementType","結帳方式"],["resaleCommissionRate","代銷售抽成率"]];
function renderVendors(){$("vendorTable").innerHTML=`<thead><tr>${vendorCols.map(c=>`<th>${c[1]}</th>`).join("")}<th>操作</th></tr></thead><tbody>${state.vendors.map(r=>`<tr>${vendorCols.map(c=>`<td>${esc(r[c[0]])}</td>`).join("")}<td><button data-editvendor="${r.id}">編輯</button></td></tr>`).join("")}</tbody>`;document.querySelectorAll("[data-editvendor]").forEach(b=>b.onclick=()=>editVendor(b.dataset.editvendor))}
$("addVendor").onclick=()=>editVendor(null);function editVendor(id){if(!canWrite())return alert("目前帳號沒有寫入權限");const row=id?state.vendors.find(x=>x.id===id):{};openEditor("廠商設定",vendorCols,row,async v=>{const key=id||encodeURIComponent(v.vendorName||crypto.randomUUID());await setDoc(doc(db,"vendorSettlementSettings",key),{...v,updatedAt:serverTimestamp()},{merge:true});await audit("vendorSettlementSettings",key,id?"edit":"create",row,v);await loadVendors();renderVendors()})}

function normalizeVendorHeader(v){
  return clean(v).replace(/\s+/g,"").toLowerCase();
}
function normalizeRate(v){
  const raw=clean(v);
  if(!raw)return null;
  const hasPct=raw.includes("%")||raw.includes("％");
  const value=Number(raw.replace(/[%％,\s]/g,""));
  if(!Number.isFinite(value))return null;
  if(hasPct)return value/100;
  if(value>1)return value/100;
  return value;
}
function normalizeSettlementType(v){
  const s=clean(v);
  if(!s)return "";
  const key=s.replace(/\s+/g,"");
  if(["代銷售","代銷","resale"].includes(key.toLowerCase()))return "代銷售";
  if(["有抽成","抽成","commission"].includes(key.toLowerCase()))return "有抽成";
  if(["無抽成","不抽成","none"].includes(key.toLowerCase()))return "無抽成";
  return s;
}
async function readVendorImportFile(file){
  setVendorProgress(5,`讀取檔案：${file.name}`);
  const rows=await readWorkbook(file);
  setVendorProgress(20,`已讀取 ${rows.length.toLocaleString()} 列，辨識表頭…`);
  return rows;
}
$("vendorImportBtn").onclick=async()=>{
  if(!canWrite())return alert("目前帳號沒有寫入權限");
  const file=$("vendorImportFile").files?.[0];
  if(!file)return alert("請先選擇廠商設定檔");
  $("vendorImportBtn").disabled=true;
  $("vendorImportFile").disabled=true;
  try{
    const rows=await readVendorImportFile(file);
    if(!rows.length)throw new Error("檔案沒有資料");

    // 自動尋找前 20 列中的表頭，避免 Excel 前面有標題或空白列
    const aliases={
      vendorName:["廠商名","廠商名稱","vendor","vendorname","supplier","suppliername"],
      defaultProject:["預設專案","專案","專案類型","defaultproject","project"],
      settlementType:["結帳方式","結算方式","settlementtype","settlement"],
      resaleCommissionRate:["代銷售抽成率","代銷抽成率","抽成率","resalecommissionrate","commissionrate"]
    };
    let headerRow=-1, idx={};
    for(let r=0;r<Math.min(rows.length,20);r++){
      const normalized=(rows[r]||[]).map(normalizeVendorHeader);
      const mapIdx={};
      Object.entries(aliases).forEach(([key,list])=>{
        const targets=list.map(normalizeVendorHeader);
        const i=normalized.findIndex(h=>targets.includes(h));
        if(i>=0)mapIdx[key]=i;
      });
      if(mapIdx.vendorName!==undefined){
        headerRow=r;idx=mapIdx;break;
      }
    }
    if(headerRow<0)throw new Error("找不到「廠商名」表頭");
    setVendorProgress(30,`辨識表頭完成：第 ${headerRow+1} 列`);

    const parsed=[];
    const errors=[];
    for(let r=headerRow+1;r<rows.length;r++){
      const row=rows[r]||[];
      const vendorName=clean(row[idx.vendorName]);
      if(!vendorName)continue;
      const rawRate=idx.resaleCommissionRate!==undefined?row[idx.resaleCommissionRate]:"";
      const rate=clean(rawRate)===""?null:normalizeRate(rawRate);
      if(clean(rawRate)!==""&&rate===null){
        errors.push(`第 ${r+1} 列：代銷售抽成率「${rawRate}」無法辨識`);
        continue;
      }
      parsed.push({
        sourceRow:r+1,
        vendorName,
        defaultProject:idx.defaultProject!==undefined?clean(row[idx.defaultProject]):"",
        settlementType:idx.settlementType!==undefined?normalizeSettlementType(row[idx.settlementType]):"",
        resaleCommissionRate:rate
      });
    }
    if(!parsed.length)throw new Error("沒有可匯入的廠商資料");
    setVendorProgress(45,`解析完成：${parsed.length.toLocaleString()} 筆`);

    const existingByName=new Map(state.vendors.map(v=>[clean(v.vendorName).toLowerCase(),v]));
    const mode=$("vendorImportMode").value;
    const adds=[],updates=[],skips=[];
    parsed.forEach(item=>{
      const old=existingByName.get(item.vendorName.toLowerCase());
      if(!old){
        adds.push(item);
      }else if(mode==="update"){
        updates.push({...item,_old:old});
      }else{
        skips.push(item);
      }
    });

    $("vendorImportPreview").textContent=
`表頭：第 ${headerRow+1} 列
辨識欄位：${Object.keys(idx).join("、")}
總資料：${parsed.length}
預計新增：${adds.length}
預計更新：${updates.length}
既有跳過：${skips.length}
格式錯誤：${errors.length}${errors.length?`\n\n${errors.slice(0,8).join("\n")}${errors.length>8?`\n…另有 ${errors.length-8} 筆`:''}`:""}`;

    setVendorProgress(55,"等待確認");
    if(!confirm(`廠商設定匯入：新增 ${adds.length} 筆、更新 ${updates.length} 筆、跳過 ${skips.length} 筆。確定寫入？`)){
      setVendorProgress(0,"已取消");
      return;
    }

    const todo=[
      ...adds.map(x=>({type:"add",item:x})),
      ...updates.map(x=>({type:"update",item:x}))
    ];
    const chunkSize=200;
    for(let start=0;start<todo.length;start+=chunkSize){
      const chunk=todo.slice(start,start+chunkSize);
      const batch=writeBatch(db);
      chunk.forEach(op=>{
        const item=op.item;
        const old=op.type==="update"?item._old:null;
        const key=old?.id||encodeURIComponent(item.vendorName);
        const payload={vendorName:item.vendorName,updatedAt:serverTimestamp()};
        if(op.type==="add"){
          payload.defaultProject=item.defaultProject||"";
          payload.settlementType=item.settlementType||"";
          payload.resaleCommissionRate=item.resaleCommissionRate??null;
        }else{
          // 更新模式：空白不覆蓋
          if(item.defaultProject!=="")payload.defaultProject=item.defaultProject;
          if(item.settlementType!=="")payload.settlementType=item.settlementType;
          if(item.resaleCommissionRate!==null)payload.resaleCommissionRate=item.resaleCommissionRate;
        }
        batch.set(doc(db,"vendorSettlementSettings",key),payload,{merge:true});
      });
      await batch.commit();
      const done=Math.min(start+chunk.length,todo.length);
      setVendorProgress(60+35*(done/Math.max(1,todo.length)),`寫入資料庫 ${done} / ${todo.length}`);
    }

    await audit("vendorSettlementSettings","batch","import",{},{
      fileName:file.name,
      total:parsed.length,
      added:adds.length,
      updated:updates.length,
      skipped:skips.length,
      invalid:errors.length
    });

    await loadVendors();
    renderVendors();
    setVendorProgress(100,`完成：新增 ${adds.length}、更新 ${updates.length}、跳過 ${skips.length}、錯誤 ${errors.length}`);
    $("vendorImportFile").value="";
  }catch(e){
    console.error(e);
    setVendorProgress(100,"匯入失敗："+e.message);
  }finally{
    $("vendorImportBtn").disabled=false;
    $("vendorImportFile").disabled=false;
  }
};
function openEditor(title,cols,row,onSave){$("editTitle").textContent=title;$("editFields").innerHTML=cols.map(([k,l])=>`<label>${l}<input name="${k}" value="${esc(row?.[k]??"")}"></label>`).join("");$("editDialog").showModal();$("editSave").onclick=async e=>{e.preventDefault();const fd=new FormData($("editForm")),v={};cols.forEach(([k])=>v[k]=fd.get(k));await onSave(v);$("editDialog").close()}}
function readWorkbook(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{try{const wb=XLSX.read(r.result,{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]];resolve(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""}))}catch(e){reject(e)}};r.onerror=()=>reject(r.error);r.readAsArrayBuffer(file)})}
const map={"shipment date":"shipmentDate","shipment no.":"shipmentNo","reference":"orderId","service":"service","origin":"origin","destination":"destination","pieces":"pieces","weight (kg)":"chargeWeightKg","amount (twd)":"amountTWD"};
$("logImportBtn").onclick=async()=>{if(!canWrite())return alert("目前帳號沒有寫入權限");const file=$("logFile").files?.[0];if(!file)return alert("請先選檔");try{setProgress(5,"讀取檔案");const rows=await readWorkbook(file);setProgress(20,"讀取第15列表頭");const header=(rows[14]||[]).map(x=>clean(x).replace(/\s+/g," ").toLowerCase()),idx={};header.forEach((h,i)=>{if(map[h])idx[map[h]]=i});const req=Object.values(map),missing=req.filter(k=>idx[k]===undefined);if(missing.length)throw new Error("缺少必要欄位："+missing.join(", "));setProgress(35,"解析資料");const data=rows.slice(15).map((r,i)=>({sourceRow:i+16,shipmentDate:clean(r[idx.shipmentDate]),shipmentNo:clean(r[idx.shipmentNo]),orderId:clean(r[idx.orderId]),service:clean(r[idx.service]),origin:clean(r[idx.origin]),destination:clean(r[idx.destination]),pieces:num(r[idx.pieces]),chargeWeightKg:num(r[idx.chargeWeightKg]),amountTWD:num(r[idx.amountTWD])})).filter(x=>x.shipmentNo||x.orderId);const invalid=data.filter(x=>!x.shipmentNo||!x.orderId||x.amountTWD<0),valid=data.filter(x=>!invalid.includes(x)),existing=new Set(state.logs.map(x=>`${x.shipmentNo}__${x.orderId}`)),mode=$("logMode").value,add=valid.filter(x=>!existing.has(`${x.shipmentNo}__${x.orderId}`)),upd=mode==="update"?valid.filter(x=>existing.has(`${x.shipmentNo}__${x.orderId}`)):[],dup=valid.length-add.length-upd.length;$("logPreview").textContent=`總資料 ${data.length}\n預計新增 ${add.length}\n預計更新 ${upd.length}\n重複跳過 ${dup}\n異常 ${invalid.length}`;if(!confirm("確認寫入物流資料庫？"))return setProgress(0,"已取消");const todo=[...add,...upd],chunk=250;for(let i=0;i<todo.length;i+=chunk){const b=writeBatch(db);todo.slice(i,i+chunk).forEach(x=>{const key=`${x.shipmentNo}__${x.orderId}`,y={...x};delete y.sourceRow;b.set(doc(db,"shipmentCosts",key),{...y,updatedAt:serverTimestamp()},{merge:true})});await b.commit();setProgress(55+40*Math.min(1,(i+chunk)/Math.max(1,todo.length)),`寫入 ${Math.min(i+chunk,todo.length)} / ${todo.length}`)}await audit("shipmentCosts","batch","import",{}, {fileName:file.name,added:add.length,updated:upd.length,duplicate:dup,invalid:invalid.length});setProgress(100,`完成：新增 ${add.length}，更新 ${upd.length}，重複 ${dup}，異常 ${invalid.length}`);await loadLogs();renderLogs()}catch(e){console.error(e);setProgress(100,"匯入失敗："+e.message)}};
$("fxBuy").oninput=$("fxSell").oninput=()=>{const a=num($("fxBuy").value),b=num($("fxSell").value);$("fxAvg").value=a&&b?((a+b)/2).toFixed(6):""};
$("saveParams").onclick=async()=>{if(!canWrite())return alert("目前帳號沒有寫入權限");const month=$("paramMonth").value;if(!month)return alert("請選月份");const p={month,fxType:$("fxType").value,fxBuy:num($("fxBuy").value),fxSell:num($("fxSell").value),fxAvg:num($("fxAvg").value),rakutenFeeRate:num($("rakutenRate").value),warehouseTotalTWD:num($("warehouseTotal").value),locked:$("locked").value==="true",updatedAt:serverTimestamp()};await setDoc(doc(db,"monthlySettlementParams",month),p,{merge:true});await audit("monthlySettlementParams",month,"save",{},p);alert("已儲存")};
$("runAudit").onclick=()=>{const out=[];if(!state.user)out.push("⚠ 尚未登入");if(state.logs.some(x=>!x.orderId))out.push("⚠ 物流資料存在缺少訂單編號");if(!state.vendors.length)out.push("⚠ 尚未建立廠商結算設定");if(!out.length)out.push("✓ 基礎資料檢查完成");$("auditResults").innerHTML=out.map(x=>`<p>${esc(x)}</p>`).join("")};
async function audit(collectionName,documentId,action,before,after){if(!state.user)return;await addDoc(collection(db,"auditLogs"),{collectionName,documentId,action,before,after,userId:state.user.uid,userEmail:state.user.email,createdAt:serverTimestamp()})}
function exportRows(rows,cols,name){const aoa=[cols.map(c=>c[1]),...rows.map(r=>cols.map(c=>r[c[0]]??""))],ws=XLSX.utils.aoa_to_sheet(aoa),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Data");XLSX.writeFile(wb,name)}
$("logExport").onclick=()=>exportRows(state.logs,logCols,"shipment-costs.xlsx");$("vendorExport").onclick=()=>exportRows(state.vendors,vendorCols,"vendor-settings.xlsx");$("monthlyExport").onclick=()=>{const rows=monthlyFilteredRows();const cols=MONTHLY_COLS.filter(c=>!["select","action"].includes(c.key)).map(c=>[c.key,c.label]);exportRows(rows,cols,"vendor-settlement-monthly.xlsx")};$("exportLog").onclick=$("logExport").onclick;$("exportVendor").onclick=$("vendorExport").onclick;$("exportMonthly").onclick=$("monthlyExport").onclick;
