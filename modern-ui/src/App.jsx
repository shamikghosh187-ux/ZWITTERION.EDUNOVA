import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Atom, Bell, BookOpen,
  BookMarked, BrainCircuit, Check, ChevronDown, CircleHelp, Clock3, Command,
  Download, FileText, FlaskConical, GraduationCap, Home, LayoutDashboard,
  LibraryBig, Menu, Moon, MoreHorizontal, Search, Settings2, Sparkles, Sun,
  Target, TrendingUp, X, Zap
} from "lucide-react";

const subjects = [
  { name: "Physics", detail: "Mechanics, waves & more", icon: Atom, tone: "blue", count: "24 resources", progress: 68 },
  { name: "Chemistry", detail: "Physical, organic & inorganic", icon: FlaskConical, tone: "violet", count: "18 resources", progress: 42 },
  { name: "Mathematics", detail: "Build problem-solving fluency", icon: BrainCircuit, tone: "amber", count: "31 resources", progress: 54 },
];
const resources = [
  { title: "Laws of Motion", type: "Chapter notes", subject: "Physics", meta: "PDF · 18 pages", icon: FileText },
  { title: "Chemical Bonding", type: "Revision sheet", subject: "Chemistry", meta: "PDF · 12 pages", icon: BookMarked },
  { title: "Sequences & Series", type: "Practice set", subject: "Mathematics", meta: "PDF · 25 questions", icon: Target },
];
const nav = [{label:"Overview",icon:LayoutDashboard},{label:"My subjects",icon:BookOpen},{label:"Resource library",icon:LibraryBig},{label:"Study planner",icon:Clock3}];

