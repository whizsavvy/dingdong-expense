import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  Trash2,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Share2,
  Calendar,
  Settings,
  CreditCard,
  Banknote,
  Smartphone,
  MapPin,
  Tag,
  ChevronRight,
  Download,
  Upload,
} from 'lucide-react';
import { supabase } from './supabase';

const STORAGE_KEY = 'ledger_data';
const defaultAppId = 'ding-dong-ledger-shared';

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

export default function App() {
  const [userName, setUserName] = useState(() => localStorage.getItem('ledger_user_name') || '');
  const [isNameSet, setIsNameSet] = useState(() => !!localStorage.getItem('ledger_user_name'));
  const [appId, setAppId] = useState(() => localStorage.getItem('ledger_app_id') || defaultAppId);
  const [tempAppId, setTempAppId] = useState(() => localStorage.getItem('ledger_app_id') || defaultAppId);
  const [showSettings, setShowSettings] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [useSupabase, setUseSupabase] = useState(!!supabase);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('식비');
  const [type, setType] = useState('지출');
  const [place, setPlace] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('현금');

  const categories = {
    지출: ['식비', '간식', '교통비', '쇼핑', '생활비', '정기결제', '병원', '미용', '게임', '문화', '주유', '딩비', '저축', '카드비', '기타'],
    수입: ['수입', '이자', '부수입', '용돈', '기타'],
  };

  const paymentMethods = ['현금', '신용카드', '카카오페이', '체크카드', '기타'];

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

  const handleSaveSettings = (e) => {
    e.preventDefault();
    if (userName.trim() && tempAppId.trim()) {
      localStorage.setItem('ledger_user_name', userName.trim());
      localStorage.setItem('ledger_app_id', tempAppId.trim());
      setAppId(tempAppId.trim());
      setIsNameSet(true);
      setShowSettings(false);
    }
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
      case '카카오페이':
        return <Smartphone size={14} />;
      case '신용카드':
      case '체크카드':
        return <CreditCard size={14} />;
      default:
        return <Tag size={14} />;
    }
  };

  const totalIncome = transactions.filter((t) => t.type === '수입').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === '지출').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  if (!isNameSet || showSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <Settings className="text-indigo-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">가계부 설정</h2>
          <p className="text-slate-400 text-center text-sm mb-8 leading-relaxed">
            와이프와 <strong className="text-indigo-600 font-bold">같은 가계부 ID</strong>를 쓰면
            <br />
            실시간으로 내역이 동기화돼요. (Supabase 설정 시)
          </p>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">본인 이름</label>
              <input
                type="text"
                placeholder="예: 나, 동이"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-medium transition-all"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">가계부 공유 ID</label>
              <input
                type="text"
                placeholder="우리만의 비밀 ID"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm transition-all"
                value={tempAppId}
                onChange={(e) => setTempAppId(e.target.value)}
                required
              />
            </div>
            <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all mt-4 flex items-center justify-center gap-2">
              저장하고 시작하기 <ChevronRight size={18} />
            </button>
            {isNameSet && (
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="w-full text-slate-400 py-2 text-sm font-semibold hover:text-slate-600"
              >
                닫기
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-36">
      <header className="bg-white/80 backdrop-blur-lg border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-md mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <Wallet className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-base font-black leading-tight tracking-tight">우리 가계부</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold text-white bg-indigo-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">ID</span>
                <span className="text-[10px] text-slate-400 font-bold truncate max-w-[120px]">{appId}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-full transition-all"
            >
              <Settings size={20} />
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100/80 px-4 py-2 rounded-full border border-slate-200">
              {useSupabase ? (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="실시간 동기화 중" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500" title="로컬 저장만 (Supabase 설정 시 동기화)" />
              )}
              {userName}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 mt-6 space-y-6">
        <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
          <p className="text-indigo-100 text-sm font-bold mb-1 opacity-80">현재 총 잔액</p>
          <h2 className="text-4xl font-black mb-8 tracking-tighter">
            {balance.toLocaleString()}
            <span className="text-xl ml-1 font-bold opacity-60">원</span>
          </h2>
          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/20">
            <div className="space-y-1">
              <p className="text-[10px] text-indigo-200 flex items-center gap-1 font-black uppercase tracking-widest">
                <ArrowUpCircle size={10} /> 수입
              </p>
              <p className="text-lg font-black">{totalIncome.toLocaleString()}원</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-indigo-200 flex items-center gap-1 font-black uppercase tracking-widest">
                <ArrowDownCircle size={10} /> 지출
              </p>
              <p className="text-lg font-black text-rose-200">{totalExpense.toLocaleString()}원</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.2rem] p-6 shadow-sm border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl">
              <button
                type="button"
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${type === '지출' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                onClick={() => {
                  setType('지출');
                  setCategory('식비');
                }}
              >
                지출
              </button>
              <button
                type="button"
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${type === '수입' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                onClick={() => {
                  setType('수입');
                  setCategory('수입');
                }}
              >
                수입
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">날짜</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-3 text-sm font-bold focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">카테고리</label>
                <select
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-3 text-sm font-bold focus:border-indigo-500 focus:bg-white outline-none appearance-none cursor-pointer"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories[type].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">금액</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-3 text-sm font-black focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">결제수단</label>
                <select
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-3 text-sm font-bold focus:border-indigo-500 focus:bg-white outline-none appearance-none cursor-pointer"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">사용처 (상세 내역)</label>
              <div className="relative group">
                <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="예: 스타벅스, 마트"
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 pl-12 text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.97] transition-all shadow-xl shadow-slate-200"
            >
              <PlusCircle size={20} /> 새 내역 저장하기
            </button>
          </form>
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-slate-800 tracking-tight">최근 기록</h3>
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">{transactions.length}건</span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-bounce text-indigo-600 font-black text-xs uppercase tracking-widest">불러오는 중...</div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-20 bg-white rounded-[2.5rem] text-center border-2 border-dashed border-slate-100 flex flex-col items-center">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <Tag size={24} className="text-slate-200" />
              </div>
              <p className="text-slate-400 text-sm font-bold">아직 기록된 내역이 없네요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="bg-white p-5 rounded-[2rem] flex items-center justify-between shadow-sm border border-slate-100 group hover:border-indigo-100 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${t.type === '지출' ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}
                    >
                      {t.type === '지출' ? <ArrowDownCircle size={22} /> : <ArrowUpCircle size={22} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 overflow-x-auto no-scrollbar">
                        <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded whitespace-nowrap">{t.writer}</span>
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 whitespace-nowrap">
                          <Calendar size={10} /> {t.date}
                        </span>
                        <span className="text-[9px] font-bold text-indigo-400 flex items-center gap-1 whitespace-nowrap uppercase">
                          {getMethodIcon(t.paymentMethod)} {t.paymentMethod}
                        </span>
                      </div>
                      <p className="font-black text-slate-800 leading-tight truncate text-sm">{t.place || t.category}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">{t.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <p className={`font-black text-base ${t.type === '지출' ? 'text-slate-800' : 'text-indigo-600'}`}>
                      {t.type === '지출' ? '-' : '+'}
                      {t.amount.toLocaleString()}
                    </p>
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
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

      {/* 실시간 동기화 안내 / 백업용 내보내기·가져오기 */}
      <div className="fixed bottom-6 left-0 right-0 max-w-md mx-auto px-6 z-40">
        <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-[1.8rem] p-4 shadow-2xl border border-white/10 ring-1 ring-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-indigo-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Share2 size={18} />
            </div>
            <div>
              <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest leading-none mb-1">
                {useSupabase ? '실시간 동기화' : 'Supabase 설정하면 실시간 동기화'}
              </p>
              <p className="text-[11px] text-slate-200 font-bold tracking-tight">
                {useSupabase
                  ? '같은 가계부 ID 쓰면 와이프와 자동 동기화!'
                  : '.env에 URL·키 넣으면 JSON 안 보내도 돼요'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-bold transition-all"
            >
              <Download size={18} /> 백업
            </button>
            <label className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-bold cursor-pointer transition-all">
              <Upload size={18} /> 가져오기
              <input type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
