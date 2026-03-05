import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  Trash2,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Settings,
  CreditCard,
  Banknote,
  MapPin,
  Tag,
  ChevronRight,
  ChevronLeft,
  Download,
  Upload,
  PieChart,
} from 'lucide-react';
import { supabase } from './supabase';

const STORAGE_KEY = 'ledger_data';
const APP_ID = '12318';
const ALLOWED_IDS = ['딩부', '동이'];
const LOGIN_PASSWORD = '12318';

function rowToTransaction(row) {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    category: row.category,
    type: row.type,
    place: row.place || '',
    paymentMethod: row.payment_method,
    writer: row.writer,
    createdAt: row.created_at,
  };
}

function sortTransactions(list) {
  return [...list].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function getMonthKey(dateStr) {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.slice(0, 7);
}

function getMonthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

export default function App() {
  const [userName, setUserName] = useState(() => localStorage.getItem('ledger_user_name') || '');
  const [isNameSet, setIsNameSet] = useState(() => !!localStorage.getItem('ledger_user_name'));
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const appId = APP_ID;

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [useSupabase, setUseSupabase] = useState(!!supabase);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('식비');
  const [type, setType] = useState('지출');
  const [place, setPlace] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('현금');

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const categories = {
    지출: ['식비', '간식·커피', '교통비', '쇼핑', '생활비', '공과금·통신', '의료·약', '미용', '문화·여가', '주유·차량', '교육', '저축·보험', '기타'],
    수입: ['월급', '부수입', '이자·배당', '용돈', '기타'],
  };

  const paymentMethods = ['현금', '신용카드', '기타'];

  // Supabase: 데이터 불러오기 + 실시간 구독
  const fetchAndSubscribe = useCallback(() => {
    if (!supabase || !appId) return () => {};

    let channel;

    const fetchList = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        setTransactions([]);
      } else {
        setTransactions(sortTransactions((data || []).map(rowToTransaction)));
      }
      setLoading(false);
    };

    fetchList();

    channel = supabase
      .channel(`transactions:${appId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `app_id=eq.${appId}`,
        },
        () => {
          fetchList();
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [appId]);

  useEffect(() => {
    if (useSupabase && supabase) {
      return fetchAndSubscribe();
    }
    // localStorage 모드 (Supabase 미설정 시)
    setUseSupabase(false);
    setLoading(false);
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_${appId}`);
      const list = raw ? JSON.parse(raw) : [];
      setTransactions(sortTransactions(Array.isArray(list) ? list : []));
    } catch {
      setTransactions([]);
    }
    return () => {};
  }, [appId, useSupabase, fetchAndSubscribe]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const id = loginId.trim();
    const pw = loginPassword;
    if (!ALLOWED_IDS.includes(id)) {
      setLoginError('ID 또는 비밀번호를 확인해 주세요.');
      return;
    }
    if (pw !== LOGIN_PASSWORD) {
      setLoginError('ID 또는 비밀번호를 확인해 주세요.');
      return;
    }
    localStorage.setItem('ledger_user_name', id);
    setUserName(id);
    setIsNameSet(true);
    setShowSettings(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('ledger_user_name');
    setUserName('');
    setIsNameSet(false);
    setShowSettings(false);
    setLoginId('');
    setLoginPassword('');
    setLoginError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) return;

    const payload = {
      app_id: appId,
      date,
      amount: parseInt(amount),
      category,
      type,
      place: place.trim() || category,
      payment_method: paymentMethod,
      writer: userName || '사용자',
      created_at: Date.now(),
    };

    if (supabase && useSupabase) {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) {
        console.error('Insert error:', error);
        alert('저장에 실패했어요. Supabase 설정을 확인해 주세요.');
        return;
      }
    } else {
      const newTx = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ...payload,
        paymentMethod: payload.payment_method,
        createdAt: payload.created_at,
      };
      const next = sortTransactions([...transactions, newTx]);
      setTransactions(next);
      localStorage.setItem(`${STORAGE_KEY}_${appId}`, JSON.stringify(next));
    }

    setAmount('');
    setPlace('');
  };

  const deleteTransaction = async (id) => {
    if (!confirm('이 기록을 삭제할까요?')) return;

    if (supabase && useSupabase) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) console.error('Delete error:', error);
    } else {
      const next = sortTransactions(transactions.filter((t) => t.id !== id));
      setTransactions(next);
      localStorage.setItem(`${STORAGE_KEY}_${appId}`, JSON.stringify(next));
    }
  };

  const handleExport = () => {
    const data = {
      appId,
      exportedAt: new Date().toISOString(),
      transactions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `가계부_${appId}_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data.transactions) ? data.transactions : [];
        if (list.length === 0) {
          alert('불러올 내역이 없어요.');
          return;
        }
        if (supabase && useSupabase) {
          const rows = list.map((t) => ({
            app_id: appId,
            date: t.date,
            amount: t.amount,
            category: t.category,
            type: t.type,
            place: t.place || t.category,
            payment_method: t.paymentMethod || t.payment_method || '현금',
            writer: t.writer || '사용자',
            created_at: t.createdAt || Date.now(),
          }));
          const { error } = await supabase.from('transactions').insert(rows);
          if (error) throw error;
          const { data: refreshed } = await supabase.from('transactions').select('*').eq('app_id', appId).order('created_at', { ascending: false });
          setTransactions(sortTransactions((refreshed || []).map(rowToTransaction)));
        } else {
          const byId = new Map(transactions.map((t) => [t.id, t]));
          list.forEach((t) => byId.set(t.id, { ...t, id: t.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` }));
          const merged = sortTransactions(Array.from(byId.values()));
          setTransactions(merged);
          localStorage.setItem(`${STORAGE_KEY}_${appId}`, JSON.stringify(merged));
        }
        alert(`${list.length}건 가져오기 완료!`);
      } catch (err) {
        alert('파일 형식이 맞지 않아요. 내보낸 JSON 파일인지 확인해 주세요.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case '현금':
        return <Banknote size={14} />;
      case '신용카드':
        return <CreditCard size={14} />;
      default:
        return <Tag size={14} />;
    }
  };

  // 선택한 달의 거래만
  const monthTransactions = transactions.filter((t) => getMonthKey(t.date) === selectedMonth);

  // 현금만: 잔액 = 현금 수입 - 현금 지출 (월별)
  const cashIncome = monthTransactions
    .filter((t) => t.type === '수입' && t.paymentMethod === '현금')
    .reduce((acc, t) => acc + t.amount, 0);
  const cashExpense = monthTransactions
    .filter((t) => t.type === '지출' && t.paymentMethod === '현금')
    .reduce((acc, t) => acc + t.amount, 0);
  const cashBalance = cashIncome - cashExpense;

  // 월별 수입 총액 (참고)
  const totalIncome = monthTransactions.filter((t) => t.type === '수입').reduce((acc, t) => acc + t.amount, 0);

  // 지출: 결제수단별 (현금 / 신용카드 / 기타) — 별도 표시
  const expenseByMethod = monthTransactions
    .filter((t) => t.type === '지출')
    .reduce((acc, t) => {
      const m = t.paymentMethod || '기타';
      acc[m] = (acc[m] || 0) + t.amount;
      return acc;
    }, {});

  // 지출: 카테고리별
  const expenseByCategory = monthTransactions
    .filter((t) => t.type === '지출')
    .reduce((acc, t) => {
      const c = t.category || '기타';
      acc[c] = (acc[c] || 0) + t.amount;
      return acc;
    }, {});
  const categoryEntries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

  const totalExpense = monthTransactions.filter((t) => t.type === '지출').reduce((acc, t) => acc + t.amount, 0);
  const monthList = sortTransactions(monthTransactions);

  // 로그인 화면 (미로그인 시에만)
  if (!isNameSet) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl p-10 w-full max-w-sm shadow-sm border border-slate-200/80">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-8 mx-auto">
            <Wallet className="text-slate-500" size={28} />
          </div>
          <h1 className="text-xl font-semibold text-center text-slate-800 mb-8">우리 가계부</h1>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">ID</label>
              <input
                type="text"
                placeholder="ID 입력"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-colors"
                value={loginId}
                onChange={(e) => { setLoginId(e.target.value); setLoginError(''); }}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-colors"
                value={loginPassword}
                onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                required
              />
            </div>
            {loginError && (
              <p className="text-sm text-rose-500 font-medium">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-slate-800 text-white py-3.5 rounded-xl font-medium hover:bg-slate-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              로그인 <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 설정 패널 (로그인된 상태에서 설정 클릭 시): 로그아웃만
  if (showSettings) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl p-10 w-full max-w-sm shadow-sm border border-slate-200/80">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <Settings className="text-slate-500" size={28} />
          </div>
          <h2 className="text-lg font-semibold text-center text-slate-800 mb-1">설정</h2>
          <p className="text-slate-400 text-center text-sm mb-8">{userName}으로 로그인됨</p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-slate-800 text-white py-3.5 rounded-xl font-medium hover:bg-slate-700 active:scale-[0.99] transition-all"
            >
              로그아웃
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="w-full text-slate-400 py-3 text-sm font-medium hover:text-slate-600"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-40">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-800 rounded-2xl flex items-center justify-center">
              <Wallet className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">우리 가계부</h1>
              <p className="text-xs text-slate-400 mt-0.5">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {useSupabase && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="실시간 동기화" />
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="설정"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 pt-6 pb-8 space-y-6">
        {/* 월 선택 */}
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => {
              const [y, m] = selectedMonth.split('-').map(Number);
              const prev = m === 1 ? [y - 1, 12] : [y, m - 1];
              setSelectedMonth(`${prev[0]}-${String(prev[1]).padStart(2, '0')}`);
            }}
            className="p-2 rounded-xl text-slate-500 hover:bg-white hover:text-slate-700 border border-slate-200/80 transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-semibold text-slate-800 min-w-[120px] text-center">
            {getMonthLabel(selectedMonth)}
          </span>
          <button
            type="button"
            onClick={() => {
              const [y, m] = selectedMonth.split('-').map(Number);
              const next = m === 12 ? [y + 1, 1] : [y, m + 1];
              setSelectedMonth(`${next[0]}-${String(next[1]).padStart(2, '0')}`);
            }}
            className="p-2 rounded-xl text-slate-500 hover:bg-white hover:text-slate-700 border border-slate-200/80 transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 현금 잔액 (현금만 기준, 월별) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <p className="text-xs text-slate-400 font-medium mb-1">현금 잔액 (이번 달)</p>
          <p className={`text-3xl font-bold tracking-tight ${cashBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
            {cashBalance.toLocaleString()}
            <span className="text-base font-medium text-slate-500 ml-1">원</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">현금 수입 − 현금 지출만 반영</p>
          <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mb-0.5">
                <Banknote size={12} /> 현금 수입
              </p>
              <p className="text-lg font-semibold text-slate-800">{cashIncome.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mb-0.5">
                <Banknote size={12} /> 현금 지출
              </p>
              <p className="text-lg font-semibold text-slate-600">{cashExpense.toLocaleString()}원</p>
            </div>
          </div>
          {totalIncome > 0 && (
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-50">
              이번 달 총 수입(전체) {totalIncome.toLocaleString()}원
            </p>
          )}
        </div>

        {/* 지출: 결제수단별 (현금 / 신용카드 / 기타) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-slate-500" /> 결제수단별 지출
          </h3>
          <div className="space-y-3">
            {['현금', '신용카드', '기타'].map((method) => {
              const amt = expenseByMethod[method] || 0;
              return (
                <div key={method} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    {getMethodIcon(method)} {method}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{amt.toLocaleString()}원</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-500">총 지출</span>
            <span className="text-base font-bold text-slate-800 tabular-nums">{totalExpense.toLocaleString()}원</span>
          </div>
        </div>

        {/* 카테고리별 지출 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-slate-500" /> 카테고리별 지출
          </h3>
          {categoryEntries.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">이번 달 지출 내역이 없어요.</p>
          ) : (
            <>
              <div className="space-y-3">
                {categoryEntries.map(([cat, amt]) => {
                  const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-700 truncate">{cat}</span>
                          <span className="text-sm font-semibold text-slate-800 tabular-nums shrink-0">
                            {amt.toLocaleString()}원
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-300 rounded-full transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">합계</span>
                <span className="text-base font-bold text-slate-800 tabular-nums">{totalExpense.toLocaleString()}원</span>
              </div>
            </>
          )}
        </div>

        {/* 입력 폼 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${type === '지출' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => { setType('지출'); setCategory('식비'); }}
              >
                지출
              </button>
              <button
                type="button"
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${type === '수입' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => { setType('수입'); setCategory('월급'); }}
              >
                수입
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">날짜</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-slate-300 focus:bg-white outline-none transition-colors"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">카테고리</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-slate-300 focus:bg-white outline-none appearance-none cursor-pointer"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories[type].map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">금액</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-slate-300 focus:bg-white outline-none transition-colors"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">결제수단</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-slate-300 focus:bg-white outline-none appearance-none cursor-pointer"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">사용처 (상세)</label>
              <div className="relative">
                <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <input
                  type="text"
                  placeholder="예: 스타벅스, 마트"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-slate-300 focus:bg-white outline-none transition-colors"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-800 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-700 active:scale-[0.99] transition-all"
            >
              <PlusCircle size={18} /> 새 내역 저장
            </button>
          </form>
        </div>

        {/* 해당 월 기록 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">{getMonthLabel(selectedMonth)} 기록</h2>
            <span className="text-xs text-slate-400 font-medium">{monthList.length}건</span>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400 font-medium">불러오는 중...</p>
            </div>
          ) : monthList.length === 0 ? (
            <div className="py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Tag size={22} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-400 font-medium">이번 달 기록이 없어요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {monthList.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl p-5 flex items-center justify-between border border-slate-200/80 shadow-sm hover:border-slate-200 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${t.type === '지출' ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {t.type === '지출' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs text-slate-500 font-medium">{t.writer}</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={12} /> {t.date}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          {getMethodIcon(t.paymentMethod)} {t.paymentMethod}
                        </span>
                      </div>
                      <p className="font-medium text-slate-800 truncate text-sm">{t.place || t.category}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <p className={`font-semibold text-sm tabular-nums ${t.type === '지출' ? 'text-slate-800' : 'text-slate-600'}`}>
                      {t.type === '지출' ? '-' : '+'}{t.amount.toLocaleString()}
                    </p>
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 하단: 백업 / 가져오기 */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-6 py-4 bg-white/95 backdrop-blur border-t border-slate-200 z-40">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <Download size={18} /> 백업
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors cursor-pointer">
            <Upload size={18} /> 가져오기
            <input type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
          </label>
        </div>
        {useSupabase && (
          <p className="text-xs text-slate-400 text-center mt-2">실시간 동기화 중</p>
        )}
      </div>
    </div>
  );
}
