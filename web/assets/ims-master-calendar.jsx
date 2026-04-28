import { useState, useMemo } from "react";
import {
  Calendar, Home, Users, Dumbbell, BarChart3, Settings,
  Activity, Search, Plus, Filter, ChevronLeft, ChevronRight, X,
  Bell, MapPin, Repeat, AlertTriangle, CheckCircle2, Circle,
  Heart, Wind, Sparkles, Stethoscope, Hand, DollarSign,
  MoreHorizontal, Edit3, FileText, ArrowRight, Phone,
  Award, ClipboardCheck, Target, Coffee, Wrench, Eye,
  RefreshCw, ChevronsLeft, ChevronsRight
} from "lucide-react";

// ============================================================
// SERVICE / STATUS / COLOR DEFINITIONS
// ============================================================
const SERVICES = {
  personal_training: { label: "Personal Training",   icon: Dumbbell,       color: "blue",    duration: 60 },
  mobility:          { label: "Mobility Coaching",   icon: Wind,           color: "emerald", duration: 60 },
  pilates:           { label: "Pilates",             icon: Activity,       color: "violet",  duration: 50 },
  massage:           { label: "Massage / Bodywork",  icon: Hand,           color: "amber",   duration: 60 },
  recovery:          { label: "Recovery Room",       icon: Heart,          color: "rose",    duration: 30 },
  bodpod:            { label: "BOD POD Test",        icon: BarChart3,      color: "cyan",    duration: 30 },
  assessment:        { label: "Movement Assessment", icon: Stethoscope,    color: "indigo",  duration: 45 },
  semi_private:      { label: "Semi-Private",        icon: Users,          color: "blue",    duration: 60 },
  consultation:      { label: "Consultation",        icon: ClipboardCheck, color: "indigo",  duration: 30 },
  program_review:    { label: "Program Review",      icon: FileText,       color: "indigo",  duration: 30 },
  admin:             { label: "Admin Block",         icon: Coffee,         color: "slate",   duration: 30 },
  cleaning:          { label: "Maintenance",         icon: Wrench,         color: "slate",   duration: 30 },
};

