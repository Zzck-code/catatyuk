import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

// ── Firebase config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBWaRRM4Ivu4GsrGoqKNplvOMlpgowbzS4",
  authDomain: "catatyuk-1b72d.firebaseapp.com",
  projectId: "catatyuk-1b72d",
  storageBucket: "catatyuk-1b72d.firebasestorage.app",
  messagingSenderId: "447899693482",
  appId: "1:447899693482:web:ee35e7cee6a396e73cbbd3",
  measurementId: "G-TSL4RC6DPG",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Constants ────────────────────────────────────────────────
const CATEGORIES = [
  { id: "food",          label: "Makan & Minum",  icon: "🍜", color: "#FF6B6B" },
  { id: "transport",     label: "Transportasi",   icon: "🚗", color: "#4ECDC4" },
  { id: "shopping",      label: "Belanja",         icon: "🛍️", color: "#FFE66D" },
  { id: "health",        label: "Kesehatan",       icon: "💊", color: "#A8E6CF" },
  { id: "entertainment", label: "Hiburan",         icon: "🎮", color: "#FF8B94" },
  { id: "bills",         label: "Tagihan",         icon: "📄", color: "#C3A6FF" },
  { id: "education",     label: "Pendidikan",      icon: "📚", color: "#5BA4CF" },
  { id: "other",         label: "Lainnya",         icon: "📦", color: "#B0BEC5" },
];

const ACCOUNTS = [
  { id: "cash",   label: "Tunai",         icon: "💵" },
  { id: "bank",   label: "Rekening Bank", icon: "🏦" },
  { id: "ewallet",label: "E-Wallet",      icon: "📱" },
  { id: "credit", label: "Kartu Kredit",  icon: "💳" },
];

const USERS = [
  { id: "user1", color: "#FF6B6B", avatar: "👤" },
  { id: "user2", color: "#4ECDC4", avatar: "👥" },
];

const fmtRp   = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

