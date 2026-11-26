import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,setPersistence,browserSessionPersistence,onAuthStateChanged,signInWithEmailAndPassword,sendPasswordResetEmail,signOut} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,doc,getDocFromServer,runTransaction} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),store=getFirestore(app);
const by=id=>document.getElementById(id),say=t=>by('message').textContent=t;
const root=doc(store,'vendorSettlementV2','workspace'),part=i=>doc(root,'parts',String(i));
const blank=()=>({platforms:['日本樂天','Shopify','NETSEA','Tiktok'],projects:['台灣精品','數商案','桃園好農','NS案','代銷售'],params:{},entries:[],catalog:[],vendors:[],vendorCosts:[]});
let revision=0,chunks=[],last=null,role='',busy=false,epoch=0;
function lock(){by('workspace').hidden=true;by('gate').hidden=false;document.querySelector('dialog[open]')?.close();role='';last=null;chunks=[];installState(blank());by('content').replaceChildren();by('password').value=''}
const leave=async()=>{++epoch;lock();await signOut(auth);location.reload()};
by('logout').onclick=leave;by('switchUser').onclick=leave;
by('login').onsubmit=async e=>{e.preventDefault();say('正在登入…');try{await setPersistence(auth,browserSessionPersistence);await signInWithEmailAndPassword(auth,by('email').value.trim(),by('password').value)}catch{say('登入失敗。請確認電子郵件、密碼及網路連線。')}};
by('reset').onclick=async()=>{if(!by('email').reportValidity())return;try{await sendPasswordResetEmail(auth,by('email').value.trim());say('若此帳號可重設密碼，請檢查信箱與垃圾郵件。')}catch{say('無法寄出重設信，請確認信箱或聯絡管理員。')}};
onAuthStateChanged(auth,async user=>{const ticket=++epoch;lock();by('login').hidden=!!user;by('switchUser').hidden=!user;if(!user){say('');return}say('正在確認權限與讀取資料…');
try{const member=await getDocFromServer(doc(store,'vendorSettlementMembers',user.uid));const access=member.data()?.role;if(!['admin','manager','viewer'].includes(access))throw Error();
const meta=await getDocFromServer(root),version=meta.data()?.version||0,count=meta.data()?.count||0;
const pieces=await Promise.all(Array.from({length:count},async(_,i)=>(await getDocFromServer(part(i))).data().text));
if(((await getDocFromServer(root)).data()?.version||0)!==version)throw Error();
const state=count?JSON.parse(pieces.join('')):blank();if(ticket!==epoch)return;role=access;revision=version;chunks=pieces;last=state;startWorkspace(state,role);by('gate').hidden=true;by('workspace').hidden=false
}catch{if(ticket===epoch)say('無法開啟工作台。請確認成員 UID、角色、Firestore 規則與網路後重新整理。')}});
window.commitSettlement=async state=>{const ticket=epoch,uid=auth.currentUser?.uid;
if(!last||!uid||busy||!['admin','manager'].includes(role)){if(last)installState(last);throw Error('目前無寫入權限或正在儲存。')}
busy=true;document.body.inert=true;
try{const text=JSON.stringify(state),pieces=text.match(/[\s\S]{1,90000}/gu)||[],changes=pieces.map((t,i)=>t!==chunks[i]?i:-1).filter(i=>i>=0);
if(changes.length+Math.max(0,chunks.length-pieces.length)>450)throw Error('本次變更過大，請分批匯入。');
await runTransaction(store,async tx=>{const ref=await tx.get(root);if((ref.data()?.version||0)!==revision)throw Error('其他人已更新資料，請重新整理後再操作。');
changes.forEach(i=>tx.set(part(i),{text:pieces[i]}));for(let i=pieces.length;i<chunks.length;i++)tx.delete(part(i));tx.set(root,{version:revision+1,count:pieces.length})});
if(ticket!==epoch)return;revision++;chunks=pieces;last=state
}catch(e){if(ticket===epoch&&last){installState(last);alert('儲存未完成。'+e.message)}throw e}finally{busy=false;document.body.inert=false}};
