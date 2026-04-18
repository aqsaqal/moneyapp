import { useState, useEffect, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Home, Plus, List, Target, ArrowUpRight, ArrowDownLeft, Wallet, CreditCard,
  PiggyBank, Banknote, Coffee, ShoppingCart, Car, Utensils, Zap, Heart,
  Star, BookOpen, Plane, Gift, Briefcase, TrendingUp, TrendingDown,
  X, Check, Trash2, Calendar, BarChart3, DollarSign,
  Wifi, Smartphone, Activity, ArrowRightLeft,
  MoreHorizontal, Edit3, AlertTriangle, Package, Droplet, FileText,
  ChevronRight, RefreshCw, CheckCircle, Circle
} from "lucide-react";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
--bg:#08080F;--bg1:#0E0E18;--bg2:#161622;--bg3:#1E1E2E;--bg4:#282840;
--ac:#00E09E;--acd:#00E09E20;--acm:#00E09E44;
--inc:#00E09E;--exp:#FF6B8A;--warn:#FFBE44;--ind:#818CF8;--trf:#60A5FA;
--t1:#EAEAF2;--t2:#8888AA;--t3:#55556A;--brd:#252538;
}
body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased}
.fd{font-family:'Outfit',sans-serif}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes popIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes checkPop{0%{transform:scale(0) rotate(-45deg);opacity:0}50%{transform:scale(1.3) rotate(0deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
@keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(-80px) rotate(360deg);opacity:0}}
@keyframes pulseRing{0%{box-shadow:0 0 0 0 var(--acm)}70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}
@keyframes streakGlow{0%,100%{text-shadow:0 0 8px rgba(255,190,68,.3)}50%{text-shadow:0 0 16px rgba(255,190,68,.6)}}
@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.afu{animation:fadeUp .35s ease-out both}
.asu{animation:slideUp .3s cubic-bezier(.16,1,.3,1) both}
.asi{animation:slideIn .3s ease-out both}
.nb:active{transform:scale(.9);background:var(--bg4)}
.cb:active{transform:scale(.94)}
.gl{background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid var(--brd)}
.ns::-webkit-scrollbar{display:none}.ns{-ms-overflow-style:none;scrollbar-width:none}
.streak-glow{animation:streakGlow 2s ease-in-out infinite}
.success-overlay{position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;pointer-events:none}
.success-check{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;animation:checkPop .5s cubic-bezier(.16,1,.3,1) both}
.confetti-dot{position:absolute;width:8px;height:8px;border-radius:50%;animation:confetti .8s ease-out both}
`;

const ECAT = [
  {id:"food",name:"Food",icon:"Utensils",color:"#FF6B8A"},
  {id:"transport",name:"Transport",icon:"Car",color:"#818CF8"},
  {id:"shopping",name:"Shopping",icon:"ShoppingCart",color:"#FFBE44"},
  {id:"coffee",name:"Coffee",icon:"Coffee",color:"#C084FC"},
  {id:"bills",name:"Bills",icon:"Zap",color:"#F97316"},
  {id:"health",name:"Health",icon:"Heart",color:"#34D399"},
  {id:"entertainment",name:"Fun",icon:"Star",color:"#FB7185"},
  {id:"education",name:"Education",icon:"BookOpen",color:"#60A5FA"},
  {id:"travel",name:"Travel",icon:"Plane",color:"#2DD4BF"},
  {id:"gifts",name:"Gifts",icon:"Gift",color:"#E879F9"},
  {id:"fuel",name:"Fuel",icon:"Droplet",color:"#FBBF24"},
  {id:"internet",name:"Internet",icon:"Wifi",color:"#38BDF8"},
  {id:"phone",name:"Phone",icon:"Smartphone",color:"#A78BFA"},
  {id:"rent",name:"Rent",icon:"Home",color:"#FB923C"},
  {id:"clothing",name:"Clothing",icon:"Package",color:"#F472B6"},
  {id:"fitness",name:"Fitness",icon:"Activity",color:"#4ADE80"},
  {id:"subs",name:"Subs",icon:"FileText",color:"#38BDF8"},
  {id:"other",name:"Other",icon:"MoreHorizontal",color:"#8888AA"},
];
const ICAT = [
  {id:"salary",name:"Salary",icon:"Briefcase",color:"#00E09E"},
  {id:"freelance",name:"Freelance",icon:"Edit3",color:"#60A5FA"},
  {id:"investment",name:"Investment",icon:"TrendingUp",color:"#818CF8"},
  {id:"gift_in",name:"Gift",icon:"Gift",color:"#E879F9"},
  {id:"refund",name:"Refund",icon:"ArrowRightLeft",color:"#FFBE44"},
  {id:"other_in",name:"Other",icon:"MoreHorizontal",color:"#8888AA"},
];
const IM = {Utensils,Car,ShoppingCart,Coffee,Zap,Heart,Star,BookOpen,Plane,Gift,Droplet,Wifi,Smartphone,Home,Package,Activity,FileText,MoreHorizontal,Briefcase,Edit3,TrendingUp,ArrowRightLeft};
const AIM = {Wallet,CreditCard,PiggyBank,Banknote};

const DA = [
  {id:"cash",name:"Cash",type:"cash",icon:"Wallet",color:"#00E09E",balance:500},
  {id:"bank",name:"Bank",type:"bank",icon:"Banknote",color:"#818CF8",balance:3200},
  {id:"credit",name:"Credit Card",type:"credit",icon:"CreditCard",color:"#FF6B8A",balance:-450,limit:5000},
  {id:"savings",name:"Savings",type:"savings",icon:"PiggyBank",color:"#FFBE44",balance:8500},
];
const DBUDGETS = [{id:"b1",category:"food",limit:500},{id:"b2",category:"transport",limit:200},{id:"b3",category:"shopping",limit:300},{id:"b4",category:"entertainment",limit:150},{id:"b5",category:"coffee",limit:80}];

// Default recurring items
const DRECURRING = [
  {id:"r1",name:"Netflix",amount:15.99,type:"expense",category:"subs",account:"credit",dueDay:15,icon:"Star",color:"#E50914"},
  {id:"r2",name:"Claude Pro",amount:20,type:"expense",category:"subs",account:"credit",dueDay:1,icon:"Star",color:"#D4A27F"},
  {id:"r3",name:"Spotify",amount:11.99,type:"expense",category:"subs",account:"credit",dueDay:22,icon:"Star",color:"#1DB954"},
  {id:"r4",name:"Rent",amount:1500,type:"expense",category:"rent",account:"bank",dueDay:1,icon:"Home",color:"#FB923C"},
  {id:"r5",name:"Internet",amount:65,type:"expense",category:"internet",account:"bank",dueDay:5,icon:"Wifi",color:"#38BDF8"},
  {id:"r6",name:"Phone Plan",amount:45,type:"expense",category:"phone",account:"bank",dueDay:12,icon:"Smartphone",color:"#A78BFA"},
  {id:"r7",name:"Gym",amount:39.99,type:"expense",category:"fitness",account:"bank",dueDay:1,icon:"Activity",color:"#4ADE80"},
  {id:"r8",name:"Monthly Salary",amount:3500,type:"income",category:"salary",account:"bank",dueDay:1,icon:"Briefcase",color:"#00E09E"},
  {id:"r9",name:"Rental Income",amount:800,type:"income",category:"investment",account:"bank",dueDay:5,icon:"TrendingUp",color:"#818CF8"},
];

const SEED = (()=>{
  const t=[];const now=new Date();
  const c=["food","transport","shopping","coffee","bills","entertainment","health","fuel","subs","clothing"];
  const a=[12.5,8.99,45,5.75,120,25,35,55,14.99,89,6.5,18,32,4.25,150,22.5,9.99,67,3.5,42];
  const n=["Lunch","Uber","Amazon","Starbucks","Electric","Netflix","Pharmacy","Gas","Spotify","H&M","Latte","Pizza","Groceries","Tea","Insurance","Dinner","iTunes","Shoes","Snack","Books"];
  for(let i=0;i<25;i++){const d=new Date(now);d.setDate(d.getDate()-Math.floor(Math.random()*28));
    t.push({id:`s${i}`,amount:a[i%a.length],type:"expense",category:c[i%c.length],account:i%3===0?"credit":i%2===0?"bank":"cash",date:d.toISOString(),note:n[i%n.length]});}
  for(let i=0;i<20;i++){const d=new Date(now);d.setMonth(d.getMonth()-1);d.setDate(1+Math.floor(Math.random()*28));
    t.push({id:`lm${i}`,amount:a[(i+3)%a.length],type:"expense",category:c[i%c.length],account:"bank",date:d.toISOString(),note:n[(i+5)%n.length]});}
  for(let i=0;i<3;i++){const d=new Date(now);d.setDate(1+i*10);
    t.push({id:`si${i}`,amount:i===0?3500:i===1?450:200,type:"income",category:i===0?"salary":i===1?"freelance":"investment",account:"bank",date:d.toISOString(),note:i===0?"Salary":i===1?"Design gig":"Dividends"});}
  t.push({id:"st0",type:"transfer",amount:200,fromAccount:"bank",toAccount:"savings",date:new Date(now.getFullYear(),now.getMonth(),5).toISOString(),note:"Monthly savings"});
  return t;
})();

const fmt=n=>`$${Math.abs(n).toFixed(2)}`;
const fmts=n=>Math.abs(n)>=1000?`$${(n/1000).toFixed(1)}k`:`$${Math.abs(n).toFixed(0)}`;
const dayStr=d=>{const dt=new Date(d),td=new Date(),yd=new Date();yd.setDate(yd.getDate()-1);if(dt.toDateString()===td.toDateString())return"Today";if(dt.toDateString()===yd.toDateString())return"Yesterday";return dt.toLocaleDateString("en",{month:"short",day:"numeric"});};
const catInfo=(id,type="expense")=>(type==="income"?ICAT:ECAT).find(c=>c.id===id)||{name:id,icon:"MoreHorizontal",color:"#8888AA"};
const SK="moneyflow:v4";

export default function App(){
  const [ready,setReady]=useState(false);
  const [txns,setTxns]=useState([]);
  const [accts,setAccts]=useState(DA);
  const [budgets,setBudgets]=useState(DBUDGETS);
  const [recurring,setRecurring]=useState(DRECURRING);
  const [paidIds,setPaidIds]=useState({}); // { "2026-3": ["r1","r2"] } - tracks which recurring items paid per month
  const [tab,setTab]=useState("home");
  const [showAdd,setShowAdd]=useState(false);
  const [addMode,setAddMode]=useState("expense");
  const [amt,setAmt]=useState("0");
  const [selCat,setSelCat]=useState(null);
  const [selAcct,setSelAcct]=useState("cash");
  const [note,setNote]=useState("");
  const [fromAcct,setFromAcct]=useState("bank");
  const [toAcct,setToAcct]=useState("credit");
  const [filterCat,setFilterCat]=useState(null);
  const [editBudget,setEditBudget]=useState(null);
  const [budgetInput,setBudgetInput]=useState("");
  const [showCatPick,setShowCatPick]=useState(false);
  const [moreTab,setMoreTab]=useState("recurring");
  const [showSuccess,setShowSuccess]=useState(false);
  const [streak,setStreak]=useState(5);
  const [catDetailId,setCatDetailId]=useState(null);
  // Add recurring modal
  const [showAddRec,setShowAddRec]=useState(false);
  const [recName,setRecName]=useState("");
  const [recAmt,setRecAmt]=useState("");
  const [recType,setRecType]=useState("expense");
  const [recCat,setRecCat]=useState("subs");
  const [recAcct,setRecAcct]=useState("bank");
  const [recDay,setRecDay]=useState("1");
  const [editRecId,setEditRecId]=useState(null);

  const now=new Date();const mo=now.getMonth(),yr=now.getFullYear();
  const moKey=`${yr}-${mo}`;

  // Load
  useEffect(()=>{
    let done=false;
    const load=async()=>{
      try{
        if(window.storage&&typeof window.storage.get==='function'){
          const r=await Promise.race([window.storage.get(SK),new Promise((_,rej)=>setTimeout(()=>rej('timeout'),2000))]);
          if(r&&r.value){const d=JSON.parse(r.value);setTxns(d.txns||SEED);setAccts(d.accts||DA);setBudgets(d.budgets||DBUDGETS);setRecurring(d.recurring||DRECURRING);setPaidIds(d.paidIds||{});setStreak(d.streak||5);}
          else{setTxns(SEED);setStreak(5);}
        }else{setTxns(SEED);setStreak(5);}
      }catch(e){setTxns(SEED);setStreak(5);}
      if(!done){done=true;setReady(true);}
    };
    load();
    const timer=setTimeout(()=>{if(!done){done=true;setTxns(p=>p.length?p:SEED);setStreak(s=>s||5);setReady(true);}},3000);
    return()=>clearTimeout(timer);
  },[]);

  const save=useCallback(async(t,a,b,r,p,s)=>{try{if(window.storage&&typeof window.storage.set==='function')await window.storage.set(SK,JSON.stringify({txns:t,accts:a,budgets:b,recurring:r,paidIds:p,streak:s}));}catch(e){}},[]);
  useEffect(()=>{if(ready)save(txns,accts,budgets,recurring,paidIds,streak);},[txns,accts,budgets,recurring,paidIds,streak,ready,save]);

  // Computed
  const moTxns=useMemo(()=>txns.filter(t=>{const d=new Date(t.date);return d.getMonth()===mo&&d.getFullYear()===yr&&t.type!=="transfer";}),[txns,mo,yr]);
  const lastMoTxns=useMemo(()=>{const lm=mo===0?11:mo-1;const ly=mo===0?yr-1:yr;return txns.filter(t=>{const d=new Date(t.date);return d.getMonth()===lm&&d.getFullYear()===ly&&t.type!=="transfer";});},[txns,mo,yr]);
  const totExp=useMemo(()=>moTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),[moTxns]);
  const totInc=useMemo(()=>moTxns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),[moTxns]);
  const netBal=useMemo(()=>accts.reduce((s,a)=>s+a.balance,0),[accts]);
  const lastTotExp=useMemo(()=>lastMoTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),[lastMoTxns]);

  // Recurring computed
  const curPaid=useMemo(()=>paidIds[moKey]||[],[paidIds,moKey]);
  const recExpenses=useMemo(()=>recurring.filter(r=>r.type==="expense"),[recurring]);
  const recIncome=useMemo(()=>recurring.filter(r=>r.type==="income"),[recurring]);
  const totalFixedExp=useMemo(()=>recExpenses.reduce((s,r)=>s+r.amount,0),[recExpenses]);
  const totalFixedInc=useMemo(()=>recIncome.reduce((s,r)=>s+r.amount,0),[recIncome]);
  const unpaidExp=useMemo(()=>recExpenses.filter(r=>!curPaid.includes(r.id)),[recExpenses,curPaid]);
  const unpaidInc=useMemo(()=>recIncome.filter(r=>!curPaid.includes(r.id)),[recIncome,curPaid]);
  const remainingBills=useMemo(()=>unpaidExp.reduce((s,r)=>s+r.amount,0),[unpaidExp]);
  const disposable=useMemo(()=>totInc-totalFixedExp-moTxns.filter(t=>t.type==="expense"&&!recurring.some(r=>r.category===t.category&&r.amount===t.amount)).reduce((s,t)=>s+t.amount,0),[totInc,totalFixedExp,moTxns,recurring]);

  const expByCat=useMemo(()=>{
    const m={};moTxns.filter(t=>t.type==="expense").forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount;});
    const lm={};lastMoTxns.filter(t=>t.type==="expense").forEach(t=>{lm[t.category]=(lm[t.category]||0)+t.amount;});
    return Object.entries(m).map(([c,v])=>{const prev=lm[c]||0;const change=prev>0?((v-prev)/prev)*100:null;return{...catInfo(c),value:v,category:c,prev,change};}).sort((a,b)=>b.value-a.value);
  },[moTxns,lastMoTxns]);

  const dailySpend=useMemo(()=>{
    const m={};const dim=new Date(yr,mo+1,0).getDate();for(let i=1;i<=dim;i++)m[i]=0;
    moTxns.filter(t=>t.type==="expense").forEach(t=>{m[new Date(t.date).getDate()]+=t.amount;});
    let cum=0;return Object.entries(m).map(([d,v])=>{cum+=v;return{day:+d,amount:v,cumulative:cum};});
  },[moTxns,mo,yr]);

  const frequentTxns=useMemo(()=>{
    const freq={};txns.filter(t=>t.type==="expense").forEach(t=>{
      const key=`${t.category}|${t.account}|${Math.round(t.amount)}|${t.note}`;
      if(!freq[key])freq[key]={count:0,category:t.category,account:t.account,amount:t.amount,note:t.note};freq[key].count++;
    });
    return Object.values(freq).sort((a,b)=>b.count-a.count).slice(0,4);
  },[txns]);

  const calcStreak=useCallback(()=>{const days=new Set();txns.forEach(t=>days.add(new Date(t.date).toDateString()));let s=0;const d=new Date();while(days.has(d.toDateString())){s++;d.setDate(d.getDate()-1);}return s;},[txns]);

  const numpad=k=>{if(k==="C"){setAmt("0");return;}if(k==="del"){setAmt(a=>a.length<=1?"0":a.slice(0,-1));return;}if(k==="."){if(!amt.includes("."))setAmt(a=>a+".");return;}setAmt(a=>a==="0"?k:a+k);};
  const triggerSuccess=()=>{setShowSuccess(true);setTimeout(()=>setShowSuccess(false),900);};

  // Mark recurring as paid → creates a real transaction
  const markPaid=(rec)=>{
    const newTxn={id:`t${Date.now()}`,amount:rec.amount,type:rec.type,category:rec.category,account:rec.account,date:new Date().toISOString(),note:rec.name,recurring:rec.id};
    setTxns(p=>[newTxn,...p]);
    setAccts(p=>p.map(a=>{if(a.id===rec.account)return{...a,balance:a.balance+(rec.type==="income"?rec.amount:-rec.amount)};return a;}));
    setPaidIds(p=>({...p,[moKey]:[...(p[moKey]||[]),rec.id]}));
    triggerSuccess();
  };

  const unmarkPaid=(rec)=>{
    const txn=txns.find(t=>t.recurring===rec.id&&new Date(t.date).getMonth()===mo&&new Date(t.date).getFullYear()===yr);
    if(txn){
      setAccts(p=>p.map(a=>{if(a.id===txn.account)return{...a,balance:a.balance+(txn.type==="income"?-txn.amount:txn.amount)};return a;}));
      setTxns(p=>p.filter(t=>t.id!==txn.id));
    }
    setPaidIds(p=>({...p,[moKey]:(p[moKey]||[]).filter(id=>id!==rec.id)}));
  };

  const submit=()=>{
    const v=parseFloat(amt);if(!v)return;
    if(addMode==="transfer"){
      if(fromAcct===toAcct)return;
      setTxns(p=>[{id:`t${Date.now()}`,type:"transfer",amount:v,fromAccount:fromAcct,toAccount:toAcct,date:new Date().toISOString(),note},...p]);
      setAccts(p=>p.map(a=>{if(a.id===fromAcct)return{...a,balance:a.balance-v};if(a.id===toAcct)return{...a,balance:a.balance+v};return a;}));
    }else{
      if(!selCat)return;
      setTxns(p=>[{id:`t${Date.now()}`,amount:v,type:addMode,category:selCat,account:selAcct,date:new Date().toISOString(),note},...p]);
      setAccts(p=>p.map(a=>{if(a.id===selAcct)return{...a,balance:a.balance+(addMode==="income"?v:-v)};return a;}));
    }
    setStreak(calcStreak()+1);triggerSuccess();setAmt("0");setSelCat(null);setNote("");setShowAdd(false);
  };

  const quickAdd=(q)=>{
    setTxns(p=>[{id:`t${Date.now()}`,amount:q.amount,type:"expense",category:q.category,account:q.account,date:new Date().toISOString(),note:q.note},...p]);
    setAccts(p=>p.map(a=>{if(a.id===q.account)return{...a,balance:a.balance-q.amount};return a;}));
    setStreak(calcStreak()+1);triggerSuccess();setShowAdd(false);
  };

  const delTxn=id=>{const t=txns.find(x=>x.id===id);if(!t)return;
    if(t.type==="transfer"){setAccts(p=>p.map(a=>{if(a.id===t.fromAccount)return{...a,balance:a.balance+t.amount};if(a.id===t.toAccount)return{...a,balance:a.balance-t.amount};return a;}));}
    else{setAccts(p=>p.map(a=>{if(a.id===t.account)return{...a,balance:a.balance+(t.type==="income"?-t.amount:t.amount)};return a;}));}
    setTxns(p=>p.filter(x=>x.id!==id));
  };

  const addRecurring=()=>{
    const v=parseFloat(recAmt);if(!v||!recName)return;
    const item={id:editRecId||`r${Date.now()}`,name:recName,amount:v,type:recType,category:recCat,account:recAcct,dueDay:parseInt(recDay)||1,icon:catInfo(recCat,recType).icon,color:catInfo(recCat,recType).color};
    if(editRecId){setRecurring(p=>p.map(r=>r.id===editRecId?item:r));}
    else{setRecurring(p=>[...p,item]);}
    setRecName("");setRecAmt("");setRecCat("subs");setRecDay("1");setShowAddRec(false);setEditRecId(null);
  };

  const delRecurring=id=>{setRecurring(p=>p.filter(r=>r.id!==id));};

  const sorted=useMemo(()=>[...txns].sort((a,b)=>new Date(b.date)-new Date(a.date)),[txns]);
  const filtered=useMemo(()=>filterCat?sorted.filter(t=>t.category===filterCat):sorted,[sorted,filterCat]);
  const grouped=useMemo(()=>{const g={};filtered.forEach(t=>{const k=dayStr(t.date);if(!g[k])g[k]=[];g[k].push(t);});return Object.entries(g);},[filtered]);

  /* ─── Components ─── */
  const TxRow=({t,showDel})=>{
    if(t.type==="transfer"){const fr=accts.find(a=>a.id===t.fromAccount);const to=accts.find(a=>a.id===t.toAccount);
      return(<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid var(--brd)"}}>
        <div style={{width:36,height:36,borderRadius:10,background:"rgba(96,165,250,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><RefreshCw size={16} color="var(--trf)"/></div>
        <div style={{flex:1,minWidth:0}}><p style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.note||"Transfer"}</p><p style={{fontSize:10,color:"var(--t3)"}}>{fr?.name}→{to?.name}</p></div>
        <p style={{fontSize:14,fontWeight:700,color:"var(--trf)",flexShrink:0}}>{fmt(t.amount)}</p>
        {showDel&&<button onClick={()=>delTxn(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:3,opacity:.3}}><Trash2 size={12} color="var(--exp)"/></button>}
      </div>);}
    const cat=catInfo(t.category,t.type);const IC=IM[cat.icon]||MoreHorizontal;const isE=t.type==="expense";
    return(<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid var(--brd)"}}>
      <div style={{width:36,height:36,borderRadius:10,background:`${cat.color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><IC size={16} color={cat.color}/></div>
      <div style={{flex:1,minWidth:0}}><p style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.note||cat.name}</p><p style={{fontSize:10,color:"var(--t3)"}}>{cat.name} · {dayStr(t.date)}{t.recurring?" · ↻":""}</p></div>
      <p style={{fontSize:14,fontWeight:700,color:isE?"var(--exp)":"var(--inc)",flexShrink:0}}>{isE?"-":"+"}{fmt(t.amount)}</p>
      {showDel&&<button onClick={()=>delTxn(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:3,opacity:.3}}><Trash2 size={12} color="var(--exp)"/></button>}
    </div>);
  };

  const SuccessOverlay=()=>{if(!showSuccess)return null;const colors=["#00E09E","#818CF8","#FFBE44","#FF6B8A","#E879F9","#60A5FA"];
    return(<div className="success-overlay">{colors.map((c,i)=><div key={i} className="confetti-dot" style={{background:c,left:`${30+Math.random()*40}%`,top:`${35+Math.random()*20}%`,animationDelay:`${i*0.08}s`,width:6+Math.random()*6,height:6+Math.random()*6}}/>)}<div className="success-check" style={{background:"var(--ac)"}}><Check size={36} color="#08080F" strokeWidth={3}/></div></div>);
  };

  /* ═══ RECURRING ITEM ROW ═══ */
  const RecRow=({r,compact})=>{
    const paid=curPaid.includes(r.id);
    const IC=IM[r.icon]||MoreHorizontal;
    const isExp=r.type==="expense";
    const daysUntil=(()=>{const due=new Date(yr,mo,r.dueDay);if(due<now)due.setMonth(due.getMonth()+1);const diff=Math.ceil((due-now)/(1000*60*60*24));return diff;})();
    return(
      <div style={{display:"flex",alignItems:"center",gap:compact?8:10,padding:compact?"8px 0":"10px 0",borderBottom:"1px solid var(--brd)",opacity:paid?.6:1}}>
        <button onClick={()=>paid?unmarkPaid(r):markPaid(r)} style={{background:"none",border:"none",cursor:"pointer",flexShrink:0,padding:0}}>
          {paid?<CheckCircle size={compact?20:22} color="var(--ac)"/>:<Circle size={compact?20:22} color="var(--t3)"/>}
        </button>
        <div style={{width:compact?28:34,height:compact?28:34,borderRadius:8,background:`${r.color||catInfo(r.category,r.type).color}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <IC size={compact?13:15} color={r.color||catInfo(r.category,r.type).color}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:compact?12:13,fontWeight:600,textDecoration:paid?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</p>
          <p style={{fontSize:9,color:"var(--t3)"}}>{paid?"Paid":daysUntil===0?"Due today":daysUntil<0?"Overdue":`Due in ${daysUntil}d`} · Day {r.dueDay}</p>
        </div>
        <p style={{fontSize:compact?13:14,fontWeight:700,color:paid?"var(--t3)":isExp?"var(--exp)":"var(--inc)",flexShrink:0}}>
          {isExp?"-":"+"}{fmt(r.amount)}
        </p>
      </div>
    );
  };

  /* ═══ HOME ═══ */
  const HomeView=()=>{
    const expChange=lastTotExp>0?((totExp-lastTotExp)/lastTotExp)*100:null;
    return(
    <div className="afu ns" style={{padding:"16px 14px 90px",overflowY:"auto",maxHeight:"100vh"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <p style={{color:"var(--t3)",fontSize:11,fontWeight:500,letterSpacing:1.2,textTransform:"uppercase",marginBottom:2}}>{now.toLocaleDateString("en",{month:"long",year:"numeric"})}</p>
          <h1 className="fd" style={{fontSize:26,fontWeight:800,letterSpacing:-1}}>MoneyFlow</h1>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,background:"rgba(255,190,68,.1)",border:"1px solid rgba(255,190,68,.2)"}}>
          <span style={{fontSize:16}}>🔥</span>
          <span className="fd streak-glow" style={{fontSize:16,fontWeight:800,color:"var(--warn)"}}>{streak||calcStreak()}</span>
        </div>
      </div>

      {/* Balance Card */}
      <div className="gl" style={{borderRadius:16,padding:16,marginBottom:14,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:90,height:90,borderRadius:"50%",background:"var(--ac)",opacity:.05}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <p style={{fontSize:11,color:"var(--t2)",marginBottom:2}}>Net Worth</p>
            <p className="fd" style={{fontSize:28,fontWeight:800,letterSpacing:-1.5,color:netBal>=0?"var(--ac)":"var(--exp)"}}>{netBal>=0?"+":"-"}{fmt(netBal)}</p>
          </div>
          {expChange!==null&&(
            <div style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:10,background:expChange<=0?"rgba(0,224,158,.1)":"rgba(255,107,138,.1)"}}>
              {expChange<=0?<TrendingDown size={12} color="var(--ac)"/>:<TrendingUp size={12} color="var(--exp)"/>}
              <span style={{fontSize:11,fontWeight:600,color:expChange<=0?"var(--ac)":"var(--exp)"}}>{Math.abs(expChange).toFixed(0)}%</span>
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:26,height:26,borderRadius:7,background:"rgba(0,224,158,.1)",display:"flex",alignItems:"center",justifyContent:"center"}}><ArrowDownLeft size={12} color="var(--inc)"/></div>
            <div><p style={{fontSize:9,color:"var(--t3)"}}>Income</p><p style={{fontSize:13,fontWeight:700,color:"var(--inc)"}}>{fmts(totInc)}</p></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:26,height:26,borderRadius:7,background:"rgba(255,107,138,.1)",display:"flex",alignItems:"center",justifyContent:"center"}}><ArrowUpRight size={12} color="var(--exp)"/></div>
            <div><p style={{fontSize:9,color:"var(--t3)"}}>Expenses</p><p style={{fontSize:13,fontWeight:700,color:"var(--exp)"}}>{fmts(totExp)}</p></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:26,height:26,borderRadius:7,background:"rgba(96,165,250,.1)",display:"flex",alignItems:"center",justifyContent:"center"}}><DollarSign size={12} color="var(--trf)"/></div>
            <div><p style={{fontSize:9,color:"var(--t3)"}}>Free</p><p style={{fontSize:13,fontWeight:700,color:"var(--trf)"}}>{fmts(Math.max(disposable,0))}</p></div>
          </div>
        </div>
      </div>

      {/* ═══ FIXED COSTS CARD ═══ */}
      <div className="gl" style={{borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <RefreshCw size={14} color="var(--ind)"/>
            <p className="fd" style={{fontWeight:600,fontSize:14}}>Monthly Bills</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {remainingBills>0&&<span style={{fontSize:11,fontWeight:600,color:"var(--warn)",padding:"2px 8px",borderRadius:8,background:"rgba(255,190,68,.1)"}}>${remainingBills.toFixed(0)} left</span>}
            <span style={{fontSize:10,color:"var(--t3)"}}>{curPaid.filter(id=>recExpenses.some(r=>r.id===id)).length}/{recExpenses.length}</span>
          </div>
        </div>
        {/* Progress */}
        <div style={{width:"100%",height:4,borderRadius:2,background:"var(--bg4)",marginBottom:10}}>
          <div style={{width:`${recExpenses.length>0?(curPaid.filter(id=>recExpenses.some(r=>r.id===id)).length/recExpenses.length)*100:0}%`,height:"100%",borderRadius:2,background:"var(--ac)",transition:"width .4s"}}/>
        </div>
        {/* Unpaid first, then paid */}
        {[...recExpenses].sort((a,b)=>{const ap=curPaid.includes(a.id)?1:0;const bp=curPaid.includes(b.id)?1:0;return ap-bp||a.dueDay-b.dueDay;}).slice(0,5).map(r=><RecRow key={r.id} r={r} compact/>)}
        {recExpenses.length>5&&<p style={{fontSize:10,color:"var(--t3)",textAlign:"center",marginTop:6,cursor:"pointer"}} onClick={()=>{setTab("more");setMoreTab("recurring");}}>+{recExpenses.length-5} more</p>}
      </div>

      {/* Fixed Income */}
      {recIncome.length>0&&(
        <div className="gl" style={{borderRadius:14,padding:14,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <ArrowDownLeft size={14} color="var(--ac)"/>
              <p className="fd" style={{fontWeight:600,fontSize:14}}>Expected Income</p>
            </div>
            <span style={{fontSize:10,color:"var(--t3)"}}>{curPaid.filter(id=>recIncome.some(r=>r.id===id)).length}/{recIncome.length}</span>
          </div>
          {recIncome.map(r=><RecRow key={r.id} r={r} compact/>)}
        </div>
      )}

      {/* Mini Chart */}
      <div className="gl" style={{borderRadius:14,padding:"12px 8px 4px",marginBottom:14}}>
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={dailySpend}>
            <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00E09E" stopOpacity={.25}/><stop offset="100%" stopColor="#00E09E" stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="day" tick={{fill:"#55556A",fontSize:8}} axisLine={false} tickLine={false} interval={6}/>
            <YAxis hide/>
            <Area type="monotone" dataKey="cumulative" stroke="#00E09E" strokeWidth={1.5} fill="url(#sg)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Category Grid */}
      <div style={{marginBottom:14}}>
        <p className="fd" style={{fontWeight:600,fontSize:14,marginBottom:10}}>By Category</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {expByCat.map((cat,i)=>{const IC=IM[cat.icon]||MoreHorizontal;const pct=totExp>0?(cat.value/totExp*100):0;
            return(<div key={cat.category} onClick={()=>setCatDetailId(catDetailId===cat.category?null:cat.category)}
              className="cb asi" style={{padding:12,borderRadius:12,background:"var(--bg2)",border:catDetailId===cat.category?`1.5px solid ${cat.color}`:"1px solid var(--brd)",cursor:"pointer",transition:"all .15s",animationDelay:`${i*0.04}s`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{width:28,height:28,borderRadius:7,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><IC size={13} color={cat.color}/></div>
                {cat.change!==null&&<span style={{fontSize:9,fontWeight:600,color:cat.change<=0?"var(--ac)":"var(--exp)"}}>{cat.change<=0?"↓":"↑"}{Math.abs(cat.change).toFixed(0)}%</span>}
              </div>
              <p style={{fontSize:11,color:"var(--t2)",marginBottom:2}}>{cat.name}</p>
              <p className="fd" style={{fontSize:17,fontWeight:700}}>${cat.value.toFixed(0)}</p>
              <div style={{width:"100%",height:3,borderRadius:2,background:"var(--bg4)",marginTop:6}}><div style={{width:`${pct}%`,height:"100%",borderRadius:2,background:cat.color}}/></div>
            </div>);
          })}
        </div>
      </div>

      {/* Cat Detail */}
      {catDetailId&&(()=>{const cat=catInfo(catDetailId);const IC=IM[cat.icon]||MoreHorizontal;
        const catTxns=sorted.filter(t=>t.category===catDetailId&&t.type==="expense").slice(0,5);
        const thisAmt=moTxns.filter(t=>t.type==="expense"&&t.category===catDetailId).reduce((s,t)=>s+t.amount,0);
        const lastAmt=lastMoTxns.filter(t=>t.type==="expense"&&t.category===catDetailId).reduce((s,t)=>s+t.amount,0);
        return(<div className="gl asi" style={{borderRadius:14,padding:14,marginBottom:14,borderColor:cat.color+"44"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><IC size={14} color={cat.color}/></div>
            <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>{cat.name}</p><p style={{fontSize:10,color:"var(--t3)"}}>This: ${thisAmt.toFixed(0)} · Last: ${lastAmt.toFixed(0)}</p></div>
            <button onClick={()=>setCatDetailId(null)} style={{background:"none",border:"none",cursor:"pointer"}}><X size={14} color="var(--t3)"/></button>
          </div>
          {lastAmt>0&&<div style={{display:"flex",gap:6,marginBottom:8}}>
            <div style={{flex:1,padding:6,borderRadius:7,background:thisAmt<=lastAmt?"rgba(0,224,158,.06)":"rgba(255,107,138,.06)",textAlign:"center"}}>
              <p style={{fontSize:9,color:"var(--t3)"}}>vs Last</p><p style={{fontSize:13,fontWeight:700,color:thisAmt<=lastAmt?"var(--ac)":"var(--exp)"}}>{thisAmt<=lastAmt?"↓":"↑"}${Math.abs(thisAmt-lastAmt).toFixed(0)}</p>
            </div>
            <div style={{flex:1,padding:6,borderRadius:7,background:"var(--bg2)",textAlign:"center"}}>
              <p style={{fontSize:9,color:"var(--t3)"}}>Avg/Day</p><p style={{fontSize:13,fontWeight:700}}>${(thisAmt/Math.max(now.getDate(),1)).toFixed(1)}</p>
            </div>
          </div>}
          {catTxns.map(t=><TxRow key={t.id} t={t}/>)}
        </div>);
      })()}

      {/* Recent */}
      <p className="fd" style={{fontWeight:600,fontSize:14,marginBottom:8}}>Recent</p>
      {sorted.slice(0,4).map(t=><TxRow key={t.id} t={t}/>)}
    </div>);
  };

  /* ═══ ADD TRANSACTION ═══ */
  const AddView=()=>{
    const cats=addMode==="expense"?ECAT:ICAT;
    return(
    <div className="asu" style={{position:"fixed",inset:0,background:"var(--bg)",zIndex:100,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px"}}>
        <button onClick={()=>{setShowAdd(false);setAmt("0");setSelCat(null);setNote("");}} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={20} color="var(--t2)"/></button>
        <div style={{display:"flex",background:"var(--bg2)",borderRadius:9,padding:2}}>
          {["expense","income","transfer"].map(m=>(
            <button key={m} onClick={()=>{setAddMode(m);setSelCat(null);}}
              style={{padding:"4px 12px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,textTransform:"capitalize",
                background:addMode===m?(m==="expense"?"var(--exp)":m==="income"?"var(--ac)":"var(--trf)"):"transparent",
                color:addMode===m?"#08080F":"var(--t3)"}}>{m}</button>
          ))}
        </div>
        <button onClick={submit} style={{background:"none",border:"none",cursor:"pointer",padding:4,opacity:(parseFloat(amt)>0&&(addMode==="transfer"||selCat))?1:.25}}><Check size={20} color="var(--ac)"/></button>
      </div>
      <div style={{textAlign:"center",padding:"6px 16px 4px"}}>
        <p className="fd" style={{fontSize:44,fontWeight:800,letterSpacing:-2,color:addMode==="expense"?"var(--exp)":addMode==="income"?"var(--ac)":"var(--trf)"}}>${amt}</p>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Add note..." style={{background:"transparent",border:"none",outline:"none",color:"var(--t2)",fontSize:12,textAlign:"center",width:"100%",fontFamily:"inherit"}}/>
      </div>
      {addMode==="expense"&&frequentTxns.length>0&&(
        <div style={{padding:"6px 14px 8px"}}>
          <p style={{fontSize:10,color:"var(--t3)",marginBottom:5,fontWeight:500}}>QUICK ADD</p>
          <div style={{display:"flex",gap:6,overflowX:"auto"}} className="ns">
            {frequentTxns.map((q,i)=>{const cat=catInfo(q.category);const IC=IM[cat.icon]||MoreHorizontal;
              return(<button key={i} onClick={()=>quickAdd(q)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:16,background:`${cat.color}12`,border:`1px solid ${cat.color}33`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                <IC size={11} color={cat.color}/><span style={{fontSize:11,fontWeight:600,color:"var(--t1)"}}>{q.note||cat.name}</span><span style={{fontSize:11,fontWeight:700,color:cat.color}}>${q.amount}</span>
              </button>);})}
          </div>
        </div>
      )}
      {addMode==="transfer"?(
        <div style={{padding:"4px 16px 8px"}}>
          <p style={{fontSize:10,color:"var(--t3)",marginBottom:4}}>FROM</p>
          <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:6}} className="ns">
            {accts.map(a=>{const I=AIM[a.icon]||Wallet;return(<button key={a.id} onClick={()=>setFromAcct(a.id)} className="cb" style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:14,border:fromAcct===a.id?`2px solid ${a.color}`:"1px solid var(--brd)",background:fromAcct===a.id?`${a.color}12`:"var(--bg2)",cursor:"pointer",whiteSpace:"nowrap"}}><I size={11} color={a.color}/><span style={{fontSize:10,color:"var(--t1)"}}>{a.name}</span></button>);})}
          </div>
          <div style={{textAlign:"center",padding:2}}><ArrowDownLeft size={14} color="var(--trf)"/></div>
          <p style={{fontSize:10,color:"var(--t3)",marginBottom:4}}>TO</p>
          <div style={{display:"flex",gap:5,overflowX:"auto"}} className="ns">
            {accts.filter(a=>a.id!==fromAcct).map(a=>{const I=AIM[a.icon]||Wallet;return(<button key={a.id} onClick={()=>setToAcct(a.id)} className="cb" style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:14,border:toAcct===a.id?`2px solid ${a.color}`:"1px solid var(--brd)",background:toAcct===a.id?`${a.color}12`:"var(--bg2)",cursor:"pointer",whiteSpace:"nowrap"}}><I size={11} color={a.color}/><span style={{fontSize:10,color:"var(--t1)"}}>{a.name}</span></button>);})}
          </div>
        </div>
      ):(
        <div style={{display:"flex",gap:5,padding:"0 14px 6px",overflowX:"auto"}} className="ns">
          {accts.map(a=>{const I=AIM[a.icon]||Wallet;return(<button key={a.id} onClick={()=>setSelAcct(a.id)} className="cb" style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:14,border:selAcct===a.id?`2px solid ${a.color}`:"1px solid var(--brd)",background:selAcct===a.id?`${a.color}12`:"var(--bg2)",cursor:"pointer",whiteSpace:"nowrap"}}><I size={11} color={a.color}/><span style={{fontSize:10,color:"var(--t1)"}}>{a.name}</span></button>);})}
        </div>
      )}
      {addMode!=="transfer"&&(
        <div style={{flex:1,overflowY:"auto",padding:"4px 12px"}} className="ns">
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
            {cats.map(cat=>{const IC=IM[cat.icon]||MoreHorizontal;const sel=selCat===cat.id;
              return(<button key={cat.id} onClick={()=>setSelCat(cat.id)} className="cb"
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 2px",borderRadius:10,border:sel?`2px solid ${cat.color}`:"1px solid transparent",background:sel?`${cat.color}15`:"var(--bg2)",cursor:"pointer"}}>
                <div style={{width:30,height:30,borderRadius:8,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><IC size={14} color={cat.color}/></div>
                <span style={{fontSize:9,fontWeight:500,color:sel?"var(--t1)":"var(--t2)"}}>{cat.name}</span>
              </button>);})}
          </div>
        </div>
      )}
      {addMode==="transfer"&&<div style={{flex:1}}/>}
      <div style={{padding:"4px 16px 18px",background:"var(--bg1)"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
          {["1","2","3","4","5","6","7","8","9",".","0","del"].map(k=>(
            <button key={k} onClick={()=>numpad(k)} className="nb" style={{height:44,borderRadius:10,border:"none",background:"var(--bg2)",color:k==="del"?"var(--exp)":"var(--t1)",fontSize:k==="del"?12:18,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>{k==="del"?"⌫":k}</button>
          ))}
        </div>
        <button onClick={submit} disabled={!(parseFloat(amt)>0&&(addMode==="transfer"?(fromAcct!==toAcct):selCat))}
          style={{width:"100%",height:44,borderRadius:10,border:"none",marginTop:5,
            background:(parseFloat(amt)>0&&(addMode==="transfer"?(fromAcct!==toAcct):selCat))?(addMode==="expense"?"var(--exp)":addMode==="income"?"var(--ac)":"var(--trf)"):"var(--bg4)",
            color:parseFloat(amt)>0?"#08080F":"var(--t3)",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
          {addMode==="transfer"?"Transfer":addMode==="expense"?"Add Expense":"Add Income"}
        </button>
      </div>
    </div>);
  };

  /* ═══ HISTORY ═══ */
  const HistView=()=>(
    <div className="afu ns" style={{padding:"16px 14px 90px",overflowY:"auto",maxHeight:"100vh"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <h2 className="fd" style={{fontSize:22,fontWeight:700}}>History</h2>
        {filterCat&&<button onClick={()=>setFilterCat(null)} style={{display:"flex",alignItems:"center",gap:3,padding:"4px 10px",borderRadius:14,background:"var(--exp)",border:"none",color:"#fff",fontSize:10,cursor:"pointer"}}><X size={10}/>Clear</button>}
      </div>
      <div style={{display:"flex",gap:4,overflowX:"auto",marginBottom:12}} className="ns">
        {ECAT.slice(0,8).map(c=>(<button key={c.id} onClick={()=>setFilterCat(filterCat===c.id?null:c.id)} style={{padding:"3px 9px",borderRadius:12,border:filterCat===c.id?`1.5px solid ${c.color}`:"1px solid var(--brd)",background:filterCat===c.id?`${c.color}15`:"var(--bg2)",cursor:"pointer",whiteSpace:"nowrap",fontSize:10,fontWeight:500,color:filterCat===c.id?c.color:"var(--t2)"}}>{c.name}</button>))}
      </div>
      {grouped.map(([day,ts])=>(<div key={day} style={{marginBottom:12}}><p style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{day}</p>{ts.map(t=><TxRow key={t.id} t={t} showDel/>)}</div>))}
      {grouped.length===0&&<div style={{textAlign:"center",padding:36,color:"var(--t3)"}}><FileText size={32} style={{marginBottom:8,opacity:.3}}/><p>No transactions</p></div>}
    </div>
  );

  /* ═══ MORE ═══ */
  const MoreView=()=>(
    <div className="afu ns" style={{padding:"16px 14px 90px",overflowY:"auto",maxHeight:"100vh"}}>
      <h2 className="fd" style={{fontSize:22,fontWeight:700,marginBottom:12}}>More</h2>
      <div style={{display:"flex",gap:5,marginBottom:16,overflowX:"auto"}} className="ns">
        {[{id:"recurring",label:"Recurring",icon:RefreshCw},{id:"budgets",label:"Budgets",icon:Target},{id:"analytics",label:"Analytics",icon:BarChart3},{id:"accounts",label:"Accounts",icon:Wallet}].map(s=>{
          const I=s.icon;const a=moreTab===s.id;
          return(<button key={s.id} onClick={()=>setMoreTab(s.id)} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:16,border:a?"1.5px solid var(--ac)":"1px solid var(--brd)",background:a?"var(--acd)":"var(--bg2)",cursor:"pointer",whiteSpace:"nowrap"}}>
            <I size={12} color={a?"var(--ac)":"var(--t3)"}/><span style={{fontSize:11,fontWeight:a?600:400,color:a?"var(--ac)":"var(--t2)"}}>{s.label}</span>
          </button>);
        })}
      </div>

      {/* ═══ RECURRING TAB ═══ */}
      {moreTab==="recurring"&&(<>
        {/* Summary */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div className="gl" style={{borderRadius:10,padding:12}}>
            <p style={{fontSize:9,color:"var(--t3)",marginBottom:2}}>Monthly Bills</p>
            <p className="fd" style={{fontSize:20,fontWeight:700,color:"var(--exp)"}}>{fmt(totalFixedExp)}</p>
            <p style={{fontSize:9,color:"var(--t3)",marginTop:2}}>{unpaidExp.length} unpaid</p>
          </div>
          <div className="gl" style={{borderRadius:10,padding:12}}>
            <p style={{fontSize:9,color:"var(--t3)",marginBottom:2}}>Fixed Income</p>
            <p className="fd" style={{fontSize:20,fontWeight:700,color:"var(--ac)"}}>{fmt(totalFixedInc)}</p>
            <p style={{fontSize:9,color:"var(--t3)",marginTop:2}}>{unpaidInc.length} pending</p>
          </div>
        </div>

        {/* Disposable */}
        <div className="gl" style={{borderRadius:12,padding:14,marginBottom:14,borderColor:"rgba(96,165,250,.2)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{fontSize:10,color:"var(--t3)"}}>Disposable Income</p>
              <p className="fd" style={{fontSize:22,fontWeight:700,color:"var(--trf)"}}>{fmt(Math.max(totalFixedInc-totalFixedExp,0))}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:9,color:"var(--t3)"}}>after all fixed costs</p>
              <p style={{fontSize:12,color:"var(--t2)"}}>{fmt(totalFixedInc)} - {fmt(totalFixedExp)}</p>
            </div>
          </div>
        </div>

        {/* Expense list */}
        <p className="fd" style={{fontWeight:600,fontSize:13,marginBottom:8}}>Bills & Subscriptions</p>
        {recExpenses.sort((a,b)=>a.dueDay-b.dueDay).map(r=>(
          <div key={r.id} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{flex:1}}><RecRow r={r}/></div>
            <button onClick={()=>{setEditRecId(r.id);setRecName(r.name);setRecAmt(r.amount.toString());setRecType(r.type);setRecCat(r.category);setRecAcct(r.account);setRecDay(r.dueDay.toString());setShowAddRec(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:3,opacity:.4}}><Edit3 size={12} color="var(--t2)"/></button>
            <button onClick={()=>delRecurring(r.id)} style={{background:"none",border:"none",cursor:"pointer",padding:3,opacity:.3}}><Trash2 size={12} color="var(--exp)"/></button>
          </div>
        ))}

        {recIncome.length>0&&<>
          <p className="fd" style={{fontWeight:600,fontSize:13,marginTop:16,marginBottom:8}}>Fixed Income</p>
          {recIncome.sort((a,b)=>a.dueDay-b.dueDay).map(r=>(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{flex:1}}><RecRow r={r}/></div>
              <button onClick={()=>{setEditRecId(r.id);setRecName(r.name);setRecAmt(r.amount.toString());setRecType(r.type);setRecCat(r.category);setRecAcct(r.account);setRecDay(r.dueDay.toString());setShowAddRec(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:3,opacity:.4}}><Edit3 size={12} color="var(--t2)"/></button>
              <button onClick={()=>delRecurring(r.id)} style={{background:"none",border:"none",cursor:"pointer",padding:3,opacity:.3}}><Trash2 size={12} color="var(--exp)"/></button>
            </div>
          ))}
        </>}

        <button onClick={()=>{setEditRecId(null);setRecName("");setRecAmt("");setRecType("expense");setRecCat("subs");setRecDay("1");setShowAddRec(true);}}
          style={{width:"100%",padding:12,borderRadius:10,border:"2px dashed var(--brd)",background:"transparent",color:"var(--ind)",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginTop:12}}>
          <Plus size={14}/> Add Recurring
        </button>

        {/* Add/Edit Recurring Modal */}
        {showAddRec&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
            <div className="asu ns" style={{width:"100%",maxHeight:"75vh",background:"var(--bg1)",borderRadius:"16px 16px 0 0",padding:18,overflowY:"auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <p className="fd" style={{fontWeight:600,fontSize:16}}>{editRecId?"Edit":"Add"} Recurring</p>
                <button onClick={()=>{setShowAddRec(false);setEditRecId(null);}} style={{background:"none",border:"none",cursor:"pointer"}}><X size={18} color="var(--t2)"/></button>
              </div>
              {/* Type toggle */}
              <div style={{display:"flex",gap:6,marginBottom:12}}>
                {["expense","income"].map(t=>(<button key={t} onClick={()=>{setRecType(t);setRecCat(t==="expense"?"subs":"salary");}}
                  style={{flex:1,padding:8,borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,textTransform:"capitalize",
                    background:recType===t?(t==="expense"?"var(--exp)":"var(--ac)"):"var(--bg2)",color:recType===t?"#08080F":"var(--t3)"}}>{t}</button>))}
              </div>
              {/* Name */}
              <input value={recName} onChange={e=>setRecName(e.target.value)} placeholder="Name (e.g. Netflix)" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid var(--brd)",background:"var(--bg2)",color:"var(--t1)",fontSize:14,outline:"none",fontFamily:"inherit",marginBottom:8}}/>
              {/* Amount + Day */}
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <input value={recAmt} onChange={e=>setRecAmt(e.target.value)} placeholder="Amount" type="number" style={{flex:1,padding:"10px 12px",borderRadius:8,border:"1px solid var(--brd)",background:"var(--bg2)",color:"var(--t1)",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
                <div style={{width:80}}>
                  <p style={{fontSize:9,color:"var(--t3)",marginBottom:3}}>Due day</p>
                  <input value={recDay} onChange={e=>setRecDay(e.target.value)} type="number" min="1" max="31" style={{width:"100%",padding:"8px",borderRadius:8,border:"1px solid var(--brd)",background:"var(--bg2)",color:"var(--t1)",fontSize:14,outline:"none",fontFamily:"inherit",textAlign:"center"}}/>
                </div>
              </div>
              {/* Category */}
              <p style={{fontSize:10,color:"var(--t3)",marginBottom:6}}>Category</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:10}}>
                {(recType==="expense"?ECAT:ICAT).slice(0,12).map(cat=>{const IC=IM[cat.icon]||MoreHorizontal;const sel=recCat===cat.id;
                  return(<button key={cat.id} onClick={()=>setRecCat(cat.id)} className="cb"
                    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 2px",borderRadius:8,border:sel?`1.5px solid ${cat.color}`:"1px solid transparent",background:sel?`${cat.color}15`:"var(--bg2)",cursor:"pointer"}}>
                    <IC size={13} color={cat.color}/><span style={{fontSize:9,color:sel?"var(--t1)":"var(--t3)"}}>{cat.name}</span>
                  </button>);})}
              </div>
              {/* Account */}
              <p style={{fontSize:10,color:"var(--t3)",marginBottom:6}}>Account</p>
              <div style={{display:"flex",gap:5,marginBottom:14}} className="ns">
                {accts.map(a=>{const I=AIM[a.icon]||Wallet;return(<button key={a.id} onClick={()=>setRecAcct(a.id)} className="cb"
                  style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:12,border:recAcct===a.id?`1.5px solid ${a.color}`:"1px solid var(--brd)",background:recAcct===a.id?`${a.color}12`:"var(--bg2)",cursor:"pointer"}}>
                  <I size={11} color={a.color}/><span style={{fontSize:10,color:"var(--t1)"}}>{a.name}</span>
                </button>);})}
              </div>
              <button onClick={addRecurring} disabled={!recName||!recAmt}
                style={{width:"100%",padding:12,borderRadius:10,border:"none",background:recName&&recAmt?"var(--ac)":"var(--bg4)",color:recName&&recAmt?"#08080F":"var(--t3)",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                {editRecId?"Save Changes":"Add Recurring"}
              </button>
            </div>
          </div>
        )}
      </>)}

      {/* BUDGETS */}
      {moreTab==="budgets"&&(<>
        {(()=>{const tb=budgets.reduce((s,b)=>s+b.limit,0);const p=tb>0?Math.min((totExp/tb)*100,100):0;return(
          <div className="gl" style={{borderRadius:12,padding:14,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><p style={{fontSize:11,color:"var(--t2)"}}>Total Budget</p><p style={{fontSize:11,fontWeight:700,color:p>100?"var(--exp)":"var(--t1)"}}>{p.toFixed(0)}%</p></div>
            <div style={{width:"100%",height:5,borderRadius:3,background:"var(--bg4)"}}><div style={{width:`${p}%`,height:"100%",borderRadius:3,background:p>100?"var(--exp)":p>75?"var(--warn)":"var(--ac)"}}/></div>
          </div>);})()}
        {budgets.map(b=>{const cat=catInfo(b.category);const IC=IM[cat.icon]||MoreHorizontal;
          const spent=moTxns.filter(t=>t.type==="expense"&&t.category===b.category).reduce((s,t)=>s+t.amount,0);
          const p=Math.min((spent/b.limit)*100,100);const over=spent>b.limit;const rem=b.limit-spent;
          const dl=new Date(yr,mo+1,0).getDate()-now.getDate();const daily=dl>0?Math.max(rem,0)/dl:0;
          return(<div key={b.id} className="gl" style={{borderRadius:10,padding:12,marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:32,height:32,borderRadius:8,background:`${cat.color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><IC size={14} color={cat.color}/></div>
              <div style={{flex:1}}><p style={{fontSize:12,fontWeight:600}}>{cat.name}</p><p style={{fontSize:9,color:"var(--t3)"}}>${spent.toFixed(0)} / ${b.limit}</p></div>
              {over&&<AlertTriangle size={12} color="var(--exp)"/>}
              <button onClick={()=>{setEditBudget(b.category);setBudgetInput(b.limit.toString());}} style={{background:"none",border:"none",cursor:"pointer"}}><Edit3 size={12} color="var(--t3)"/></button>
            </div>
            <div style={{width:"100%",height:4,borderRadius:2,background:"var(--bg4)"}}><div style={{width:`${p}%`,height:"100%",borderRadius:2,background:over?"var(--exp)":p>75?"var(--warn)":cat.color}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{fontSize:9,color:over?"var(--exp)":"var(--t3)"}}>{over?`Over $${(spent-b.limit).toFixed(0)}`:`$${rem.toFixed(0)} left`}</span>
              {!over&&dl>0&&<span style={{fontSize:9,color:"var(--t3)"}}>${daily.toFixed(1)}/d · {dl}d</span>}
            </div>
            {editBudget===b.category&&(<div style={{marginTop:8,display:"flex",gap:5}}>
              <input value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} type="number" style={{flex:1,padding:"6px 8px",borderRadius:7,border:"1px solid var(--brd)",background:"var(--bg2)",color:"var(--t1)",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
              <button onClick={()=>{const v=parseFloat(budgetInput);if(v)setBudgets(p=>p.map(x=>x.category===b.category?{...x,limit:v}:x));setEditBudget(null);}} style={{padding:"6px 12px",borderRadius:7,background:"var(--ac)",border:"none",color:"#08080F",fontWeight:700,fontSize:11,cursor:"pointer"}}>Save</button>
              <button onClick={()=>setEditBudget(null)} style={{padding:"6px 8px",borderRadius:7,background:"var(--bg4)",border:"none",color:"var(--t2)",fontSize:11,cursor:"pointer"}}>X</button>
            </div>)}
          </div>);
        })}
        <button onClick={()=>setShowCatPick(true)} style={{width:"100%",padding:12,borderRadius:10,border:"2px dashed var(--brd)",background:"transparent",color:"var(--t3)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Plus size={14}/> Add Budget</button>
      </>)}

      {/* ANALYTICS */}
      {moreTab==="analytics"&&(()=>{
        const topCats=expByCat.slice(0,6);const avgD=totExp/Math.max(now.getDate(),1);const proj=avgD*new Date(yr,mo+1,0).getDate();
        return(<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            {[{l:"Avg/Day",v:`$${avgD.toFixed(0)}`,c:"var(--ac)"},{l:"Projected",v:`$${proj.toFixed(0)}`,c:"var(--warn)"},{l:"Fixed Costs",v:`$${totalFixedExp.toFixed(0)}`,c:"var(--ind)"},{l:"Variable",v:`$${Math.max(totExp-totalFixedExp,0).toFixed(0)}`,c:"var(--exp)"}].map((s,i)=>(
              <div key={i} className="gl" style={{borderRadius:10,padding:12}}><p style={{fontSize:9,color:"var(--t3)",marginBottom:2}}>{s.l}</p><p className="fd" style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</p></div>))}
          </div>
          <div className="gl" style={{borderRadius:12,padding:"12px 8px 4px",marginBottom:14}}>
            <p className="fd" style={{fontWeight:600,fontSize:13,marginBottom:8,paddingLeft:6}}>Daily Spending</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={dailySpend}>
                <defs><linearGradient id="dg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818CF8" stopOpacity={.25}/><stop offset="100%" stopColor="#818CF8" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="day" tick={{fill:"#55556A",fontSize:8}} axisLine={false} tickLine={false} interval={4}/>
                <YAxis hide/><Tooltip contentStyle={{background:"#1E1E2E",border:"1px solid #252538",borderRadius:8,fontSize:10}} formatter={v=>[`$${v.toFixed(2)}`,"Spent"]}/>
                <Area type="monotone" dataKey="amount" stroke="#818CF8" strokeWidth={1.5} fill="url(#dg2)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="gl" style={{borderRadius:12,padding:14}}>
            <p className="fd" style={{fontWeight:600,fontSize:13,marginBottom:10}}>vs Last Month</p>
            {topCats.map((cat,i)=>{const IC=IM[cat.icon]||MoreHorizontal;
              return(<div key={cat.category} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<topCats.length-1?"1px solid var(--brd)":"none"}}>
                <div style={{width:28,height:28,borderRadius:7,background:`${cat.color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><IC size={12} color={cat.color}/></div>
                <div style={{flex:1}}><p style={{fontSize:12,fontWeight:600}}>{cat.name}</p></div>
                <span style={{fontSize:12,fontWeight:700}}>${cat.value.toFixed(0)}</span>
                {cat.change!==null&&<span style={{fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:8,background:cat.change<=0?"rgba(0,224,158,.1)":"rgba(255,107,138,.1)",color:cat.change<=0?"var(--ac)":"var(--exp)"}}>{cat.change<=0?"↓":"↑"}{Math.abs(cat.change).toFixed(0)}%</span>}
              </div>);})}
          </div>
        </>);
      })()}

      {/* ACCOUNTS */}
      {moreTab==="accounts"&&(<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <div className="gl" style={{borderRadius:10,padding:12}}><p style={{fontSize:9,color:"var(--t3)",marginBottom:2}}>Assets</p><p className="fd" style={{fontSize:18,fontWeight:700,color:"var(--ac)"}}>{fmt(accts.filter(a=>a.balance>0).reduce((s,a)=>s+a.balance,0))}</p></div>
          <div className="gl" style={{borderRadius:10,padding:12}}><p style={{fontSize:9,color:"var(--t3)",marginBottom:2}}>Debt</p><p className="fd" style={{fontSize:18,fontWeight:700,color:"var(--exp)"}}>{fmt(accts.filter(a=>a.balance<0).reduce((s,a)=>s+Math.abs(a.balance),0))}</p></div>
        </div>
        {accts.map(a=>{const I=AIM[a.icon]||Wallet;const isD=a.type==="credit";const du=isD?Math.abs(Math.min(a.balance,0)):0;const dp=isD&&a.limit?(du/a.limit)*100:0;
          return(<div key={a.id} className="gl" style={{borderRadius:10,padding:14,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:9,background:`${a.color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><I size={16} color={a.color}/></div>
              <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>{a.name}</p></div>
              <p className="fd" style={{fontSize:18,fontWeight:700,color:a.balance<0?"var(--exp)":"var(--t1)"}}>{a.balance<0?"-":""}{fmt(a.balance)}</p>
            </div>
            {isD&&a.limit&&(<div style={{marginTop:10}}>
              <div style={{width:"100%",height:5,borderRadius:3,background:"var(--bg4)"}}><div style={{width:`${Math.min(dp,100)}%`,height:"100%",borderRadius:3,background:dp>80?"var(--exp)":dp>50?"var(--warn)":"var(--ac)"}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:10,color:"var(--t3)"}}>Used: {fmt(du)}</span><span style={{fontSize:10,color:"var(--ac)"}}>Available: {fmt(a.limit-du)}</span></div>
              <button onClick={()=>{setShowAdd(true);setAddMode("transfer");setToAcct(a.id);setFromAcct("bank");}} style={{width:"100%",marginTop:8,padding:8,borderRadius:8,border:"1px solid var(--trf)",background:"rgba(96,165,250,.06)",color:"var(--trf)",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><ArrowRightLeft size={12}/> Pay Debt</button>
            </div>)}
          </div>);
        })}
      </>)}

      {/* Cat picker */}
      {showCatPick&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
        <div className="asu" style={{width:"100%",maxHeight:"55vh",background:"var(--bg1)",borderRadius:"16px 16px 0 0",padding:16,overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <p className="fd" style={{fontWeight:600}}>Add Budget</p>
            <button onClick={()=>setShowCatPick(false)} style={{background:"none",border:"none",cursor:"pointer"}}><X size={16} color="var(--t2)"/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
            {ECAT.filter(c=>!budgets.find(b=>b.category===c.id)).map(cat=>{const IC=IM[cat.icon]||MoreHorizontal;
              return(<button key={cat.id} onClick={()=>{setBudgets(p=>[...p,{id:`b${Date.now()}`,category:cat.id,limit:200}]);setShowCatPick(false);}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:8,borderRadius:8,background:"var(--bg2)",border:"none",cursor:"pointer"}}><IC size={14} color={cat.color}/><span style={{fontSize:9,color:"var(--t2)"}}>{cat.name}</span></button>);})}
          </div>
        </div>
      </div>)}
    </div>
  );

  if(!ready)return(<div style={{background:"var(--bg)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><style>{CSS}</style><div className="fd" style={{color:"var(--ac)",fontSize:20,fontWeight:700}}><DollarSign size={24} style={{display:"block",margin:"0 auto 8px"}}/>Loading...</div></div>);

  return(
    <div style={{maxWidth:430,margin:"0 auto",background:"var(--bg)",minHeight:"100vh",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <SuccessOverlay/>
      {tab==="home"&&<HomeView/>}
      {tab==="history"&&<HistView/>}
      {tab==="more"&&<MoreView/>}
      {showAdd&&<AddView/>}
      {!showAdd&&(<button onClick={()=>setShowAdd(true)} style={{position:"fixed",bottom:68,left:"50%",transform:"translateX(-50%)",width:50,height:50,borderRadius:"50%",background:"var(--ac)",border:"none",boxShadow:"0 4px 20px rgba(0,224,158,.35)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,animation:"pulseRing 2s infinite"}}><Plus size={22} color="#08080F" strokeWidth={3}/></button>)}
      {!showAdd&&(<div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"linear-gradient(to top,var(--bg) 75%,transparent)",padding:"6px 30px 12px",display:"flex",justifyContent:"space-between",zIndex:40}}>
        {[{id:"home",icon:Home,label:"Home"},{id:"history",icon:List,label:"History"},{id:"more",icon:MoreHorizontal,label:"More"}].map(t=>{const I=t.icon;const a=tab===t.id;
          return(<button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"3px 16px"}}><I size={18} color={a?"var(--ac)":"var(--t3)"} strokeWidth={a?2.5:1.5}/><span style={{fontSize:9,fontWeight:a?700:400,color:a?"var(--ac)":"var(--t3)"}}>{t.label}</span></button>);
        })}
      </div>)}
    </div>
  );
}