// ── App ──────────────────────────────────────────────────────
export default function App() {
  const [activeUser,   setActiveUser]   = useState("user1");
  const [view,         setView]         = useState("dashboard");
  const [transactions, setTransactions] = useState({ user1: [], user2: [] });
  const [userNames,    setUserNames]    = useState({ user1: "Pengguna 1", user2: "Pengguna 2" });
  const [form,         setForm]         = useState({ amount: "", category: "food", account: "cash", note: "", date: new Date().toISOString().split("T")[0], type: "expense" });
  const [filterCat,    setFilterCat]    = useState("all");
  const [toast,        setToast]        = useState(null);
  const [editingName,  setEditingName]  = useState(null);
  const [tempName,     setTempName]     = useState("");
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);

  // ── Realtime listener ──
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "catatyuk", "shared"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setTransactions({ user1: d.user1 || [], user2: d.user2 || [] });
        setUserNames({ user1: d.name1 || "Pengguna 1", user2: d.name2 || "Pengguna 2" });
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Add transaction ──
  const addTransaction = async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      showToast("Masukkan nominal yang valid!", "error"); return;
    }
    const newTx = {
      id: Date.now().toString(),
      amount: Number(form.amount),
      category: form.category,
      account: form.account,
      note: form.note,
      date: form.date,
      type: form.type,
      userId: activeUser,
      createdAt: new Date().toISOString(),
    };
    setSyncing(true);
    try {
      const ref = doc(db, "catatyuk", "shared");
      const field = activeUser === "user1" ? "user1" : "user2";
      await setDoc(ref, { [field]: arrayUnion(newTx) }, { merge: true });
      setForm({ amount: "", category: "food", account: "cash", note: "", date: new Date().toISOString().split("T")[0], type: "expense" });
      showToast("Transaksi berhasil ditambahkan! ✓");
      setView("dashboard");
    } catch (e) {
      showToast("Gagal menyimpan, cek koneksi!", "error");
    }
    setSyncing(false);
  };

  // ── Delete transaction ──
  const deleteTransaction = async (userId, txId) => {
    const tx = transactions[userId].find(t => t.id === txId);
    if (!tx) return;
    setSyncing(true);
    try {
      const ref = doc(db, "catatyuk", "shared");
      const field = userId === "user1" ? "user1" : "user2";
      await updateDoc(ref, { [field]: arrayRemove(tx) });
      showToast("Transaksi dihapus");
    } catch (e) {
      showToast("Gagal menghapus!", "error");
    }
    setSyncing(false);
  };

  // ── Save name ──
  const saveName = async (userId) => {
    const newName = tempName.trim() || userNames[userId];
    setSyncing(true);
    try {
      const field = userId === "user1" ? "name1" : "name2";
      await setDoc(doc(db, "catatyuk", "shared"), { [field]: newName }, { merge: true });
    } catch (e) {}
    setEditingName(null);
    setSyncing(false);
  };

  // ── Stats ──
  const getStats = (uid) => {
    const txs  = transactions[uid] || [];
    const now  = new Date();
    const thisMonth = txs.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalExpense  = thisMonth.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const totalIncome   = thisMonth.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const byCategory    = {};
    thisMonth.filter(t => t.type === "expense").forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    return { totalExpense, totalIncome, byCategory, thisMonth };
  };

  const currentUser = USERS.find(u => u.id === activeUser);
  const otherUser   = USERS.find(u => u.id !== activeUser);
  const stats       = getStats(activeUser);
  const otherStats  = getStats(otherUser.id);
  const filteredTxs = (transactions[activeUser] || [])
    .filter(t => filterCat === "all" || t.category === filterCat)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // ── Loading screen ──
  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12,
        height:"100vh", background:"#0F0F1A", color:"#fff", fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ fontSize:40 }}>💰</div>
        <div style={{ fontWeight:800, fontSize:20 }}>CatatYuk</div>
        <div style={{ color:"#666", fontSize:13 }}>Menghubungkan ke database...</div>
      </div>
    );
  }

  // ── UI ──
  const s = { fontFamily:"'DM Sans','Segoe UI',sans-serif", background:"#0F0F1A", minHeight:"100vh",
    color:"#fff", maxWidth:480, margin:"0 auto", position:"relative", paddingBottom:80 };

  return (
    <div style={s}>
      {/* Sync indicator */}
      {syncing && (
        <div style={{ position:"fixed", top:0, left:0, right:0, height:3,
          background:`linear-gradient(90deg,${currentUser.color},transparent)`,
          animation:"pulse 1s infinite", zIndex:9999 }} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="error" ? "#FF4757" : "#2ED573",
          color:"#fff", padding:"10px 20px", borderRadius:30, fontWeight:600,
          fontSize:13, zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,.3)",
          animation:"fadeIn .2s ease", whiteSpace:"nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding:"20px 20px 0", position:"sticky", top:0, background:"#0F0F1A", zIndex:100 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, color:"#666", letterSpacing:2, textTransform:"uppercase" }}>Dompet Bersama</div>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:-.5 }}>💰 CatatYuk</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {USERS.map(u => (
              <button key={u.id} onClick={() => setActiveUser(u.id)} style={{
                padding:"6px 14px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
                background: activeUser===u.id ? u.color : "#1E1E2E",
                color: activeUser===u.id ? "#fff" : "#666", transition:"all .2s" }}>
                {userNames[u.id]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:4, background:"#1A1A2E", borderRadius:12, padding:4 }}>
          {[["dashboard","📊 Ringkasan"],["add","➕ Catat"],["history","📋 Riwayat"],["shared","🔗 Bersama"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={{
              flex:1, padding:"8px 4px", borderRadius:8, border:"none", cursor:"pointer",
              background: view===v ? currentUser.color : "transparent",
              color: view===v ? "#fff" : "#666", fontSize:11, fontWeight:700, transition:"all .2s" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"16px 20px" }}>

        {/* ═══ DASHBOARD ═══ */}
        {view==="dashboard" && (
          <div>
            {/* Name edit */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:20, background:currentUser.color,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                {currentUser.avatar}
              </div>
              {editingName===activeUser ? (
                <div style={{ display:"flex", gap:6, flex:1 }}>
                  <input value={tempName} onChange={e => setTempName(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && saveName(activeUser)} autoFocus
                    style={{ flex:1, background:"#1E1E2E", border:`1px solid ${currentUser.color}`,
                      borderRadius:8, padding:"4px 10px", color:"#fff", fontSize:14 }} />
                  <button onClick={() => saveName(activeUser)} style={{
                    background:currentUser.color, border:"none", borderRadius:8,
                    padding:"4px 12px", color:"#fff", cursor:"pointer", fontWeight:700 }}>✓</button>
                </div>
              ) : (
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:16 }}>{userNames[activeUser]}</div>
                  <button onClick={() => { setEditingName(activeUser); setTempName(userNames[activeUser]); }}
                    style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:11, padding:0 }}>
                    ✏️ Edit nama
                  </button>
                </div>
              )}
            </div>

            {/* Balance cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div style={{ background:"linear-gradient(135deg,#FF6B6B,#FF8E53)", borderRadius:16, padding:16 }}>
                <div style={{ fontSize:11, opacity:.8, marginBottom:4 }}>Pengeluaran Bulan Ini</div>
                <div style={{ fontSize:17, fontWeight:800 }}>{fmtRp(stats.totalExpense)}</div>
              </div>
              <div style={{ background:"linear-gradient(135deg,#2ED573,#1ABC9C)", borderRadius:16, padding:16 }}>
                <div style={{ fontSize:11, opacity:.8, marginBottom:4 }}>Pemasukan Bulan Ini</div>
                <div style={{ fontSize:17, fontWeight:800 }}>{fmtRp(stats.totalIncome)}</div>
              </div>
            </div>
            <div style={{ background:"#1E1E2E", borderRadius:16, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Saldo Bulan Ini</div>
              <div style={{ fontSize:28, fontWeight:800, color: stats.totalIncome-stats.totalExpense>=0 ? "#2ED573" : "#FF6B6B" }}>
                {fmtRp(stats.totalIncome - stats.totalExpense)}
              </div>
            </div>

            {/* Category breakdown */}
            <div style={{ background:"#1E1E2E", borderRadius:16, padding:16, marginBottom:16 }}>
              <div style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>Pengeluaran per Kategori</div>
              {Object.keys(stats.byCategory).length===0 ? (
                <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"20px 0" }}>Belum ada data bulan ini</div>
              ) : Object.entries(stats.byCategory).sort((a,b)=>b[1]-a[1]).map(([catId,amt]) => {
                const cat = CATEGORIES.find(c=>c.id===catId);
                const pct = stats.totalExpense>0 ? (amt/stats.totalExpense)*100 : 0;
                return (
                  <div key={catId} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
                      <span>{cat?.icon} {cat?.label}</span>
                      <span style={{ fontWeight:700 }}>{fmtRp(amt)}</span>
                    </div>
                    <div style={{ height:6, background:"#2A2A3E", borderRadius:3 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:cat?.color, borderRadius:3, transition:"width .5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent */}
            <div style={{ fontWeight:700, marginBottom:10, fontSize:14 }}>Transaksi Terbaru</div>
            {(transactions[activeUser]||[]).slice(0,5).map(tx => {
              const cat = CATEGORIES.find(c=>c.id===tx.category);
              const acc = ACCOUNTS.find(a=>a.id===tx.account);
              return (
                <div key={tx.id} style={{ background:"#1E1E2E", borderRadius:12, padding:12, marginBottom:8,
                  display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:`${cat?.color}22`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{cat?.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{cat?.label}</div>
                    <div style={{ fontSize:11, color:"#666" }}>{acc?.icon} {acc?.label} · {fmtDate(tx.date)}</div>
                    {tx.note && <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{tx.note}</div>}
                  </div>
                  <div style={{ fontWeight:800, color:tx.type==="income"?"#2ED573":"#FF6B6B", fontSize:14 }}>
                    {tx.type==="income" ? "+" : "-"}{fmtRp(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ ADD ═══ */}
        {view==="add" && (
          <div>
            <div style={{ fontWeight:800, fontSize:20, marginBottom:20 }}>Catat Transaksi</div>
            <div style={{ display:"flex", background:"#1A1A2E", borderRadius:12, padding:4, marginBottom:16 }}>
              {[["expense","💸 Pengeluaran"],["income","💰 Pemasukan"]].map(([t,l]) => (
                <button key={t} onClick={() => setForm({...form, type:t})} style={{
                  flex:1, padding:10, borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13,
                  background: form.type===t ? (t==="expense"?"#FF6B6B":"#2ED573") : "transparent",
                  color: form.type===t ? "#fff" : "#666", transition:"all .2s" }}>{l}</button>
              ))}
            </div>

            <div style={{ background:"#1E1E2E", borderRadius:16, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>NOMINAL</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:"#666", fontSize:18 }}>Rp</span>
                <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}
                  placeholder="0" style={{ flex:1, background:"none", border:"none", outline:"none",
                    fontSize:28, fontWeight:800, color:"#fff" }} />
              </div>
            </div>

            <div style={{ background:"#1E1E2E", borderRadius:16, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#666", marginBottom:10 }}>KATEGORI</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setForm({...form,category:cat.id})} style={{
                    padding:"10px 6px", borderRadius:12,
                    border:`2px solid ${form.category===cat.id ? cat.color : "transparent"}`,
                    background: form.category===cat.id ? `${cat.color}22` : "#2A2A3E",
                    cursor:"pointer", textAlign:"center", transition:"all .15s" }}>
                    <div style={{ fontSize:20 }}>{cat.icon}</div>
                    <div style={{ fontSize:9, color:form.category===cat.id?cat.color:"#666", marginTop:2, fontWeight:600 }}>
                      {cat.label.split(" ")[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background:"#1E1E2E", borderRadius:16, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#666", marginBottom:10 }}>AKUN</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {ACCOUNTS.map(acc => (
                  <button key={acc.id} onClick={() => setForm({...form,account:acc.id})} style={{
                    padding:12, borderRadius:12,
                    border:`2px solid ${form.account===acc.id ? currentUser.color : "transparent"}`,
                    background: form.account===acc.id ? `${currentUser.color}22` : "#2A2A3E",
                    cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:8, transition:"all .15s" }}>
                    <span style={{ fontSize:18 }}>{acc.icon}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:form.account===acc.id?currentUser.color:"#aaa" }}>{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background:"#1E1E2E", borderRadius:16, padding:16, marginBottom:16 }}>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>TANGGAL</div>
                <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}
                  style={{ background:"#2A2A3E", border:"none", borderRadius:8, padding:"8px 12px",
                    color:"#fff", fontSize:14, width:"100%", boxSizing:"border-box" }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>CATATAN (opsional)</div>
                <input type="text" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}
                  placeholder="Tambahkan catatan..."
                  style={{ background:"#2A2A3E", border:"none", borderRadius:8, padding:"8px 12px",
                    color:"#fff", fontSize:14, width:"100%", boxSizing:"border-box" }} />
              </div>
            </div>

            <button onClick={addTransaction} disabled={syncing} style={{
              width:"100%", padding:16, borderRadius:16, border:"none", cursor:"pointer",
              background:`linear-gradient(135deg,${currentUser.color},${currentUser.color}99)`,
              color:"#fff", fontSize:16, fontWeight:800, opacity:syncing?.7:1 }}>
              {syncing ? "Menyimpan..." : "Simpan Transaksi ✓"}
            </button>
          </div>
        )}

        {/* ═══ HISTORY ═══ */}
        {view==="history" && (
          <div>
            <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>Riwayat Transaksi</div>
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:16 }}>
              <button onClick={() => setFilterCat("all")} style={{
                padding:"6px 14px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:700, whiteSpace:"nowrap",
                background:filterCat==="all"?currentUser.color:"#1E1E2E", color:filterCat==="all"?"#fff":"#666" }}>Semua</button>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id)} style={{
                  padding:"6px 12px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:700, whiteSpace:"nowrap",
                  background:filterCat===cat.id?cat.color:"#1E1E2E", color:filterCat===cat.id?"#fff":"#666" }}>
                  {cat.icon} {cat.label.split(" ")[0]}
                </button>
              ))}
            </div>
            {filteredTxs.length===0 ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:"#444" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
                <div>Belum ada transaksi</div>
              </div>
            ) : filteredTxs.map(tx => {
              const cat = CATEGORIES.find(c=>c.id===tx.category);
              const acc = ACCOUNTS.find(a=>a.id===tx.account);
              return (
                <div key={tx.id} style={{ background:"#1E1E2E", borderRadius:12, padding:12, marginBottom:8,
                  display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:`${cat?.color}22`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{cat?.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{cat?.label}</div>
                    <div style={{ fontSize:11, color:"#666" }}>{acc?.icon} {acc?.label} · {fmtDate(tx.date)}</div>
                    {tx.note && <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{tx.note}</div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:800, color:tx.type==="income"?"#2ED573":"#FF6B6B", fontSize:14 }}>
                      {tx.type==="income"?"+":"-"}{fmtRp(tx.amount)}
                    </div>
                    <button onClick={() => deleteTransaction(activeUser, tx.id)} style={{
                      background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:11, padding:0, marginTop:4 }}>
                      🗑️ hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ SHARED ═══ */}
        {view==="shared" && (
          <div>
            <div style={{ fontWeight:800, fontSize:20, marginBottom:4 }}>Ringkasan Bersama</div>
            <div style={{ color:"#666", fontSize:13, marginBottom:20 }}>Bulan ini · data realtime 🔴</div>

            <div style={{ background:"linear-gradient(135deg,#1E1E2E,#2A2A3E)", borderRadius:16, padding:20,
              marginBottom:16, border:"1px solid #333" }}>
              <div style={{ fontSize:12, color:"#888", marginBottom:8 }}>Total Pengeluaran Bersama</div>
              <div style={{ fontSize:32, fontWeight:900, color:"#FF6B6B" }}>
                {fmtRp(stats.totalExpense + otherStats.totalExpense)}
              </div>
              <div style={{ fontSize:12, color:"#666", marginTop:4 }}>
                Pemasukan: {fmtRp(stats.totalIncome + otherStats.totalIncome)}
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              {USERS.map(u => {
                const s2 = getStats(u.id);
                return (
                  <div key={u.id} style={{ background:"#1E1E2E", borderRadius:16, padding:14, borderTop:`3px solid ${u.color}` }}>
                    <div style={{ fontSize:12, fontWeight:700, color:u.color, marginBottom:8 }}>{userNames[u.id]}</div>
                    <div style={{ marginBottom:6 }}>
                      <div style={{ fontSize:10, color:"#666" }}>Pengeluaran</div>
                      <div style={{ fontSize:15, fontWeight:800, color:"#FF6B6B" }}>{fmtRp(s2.totalExpense)}</div>
                    </div>
                    <div style={{ marginBottom:6 }}>
                      <div style={{ fontSize:10, color:"#666" }}>Pemasukan</div>
                      <div style={{ fontSize:15, fontWeight:800, color:"#2ED573" }}>{fmtRp(s2.totalIncome)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:"#666" }}>Saldo</div>
                      <div style={{ fontSize:15, fontWeight:800, color:s2.totalIncome-s2.totalExpense>=0?"#2ED573":"#FF6B6B" }}>
                        {fmtRp(s2.totalIncome - s2.totalExpense)}
                      </div>
                    </div>
                    <div style={{ marginTop:8, fontSize:10, color:"#666" }}>{s2.thisMonth.length} transaksi</div>
                  </div>
                );
              })}
            </div>

            <div style={{ background:"#1E1E2E", borderRadius:16, padding:16, marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Perbandingan Kategori</div>
              {CATEGORIES.map(cat => {
                const u1a = stats.byCategory[cat.id] || 0;
                const u2a = otherStats.byCategory[cat.id] || 0;
                if (u1a===0 && u2a===0) return null;
                const tot = u1a + u2a;
                return (
                  <div key={cat.id} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:13 }}>{cat.icon} {cat.label}</span>
                      <span style={{ fontSize:11, color:"#666" }}>{fmtRp(tot)}</span>
                    </div>
                    <div style={{ height:8, background:"#2A2A3E", borderRadius:4, overflow:"hidden", display:"flex" }}>
                      {u1a>0 && <div style={{ height:"100%", width:`${(u1a/tot)*100}%`, background:USERS[0].color, transition:"width .5s" }} />}
                      {u2a>0 && <div style={{ height:"100%", width:`${(u2a/tot)*100}%`, background:USERS[1].color, transition:"width .5s" }} />}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                      <span style={{ fontSize:10, color:USERS[0].color }}>{userNames["user1"]}: {fmtRp(u1a)}</span>
                      <span style={{ fontSize:10, color:USERS[1].color }}>{userNames["user2"]}: {fmtRp(u2a)}</span>
                    </div>
                  </div>
                );
              })}
              {Object.keys(stats.byCategory).length===0 && Object.keys(otherStats.byCategory).length===0 && (
                <div style={{ color:"#444", textAlign:"center", padding:"20px 0", fontSize:13 }}>Belum ada data bulan ini</div>
              )}
            </div>

            <div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Semua Transaksi Bulan Ini</div>
            {[...stats.thisMonth, ...otherStats.thisMonth]
              .sort((a,b)=>new Date(b.date)-new Date(a.date))
              .map(tx => {
                const cat  = CATEGORIES.find(c=>c.id===tx.category);
                const user = USERS.find(u=>u.id===tx.userId);
                return (
                  <div key={tx.id} style={{ background:"#1E1E2E", borderRadius:12, padding:12, marginBottom:8,
                    display:"flex", alignItems:"center", gap:12, borderLeft:`3px solid ${user?.color}` }}>
                    <div style={{ fontSize:20 }}>{cat?.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{cat?.label}</div>
                      <div style={{ fontSize:11, color:"#666" }}>{userNames[tx.userId]} · {fmtDate(tx.date)}</div>
                      {tx.note && <div style={{ fontSize:11, color:"#888" }}>{tx.note}</div>}
                    </div>
                    <div style={{ fontWeight:800, color:tx.type==="income"?"#2ED573":"#FF6B6B", fontSize:14 }}>
                      {tx.type==="income"?"+":"-"}{fmtRp(tx.amount)}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateX(-50%) translateY(-8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(1);opacity:.5; }
        ::-webkit-scrollbar { display:none; }
        * { -webkit-tap-highlight-color:transparent; }
      `}</style>
    </div>
  );
}
