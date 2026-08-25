const dataKey = 'wander-wallet-expenses';
const budgetKey = 'wander-wallet-budget';
const symbols = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥' };
const colors = ['#ed7248','#f5bc48','#8fc6b1','#92b5d5','#b8a5d4','#b4aca0'];
const icons = { 식비:'☕', 교통:'◈', 생활:'⌂', 여행:'✦', 학업:'✎', 기타:'○' };
const categoryOrder = ['식비','교통','생활','여행','학업','기타'];
let currentCurrency = localStorage.getItem('wander-wallet-currency') || 'KRW';
let expenses = JSON.parse(localStorage.getItem(dataKey) || '[]');
let budget = Number(localStorage.getItem(budgetKey)) || 1500000;

const money = value => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
const formatMoney = value => `${symbols[currentCurrency]}${money(value)}`;
const save = () => localStorage.setItem(dataKey, JSON.stringify(expenses));
const today = new Date();
document.getElementById('todayLabel').textContent = `${today.getMonth()+1}월 ${today.getDate()}일`;
document.getElementById('monthLabel').textContent = `${today.getFullYear()}년 ${today.getMonth()+1}월`;
document.getElementById('currency').value = currentCurrency;

function render() {
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const grouped = categoryOrder.map((name, index) => ({ name, color: colors[index], value: expenses.filter(x => x.category === name).reduce((sum, x) => sum + x.amount, 0) })).filter(x => x.value);
  document.getElementById('totalSpend').textContent = formatMoney(total);
  document.getElementById('chartTotal').textContent = formatMoney(total);
  document.getElementById('entryCount').textContent = expenses.length ? `${expenses.length}건의 지출을 기록했어요` : '아직 기록된 지출이 없어요';
  document.getElementById('budgetAmount').textContent = formatMoney(budget);
  const ratio = Math.min(total / budget * 100, 100);
  document.getElementById('budgetProgress').style.width = `${ratio}%`;
  document.getElementById('budgetStatus').textContent = total ? `예산의 ${Math.round(total / budget * 100)}%를 사용했어요` : '예산을 설정해 보세요';
  const top = grouped.sort((a,b) => b.value-a.value)[0];
  document.getElementById('topCategory').textContent = top ? top.name : '—';
  document.getElementById('topCategoryAmount').textContent = top ? `${formatMoney(top.value)} 지출` : '지출을 기록해 보세요';
  const donut = document.getElementById('donut');
  let running = 0;
  donut.style.background = grouped.length ? `conic-gradient(${grouped.map(x => { const start=running; running += x.value/total*100; return `${x.color} ${start}% ${running}%`; }).join(', ')})` : '#ebe7dd';
  document.getElementById('legend').innerHTML = grouped.length ? grouped.map(x => `<div class="legend-item"><span class="legend-left"><i class="legend-dot" style="background:${x.color}"></i>${x.name}</span><span class="legend-price">${formatMoney(x.value)}</span></div>`).join('') : '<div class="empty-state">카테고리 분석은 지출을 추가한 뒤 표시돼요.</div>';
  document.getElementById('expenseList').innerHTML = expenses.length ? [...expenses].reverse().map(item => `<div class="expense-item"><span class="category-icon" style="background:${colors[categoryOrder.indexOf(item.category)]}33">${icons[item.category]}</span><div><div class="expense-name">${escapeHtml(item.name)}</div><div class="expense-meta">${item.category} · ${item.date}</div></div><span class="expense-price">${formatMoney(item.amount)}</span><button class="delete-button" data-id="${item.id}" aria-label="${escapeHtml(item.name)} 삭제">×</button></div>`).join('') : '<div class="empty-state">아직 기록이 없어요. 첫 지출을 추가해 보세요.</div>';
  document.getElementById('tipText').textContent = !top ? '기록을 시작하면 맞춤 팁을 드릴게요.' : total > budget ? '예산을 넘었어요. 남은 기간은 꼭 필요한 지출만 해볼까요?' : `${top.name} 항목이 가장 커요. 다음 소비 전 한 번 더 살펴보세요.`;
}
function escapeHtml(value){return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
document.getElementById('expenseForm').addEventListener('submit', event => { event.preventDefault(); const name=document.getElementById('expenseName'); const amount=document.getElementById('expenseAmount'); expenses.push({id:Date.now(),name:name.value.trim(),amount:Number(amount.value),category:document.getElementById('expenseCategory').value,date:`${today.getMonth()+1}/${today.getDate()}`}); save(); event.target.reset(); name.focus(); render(); });
document.getElementById('currency').addEventListener('change', event => { currentCurrency=event.target.value; localStorage.setItem('wander-wallet-currency',currentCurrency); render(); });
document.getElementById('expenseList').addEventListener('click', event => { const id=event.target.dataset.id; if(id){ expenses=expenses.filter(item => item.id !== Number(id)); save(); render(); }});
document.getElementById('clearButton').addEventListener('click', () => { if(expenses.length && confirm('모든 지출 기록을 삭제할까요?')) { expenses=[]; save(); render(); }});
render();
