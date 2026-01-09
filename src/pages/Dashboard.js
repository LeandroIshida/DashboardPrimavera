import React, { useState, useEffect, useRef } from "react";
import { fmt } from "../services/normalize";
import Card from "../components/Card";
import "../styles/dashboard.css";
import InfoBtn from "../components/InfoBtn";
import { getTagsValues, cmdEmergencia, cmdReset, cmdResume, cmdStoptime, cmdEmpty } from "../lib/api";

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

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

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
  const [busyPause, setBusyPause] = useState(false);
  const [busyResume, setBusyResume] = useState(false);
  const [busyEmpty, setBusyEmpty] = useState(false);



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

const handlePauseCycle = async () => {
  try {
    setBusyPause(true);
    await cmdStoptime(400);
  } catch (e) {
    console.error(e);
  } finally {
    setBusyPause(false);
  }
};

const handleResumeCycle = async () => {
  try {
    setBusyResume(true);
    await cmdResume(400);
  } catch (e) {
    console.error(e);
  } finally {
    setBusyResume(false);
  }
};


  // ===== Helpers =====
  const motorStatusBool = (run, fault) => {
    if (fault) return { cls: "state-err", label: "Em falha" };
    if (run) return { cls: "state-ok", label: "Ligado" };
    return { cls: "state-off", label: "Desligado" };
  };

  const onOff = (b) =>
    b
      ? { cls: "state-ok", label: "Ligado" }
      : { cls: "state-off", label: "Desligado" };

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

  const ciclo = cycleFromBits(tags["ciclo_iniciar"], tags["ciclo_finalizado"], tags["ciclo_parado"]);

  // Capacidades (litros)
  const TOTAL_CAPEF_L = num(tags["cap_total_ef"] ?? tags["capTotal"], 2670);
  const TOTAL_CAPT_L = num(tags["cap_total_trat"] ?? tags["capTotal"], 1100);
  const TOTAL_CAPEV_L = num(tags["cap_total_evap"] ?? tags["capTotal"], 13570);

  // Capacidades minimas(litros)
  //const MIN_CAPEF_L = num(tags["cap_min_ef"] ?? tags["capMin"], 500);
  const MIN_CAPT_L = num(tags["cap_min_trat"] ?? tags["capMin"], 150);
  //const MIN_CAPEV_L = num(tags["cap_min_evap"] ?? tags["capMin"], 600);




  const buildLevel = (atualL, totalL) => {
    const total = Math.max(1, num(totalL, 1));
    const atual = Math.max(0, num(atualL, 0));
    const rawPct = (atual / total) * 100;
    const pct = Math.round(Math.min(100, Math.max(0, rawPct)));
    const isFull = atual >= total || rawPct >= 99.5; // tolerância de 0,5%
    return { atual, total, pct, h: pct + "%", isFull };
  };

  const lvlEflu = buildLevel(tags["nivel_tanque_1"], TOTAL_CAPEF_L);
  const lvlTrat = buildLevel(tags["nivel_tanque_2"], TOTAL_CAPT_L);
  const lvlEvap = buildLevel(tags["nivel_tanque_3"], TOTAL_CAPEV_L);
  // const lvlEflu = buildLevel(2670, TOTAL_CAPEF_L);
  // const lvlTrat = buildLevel(1100/2, TOTAL_CAPT_L);
  // const lvlEvap = buildLevel(13570, TOTAL_CAPEV_L);

