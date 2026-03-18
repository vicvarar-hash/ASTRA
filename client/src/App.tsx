import { useState, useEffect } from "react";
import { Play, Database, ShieldAlert, Activity, GitCommitHorizontal, Hexagon, Terminal, Key, Box, Network, Info, Download, X, BrainCircuit, CheckCircle2, XCircle, ChevronUp, ChevronDown, PlusCircle, MinusCircle } from "lucide-react";

export default function App() {
  const [datasets, setDatasets] = useState({ count: 0 });
  const [complexity, setComplexity] = useState(1);
  const [datasetType, setDatasetType] = useState("ASTRA");
  const [sampleSize, setSampleSize] = useState(10);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [results, setResults] = useState<any>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [discoveringPolicy, setDiscoveringPolicy] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedTrace, setSelectedTrace] = useState<any>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [semsimThreshold, setSemsimThreshold] = useState(0.8);
  const [lastExactTasks, setLastExactTasks] = useState<string[] | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [addedRules, setAddedRules] = useState<string[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [lastRunConfig, setLastRunConfig] = useState<{ complexity: number, datasetType: string, sampleSize: number } | null>(null);
  const [policyRules, setPolicyRules] = useState(JSON.stringify({
    "search_issues": ["github_official.search_issues"],
    "get_issue": ["github_official.get_issue", "github_official.read_issue"]
  }, null, 2));

  useEffect(() => {
    fetch(`http://localhost:8000/datasets?complexity=${complexity}&type=${datasetType}`)
      .then((res) => res.json())
      .then((data) => setDatasets(data))
      .catch(console.error);
  }, [complexity, datasetType]);

  const runExperiment = async (usePrevious = false) => {
    setLoading(true);
    setResults(null);
    setLiveLogs([]);
    setAiExplanation(null);
    const exactTasks = usePrevious && lastExactTasks ? lastExactTasks : null;
    const currentComplexity = usePrevious && lastRunConfig ? lastRunConfig.complexity : complexity;
    const currentDatasetType = usePrevious && lastRunConfig ? lastRunConfig.datasetType : datasetType;
    const currentSampleSize = usePrevious && lastRunConfig ? lastRunConfig.sampleSize : sampleSize;

    try {
      const res = await fetch("http://localhost:8000/experiment/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          complexity: currentComplexity, 
          dataset_type: currentDatasetType,
          provider: provider,
          api_key: apiKey || null,
          sample_size: currentSampleSize,
          semsim_threshold: semsimThreshold,
          exact_tasks: exactTasks,
          policy_rules: JSON.parse(policyRules)
        }),
      });
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) {
                const chunk = JSON.parse(line);
                if (chunk.type === "trace") {
                  setLiveLogs(prev => [...prev, chunk.data]);
                } else if (chunk.type === "finish") {
                  setResults({
                    metrics: chunk.metrics,
                    raw_results: chunk.raw_results
                  });
                  setLastExactTasks(chunk.raw_results.map((r: any) => `${r.task}::${r.groundtruth_tag}`));
                  setTurnCount(prev => prev + 1);
                  if (!usePrevious) {
                    setLastRunConfig({ complexity, datasetType, sampleSize });
                  }
                }
              }
            }
          }
          if (done) break;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const explainResults = async () => {
    if (!results) return;
    setIsExplaining(true);
    try {
      const res = await fetch("http://localhost:8000/experiment/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          provider: provider,
          api_key: apiKey || null,
          metrics: results.metrics
        }),
      });
      const data = await res.json();
      setAiExplanation(data.explanation);
    } catch (e) {
      console.error(e);
      setAiExplanation("Failed to generate explanation. Check API key and network.");
    }
    setIsExplaining(false);
  };

  const renderFancyMath = (latex: string) => {
    const fracMatch = latex.match(/\\frac\{([^}]+)\}\{([^}]+)\}/);
    if (fracMatch) {
      const parts = latex.split(/\\frac\{[^}]+\}\{[^}]+\}/);
      const prefixRaw = parts[0].replace(/\\text\{([^}]+)\}/g, '$1').replace(/=/g, '').replace(/\*\*/g, '').trim();
      const num = fracMatch[1].replace(/\\text\{([^}]+)\}/g, '$1').replace(/\*\*/g, '');
      const den = fracMatch[2].replace(/\\text\{([^}]+)\}/g, '$1').replace(/\*\*/g, '');
      
      return (
        <div className="flex items-center gap-6 font-mono text-lg text-[#E2E8F0] tracking-wide bg-[#1A2035]/20 px-8 py-6 rounded-2xl border border-[#334155]/30 shadow-lg">
          {prefixRaw && (
            <>
              <span className="font-semibold text-[#818CF8] bg-[#4F46E5]/10 px-3 py-1.5 rounded border border-[#4F46E5]/20 uppercase tracking-widest text-xs shadow-inner">
                {prefixRaw}
              </span>
              <span className="text-[#64748B] font-light">=</span>
            </>
          )}
          <div className="inline-flex flex-col items-center align-middle font-sans font-semibold">
            <span className="px-5 border-b-2 border-[#4F46E5] text-[#E2E8F0] text-[15px] leading-tight pb-1.5">{num}</span>
            <span className="px-5 text-[#94A3B8] text-[13px] pt-1.5">{den}</span>
          </div>
        </div>
      );
    }
    // Fallback cleanup
    return (
      <span className="font-mono text-[11px] text-[#818CF8] bg-[#06080F] px-2.5 py-1.5 rounded border border-[#1E293B] shadow-inner">
        {latex.replace(/\\text\{([^}]+)\}/g, '$1').replace(/\\/g, '').replace(/\{/g, '').replace(/\}/g, '').replace(/\*\*/g, '')}
      </span>
    );
  };

  const renderMarkdownText = (text: string) => { 
    if (!text) return null;
    
    // Split into sections based on ## headers to group into cards
    const sections: { title: string, content: string[] }[] = [];
    let currentSection: { title: string, content: string[] } | null = null;
    const lines = text.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        if (currentSection) sections.push(currentSection);
        currentSection = { title: trimmed.replace(/^##\s*/, ''), content: [] };
      } else if (trimmed.startsWith('# ')) {
        // H1 becomes a global title above cards
        if (currentSection) sections.push(currentSection);
        currentSection = { title: `TOPMOST_H1:${trimmed.replace(/^#\s*/, '')}`, content: [] };
      } else {
        if (!currentSection) currentSection = { title: 'Analysis briefing', content: [] };
        currentSection.content.push(line);
      }
    });
    if (currentSection) sections.push(currentSection);

    // Dynamic Injection: Prepare Operational Theater PROSE
    let policyCount = 0;
    try {
      const p = JSON.parse(policyRules);
      Object.keys(p).forEach(k => { if (Array.isArray(p[k])) policyCount += p[k].length; });
    } catch(e) {}

    const theaterProse = `This diagnostic assessment was conducted within the **${datasetType}** operational theater, utilizing a high-fidelity validation split consisting of **${sampleSize}** distinct agent tool-use cases. The cognitive reasoning layer was powered by **${provider.toUpperCase()}**, operating under a semantic vector alignment threshold of **${semsimThreshold}**. The current security posture is governed by a TS-PHOL policy graph containing **${policyCount}** active capability mappings, captured at operational execution **Turn ${turnCount}**.`;

    const theaterSection = {
      title: "Operational Theater & Evaluation Logic",
      content: [theaterProse]
    };

    // Find the introduction section to insert after it
    let introIdx = sections.findIndex(s => s.title.toLowerCase().includes('introduction'));
    if (introIdx !== -1) {
      sections.splice(introIdx + 1, 0, theaterSection);
    } else {
      // Fallback: insert at index 1 (usually after H1)
      sections.splice(1, 0, theaterSection);
    }

    return (
      <div className="space-y-10 py-6 px-4">
        {sections.map((section, sidx) => {
          const isH1 = section.title.startsWith('TOPMOST_H1:');
          const displayTitle = isH1 ? section.title.replace('TOPMOST_H1:', '') : section.title;

          return (
            <div 
              key={sidx} 
              className={`animate-in fade-in slide-in-from-bottom-8 duration-700 delay-[${sidx * 150}ms] fill-mode-both`}
            >
              {isH1 ? (
                <div className="mb-12 border-b border-[#1E293B] pb-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-[#4F46E5] opacity-[0.05] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                   <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#E2E8F0] via-[#818CF8] to-[#4F46E5] tracking-tight mb-3">
                     {parseInlineMarkdown(displayTitle)}
                   </h1>
                   <div className="flex items-center gap-3">
                      <div className="h-1 w-12 bg-gradient-to-r from-[#4F46E5] to-transparent rounded-full" />
                      <span className="text-[10px] uppercase tracking-[0.4em] text-[#64748B] font-bold">Confidential Intelligence Briefing</span>
                   </div>
                </div>
              ) : (
                <div className="bg-[#0A0D17]/40 border border-[#1E293B]/60 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                  <div className="px-8 py-5 border-b border-[#1E293B]/40 bg-gradient-to-r from-[#101524] to-transparent flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-3">
                      <div className="w-1.5 h-4 bg-[#4F46E5] rounded-full shadow-[0_0_10px_#4F46E5]/40" />
                      {parseInlineMarkdown(displayTitle)}
                    </h2>
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1A2035]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1A2035]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1A2035]" />
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    {section.content.map((line, lidx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return <div key={lidx} className="h-2" />;

                      // Internal Headers
                      if (trimmed.startsWith('### ')) {
                        return <h3 key={lidx} className="text-[11px] uppercase tracking-[0.25em] font-black text-[#818CF8] mt-4 mb-2 flex items-center gap-4">
                          {parseInlineMarkdown(trimmed.replace(/^###\s*/, ''))}
                          <div className="flex-1 h-[1px] bg-gradient-to-r from-[#1E293B] to-transparent" />
                        </h3>;
                      }
                      
                      if (trimmed.startsWith('#### ')) {
                        return <h4 key={lidx} className="text-[13px] font-bold text-[#E2E8F0] mt-6 mb-3 flex items-center gap-3">
                          <div className="w-1.5 h-1.5 bg-[#4F46E5] rounded-full" />
                          {parseInlineMarkdown(trimmed.replace(/^####\s*/, ''))}
                        </h4>;
                      }

                      // Specialized Bullet points
                      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                        const content = trimmed.replace(/^[-*]\s*/, '');
                        const isDefinition = content.toLowerCase().includes('definition:');
                        const isInsight = content.toLowerCase().includes('insight:');
                        const isCalculation = content.toLowerCase().includes('calculation:') || content.includes('=');

                        let accentColor = "from-[#4F46E5]/20 to-transparent";
                        let ringColor = "ring-[#4F46E5]";

                        if (isDefinition) { accentColor = "from-[#818CF8]/10 to-transparent"; ringColor = "ring-[#818CF8]"; }
                        if (isInsight) { accentColor = "from-[#10B981]/10 to-transparent"; ringColor = "ring-[#10B981]"; }
                        if (isCalculation) { accentColor = "from-[#F59E0B]/10 to-transparent"; ringColor = "ring-[#F59E0B]"; }

                        return (
                          <div key={lidx} className={`relative p-6 rounded-2xl border border-[#1E293B]/50 bg-gradient-to-br ${accentColor} hover:border-[#4F46E5]/30 transition-all group shadow-sm`}>
                            <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#06080F] ring-2 ${ringColor} flex items-center justify-center`}>
                               <div className="w-1 h-1 rounded-full bg-current opacity-80" />
                            </div>
                            <div className="text-[#AAB0C3] text-[14px] leading-relaxed pl-5 font-medium tracking-tight">
                               {parseInlineMarkdown(content)}
                            </div>
                          </div>
                        );
                      }

                      // LaTeX math blocks / formulas
                      if (trimmed.includes('\\frac') || trimmed.includes('\\text{') || (trimmed.startsWith('\\(') && trimmed.endsWith('\\)'))) {
                        const math = trimmed.replace(/^\\\(/, '').replace(/\\\)$/, '').trim();
                        return (
                          <div key={lidx} className="my-10 bg-[#06080F]/80 p-10 rounded-[2.5rem] border border-[#1E293B] overflow-hidden relative group">
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[2px] bg-gradient-to-r from-transparent via-[#4F46E5] to-transparent opacity-50" />
                             <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase tracking-[0.5em] text-[#64748B] font-bold mb-10 opacity-60">Logic Verification formula</span>
                                <div className="transform transition-all group-hover:scale-105 duration-700">
                                   {renderFancyMath(math)}
                                </div>
                             </div>
                          </div>
                        );
                      }

                      return <p key={lidx} className="text-[#94A3B8] text-[15px] leading-relaxed opacity-90">{parseInlineMarkdown(trimmed)}</p>;
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const parseInlineMarkdown = (text: string) => {
    // Handle bold **text**
    let parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-[#E2E8F0] font-bold">{part.slice(2, -2)}</strong>;
      }
      // Handle italic *text*
      const italicParts = part.split(/(\*.*?\*)/g);
      return italicParts.map((subPart, j) => {
        if (subPart.startsWith('*') && subPart.endsWith('*')) {
          return <i key={`${i}-${j}`} className="text-[#94A3B8] opacity-90">{subPart.slice(1, -1)}</i>;
        }
        return <span key={`${i}-${j}`}>{subPart}</span>;
      });
    });
  };

  const handleQuickAddRule = (toolName: string, targetCapability: string) => {
    try {
      const currentPolicy = JSON.parse(policyRules);
      if (!currentPolicy[targetCapability]) {
        currentPolicy[targetCapability] = [];
      }
      if (!currentPolicy[targetCapability].includes(toolName)) {
        currentPolicy[targetCapability].push(toolName);
        setPolicyRules(JSON.stringify(currentPolicy, null, 2));
        setAddedRules(prev => [...prev, toolName]);
      }
    } catch (e) {
      console.error("Failed to parse policy rules for quick add", e);
    }
  };

  const handleQuickRemoveRule = (toolName: string, targetCapability: string) => {
    try {
      const currentPolicy = JSON.parse(policyRules);
      if (currentPolicy[targetCapability]) {
        currentPolicy[targetCapability] = currentPolicy[targetCapability].filter((t: string) => t !== toolName);
        setPolicyRules(JSON.stringify(currentPolicy, null, 2));
        setAddedRules(prev => prev.filter(r => r !== toolName));
      }
    } catch (e) {
      console.error("Failed to parse policy rules for quick remove", e);
    }
  };

  const renderValidationTrace = (traceStr: string, requiredCapabilities: string[]) => {
    if (!traceStr) return <span className="text-[#94A3B8]">No logic trace captured.</span>;
    // We parse the trace to find failed tools so we can inject a quick add button.
    const lines = traceStr.split('\n');
    
    // Check if tool is already in policy
    let policyObj: any = {};
    try { policyObj = JSON.parse(policyRules); } catch(e) {}

    return (
      <div className="font-mono text-xs whitespace-pre-wrap space-y-3">
        {lines.map((line, idx) => {
          const isFailure = line.includes("[\u2717]") || line.includes("[X]") || (line.includes("[") && line.includes("]") && line.toLowerCase().includes("fail"));
          const isSuccess = line.includes("[\u2713]") || line.includes("[V]") || line.toLowerCase().includes("success");

          if (isFailure) {
            const match = line.match(/'([^']+)'/);
            const toolName = match ? match[1] : null;
            
            return (
              <div key={idx} className="flex flex-col gap-3 p-4 bg-[#EF4444]/5 border border-[#EF4444]/30 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] group transition-all hover:bg-[#EF4444]/10">
                <div className="flex items-start gap-3 text-[#EF4444]">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{line}</span>
                </div>
                {toolName && requiredCapabilities && requiredCapabilities.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-7">
                    {requiredCapabilities.map((cap) => {
                      const isAdded = addedRules.includes(`${toolName}:${cap}`) || (policyObj[cap] && policyObj[cap].includes(toolName));
                      return (
                        <button 
                          key={cap}
                          disabled={!!isAdded}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleQuickAddRule(toolName, cap);
                            setAddedRules(prev => [...prev, `${toolName}:${cap}`]);
                          }}
                          className={`px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold flex items-center gap-2 transition-all border shadow-lg ${isAdded ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/50 cursor-default' : 'bg-[#0F172A] hover:bg-[#1E293B] border-[#1E293B] text-[#818CF8] hover:border-[#4F46E5] hover:shadow-[0_0_15px_rgba(79,70,229,0.3)]'}`}
                        >
                          {isAdded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />} 
                          {isAdded ? `Added to ${cap}` : `+ Add to ${cap}`}
                        </button>
                      );
                    })}
                    {requiredCapabilities.length > 1 && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          requiredCapabilities.forEach(cap => {
                            if (!(policyObj[cap] && policyObj[cap].includes(toolName))) {
                              handleQuickAddRule(toolName, cap);
                              setAddedRules(prev => [...prev, `${toolName}:${cap}`]);
                            }
                          });
                        }}
                        className="px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold flex items-center gap-2 transition-all border border-[#4F46E5]/40 bg-[#4F46E5]/10 text-[#818CF8] hover:bg-[#4F46E5]/30 shadow-md"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Add to All Required
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          } else if (isSuccess) {
            const toolMatch = line.match(/'([^']+)'/);
            const capMatch = line.match(/capability '([^']+)'/);
            const toolName = toolMatch ? toolMatch[1] : null;
            const capability = capMatch ? capMatch[1] : null;

            return (
              <div key={idx} className="flex flex-col gap-3 p-4 bg-[#10B981]/5 border border-[#10B981]/30 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
                <div className="flex items-start gap-3 text-[#10B981]">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{line}</span>
                </div>
                {toolName && capability && (
                  <div className="flex pl-7">
                    <button 
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         handleQuickRemoveRule(toolName, capability);
                         setAddedRules(prev => prev.filter(r => r !== `${toolName}:${capability}`));
                       }}
                       className="bg-[#0F172A] hover:bg-[#EF4444]/10 border border-[#1E293B] hover:border-[#EF4444]/50 text-[#EF4444] px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold flex items-center gap-2 transition-all shadow-md group"
                    >
                      <MinusCircle className="w-3.5 h-3.5 transition-transform group-hover:scale-110" /> - Remove Rule from {capability}
                    </button>
                  </div>
                )}
              </div>
            );
          }
          return null; 
        })}
      </div>
    );
  };

  const downloadExport = () => {
    try {
      if (!results) return;
      const blob = new Blob([JSON.stringify({
        metadata: {
          complexity,
          dataset_type: datasetType,
          provider,
          sample_size: sampleSize,
          semsim_threshold: semsimThreshold,
          policy_rules: JSON.parse(policyRules)
        },
        metrics: results.metrics,
        raw_traces: results.raw_results
      }, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tsphol_results.json`;
      a.click();
    } catch (e) {
      console.error("Export failed", e);
    }
  };


  const loadPolicy = async () => {
    setDiscoveringPolicy(true);
    try {
      const res = await fetch("http://localhost:8000/policy/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          complexity, 
          dataset_type: datasetType
        }),
      });
      const data = await res.json();
      setPolicyRules(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(e);
    }
    setDiscoveringPolicy(false);
  };

  return (
    <div className="min-h-screen bg-[#06080F] text-[#8B9BB4] font-sans selection:bg-[#4F46E5] selection:text-white">
      
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#1A2035] bg-[#0A0D17] flex items-center justify-between px-6 z-50 relative">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-[#4F46E5]/20 border border-[#4F46E5]/50 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-[#818CF8]" />
          </div>
          <h1 className="text-[#E2E8F0] font-semibold tracking-wide text-sm flex items-center gap-2">
            TS-PHOL Strategy Workbench
            <span className="text-[#4B5563] font-normal text-xs ml-2">v2.4.1</span>
          </h1>
          <div className="flex items-center gap-1.5 ml-4 px-2 py-1 bg-[#101524] border border-[#1A2035] rounded-md">
            <Hexagon className="w-3 h-3 text-[#64748B]" />
            <span className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium">Probabilistic Logic</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`text-xs tracking-wider uppercase font-semibold transition-colors ${activeTab === 'dashboard' ? 'text-[#4F46E5]' : 'text-[#64748B] hover:text-[#E2E8F0]'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('policy')}
            className={`text-xs tracking-wider uppercase font-semibold transition-colors ${activeTab === 'policy' ? 'text-[#10B981]' : 'text-[#64748B] hover:text-[#E2E8F0]'}`}
          >
            Policy Editor
          </button>

          <div className="flex items-center gap-2 border-l border-[#1A2035] pl-6">
            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></div>
            <span className="text-[10px] tracking-widest uppercase font-bold text-[#E2E8F0]">Operational</span>
          </div>
          <div className="text-[10px] tracking-widest uppercase text-[#64748B]">
            Turn <span className="text-[#E2E8F0] font-medium ml-1">{turnCount}</span>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6">
        
        {/* Left Column: Configuration Desk */}
        <div className="col-span-12 xl:col-span-3 space-y-6">
          
          {/* Card: Scenario Config */}
          <div className="bg-[#0A0D17] border border-[#1A2035] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1A2035] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#4F46E5]" />
              <h2 className="text-xs uppercase tracking-widest font-semibold text-[#E2E8F0]">Scenario Configure</h2>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium">Dataset Source</label>
                <select
                  className="w-full bg-[#101524] border border-[#1E293B] rounded-lg p-2.5 text-xs text-[#E2E8F0] outline-none focus:border-[#4F46E5] transition-colors appearance-none"
                  value={datasetType}
                  onChange={(e) => setDatasetType(e.target.value)}
                >
                  <option value="ASTRA">ASTRA (Synthetic Combat)</option>
                  <option value="TOUCAN">TOUCAN (Public Benchmark)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium">Complexity Strategy</label>
                <select
                  className="w-full bg-[#101524] border border-[#1E293B] rounded-lg p-2.5 text-xs text-[#E2E8F0] outline-none focus:border-[#4F46E5] transition-colors appearance-none"
                  value={complexity}
                  onChange={(e) => setComplexity(Number(e.target.value))}
                >
                  <option value={1}>1 Tool (Simple Action)</option>
                  <option value={2}>2 Tools (Moderate Workflow)</option>
                  <option value={3}>3 Tools (Complex Trajectory)</option>
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium">Evaluation Sample Size</label>
                  <span className="text-xs font-mono text-[#E2E8F0] bg-[#1A2035] px-2 py-0.5 rounded">{sampleSize}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max={Math.max(1, datasets.count)} 
                  value={sampleSize} 
                  onChange={(e) => setSampleSize(Number(e.target.value))}
                  className="w-full accent-[#4F46E5] h-1.5 bg-[#1A2035] rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium">SemSimM Threshold</label>
                  <span className="text-xs font-mono text-[#E2E8F0] bg-[#1A2035] px-2 py-0.5 rounded">{semsimThreshold.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.0" 
                  max="1.0" 
                  step="0.05"
                  value={semsimThreshold} 
                  onChange={(e) => setSemsimThreshold(parseFloat(e.target.value))}
                  className="w-full accent-[#10B981] h-1.5 bg-[#1A2035] rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-[#1A2035] space-y-3">
                <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium block">TS-PHOL Policy Generation</label>
                <p className="text-[10px] text-[#64748B] leading-relaxed mb-3">
                  Loads a comprehensive policy graph pre-computed via massive offline batch analysis of the dataset's ground truth signals.
                </p>
                <button
                  onClick={loadPolicy}
                  disabled={discoveringPolicy || datasets.count === 0}
                  className="w-full flex items-center justify-center gap-2 bg-[#1A2035] hover:bg-[#334155] text-[#E2E8F0] border border-[#334155] px-3 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {discoveringPolicy ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#E2E8F0]/30 border-t-[#E2E8F0] rounded-full animate-spin" />
                  ) : (
                    <Network className="w-3.5 h-3.5" />
                  )}
                  <span className="text-xs font-semibold tracking-wide">
                    Load Pre-computed Graph
                  </span>
                </button>
              </div>

              <div className="pt-2 border-t border-[#1A2035] flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-[#64748B]">Total Available Signals</span>
                <span className="font-mono text-sm text-[#E2E8F0]">{datasets.count}</span>
              </div>
            </div>
          </div>

          {/* Card: ML Layer Config */}
          <div className="bg-[#0A0D17] border border-[#1A2035] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1A2035] flex items-center gap-2">
              <Network className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-xs uppercase tracking-widest font-semibold text-[#E2E8F0]">ML Layer Inference</h2>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium">Inference Engine</label>
                <select
                  className="w-full bg-[#101524] border border-[#1E293B] rounded-lg p-2.5 text-xs text-[#E2E8F0] outline-none focus:border-[#10B981] transition-colors appearance-none"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  <option value="openai">Tactical Engine (OpenAI)</option>
                  <option value="gemini">Strategic Engine (Gemini)</option>
                  <option value="anthropic">Analysis Engine (Anthropic)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium flex items-center gap-2">
                  <Key className="w-3 h-3" /> API Key Override
                </label>
                <input
                  type="password"
                  placeholder="sk-..."
                  className="w-full bg-[#101524] border border-[#1E293B] rounded-lg p-2.5 text-xs text-[#E2E8F0] outline-none focus:border-[#10B981] transition-colors font-mono placeholder:text-[#334155]"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Execution Theater */}
        <div className="col-span-12 xl:col-span-9 space-y-6">
          
          {activeTab === 'dashboard' ? (
            <>
              {/* Top Banner Control */}
              <div className="bg-[#0A0D17] border border-[#1A2035] rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#4F46E5] opacity-[0.03] rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
                
                <div className="flex-1 relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-4 h-4 text-[#818CF8]" />
                    <h2 className="text-sm font-semibold text-[#E2E8F0]">Operational Theater & Evaluation Logic</h2>
                  </div>
                  <p className="text-xs text-[#64748B] max-w-3xl leading-relaxed mb-4">
                    This workbench evaluates authorization frameworks for AI agents. It processes a random sample of tasks from the selected dataset and checks if the AI agent requests the correct tools. <br/><br/>
                    <strong>Metrics:</strong> <span className="text-[#E2E8F0]">True Positive (TP)</span> = Matcher Allows & Ground Truth Correct. <span className="text-[#E2E8F0]">False Positive (FP)</span> = Matcher Allows & Ground Truth Wrong/Null (Over-scoping). <span className="text-[#E2E8F0]">False Negative (FN)</span> = Matcher Denies & Ground Truth Correct (Under-scoping).
                  </p>
                </div>
    
                <div className="flex items-center gap-4 relative z-10">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1">Status</span>
                    <div className="flex items-center gap-2 bg-[#101524] border border-[#1A2035] px-3 py-1.5 rounded-md">
                      <div className={`w-2 h-2 rounded-full ${loading ? "bg-[#F59E0B] animate-pulse" : "bg-[#10B981]"}`}></div>
                      <span className="text-xs font-medium text-[#E2E8F0]">
                        {loading ? (lastExactTasks && loading ? "Synchronizing Deterministic Re-run..." : "Awaiting Intelligence Run") : "Ready For Inference"}
                      </span>
                    </div>
                    {lastExactTasks && loading && (
                      <span className="text-[9px] text-[#F59E0B] mt-1 font-mono">
                        LOCKED: {lastRunConfig?.datasetType} v{lastRunConfig?.complexity} (Sample: {lastRunConfig?.sampleSize})
                      </span>
                    )}
                  </div>
    
                  {results && (
                    <div className="flex items-center gap-2">
                      <button onClick={downloadExport} className="bg-[#1A2035] hover:bg-[#334155] border border-[#334155] text-white px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-semibold tracking-wide uppercase" title="Export Results JSON">
                        <Download className="w-4 h-4 text-[#8B9BB4]" />
                        Export JSON
                      </button>
                    </div>
                  )}
    
                  {lastExactTasks && (
                    <button
                      onClick={() => runExperiment(true)}
                      disabled={loading}
                      className="bg-[#F59E0B] hover:bg-[#D97706] text-white px-6 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <GitCommitHorizontal className="w-4 h-4 fill-current" />
                      RE-RUN PREVIOUS CASES
                    </button>
                  )}
                  <button
                    onClick={() => runExperiment(false)}
                    disabled={loading || datasets.count === 0}
                    className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    RUN INFERENCE
                  </button>
                </div>
              </div>

              {/* Live Streaming Terminal (Top Position During Load) */}
              {(loading || (!results && liveLogs.length > 0)) && (
                <div className="bg-[#06080F] border border-[#1A2035] rounded-xl flex flex-col overflow-hidden animate-in fade-in h-[500px]">
                  <div className="bg-[#101524] px-5 py-3 border-b border-[#1A2035] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Terminal className="w-4 h-4 text-[#818CF8]" />
                       <span className="text-xs uppercase tracking-widest font-semibold text-[#E2E8F0]">Active Inference Stream</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]/80"></div>
                    </div>
                  </div>
                  <div className="p-5 overflow-y-auto custom-scrollbar flex-1 font-mono text-xs text-[#94A3B8] space-y-4 flex flex-col-reverse">
                    {loading && (
                      <div className="flex items-center gap-2 text-[#4F46E5] animate-pulse py-2">
                        <div className="w-2 h-4 bg-current"></div> Processing intelligence matrix...
                      </div>
                    )}
                    {liveLogs.map((log, idx) => (
                      <div key={idx} className="border-l-2 border-[#1E293B] pl-4 py-2 space-y-3 mb-2 bg-[#0A0D17]/50 rounded-r-lg">
                        <div className="text-[#E2E8F0] leading-relaxed">
                          <span className="text-[#10B981] font-bold mr-2">[EVALUATED]</span> 
                          {log.task}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 bg-[#101524] p-2.5 rounded-md border border-[#1A2035]">
                           <div className="text-[10px] uppercase tracking-widest text-[#64748B] flex gap-2 items-center bg-[#06080F] px-2 py-1 rounded">Target: <span className={`font-bold ${log.groundtruth_tag === 'correct' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{log.groundtruth_tag}</span></div>
                           <div className="text-[10px] uppercase tracking-widest text-[#64748B] flex gap-2 items-center bg-[#06080F] px-2 py-1 rounded">SemSimM: <span className={`font-bold ${log.semsim_decision === 'ALLOW' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{log.semsim_decision}</span></div>
                           <div className="text-[10px] uppercase tracking-widest text-[#64748B] flex gap-2 items-center bg-[#06080F] px-2 py-1 rounded">LLM-ResM: <span className={`font-bold ${log.llm_decision === 'ALLOW' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{log.llm_decision}</span></div>
                           <div className="text-[10px] uppercase tracking-widest text-[#64748B] flex gap-2 items-center bg-[#06080F] px-2 py-1 rounded">TS-PHOL: <span className={`font-bold ${log.tsphol_decision === 'ALLOW' ? 'text-[#4F46E5]' : 'text-[#EF4444]'}`}>{log.tsphol_decision}</span></div>
                        </div>
                      </div>
                    )).reverse()}
                  </div>
                </div>
              )}

              {/* Final Results Area */}
              {results && !loading && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both space-y-6">
                  
                  {/* Metric Cards matching the ML Layer look */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { name: "SemSimM (Layer 1)", desc: `Rule: Cosine Similarity between LLM 'ideal tool' embedding and requested tool embedding > ${semsimThreshold.toFixed(2)}.`, data: results.metrics.semsim, color: "text-[#64748B]", bg: "bg-[#0A0D17]", border: "border-[#1A2035]", accent: "bg-[#334155]" },
                      { name: "LLM-ResM (Layer 2)", desc: "Rule: Zero-shot LLM prompts probabilistically reasoning if the tool is strictly necessary.", data: results.metrics.llm_res, color: "text-[#F59E0B]", bg: "bg-[#0A0D17]", border: "border-[#F59E0B]/20", accent: "bg-[#F59E0B]" },
                      { name: "TS-PHOL (Core)", desc: "Rule: Parse task into abstract workflow -> Validate requested tools against deterministic policy graph.", data: results.metrics.tsphol, color: "text-[#4F46E5]", bg: "bg-[#101524]", border: "border-[#4F46E5]/30", accent: "bg-[#4F46E5]", glow: true }
                    ].map((m) => (
                      <div key={m.name} className={`${m.bg} border ${m.border} rounded-xl p-5 relative overflow-hidden group`}>
                        {m.glow && <div className="absolute inset-0 bg-gradient-to-br from-[#4F46E5]/10 to-transparent pointer-events-none"></div>}
                        
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-full">
                            <h3 className={`font-semibold text-sm ${m.color} mb-1 flex items-center justify-between`}>
                              <span className="flex items-center gap-2"><Box className="w-4 h-4" />{m.name}</span>
                              <div className="group-hover:opacity-100 opacity-0 transition-opacity cursor-help" title={m.desc}>
                                 <Info className="w-4 h-4 text-[#64748B]" />
                              </div>
                            </h3>
                            <p className="text-[9px] text-[#64748B] mt-2 line-clamp-2 h-6" title={m.desc}>{m.desc}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <span className="text-xs font-medium text-[#94A3B8]">F1 Score</span>
                            <span className="font-mono text-2xl text-[#E2E8F0] tracking-tight">{m.data.f1.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-[#1A2035] rounded-full h-1">
                            <div className={`h-full rounded-full ${m.accent}`} style={{ width: `${m.data.f1 * 100}%` }}></div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 pt-2">
                             <div className="border border-[#1A2035] bg-[#0A0D17] py-2 px-3 rounded-md">
                               <div className="text-[9px] uppercase tracking-widest text-[#64748B] mb-1">Precision</div>
                               <div className="font-mono text-sm text-[#E2E8F0]">{m.data.precision.toFixed(2)}</div>
                             </div>
                             <div className="border border-[#1A2035] bg-[#0A0D17] py-2 px-3 rounded-md">
                               <div className="text-[9px] uppercase tracking-widest text-[#64748B] mb-1">Recall</div>
                               <div className="font-mono text-sm text-[#E2E8F0]">{m.data.recall.toFixed(2)}</div>
                             </div>
                             <div className="border border-[#1A2035] bg-[#0A0D17] py-2 px-3 rounded-md">
                               <div className="text-[9px] uppercase tracking-widest text-[#64748B] mb-1">Accuracy</div>
                               <div className="font-mono text-sm text-[#E2E8F0]">{m.data.accuracy?.toFixed(2) ?? '0.00'}</div>
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Explanation Section */}
                  <div className="bg-[#06080F] border border-[#1A2035] rounded-xl overflow-hidden relative">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-[#1A2035]">
                       <div className="flex items-center gap-4">
                         <h3 className="text-sm font-semibold text-[#818CF8] flex items-center gap-2">
                           <BrainCircuit className="w-5 h-5" /> AI Diagnostic Analysis
                         </h3>
                         {aiExplanation && (
                           <button 
                             onClick={() => setShowAnalysis(!showAnalysis)}
                             className="text-[10px] uppercase tracking-widest font-bold text-[#64748B] hover:text-[#E2E8F0] flex items-center gap-1 transition-colors"
                           >
                             {showAnalysis ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                             {showAnalysis ? "Collapse" : "Expand"}
                           </button>
                         )}
                       </div>
                       <div className="flex items-center gap-3">
                         <button
                           onClick={explainResults}
                           disabled={isExplaining}
                           className="bg-[#101524] hover:bg-[#1A2035] border border-[#1A2035] text-[#E2E8F0] px-4 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2"
                         >
                           {isExplaining ? <div className="w-3 h-3 border-2 border-[#818CF8]/30 border-t-[#818CF8] rounded-full animate-spin" /> : <Terminal className="w-3 h-3 text-[#818CF8]" />}
                           {aiExplanation ? "REGENERATE" : "EXPLAIN RESULTS WITH AI"}
                         </button>
                       </div>
                    </div>
                    
                    {isExplaining && !aiExplanation && (
                       <div className="flex items-center gap-3 text-xs text-[#64748B] p-6 bg-[#0A0D17] animate-pulse border-b border-[#1A2035]">
                         <div className="w-3 h-3 bg-[#4F46E5] rounded-full animate-bounce"></div> Synthesizing metric correlations and generating diagnostic payload...
                       </div>
                    )}

                    {aiExplanation && showAnalysis && (
                       <div className="p-6 bg-[#0A0D17] animate-in slide-in-from-top-2 duration-200">
                         <div className="text-xs text-[#E2E8F0] leading-relaxed p-6 bg-[#101524] rounded-lg border border-[#1E293B] whitespace-pre-wrap font-sans custom-scrollbar max-h-[500px] overflow-y-auto">
                           {renderMarkdownText(aiExplanation)}
                         </div>
                       </div>
                    )}
                  </div>
    
                  {/* Tactical Grid View (Table) */}
                  <div className="bg-[#0A0D17] border border-[#1A2035] rounded-xl overflow-hidden">
                     <div className="px-5 py-4 border-b border-[#1A2035] flex items-center justify-between bg-[#06080F]">
                       <div className="flex items-center gap-2">
                         <Activity className="w-4 h-4 text-[#64748B]" />
                         <h3 className="text-xs uppercase tracking-widest font-semibold text-[#E2E8F0]">Execution Traces</h3>
                       </div>
                     </div>
                     <div className="overflow-x-auto">
                       <table className="w-full text-xs text-left">
                         <thead className="bg-[#0A0D17] border-b border-[#1A2035]">
                           <tr>
                             <th className="px-5 py-3 font-medium text-[#64748B] uppercase tracking-widest w-1/3">Task Intent Scenario</th>
                             <th className="px-5 py-3 font-medium text-[#64748B] uppercase tracking-widest text-center" title="The actual correct answer from the benchmark dataset">Ground Truth (Label)</th>
                             <th className="px-5 py-3 font-medium text-[#64748B] uppercase tracking-widest text-center">SemSimM</th>
                             <th className="px-5 py-3 font-medium text-[#64748B] uppercase tracking-widest text-center">LLM-ResM</th>
                             <th className="px-5 py-3 font-medium text-[#4F46E5] uppercase tracking-widest text-center">TS-PHOL</th>
                           </tr>
                         </thead>
                        <tbody className="divide-y divide-[#1A2035]">
                           {results.raw_results.map((r: any, idx: number) => (
                             <tr 
                               key={idx} 
                               onClick={() => setSelectedTrace(r)}
                               className="hover:bg-[#101524] transition-colors group cursor-pointer"
                             >
                               <td className="px-5 py-4 text-[#94A3B8]">
                                 <div className="flex items-start gap-3">
                                   <GitCommitHorizontal className="w-4 h-4 text-[#334155] mt-0.5 group-hover:text-[#4F46E5] transition-colors shrink-0" />
                                   <span className="line-clamp-2 leading-relaxed" title={r.task}>{r.task}</span>
                                 </div>
                               </td>
                               <td className="px-5 py-4 text-center">
                                 <div className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold border ${r.groundtruth_tag === 'correct' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'}`}>
                                   {r.groundtruth_tag}
                                 </div>
                               </td>
                               <td className="px-5 py-4 text-center">
                                 <span className={`font-mono text-[10px] ${r.semsim_decision === 'ALLOW' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{r.semsim_decision}</span>
                               </td>
                               <td className="px-5 py-4 text-center">
                                 <span className={`font-mono text-[10px] ${r.llm_decision === 'ALLOW' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{r.llm_decision}</span>
                               </td>
                               <td className="px-5 py-4 text-center">
                                 <span className={`font-mono text-[10px] font-bold ${r.tsphol_decision === 'ALLOW' ? 'text-[#4F46E5]' : 'text-[#EF4444]'}`}>{r.tsphol_decision}</span>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#0A0D17] border border-[#1A2035] rounded-xl p-6 h-full flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#10B981] opacity-[0.03] rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
              
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <Network className="w-4 h-4 text-[#10B981]" />
                <h2 className="text-sm font-semibold text-[#E2E8F0]">TS-PHOL Dynamic Policy Simulator</h2>
              </div>
              <p className="text-xs text-[#64748B] max-w-3xl leading-relaxed mb-6 relative z-10">
                Define the verifiable Security Action Graph. When TS-PHOL parses a user's prompt into an abstract goal and required actions, it checks if the exact requested tools map cleanly onto this authorized tree.
              </p>

              <div className="flex-1 relative z-10 flex flex-col">
                <div className="bg-[#06080F] border border-[#1E293B] rounded-t-lg px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#64748B]">Policy Rules (JSON Graph)</span>
                </div>
                <textarea
                  className="flex-1 w-full bg-[#101524] border border-t-0 border-[#1E293B] rounded-b-lg p-4 font-mono text-xs text-[#E2E8F0] outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]/50 transition-all resize-none"
                  value={policyRules}
                  onChange={(e) => setPolicyRules(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Execution Trace Visualizer Modal */}
      {selectedTrace && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTrace(null)}></div>
          
          <div className="relative w-full max-w-5xl bg-[#0A0D17] border border-[#1A2035] rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1A2035] flex items-center justify-between bg-[#06080F]">
              <div className="flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-[#4F46E5]" />
                <h2 className="text-sm uppercase tracking-widest font-semibold text-[#E2E8F0]">Authorization Logic Trace</h2>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowLogs(!showLogs)}
                  className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition-colors ${showLogs ? 'bg-[#10B981]/20 text-[#10B981]' : 'text-[#64748B] hover:text-[#E2E8F0] bg-[#1A2035]'}`}
                >
                  <Terminal className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                  Raw Logs
                </button>
                <button 
                  onClick={() => { setSelectedTrace(null); setShowLogs(false); }}
                  className="p-1 text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1A2035] rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              
              {showLogs ? (
                 <div className="bg-[#06080F] border border-[#1A2035] rounded-xl flex flex-col overflow-hidden h-full min-h-[500px]">
                   <div className="bg-[#101524] px-4 py-2 border-b border-[#1A2035] flex gap-2">
                     <div className="w-3 h-3 rounded-full bg-[#EF4444]/80"></div>
                     <div className="w-3 h-3 rounded-full bg-[#F59E0B]/80"></div>
                     <div className="w-3 h-3 rounded-full bg-[#10B981]/80"></div>
                   </div>
                   <div className="p-4 overflow-y-auto custom-scrollbar flex-1 font-mono text-xs text-[#E2E8F0] space-y-6">
                     
                     <div className="space-y-2">
                       <div className="text-[10px] uppercase tracking-widest text-[#10B981]">-- SemSimM Vector Math Trace --</div>
                       <pre className="whitespace-pre-wrap text-[#94A3B8]">{selectedTrace.semsim_logs?.math || "No logs captured."}</pre>
                     </div>

                     <div className="space-y-2">
                       <div className="text-[10px] uppercase tracking-widest text-[#F59E0B]">-- LLM-ResM Generation Prompt --</div>
                       <pre className="whitespace-pre-wrap text-[#94A3B8] bg-[#101524] p-3 rounded">{selectedTrace.llm_logs?.prompt || "No prompt captured."}</pre>
                       <div className="text-[10px] uppercase tracking-widest text-[#F59E0B] mt-4">-- LLM-ResM Generation Completion --</div>
                       <pre className="whitespace-pre-wrap text-[#E2E8F0]">{selectedTrace.llm_logs?.completion || "No completion captured."}</pre>
                     </div>

                     <div className="space-y-2">
                       <div className="text-[10px] uppercase tracking-widest text-[#4F46E5]">-- TS-PHOL Parsing Prompt --</div>
                       <pre className="whitespace-pre-wrap text-[#94A3B8] bg-[#101524] p-3 rounded">{selectedTrace.tsphol_logs?.prompt || "No prompt captured."}</pre>
                       <div className="text-[10px] uppercase tracking-widest text-[#4F46E5] mt-4">-- TS-PHOL Parsing JSON Completion --</div>
                       <pre className="whitespace-pre-wrap text-[#E2E8F0] mb-4">{selectedTrace.tsphol_logs?.completion || "No completion captured."}</pre>
                       <div className="text-[10px] uppercase tracking-widest text-[#4F46E5] mt-6 border-t border-[#1E293B] pt-4">-- TS-PHOL Runtime DAG Mapping Validations --</div>
                       {renderValidationTrace(selectedTrace.tsphol_logs?.validation_trace, selectedTrace.tsphol_logs?.required_capabilities || [])}
                     </div>

                   </div>
                 </div>
              ) : (
                <>
                  {/* Context Block */}
                  <div className="bg-[#101524] border border-[#1E293B] rounded-lg p-5">
                    <div className="text-[10px] uppercase tracking-widest text-[#64748B] mb-2 font-medium">Task Intent Scenario</div>
                    <div className="text-sm text-[#E2E8F0] font-medium leading-relaxed mb-4">{selectedTrace.task}</div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#64748B] mb-2 font-medium">Requested Agent Tools</div>
                    <div className="flex flex-wrap gap-2">
                       {selectedTrace.requested_tools?.map((t: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-[#1A2035] border border-[#334155] rounded text-xs font-mono text-[#94A3B8]">{t}</span>
                       ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#64748B] mb-2 font-medium">Benchmark Label (Ground Truth)</div>
                    <div className={`inline-flex items-center px-3 py-1.5 rounded text-xs uppercase tracking-widest font-bold border ${selectedTrace.groundtruth_tag === 'correct' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'}`}>
                      {selectedTrace.groundtruth_tag === 'correct' ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <XCircle className="w-4 h-4 mr-1.5" />}
                      {selectedTrace.groundtruth_tag === 'correct' ? 'BENIGN (EXPECT ALLOW)' : 'MALICIOUS (EXPECT DENY)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* The Three Brains Comparative Trace */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. SemSimM */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1A2035] pb-2">
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-[#64748B] flex items-center gap-2"><Hexagon className="w-3.5 h-3.5" /> SemSimM</h3>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${selectedTrace.semsim_decision === 'ALLOW' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'}`}>{selectedTrace.semsim_decision}</span>
                  </div>
                  <div className="bg-[#0A0D17] border border-[#1A2035] rounded-lg p-4 h-48 overflow-y-auto">
                    <div className="text-[10px] uppercase tracking-widest text-[#64748B] mb-2">Distance Metric Reason</div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed font-mono">
                      {selectedTrace.semsim_reasoning ? selectedTrace.semsim_reasoning.replace(/threshold 0\.8\b/g, `threshold ${semsimThreshold.toFixed(2)}`) : `Cosine similarity computation against theoretical 'ideal tool' descriptions. If max_sim > threshold ${semsimThreshold.toFixed(2)}, ALLOW.`}
                    </p>
                  </div>
                </div>

                {/* 2. LLM-ResM */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1A2035] pb-2">
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-[#F59E0B] flex items-center gap-2"><Hexagon className="w-3.5 h-3.5" /> LLM-ResM</h3>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${selectedTrace.llm_decision === 'ALLOW' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'}`}>{selectedTrace.llm_decision}</span>
                  </div>
                  <div className="bg-[#0A0D17] border border-[#F59E0B]/10 rounded-lg p-4 h-48 overflow-y-auto custom-scrollbar">
                    <div className="text-[10px] uppercase tracking-widest text-[#F59E0B]/70 mb-2">Generative Reasoning</div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed italic">
                      {selectedTrace.llm_reasoning ? `"${selectedTrace.llm_reasoning}"` : `"The requested tools were analyzed against the task intent via deterministic prompting."`}
                    </p>
                  </div>
                </div>

                {/* 3. TS-PHOL */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1A2035] pb-2 border-[#4F46E5]/30">
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-[#818CF8] flex items-center gap-2"><Hexagon className="w-3.5 h-3.5" /> TS-PHOL</h3>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded border font-bold shadow-[0_0_10px_rgba(79,70,229,0.3)] ${selectedTrace.tsphol_decision === 'ALLOW' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'}`}>{selectedTrace.tsphol_decision}</span>
                  </div>
                  <div className="bg-[#101524] border border-[#4F46E5]/30 rounded-lg p-4 h-48 overflow-y-auto custom-scrollbar">
                    <div className="text-[10px] uppercase tracking-widest text-[#818CF8] mb-2">Deterministic DAG Trace</div>
                     {selectedTrace.tsphol_decision === "DENY" && selectedTrace.tsphol_logs?.validation_trace ? (
                        renderValidationTrace(selectedTrace.tsphol_logs?.validation_trace, selectedTrace.tsphol_logs?.required_capabilities || [])
                     ) : (
                        <code className="text-xs text-[#E2E8F0] block whitespace-pre-wrap leading-relaxed font-mono">
                          {selectedTrace.tsphol_reasoning || "Abstract Goal Parsed.\nDomain Extracted.\nRequested tools mapped perfectly to Policy Auth Graph."}
                        </code>
                     )}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )}

      {/* Global styles for custom scrollbar hidden in normal views but visible in traces */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0A0D17; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1E293B; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155; 
        }
      `}</style>
    </div>
  );
}