const COLOR = {
  blue:    { bg: "bg-blue-500",    bgSoft: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    accent: "text-blue-600" },
  emerald: { bg: "bg-emerald-500", bgSoft: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", accent: "text-emerald-600" },
  violet:  { bg: "bg-violet-500",  bgSoft: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200",  accent: "text-violet-600" },
  amber:   { bg: "bg-amber-500",   bgSoft: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   accent: "text-amber-600" },
  rose:    { bg: "bg-rose-500",    bgSoft: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    accent: "text-rose-600" },
  cyan:    { bg: "bg-cyan-500",    bgSoft: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200",    accent: "text-cyan-600" },
  indigo:  { bg: "bg-indigo-500",  bgSoft: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200",  accent: "text-indigo-600" },
  slate:   { bg: "bg-slate-500",   bgSoft: "bg-slate-100",  text: "text-slate-700",   border: "border-slate-200",   accent: "text-slate-600" },
};

const STATUS = {
  scheduled:      { label: "Scheduled",      cls: "bg-slate-100 text-slate-700 border-slate-200" },
  confirmed:      { label: "Confirmed",      cls: "bg-blue-50 text-blue-700 border-blue-200" },
  checked_in:     { label: "Checked In",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  completed:      { label: "Completed",      cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  no_show:        { label: "No Show",        cls: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled:      { label: "Cancelled",      cls: "bg-slate-100 text-slate-500 border-slate-200" },
  rescheduled:    { label: "Rescheduled",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  needs_followup: { label: "Follow-Up",      cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  payment_needed: { label: "Payment Needed", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

// ============================================================
// MOCK DATA
// ============================================================
const PROVIDERS = [
  { id: "p1", name: "Jason Patterson", title: "Founder · Head Coach",     credentials: "FRC · FRA · Kinstretch · FRC-ISM", initials: "JP", color: "blue" },
  { id: "p2", name: "Gabe Madrid",     title: "Trainer · Strength Coach", credentials: "NASM-CPT",                          initials: "GM", color: "emerald" },
  { id: "p3", name: "Kara Vasko",      title: "LMT · Bodywork",           credentials: "Licensed Massage Therapist",        initials: "KV", color: "amber" },
  { id: "p4", name: "Pilates Inst.",   title: "Pilates Instructor",       credentials: "Certified Reformer",                initials: "PI", color: "violet" },
  { id: "p5", name: "Recovery Staff",  title: "Recovery Specialist",      credentials: "—",                                 initials: "RS", color: "rose" },
];

const ROOMS = [
  { id: "r1", name: "Main Gym Floor",   short: "Main",     color: "blue" },
  { id: "r2", name: "Pilates Room",     short: "Pilates",  color: "violet" },
  { id: "r3", name: "Massage Room",     short: "Massage",  color: "amber" },
  { id: "r4", name: "Small Massage",    short: "Sm Mass",  color: "amber" },
  { id: "r5", name: "Recovery Room",    short: "Recovery", color: "rose" },
  { id: "r6", name: "BOD POD Room",     short: "BOD POD",  color: "cyan" },
  { id: "r7", name: "Chiro Room",       short: "Chiro",    color: "indigo" },
  { id: "r8", name: "Office / Consult", short: "Office",   color: "slate" },
];

const CLIENTS = [
  { id: "c1", name: "Jerry Zumbro",  initials: "JZ", phone: "(619) 555-0142", program: "Strength Foundation · Phase 2",   lastSession: "2 days ago",  credits: 8,  package: "12-pack",       mobility: ["Hip IR","T-spine"],         notes: "Returned to deadlifts week 4. No back flare-ups." },
  { id: "c2", name: "James Reid",    initials: "JR", phone: "(619) 555-0188", program: "Knee-Friendly Strength · Phase 1", lastSession: "yesterday",   credits: 4,  package: "Essentials 2x", mobility: ["Knee flexion","Ankle DF"],  notes: "Post-meniscus. Avoid deep loaded squat for 2 more weeks." },
  { id: "c3", name: "Amanda Chen",   initials: "AC", phone: "(619) 555-0271", program: "Comp + Nutrition · Phase 3",       lastSession: "today",       credits: 14, package: "Standard 3x",   mobility: ["Shoulder ER"],              notes: "Reviewing macros monthly. BOD POD due in 2 weeks." },
  { id: "c4", name: "Colin Cronin",  initials: "CC", phone: "(619) 555-0319", program: "Body Comp Tracking",               lastSession: "3 days ago",  credits: 2,  package: "6-pack",        mobility: ["Thoracic rotation"],        notes: "Quarterly BOD POD. Tracking lean mass." },
  { id: "c5", name: "Joey Lomedico", initials: "JL", phone: "(619) 555-0405", program: "Mobility + Strength · Phase 2",    lastSession: "yesterday",   credits: 11, package: "Standard 3x",   mobility: ["Hip CARs","Shoulder CARs"], notes: "Loves Kinstretch days. Good shoulder progress." },
  { id: "c6", name: "Spencer Love",  initials: "SL", phone: "(619) 555-0511", program: "Cardio + Mobility · Phase 1",      lastSession: "today (5am)", credits: 18, package: "Premium 4x",    mobility: ["Hip flexor","Calves"],      notes: "5am session preferred. Marathon training Q2." },
  { id: "c7", name: "Maya Patel",    initials: "MP", phone: "(619) 555-0622", program: "Pilates Foundations",              lastSession: "4 days ago",  credits: 6,  package: "12-pack",       mobility: ["Spinal mobility"],          notes: "Reformer 1x/week. New to strength work." },
  { id: "c8", name: "Daniel Ortiz",  initials: "DO", phone: "(619) 555-0733", program: "Recovery Focus",                   lastSession: "5 days ago",  credits: 0,  package: "Expired",       mobility: ["Lumbar"],                   notes: "Package expired — needs renewal conversation." },
];

// ============================================================
// DATE HELPERS
// ============================================================
const today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
const startOfWeek = (d) => {
  const r = new Date(d); r.setHours(0,0,0,0);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
};
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const addMin  = (d, m) => new Date(d.getTime() + m * 60 * 1000);
const dateAt  = (base, dayOffset, hour, minute = 0) => {
  const d = addDays(base, dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const fmtTime      = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtTimeShort = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(":00", "");
const fmtDateLong  = (d) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
const sameDay      = (a, b) => a.toDateString() === b.toDateString();
const minutesBetween = (a, b) => Math.round((b - a) / 60000);

const getClient   = (id) => CLIENTS.find(c => c.id === id);
const getProvider = (id) => PROVIDERS.find(p => p.id === id);
const getRoom     = (id) => ROOMS.find(r => r.id === id);

const thisMonday = startOfWeek(today);
const APPOINTMENTS = [
  { id: "a1",  clientId: "c6", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 0, 5, 0),   end: dateAt(thisMonday, 0, 6, 0),   status: "checked_in", goal: "Easy aerobic + hip mobility", notes: "Pre-marathon block — keep RPE under 6.", credits: true,  alert: null,                   recurring: true },
  { id: "a2",  clientId: "c1", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 0, 9, 0),   end: dateAt(thisMonday, 0, 10, 0),  status: "completed",  goal: "DL day — work up to RPE 7",   notes: "First time back to 315 since back tweak.", credits: true, alert: null, recurring: true },
  { id: "a3",  clientId: "c3", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 0, 10, 30), end: dateAt(thisMonday, 0, 11, 30), status: "completed",  goal: "Upper push + core",           notes: "Shoulder feeling good post-CARs warmup.",   credits: true, alert: "Program review due", recurring: false },
  { id: "a4",  clientId: "c5", providerId: "p2", roomId: "r1", service: "mobility",          start: dateAt(thisMonday, 0, 12, 0),  end: dateAt(thisMonday, 0, 13, 0),  status: "scheduled",  goal: "Hip CARs + lower body",       notes: "", credits: true, alert: null, recurring: true },
  { id: "a5",  clientId: "c7", providerId: "p4", roomId: "r2", service: "pilates",           start: dateAt(thisMonday, 0, 14, 0),  end: dateAt(thisMonday, 0, 14, 50), status: "confirmed",  goal: "Reformer foundations",        notes: "Footwork series + bridging.", credits: true, alert: null, recurring: true },
  { id: "a6",  clientId: "c2", providerId: "p3", roomId: "r3", service: "massage",           start: dateAt(thisMonday, 0, 15, 30), end: dateAt(thisMonday, 0, 16, 30), status: "scheduled",  goal: "Lower body / glute work",     notes: "Focus on quad fascia tightness.", credits: true, alert: null, recurring: false },
  { id: "a7",  clientId: "c8", providerId: "p1", roomId: "r8", service: "consultation",     start: dateAt(thisMonday, 0, 17, 0),  end: dateAt(thisMonday, 0, 17, 30), status: "scheduled",  goal: "Renewal conversation",        notes: "Package expired — discuss next phase.", credits: false, alert: "Payment needed", recurring: false },

  { id: "a8",  clientId: "c6", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 1, 5, 0),   end: dateAt(thisMonday, 1, 6, 0),   status: "scheduled",  goal: "Tempo + thoracic mobility",   notes: "", credits: true, alert: null, recurring: true },
  { id: "a9",  clientId: "c1", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 1, 9, 0),   end: dateAt(thisMonday, 1, 10, 0),  status: "scheduled",  goal: "Upper pull + core",           notes: "", credits: true, alert: null, recurring: true },
  { id: "a10", clientId: "c5", providerId: "p2", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 1, 11, 0),  end: dateAt(thisMonday, 1, 12, 0),  status: "scheduled",  goal: "Lower strength block",        notes: "", credits: true, alert: null, recurring: true },
  { id: "a11", clientId: "c4", providerId: "p5", roomId: "r6", service: "bodpod",            start: dateAt(thisMonday, 1, 13, 0),  end: dateAt(thisMonday, 1, 13, 30), status: "scheduled",  goal: "Quarterly retest",            notes: "Confirm 12hr fast + no AM workout.", credits: false, alert: "Pre-test instructions sent", recurring: false },
  { id: "a12", clientId: "c4", providerId: "p1", roomId: "r8", service: "program_review",   start: dateAt(thisMonday, 1, 13, 45), end: dateAt(thisMonday, 1, 14, 30), status: "scheduled",  goal: "Review BOD POD + adjust",     notes: "", credits: false, alert: null, recurring: false },
  { id: "a13", clientId: "c2", providerId: "p2", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 1, 16, 0),  end: dateAt(thisMonday, 1, 17, 0),  status: "scheduled",  goal: "Knee-friendly lower",         notes: "Box squats + RDLs only.", credits: true, alert: null, recurring: true },
  { id: "a14", clientId: null, providerId: "p3", roomId: "r3", service: "massage",           start: dateAt(thisMonday, 1, 18, 0),  end: dateAt(thisMonday, 1, 19, 0),  status: "scheduled",  goal: "Outside client",              notes: "", credits: false, alert: null, recurring: false },

  { id: "a15", clientId: "c6", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 2, 5, 0),   end: dateAt(thisMonday, 2, 6, 0),   status: "scheduled",  goal: "Long aerobic",                notes: "", credits: true, alert: null, recurring: true },
  { id: "a16", clientId: null, providerId: "p1", roomId: "r1", service: "admin",             start: dateAt(thisMonday, 2, 7, 0),   end: dateAt(thisMonday, 2, 8, 30),  status: "scheduled",  goal: "Programming block",           notes: "Update Joey + Amanda phase 3 plans.", credits: false, alert: null, recurring: true },
  { id: "a17", clientId: "c7", providerId: "p4", roomId: "r2", service: "pilates",           start: dateAt(thisMonday, 2, 10, 0),  end: dateAt(thisMonday, 2, 10, 50), status: "scheduled",  goal: "Reformer",                    notes: "", credits: true, alert: null, recurring: false },
  { id: "a18", clientId: "c5", providerId: "p1", roomId: "r1", service: "mobility",          start: dateAt(thisMonday, 2, 12, 0),  end: dateAt(thisMonday, 2, 13, 0),  status: "scheduled",  goal: "Kinstretch — shoulders",      notes: "", credits: true, alert: null, recurring: true },
  { id: "a19", clientId: "c3", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 2, 14, 0),  end: dateAt(thisMonday, 2, 15, 0),  status: "scheduled",  goal: "Lower strength",              notes: "", credits: true, alert: null, recurring: false },

  { id: "a20", clientId: "c1", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 3, 9, 0),   end: dateAt(thisMonday, 3, 10, 0),  status: "scheduled",  goal: "Squat day",                   notes: "", credits: true, alert: null, recurring: true },
  { id: "a21", clientId: "c2", providerId: "p2", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 3, 10, 30), end: dateAt(thisMonday, 3, 11, 30), status: "scheduled",  goal: "Upper body",                  notes: "", credits: true, alert: null, recurring: false },
  { id: "a22", clientId: "c5", providerId: "p2", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 3, 12, 0),  end: dateAt(thisMonday, 3, 13, 0),  status: "scheduled",  goal: "Strength — pull focus",       notes: "", credits: true, alert: null, recurring: true },
  { id: "a23", clientId: null, providerId: "p3", roomId: "r3", service: "massage",           start: dateAt(thisMonday, 3, 14, 0),  end: dateAt(thisMonday, 3, 15, 0),  status: "scheduled",  goal: "Outside client",              notes: "", credits: false, alert: null, recurring: false },
  { id: "a24", clientId: "c8", providerId: "p1", roomId: "r1", service: "assessment",        start: dateAt(thisMonday, 3, 16, 0),  end: dateAt(thisMonday, 3, 16, 45), status: "scheduled",  goal: "Movement re-assessment",      notes: "Returning client — full FMS.", credits: false, alert: "New program needed", recurring: false },

  { id: "a25", clientId: "c6", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 4, 5, 0),   end: dateAt(thisMonday, 4, 6, 0),   status: "scheduled",  goal: "Recovery run + mobility",     notes: "", credits: true, alert: null, recurring: true },
  { id: "a26", clientId: "c1", providerId: "p1", roomId: "r1", service: "personal_training", start: dateAt(thisMonday, 4, 9, 0),   end: dateAt(thisMonday, 4, 10, 0),  status: "scheduled",  goal: "Press day + accessories",     notes: "", credits: true, alert: null, recurring: true },
  { id: "a27", clientId: "c7", providerId: "p4", roomId: "r2", service: "pilates",           start: dateAt(thisMonday, 4, 11, 0),  end: dateAt(thisMonday, 4, 11, 50), status: "scheduled",  goal: "Reformer + spine work",       notes: "", credits: true, alert: null, recurring: true },
  { id: "a28", clientId: "c3", providerId: "p3", roomId: "r3", service: "massage",           start: dateAt(thisMonday, 4, 13, 0),  end: dateAt(thisMonday, 4, 14, 0),  status: "scheduled",  goal: "Recovery massage",            notes: "Post hard week.", credits: true, alert: null, recurring: false },
  { id: "a29", clientId: null, providerId: "p1", roomId: "r1", service: "admin",             start: dateAt(thisMonday, 4, 15, 0),  end: dateAt(thisMonday, 4, 16, 0),  status: "scheduled",  goal: "Weekly review",               notes: "", credits: false, alert: null, recurring: true },

  { id: "a30", clientId: "c5", providerId: "p1", roomId: "r1", service: "mobility",          start: dateAt(thisMonday, 5, 9, 0),   end: dateAt(thisMonday, 5, 10, 0),  status: "scheduled",  goal: "Kinstretch group-style",      notes: "", credits: true, alert: null, recurring: false },
  { id: "a31", clientId: null, providerId: "p3", roomId: "r3", service: "massage",           start: dateAt(thisMonday, 5, 11, 0),  end: dateAt(thisMonday, 5, 12, 0),  status: "scheduled",  goal: "Walk-in slot",                notes: "", credits: false, alert: null, recurring: false },
];