// ===== Timer (calculado no FRONT + persistente no refresh) =====
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const minutesToHHMM = (min) => {
  const totalMin = Math.max(0, Math.floor(Number(min) || 0));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(1, "0")}:${String(m).padStart(2, "0")}`;
};

// total vindo do CLP (min)
const totalMinutesFromClp = Math.max(0, Math.floor(Number(tags["Timer"]) || 0));
const totalMinutes = totalMinutesFromClp > 0 ? totalMinutesFromClp : 12 * 60;

// chaves no storage (por segurança, separadas)
const LS_START = "cycle_start_epoch_ms";
const LS_TOTAL = "cycle_total_minutes";

// estado calculado (minutos restantes)
const [remainingMin, setRemainingMin] = useState(totalMinutes);

const prevStartRef = useRef(0);
const prevFinishRef = useRef(0);

// 1) Ao receber start do CLP, salva início no localStorage
useEffect(() => {
  const startVal = tags["ciclo_iniciar"] ? 1 : 0;

  if (prevStartRef.current !== 1 && startVal === 1) {
    const now = Date.now();
    localStorage.setItem(LS_START, String(now));
    localStorage.setItem(LS_TOTAL, String(totalMinutes));
  }

  prevStartRef.current = startVal;
}, [tags, totalMinutes]);

// 2) Ao receber finish do CLP, limpa o localStorage
useEffect(() => {
  const finVal = tags["ciclo_finalizado"] ? 1 : 0;

  if (prevFinishRef.current !== 1 && finVal === 1) {
    localStorage.removeItem(LS_START);
    localStorage.removeItem(LS_TOTAL);
    setRemainingMin(totalMinutes); // opcional: volta pro total
  }

  prevFinishRef.current = finVal;
}, [tags, totalMinutes]);

// 3) Atualiza remaining baseado no relógio (não reinicia no refresh)
useEffect(() => {
  const tick = () => {
    const startStr = localStorage.getItem(LS_START);
    const totalStr = localStorage.getItem(LS_TOTAL);

    // Se não tem ciclo ativo salvo, mostra o total
    if (!startStr || !totalStr) {
      setRemainingMin(totalMinutes);
      return;
    }

    const startEpoch = Number(startStr);
    const totalMinSaved = Math.max(1, Math.floor(Number(totalStr) || totalMinutes));

    const elapsedMs = Date.now() - startEpoch;
    const elapsedMin = Math.floor(elapsedMs / 60000); // só minutos (sem segundos)

    const nextRemaining = Math.max(totalMinSaved - elapsedMin, 0);
    setRemainingMin(nextRemaining);
  };

  tick();
  const id = setInterval(tick, 1000); // pode ser 1000ms; display muda por minuto, mas mantém sincronizado
  return () => clearInterval(id);
}, [totalMinutes]);

// progress do círculo (1 cheio -> 0 vazio)
const progress = totalMinutes > 0 ? clamp01(remainingMin / totalMinutes) : 0;

// SVG ring
const radius = 100;
const stroke = 14;
const C = 2 * Math.PI * radius;
const dashOffset = -1 * (C * (1 - progress));

// texto HH:MM
const timeText = minutesToHHMM(remainingMin);



  // KPIs extras
  const areaLimpaL = (() => {
    const L = Number(tags["agua_tratada_total"]);
    return Number.isFinite(L) && L >= 0 ? L : 0;
  })();

  
// ===== Timer secundário (estático, em minutos) =====
const otherMinutesRaw = Math.max(
  0,
  Math.floor(Number(tags["Timer_Percentual"]) || 0)
);

// Converter MINUTOS → HH:MM (somente para exibir)
const otherHours = Math.floor(otherMinutesRaw / 60);
const otherMinutes = otherMinutesRaw % 60;

const otherTimeText =
  otherMinutesRaw > 0
    ? `${String(otherHours).padStart(1, "0")}:${String(otherMinutes).padStart(2, "0")}`
    : "--:--";

// ===== Estado do ciclo (vem do CLP) =====
// Ajuste os nomes das tags conforme seu CLP
const isRunning = Boolean(tags["ciclo_iniciar"]);   // ex: 1 quando está rodando
const isPaused  = Boolean(tags["ciclo_pausado"]);   // ex: 1 quando está pausado

// Regras que você pediu:
const canPause = isRunning && !isPaused && !busyPause && !busyResume;
const canResume = isRunning && isPaused && !busyPause && !busyResume;


  //const treesCount = Math.floor(areaLimpaL);
  const treesCount = areaLimpaL;
  // const fishCount = Number(tags["arealimpa"] ?? 0);

  // ---- CO2 evitado (kg) a partir de litros tratados ----
  const CO2_PER_LITER = 0.109; // kg CO2 / L
  const OZ_KWH_PER_M3 = 0.08;  // kWh por m³
  const GRID_KG_PER_KWH = 0.035; // kg CO2/kWh
  const CO2_OZONE_PER_L = (OZ_KWH_PER_M3 * GRID_KG_PER_KWH); // kg/L

  const carbonCount = Math.max(
    areaLimpaL * (CO2_PER_LITER - CO2_OZONE_PER_L),
    0
  ); // kg

  // valor formatado com 2 casas decimais no padrão BR
  const carbonDisplay = carbonCount.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // lê a tag e converte pra número
  const emergenciaAtiva = Number(tags && tags["emergencia_fb"]) === 1;
  // const emergenciaAtiva = true;

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="dashboard">
      {/* HEADER */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Tela de gestão • Ozônio • Fazenda Primavera</h1>
        <div className="header-actions">
          {emergenciaAtiva && (
            <div
              className="emg-group"
              role="status"
              aria-live="polite"
              title="Sinal de emergência ativo"
            >
              <div className="badge-emergencia">🚨 Painel em emergência</div>
            </div>
          )}

          <div className="header-actions">           
            <button
              className="btn btn-reset"
              onClick={handleReset}
              disabled={busyReset}
            >
              Reset
            </button>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Alternar tema claro/escuro"
              title={
                theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"
              }
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="top-grid">
        {/* Sensores / Níveis */}
        <Card className="sensores-card">
          <h2>Sensores de níveis</h2>
          <div className="levels-grid">
            {/* Efluente */}
            <div className="level-item">
              <div className="level-name">Efluente</div>
              <div
                className={
                  "level-frame " + (lvlEflu.isFull ? "is-full" : "")
                }
              >
                <div className="level-bar">
                  <div
                    className="level-fill fill-orange"
                    style={{ height: lvlEflu.h }}
                  >
                    <div
                      className={
                        "level-value " + (lvlEflu.isFull ? "is-full" : "")
                      }
                    >
                      {lvlEflu.pct}%
                    </div>
                  </div>
                </div>
              </div>
              <div className="level-cap">
                <div>
                  <strong>Capacidade:</strong>
                </div>
                <div>Total: {TOTAL_CAPEF_L}L</div>
                <div
                  className={
                    "level-current " + (lvlEflu.isFull ? "is-full" : "")
                  }
                >
                  Atual: {lvlEflu.isFull ? "Cheio" : lvlEflu.atual + "L"}
                </div>
              </div>
            </div>

            {/* Tratamento */}
            <div className="level-item">
              <div className="level-name">Tratamento</div>
              <div
                className={
                  "level-frame " + (lvlTrat.isFull ? "is-full" : "")
                }
              >
                <div className="level-bar">
                  <div
                    className="level-fill fill-blue"
                    style={{ height: lvlTrat.h }}
                  >
                    <div className="level-value">{lvlTrat.pct}%</div>
                  </div>
                </div>
              </div>
              <div className="level-cap">
                <div>
                  <strong>Capacidade:</strong>
                </div>
                <div>Total: {TOTAL_CAPT_L}L</div>
                 <div className="level-min">
      Mínimo: {MIN_CAPT_L}L
      <InfoBtn
        className="info-btn"
        tip="Volume mínimo recomendado para operação segura do sistema."
        data-tip="Volume mínimo recomendado para operação segura do sistema."
        aria-label="Informações sobre nível mínimo"
      >
        i
      </InfoBtn>
    </div>
                <div
                  className={
                    "level-current " + (lvlTrat.isFull ? "is-full" : "")
                  }
                >             
                  Atual: {lvlTrat.isFull ? "Cheio" : lvlTrat.atual + "L"}
                </div>
              </div>
            </div>

            {/* Evaporador */}
            <div className="level-item">
              <div className="level-name">Evaporador</div>
              <div
                className={
                  "level-frame " + (lvlEvap.isFull ? "is-full" : "")
                }
              >
                <div className="level-bar">
                  <div
                    className="level-fill fill-green"
                    style={{ height: lvlEvap.h }}
                  >
                    <div className="level-value">{lvlEvap.pct}%</div>
                  </div>
                </div>
              </div>
              <div className="level-cap">
                <div>
                  <strong>Capacidade:</strong>
                </div>
                <div>Total: {TOTAL_CAPEV_L}L</div>
                <div
                  className={
                    "level-current " + (lvlEvap.isFull ? "is-full" : "")
                  }
                >
                  Atual: {lvlEvap.isFull ? "Cheio" : lvlEvap.atual + "L"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Status ciclo */}
        <Card className="cycle-card">
          <h2>Status ciclo</h2>
          <div className="cycle-status-wrap">
            <span className={"state-dot " + ciclo.cls} />
            <span className={"state-text " + ciclo.cls}>{ciclo.label}</span>
          </div>
        </Card>

        {/* Impacto verde */}
        <Card className="impacto-card card--green">
          <h2>Impacto verde</h2>
          <div className="impacto-list">
            {/* Árvores */}
            <div className="impact-item">
              <div className="impact-left">
                <span className="emoji" role="img" aria-label="árvore">
                  🌳
                </span>
                <span className="impact-text">{treesCount} Árvores</span>
              </div>
              <InfoBtn
                className="info-btn"
                data-tip="Estimativa: ~ 1000 L de água limpa = 1 árvore"
                aria-label="Informações sobre o cálculo de árvores"
                tip="Estimativa: ~ 1000 L de água limpa = 1 árvore"
              >
                i
              </InfoBtn>
            </div>

            {/* Água tratada */}
            <div className="impact-item">
              <div className="impact-left">
                <span className="emoji" role="img" aria-label="água tratada">
                  💧
                </span>
                <span className="impact-text">{areaLimpaL} m³</span>
              </div>
              <InfoBtn
                className="info-btn"
                data-tip="Metros cúbicos de água tratada no período."
                tip="Metros cúbicos de água tratada no período."
              >
                i
              </InfoBtn>
            </div>



            {/* Carbono */}
            <div className="impact-item">
              <div className="impact-left">
                <span className="emoji" role="img" aria-label="carbono">
                  🌿
                </span>
                <span className="impact-text">{carbonDisplay} kg CO₂</span>
              </div>
              <InfoBtn
                className="info-btn"
                data-tip="Estimativa: 1.000 L ≈ 166 kg de CO₂ evitados."
                tip="Estimativa: 1.000 L ≈ 166 kg de CO₂ evitados."
              >
                i
              </InfoBtn>
            </div>
          </div>
        </Card>

{/* Motores */}
<Card className="motores-combined-card">
  <h2>Motores</h2>
  <div className="motores-grid">
    {/* Motor 1 */}
    <div
      className="motor-item"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
        textAlign: "center",
      }}
    >
      <div className="motor-title">Bomba do Efluente</div>
      <div
        className="state-row"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
        }}
      >
        <span className={"state-dot " + m1.cls} />
        <span className={"state-text " + m1.cls}>{m1.label}</span>
      </div>
    </div>

    {/* Motor 2 */}
    <div
      className="motor-item"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
        textAlign: "center",
      }}
    >
      <div className="motor-title">Bomba de processo</div>
      <div
        className="state-row"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
        }}
      >
        <span className={"state-dot " + m2.cls} />
        <span className={"state-text " + m2.cls}>{m2.label}</span>
      </div>
    </div>

    {/* Motor 3 */}
    <div
      className="motor-item"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
        textAlign: "center",
      }}
    >
      <div className="motor-title">Ozônio</div>
      <div
        className="state-row"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
        }}
      >
        <span className={"state-dot " + oz.cls} />
        <span className={"state-text " + oz.cls}>{oz.label}</span>
      </div>
    </div>
  </div>
</Card>



        {/* Timer */}
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


  {/* TÍTULO ACIMA DO TIMER */}
  <div className="timer-title-top">Temporizador do ciclo</div>


  <div className="timer-wrap timer-wrap--stack">
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


    {/* NOVO TEXTO NO LUGAR DO ANTIGO */}
    <div className="timer-label">Tempo do ciclo atual</div>


    {/* sub horário */}
    <div className="timer-subtime">{otherTimeText}</div>


    {/* botões */}
  <div className="timer-actions">
  <button
    className="btn btn-resume"
    onClick={handleResumeCycle}
    disabled={!canResume}
    title={
      !isRunning
        ? "Ciclo não está rodando"
        : isPaused
          ? "Retomar ciclo"
          : "Disponível após pausar"
    }
  >
    Retomar
  </button>

  <button
    className="btn btn-pause-danger"
    onClick={handlePauseCycle}
    disabled={!canPause}
    title={
      !isRunning
        ? "Ciclo não está rodando"
        : !isPaused
          ? "Pausar ciclo"
          : "Já está pausado"
    }
  >
    Pausar
  </button>
</div>


  </div>
</Card>

      </div>

      {/* Elétrica */}
      <div className="card-container">
        {/* Tensão LL */}
        <Card className="kpi3-card eletrica-ll-card">
          <div className="kpi3-title">Tensão de linha</div>
          <div className="kpi3-grid">
            <div className="kpi3-item">
              <div className="kpi3-label">L1–L2</div>
              <div className="kpi3-row">
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_1"] ?? "--")}
                </span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L2–L3</div>
              <div className="kpi3-row">
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_2"] ?? "--")}
                </span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L3–L1</div>
              <div className="kpi3-row">
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_3"] ?? "--")}
                </span>
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
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_4"] ?? "--")}
                </span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L2–N</div>
              <div className="kpi3-row">
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_5"] ?? "--")}
                </span>
                <span className="kpi3-unit">V</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L3–N</div>
              <div className="kpi3-row">
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_6"] ?? "--")}
                </span>
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
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_7"] ?? "--")}
                </span>
                <span className="kpi3-unit">A</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L2</div>
              <div className="kpi3-row">
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_8"] ?? "--")}
                </span>
                <span className="kpi3-unit">A</span>
              </div>
            </div>
            <div className="kpi3-item">
              <div className="kpi3-label">L3</div>
              <div className="kpi3-row">
                <span className="kpi3-value">
                  {fmt(tags["multimedidor_9"] ?? "--")}
                </span>
                <span className="kpi3-unit">A</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* KPIs simples */}
      <div className="kpi1-grid">
        <Card className="kpi-card">
          <div className="kpi-title">Potência ativa</div>
          <div className="kpi-row">
            <span className="kpi-value">
              {fmt(tags["multimedidor_11"] ?? "--")}
            </span>
            <span className="kpi-unit">W</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-title">Demanda</div>
          <div className="kpi-row">
            <span className="kpi-value">
              {fmt(tags["multimedidor_12"] ?? "--")}
            </span>
            <span className="kpi-unit">VA</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-title">Fator de Potência</div>
          <div className="kpi-row">
            <span className="kpi-value">
              {fmt(tags["multimedidor_13"] ?? "--")}
            </span>
            <span className="kpi-unit">Cos φ</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-title">Frequência</div>
          <div className="kpi-row">
            <span className="kpi-value">
              {fmt(tags["multimedidor_10"] ?? "--")}
            </span>
            <span className="kpi-unit">Hz</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-title">Temperatura</div>
          <div className="kpi-row">
            <span className="kpi-value">
              {fmt(tags["multimedidor_14"] ?? "--")}
            </span>
            <span className="kpi-unit">°C</span>
          </div>
        </Card>
      </div>
    </div>
  );
};



export default Dashboard;
