const dataKey='wander-wallet-expenses',baseKey='wander-wallet-base-currency',legacyKey='wander-wallet-currency',rateCacheKey='wander-wallet-rate-cache',budgetKey='wander-wallet-budget',customCategoryKey='wander-wallet-custom-categories',categoryOrderKey='wander-wallet-category-order',onboardingKey='wander-wallet-onboarding-complete';

const symbols={KRW:'₩',USD:'$',EUR:'€',JPY:'¥'},colors=['#ed7248','#f5bc48','#8fc6b1','#92b5d5','#b8a5d4','#b4aca0'],icons={식비:'☕',교통:'◈',생활:'⌂',여행:'✦',학업:'✎',기타:'○'},defaultCategories=['식비','교통','생활','여행','학업','기타'];

let baseCurrency=localStorage.getItem(baseKey)||localStorage.getItem(legacyKey)||'';
let selectedMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);

let expenses=JSON.parse(localStorage.getItem(dataKey)||'[]'),rates=null,rateDate='',rateRequest=null,budget=Number(localStorage.getItem(budgetKey))||0,customCategories=JSON.parse(localStorage.getItem(customCategoryKey)||'[]'),categoryOrder=JSON.parse(localStorage.getItem(categoryOrderKey)||'null')||[...defaultCategories,...customCategories];

expenses=expenses.map(x=>({...(x.baseAmount===undefined?{...x,inputAmount:x.amount,inputCurrency:baseCurrency||'KRW',baseAmount:x.amount}:x),categories:x.categories||[x.category||'식비'],createdAt:x.createdAt||new Date().toISOString()}));

const today=new Date(),money=(x,c=baseCurrency)=>new Intl.NumberFormat('ko-KR',{minimumFractionDigits:['EUR','USD'].includes(c)?2:0,maximumFractionDigits:['EUR','USD'].includes(c)?2:0}).format(x),format=x=>`${symbols[baseCurrency]||''}${money(x)}`,allCategories=()=>categoryOrder;

const save=()=>localStorage.setItem(dataKey,JSON.stringify(expenses));

document.querySelector('#todayLabel').textContent=`${today.getMonth()+1}월 ${today.getDate()}일`;
function renderMonthLabel(){document.querySelector('#monthLabel').textContent=`${selectedMonth.getFullYear()}년 ${selectedMonth.getMonth()+1}월`}
renderMonthLabel();
document.querySelector('#prevMonth').onclick=()=>{selectedMonth.setMonth(selectedMonth.getMonth()-1);renderMonthLabel();render()};
document.querySelector('#nextMonth').onclick=()=>{selectedMonth.setMonth(selectedMonth.getMonth()+1);renderMonthLabel();render()};

