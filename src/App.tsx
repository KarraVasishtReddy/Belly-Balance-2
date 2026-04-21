/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  History, 
  TrendingUp, 
  Plus, 
  Info, 
  X, 
  Zap, 
  Trophy,
  Activity,
  Hand,
  CircleDot,
  Pointer,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { ANTIOXIDANT_DATA } from './data/antioxidants';
import { FoodItem, LogEntry, PortionType, PORTION_MULTIPLIERS, BADGES, Badge } from './types';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { Logo } from './components/Logo';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';

const DAILY_GOAL = 50; // Daily Belly Balance points goal

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'journal' | 'milestones'>('journal');

  // Badge Logic
  const earnedBadges = useMemo(() => {
    const earned: string[] = [];
    if (logs.length >= 1) earned.push('first-step');
    if (logs.length >= 100) earned.push('centurion');

    // Daily High Score
    const dayScores: Record<string, number> = {};
    logs.forEach(log => {
      const date = new Date(log.timestamp).toDateString();
      dayScores[date] = (dayScores[date] || 0) + log.score;
    });
    if (Object.values(dayScores).some(score => score >= 100)) earned.push('antioxidant-king');

    // 7-day streak calculation
    const dates = Object.keys(dayScores).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let maxStreak = 0;
    let currentStreak = 0;
    
    // Sort dates properly to check continuity
    const sortedTimestamps = dates.map(d => new Date(d).getTime()).sort((a, b) => b - a);
    
    for (let i = 0; i < sortedTimestamps.length; i++) {
        if (dayScores[new Date(sortedTimestamps[i]).toDateString()] >= DAILY_GOAL) {
            currentStreak++;
            // Check if next day in log exists and if it is exactly one day apart
            if (i < sortedTimestamps.length - 1) {
                const diff = (sortedTimestamps[i] - sortedTimestamps[i+1]) / (1000 * 60 * 60 * 24);
                if (diff !== 1) {
                    maxStreak = Math.max(maxStreak, currentStreak);
                    currentStreak = 0;
                }
            }
        } else {
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 0;
        }
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    if (maxStreak >= 7) earned.push('streak-7');

    return earned;
  }, [logs]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      
      if (u) {
        // Ensure user profile exists for rules compatibility
        const userRef = doc(db, 'users', u.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              createdAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("User sync failed:", err);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) {
      setLogs([]);
      return;
    }

    const logsRef = collection(db, 'users', user.uid, 'logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => doc.data() as LogEntry);
      setLogs(newLogs);
    });

    return unsubscribe;
  }, [user]);

  // Filter food based on search
  const filteredFood = useMemo(() => {
    if (!searchQuery) return [];
    return ANTIOXIDANT_DATA.filter(food => 
      food.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [searchQuery]);

  // Calculate today's score
  const todayScore = useMemo(() => {
    const todayStr = new Date().toDateString();
    return logs
      .filter(log => new Date(log.timestamp).toDateString() === todayStr)
      .reduce((sum, log) => sum + log.score, 0);
  }, [logs]);

  const progress = Math.max(0, Math.min((todayScore / DAILY_GOAL) * 100, 100));

  const addLog = async (food: FoodItem, portion: PortionType) => {
    if (!user) return;
    
    let baseScore = food.antioxidantScore * PORTION_MULTIPLIERS[portion] * 10;
    
    // Penalty for Junk Food
    if (food.category === 'Junk Food') {
      // For junk food, we apply a significant deduction instead of just a low positive score
      // A standard junk food item will deduct between 5-15 points depending on portion
      baseScore = -10 * PORTION_MULTIPLIERS[portion];
    }
    
    const id = Math.random().toString(36).substr(2, 9);
    const newLog: LogEntry = {
      id,
      foodId: food.id,
      portion,
      timestamp: Date.now(),
      score: Math.round(baseScore * 10) / 10,
      userId: user.uid,
    };

    try {
      const logRef = doc(db, 'users', user.uid, 'logs', id);
      await setDoc(logRef, newLog);
      setIsAdding(false);
      setSelectedFood(null);
      setSearchQuery('');
    } catch (error) {
      console.error("Failed to add log:", error);
    }
  };

  const removeLog = async (logId: string) => {
    if (!user) return;
    try {
      const logRef = doc(db, 'users', user.uid, 'logs', logId);
      await deleteDoc(logRef);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const getFoodById = (id: string) => ANTIOXIDANT_DATA.find(f => f.id === id);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg font-sans flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-accent-green flex items-center justify-center shadow-2xl relative z-10">
            <Logo className="w-12 h-12 text-bg" />
          </div>
          <div className="absolute inset-0 bg-accent-green blur-3xl opacity-20 -z-0" />
        </div>
        
        <div className="space-y-4 max-w-sm">
          <h1 className="text-4xl font-display font-medium text-white tracking-tight">BELLY BALANCE 2.0</h1>
          <p className="text-text-dim text-sm leading-relaxed">
            Personalized antioxidant tracking at your fingertips. Log your hand-sized portions and battle oxidative stress.
          </p>
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full max-w-xs h-14 bg-white text-bg rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-white/90 transition-all shadow-xl"
        >
          <LogIn className="w-5 h-5" />
          Continue with Google
        </button>

        <p className="text-[10px] text-text-dim uppercase tracking-[0.2em] font-medium opacity-50">Secure Authentication Powered by Firebase</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans selection:bg-accent-berry/30 pb-20 bg-bg text-text-main shadow-inner">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-green flex items-center justify-center shadow-lg">
              <Logo className="w-5 h-5 text-bg" />
            </div>
            <h1 className="font-display font-medium text-xl tracking-wide uppercase text-accent-green hidden sm:block">Belly Balance 2.0</h1>
            <h1 className="font-display font-medium text-xl tracking-wide uppercase text-accent-green sm:hidden">BELLY BALANCE</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-surface rounded-full transition-colors relative border border-transparent hover:border-border"
            >
              <History className="w-5 h-5 text-text-dim" />
              {logs.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-accent-berry rounded-full animate-pulse" />
              )}
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 hover:bg-surface rounded-full text-text-dim transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 pt-8 space-y-10">
        
        {/* User Greet */}
        <div className="flex items-center gap-4 px-2">
           <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border border-border shadow-sm" alt="Profile" />
           <div>
             <p className="text-xs text-text-dim uppercase tracking-widest font-bold">Welcome back,</p>
             <h2 className="font-display text-lg text-white">{user.displayName}</h2>
           </div>
        </div>
        
        {/* Score Card / Phyto-Ring */}
        <section className="relative flex flex-col items-center py-4">
          <div className="relative w-64 h-64 phyto-ring-inner rounded-full border-8 border-border flex items-center justify-center shadow-[0_0_80px_rgba(0,0,0,0.4)]">
            {/* Circular Progress */}
            <svg 
              className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none" 
              viewBox="0 0 256 256"
            >
              {/* Background Track */}
              <circle
                cx="128"
                cy="128"
                r="116"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-white/5"
              />
              {/* Progress Circle */}
              <motion.circle
                cx="128"
                cy="128"
                r="116"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={728.85}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 728.85 }}
                animate={{ strokeDashoffset: 728.85 - (728.85 * Math.min(progress, 100)) / 100 }}
                transition={{ duration: 1.5, ease: "circOut" }}
                className="text-accent-green"
              />
            </svg>
            
            <div className="flex flex-col items-center z-10">
              <div className="bg-accent-berry/20 text-accent-berry border border-accent-berry/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest mb-2">
                Daily Progress
              </div>
              <span className="text-6xl font-display font-light text-white leading-none">
                {Math.round(todayScore)}
              </span>
              <span className="text-xs font-medium text-accent-green uppercase tracking-[0.2em] mt-2">Belly Balance</span>
            </div>
          </div>
          
          <div className="mt-10 text-center space-y-2">
            <h2 className="text-2xl font-display font-medium">Optimization Status: <span className="text-accent-green">{progress >= 100 ? 'Optimal' : progress > 50 ? 'Steady' : 'Building'}</span></h2>
            <p className="text-text-dim text-sm max-w-xs mx-auto leading-relaxed">
              {progress >= 100 
                ? "Your cellular recovery intake is peak. You've hit the top percentile for antioxidant optimization."
                : `Aim for ${Math.max(0, DAILY_GOAL - Math.round(todayScore))} more points to reach your daily oxidative balance goal.`}
            </p>
          </div>
        </section>

        {/* Action Button */}
        {!isAdding && !selectedFood && (
          <motion.button
            layoutId="add-button"
            onClick={() => setIsAdding(true)}
            className="w-full h-14 bg-accent-green text-bg rounded-xl flex items-center justify-center gap-2 font-semibold hover:brightness-110 transition-all uppercase tracking-widest text-xs shadow-lg shadow-accent-green/10"
          >
            <Plus className="w-5 h-5" />
            Add Oxidative Points
          </motion.button>
        )}

        {/* Adding Interface */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              layoutId="add-button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-surface rounded-2xl p-6 border border-border space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">Log Intake</h3>
                <button onClick={() => {setIsAdding(false); setSelectedFood(null); setSearchQuery('');}} className="p-2 hover:bg-bg rounded-full border border-transparent hover:border-border">
                  <X className="w-4 h-4 text-text-dim" />
                </button>
              </div>

              {!selectedFood ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search AODB Database..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-12 bg-bg border border-border rounded-xl pl-10 pr-4 focus:outline-none focus:border-accent-green transition-all text-sm placeholder:text-text-dim/50"
                    />
                  </div>

                  <div className="space-y-2">
                    {searchQuery ? (
                      filteredFood.map(food => (
                        <button
                          key={food.id}
                          onClick={() => setSelectedFood(food)}
                          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-bg group transition-all border border-border hover:border-accent-green/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl opacity-80">{food.emoji}</span>
                            <div className="text-left">
                              <p className="font-medium text-text-main group-hover:text-white transition-colors">{food.name}</p>
                              <p className="text-[10px] text-text-dim uppercase tracking-wider">{food.category}</p>
                            </div>
                          </div>
                          <div className="text-accent-berry text-[10px] font-bold font-mono uppercase">
                            {food.category === 'Junk Food' ? 'Oxidative Burden' : `${food.antioxidantScore} mmol`}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="py-6 text-center space-y-4">
                        <span className="text-[10px] text-text-dim uppercase tracking-[0.2em]">Quick Selection</span>
                        <div className="flex flex-wrap justify-center gap-2">
                          {['Blueberries', 'Coffee', 'Spinach', 'Walnuts'].map(name => (
                            <button 
                              key={name}
                              onClick={() => setSearchQuery(name)}
                              className="text-[10px] px-3 py-1 bg-bg text-text-dim rounded-full border border-border hover:border-accent-berry transition-colors"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-4 bg-bg p-4 rounded-xl border border-border">
                    <span className="text-3xl">{selectedFood.emoji}</span>
                    <div>
                      <h4 className="font-display text-lg text-text-main">{selectedFood.name}</h4>
                      <p className="text-[10px] text-accent-green uppercase tracking-widest font-bold">Select Hand-Size</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(PORTION_MULTIPLIERS) as PortionType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => addLog(selectedFood, type)}
                        className="flex flex-col items-start p-4 rounded-xl border border-border bg-bg hover:border-accent-berry hover:bg-surface transition-all group"
                      >
                        <span className="text-[10px] text-text-dim uppercase tracking-widest mb-1 group-hover:text-accent-berry transition-colors">1 {type}</span>
                        <span className="text-sm font-semibold text-text-main">{type === 'palm' ? 'Base Serving' : type === 'fist' ? 'Fibrous Volume' : type === 'handful' ? 'Concentrated' : 'Small Dose'}</span>
                        <div className={`mt-3 text-xs font-mono ${selectedFood.category === 'Junk Food' ? 'text-accent-berry' : 'text-accent-green'}`}>
                          {selectedFood.category === 'Junk Food' ? '-' : '+'}{Math.abs(Math.round(
                            (selectedFood.category === 'Junk Food' ? -10 : selectedFood.antioxidantScore * 10) * PORTION_MULTIPLIERS[type]
                          ))} PTS
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info / AODB Cite */}
        <section className="border-t border-border pt-10 pb-6 flex flex-col gap-6 text-center">
            <div className="space-y-2">
              <span className="text-[10px] text-text-dim uppercase tracking-[0.3em]">Scientific Basis</span>
              <p className="text-[11px] text-text-dim/80 leading-relaxed max-w-sm mx-auto font-light leading-relaxed">
                Data derived from the <strong className="text-text-main">Antioxidant Database (AODB)</strong> and the 2010 Carlsen meta-study. Scores represent cumulative mmol/kg measurements mapped to practical hand-measurements for reactive oxygen species neutralization.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-left">
              <div className="bg-surface border border-border p-3 rounded-lg overflow-hidden relative group">
                <span className="text-[9px] text-text-dim uppercase tracking-widest block mb-1">Total Gain</span>
                <span className="text-sm font-semibold text-text-main">{logs.filter(l => l.score > 0).reduce((sum, l) => sum + l.score, 0).toFixed(1)} pts</span>
                <TrendingUp className="absolute -bottom-1 -right-1 w-6 h-6 text-accent-green opacity-10 group-hover:opacity-20 transition-opacity" />
              </div>
              <div className="bg-surface border border-border p-3 rounded-lg overflow-hidden relative group">
                <span className="text-[9px] text-text-dim uppercase tracking-widest block mb-1">Burden Log</span>
                <span className="text-sm font-semibold text-text-main">{logs.filter(l => l.score < 0).length} entries</span>
                <Activity className="absolute -bottom-1 -right-1 w-6 h-6 text-accent-berry opacity-10 group-hover:opacity-20 transition-opacity" />
              </div>
            </div>
        </section>

        {/* History Modal / Drawer */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-bg/90 backdrop-blur-sm p-6 flex flex-col justify-end"
              onClick={() => setShowHistory(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-surface rounded-t-3xl border-t border-border p-8 max-h-[85vh] overflow-y-auto space-y-8 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between sticky top-0 bg-surface pb-4 border-b border-border z-10">
                  <h3 className="font-display text-2xl">Activity Center</h3>
                  <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-bg rounded-full border border-border transition-colors">
                    <X className="w-5 h-5 text-text-dim" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-bg rounded-xl border border-border">
                  <button 
                    onClick={() => setActiveTab('journal')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'journal' ? 'bg-surface text-accent-green border border-border shadow-sm' : 'text-text-dim'}`}
                  >
                    Journal
                  </button>
                  <button 
                    onClick={() => setActiveTab('milestones')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'milestones' ? 'bg-surface text-accent-berry border border-border shadow-sm' : 'text-text-dim'}`}
                  >
                    Badges ({earnedBadges.length})
                  </button>
                </div>
                
                <div className="space-y-4">
                  {activeTab === 'journal' ? (
                    <div className="space-y-1">
                      {logs.length === 0 ? (
                        <div className="py-20 text-center opacity-30">
                          <History className="w-12 h-12 mx-auto mb-4" />
                          <p className="font-display text-xl italic">No records found</p>
                        </div>
                      ) : (
                        logs.map(log => {
                          const food = getFoodById(log.foodId);
                          return (
                            <div key={log.id} className="flex items-center justify-between py-4 border-b border-border group">
                              <div className="flex items-center gap-4">
                                <span className="text-2xl group-hover:scale-110 transition-transform">{food?.emoji}</span>
                                <div>
                                  <p className="text-sm font-medium text-text-main">{food?.name}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-text-dim uppercase tracking-wider">
                                    <span>{log.portion}</span>
                                    <span className="w-1 h-1 bg-border rounded-full" />
                                    <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                 <div className={`font-mono text-sm ${log.score < 0 ? 'text-accent-berry' : 'text-accent-green'}`}>
                                   {log.score > 0 ? '+' : ''}{log.score} pts
                                 </div>
                                 <button 
                                   onClick={() => removeLog(log.id)}
                                   className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-bg rounded-lg border border-transparent hover:border-border transition-all"
                                 >
                                    <X className="w-3.5 h-3.5 text-text-dim" />
                                 </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 pb-4">
                        {BADGES.map(badge => {
                          const isEarned = earnedBadges.includes(badge.id);
                          return (
                            <div 
                              key={badge.id}
                              className={`p-4 rounded-2xl border transition-all ${isEarned ? 'bg-surface border-accent-berry/30 shadow-lg' : 'bg-bg/50 border-border opacity-50 filter grayscale'}`}
                            >
                              <div className="text-3xl mb-3">{badge.icon}</div>
                              <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isEarned ? 'text-accent-berry' : 'text-text-dim'}`}>{badge.title}</h4>
                              <p className="text-[10px] text-text-dim leading-tight mb-2">{badge.description}</p>
                              <div className="mt-auto pt-2 border-t border-border/50">
                                <span className="text-[9px] font-mono text-accent-green uppercase opacity-70">{badge.requirement}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="bg-bg border border-dashed border-border p-4 rounded-xl shadow-inner">
                  <span className="text-[10px] text-accent-berry uppercase tracking-widest block mb-1 font-bold">Health Insight</span>
                  <p className="text-[11px] text-text-dim leading-relaxed">
                    Based on your patterns, increasing ingestion of <span className="text-text-main">Berries</span> and <span className="text-text-main">Cinnamon</span> by 15% will significantly optimize your daily Belly Balance and oxidative balance.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Status */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 pointer-events-none z-40">
        <div className="max-w-xl mx-auto flex justify-center">
          <div className="bg-surface/90 backdrop-blur-xl border border-border px-5 py-2.5 rounded-full flex items-center gap-4 shadow-2xl pointer-events-auto">
            <Zap className="w-4 h-4 text-accent-berry fill-accent-berry animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-main">Belly Balance Active</span>
            <div className="w-px h-3 bg-border" />
            <span className="text-xs font-mono font-bold text-accent-green">{Math.round(progress)}%</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