const ALERTS = [
  { id: "al1", severity: "warning",  clientId: "c4", message: "Colin has 2 sessions left — package nearly out",                 action: "Send renewal" },
  { id: "al2", severity: "critical", clientId: "c8", message: "Daniel package expired — payment needed before next session",    action: "Open profile" },
  { id: "al3", severity: "warning",  clientId: "c1", message: "Jerry's Mon 9am session needs session notes",                    action: "Add notes" },
  { id: "al4", severity: "info",     clientId: "c3", message: "Amanda's BOD POD retest is due in 14 days",                      action: "Schedule retest" },
  { id: "al5", severity: "warning",  clientId: "c8", message: "Daniel has no upcoming appointments",                            action: "Reach out" },
  { id: "al6", severity: "info",     clientId: "c6", message: "Spencer (Premium 4x) — referral conversation overdue",          action: "Ask for referral" },
];

// Time grid: 5am to 8pm
const HOURS = Array.from({ length: 16 }, (_, i) => i + 5);
const ROW_PX = 56;
const minutesToY = (mins) => (mins / 60) * ROW_PX;

// ============================================================
// SHARED UI
// ============================================================
const StatusPill = ({ status }) => {
  const s = STATUS[status] || STATUS.scheduled;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`} style={{fontSize: 10}}>
      <span className="w-1 h-1 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
};

const ClientAvatar = ({ client, size = "md" }) => {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-xs";
  if (!client) return <div className={`${sz} rounded-full bg-slate-200 text-slate-500 font-semibold flex items-center justify-center`}>?</div>;
  const grads = [
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-violet-500 to-fuchsia-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-cyan-500 to-sky-600",
  ];
  const seed = (client.initials.charCodeAt(0) + (client.initials.charCodeAt(1) || 0)) % 6;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${grads[seed]} text-white font-semibold flex items-center justify-center shadow-sm`}>
      {client.initials}
    </div>
  );
};

const ProviderBadge = ({ provider, size = "sm" }) => {
  if (!provider) return null;
  const c = COLOR[provider.color];
  const sz = size === "sm" ? "w-5 h-5" : "w-7 h-7";
  return <div className={`${sz} ${c.bg} text-white rounded-md font-semibold flex items-center justify-center`} style={{fontSize: size === "sm" ? 9 : 11}}>{provider.initials}</div>;
};

const RoomBadge = ({ room }) => {
  if (!room) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600" style={{fontSize: 10}}>
      <MapPin className="w-3 h-3" />
      {room.short}
    </span>
  );
};

const Label = ({ children, className = "" }) => (
  <div className={`uppercase tracking-widest text-slate-500 font-medium ${className}`} style={{fontSize: 10, letterSpacing: "0.1em"}}>
    {children}
  </div>
);

// ============================================================
// SIDEBAR
// ============================================================
const NavItem = ({ icon: Icon, label, active, badge }) => (
  <button className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
    active ? "bg-blue-500/15 text-white ring-1 ring-blue-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"
  }`}>
    <Icon className={`w-4 h-4 ${active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
    <span className="flex-1 text-left">{label}</span>
    {badge && <span className="bg-blue-500 text-white font-semibold px-1.5 py-0.5 rounded-md" style={{fontSize: 10}}>{badge}</span>}
  </button>
);