export default function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("zwitterion-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
    catch { return "light"; }
  });
  const [active, setActive] = useState("Overview");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("zwitterion-theme", theme); } catch {}
  }, [theme]);

  const filtered = useMemo(() => resources.filter(r => (r.title+" "+r.subject+" "+r.type).toLowerCase().includes(query.toLowerCase())), [query]);
  const transition = reduceMotion ? { duration: 0 } : { duration: .24, ease: "easeOut" };
  const selectNav = label => { setActive(label); setMobileNav(false); if (label !== "Overview") setNotice(label + " view is a UI preview; production data integration comes in the migration phase."); else setNotice(""); };

  return <div className="app-shell">
    <AnimatePresence>{mobileNav && <motion.button aria-label="Close navigation overlay" className="nav-scrim" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setMobileNav(false)} />}</AnimatePresence>
    <aside className={"sidebar "+(mobileNav?"sidebar-open":"")}>
      <a className="brand" href="#" onClick={e=>{e.preventDefault();selectNav("Overview")}}>
        <span className="brand-mark"><GraduationCap size={23}/></span><span><b>zwitterion</b><small>CLASSES · LEARNING SPACE</small></span>
      </a>
      <div className="workspace-label">LEARNING WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{nav.map(item=><button key={item.label} className={"nav-link "+(active===item.label?"active":"")} onClick={()=>selectNav(item.label)}><item.icon size={18} strokeWidth={1.8}/><span>{item.label}</span>{item.label==="Resource library"&&<span className="nav-count">73</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="focus-card"><span className="focus-icon"><Zap size={17}/></span><b>Small steps. Big progress.</b><p>Every focused session moves you forward.</p><div className="focus-track"><span/></div><small>Preview workspace</small></div>
        <button className="nav-link" onClick={()=>setNotice("Help centre is not connected in this UI preview.")}><CircleHelp size={18}/><span>Help & support</span></button>
        <button className="profile-row" onClick={()=>setNotice("Student profile integration will be connected during migration.")}><span className="avatar">S</span><span className="profile-copy"><b>Student workspace</b><small>Learning dashboard</small></span><MoreHorizontal size={18}/></button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setMobileNav(true)}><Menu size={20}/></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{active}</b></div>
        <div className="top-actions">
          <label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search resources..." aria-label="Search resources"/><kbd><Command size={11}/> K</kbd></label>
          <button className="icon-button theme-toggle" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} aria-label={"Switch to "+(theme==="dark"?"light":"dark")+" mode"} title="Toggle appearance">{theme==="dark"?<Sun size={18}/>:<Moon size={18}/>}</button>
          <button className="icon-button notification" aria-label="Notifications" onClick={()=>setNotice("You're all caught up. No new notifications in this preview.")}><Bell size={18}/><i/></button>
        </div>
      </header>

      <div className="page-content">
        <AnimatePresence>{notice && <motion.div className="notice" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}><span>{notice}</span><button aria-label="Dismiss notice" onClick={()=>setNotice("")}><X size={16}/></button></motion.div>}</AnimatePresence>
        <motion.section className="welcome-row" initial={reduceMotion?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={transition}>
          <div><div className="eyebrow"><span className="status-dot"/> YOUR LEARNING SPACE</div><h1>Make today <span>count.</span></h1><p>A clear mind, a focused plan, one step at a time.</p></div>
          <div className="date-chip"><span className="date-icon"><Activity size={17}/></span><span><b>Keep your momentum</b><small>Your next study session starts here</small></span></div>
        </motion.section>

        <motion.section className="hero-panel" initial={reduceMotion?false:{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{...transition,delay:.04}}>
          <div className="hero-copy"><div className="hero-pill"><Sparkles size={13}/> YOUR NEXT CHAPTER</div><h2>Curiosity is your<br/><em>superpower.</em></h2><p>Explore your subjects, find the right resources, and turn practice into progress.</p><button className="hero-cta" onClick={()=>selectNav("My subjects")}>Explore my subjects <ArrowRight size={16}/></button></div>
          <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-core"><Atom size={54} strokeWidth={1.2}/></div><span className="float-symbol symbol-a">∑</span><span className="float-symbol symbol-b">π</span><span className="float-symbol symbol-c">∫</span><span className="art-spark spark-a">✳</span><span className="art-spark spark-b">✦</span></div>
          <div className="hero-index">01 <span>/ 03</span></div>
        </motion.section>

        <section className="section-block">
          <div className="section-heading"><div><div className="eyebrow">YOUR LEARNING PATH</div><h2>Pick up where you left off</h2></div><button className="text-link" onClick={()=>selectNav("My subjects")}>All subjects <ArrowRight size={15}/></button></div>
          <div className="subject-grid">{subjects.map((s,i)=><motion.button key={s.name} className="subject-card" onClick={()=>{setQuery(s.name);setNotice("Showing "+s.name+" resources in the resource list below.")}} initial={reduceMotion?false:{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{...transition,delay:.06+i*.05}} whileHover={reduceMotion?undefined:{y:-3}} whileTap={reduceMotion?undefined:{scale:.99}}><div className="subject-top"><span className={"subject-icon "+s.tone}><s.icon size={21}/></span><span className="subject-arrow"><ArrowUpRight size={17}/></span></div><h3>{s.name}</h3><p>{s.detail}</p><div className="subject-progress"><span><b>{s.progress}%</b><small> learning journey</small></span><span>{s.count}</span></div><div className="progress-track"><span className={s.tone} style={{width:s.progress+"%"}}/></div></motion.button>)}</div>
        </section>

        <section className="lower-grid">
          <div className="section-block resource-section"><div className="section-heading"><div><div className="eyebrow">READY WHEN YOU ARE</div><h2>Study resources</h2></div><button className="text-link" onClick={()=>selectNav("Resource library")}>Browse library <ArrowRight size={15}/></button></div>
            <div className="resource-list">{filtered.map((r,i)=><motion.button key={r.title} className="resource-row" onClick={()=>setNotice(r.title+" is sample content in this UI preview. Live PDF access remains in the existing production app.")} initial={reduceMotion?false:{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{...transition,delay:i*.035}}><span className="resource-icon"><r.icon size={19}/></span><span className="resource-copy"><b>{r.title}</b><small>{r.subject} <i/> {r.type}</small></span><span className="resource-meta">{r.meta}</span><span className="resource-open"><ArrowUpRight size={17}/></span></motion.button>)}{filtered.length===0&&<div className="empty-search"><Search size={20}/><b>No matching resources</b><span>Try another subject or title.</span></div>}</div>
          </div>
          <aside className="study-card"><div className="study-card-head"><span className="study-symbol"><Target size={19}/></span><span className="mini-tag">A LITTLE EVERY DAY</span></div><h3>Progress over<br/>perfection.</h3><p>Make space for one focused session. Consistency builds confidence.</p><div className="study-divider"/><div className="study-stat"><span><TrendingUp size={16}/> Your focus</span><b>Start today <ArrowDownRight size={15}/></b></div><button className="study-button" onClick={()=>selectNav("Study planner")}>Open study planner <ArrowRight size={15}/></button><div className="study-decoration" aria-hidden="true">✳</div></aside>
        </section>
        <footer className="footer"><span>© Zwitterion Classes</span><span><span className="footer-dot"/> Built for curious minds</span><span>Learn · Practise · Master</span></footer>
      </div>
    </main>
  </div>;
}
