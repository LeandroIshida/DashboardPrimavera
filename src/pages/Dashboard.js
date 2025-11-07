import React, { useState, useEffect, useRef } from "react";
import { getAllTags } from '../services/api';  // Ajuste o caminho conforme necessário
import { fmt } from '../services/normalize';  // Ajuste o caminho conforme necessário
import Card from '../components/Card';  // Ajuste o caminho conforme necessário
import '../styles/dashboard.css';  // Verifique se o caminho está correto
import InfoBtn from "../components/InfoBtn";
//import { getTagsValues, cmdEmergencia, cmdReset } from "../lib/api";
import { getTagsValues, cmdEmergencia, cmdReset } from '../lib/api';


const Dashboard = () => {
  const [tags, setTags] = useState({});
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);

  // ===== Tema (light/dark) =====
  const getInitialTheme = () => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  // ===== Fetch / polling das tags (1s) =====
  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      try {
        const { values, meta } = await getTagsValues();
        if (!alive) return;
        setTags(values);
        setMeta(meta);
      } catch (e) {
        console.error("Erro ao buscar tags:", e);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ===== Handlers comandos =====
  const [busyStop, setBusyStop] = useState(false);
  const [busyReset, setBusyReset] = useState(false);

  const handleStop = async () => {
    try {
      setBusyStop(true);
      await cmdEmergencia(400);
    } catch (e) {
      console.error(e);
    } finally {
      setBusyStop(false);
    }
  };

  const handleReset = async () => {
    try {
      setBusyReset(true);
      await cmdReset(400);
    } catch (e) {
      console.error(e);
    } finally {
      setBusyReset(false);
    }
  };

  // ===== Helpers =====
  const motorStatusBool = (run, fault) => {
    if (fault) return { cls: "state-err", label: "Em falha" };
    if (run) return { cls: "state-ok", label: "Ligado" };
    return { cls: "state-off", label: "Desligado" };
  };

  const onOff = (b) =>
    b ? { cls: "state-ok", label: "Ligado" } : { cls: "state-off", label: "Desligado" };

  const num = (v, fallback = 0) =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;

  // ===== Estados derivados das tags =====
  // Ozônio (0/1 → boolean já normalizado pela API)
  const oz = onOff(tags["ozonio_equipamento"]);

  // Motores: run + fault (booleans)
  const m1 = motorStatusBool(tags["motor_1_run"], tags["motor_1_fault"]);
  const m2 = motorStatusBool(tags["motor_2_run"], tags["motor_2_fault"]);

  const cycleFromBits = (start, finished) => {
    if (finished) return { cls: "state-info", label: "Finalizado" };
    if (start) return { cls: "state-ok", label: "Inicializado" };
    return { cls: "state-off", label: "Parado" };
  };

  const ciclo = cycleFromBits(tags["ciclo_iniciar"], tags["ciclo_finalizado"]);

  // Capacidades (litros)
  const TOTAL_CAPEF_L = num(tags["cap_total_ef"] ?? tags["capTotal"], 2670);
  const TOTAL_CAPT_L = num(tags["cap_total_trat"] ?? tags["capTotal"], 1100);
  const TOTAL_CAPEV_L = num(tags["cap_total_evap"] ?? tags["capTotal"], 13570);

  const buildLevel = (atualL, totalL) => {
    const total = Math.max(1, num(totalL, 1));
    const atual = Math.max(0, num(atualL, 0));
    const pct = Math.round(Math.min(100, Math.max(0, (atual / total) * 100)));
    return { atual, total, pct, h: `${pct}%` };
  };

  const lvlEflu = buildLevel(tags["nivel_tanque_1"], TOTAL_CAPEF_L);
  const lvlTrat = buildLevel(tags["nivel_tanque_2"], TOTAL_CAPT_L);
  const lvlEvap = buildLevel(tags["nivel_tanque_3"], TOTAL_CAPEV_L);

  // ===== Timer =====
  const TOTAL_MINUTES = 12 * 60; // 12 horas (ajuste se quiser)
  const totalSecondsDefault = TOTAL_MINUTES * 60;

  const totalSeconds =
    Number(tags["totalSec"]) > 0 ? Number(tags["totalSec"]) : totalSecondsDefault;

  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const prevStartRef = useRef(0);
  const prevFinishRef = useRef(0);

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  // start
  useEffect(() => {
    const startVal = tags["ciclo_iniciar"] ? 1 : 0;
    if (prevStartRef.current !== 1 && startVal === 1) {
      setRemaining(totalSeconds);
      setRunning(true);
    }
    prevStartRef.current = startVal;
  }, [tags, totalSeconds]);

  // finish
  useEffect(() => {
    const finVal = tags["ciclo_finalizado"] ? 1 : 0;
    if (prevFinishRef.current !== 1 && finVal === 1) {
      setRunning(false);
      setRemaining(totalSeconds);
    }
    prevFinishRef.current = finVal;
  }, [tags, totalSeconds]);

  // ticking a cada 1s
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((s) => {
        const next = s - 1;
        if (next <= 0) {
          setRunning(false);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, totalSeconds]);

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const radius = 100;
  const stroke = 14;
  const C = 2 * Math.PI * radius;
  const dashOffset = -1 * (C * (1 - progress));

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const timeText = `${String(hours).padStart(1, "0")}:${String(minutes).padStart(2, "0")}`;

  // KPIs extras
  const areaLimpaL = (() => {
    const l = Number(tags["areaLimpaLitros"]);
    const m3 = Number(tags["areaLimpaM3"]);
    if (Number.isFinite(l) && l >= 0) return l;
    if (Number.isFinite(m3) && m3 >= 0) return m3 * 1000;
    return 0;
  })();
  const treesCount = Math.floor(areaLimpaL / 1000);
  const fishCount = Number(tags["peixesSalvos"] ?? 0);
  const carbonCount = Number(tags["carbonoEvitado"] ?? 0);




//--------------------------------------------------------------------------
// ----- DEV ONLY: simular tags da API -----
/*const DEV = true; // coloque false quando não precisar mais

const devStart = () => setTags(t => ({
  ...t,
  [TAG.startCycle]: 1,       // dispara borda de subida
  [TAG.finishCycle]: 0,
}));

const devFinish = () => setTags(t => ({
  ...t,
  [TAG.finishCycle]: 1,      // sinaliza fim
  [TAG.startCycle]: 0,
}));

const devReset = () => setTags(t => ({
  ...t,
  [TAG.startCycle]: 0,
  [TAG.finishCycle]: 0,
}));

// opcional: mudar a duração (em minutos) por input
const devSetMinutes = (mins) => setTags(t => ({
  ...t,
  [TAG.totalSec]: Math.max(0, Number(mins) || 0) * 60
}));*/


//--------------------------------------------------------------------------
  if (loading) {
    return <div>Carregando...</div>; // Exibe uma mensagem de carregamento enquanto os dados são obtidos
  }

  return (
    <div className="dashboard">
      {/* HEADER com botão no canto direito */}
      <div className="dashboard-header">
  <h1 className="dashboard-title">Dashboard Industrial</h1>

  <div className="header-actions">
    <button className="btn btn-stop"  onClick={handleStop}  disabled={busyStop}>Parar</button>
    <button className="btn btn-reset" onClick={handleReset} disabled={busyReset}>Reset</button>
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Alternar tema claro/escuro"
      title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  </div>
</div>

      {/* Cards de Sensores e Ozônio */}
      <div className="top-grid">
        <Card className="sensores-card">
          <h2>Sensores de níveis</h2>

          <div className="levels-grid">
            {/* Efluente */}
            <div className="level-item">
              <div className="level-name">Efluente</div>
              <div className="level-bar">
                <div className="level-fill fill-orange" style={{ height: lvlEflu.h }} />
                <div className="level-value">{lvlEflu.pct}%</div>
              </div>
              <div className="level-cap">
                <div><strong>Capacidade:</strong></div>
                <div>Total: {TOTAL_CAPEF_L}L</div>
                <div>Atual: {lvlEflu.atual}L</div>
              </div>
            </div>

            {/* Tratamento */}
            <div className="level-item">
              <div className="level-name">Tratamento</div>
              <div className="level-bar">
                <div className="level-fill fill-blue" style={{ height: lvlTrat.h }}>
                  <div className="level-value">{lvlTrat.pct}%</div>
                </div>
              </div>
              <div className="level-cap">
                <div><strong>Capacidade:</strong></div>
                <div>Total: {TOTAL_CAPT_L}L</div>
                <div>Atual: {lvlTrat.atual}L</div>
              </div>
            </div>

            {/* Evaporação */}
            <div className="level-item">
              <div className="level-name">Evaporação</div>
              <div className="level-bar">
                <div className="level-fill fill-green" style={{ height: lvlEvap.h }}>
                  <div className="level-value">{lvlEvap.pct}%</div>
                </div>
              </div>
              <div className="level-cap">
                <div><strong>Capacidade:</strong></div>
                <div>Total: {TOTAL_CAPEV_L}L</div>
                <div>Atual: {lvlEvap.atual}L</div>
              </div>
            </div>
          </div>
        </Card>


        <Card className="cycle-card">
  <h2>Status ciclo</h2>
  <div className="cycle-status-wrap">
    <span className={`state-dot ${ciclo.cls}`} />
    <span className={`state-text ${ciclo.cls}`}>{ciclo.label}</span>
  </div>
</Card>

<Card className="impacto-card card--green">
  <h2>Impacto verde</h2>

  <div className="impacto-list">
    {/* Árvores */}
    <div className="impact-item">
      <div className="impact-left">
        <span className="emoji" role="img" aria-label="árvore">🌳</span>
        <span className="impact-text">{treesCount} Árvores</span>
      </div>
      <InfoBtn
        className="info-btn"
        data-tip="Estimativa: ~ 1000 L de água limpa = 1 árvore"
        aria-label="Informações sobre o cálculo de árvores"
        tip="Estimativa: ~ 1000 L de água limpa = 1 árvore"
      >i</InfoBtn>
    </div>

    {/* Peixes */}
    <div className="impact-item">
      <div className="impact-left">
        <span className="emoji" role="img" aria-label="peixe">💧</span>
        <span className="impact-text">{fishCount}L Água tratada</span>
      </div>
      <InfoBtn
        className="info-btn"
        data-tip="Exemplo: quantidade estimada de peixes beneficiados (definir fórmula)."
        tip="Exemplo: quantidade estimada de peixes beneficiados (definir fórmula)."
      >i</InfoBtn>
    </div>

    {/* Carbono */}
    <div className="impact-item">
      <div className="impact-left">
        <span className="emoji" role="img" aria-label="carbono">🌿</span>
        <span className="impact-text">{carbonCount} </span>
      </div>
      <InfoBtn
        className="info-btn"
        data-tip="Exemplo: CO₂ evitado (definir fórmula e unidade)."
        tip="Exemplo: CO₂ evitado (definir fórmula e unidade)."
      >i</InfoBtn>
    </div>
  </div>
</Card>


        {/* Motores */}
        <Card className="motores-combined-card">
  <h2>Motores</h2>
  <div className="motores-grid">
    <div className="motor-item">
      <div className="motor-title">Bomba do Efluente</div>
      <div className="state-row">
        <span className={`state-dot ${m1.cls}`} />
        <span className={`state-text ${m1.cls}`}>{m1.label}</span>
      </div>
    </div>

    <div className="motor-item">
      <div className="motor-title">Bomba de processo</div>
      <div className="state-row">
        <span className={`state-dot ${m2.cls}`} />
        <span className={`state-text ${m2.cls}`}>{m2.label}</span>
      </div>
    </div>

    <div className="motor-item">
      <div className="motor-title">Ozônio</div>
      <div className="state-row">
        <span className={`state-dot ${oz.cls}`} />
        <span className={`state-text ${oz.cls}`}>{oz.label}</span>
      </div>
    </div>
  </div>
</Card>

        
        <Card className="timer-card">
          {/*
          {DEV && (
  <div style={{display:'flex', gap:8, alignItems:'center', margin:'8px 0 16px'}}>
    <button onClick={devStart}>Start (tag=1)</button>
    <button onClick={devFinish}>Finish (tag=1)</button>
    <button onClick={devReset}>Clear</button>
    <label style={{marginLeft:8}}>
      Duração (min):{" "}
      <input
        type="number"
        min="0"
        defaultValue={Math.floor((Number(tags[TAG.totalSec])||0)/60)}
        onChange={(e)=>devSetMinutes(e.target.value)}
        style={{width:80}}
      />
    </label>
  </div>
)}*/}

  <div className="timer-wrap">
    <div className="timer-ring">
      <svg viewBox="0 0 240 240">
        <circle
          className="timer-bg"
          cx="120" cy="120" r={radius}
          fill="none" strokeWidth={stroke}
        />
        <circle
          className="timer-fg"
          cx="120" cy="120" r={radius}
          fill="none" strokeWidth={stroke}
          strokeDasharray={C}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="timer-center">{timeText}</div>
    </div>
    <div className="timer-label">Temporizador do ciclo</div>
  </div>
</Card>

      </div>

      {/* Cards de Elétrica (LL, LN, I) */}
      <div className="card-container">
        {/* Tensão LL */}
        <Card className="kpi3-card eletrica-ll-card">
          <div className="kpi3-title">Tensão de linha</div>
          <div className="kpi3-grid">
            <div className="kpi3-item">
              <div className="kpi3-label">L1–L2</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_1"] ?? "--")}</span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L2–L3</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_2"] ?? "--")}</span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L3–L1</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_3"] ?? "--")}</span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Tensão LN */}
        <Card className="kpi3-card eletrica-ln-card">
          <div className="kpi3-title">Tensão de fase</div>
          <div className="kpi3-grid">
            <div className="kpi3-item">
              <div className="kpi3-label">L1–N</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_4"] ?? "--")}</span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L2–N</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_5"] ?? "--")}</span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L3–N</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_6"] ?? "--")}</span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Corrente */}
        <Card className="kpi3-card eletrica-i-card">
          <div className="kpi3-title">Corrente</div>
          <div className="kpi3-grid">
            <div className="kpi3-item">
              <div className="kpi3-label">L1</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_7"] ?? "--")}</span>
                <span className="kpi3-unit">A</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L2</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_8"] ?? "--")}</span>
                <span className="kpi3-unit">A</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L3</div>
              <div className="kpi3-row">
                <span className="kpi3-value">{fmt(tags["multimedidor_9"] ?? "--")}</span>
                <span className="kpi3-unit">A</span>
              </div>
            </div>
          </div>
        </Card>
      </div>


      {/* Cards de KPI */}
      <div className="kpi1-grid">
        <Card className="kpi-card">
          <div className="kpi-title">Potência ativa</div>
          <div className="kpi-row">
            <span className="kpi-value">{fmt(tags["multimedidor_11"] ?? "--")}</span>
            <span className="kpi-unit">W</span>
          </div>
        </Card>
        <Card className="kpi-card">
          <div className="kpi-title">Demanda</div>
          <div className="kpi-row">
            <span className="kpi-value">{fmt(tags["multimedidor_12"] ?? "--")}</span>
            <span className="kpi-unit">VA</span>
          </div>
        </Card>
        <Card className="kpi-card">
          <div className="kpi-title">Fator de Potência</div>
          <div className="kpi-row">
            <span className="kpi-value">{fmt(tags["multimedidor_13"] ?? "--")}</span>
            <span className="kpi-unit">Cos φ</span>
          </div>
        </Card>
        <Card className="kpi-card">
          <div className="kpi-title">Frequência</div>
          <div className="kpi-row">
            <span className="kpi-value">{fmt(tags["multimedidor_10"] ?? "--")}</span>
            <span className="kpi-unit">Hz</span>
          </div>
        </Card>
        <Card className="kpi-card">

          <div className="kpi-title">Temperatura</div>

          <div className="kpi-row">
            <span className="kpi-value">{fmt(tags["multimedidor_14"] ?? "--")}</span>
            <span className="kpi-unit">°C</span>
          </div>
        </Card>
        
      </div>
    </div>
  );
};

export default Dashboard;
