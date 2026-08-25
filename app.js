import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, addDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const clean=v=>String(v??"").trim(),num=v=>Number(String(v??"").replace(/[,，NT$￥¥\s]/g,""))||0,esc=v=>String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));
let state={user:null,role:"viewer",sales:[],logs:[],vendors:[]};
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
async function refresh(){await Promise.all([loadSales(),loadLogs(),loadVendors()]);renderOverview();renderMonthly();renderLogs();renderVendors()}
async function loadSales(){const s=await getDocs(collection(db,"sales"));state.sales=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadLogs(){const s=await getDocs(collection(db,"shipmentCosts"));state.logs=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadVendors(){const s=await getDocs(collection(db,"vendorSettlementSettings"));state.vendors=s.docs.map(d=>({id:d.id,...d.data()}))}
function renderOverview(){const sales=state.sales.reduce((a,x)=>a+num(x.revenue),0),ship=state.logs.reduce((a,x)=>a+num(x.amountTWD),0);$("overviewKpis").innerHTML=[["銷售筆數",state.sales.length],["銷售收入(JPY)",Math.round(sales).toLocaleString()],["物流筆數",state.logs.length],["物流總運費(TWD)",Math.round(ship).toLocaleString()]].map(([k,v])=>`<div class="kpi">${k}<b>${v}</b></div>`).join("")}
function renderMonthly(){const cols=[["month","月份"],["orderId","訂單編號"],["productId","SKU"],["productName","商品名"],["quantity","件數"],["revenue","銷售額(JPY)"]];let q=clean($("monthlySearch").value).toLowerCase(),rows=state.sales.filter(x=>!q||clean(x.orderId).toLowerCase().includes(q)||clean(x.productId).toLowerCase().includes(q));$("monthlyTable").innerHTML=`<thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c[0]])}</td>`).join("")}</tr>`).join("")}</tbody>`}
$("monthlySearch").oninput=renderMonthly;$("monthlyRefresh").onclick=async()=>{await loadSales();renderMonthly()};
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
$("logExport").onclick=()=>exportRows(state.logs,logCols,"shipment-costs.xlsx");$("vendorExport").onclick=()=>exportRows(state.vendors,vendorCols,"vendor-settings.xlsx");$("monthlyExport").onclick=()=>exportRows(state.sales,[["month","月份"],["orderId","訂單編號"],["productId","SKU"],["productName","商品名"],["quantity","件數"],["revenue","銷售額"]],"monthly-sales.xlsx");$("exportLog").onclick=$("logExport").onclick;$("exportVendor").onclick=$("vendorExport").onclick;$("exportMonthly").onclick=$("monthlyExport").onclick;
