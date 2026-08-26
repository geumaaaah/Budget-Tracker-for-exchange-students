const dataKey='wander-wallet-expenses',baseKey='wander-wallet-base-currency',legacyKey='wander-wallet-currency',rateCacheKey='wander-wallet-rate-cache',budgetKey='wander-wallet-budget',customCategoryKey='wander-wallet-custom-categories',categoryOrderKey='wander-wallet-category-order',onboardingKey='wander-wallet-onboarding-complete',travelCurrencyKey='wander-wallet-travel-currency';

const symbols={KRW:'₩',USD:'$',EUR:'€',JPY:'¥'},colors=['#ed7248','#f5bc48','#8fc6b1','#92b5d5','#b8a5d4','#b4aca0'],icons={식비:'☕',교통:'◈',생활:'⌂',여행:'✦',학업:'✎',기타:'○'},defaultCategories=['식비','교통','생활','여행','학업','기타'];

let baseCurrency=localStorage.getItem(baseKey)||localStorage.getItem(legacyKey)||'',travelCurrency=localStorage.getItem(travelCurrencyKey)||baseCurrency||'EUR';
let selectedMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);

let expenses=JSON.parse(localStorage.getItem(dataKey)||'[]'),rates=null,rateDate='',rateRequest=null,budget=Number(localStorage.getItem(budgetKey))||0,customCategories=JSON.parse(localStorage.getItem(customCategoryKey)||'[]'),categoryOrder=JSON.parse(localStorage.getItem(categoryOrderKey)||'null')||[...defaultCategories,...customCategories],exchangeRequestId=0,pendingExpense=null;

expenses=expenses.map(x=>({...(x.baseAmount===undefined?{...x,inputAmount:x.amount,inputCurrency:baseCurrency||'KRW',baseAmount:x.amount}:x),categories:x.categories||[x.category||'식비'],createdAt:x.createdAt||new Date().toISOString()}));

const today=new Date(),money=(x,c=baseCurrency)=>new Intl.NumberFormat('ko-KR',{minimumFractionDigits:['EUR','USD'].includes(c)?2:0,maximumFractionDigits:['EUR','USD'].includes(c)?2:0}).format(x),format=x=>`${symbols[baseCurrency]||''}${money(x)}`,formatBudget=x=>`${symbols[baseCurrency]||''}${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(Math.round(x))}`,allCategories=()=>categoryOrder;

const save=()=>localStorage.setItem(dataKey,JSON.stringify(expenses));
save();

const expenseDate=document.querySelector('#expenseDate'),toDateValue=date=>date.toISOString().slice(0,10);
expenseDate.value=toDateValue(today);
document.querySelector('#inputCurrency').value=travelCurrency;
function syncExpenseDate(){const date=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth(),Math.min(today.getDate(),new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()+1,0).getDate()));expenseDate.value=toDateValue(date)}
function renderMonthLabel(){document.querySelector('#monthLabel').textContent=`${selectedMonth.getFullYear()}년 ${selectedMonth.getMonth()+1}월`}
renderMonthLabel();
document.querySelector('#prevMonth').onclick=()=>{selectedMonth.setMonth(selectedMonth.getMonth()-1);syncExpenseDate();renderMonthLabel();render()};
document.querySelector('#nextMonth').onclick=()=>{selectedMonth.setMonth(selectedMonth.getMonth()+1);syncExpenseDate();renderMonthLabel();render()};
expenseDate.onchange=()=>{const date=new Date(`${expenseDate.value}T12:00:00`);if(Number.isNaN(date.getTime()))return;selectedMonth=new Date(date.getFullYear(),date.getMonth(),1);renderMonthLabel();render()};