const Sidebar = ({ collapsed, onToggle, role, onRoleChange }) => (
  <aside className={`${collapsed ? "w-16" : "w-60"} shrink-0 border-r border-white/5 flex flex-col transition-all duration-200`} style={{ background: "linear-gradient(180deg, #0c1322 0%, #060a14 100%)" }}>
    <div className="h-16 flex items-center gap-2.5 px-4 border-b border-white/5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg" style={{boxShadow: "0 8px 24px -8px rgba(59,130,246,0.5)"}}>
        <span className="font-bold text-white text-lg" style={{letterSpacing: "-0.05em"}}>i</span>
      </div>
      {!collapsed && (
        <div>
          <div className="font-bold text-white text-base leading-none" style={{letterSpacing: "-0.03em"}}>iMS</div>
          <div className="text-slate-500 mt-0.5 tracking-widest uppercase font-medium" style={{fontSize: 9}}>Scripps Ranch</div>
        </div>
      )}
    </div>
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {!collapsed && <Label className="px-3 pt-2 pb-1.5">Workspace</Label>}
      <NavItem icon={Home}        label="Dashboard" />
      <NavItem icon={Calendar}    label="Master Calendar" active badge="Today" />
      <NavItem icon={Users}       label="Clients" />
      <NavItem icon={Dumbbell}    label="Program Generator" />
      <NavItem icon={Stethoscope} label="Assessments" />
      <NavItem icon={BarChart3}   label="Body Comp" />
      {!collapsed && <Label className="px-3 pt-4 pb-1.5">Operations</Label>}
      <NavItem icon={Award}       label="Staff" />
      <NavItem icon={DollarSign}  label="Revenue" />
      <NavItem icon={Settings}    label="Settings" />
    </nav>
    {!collapsed && (
      <div className="p-3 border-t border-white/5">
        <Label className="px-1 pb-2">Viewing as</Label>
        <div className="grid grid-cols-2 gap-1">
          {["admin", "trainer", "provider", "client"].map(r => (
            <button key={r} onClick={() => onRoleChange(r)} className={`px-2 py-1.5 rounded-lg text-xs font-medium capitalize transition ${role === r ? "bg-blue-500 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">JP</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">Jason Patterson</div>
            <div className="text-slate-500 truncate" style={{fontSize: 10}}>Owner</div>
          </div>
        </div>
      </div>
    )}
    <button onClick={onToggle} className="p-3 border-t border-white/5 text-slate-500 hover:text-white text-xs flex items-center justify-center">
      {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
    </button>
  </aside>
);

// ============================================================
// HEADER
// ============================================================
const HeaderBar = ({ view, onView, dateLabel, onPrev, onNext, onToday, onNewAppt, onFilterToggle, search, onSearch, filterCount }) => (
  <header className="h-16 shrink-0 border-b border-white/5 px-5 flex items-center gap-4" style={{ background: "linear-gradient(180deg, #0c1322 0%, #0a0f1d 100%)" }}>
    <div className="flex items-center gap-2">
      <button onClick={onToday} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5">Today</button>
      <button onClick={onPrev} className="w-8 h-8 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
      <button onClick={onNext} className="w-8 h-8 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
      <div className="text-lg font-bold text-white ml-2" style={{letterSpacing: "-0.02em"}}>{dateLabel}</div>
    </div>
    <div className="flex-1" />
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search clients, services, rooms…"
        className="w-full bg-white/5 border border-white/5 focus:border-blue-500 focus:bg-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition"
      />
    </div>
    <div className="flex items-center bg-white/5 border border-white/5 rounded-lg p-0.5">
      {["today","day","week","staff","room","month"].map(v => (
        <button key={v} onClick={() => onView(v)} className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"}`}>
          {v}
        </button>
      ))}
    </div>
    <button onClick={onFilterToggle} className="relative w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 flex items-center justify-center">
      <Filter className="w-4 h-4" />
      {filterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center" style={{fontSize: 9}}>{filterCount}</span>}
    </button>
    <button className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 flex items-center justify-center"><RefreshCw className="w-4 h-4" /></button>
    <button onClick={onNewAppt} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition" style={{boxShadow: "0 8px 20px -6px rgba(59,130,246,0.5)"}}>
      <Plus className="w-4 h-4" /> New
    </button>
  </header>
);

// ============================================================
// APPOINTMENT CARDS
// ============================================================
const AppointmentCard = ({ appt, onClick, density = "normal" }) => {
  const svc = SERVICES[appt.service];
  const c = COLOR[svc.color];
  const provider = getProvider(appt.providerId);
  const client = getClient(appt.clientId);
  const room = getRoom(appt.roomId);
  const Icon = svc.icon;
  const isCancelled = appt.status === "cancelled";
  return (
    <button onClick={onClick} className={`group w-full h-full text-left rounded-lg overflow-hidden bg-white border border-slate-200 hover:shadow-lg hover:border-slate-300 transition relative ${isCancelled ? "opacity-60" : ""}`}>
      <span className={`absolute left-0 top-0 h-full w-1 ${c.bg}`} />
      <div className="p-2 pl-3 h-full flex flex-col">
        <div className="flex items-start gap-1.5 min-w-0">
          <div className={`w-5 h-5 rounded ${c.bgSoft} flex items-center justify-center shrink-0`}>
            <Icon className={`w-3 h-3 ${c.accent}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-500 leading-tight font-mono" style={{fontSize: 10}}>{fmtTimeShort(appt.start)}</div>
            <div className="text-xs font-semibold text-slate-900 truncate leading-tight mt-0.5">
              {client ? client.name : <span className="italic text-slate-500">{appt.goal || svc.label}</span>}
            </div>
          </div>
          {appt.alert && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
        </div>
        {density === "normal" && (
          <div className="mt-auto pt-1.5 flex items-center gap-1 flex-wrap">
            <ProviderBadge provider={provider} />
            {room && <RoomBadge room={room} />}
            {appt.recurring && <Repeat className="w-3 h-3 text-slate-400" />}
          </div>
        )}
      </div>
    </button>
  );
};

const AppointmentChip = ({ appt, onClick }) => {
  const svc = SERVICES[appt.service];
  const c = COLOR[svc.color];
  const client = getClient(appt.clientId);
  return (
    <button onClick={onClick} className={`w-full text-left p-1.5 rounded-md ${c.bgSoft} ${c.text} hover:brightness-95 transition font-medium leading-tight border-l-2 ${c.border} truncate`} style={{fontSize: 10}}>
      <div className="font-mono opacity-70" style={{fontSize: 9}}>{fmtTimeShort(appt.start)}</div>
      <div className="font-semibold truncate">{client ? client.name : svc.label}</div>
    </button>
  );
};

// ============================================================
// TIME GRID PRIMITIVES
// ============================================================
const TimeAxis = () => (
  <div className="w-14 shrink-0 sticky left-0 bg-white z-10 border-r border-slate-200">
    {HOURS.map((h) => (
      <div key={h} style={{ height: ROW_PX }} className="relative">
        <span className="absolute right-2 text-slate-400 font-mono" style={{top: -6, fontSize: 10}}>
          {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
        </span>
      </div>
    ))}
  </div>
);

const HourLines = () => (
  <>
    {HOURS.map((h, i) => (
      <div key={h} style={{ top: i * ROW_PX }} className="absolute left-0 right-0 border-t border-slate-100 pointer-events-none" />
    ))}
  </>
);

// ============================================================
// VIEWS
// ============================================================
const WeekView = ({ appointments, weekStart, onApptClick }) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const apptsForDay = (d) => appointments.filter(a => sameDay(a.start, d));
  const totalHeight = HOURS.length * ROW_PX;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex border-b border-slate-200 bg-slate-50">
        <div className="w-14 shrink-0 border-r border-slate-200" />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={i} className={`flex-1 px-3 py-3 text-center border-r border-slate-200 last:border-r-0 ${isToday ? "bg-blue-50" : ""}`}>
              <Label>{d.toLocaleDateString(undefined, { weekday: "short" })}</Label>
              <div className={`text-lg font-bold mt-0.5 ${isToday ? "text-blue-600" : "text-slate-900"}`} style={{letterSpacing: "-0.02em"}}>
                {d.getDate()}
                {isToday && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex relative" style={{ height: totalHeight }}>
          <TimeAxis />
          {days.map((d, di) => (
            <div key={di} className="flex-1 relative border-r border-slate-200 last:border-r-0">
              <HourLines />
              {apptsForDay(d).map(a => {
                const startMin = (a.start.getHours() - 5) * 60 + a.start.getMinutes();
                const dur = minutesBetween(a.start, a.end);
                return (
                  <div key={a.id} style={{ top: minutesToY(startMin), height: minutesToY(dur), padding: 2 }} className="absolute left-0 right-0">
                    <AppointmentCard appt={a} onClick={() => onApptClick(a)} density={dur < 45 ? "compact" : "normal"} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DayView = ({ appointments, dayDate, onApptClick }) => {
  const apptsToday = appointments.filter(a => sameDay(a.start, dayDate));
  const totalHeight = HOURS.length * ROW_PX;
  const isToday = sameDay(dayDate, today);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <Label>Day View</Label>
          <div className="text-xl font-bold text-slate-900" style={{letterSpacing: "-0.02em"}}>
            {fmtDateLong(dayDate)}
            {isToday && <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full align-middle">Today</span>}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          <span className="font-semibold text-slate-900">{apptsToday.length}</span> appointments
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex relative" style={{ height: totalHeight }}>
          <TimeAxis />
          <div className="flex-1 relative">
            <HourLines />
            {apptsToday.map(a => {
              const startMin = (a.start.getHours() - 5) * 60 + a.start.getMinutes();
              const dur = minutesBetween(a.start, a.end);
              return (
                <div key={a.id} style={{ top: minutesToY(startMin), height: minutesToY(dur), padding: 2 }} className="absolute left-2 right-2">
                  <AppointmentCard appt={a} onClick={() => onApptClick(a)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const StaffView = ({ appointments, dayDate, onApptClick }) => {
  const totalHeight = HOURS.length * ROW_PX;
  const dayAppts = appointments.filter(a => sameDay(a.start, dayDate));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex border-b border-slate-200 bg-slate-50">
        <div className="w-14 shrink-0 border-r border-slate-200" />
        {PROVIDERS.map(p => {
          const c = COLOR[p.color];
          const count = dayAppts.filter(a => a.providerId === p.id).length;
          return (
            <div key={p.id} className="flex-1 px-3 py-3 border-r border-slate-200 last:border-r-0 min-w-0">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 ${c.bg} text-white rounded-lg font-semibold flex items-center justify-center shrink-0 text-xs`}>{p.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">{p.name}</div>
                  <div className="text-slate-500 truncate" style={{fontSize: 10}}>{p.title}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="text-slate-500 font-mono" style={{fontSize: 10}}>{count} session{count !== 1 ? "s" : ""}</div>
                {count > 0 && (
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full ${c.bg}`} style={{ width: `${Math.min(100, (count / 6) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex relative" style={{ height: totalHeight }}>
          <TimeAxis />
          {PROVIDERS.map(p => {
            const provAppts = dayAppts.filter(a => a.providerId === p.id);
            return (
              <div key={p.id} className="flex-1 relative border-r border-slate-200 last:border-r-0 min-w-0">
                <HourLines />
                {provAppts.map(a => {
                  const startMin = (a.start.getHours() - 5) * 60 + a.start.getMinutes();
                  const dur = minutesBetween(a.start, a.end);
                  return (
                    <div key={a.id} style={{ top: minutesToY(startMin), height: minutesToY(dur), padding: 2 }} className="absolute left-0 right-0">
                      <AppointmentCard appt={a} onClick={() => onApptClick(a)} density={dur < 45 ? "compact" : "normal"} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RoomView = ({ appointments, dayDate, onApptClick }) => {
  const totalHeight = HOURS.length * ROW_PX;
  const dayAppts = appointments.filter(a => sameDay(a.start, dayDate));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex border-b border-slate-200 bg-slate-50">
        <div className="w-14 shrink-0 border-r border-slate-200" />
        {ROOMS.map(r => {
          const c = COLOR[r.color];
          const count = dayAppts.filter(a => a.roomId === r.id).length;
          const utilization = Math.min(100, count * 12);
          return (
            <div key={r.id} className="flex-1 px-2.5 py-3 border-r border-slate-200 last:border-r-0 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 ${c.bg} rounded-full shrink-0`} />
                <div className="text-xs font-semibold text-slate-900 truncate">{r.name}</div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="text-slate-500 font-mono" style={{fontSize: 10}}>{count}</div>
                <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${c.bg}`} style={{ width: `${utilization}%` }} />
                </div>
                <div className="text-slate-400 font-mono" style={{fontSize: 9}}>{utilization}%</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex relative" style={{ height: totalHeight }}>
          <TimeAxis />
          {ROOMS.map(r => {
            const roomAppts = dayAppts.filter(a => a.roomId === r.id);
            return (
              <div key={r.id} className="flex-1 relative border-r border-slate-200 last:border-r-0 min-w-0">
                <HourLines />
                {roomAppts.map(a => {
                  const startMin = (a.start.getHours() - 5) * 60 + a.start.getMinutes();
                  const dur = minutesBetween(a.start, a.end);
                  return (
                    <div key={a.id} style={{ top: minutesToY(startMin), height: minutesToY(dur), padding: 2 }} className="absolute left-0 right-0">
                      <AppointmentCard appt={a} onClick={() => onApptClick(a)} density="compact" />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MonthView = ({ appointments, dayDate, onApptClick }) => {
  const first = new Date(dayDate.getFullYear(), dayDate.getMonth(), 1);
  const startDay = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first); d.setDate(1 - startDay + i); return d;
  });
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
        <Label>Month</Label>
        <div className="text-xl font-bold text-slate-900" style={{letterSpacing: "-0.02em"}}>{dayDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
          <div key={d} className="text-center py-2 border-r border-slate-200 last:border-r-0"><Label>{d}</Label></div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-auto">
        {cells.map((d, i) => {
          const dayAppts = appointments.filter(a => sameDay(a.start, d));
          const inMonth = d.getMonth() === dayDate.getMonth();
          const isToday = sameDay(d, today);
          return (
            <div key={i} className={`border-r border-b border-slate-200 p-1.5 min-h-0 overflow-hidden ${!inMonth ? "bg-slate-50" : ""} ${isToday ? "bg-blue-50" : ""}`}>
              <div className={`text-xs font-semibold mb-1 ${isToday ? "text-blue-600" : inMonth ? "text-slate-900" : "text-slate-400"}`}>{d.getDate()}</div>
              <div className="space-y-1">
                {dayAppts.slice(0, 3).map(a => <AppointmentChip key={a.id} appt={a} onClick={() => onApptClick(a)} />)}
                {dayAppts.length > 3 && <div className="text-slate-500 px-1" style={{fontSize: 9}}>+{dayAppts.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// TODAY DASHBOARD
// ============================================================
const StatCard = ({ icon: Icon, label, value, sub, accent = "blue", trend }) => {
  const c = COLOR[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${c.bgSoft} opacity-60`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className={`w-9 h-9 rounded-xl ${c.bgSoft} ${c.accent} flex items-center justify-center`}><Icon className="w-4 h-4" /></div>
          {trend && <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md" style={{fontSize: 10}}>{trend}</span>}
        </div>
        <div className="mt-3 text-3xl font-bold text-slate-900" style={{letterSpacing: "-0.03em"}}>{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-slate-400 mt-1" style={{fontSize: 11}}>{sub}</div>}
      </div>
    </div>
  );
};

const TodayDashboard = ({ appointments, alerts, onApptClick }) => {
  const todays = appointments.filter(a => sameDay(a.start, today)).sort((a,b) => a.start - b.start);
  const completed = todays.filter(a => a.status === "completed").length;
  const remaining = todays.filter(a => !["completed","cancelled","no_show"].includes(a.status)).length;
  const sessionValue = todays.filter(a => a.credits).length * 90;
  const trainersWorking = new Set(todays.map(a => a.providerId)).size;
  const roomsInUse = new Set(todays.map(a => a.roomId).filter(Boolean)).size;
  const firstAppt = todays[0];
  const lastAppt = todays[todays.length - 1];
  const assessmentsToday = todays.filter(a => a.service === "assessment" || a.service === "bodpod").length;

  return (
    <div className="space-y-5 h-full overflow-auto pb-6 pr-1">
      {/* Hero */}
      <div className="rounded-2xl p-6 border border-white/10 relative overflow-hidden" style={{background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)"}}>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-blue-500 opacity-20 blur-3xl pointer-events-none" />
        <div className="relative flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="uppercase tracking-widest text-blue-300 font-medium" style={{fontSize: 10, letterSpacing: "0.15em"}}>Live · Today at iMS</span>
            </div>
            <h1 className="text-4xl font-bold text-white" style={{letterSpacing: "-0.03em"}}>{today.toLocaleDateString(undefined, { weekday: "long" })}</h1>
            <p className="text-slate-400 text-sm mt-1">{today.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · Scripps Ranch Studio</p>
          </div>
          <div className="flex items-center gap-6 text-white">
            <div>
              <div className="uppercase tracking-widest text-slate-400 font-medium" style={{fontSize: 10, letterSpacing: "0.15em"}}>Doors</div>
              <div className="text-xl font-semibold mt-1" style={{letterSpacing: "-0.02em"}}>5:00a → 8:00p</div>
            </div>
            <div>
              <div className="uppercase tracking-widest text-slate-400 font-medium" style={{fontSize: 10, letterSpacing: "0.15em"}}>First In</div>
              <div className="text-xl font-semibold mt-1" style={{letterSpacing: "-0.02em"}}>{firstAppt ? fmtTime(firstAppt.start) : "—"}</div>
            </div>
            <div>
              <div className="uppercase tracking-widest text-slate-400 font-medium" style={{fontSize: 10, letterSpacing: "0.15em"}}>Last Out</div>
              <div className="text-xl font-semibold mt-1" style={{letterSpacing: "-0.02em"}}>{lastAppt ? fmtTime(lastAppt.end) : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Calendar}        label="Total appointments" value={todays.length}      sub={`${completed} done · ${remaining} remaining`} accent="blue" />
        <StatCard icon={DollarSign}      label="Session value"      value={`$${sessionValue}`} sub={`${todays.filter(a=>a.credits).length} billable sessions`} accent="emerald" trend="+12%" />
        <StatCard icon={Award}           label="Trainers working"   value={trainersWorking}    sub={`${roomsInUse} rooms in use`} accent="violet" />
        <StatCard icon={ClipboardCheck}  label="Assessments / BOD POD" value={assessmentsToday} sub="Pre-test prep up to date" accent="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <Label>Timeline</Label>
              <h2 className="text-lg font-bold text-slate-900" style={{letterSpacing: "-0.02em"}}>Today's appointments</h2>
            </div>
            <button className="text-xs font-medium text-blue-600 hover:text-blue-700">View week →</button>
          </div>
          <div className="p-2 overflow-auto" style={{maxHeight: 520}}>
            {todays.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No appointments today.</div>}
            <div className="space-y-1.5">
              {todays.map(a => {
                const svc = SERVICES[a.service];
                const c = COLOR[svc.color];
                const Icon = svc.icon;
                const provider = getProvider(a.providerId);
                const client = getClient(a.clientId);
                const room = getRoom(a.roomId);
                return (
                  <button key={a.id} onClick={() => onApptClick(a)} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition group text-left">
                    <div className="w-16 shrink-0 text-right">
                      <div className="font-mono text-sm font-semibold text-slate-900">{fmtTimeShort(a.start)}</div>
                      <div className="text-slate-400 font-mono" style={{fontSize: 10}}>{minutesBetween(a.start, a.end)}m</div>
                    </div>
                    <div className={`w-1 self-stretch rounded-full ${c.bg}`} />
                    <div className={`w-10 h-10 rounded-xl ${c.bgSoft} ${c.accent} flex items-center justify-center shrink-0`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm truncate">{client ? client.name : svc.label}</span>
                        {a.alert && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {a.recurring && <Repeat className="w-3 h-3 text-slate-400 shrink-0" />}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{svc.label}{a.goal ? ` · ${a.goal}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ProviderBadge provider={provider} size="md" />
                      {room && <RoomBadge room={room} />}
                      <StatusPill status={a.status} />
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <Label>Smart alerts</Label>
                <h2 className="text-lg font-bold text-slate-900" style={{letterSpacing: "-0.02em"}}>{alerts.length} action items</h2>
              </div>
              <Bell className="w-4 h-4 text-slate-400" />
            </div>
            <div className="divide-y divide-slate-100">
              {alerts.map(al => {
                const sevColor = al.severity === "critical" ? "rose" : al.severity === "warning" ? "amber" : "blue";
                const c = COLOR[sevColor];
                const client = al.clientId ? getClient(al.clientId) : null;
                return (
                  <button key={al.id} className="w-full flex items-start gap-3 p-3.5 hover:bg-slate-50 text-left transition">
                    <div className={`w-7 h-7 rounded-lg ${c.bgSoft} ${c.accent} flex items-center justify-center shrink-0`}><AlertTriangle className="w-3.5 h-3.5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-900 leading-snug">{al.message}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {client && <span className="text-slate-500" style={{fontSize: 10}}>{client.name}</span>}
                        <span className={`font-medium ${c.accent}`} style={{fontSize: 10}}>{al.action} →</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <Label>On the floor</Label>
              <h2 className="text-lg font-bold text-slate-900" style={{letterSpacing: "-0.02em"}}>Staff today</h2>
            </div>
            <div className="p-3 space-y-1">
              {PROVIDERS.map(p => {
                const count = todays.filter(a => a.providerId === p.id).length;
                if (count === 0) return null;
                const c = COLOR[p.color];
                return (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                    <div className={`w-8 h-8 ${c.bg} text-white rounded-lg font-semibold text-xs flex items-center justify-center`}>{p.initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">{p.name}</div>
                      <div className="text-slate-500 truncate" style={{fontSize: 10}}>{p.title}</div>
                    </div>
                    <div className="text-xs font-mono text-slate-600">{count} sess.</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// DRAWER + MODALS
// ============================================================
const Drawer = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900 bg-opacity-40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">{children}</div>
    </div>
  );
};

const ActionButton = ({ icon: Icon, label, primary, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition group ${primary ? "bg-slate-900 hover:bg-slate-800 text-white" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}`}>
    <Icon className="w-4 h-4" />
    <span className="flex-1 text-left">{label}</span>
    <ArrowRight className="w-3 h-3 opacity-50" />
  </button>
);

const AppointmentDrawer = ({ appt, onClose, onAddNotes, role }) => {
  if (!appt) return null;
  const svc = SERVICES[appt.service];
  const c = COLOR[svc.color];
  const Icon = svc.icon;
  const client = getClient(appt.clientId);
  const provider = getProvider(appt.providerId);
  const room = getRoom(appt.roomId);
  const isAdmin = role === "admin";
  const isAssessment = appt.service === "assessment";
  const isBodPod = appt.service === "bodpod";

  return (
    <Drawer open={!!appt} onClose={onClose}>
      <div className={`relative px-6 pt-6 pb-5 border-b border-slate-200 ${c.bgSoft}`}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center"><X className="w-4 h-4" /></button>
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl ${c.bg} text-white flex items-center justify-center shadow-md`}><Icon className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0 pr-8">
            <Label>{svc.label}</Label>
            <div className="text-2xl font-bold text-slate-900 leading-tight mt-0.5 truncate" style={{letterSpacing: "-0.02em"}}>{client ? client.name : svc.label}</div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusPill status={appt.status} />
              {appt.recurring && <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200" style={{fontSize: 10}}><Repeat className="w-3 h-3" /> Recurring</span>}
              {appt.alert && <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full" style={{fontSize: 10}}><AlertTriangle className="w-3 h-3" /> {appt.alert}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-4 border-b border-slate-100">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>When</Label>
              <div className="text-sm font-semibold text-slate-900 mt-1">{fmtDateLong(appt.start)}</div>
              <div className="text-xs text-slate-600 font-mono">{fmtTime(appt.start)} – {fmtTime(appt.end)}</div>
            </div>
            <div>
              <Label>Where</Label>
              <div className="text-sm font-semibold text-slate-900 mt-1">{room ? room.name : "Unassigned"}</div>
              <div className="text-xs text-slate-600">10625 Scripps Ranch Blvd, Ste D</div>
            </div>
          </div>
          <div>
            <Label>Provider</Label>
            <div className="mt-1.5 flex items-center gap-2.5 p-2 rounded-lg bg-slate-50">
              <ProviderBadge provider={provider} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{provider?.name}</div>
                <div className="text-slate-500 truncate" style={{fontSize: 10}}>{provider?.credentials}</div>
              </div>
            </div>
          </div>
        </div>

        {client && (
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <Label>Client profile</Label>
              <button className="font-medium text-blue-600 hover:text-blue-700" style={{fontSize: 10}}>Open profile →</button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <ClientAvatar client={client} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-slate-900 truncate" style={{letterSpacing: "-0.02em"}}>{client.name}</div>
                <div className="text-xs text-slate-500 truncate flex items-center gap-2 mt-0.5"><Phone className="w-3 h-3" /> {client.phone}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 rounded-lg p-2.5">
                <Label>Program</Label>
                <div className="font-semibold text-slate-900 mt-0.5 leading-tight">{client.program}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <Label>Last session</Label>
                <div className="font-semibold text-slate-900 mt-0.5">{client.lastSession}</div>
              </div>
              {isAdmin && (
                <>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <Label>Credits left</Label>
                    <div className={`font-semibold mt-0.5 ${client.credits < 4 ? "text-rose-600" : "text-slate-900"}`}>{client.credits} sessions</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <Label>Package</Label>
                    <div className="font-semibold text-slate-900 mt-0.5">{client.package}</div>
                  </div>
                </>
              )}
            </div>
            {client.mobility?.length > 0 && (
              <div className="mt-3">
                <Label className="mb-1.5">Mobility priorities</Label>
                <div className="flex flex-wrap gap-1.5">
                  {client.mobility.map(m => <span key={m} className="font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md" style={{fontSize: 10}}>{m}</span>)}
                </div>
              </div>
            )}
            {client.notes && (
              <div className="mt-3 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                <div className="uppercase tracking-widest text-amber-700 font-medium mb-1" style={{fontSize: 10, letterSpacing: "0.1em"}}>Training considerations</div>
                <div className="text-xs text-amber-900 leading-snug">{client.notes}</div>
              </div>
            )}
          </div>
        )}

        {appt.goal && (
          <div className="p-6 border-b border-slate-100">
            <Label>Session goal</Label>
            <div className="text-sm text-slate-900 mt-1.5 leading-relaxed">{appt.goal}</div>
            {appt.notes && (
              <div className="mt-3">
                <Label>Internal notes</Label>
                <div className="text-sm text-slate-700 mt-1.5 leading-relaxed">{appt.notes}</div>
              </div>
            )}
          </div>
        )}

        {isBodPod && (
          <div className="p-6 border-b border-slate-100 bg-cyan-50">
            <div className="uppercase tracking-widest text-cyan-700 font-medium mb-2" style={{fontSize: 10, letterSpacing: "0.1em"}}>BOD POD pre-test checklist</div>
            <div className="space-y-1.5">
              {[
                ["Pre-test instructions sent", true],
                ["Fasted (12hr)", false],
                ["No exercise pre-test", false],
                ["Test completed", false],
                ["Results uploaded", false],
              ].map(([label, done]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                  <span className={done ? "text-slate-900" : "text-slate-500"}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-6 space-y-2">
          <Label className="mb-1">Quick actions</Label>
          {isAssessment ? (
            <>
              <ActionButton icon={Stethoscope} label="Start assessment" primary />
              <ActionButton icon={Activity}    label="Add mobility results" />
              <ActionButton icon={BarChart3}   label="Add BOD POD data" />
              <ActionButton icon={Sparkles}    label="Generate program from assessment" />
            </>
          ) : (
            <>
              <ActionButton icon={FileText} label={appt.status === "completed" ? "View / edit session notes" : "Add session notes"} primary onClick={onAddNotes} />
              <ActionButton icon={Sparkles} label="Generate new program" />
              <ActionButton icon={Edit3}    label="Update current program" />
              <ActionButton icon={Eye}      label="View current program" />
              <ActionButton icon={Target}   label="Assign mobility homework" />
            </>
          )}
        </div>

        {isAdmin && (
          <div className="p-6 border-t border-slate-100 bg-slate-50">
            <Label className="mb-2">Billing (admin only)</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                <Label>Credit usage</Label>
                <div className="font-semibold mt-0.5 text-slate-900">{appt.credits ? "1 session deducted" : "Not credited"}</div>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                <Label>Status</Label>
                <div className="font-semibold mt-0.5 text-emerald-600">Paid in package</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 flex items-center gap-2">
        <button className="flex-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium">Reschedule</button>
        <button className="flex-1 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold">Mark complete</button>
        <button className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"><MoreHorizontal className="w-4 h-4" /></button>
      </div>
    </Drawer>
  );
};

// ============================================================
// SESSION NOTES MODAL
// ============================================================
const NoteField = ({ label, value, onChange, placeholder, rows = 1 }) => (
  <div>
    <Label className="block mb-1.5">{label}</Label>
    {rows > 1 ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition resize-none" />
    ) : (
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition" />
    )}
  </div>
);

const SessionNotesModal = ({ open, appt, onClose, onSave }) => {
  const [notes, setNotes] = useState({
    trained: "", exercises: "", mobility: "", response: "", pain: "",
    progressions: "", homework: "", nextFocus: "", followup: false,
  });
  if (!open || !appt) return null;
  const client = getClient(appt.clientId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col" style={{maxHeight: "90vh"}}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <Label>Session notes</Label>
            <div className="text-xl font-bold text-slate-900" style={{letterSpacing: "-0.02em"}}>{client?.name || "Session"}</div>
            <div className="text-xs text-slate-500 mt-0.5">{fmtDateLong(appt.start)} · {fmtTime(appt.start)}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <NoteField label="What we trained today" value={notes.trained} onChange={v => setNotes({...notes, trained: v})} placeholder="Lower body strength + hip CARs" />
          <NoteField label="Exercises completed" value={notes.exercises} onChange={v => setNotes({...notes, exercises: v})} placeholder="Trap bar DL 4x5, RDL 3x8…" rows={3} />
          <NoteField label="Mobility work" value={notes.mobility} onChange={v => setNotes({...notes, mobility: v})} placeholder="Hip CARs, 90/90, t-spine openers" />
          <div className="grid grid-cols-2 gap-4">
            <NoteField label="Client response" value={notes.response} onChange={v => setNotes({...notes, response: v})} placeholder="Felt strong, RPE 7" />
            <NoteField label="Pain / discomfort" value={notes.pain} onChange={v => setNotes({...notes, pain: v})} placeholder="None" />
          </div>
          <NoteField label="Progressions / regressions" value={notes.progressions} onChange={v => setNotes({...notes, progressions: v})} placeholder="Add 5 lbs to DL next week" />
          <NoteField label="Homework assigned" value={notes.homework} onChange={v => setNotes({...notes, homework: v})} placeholder="Daily hip CARs, 5 reps each direction" />
          <NoteField label="Next session focus" value={notes.nextFocus} onChange={v => setNotes({...notes, nextFocus: v})} placeholder="Upper push + thoracic mobility" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notes.followup} onChange={(e) => setNotes({...notes, followup: e.target.checked})} className="w-4 h-4 rounded text-blue-600" />
            <span className="text-slate-700">Flag for follow-up</span>
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium">Cancel</button>
          <button onClick={() => { onSave(notes); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold">Save notes</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// NEW APPOINTMENT MODAL
// ============================================================
const FormField = ({ label, children }) => (
  <div>
    <Label className="block mb-1.5">{label}</Label>
    {children}
  </div>
);

const NewApptModal = ({ open, onClose, onCreate }) => {
  const [form, setForm] = useState({
    clientId: "", service: "personal_training", providerId: "p1", roomId: "r1",
    date: today.toISOString().split("T")[0], startTime: "09:00", duration: 60,
    goal: "", notes: "", recurring: false, reminder: true,
  });
  if (!open) return null;
  const svc = SERVICES[form.service];
  const c = COLOR[svc.color];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col" style={{maxHeight: "90vh"}}>
        <div className={`px-6 py-5 border-b border-slate-200 ${c.bgSoft} relative overflow-hidden`}>
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white opacity-30" />
          <div className="relative flex items-start justify-between">
            <div>
              <Label>New appointment</Label>
              <div className="text-2xl font-bold text-slate-900" style={{letterSpacing: "-0.02em"}}>Schedule a session</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-5">
          <div>
            <Label className="block mb-2">Service type</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SERVICES).map(([key, s]) => {
                const sc = COLOR[s.color];
                const Icon = s.icon;
                const active = form.service === key;
                return (
                  <button key={key} onClick={() => setForm({...form, service: key, duration: s.duration})}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${active ? `${sc.bg} text-white border-transparent shadow-sm` : `${sc.bgSoft} ${sc.text} ${sc.border} hover:brightness-95`}`}>
                    <Icon className="w-3 h-3" />{s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Client">
              <select value={form.clientId} onChange={(e) => setForm({...form, clientId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 outline-none transition">
                <option value="">Select client…</option>
                {CLIENTS.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                <option value="external">+ External client</option>
              </select>
            </FormField>
            <FormField label="Provider">
              <select value={form.providerId} onChange={(e) => setForm({...form, providerId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 outline-none transition">
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Date">
              <input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 outline-none transition" />
            </FormField>
            <FormField label="Start time">
              <input type="time" value={form.startTime} onChange={(e) => setForm({...form, startTime: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 outline-none transition" />
            </FormField>
            <FormField label="Duration">
              <select value={form.duration} onChange={(e) => setForm({...form, duration: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 outline-none transition">
                {[30, 45, 60, 75, 90, 120].map(m => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Room">
            <div className="grid grid-cols-4 gap-1.5">
              {ROOMS.map(r => {
                const rc = COLOR[r.color];
                const active = form.roomId === r.id;
                return (
                  <button key={r.id} onClick={() => setForm({...form, roomId: r.id})}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition ${active ? `${rc.bg} text-white border-transparent` : `bg-slate-50 ${rc.text} border-slate-200 hover:bg-slate-100`}`}>
                    {r.short}
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField label="Session goal (optional)">
            <input type="text" value={form.goal} onChange={(e) => setForm({...form, goal: e.target.value})} placeholder="e.g. DL day — work up to RPE 7"
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition" />
          </FormField>

          <FormField label="Internal notes (optional)">
            <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={2} placeholder="Anything the provider needs to know…"
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition resize-none" />
          </FormField>

          <div className="flex items-center gap-5 text-sm pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({...form, recurring: e.target.checked})} className="w-4 h-4 rounded text-blue-600" />
              <span className="text-slate-700">Recurring</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.reminder} onChange={(e) => setForm({...form, reminder: e.target.checked})} className="w-4 h-4 rounded text-blue-600" />
              <span className="text-slate-700">Send reminder</span>
            </label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium">Cancel</button>
          <button onClick={() => { onCreate(form); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create appointment
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// FILTERS
// ============================================================
const FilterGroup = ({ label, children }) => (
  <div>
    <Label className="mb-2">{label}</Label>
    <div className="space-y-1">{children}</div>
  </div>
);

const FiltersDrawer = ({ open, onClose, filters, onChange }) => {
  if (!open) return null;
  const toggle = (key, value) => {
    const set = new Set(filters[key]);
    if (set.has(value)) set.delete(value); else set.add(value);
    onChange({ ...filters, [key]: Array.from(set) });
  };
  return (
    <Drawer open={open} onClose={onClose}>
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <Label>Filters</Label>
          <div className="text-xl font-bold text-slate-900" style={{letterSpacing: "-0.02em"}}>Refine view</div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <FilterGroup label="Provider">
          {PROVIDERS.map(p => {
            const c = COLOR[p.color];
            const active = filters.providers.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggle("providers", p.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition w-full ${active ? `${c.bgSoft} ${c.text} ring-1 ring-blue-500` : "hover:bg-slate-50 text-slate-700"}`}>
                <ProviderBadge provider={p} />
                <span className="flex-1 text-left">{p.name}</span>
                {active && <CheckCircle2 className="w-4 h-4" />}
              </button>
            );
          })}
        </FilterGroup>
        <FilterGroup label="Service type">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(SERVICES).map(([key, s]) => {
              const sc = COLOR[s.color];
              const Icon = s.icon;
              const active = filters.services.includes(key);
              return (
                <button key={key} onClick={() => toggle("services", key)} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${active ? `${sc.bg} text-white border-transparent` : `bg-white ${sc.text} ${sc.border} hover:brightness-95`}`}>
                  <Icon className="w-3 h-3" />{s.label}
                </button>
              );
            })}
          </div>
        </FilterGroup>
        <FilterGroup label="Room">
          <div className="grid grid-cols-2 gap-1.5">
            {ROOMS.map(r => {
              const rc = COLOR[r.color];
              const active = filters.rooms.includes(r.id);
              return (
                <button key={r.id} onClick={() => toggle("rooms", r.id)} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${active ? `${rc.bg} text-white border-transparent` : `bg-white text-slate-600 border-slate-200 hover:bg-slate-50`}`}>
                  <span className={`w-2 h-2 rounded-full ${active ? "bg-white" : rc.bg}`} />
                  {r.name}
                </button>
              );
            })}
          </div>
        </FilterGroup>
        <FilterGroup label="Status">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS).slice(0,7).map(([key, s]) => {
              const active = filters.statuses.includes(key);
              return (
                <button key={key} onClick={() => toggle("statuses", key)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? "bg-slate-900 text-white border-transparent" : s.cls}`}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      </div>
      <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
        <button onClick={() => onChange({ providers: [], services: [], rooms: [], statuses: [] })} className="text-xs font-medium text-slate-500 hover:text-slate-700">Clear all</button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold">Done</button>
      </div>
    </Drawer>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function MasterCalendar() {
  const [view, setView] = useState("today");
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState("admin");
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ providers: [], services: [], rooms: [], statuses: [] });
  const [appointments, setAppointments] = useState(APPOINTMENTS);
  const [dayDate, setDayDate] = useState(today);
  const [weekStart, setWeekStart] = useState(thisMonday);

  const visibleAppts = useMemo(() => {
    return appointments.filter(a => {
      if (filters.providers.length && !filters.providers.includes(a.providerId)) return false;
      if (filters.services.length && !filters.services.includes(a.service)) return false;
      if (filters.rooms.length && !filters.rooms.includes(a.roomId)) return false;
      if (filters.statuses.length && !filters.statuses.includes(a.status)) return false;
      if (role === "client") return a.clientId === "c1";
      if (role === "trainer") return a.providerId === "p1";
      if (search) {
        const q = search.toLowerCase();
        const cl = getClient(a.clientId);
        const pr = getProvider(a.providerId);
        const sv = SERVICES[a.service];
        return (
          (cl?.name.toLowerCase().includes(q)) ||
          (pr?.name.toLowerCase().includes(q)) ||
          sv.label.toLowerCase().includes(q) ||
          (a.goal || "").toLowerCase().includes(q) ||
          (a.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [appointments, filters, role, search]);

  const filterCount = filters.providers.length + filters.services.length + filters.rooms.length + filters.statuses.length;

  const dateLabel = useMemo(() => {
    if (view === "today") return "Today at iMS";
    if (view === "week") {
      const end = addDays(weekStart, 6);
      return `${weekStart.toLocaleDateString(undefined,{month:"short",day:"numeric"})} – ${end.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}`;
    }
    if (view === "month") return dayDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return fmtDateLong(dayDate);
  }, [view, dayDate, weekStart]);

  const handleCreate = (form) => {
    const start = new Date(`${form.date}T${form.startTime}`);
    const end = addMin(start, form.duration);
    setAppointments([...appointments, {
      id: `a${Date.now()}`,
      clientId: form.clientId || null,
      providerId: form.providerId, roomId: form.roomId, service: form.service,
      start, end, status: "scheduled", goal: form.goal, notes: form.notes,
      credits: true, alert: null, recurring: form.recurring,
    }]);
  };

  const navDate = (delta) => {
    if (view === "week") setWeekStart(addDays(weekStart, delta * 7));
    else if (view === "month") { const d = new Date(dayDate); d.setMonth(d.getMonth() + delta); setDayDate(d); }
    else setDayDate(addDays(dayDate, delta));
  };

  const goToday = () => {
    setDayDate(today);
    setWeekStart(thisMonday);
    setView("today");
  };

  return (
    <div className="h-screen w-full flex overflow-hidden text-slate-200" style={{ background: "linear-gradient(180deg, #050a14 0%, #0a1020 100%)", fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} role={role} onRoleChange={setRole} />
      <div className="flex-1 flex flex-col min-w-0">
        <HeaderBar
          view={view} onView={setView} dateLabel={dateLabel}
          onPrev={() => navDate(-1)} onNext={() => navDate(1)} onToday={goToday}
          onNewAppt={() => setShowNew(true)} onFilterToggle={() => setShowFilters(true)}
          search={search} onSearch={setSearch} filterCount={filterCount}
        />
        <main className="flex-1 overflow-hidden p-5">
          {role === "client" && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-blue-500 bg-opacity-10 border border-blue-500 border-opacity-20 text-sm text-blue-200 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Client view active — showing only your appointments. Internal notes and other clients are hidden.
            </div>
          )}
          {view === "today" && <TodayDashboard appointments={visibleAppts} alerts={ALERTS} onApptClick={setSelectedAppt} />}
          {view === "week"  && <WeekView      appointments={visibleAppts} weekStart={weekStart} onApptClick={setSelectedAppt} />}
          {view === "day"   && <DayView       appointments={visibleAppts} dayDate={dayDate}   onApptClick={setSelectedAppt} />}
          {view === "staff" && <StaffView     appointments={visibleAppts} dayDate={dayDate}   onApptClick={setSelectedAppt} />}
          {view === "room"  && <RoomView      appointments={visibleAppts} dayDate={dayDate}   onApptClick={setSelectedAppt} />}
          {view === "month" && <MonthView     appointments={visibleAppts} dayDate={dayDate}   onApptClick={setSelectedAppt} />}
        </main>
      </div>
      <AppointmentDrawer appt={selectedAppt} onClose={() => setSelectedAppt(null)} onAddNotes={() => setShowNotes(true)} role={role} />
      <NewApptModal      open={showNew}      onClose={() => setShowNew(false)}    onCreate={handleCreate} />
      <SessionNotesModal open={showNotes}    appt={selectedAppt}                  onClose={() => setShowNotes(false)} onSave={() => {}} />
      <FiltersDrawer     open={showFilters}  onClose={() => setShowFilters(false)} filters={filters} onChange={setFilters} />
    </div>
  );
}