function restoreCachedRates(){const cache=JSON.parse(localStorage.getItem(rateCacheKey)||'null');
if(cache?.base===baseCurrency&&cache.rates){rates=cache.rates;
rateDate=cache.date;
return true}rates=null;
rateDate='';
return false}
function fetchWithTimeout(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
return fetch(url,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();
return r.json()}).finally(()=>clearTimeout(timer))}
function loadRates(){if(!baseCurrency)return;
restoreCachedRates();
const list='KRW,USD,EUR,JPY',a=fetchWithTimeout(`https://api.frankfurter.dev/v1/latest?base=${baseCurrency}&symbols=${list}`).then(d=>({rates:{...d.rates,[baseCurrency]:1},date:d.date})),b=fetchWithTimeout(`https://open.er-api.com/v6/latest/${baseCurrency}`).then(d=>({rates:{KRW:d.rates.KRW,USD:d.rates.USD,EUR:d.rates.EUR,JPY:d.rates.JPY,[baseCurrency]:1},date:new Date(d.time_last_update_unix*1000).toISOString().slice(0,10)}));
rateRequest=Promise.any([a,b]).then(r=>{rates=r.rates;
rateDate=r.date;
localStorage.setItem(rateCacheKey,JSON.stringify({base:baseCurrency,rates,date:rateDate}));
render()}).catch(()=>note(rates?'':'환율 조회가 지연되고 있어요.'));
return rateRequest}
function convert(amount,input){const x=input===baseCurrency?amount:rates?.[input]?amount/rates[input]:null;
return x===null?null:['EUR','USD'].includes(baseCurrency)?Math.round((x+Number.EPSILON)*100)/100:Math.round(x)}
function note(error=''){const amount=Number(document.querySelector('#expenseAmount').value),input=document.querySelector('#inputCurrency').value,el=document.querySelector('#conversionNote');
if(error){el.textContent=error;
return}if(!baseCurrency){el.textContent='기준 통화를 설정하면 환산 금액을 보여드려요.';
return}if(!amount){el.textContent=`입력 금액은 ${symbols[baseCurrency]} ${baseCurrency} 기준으로 기록돼요.`;
return}const x=convert(amount,input);
el.textContent=x===null?'환율을 빠르게 불러오는 중이에요…':`${symbols[input]}${money(amount,input)} → ${format(x)}${rateDate?` · ${rateDate} 기준 환율`:''}`}
async function loadExchangeGraph(){const from=document.querySelector('#graphBase').value,to=document.querySelector('#graphQuote').value,value=document.querySelector('#exchangeRateValue'),svg=document.querySelector('#exchangeChart');if(from===to){value.textContent=`1 ${from} = 1 ${to}`;svg.innerHTML='<path class="chart-line" d="M 5 52 L 325 52" />';return}value.textContent='환율 불러오는 중…';const end=new Date(),start=new Date();start.setDate(end.getDate()-30);const date=x=>x.toISOString().slice(0,10);try{const response=await fetch(`https://api.frankfurter.dev/v1/${date(start)}..${date(end)}?base=${from}&symbols=${to}`),data=await response.json(),entries=Object.entries(data.rates).map(([day,rate])=>({day,value:rate[to]}));if(!entries.length)throw Error();const values=entries.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),range=max-min||1,points=entries.map((x,i)=>{const px=8+i/(entries.length-1||1)*314,py=91-(x.value-min)/range*76;return [px,py]}),line=points.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '),area=`M ${points[0][0]} 97 ${points.map(p=>`L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')} L ${points.at(-1)[0]} 97 Z`,latest=entries.at(-1);value.textContent=`1 ${from} = ${money(latest.value,to)} ${to}`;document.querySelector('#exchangeRateDate').textContent=`${latest.day} 기준 · 최근 30일`;document.querySelector('#chartStartDate').textContent=entries[0].day.slice(5).replace('-','.');document.querySelector('#chartEndDate').textContent=latest.day.slice(5).replace('-','.');svg.innerHTML=`<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/><circle class="chart-dot" cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="3.5"/>`}catch{value.textContent='환율을 불러오지 못했어요';svg.innerHTML=''}}
function esc(x){return x.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderCategories(){document.querySelector('#categoryOptions').innerHTML=allCategories().map((x,i)=>`<label class="category-option" draggable="true" data-category="${esc(x)}"><input type="checkbox" name="expenseCategory" value="${esc(x)}" ${i===0?'checked':''}><span>${esc(x)}</span></label>`).join('')}
function render(){const monthExpenses=expenses.filter(x=>{const date=new Date(x.createdAt);return date.getFullYear()===selectedMonth.getFullYear()&&date.getMonth()===selectedMonth.getMonth()}),total=monthExpenses.reduce((s,x)=>s+x.baseAmount,0),grouped=allCategories().map((name,i)=>({name,color:colors[i%colors.length],value:monthExpenses.reduce((s,x)=>s+(x.categories.includes(name)?x.baseAmount/x.categories.length:0),0)})).filter(x=>x.value),top=[...grouped].sort((a,b)=>b.value-a.value)[0],ratio=budget?Math.min(total/budget*100,100):0,daysInMonth=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()+1,0).getDate(),isCurrentMonth=selectedMonth.getFullYear()===today.getFullYear()&&selectedMonth.getMonth()===today.getMonth(),monthProgress=isCurrentMonth?Math.round(today.getDate()/daysInMonth*100):selectedMonth<today?100:0;
document.querySelector('#baseCurrencyLabel').textContent=baseCurrency?`기준 ${baseCurrency} · ${symbols[baseCurrency]}`:'기준 통화 설정';
document.querySelector('#totalSpend').textContent=format(total);
const totalKrw=baseCurrency==='KRW'?total:rates?.KRW?total*rates.KRW:null;
document.querySelector('#totalSpendKrw').textContent=totalKrw===null?'원화 환산 중…':`₩${money(totalKrw,'KRW')}`;
document.querySelector('#chartTotal').textContent=format(total);
document.querySelector('#budgetAmount').textContent=budget?format(budget):'예산 미설정';
document.querySelector('#budgetProgress').style.width=`${ratio}%`;
document.querySelector('#budgetStatus').textContent=budget?`예산의 ${Math.round(total/budget*100)}%를 사용했어요`:'수정 버튼으로 예산을 설정하세요';
document.querySelector('#monthStatus').textContent=`이번 달이 ${monthProgress}% 지났어요`;
document.querySelector('#monthProgress').style.width=`${monthProgress}%`;
document.querySelector('#topCategory').textContent=top?top.name:'—';
document.querySelector('#topCategoryAmount').textContent=top?`${format(top.value)} 지출`:'지출을 기록해 보세요';
let p=0;
document.querySelector('#donut').style.background=grouped.length?`conic-gradient(${grouped.map(x=>{let a=p;
p+=x.value/total*100;
return `${x.color} ${a}% ${p}%`}).join(',')})`:'#ebe7dd';
document.querySelector('#legend').innerHTML=grouped.length?grouped.map(x=>`<div class="legend-item"><span class="legend-left"><i class="legend-dot" style="background:${x.color}"></i>${x.name}</span><span class="legend-price">${format(x.value)}</span></div>`).join(''):'<div class="empty-state">카테고리 분석은 지출을 추가한 뒤 표시돼요.</div>';
document.querySelector('#expenseList').innerHTML=monthExpenses.length?[...monthExpenses].reverse().map(x=>`<div class="expense-item"><span class="category-icon" style="background:${colors[allCategories().indexOf(x.categories[0])%colors.length]}33">${icons[x.categories[0]]||'•'}</span><div><div class="expense-name">${esc(x.name)}</div><div class="expense-meta">${esc(x.categories.join(' · '))} · ${x.date} · ${symbols[x.inputCurrency]}${money(x.inputAmount,x.inputCurrency)}</div></div><span class="expense-price">${format(x.baseAmount)}</span><button class="delete-button" data-id="${x.id}">×</button></div>`).join(''):'<div class="empty-state">이 달에는 아직 기록이 없어요.</div>';
const budgetGap=budget?Math.round(total/budget*100)-monthProgress:null;
document.querySelector('#tipText').textContent=budgetGap===null?'예산을 설정하면 소비 속도를 비교해 드릴게요.':Math.abs(budgetGap)<=10?'달이 지난 속도에 맞춰 적절하게 사용하고 있어요.':budgetGap>10?'달이 지난 속도보다 지출이 빠릅니다. 남은 기간의 예산을 살펴보세요.':'달이 지난 속도보다 지출이 적어요. 현재처럼 여유 있게 관리해 보세요.';
note()}
function openModal(){document.querySelector('#baseCurrencySelect').value=baseCurrency||'EUR';
document.querySelector('#baseChangeWarning').textContent=expenses.length?'기준 통화를 바꾸면 기존 기록은 기존 기준 통화로 유지됩니다.':'';
document.querySelector('#currencyModal').hidden=false}
document.querySelector('#settingsButton').onclick=openModal;
document.querySelector('#saveBaseCurrency').onclick=()=>{baseCurrency=document.querySelector('#baseCurrencySelect').value;
localStorage.setItem(baseKey,baseCurrency);
localStorage.setItem(onboardingKey,'true');
document.querySelector('#currencyModal').hidden=true;
restoreCachedRates();
render();
loadRates();
document.querySelector('#graphBase').value=baseCurrency;
loadExchangeGraph()};

function renderReport(){const key=document.querySelector('#reportMonthSelect').value,[year,month]=key.split('-').map(Number),items=expenses.filter(x=>{const date=new Date(x.createdAt);return date.getFullYear()===year&&date.getMonth()+1===month}),total=items.reduce((sum,x)=>sum+x.baseAmount,0),groups=allCategories().map((name,index)=>({name,color:colors[index%colors.length],value:items.reduce((sum,x)=>sum+(x.categories.includes(name)?x.baseAmount/x.categories.length:0),0)})).filter(x=>x.value).sort((a,b)=>b.value-a.value),top=groups[0],max=top?.value||1;document.querySelector('#reportTotal').textContent=format(total);document.querySelector('#reportTopCategory').textContent=top?.name||'—';document.querySelector('#reportTopAmount').textContent=top?format(top.value):'기록이 없어요';document.querySelector('#reportCount').textContent=`${items.length}건`;document.querySelector('#reportCategoryList').innerHTML=groups.length?groups.map(x=>`<div class="report-category-row"><span>${esc(x.name)}</span><i style="width:${x.value/max*100}%;background:${x.color}"></i><strong>${format(x.value)}</strong></div>`).join(''):'<div class="empty-state">이 달에는 기록이 없어요.</div>'}
function openReport(){const select=document.querySelector('#reportMonthSelect'),keys=[...new Set(expenses.map(x=>{const date=new Date(x.createdAt);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}))],current=`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth()+1).padStart(2,'0')}`;if(!keys.includes(current))keys.push(current);select.innerHTML=keys.sort().reverse().map(x=>{const [year,month]=x.split('-');return `<option value="${x}">${year}년 ${Number(month)}월</option>`}).join('');select.value=current;renderReport();document.querySelector('#reportModal').hidden=false}
document.querySelector('#reportButton').onclick=openReport;
document.querySelector('#closeReport').onclick=()=>document.querySelector('#reportModal').hidden=true;
document.querySelector('#reportMonthSelect').onchange=renderReport;
document.querySelector('#graphBase').onchange=loadExchangeGraph;
document.querySelector('#graphQuote').onchange=loadExchangeGraph;

function saveBudget(){const amount=document.querySelector('#budgetAmount'),value=Number(amount.textContent.replace(/[^0-9.]/g,''));if(!value)return alert('올바른 예산 금액을 입력해 주세요.');budget=value;localStorage.setItem(budgetKey,budget);amount.contentEditable='false';document.querySelector('#editBudget').textContent='수정';render()}
document.querySelector('#editBudget').onclick=()=>{const amount=document.querySelector('#budgetAmount');if(amount.contentEditable==='true')return saveBudget();amount.textContent=budget||'';amount.contentEditable='true';document.querySelector('#editBudget').textContent='저장';amount.focus()};
document.querySelector('#budgetAmount').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveBudget()}};

document.querySelector('#addCategory').onclick=()=>{const name=prompt('새 지출 항목 이름을 입력하세요.');
if(!name?.trim()||allCategories().includes(name.trim()))return;
customCategories.push(name.trim());
localStorage.setItem(customCategoryKey,JSON.stringify(customCategories));
categoryOrder.push(name.trim());
localStorage.setItem(categoryOrderKey,JSON.stringify(categoryOrder));
renderCategories()};

let draggedCategory='';
const categoryOptions=document.querySelector('#categoryOptions');
categoryOptions.addEventListener('dragstart',e=>{const item=e.target.closest('.category-option');if(!item)return;draggedCategory=item.dataset.category;item.classList.add('dragging')});
categoryOptions.addEventListener('dragend',e=>{e.target.closest('.category-option')?.classList.remove('dragging');categoryOptions.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'))});
categoryOptions.addEventListener('dragover',e=>{e.preventDefault();const item=e.target.closest('.category-option');if(item&&item.dataset.category!==draggedCategory)item.classList.add('drag-over')});
categoryOptions.addEventListener('dragleave',e=>e.target.closest('.category-option')?.classList.remove('drag-over'));
categoryOptions.addEventListener('drop',e=>{e.preventDefault();const target=e.target.closest('.category-option');if(!target||!draggedCategory)return;const from=categoryOrder.indexOf(draggedCategory),to=categoryOrder.indexOf(target.dataset.category);categoryOrder.splice(from,1);categoryOrder.splice(to,0,draggedCategory);localStorage.setItem(categoryOrderKey,JSON.stringify(categoryOrder));renderCategories();render();draggedCategory=''});

document.querySelector('#expenseAmount').oninput=note;
document.querySelector('#inputCurrency').onchange=note;

document.querySelector('#expenseForm').onsubmit=e=>{e.preventDefault();
if(!baseCurrency)return openModal();
const amount=Number(document.querySelector('#expenseAmount').value),inputCurrency=document.querySelector('#inputCurrency').value,baseAmount=convert(amount,inputCurrency),selected=[...document.querySelectorAll('input[name="expenseCategory"]:checked')].map(x=>x.value);
if(baseAmount===null){loadRates();
return note('환율을 불러오는 중이에요. 잠시 후 다시 추가해 주세요.')}if(!selected.length)return alert('지출 항목을 하나 이상 선택해 주세요.');
expenses.push({id:Date.now(),name:document.querySelector('#expenseName').value.trim(),inputAmount:amount,inputCurrency,baseAmount,categories:selected,date:`${today.getMonth()+1}/${today.getDate()}`,createdAt:today.toISOString(),rateDate});
save();
e.target.reset();
renderCategories();
render()};

document.querySelector('#expenseList').onclick=e=>{if(e.target.dataset.id){expenses=expenses.filter(x=>x.id!==Number(e.target.dataset.id));
save();
render()}};
document.querySelector('#clearButton').onclick=()=>{if(expenses.length&&confirm('모든 지출 기록을 삭제할까요?')){expenses=[];
save();
render()}};

renderCategories();
if(!baseCurrency&&!localStorage.getItem(onboardingKey))openModal();
else{render();
loadRates()}
if(baseCurrency)document.querySelector('#graphBase').value=baseCurrency;
loadExchangeGraph();