function restoreCachedRates(){const cache=JSON.parse(localStorage.getItem(rateCacheKey)||'null');
if(cache?.base===baseCurrency&&cache.rates){rates=cache.rates;
rateDate=cache.date;
return true}rates=null;
rateDate='';
return false}
function fetchWithTimeout(url,timeout=2500){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
return fetch(url,{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();
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
function roundBase(x){return ['EUR','USD'].includes(baseCurrency)?Math.round((x+Number.EPSILON)*100)/100:Math.round(x)}
function note(error=''){const amount=Number(document.querySelector('#expenseAmount').value),input=document.querySelector('#inputCurrency').value,el=document.querySelector('#conversionNote');
if(error){el.textContent=error;
return}if(!baseCurrency){el.textContent='기준 통화를 설정하면 환산 금액을 보여드려요.';
return}if(!amount){el.textContent=`입력 금액은 ${symbols[baseCurrency]} ${baseCurrency} 기준으로 기록돼요.`;
return}const x=convert(amount,input);
el.textContent=x===null?'환율을 빠르게 불러오는 중이에요…':`${symbols[input]}${money(amount,input)} → ${format(x)}${rateDate?` · ${rateDate} 기준 환율`:''}`}
function exchangeTimestamp(value){const parts=new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).formatToParts(new Date(value)),part=type=>parts.find(x=>x.type===type)?.value;return `${part('month')}.${part('day')} ${part('hour')}:${part('minute')}`}
async function loadExchangeGraph(){const from=document.querySelector('#graphBase').value,to=document.querySelector('#graphQuote').value,value=document.querySelector('#exchangeRateValue'),svg=document.querySelector('#exchangeChart'),requestId=++exchangeRequestId;if(from===to){value.textContent=`1 ${from} = 1 ${to}`;document.querySelector('#exchangeRateDate').textContent='실시간 갱신';svg.innerHTML='<path class="chart-line" d="M 5 52 L 325 52" />';return}value.textContent='환율 불러오는 중…';const end=new Date(),start=new Date(end);start.setDate(end.getDate()-30),date=x=>x.toISOString().slice(0,10),historyUrl=`https://api.frankfurter.dev/v1/${date(start)}..${date(end)}?base=${from}&symbols=${to}`,liveUrl=`https://www.currencyexchangetool.com/api/v1/convert?amount=1&from=${from}&to=${to}&_=${Date.now()}`;const [historyResult,liveResult]=await Promise.allSettled([fetchWithTimeout(historyUrl,5000),fetchWithTimeout(liveUrl,5000)]);if(requestId!==exchangeRequestId)return;try{if(historyResult.status!=='fulfilled')throw Error();const entries=Object.entries(historyResult.value.rates).map(([day,rate])=>({day,value:rate[to],time:new Date(`${day}T12:00:00Z`).getTime()})).filter(x=>Number.isFinite(x.value));if(!entries.length)throw Error();const live=liveResult.status==='fulfilled'&&liveResult.value?.success&&Number.isFinite(Number(liveResult.value.rate))?{value:Number(liveResult.value.rate),time:new Date(liveResult.value.updatedAt||Date.now()).getTime()}:null;if(live)entries.push({day:'오늘',...live});const values=entries.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),range=max-min||1,firstTime=entries[0].time,lastTime=entries.at(-1).time,timeRange=lastTime-firstTime||1,points=entries.map(x=>{const px=8+(x.time-firstTime)/timeRange*314,py=91-(x.value-min)/range*76;return [px,py]}),line=points.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '),area=`M ${points[0][0]} 97 ${points.map(p=>`L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')} L ${points.at(-1)[0]} 97 Z`,latest=entries.at(-1);value.textContent=`1 ${from} = ${money(latest.value,to)} ${to}`;document.querySelector('#exchangeRateDate').textContent=live?`실시간 갱신 · ${exchangeTimestamp(live.time)}`:`${latest.day} 기준 · 최근 30일`;document.querySelector('#chartStartDate').textContent=entries[0].day.slice(5).replace('-','.');document.querySelector('#chartEndDate').textContent=live?`오늘 ${exchangeTimestamp(live.time).split(' ')[1]}`:latest.day.slice(5).replace('-','.');svg.innerHTML=`<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/><circle class="chart-dot" cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="3.5"/>`}catch{value.textContent='환율을 불러오지 못했어요';document.querySelector('#exchangeRateDate').textContent='잠시 후 다시 시도해 주세요.';svg.innerHTML=''}}
function esc(x){return x.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderCategories(){document.querySelector('#categoryOptions').innerHTML=allCategories().map((x,i)=>`<label class="category-option" draggable="true" data-category="${esc(x)}"><input type="checkbox" name="expenseCategory" value="${esc(x)}" ${i===0?'checked':''}><span>${esc(x)}</span></label>`).join('')}
function renderEditCategories(selected){document.querySelector('#editCategoryOptions').innerHTML=allCategories().map(x=>`<label class="category-option"><input type="checkbox" name="editExpenseCategory" value="${esc(x)}" ${selected.includes(x)?'checked':''}><span>${esc(x)}</span></label>`).join('')}
function openEditExpense(id){const item=expenses.find(x=>x.id===Number(id));if(!item)return;document.querySelector('#editExpenseId').value=item.id;document.querySelector('#editExpenseName').value=item.name;document.querySelector('#editExpenseAmount').value=item.inputAmount;document.querySelector('#editInputCurrency').value=item.inputCurrency;document.querySelector('#editExpenseDate').value=toDateValue(new Date(item.createdAt));renderEditCategories(item.categories);document.querySelector('#editExpenseModal').hidden=false}
function render(){const monthExpenses=expenses.filter(x=>{const date=new Date(x.createdAt);return date.getFullYear()===selectedMonth.getFullYear()&&date.getMonth()===selectedMonth.getMonth()}),total=monthExpenses.reduce((s,x)=>s+x.baseAmount,0),grouped=allCategories().map((name,i)=>({name,color:colors[i%colors.length],value:monthExpenses.reduce((s,x)=>s+(x.categories.includes(name)?x.baseAmount/x.categories.length:0),0)})).filter(x=>x.value),ranking=[...grouped].sort((a,b)=>b.value-a.value),top=ranking[0],second=ranking[1],ratio=budget?Math.min(total/budget*100,100):0,daysInMonth=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()+1,0).getDate(),isCurrentMonth=selectedMonth.getFullYear()===today.getFullYear()&&selectedMonth.getMonth()===today.getMonth(),monthProgress=isCurrentMonth?Math.round(today.getDate()/daysInMonth*100):selectedMonth<today?100:0;
document.querySelector('#baseCurrencyLabel').textContent=baseCurrency?`기준 ${baseCurrency} · ${symbols[baseCurrency]}`:'기준 통화 설정';
document.querySelector('#totalSpend').textContent=format(total);
const totalKrw=baseCurrency==='KRW'?total:rates?.KRW?total*rates.KRW:null,totalSpendKrw=document.querySelector('#totalSpendKrw');
totalSpendKrw.hidden=baseCurrency==='KRW';
if(baseCurrency!=='KRW')totalSpendKrw.textContent=totalKrw===null?'원화 환산 중…':`₩${money(totalKrw,'KRW')}`;
document.querySelector('#chartTotal').textContent=format(total);
document.querySelector('#budgetAmount').textContent=budget?formatBudget(budget):'예산 미설정';
document.querySelector('#budgetProgress').style.width=`${ratio}%`;
document.querySelector('#budgetStatus').textContent=budget?`예산의 ${Math.round(total/budget*100)}%를 사용했어요`:'수정 버튼으로 예산을 설정하세요';
document.querySelector('#monthStatus').textContent=`이번 달이 ${monthProgress}% 지났어요`;
document.querySelector('#monthProgress').style.width=`${monthProgress}%`;
document.querySelector('#topCategory').textContent=top?top.name:'—';
document.querySelector('#topCategoryAmount').textContent=top?`${format(top.value)} 지출`:'지출을 기록해 보세요';
document.querySelector('#secondCategory').textContent=second?second.name:'—';
document.querySelector('#secondCategoryAmount').textContent=second?`${format(second.value)} 지출`:'—';
let p=0;
document.querySelector('#donut').style.background=grouped.length?`conic-gradient(${grouped.map(x=>{let a=p;
p+=x.value/total*100;
return `${x.color} ${a}% ${p}%`}).join(',')})`:'#ebe7dd';
document.querySelector('#legend').innerHTML=grouped.length?grouped.map(x=>`<div class="legend-item"><span class="legend-left"><i class="legend-dot" style="background:${x.color}"></i>${x.name}</span><span class="legend-price">${format(x.value)}</span></div>`).join(''):'<div class="empty-state">카테고리 분석은 지출을 추가한 뒤 표시돼요.</div>';
document.querySelector('#expenseList').innerHTML=monthExpenses.length?[...monthExpenses].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)||b.id-a.id).map(x=>`<div class="expense-item"><span class="category-icon" style="background:${colors[allCategories().indexOf(x.categories[0])%colors.length]}33">${icons[x.categories[0]]||'•'}</span><div><div class="expense-name">${esc(x.name)}</div><div class="expense-meta">${esc(x.categories.join(' · '))} · ${x.date} · ${symbols[x.inputCurrency]}${money(x.inputAmount,x.inputCurrency)}</div></div><span class="expense-price">${format(x.baseAmount)}</span><button class="edit-button" data-edit-id="${x.id}" aria-label="${esc(x.name)} 수정">✎</button><button class="delete-button" data-delete-id="${x.id}" aria-label="${esc(x.name)} 삭제">×</button></div>`).join(''):'<div class="empty-state">이 달에는 아직 기록이 없어요.</div>';
const budgetGap=budget?Math.round(total/budget*100)-monthProgress:null;
document.querySelector('#tipText').innerHTML=budgetGap===null?'예산을 설정하면 소비 속도를 비교해 드릴게요.':budgetGap<-10?'여행은 즐기고, 예산은 아끼고 있어요.<br>지금 페이스라면 이번 달도 든든해요.':Math.abs(budgetGap)<=10?'여행도 즐기고, 예산도 잘 맞춰가고 있어요.<br>지금 페이스라면 이번 달도 안정적이에요.':'여행은 충분히 즐기고 있어요.<br>다만 예산이 빠르게 줄고 있어 남은 일정은 지출 조절이 필요해요.';
note()}
function openModal(){document.querySelector('#baseCurrencySelect').value=baseCurrency||'EUR';
document.querySelector('#travelCurrencySelect').value=travelCurrency;
document.querySelector('#baseChangeWarning').textContent=expenses.length?'기준 통화를 바꾸면 기존 기록은 기존 기준 통화로 유지됩니다.':'';
document.querySelector('#currencyModal').hidden=false}
document.querySelector('#settingsButton').onclick=openModal;
document.querySelector('#saveBaseCurrency').onclick=()=>{baseCurrency=document.querySelector('#baseCurrencySelect').value;
travelCurrency=document.querySelector('#travelCurrencySelect').value;
localStorage.setItem(baseKey,baseCurrency);
localStorage.setItem(travelCurrencyKey,travelCurrency);
localStorage.setItem(onboardingKey,'true');
document.querySelector('#currencyModal').hidden=true;
document.querySelector('#inputCurrency').value=travelCurrency;
restoreCachedRates();
render();
loadRates();
document.querySelector('#graphBase').value=travelCurrency;
document.querySelector('#graphQuote').value='KRW';
loadExchangeGraph()};

function renderReport(){const key=document.querySelector('#reportMonthSelect').value,[year,month]=key.split('-').map(Number),items=expenses.filter(x=>{const date=new Date(x.createdAt);return date.getFullYear()===year&&date.getMonth()+1===month}),total=items.reduce((sum,x)=>sum+x.baseAmount,0),groups=allCategories().map((name,index)=>({name,color:colors[index%colors.length],value:items.reduce((sum,x)=>sum+(x.categories.includes(name)?x.baseAmount/x.categories.length:0),0)})).filter(x=>x.value).sort((a,b)=>b.value-a.value),top=groups[0],max=top?.value||1,delta=budget?total-budget:null,percent=budget?Math.round(Math.abs(delta)/budget*100):null;document.querySelector('#reportTotal').textContent=format(total);document.querySelector('#reportTopCategory').textContent=top?.name||'—';document.querySelector('#reportTopAmount').textContent=top?format(top.value):'기록이 없어요';document.querySelector('#reportBudgetDelta').textContent=delta===null?'예산 미설정':delta>0?`${percent}% 초과`:`${percent}% 절약`;document.querySelector('#reportBudgetAmount').textContent=delta===null?'예산을 설정해 주세요':delta>0?`${format(delta)} 더 썼어요`:`${format(Math.abs(delta))} 덜 썼어요`;document.querySelector('#reportCategoryList').innerHTML=groups.length?groups.map(x=>`<div class="report-category-row"><span>${esc(x.name)}</span><i style="width:${x.value/max*100}%;background:${x.color}"></i><strong>${format(x.value)}</strong></div>`).join(''):'<div class="empty-state">이 달에는 기록이 없어요.</div>'}
function renderComparison(){const totals=new Map();expenses.forEach(x=>{const date=new Date(x.createdAt),key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;totals.set(key,(totals.get(key)||0)+x.baseAmount)});const [year,month]=document.querySelector('#reportMonthSelect').value.split('-').map(Number),end=new Date(year,month-1,1),keys=[2,1,0].map(offset=>{const date=new Date(end.getFullYear(),end.getMonth()-offset,1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}),values=keys.map(key=>totals.get(key)||0),total=values.reduce((sum,value)=>sum+value,0),palette=['#92b5d5','#f5bc48','#ed7248'];let progress=0;const gradient=total?values.map((value,index)=>{const start=progress;progress+=value/total*100;return `${palette[index]} ${start}% ${progress}%`}).join(','):'#ebe7dd';document.querySelector('#reportComparisonChart').innerHTML=`<div class="comparison-chart"><div class="comparison-donut" style="background:conic-gradient(${gradient})"></div><div class="comparison-legend">${keys.map((key,index)=>{const [,label]=key.split('-');return `<div class="comparison-item"><span><i class="comparison-dot" style="background:${palette[index]}"></i>${Number(label)}월</span><strong>${format(values[index])}</strong></div>`}).join('')}</div></div>`}
function openReport(){const select=document.querySelector('#reportMonthSelect'),keys=[...new Set(expenses.map(x=>{const date=new Date(x.createdAt);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}))],current=`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth()+1).padStart(2,'0')}`;if(!keys.includes(current))keys.push(current);select.innerHTML=keys.sort().reverse().map(x=>{const [year,month]=x.split('-');return `<option value="${x}">${year}년 ${Number(month)}월</option>`}).join('');select.value=current;renderReport();renderComparison();document.querySelector('#reportModal').hidden=false}
document.querySelector('#reportButton').onclick=openReport;
document.querySelector('#closeReport').onclick=()=>document.querySelector('#reportModal').hidden=true;
document.querySelector('#reportMonthSelect').onchange=()=>{renderReport();renderComparison()};
document.querySelector('#graphBase').onchange=loadExchangeGraph;
document.querySelector('#graphQuote').onchange=loadExchangeGraph;
document.querySelector('#refreshExchange').onclick=loadExchangeGraph;

function saveBudget(){const amount=document.querySelector('#budgetAmount'),value=Number(amount.textContent.replace(/[^0-9.]/g,''));if(!value)return alert('올바른 예산 금액을 입력해 주세요.');budget=Math.round(value);localStorage.setItem(budgetKey,budget);amount.contentEditable='false';document.querySelector('#editBudget').textContent='수정';render()}
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

function saveExpense(expense){expenses.push({id:Date.now(),...expense});save();document.querySelector('#expenseForm').reset();expenseDate.value=toDateValue(new Date(expense.createdAt));document.querySelector('#inputCurrency').value=travelCurrency;renderCategories();render()}
function manualRateToBase(amount,krwRate){if(pendingExpense.inputCurrency==='KRW')return roundBase(amount/krwRate);const krwAmount=amount*krwRate,basePerKrw=pendingExpense?.basePerKrw??(rates?.KRW?1/rates.KRW:null);return baseCurrency==='KRW'?roundBase(krwAmount):basePerKrw===null?null:roundBase(krwAmount*basePerKrw)}
function updateManualRatePreview(){const rate=Number(document.querySelector('#manualRate').value),preview=document.querySelector('#manualRatePreview');if(!Number.isFinite(rate)||rate<=0)return preview.textContent='환율을 입력하면 환산 금액을 보여드려요.';const baseAmount=manualRateToBase(pendingExpense.amount,rate);if(pendingExpense.inputCurrency==='KRW')return preview.textContent=`₩${money(pendingExpense.amount,'KRW')} → ${baseAmount===null?'':format(baseAmount)}`;const krwAmount=Math.round(pendingExpense.amount*rate);preview.textContent=`${symbols[pendingExpense.inputCurrency]}${money(pendingExpense.amount,pendingExpense.inputCurrency)} → ₩${money(krwAmount,'KRW')}${baseCurrency==='KRW'?'':baseAmount===null?'':` → ${format(baseAmount)}`}`}
async function openRateModal(expense){expense.manualCurrency=expense.inputCurrency==='KRW'?baseCurrency:expense.inputCurrency;pendingExpense=expense;const liveBase=convert(expense.amount,expense.inputCurrency),liveRate=liveBase===null?null:liveBase/expense.amount,cachedKrwRate=expense.inputCurrency==='KRW'?rates?.KRW:baseCurrency==='KRW'?liveRate:rates?.KRW&&liveRate?liveRate*rates.KRW:null;document.querySelector('#rateModalTitle').textContent=`${expense.inputCurrency} 결제 환율 선택`;document.querySelector('#ratePairLabel').textContent=`1 ${expense.manualCurrency} = KRW`;document.querySelector('#manualRate').value=cachedKrwRate?String(cachedKrwRate):'';document.querySelector('#liveRatePreview').textContent=liveBase===null?'실시간 환율을 불러오는 중이에요.':`이전 조회값 · ${symbols[expense.inputCurrency]}${money(expense.amount,expense.inputCurrency)} → ${format(liveBase)}`;document.querySelector('#rateModeLive').checked=true;document.querySelector('#manualRate').disabled=true;updateManualRatePreview();document.querySelector('#rateModal').hidden=false;try{const [baseData,krwData]=await Promise.all([fetchWithTimeout(`https://www.currencyexchangetool.com/api/v1/convert?amount=1&from=${expense.inputCurrency}&to=${baseCurrency}&_=${Date.now()}`,5000),fetchWithTimeout(`https://www.currencyexchangetool.com/api/v1/convert?amount=1&from=${expense.manualCurrency}&to=KRW&_=${Date.now()}`,5000)]),baseRate=Number(baseData.rate),krwRate=Number(krwData.rate);if(pendingExpense!==expense||!baseData.success||!krwData.success||!Number.isFinite(baseRate)||!Number.isFinite(krwRate))return;pendingExpense.liveBase=roundBase(expense.amount*baseRate);pendingExpense.liveRate=baseRate;pendingExpense.basePerKrw=baseRate/krwRate;if(document.querySelector('#rateModeLive').checked)document.querySelector('#manualRate').value=String(krwRate);document.querySelector('#liveRatePreview').textContent=`실시간 · ${symbols[expense.inputCurrency]}${money(expense.amount,expense.inputCurrency)} → ${format(pendingExpense.liveBase)}`;updateManualRatePreview()}catch{}}
document.querySelector('#expenseForm').onsubmit=e=>{e.preventDefault();if(!baseCurrency)return openModal();const amount=Number(document.querySelector('#expenseAmount').value),inputCurrency=document.querySelector('#inputCurrency').value,selected=[...document.querySelectorAll('input[name="expenseCategory"]:checked')].map(x=>x.value),selectedDate=new Date(`${expenseDate.value}T12:00:00`);if(!selected.length)return alert('지출 항목을 하나 이상 선택해 주세요.');const expense={name:document.querySelector('#expenseName').value.trim(),amount,inputCurrency,categories:selected,date:`${selectedDate.getMonth()+1}/${selectedDate.getDate()}`,createdAt:selectedDate.toISOString()};if(inputCurrency===baseCurrency)return saveExpense({...expense,inputAmount:amount,baseAmount:amount,rateDate:'동일 통화'});openRateModal(expense)};
document.querySelectorAll('input[name="rateMode"]').forEach(input=>input.onchange=()=>{document.querySelector('#manualRate').disabled=document.querySelector('#rateModeLive').checked});
document.querySelector('#manualRate').oninput=updateManualRatePreview;
document.querySelector('#closeRateModal').onclick=()=>{pendingExpense=null;document.querySelector('#rateModal').hidden=true};
document.querySelector('#rateForm').onsubmit=e=>{e.preventDefault();if(!pendingExpense)return;const isManual=document.querySelector('#rateModeManual').checked,manualRate=Number(document.querySelector('#manualRate').value),baseAmount=isManual?manualRateToBase(pendingExpense.amount,manualRate):pendingExpense.liveBase??convert(pendingExpense.amount,pendingExpense.inputCurrency);if(isManual&&(!Number.isFinite(manualRate)||manualRate<=0))return alert('올바른 환율을 입력해 주세요.');if(baseAmount===null){loadRates();return alert('환율을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.')}saveExpense({...pendingExpense,inputAmount:pendingExpense.amount,baseAmount,rateDate:isManual?`직접 입력 · 1 ${pendingExpense.manualCurrency} = ${manualRate} KRW`:pendingExpense.liveRate?`실시간 · 1 ${pendingExpense.inputCurrency} = ${pendingExpense.liveRate} ${baseCurrency}`:rateDate,rateType:isManual?'manual':'live'});pendingExpense=null;document.querySelector('#rateModal').hidden=true};

