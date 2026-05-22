import { useState, useMemo, useRef, useEffect } from "react";
import { 
  Shield, 
  Activity, 
  Target, 
  Compass, 
  RotateCw, 
  Sliders, 
  MessageSquare, 
  Send, 
  Loader2, 
  BookOpen, 
  Sparkles, 
  Calculator, 
  TrendingDown,
  Info
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from "recharts";
import Markdown from "react-markdown";

import { ShellType, GUN_PRESETS, SHELL_TYPE_CONFIGS, ChatMessage } from "./types";
import { 
  calculateDeMarreWT, 
  getSlopeMultiplier, 
  getEstimatedVelocityAtRange, 
  solveClassicalDeMarre,
  ClassicalDeMarreInput
} from "./utils";

export default function App() {
  // Preset or custom state
  const [selectedPresetId, setSelectedPresetId] = useState<string>("german_88mm_kwk43");
  
  // Kinetic shell variables
  const [shellType, setShellType] = useState<ShellType>(ShellType.APCBC);
  const [caliber, setCaliber] = useState<number>(88);
  const [mass, setMass] = useState<number>(10.2);
  const [velocity, setVelocity] = useState<number>(1000);
  const [impactAngle, setImpactAngle] = useState<number>(30); // degrees from normal

  // Classical formula solver state
  const [solveFor, setSolveFor] = useState<keyof ClassicalDeMarreInput>("t");
  const [solverV, setSolverV] = useState<number>(800);
  const [solverM, setSolverM] = useState<number>(10);
  const [solverD, setSolverD] = useState<number>(88);
  const [solverT, setSolverT] = useState<number>(150);
  const [solverC, setSolverC] = useState<number>(2000); // Standard homogeneous armor constant
  const [solverResult, setSolverResult] = useState<number>(0);

  // AI Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是你的**德玛尔弹道物理学助手**。我可以为你解答关于弹丸侵彻机理、倾斜被帽效应、历史坦克装甲实验标准、克虏伯渗碳装甲(KC)硬度系数等任何专业学术问题。你也可以点击下方的预设问题快速开始咨询！"
    }
  ]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Active Tab for calculation analysis panel
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<"decay" | "classical">("decay");

  // Handle preset change
  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === "custom") return;
    const preset = GUN_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setShellType(preset.type);
      setCaliber(preset.caliber);
      setMass(preset.mass);
      setVelocity(preset.velocity);
    }
  };

  // If inputs change, mark as custom preset
  const handleVariableChange = (type: "type" | "caliber" | "mass" | "velocity", value: any) => {
    setSelectedPresetId("custom");
    if (type === "type") setShellType(value);
    if (type === "caliber") setCaliber(Number(value));
    if (type === "mass") setMass(Number(value));
    if (type === "velocity") setVelocity(Number(value));
  };

  // Sync solver input when user changes standard variables to make solver fluid
  const handleSyncToSolver = () => {
    setSolverV(velocity);
    setSolverM(mass);
    setSolverD(caliber);
    setSolverT(Math.round(calculatedMuzzlePenZeroDegrees));
    setActiveAnalysisTab("classical");
  };

  // Perform War Thunder relative calculations
  const calculatedMuzzlePenZeroDegrees = useMemo(() => {
    return calculateDeMarreWT(caliber, mass, velocity, shellType);
  }, [caliber, mass, velocity, shellType]);

  const activeSlopeMultiplier = useMemo(() => {
    return getSlopeMultiplier(impactAngle, shellType);
  }, [impactAngle, shellType]);

  const slopedPenetration = useMemo(() => {
    return calculatedMuzzlePenZeroDegrees * activeSlopeMultiplier;
  }, [calculatedMuzzlePenZeroDegrees, activeSlopeMultiplier]);

  // Geometric line of sight thickness
  const lineOfSightThickness = useMemo(() => {
    if (impactAngle >= 90) return Infinity;
    const rad = (impactAngle * Math.PI) / 180;
    const cosVal = Math.cos(rad);
    if (cosVal <= 0.05) return slopedPenetration * 20; // limit extreme scale
    return slopedPenetration / cosVal;
  }, [slopedPenetration, impactAngle]);

  // Generate range decay graph data points
  // Ranges: 10m, 100m, 300m, 500m, 1000m, 1500m, 2000m
  const rangeDecayData = useMemo(() => {
    const ranges = [10, 100, 300, 500, 1000, 1500, 2000];
    return ranges.map(r => {
      const remainingVelocity = getEstimatedVelocityAtRange(velocity, r, shellType);
      const zeroDegPen = calculateDeMarreWT(caliber, mass, remainingVelocity, shellType);
      const anglePen = zeroDegPen * activeSlopeMultiplier;
      return {
        rangeStr: `${r}米`,
        range: r,
        velocity: remainingVelocity,
        pen0: Math.round(zeroDegPen * 10) / 10,
        penSloped: Math.round(anglePen * 10) / 10
      };
    });
  }, [caliber, mass, velocity, shellType, activeSlopeMultiplier]);

  // Calculate classical solver result
  useEffect(() => {
    const res = solveClassicalDeMarre(
      {
        v: solverV,
        m: solverM,
        d: solverD,
        t: solverT,
        c: solverC
      },
      solveFor
    );
    setSolverResult(res);
  }, [solveFor, solverV, solverM, solverD, solverT, solverC]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message to Express API
  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage("");
    setIsAiLoading(true);
    setChatError(null);

    const updatedHistory = [...messages, userMsg];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedHistory.map(m => ({ role: m.role, content: m.content })) })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "获取回复失败");
      }

      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.text
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setChatError(err.message || "连接服务器失败");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Helper quick questions
  const quickQuestions = [
    {
      q: "解释被帽风帽(APCBC)的转正效应",
      label: "🛡️ APCBC 转正效应"
    },
    {
      q: "战雷德玛尔公式与历史实验标准有何差异？",
      label: "📐 战雷模型 v.s 现实标准"
    },
    {
      q: "为什么APCR面对大倾斜角装甲时极易跳弹？",
      label: "💥 APCR 斜角劣势"
    },
    {
      q: "克虏伯渗碳装甲(KC)的De Marre硬度系数是多少？",
      label: "🔩 克虏伯渗透常数 C"
    }
  ];

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans antialiased selection:bg-[#141414] selection:text-[#E4E3E0] p-0 md:p-4">
      
      {/* Upper Brand / Tactical Header */}
      <header className="border-2 border-[#141414] bg-[#DCDAD7] sticky top-0 z-50 px-6 py-4" id="header_main">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#141414] flex items-center justify-center text-[#E4E3E0] font-bold">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-display font-bold tracking-tighter uppercase italic text-[#141414] flex items-center gap-2">
                德玛尔 (De Marre) 穿甲弹道计算仿真系统
                <span className="text-[10px] bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5 font-mono font-medium">
                  v4.5 PRO
                </span>
              </h1>
              <p className="text-xs text-[#141414]/75 font-mono tracking-wider uppercase font-bold">
                TACTICAL BALLISTIC LAB // ANALYSIS RANGE: AP / APCBC / APCR / APDS
              </p>
            </div>
          </div>
          
          <div className="flex gap-6 text-[10px] font-mono text-[#141414] uppercase font-bold">
            <div className="hidden sm:block">SEC_LEVEL: ALPHA-9</div>
            <div className="hidden md:block">LOC: RD-ENGINEERING-LAB</div>
            <div>DATE: 2026.05.22</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 space-y-6" id="calculator_container">
        
        {/* Tactical Overview & Gun Presets Banner */}
        <section className="bg-[#DCDAD7] border-2 border-[#141414] p-4 shadow-none" id="preset_section">
          <div className="flex items-center gap-2 mb-3 text-[#141414] font-mono text-xs uppercase tracking-widest font-black">
            <Target className="h-4 w-4" />
            历史著名火炮/弹药预设载入器 // CHOOSE HISTORICAL GUN DATA
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {GUN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                id={`preset_btn_${preset.id}`}
                onClick={() => handlePresetSelect(preset.id)}
                className={`text-left p-2.5 border transition-all text-xs flex flex-col justify-between h-[100px] ${
                  selectedPresetId === preset.id
                    ? "bg-[#141414] text-[#E4E3E0] border-[#141414]"
                    : "bg-[#E4E3E0] border-[#141414] hover:border-[#141414] text-[#141414] hover:bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`font-mono text-[9px] px-1 rounded font-medium ${
                      selectedPresetId === preset.id ? "bg-[#DCDAD7] text-[#141414]" : "bg-[#141414]/10 text-[#141414]"
                    }`}>
                      {preset.country}
                    </span>
                    <span className={`font-mono text-[9px] ${
                      selectedPresetId === preset.id ? "text-[#E4E3E0]/60" : "text-[#141414]/50"
                    }`}>
                      {preset.era}
                    </span>
                  </div>
                  <div className="font-semibold line-clamp-2 h-8">
                    {preset.name.replace("型", "")}
                  </div>
                </div>
                <div className={`font-mono text-[10px] flex justify-between items-center w-full mt-1 border-t pt-1 ${
                  selectedPresetId === preset.id ? "border-[#E4E3E0]/20 text-[#E4E3E0]" : "border-[#141414]/20 text-[#141414]"
                }`}>
                  <span>{preset.caliber}mm ({preset.type})</span>
                </div>
              </button>
            ))}
            
            <button
              id="preset_btn_custom"
              onClick={() => handlePresetSelect("custom")}
              className={`text-left p-2.5 border transition-all text-xs flex flex-col justify-between h-[100px] ${
                selectedPresetId === "custom"
                  ? "bg-[#141414] text-[#E4E3E0] border-[#141414]"
                  : "bg-transparent border-[#141414] text-[#141414] hover:bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`font-mono text-[9px] px-1 rounded font-medium ${
                    selectedPresetId === "custom" ? "bg-[#DCDAD7] text-[#141414]" : "bg-[#141414]/10 text-[#141414]"
                  }`}>
                    CUSTOM
                  </span>
                  <span className={`font-mono text-[9px] ${
                    selectedPresetId === "custom" ? "text-[#E4E3E0]/60" : "text-[#141414]/50"
                  }`}>
                    可自定义
                  </span>
                </div>
                <div className="font-semibold line-clamp-2 h-8">
                  自定义弹药特性参量
                </div>
              </div>
              <div className={`font-mono text-[10px] flex justify-between items-center w-full mt-1 border-t pt-1 ${
                selectedPresetId === "custom" ? "border-[#E4E3E0]/20 text-[#E4E3E0]" : "border-[#141414]/20 text-[#141414]"
              }`}>
                <span>自由调节参数 sliders</span>
              </div>
            </button>
          </div>
        </section>

        {/* Master Panel Grid: Parameters vs Simulation Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="calculator_workspace">
          
          {/* Left Block: Sliders and Type Presets - 5 cols */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 1. Shell Category Selector card */}
            <div className="bg-[#DCDAD7] border-2 border-[#141414] p-5 space-y-4" id="shell_type_card">
              <h2 className="text-sm font-display font-extrabold uppercase tracking-wider text-[#141414] border-b border-[#141414] pb-2 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#141414]" />
                第一步：选择弹药种类和物理机理
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {(Object.keys(SHELL_TYPE_CONFIGS) as ShellType[]).map((type) => {
                  const conf = SHELL_TYPE_CONFIGS[type];
                  const isSelected = shellType === type;
                  return (
                    <button
                      key={type}
                      id={`type_btn_${type}`}
                      onClick={() => handleVariableChange("type", type)}
                      className={`p-3 border text-left flex flex-col justify-between transition-all group ${
                        isSelected 
                          ? "bg-[#141414] text-[#E4E3E0] border-[#141414]" 
                          : "bg-[#E4E3E0] border-[#141414] text-[#141414] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs tracking-wider font-mono">
                          {type}
                        </span>
                        <div className={`h-2.5 w-2.5 rounded-full border border-[#141414] ${isSelected ? "bg-[#E4E3E0]" : "bg-transparent"}`}></div>
                      </div>
                      <span className={`text-[11px] font-bold ${isSelected ? "text-[#E4E3E0]" : "text-[#141414]"}`}>
                        {conf.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[#141414]/85 bg-[#E4E3E0] border border-[#141414] p-2.5 leading-relaxed font-mono">
                <strong className="text-[#141414] font-black">// 弹法特点：</strong>
                {SHELL_TYPE_CONFIGS[shellType].description}
              </p>
            </div>

            {/* 2. Ballistics Regulators sliders */}
            <div className="bg-[#DCDAD7] border-2 border-[#141414] p-5 space-y-5" id="regulators_card">
              <h2 className="text-sm font-display font-extrabold uppercase tracking-wider text-[#141414] border-b border-[#141414] pb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#141414]" />
                第二步：弹道初速度与质量调节
              </h2>

              {/* Slider for Caliber */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-[#141414] uppercase font-mono font-extrabold flex items-center gap-1.5 opacity-85">
                    <span>//</span> 弹丸弹芯口径 (Diameter)
                  </label>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      value={caliber} 
                      onChange={(e) => handleVariableChange("caliber", Math.max(10, Math.min(300, Number(e.target.value))))}
                      className="w-20 text-right bg-transparent text-[#141414] font-mono text-xs font-bold border border-[#141414] px-1.5 py-1 focus:bg-white focus:outline-none"
                    />
                    <span className="text-xs text-[#141414]/70 font-mono font-bold">mm</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="180" 
                  step="1"
                  value={caliber} 
                  onChange={(e) => handleVariableChange("caliber", e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-[#141414]/70 font-mono">
                  <span>20 mm (小口径)</span>
                  <span>100 mm (中口径)</span>
                  <span>180 mm (超大口径)</span>
                </div>
              </div>

              {/* Slider for Mass */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-[#141414] uppercase font-mono font-extrabold flex items-center gap-1.5 opacity-85">
                    <span>//</span> 穿甲侵彻体质量 (Mass)
                  </label>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      step="0.1"
                      value={mass} 
                      onChange={(e) => handleVariableChange("mass", Math.max(0.1, Math.min(200, Number(e.target.value))))}
                      className="w-20 text-right bg-transparent text-[#141414] font-mono text-xs font-bold border border-[#141414] px-1.5 py-1 focus:bg-white focus:outline-none"
                    />
                    <span className="text-xs text-[#141414]/70 font-mono font-bold">kg</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0.2" 
                  max="50" 
                  step="0.1"
                  value={mass} 
                  onChange={(e) => handleVariableChange("mass", e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-[#141414]/70 font-mono">
                  <span>0.2 kg (针弹芯)</span>
                  <span>25 kg (重型穿甲弹)</span>
                  <span>50 kg (全口径战列舰级)</span>
                </div>
              </div>

              {/* Slider for Muzzle Velocity */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-[#141414] uppercase font-mono font-extrabold flex items-center gap-1.5 opacity-85">
                    <span>//</span> 射击碰击初速 (Speed)
                  </label>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      value={velocity} 
                      onChange={(e) => handleVariableChange("velocity", Math.max(100, Math.min(3000, Number(e.target.value))))}
                      className="w-20 text-right bg-transparent text-[#141414] font-mono text-xs font-bold border border-[#141414] px-1.5 py-1 focus:bg-white focus:outline-none"
                    />
                    <span className="text-xs text-[#141414]/70 font-mono font-bold">m/s</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="300" 
                  max="1800" 
                  step="5"
                  value={velocity} 
                  onChange={(e) => handleVariableChange("velocity", e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-[#141414]/70 font-mono">
                  <span>300 m/s (亚音速)</span>
                  <span>1050 m/s (高速坦克炮)</span>
                  <span>1800 m/s (极限脱壳)</span>
                </div>
              </div>

              {/* Angle setup slider */}
              <div className="bg-[#E4E3E0] border border-[#141414] p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-[#141414] font-mono font-extrabold flex items-center gap-1.5">
                    <span className="font-bold">▲</span> 装甲板受击法线倾角 (Angle)
                  </label>
                  <span className="text-xs font-mono font-bold text-[#141414]">
                    {impactAngle}° <span className="text-[#141414]/60">(与法线夹角)</span>
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="80" 
                  step="1"
                  value={impactAngle} 
                  onChange={(e) => setImpactAngle(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-[#141414]/70 font-mono">
                  <span>0° (完全垂直受击)</span>
                  <span>30° (典型中轴偏角)</span>
                  <span>60° (大倾角跳弹临界)</span>
                  <span>80° (极限倾斜)</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Block: Dynamic penetration display, interactive CSS/SVG armor, range decay / solvers - 7 cols */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* 1. Unified Penetration Output Display & Interactive Armor Visualization */}
            <div className="bg-[#DCDAD7] border-2 border-[#141414] p-5 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-[#141414] pb-3">
                <h2 className="text-sm font-display font-extrabold uppercase tracking-wider text-[#141414] flex items-center gap-2">
                  <Compass className="h-4 w-4 text-[#141414]" />
                  碰击终端防护等效与侵彻深度实时解算结果
                </h2>
                <button
                  onClick={handleSyncToSolver}
                  className="text-[10px] bg-[#141414] hover:bg-[#141414]/90 text-white font-mono py-1 px-2.5 font-bold uppercase border border-[#141414] flex items-center gap-1 transition"
                >
                  <Calculator className="h-3 w-3" /> 同步数据至经典多向求解器
                </button>
              </div>

              {/* Result Metrics panel - Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-[#D4D2CF] p-4 border border-[#141414]">
                <div className="p-2 border-b sm:border-b-0 sm:border-r border-[#141414]/20 text-center md:text-left">
                  <div className="text-[10px] font-mono text-[#141414]/60 uppercase font-bold">垂直接触穿深 (0°)</div>
                  <div className="text-4xl font-mono font-bold italic tracking-tighter text-[#141414] truncate mt-1">
                    {calculatedMuzzlePenZeroDegrees} <span className="text-xs text-[#141414]/70 font-bold font-sans">mm</span>
                  </div>
                  <div className="text-[9px] font-mono text-[#141414]/60 mt-0.5 truncate uppercase font-bold">常温均质装甲(RHA)</div>
                </div>
                
                <div className="p-2 border-b sm:border-b-0 md:border-r border-[#141414]/20 text-center md:text-left">
                  <div className="text-[10px] font-mono text-[#141414]/60 uppercase font-bold font-bold">当前倾角侵彻深度</div>
                  <div className="text-4xl font-mono font-bold italic tracking-tighter text-[#141414] truncate mt-1">
                    {Math.round(slopedPenetration * 10) / 10} <span className="text-xs text-[#141414]/70 font-bold font-sans">mm</span>
                  </div>
                  <div className="text-[9px] font-mono text-[#141414]/60 mt-0.5 truncate uppercase font-bold">
                    侵彻系数: {(activeSlopeMultiplier).toFixed(3)}
                  </div>
                </div>

                <div className="p-2 border-b sm:border-b-0 sm:border-r border-[#141414]/20 text-center md:text-left col-span-1">
                  <div className="text-[10px] font-mono text-[#141414]/60 uppercase font-bold">等效视线穿透厚度</div>
                  <div className="text-4xl font-mono font-bold italic tracking-tighter text-[#141414] truncate mt-1">
                    {lineOfSightThickness === Infinity ? "∞" : `${Math.round(lineOfSightThickness * 10) / 10}`} <span className="text-xs text-[#141414]/70 font-bold font-sans">{lineOfSightThickness === Infinity ? "" : "mm"}</span>
                  </div>
                  <div className="text-[9px] font-mono text-[#141414]/60 mt-0.5 truncate font-bold uppercase">
                    几何视线: {impactAngle === 0 ? "等同垂直" : `${(1 / Math.cos((impactAngle * Math.PI) / 180)).toFixed(2)}x物理`}
                  </div>
                </div>

                <div className="p-2 text-center md:text-left">
                  <div className="text-[10px] font-mono text-[#141414]/60 uppercase font-bold">碰击姿态评价</div>
                  <div className={`text-xs font-bold mt-2 py-1 px-2 text-center uppercase border ${
                    impactAngle >= 70 ? "bg-red-700 text-white border-red-700" :
                    impactAngle >= 55 ? "bg-yellow-600/20 text-yellow-800 border-yellow-700" :
                    "bg-green-700/20 text-green-900 border-green-700"
                  }`}>
                    {impactAngle >= 70 ? "⚠️ 绝对跳弹" : impactAngle >= 55 ? "⚖️ 高难侵彻" : "🎯 有效穿甲"}
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive SVG Armor Plate Simulation */}
              <div className="relative border border-[#141414] bg-[#E4E3E0] overflow-hidden py-4 px-6 flex flex-col items-center">
                <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-mono text-[#141414]/60 uppercase font-bold">
                  <span className="h-2 w-2 rounded-full bg-[#141414]"></span>
                  弹道几何射入示意 (2D平面截面预览)
                </div>

                <div className="w-full flex justify-center items-center h-40">
                  <svg viewBox="0 0 450 160" className="w-full max-w-md h-full">
                    {/* Horizontal centerline bullet vector */}
                    <line 
                      x1="20" 
                      y1="80" 
                      x2="210" 
                      y2="80" 
                      stroke="#141414" 
                      strokeWidth="1.5" 
                      strokeDasharray="3,3" 
                    />

                    {/* Left Projectile schematic representation */}
                    <g transform="translate(110, 80) scale(1)">
                      <path d="M-30,-12 L-5,-12 Q15,-12 25,0 Q15,12 -5,12 L-30,12 Z" fill={shellType === ShellType.APCR ? "#D4D2CF" : "#DCDAD7"} stroke="#141414" strokeWidth="1.5" />
                      {/* Windshield cap for APCBC */}
                      {shellType === ShellType.APCBC && (
                        <path d="M12,-10 L15,-10 L25,0 L15,10 L12,10 Q18,0 12,-10 Z" fill="#D4D2CF" stroke="#141414" strokeWidth="1.5" />
                      )}
                      {/* Hard core for APCR */}
                      {shellType === ShellType.APCR && (
                        <rect x="-10" y="-4" width="22" height="8" rx="0" fill="#141414" stroke="#141414" strokeWidth="1" />
                      )}
                      {/* APDS alloy core */}
                      {shellType === ShellType.APDS && (
                        <path d="M-20,-4 L5,-4 L15,0 L5,4 L-20,4 Z" fill="#141414" stroke="#141414" strokeWidth="1" />
                      )}
                    </g>

                    {/* Rotating Group containing the Armor Plate */}
                    <g transform={`translate(240, 80) rotate(${impactAngle})`}>
                      {/* Physical Armor Block */}
                      <rect 
                        x="-12" 
                        y="-55" 
                        width="24" 
                        height="110" 
                        rx="0" 
                        fill="#DCDAD7" 
                        stroke="#141414" 
                        strokeWidth="2" 
                        fillOpacity="0.9"
                      />
                      
                      {/* Normal Line (Perpendicular line for angle measurement) */}
                      <line 
                        x1="-40" 
                        y1="0" 
                        x2="40" 
                        y2="0" 
                        stroke="#141414" 
                        strokeWidth="1.5" 
                        strokeDasharray="2,2" 
                      />
                      <text x="-50" y="3" fontSize="8" fill="#141414" fontFamily="monospace" textAnchor="middle" fontWeight="bold">装甲法线</text>
                    </g>

                    {/* Incoming Projectile Arrow tip hitting the rotated armor */}
                    <g transform="translate(210, 80)">
                      <polygon points="-8,-6 2,0 -8,6" fill="#141414" />
                    </g>

                    {/* Hit vertex spark representation */}
                    <circle cx="240" cy="80" r="5" fill="#141414" className="opacity-30" />
                    <circle cx="240" cy="80" r="2.5" fill="#141414" />

                    {/* Geometrical angle arc display */}
                    <path 
                      d={`M 190 80 A 50 50 0 0 ${impactAngle > 0 ? 1 : 0} ${240 - 50 * Math.cos((impactAngle * Math.PI) / 180)} ${80 - 50 * Math.sin((impactAngle * Math.PI) / 180)}`} 
                      fill="none" 
                      stroke="#141414" 
                      strokeWidth="1.5" 
                    />
                    <text x="180" y="65" fontSize="11" fill="#141414" fontFamily="monospace" fontWeight="bold">θ = {impactAngle}°</text>
                  </svg>
                </div>

                {/* Legend and geometrical details */}
                <div className="w-full grid grid-cols-2 text-[11px] font-mono border-t border-[#141414] pt-3 gap-4 text-[#141414]/80">
                  <div className="space-y-1">
                    <span className="text-[#141414] font-bold uppercase flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-[#DCDAD7] border border-[#141414]"></span>
                      均质钢板物理厚度 (PHYSICAL)
                    </span>
                    <p className="pl-3.5 leading-tight text-xs font-sans text-[#141414]/80">
                      在此碰击倾角下，{Math.round(slopedPenetration * 10) / 10} 毫米的装甲即可吸收弹丸的全部动能。
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#141414] font-bold uppercase flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 bg-[#141414] border border-[#141414]"></span>
                      视线穿透厚度 (LINE-OF-SIGHT)
                    </span>
                    <p className="pl-3.5 leading-tight text-xs font-sans text-[#141414]/80">
                      弹头在射入轨迹上的行进长度相当于约 {lineOfSightThickness === Infinity ? "有限极限外" : `${Math.round(lineOfSightThickness * 10) / 10}`} 毫米垂直常厚。
                    </p>
                  </div>
                </div>

                {/* Kinetic shell normalization tip alert */}
                <div className="mt-3 text-[11px] font-mono leading-relaxed text-[#141414] bg-[#DCDAD7] border border-[#141414] px-4 py-2.5 w-full flex items-start gap-1.5 justify-center">
                  <Info className="h-4 w-4 text-[#141414] shrink-0 mt-0.5" />
                  <span>
                    {shellType === ShellType.APCR && impactAngle > 30 
                      ? "⚡ 物理极限：此为高速硬芯弹(APCR)，斜面表现奇差。实际常伴随有碎芯或直接滑脱，造成侵彻力剧降。"
                      : shellType === ShellType.APCBC && impactAngle > 30 
                      ? "💡 normalization被帽转正效果：被帽风帽穿甲弹(APCBC)附带钢韧被帽，在接触倾角斜面时，将减小射入角，转正碰击面。"
                      : "🎯 精确解算：各口径对装甲倾度侵彻时会因形变与冲力剪切偏离纯正余弦比定理。德玛尔斜角常数已精确补正。"}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Analysis Box with toggled tabs: Range decay vs Classical multi-solver */}
            <div className="bg-[#DCDAD7] border-2 border-[#141414] p-5 shadow-none flex-1">
              {/* Tab headers */}
              <div className="flex border-b border-[#141414] pb-3 gap-2">
                <button
                  onClick={() => setActiveAnalysisTab("decay")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition ${
                    activeAnalysisTab === "decay"
                      ? "bg-[#141414] text-[#E4E3E0]"
                      : "text-[#141414]/70 hover:bg-[#E4E3E0]/70"
                  }`}
                >
                  <TrendingDown className="h-4 w-4" />
                  弹道射程与威力衰减曲线 (Range Decay Chart)
                </button>
                <button
                  onClick={() => setActiveAnalysisTab("classical")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition ${
                    activeAnalysisTab === "classical"
                      ? "bg-[#141414] text-[#E4E3E0]"
                      : "text-[#141414]/70 hover:bg-[#E4E3E0]/70"
                  }`}
                >
                  <Calculator className="h-4 w-4" />
                  经典德玛尔公式多方向求解器 (Classical Solver)
                </button>
              </div>

              {/* Tab 1 Body: Dynamic Recharts visual decay */}
              {activeAnalysisTab === "decay" && (
                <div className="space-y-4 pt-4 animate-fadeIn" id="chart_tab_content">
                  <div className="text-xs text-[#141414]/90 bg-[#E4E3E0] border border-[#141414] p-2 flex items-center gap-2 font-mono">
                    <span className="h-2 w-2 rounded-full bg-[#141414]"></span>
                    速度衰减估计模型: V(Range) = MuzzleV * e^(-k*R) // 其中 AP 弹型各系数经空阻拟合
                  </div>

                  <div className="h-48 w-full bg-[#E4E3E0] p-3 border border-[#141414]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rangeDecayData}>
                        <defs>
                          <linearGradient id="colorPen0" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#141414" stopOpacity={0.12}/>
                            <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPenSloped" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#b91c1c" stopOpacity={0.12}/>
                            <stop offset="95%" stopColor="#b91c1c" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#141414" strokeOpacity={0.12} vertical={false} />
                        <XAxis dataKey="rangeStr" stroke="#141414" fontSize={10} tickLine={false} />
                        <YAxis stroke="#141414" fontSize={10} tickLine={false} label={{ value: '穿深（mm）', angle: -90, position: 'insideLeft', fill: '#141414', fontSize: 10, fontWeight: 'bold' }} />
                        <ChartTooltip 
                          contentStyle={{ backgroundColor: "#E4E3E0", borderColor: "#141414" }}
                          itemStyle={{ fontSize: "11px", color: "#141414" }}
                          labelStyle={{ fontSize: "11px", color: "#141414", fontWeight: "bold", fontFamily: "monospace" }}
                        />
                        <Area type="monotone" name="0° 垂直穿深 (mm)" dataKey="pen0" stroke="#141414" strokeWidth={2} fillOpacity={1} fill="url(#colorPen0)" />
                        <Area type="monotone" name={`${impactAngle}° 倾角穿深 (mm)`} dataKey="penSloped" stroke="#b91c1c" strokeWidth={2} fillOpacity={1} fill="url(#colorPenSloped)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Tiny compact grid table for reference */}
                  <div className="grid grid-cols-6 text-center bg-[#E4E3E0] border border-[#141414] font-mono text-[10px]">
                    <div className="bg-[#141414] text-[#E4E3E0] py-1 font-bold">距离</div>
                    <div className="bg-[#141414] text-[#E4E3E0] py-1 font-bold">10米</div>
                    <div className="bg-[#141414] text-[#E4E3E0] py-1 font-bold">500米</div>
                    <div className="bg-[#141414] text-[#E4E3E0] py-1 font-bold">1000米</div>
                    <div className="bg-[#141414] text-[#E4E3E0] py-1 font-bold">1500米</div>
                    <div className="bg-[#141414] text-[#E4E3E0] py-1 font-bold">2000米</div>

                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]/70 font-bold">速度 m/s</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414] font-bold">{rangeDecayData.find(d => d.range === 10)?.velocity}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 500)?.velocity}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 1000)?.velocity}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 1500)?.velocity}</div>
                    <div className="py-1 border-t border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 2000)?.velocity}</div>

                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]/70 font-bold">0° (mm)</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414] font-bold">{rangeDecayData.find(d => d.range === 10)?.pen0}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 500)?.pen0}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 1000)?.pen0}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 1500)?.pen0}</div>
                    <div className="py-1 border-t border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 2000)?.pen0}</div>

                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]/70 font-bold">{impactAngle}° (mm)</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#b91c1c] font-black">{rangeDecayData.find(d => d.range === 10)?.penSloped}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 500)?.penSloped}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 1000)?.penSloped}</div>
                    <div className="py-1 border-t border-r border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 1500)?.penSloped}</div>
                    <div className="py-1 border-t border-[#141414]/20 text-[#141414]">{rangeDecayData.find(d => d.range === 2000)?.penSloped}</div>
                  </div>
                </div>
              )}

              {/* Tab 2 Body: Classical solver multi-variables */}
              {activeAnalysisTab === "classical" && (
                <div className="pt-4 space-y-4 animate-fadeIn" id="solver_tab_content">
                  <div className="grid grid-cols-5 gap-0.5 bg-[#E4E3E0] border border-[#141414]">
                    {(["t", "v", "m", "d", "c"] as (keyof ClassicalDeMarreInput)[]).map((key) => (
                      <button
                        key={key}
                        id={`solve_for_btn_${key}`}
                        onClick={() => setSolveFor(key)}
                        className={`py-1.5 font-mono text-[11px] font-bold uppercase transition ${
                          solveFor === key
                            ? "bg-[#141414] text-white"
                            : "text-[#141414]/70 hover:bg-[#DCDAD7]"
                        }`}
                      >
                        求 {key === "t" ? "常厚 T" : key === "v" ? "碰速 V" : key === "m" ? "质量 M" : key === "d" ? "口径 D" : "系数 C"}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 shadow-sm sm:grid-cols-4 gap-3 bg-[#E4E3E0] p-4 border border-[#141414]">
                    {solveFor !== "t" && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#141414] uppercase font-mono font-bold">侵穿板常厚 T (mm)</label>
                        <input
                          type="number"
                          value={solverT}
                          onChange={(e) => setSolverT(Number(e.target.value))}
                          className="w-full bg-transparent border border-[#141414] text-[#141414] py-1 px-2 font-mono text-xs focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}
                    {solveFor !== "v" && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#141414] uppercase font-mono font-bold">碰击速度 V (m/s)</label>
                        <input
                          type="number"
                          value={solverV}
                          onChange={(e) => setSolverV(Number(e.target.value))}
                          className="w-full bg-transparent border border-[#141414] text-[#141414] py-1 px-2 font-mono text-xs focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}
                    {solveFor !== "m" && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#141414] uppercase font-mono font-bold">弹芯重量 M (kg)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={solverM}
                          onChange={(e) => setSolverM(Number(e.target.value))}
                          className="w-full bg-transparent border border-[#141414] text-[#141414] py-1 px-2 font-mono text-xs focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}
                    {solveFor !== "d" && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#141414] uppercase font-mono font-bold">火炮口径 D (mm)</label>
                        <input
                          type="number"
                          value={solverD}
                          onChange={(e) => setSolverD(Number(e.target.value))}
                          className="w-full bg-transparent border border-[#141414] text-[#141414] py-1 px-2 font-mono text-xs focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}
                    {solveFor !== "c" && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#141414] uppercase font-mono font-bold">装甲材质常量 C</label>
                        <input
                          type="number"
                          value={solverC}
                          onChange={(e) => setSolverC(Number(e.target.value))}
                          className="w-full bg-transparent border border-[#141414] text-[#141414] py-1 px-2 font-mono text-xs focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Solver output statement */}
                  <div className="bg-[#E4E3E0] border border-[#141414] p-3 flex flex-col md:flex-row justify-between items-center gap-3">
                    <div className="font-mono text-xs text-[#141414]">
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-[#141414] text-xs">
                        <span>解算公式：</span>
                        {solveFor === "t" && "T = d * [ (V * √m) / (C * d^0.05) ]^(1/0.7)"}
                        {solveFor === "v" && "V = (C * d^0.05 * t^0.7) / √m"}
                        {solveFor === "c" && "C = (V * √m) / (d^0.05 * t^0.7)"}
                        {solveFor === "m" && "m = [ (C * d^0.05 * t^0.7) / V ]^2"}
                        {solveFor === "d" && "d = [ (V * √m) / (C * t^0.7) ]^20"}
                      </div>
                      <p className="text-[10px] text-[#141414]/70 leading-relaxed font-sans">
                        (注：在此经典计算中，毫米级尺寸口径 D、厚度 T 均按公制度量转换为分米分量 dm 代入)
                      </p>
                    </div>
                    
                    <div className="bg-[#141414] text-[#E4E3E0] px-5 py-2 w-full md:w-auto text-center border border-[#141414]">
                      <span className="block text-[8px] text-[#E4E3E0]/70 font-mono uppercase tracking-wider">计算结果 / RESULT</span>
                      <strong className="text-xl font-mono font-black tracking-tight">
                        {solverResult || "参数有误"}
                      </strong>
                      <span className="text-xs ml-1 font-mono uppercase">
                        {solveFor === "t" && "mm"}
                        {solveFor === "v" && "m/s"}
                        {solveFor === "c" && "系数"}
                        {solveFor === "m" && "kg"}
                        {solveFor === "d" && "mm"}
                      </span>
                    </div>
                  </div>

                  {/* Coefficients quick loading presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-[#141414]/80 block">// 装甲硬度常量 C 的历史经验基准 (经典德玛尔系数)</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                      <button 
                        onClick={() => setSolverC(1950)}
                        id="c_preset_1950"
                        className="p-1 px-2 border border-[#141414] bg-[#E4E3E0] text-[10px] text-[#141414] font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition font-mono text-left"
                      >
                        1950 // 法国海军软钢
                      </button>
                      <button 
                        onClick={() => setSolverC(2050)}
                        id="c_preset_2050"
                        className="p-1 px-2 border border-[#141414] bg-[#E4E3E0] text-[10px] text-[#141414] font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition font-mono text-left"
                      >
                        2050 // 二战英制高韧钢 (RHA)
                      </button>
                      <button 
                        onClick={() => setSolverC(2200)}
                        id="c_preset_2200"
                        className="p-1 px-2 border border-[#141414] bg-[#E4E3E0] text-[10px] text-[#141414] font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition font-mono text-left"
                      >
                        2200 // 克虏伯硬化钢 (KC)
                      </button>
                      <button 
                        onClick={() => setSolverC(2350)}
                        id="c_preset_2350"
                        className="p-1 px-2 border border-[#141414] bg-[#E4E3E0] text-[10px] text-[#141414] font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition font-mono text-left"
                      >
                        2350 // 苏联高硬铸钢
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Dynamic Gemini Chat Copilot Assistant - 100% width */}
        <section className="bg-[#DCDAD7] border-2 border-[#141414] overflow-hidden shadow-none" id="gemini_advisor_box">
          
          {/* Section banner */}
          <div className="bg-[#141414] px-5 py-4 flex items-center justify-between text-[#E4E3E0]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#E4E3E0] shrink-0" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider font-mono">
                  军工智能与终点弹道学 AI 顾问 (AI ADVISOR)
                </h2>
                <p className="text-[10px] font-mono text-[#E4E3E0]/70 uppercase tracking-widest leading-none mt-0.5">
                  SYSTEM CORE // REAL-TIME PHYSICAL CO-EXPLORER
                </p>
              </div>
            </div>
            <div className="text-xs font-mono uppercase tracking-wider hidden sm:flex items-center gap-1">
              <BookOpen className="h-4 w-4" /> Balistics Expert Node Online
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:border-t border-[#141414]">
            
            {/* Advisor left pane: Presets & info */}
            <div className="md:col-span-1 p-5 space-y-4 bg-[#E4E3E0] border-r border-[#141414]">
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-[#141414]/80 uppercase font-bold tracking-wider block">// 快捷弹道学课题：</span>
                <p className="text-xs text-[#141414] font-sans leading-tight">
                  点击以下专业微课题，直接要求 AI 顾问依据当前系统的参数，为您提供深度物理侵彻机理解析：
                </p>
              </div>

              <div className="flex flex-col gap-1.5 pt-2">
                {quickQuestions.map((item, idx) => (
                  <button
                    key={idx}
                    id={`quick_q_${idx}`}
                    onClick={() => handleSendMessage(item.q)}
                    disabled={isAiLoading}
                    className="text-left py-2 px-3 bg-[#DCDAD7] hover:bg-[#141414] border border-[#141414] text-xs font-mono font-bold text-[#141414] hover:text-[#E4E3E0] transition disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-[#141414]/30 space-y-1 text-[#141414]/70 text-[10px] font-mono">
                <p className="flex items-center gap-1 font-bold text-[#141414]">[ 德玛尔常识 ]</p>
                <p className="leading-normal">
                  De Marre公式最早由法国人在19世纪末期归纳，用以评估厚装甲在受到标准钢弹击打时的结构破裂速度。但在动力穿甲弹的时代它依然是无与伦比的相对性判据。
                </p>
              </div>
            </div>

            {/* Advisor right pane: Active dialog box */}
            <div className="md:col-span-3 flex flex-col h-[400px] bg-[#E4E3E0]">
              
              {/* Message block area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" id="chat_history_container">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-[85%] ${
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    {/* Avatar preview */}
                    <div className="h-8 w-8 shrink-0 flex items-center justify-center font-mono text-xs font-bold border border-[#141414] bg-[#141414] text-[#E4E3E0]">
                      {msg.role === "user" ? "USER" : "AI"}
                    </div>

                    {/* Speech element card */}
                    <div className={`p-3.5 text-xs text-[#141414] border border-[#141414] ${
                      msg.role === "user"
                        ? "bg-[#DCDAD7] shadow-none"
                        : "bg-white font-sans leading-relaxed text-[#141414]"
                    }`}>
                      <div className="markdown-body">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    </div>
                  </div>
                ))}

                {isAiLoading && (
                  <div className="flex gap-3 mr-auto items-center">
                    <div className="h-8 w-8 bg-[#DCDAD7] border border-[#141414] shrink-0 flex items-center justify-center text-[#141414] font-mono text-xs">
                      AI
                    </div>
                    <div className="bg-white border border-[#141414] p-3 text-xs text-[#141414]/80 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#141414]" />
                      正在检索弹道物理学模型并生成诊断回复...
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="bg-[#b91c1c]/10 border border-[#b91c1c]/30 p-3 text-xs text-[#b91c1c] font-mono">
                    <strong>接口错误提示：</strong> {chatError}
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat action box footer form */}
              <div className="p-3 bg-[#DCDAD7] border-t border-[#141414] flex gap-2">
                <input
                  type="text"
                  placeholder="向 AI 弹道学顾问输入任何专业咨询课题...（例如：二战中各国的穿透定义有何差异？）"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={isAiLoading}
                  className="flex-1 bg-white border border-[#141414] px-3 py-2 text-xs font-sans text-black focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-60"
                />
                
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isAiLoading || !inputMessage.trim()}
                  className="bg-[#141414] hover:bg-[#141414]/90 text-white font-mono font-bold uppercase px-5 py-2 text-xs flex items-center gap-1.5 transition shrink-0 disabled:opacity-50"
                >
                  {isAiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      SUBMIT
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>

        </section>

      </main>

      <footer className="border-t border-[#141414] bg-[#E4E3E0] py-6 px-4 text-center text-xs text-[#141414]/70 font-mono tracking-wide" id="global_footer">
        <p>DE MARRE PHYSICAL BALLISTIC COMPUTATION SYSTEM // TECHNICAL DATA ENGINE</p>
        <p className="mt-1 text-[10px] text-[#141414]/50">
          基于被帽与次口径钨芯侵彻动力学方程模型 · 2026 战术工程实验室
        </p>
      </footer>

    </div>
  );
}