document.querySelector('#expenseList').onclick=e=>{if(e.target.dataset.editId)return openEditExpense(e.target.dataset.editId);if(e.target.dataset.deleteId){expenses=expenses.filter(x=>x.id!==Number(e.target.dataset.deleteId));
save();
render()}};
document.querySelector('#closeEditExpense').onclick=()=>document.querySelector('#editExpenseModal').hidden=true;
document.querySelector('#editExpenseForm').onsubmit=e=>{e.preventDefault();const id=Number(document.querySelector('#editExpenseId').value),amount=Number(document.querySelector('#editExpenseAmount').value),inputCurrency=document.querySelector('#editInputCurrency').value,baseAmount=convert(amount,inputCurrency),selected=[...document.querySelectorAll('input[name="editExpenseCategory"]:checked')].map(x=>x.value),date=new Date(`${document.querySelector('#editExpenseDate').value}T12:00:00`);if(baseAmount===null)return alert('환율을 불러온 뒤 다시 시도해 주세요.');if(!selected.length)return alert('지출 항목을 하나 이상 선택해 주세요.');expenses=expenses.map(x=>x.id===id?{...x,name:document.querySelector('#editExpenseName').value.trim(),inputAmount:amount,inputCurrency,baseAmount,categories:selected,date:`${date.getMonth()+1}/${date.getDate()}`,createdAt:date.toISOString(),rateDate}:x);save();document.querySelector('#editExpenseModal').hidden=true;render()};
document.querySelector('#feedbackForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,status=document.querySelector('#feedbackStatus');status.textContent='전송 중이에요…';try{const response=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});if(!response.ok)throw Error();form.reset();status.textContent='소중한 의견을 보내주셔서 감사합니다!'}catch{status.textContent='전송에 실패했어요. 잠시 후 다시 시도해 주세요.'}};
document.querySelector('#clearButton').onclick=()=>{if(expenses.length&&confirm('모든 지출 기록을 삭제할까요?')){expenses=[];
save();
render()}};

renderCategories();
if(!baseCurrency&&!localStorage.getItem(onboardingKey))openModal();
else{render();
loadRates()}
if(baseCurrency)document.querySelector('#graphBase').value=travelCurrency;
document.querySelector('#graphQuote').value='KRW';
loadExchangeGraph();
setInterval(()=>{if(!document.hidden)loadExchangeGraph()},60000);
