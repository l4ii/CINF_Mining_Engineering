import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import {
  AppDialog,
  APP_PRIMARY_BUTTON_CLASS,
  NoticeBanner,
  appOutlineButtonClass,
} from "../shell/AppDialog";
import {
  calculateCutAndFill,
  createMethodInput,
} from "../../mining/cutAndFillCalc";
import {
  classifyDip,
  classifyThickness,
  DIP_BANDS,
  HANDBOOK_METHOD_NAMES,
  HANDBOOK_METHODS,
  THICKNESS_BANDS,
  type DipBand,
  type ThicknessBand,
} from "../../mining/cutAndFillStandards";
import CutAndFillWorkspace from "./CutAndFillWorkspace";
import { StageBreadcrumb, StageNav } from "./StagePageShell";
import { useProject } from "../../context/ProjectContext";
import {
  createCandidate,
  EMPTY_METHOD_METRICS,
  oreBodyDisplayName,
  type MethodCandidate,
  type MethodMetrics,
  type OreBody,
} from "../../mining/project";

export interface CutAndFillGuidePageProps {
  darkMode?: boolean;
  language?: "zh" | "en";
}

const METRIC_KEYS = Object.keys(EMPTY_METHOD_METRICS) as Array<keyof MethodMetrics>;

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findBand<T extends string>(
  bands: Array<{ id: T; label: string; range: string }>,
  id: T,
) {
  return bands.find((band) => band.id === id) ?? bands[0];
}

function formatRatio(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(3);
}

const METHOD_COLUMN_CHARS = Math.max(
  ...HANDBOOK_METHOD_NAMES.map((name) => name.length),
  6,
);

function makeMethodId(): string {
  return `cut-fill-method-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickMetrics(
  metrics: Record<string, { value: number | null; unit: string } | undefined>,
): MethodMetrics {
  return {
    preparationRatio: metrics.preparationRatio?.value ?? null,
    preparationVolumeRatio: metrics.preparationVolumeRatio?.value ?? null,
    cuttingRatio: metrics.cuttingRatio?.value ?? null,
    cuttingVolumeRatio: metrics.cuttingVolumeRatio?.value ?? null,
    cutAndFillRatio: metrics.cutAndFillRatio?.value ?? null,
    cutAndFillVolumeRatio: metrics.cutAndFillVolumeRatio?.value ?? null,
    wasteRate: metrics.wasteRate?.value ?? null,
    byProductOreProportion: metrics.byProductOreProportion?.value ?? null,
    recoveryRate: metrics.recoveryRate?.value ?? null,
    lossRate: metrics.lossRate?.value ?? null,
    dilutionRate: metrics.dilutionRate?.value ?? null,
  };
}

function metricsForMethod(methodName: string): MethodMetrics {
  if (!methodName) return EMPTY_METHOD_METRICS;
  return pickMetrics(calculateCutAndFill(createMethodInput(methodName)).metrics);
}

function metricsEqual(left: MethodMetrics, right: MethodMetrics): boolean {
  return METRIC_KEYS.every((key) => left[key] === right[key]);
}

function newMethod(input: Partial<Omit<MethodCandidate, "id">> & { methodName: string }): MethodCandidate {
  return createCandidate({
    id: makeMethodId(),
    ...input,
    ...(input.methodName ? metricsForMethod(input.methodName) : EMPTY_METHOD_METRICS),
  });
}

function MethodCombobox({
  value,
  darkMode,
  inputSurface,
  muted,
  autoFocus = false,
  listTestId = "method-combobox-list",
  onSelect,
}: {
  value: string;
  darkMode: boolean;
  inputSurface: string;
  muted: string;
  autoFocus?: boolean;
  listTestId?: string;
  onSelect: (methodName: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const filteredMethods = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return HANDBOOK_METHOD_NAMES;
    return HANDBOOK_METHOD_NAMES.filter((name) => name.includes(keyword));
  }, [query]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const updateMenuPos = useCallback(() => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    document.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      document.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [menuOpen, updateMenuPos]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        boxRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
      setQuery(value);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, value]);

  const menu =
    menuOpen && menuPos
      ? createPortal(
          <ul
            ref={listRef}
            id="method-combobox-list"
            role="listbox"
            data-testid={listTestId}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.width,
              width: "max-content",
              zIndex: 70,
            }}
            className={`max-h-56 overflow-y-auto overflow-x-hidden border py-1 text-center shadow-lg ${darkMode ? "border-gray-600 bg-gray-800" : "border-gray-200 bg-white"}`}
          >
            {filteredMethods.length === 0 ? (
              <li className={`px-2.5 py-2 text-base ${muted}`}>无匹配方法</li>
            ) : (
              filteredMethods.map((methodName) => (
                <li key={methodName}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={methodName === value}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(methodName);
                      setQuery(methodName);
                      setMenuOpen(false);
                    }}
                    className={`block w-full whitespace-nowrap px-2.5 py-1.5 text-center text-base ${
                      methodName === value
                        ? darkMode
                          ? "bg-blue-950/60 text-blue-100"
                          : "bg-blue-50 text-blue-800"
                        : darkMode
                          ? "hover:bg-gray-700"
                          : "hover:bg-slate-50"
                    }`}
                  >
                    {methodName}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={boxRef} className="mx-auto w-full">
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setMenuOpen(true);
          onSelect(HANDBOOK_METHOD_NAMES.includes(next) ? next : "");
        }}
        onFocus={() => setMenuOpen(true)}
        aria-label="采矿方法"
        aria-expanded={menuOpen}
        aria-controls="method-combobox-list"
        role="combobox"
        autoComplete="off"
        placeholder="请选择或输入"
        className={`h-9 w-full rounded-md border px-2.5 text-center text-base outline-none focus:border-blue-500 ${inputSurface}`}
      />
      {menu}
    </div>
  );
}

function HandbookMethodTable({
  darkMode,
  thicknessBand,
  dipBand,
  onSelectRegion,
}: {
  darkMode: boolean;
  thicknessBand: ThicknessBand | null;
  dipBand: DipBand | null;
  onSelectRegion: (thickness: ThicknessBand, dip: DipBand) => void;
}) {
  const border = darkMode ? "border-gray-700" : "border-gray-200";
  const tableHeader = darkMode
    ? "bg-gray-700 text-gray-100"
    : "bg-slate-100 text-slate-700";
  const tableSubheader = darkMode
    ? "bg-gray-800 text-gray-300"
    : "bg-slate-50 text-slate-600";
  const muted = darkMode ? "text-gray-400" : "text-gray-600";
  const selectedCell = darkMode
    ? "bg-blue-950/70 ring-blue-400"
    : "bg-blue-50 ring-blue-500";

  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="standard-table-scroll">
      <table
        className="h-full w-full table-fixed border-collapse text-center text-base"
        data-testid="standard-method-table"
      >
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className="w-[20.25%]" />
          <col className="w-[20.25%]" />
          <col className="w-[20.25%]" />
          <col className="w-[20.25%]" />
        </colgroup>
        <thead>
          <tr className={tableHeader}>
            <th
              rowSpan={2}
              className={`sticky left-0 z-20 border ${border} px-2 py-1 text-center font-semibold ${tableHeader}`}
            >
              厚度
            </th>
            <th
              rowSpan={2}
              className={`border ${border} px-2 py-1 text-center font-semibold ${tableHeader}`}
            >
              范围
            </th>
            <th
              colSpan={4}
              className={`border ${border} px-2 py-1 text-center font-semibold ${tableHeader}`}
            >
              倾角 / 矿体产状
            </th>
          </tr>
          <tr className={tableSubheader}>
            {DIP_BANDS.map((band) => (
              <th
                key={band.id}
                className={`border ${border} px-2 py-1 text-center font-medium`}
              >
                <div>{band.label}</div>
                <div className={`font-normal ${muted}`}>{band.range}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {THICKNESS_BANDS.map((thickness) => (
            <tr key={thickness.id}>
              <th
                scope="row"
                className={`sticky left-0 z-10 border ${border} px-2 py-1 text-center align-middle font-semibold ${darkMode ? "bg-gray-800" : "bg-white"}`}
              >
                {thickness.label}
              </th>
              <td
                className={`border ${border} px-2 py-1 text-center align-middle ${muted}`}
              >
                {thickness.range}
              </td>
              {DIP_BANDS.map((dip) => {
                const isSelected =
                  thicknessBand != null &&
                  dipBand != null &&
                  thickness.id === thicknessBand &&
                  dip.id === dipBand;
                const methods = HANDBOOK_METHODS[thickness.id][dip.id];
                return (
                  <td
                    key={dip.id}
                    data-testid={`standard-cell-${thickness.id}-${dip.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectRegion(thickness.id, dip.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      onSelectRegion(thickness.id, dip.id)
                    }}
                    title={`选择${thickness.label} × ${dip.label}`}
                    aria-label={`选择${thickness.label} × ${dip.label}`}
                    aria-pressed={isSelected}
                    className={`cursor-pointer border px-1.5 py-2 align-middle text-base leading-6 ${border} ${isSelected ? `ring-2 ring-inset ${selectedCell}` : darkMode ? "bg-gray-800/40" : "bg-white"}`}
                  >
                    {methods.map((method, index) => (
                      <span
                        key={`${method}-${index}`}
                        className="block w-full"
                      >
                        {method}
                      </span>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultHeader({
  label,
  borderClass,
  title,
}: {
  label: string;
  borderClass: string;
  title?: string;
}) {
  return (
    <th
      scope="col"
      title={title ?? label}
      aria-label={title ?? label}
      className={`border-b px-0 py-2 text-center text-sm font-semibold whitespace-nowrap ${borderClass}`}
    >
      {label}
    </th>
  );
}

export default function CutAndFillGuidePage({
  darkMode = false,
  language = "zh",
}: CutAndFillGuidePageProps) {
  const {
    project,
    activeOreBodyId,
    activeCandidateId,
    setProject,
    openCandidate,
    closeCalculation,
  } = useProject();
  const oreBodyIndex = project?.oreBodies.findIndex((body) => body.id === activeOreBodyId) ?? -1;
  const oreBody = oreBodyIndex >= 0 ? project!.oreBodies[oreBodyIndex] : null;
  const methods = oreBody?.candidates ?? [];
  const [status, setStatus] = useState("");
  const [draftMethodId, setDraftMethodId] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistThickness, setAssistThickness] = useState("");
  const [assistDip, setAssistDip] = useState("");
  const [assistThicknessBand, setAssistThicknessBand] =
    useState<ThicknessBand | null>(null);
  const [assistDipBand, setAssistDipBand] = useState<DipBand | null>(null);
  const [dialogError, setDialogError] = useState("");

  const selectedThickness = assistThicknessBand
    ? findBand(THICKNESS_BANDS, assistThicknessBand)
    : null;
  const selectedDip = assistDipBand
    ? findBand(DIP_BANDS, assistDipBand)
    : null;
  const assistRecommendations = useMemo(
    () =>
      assistThicknessBand && assistDipBand
        ? HANDBOOK_METHODS[assistThicknessBand][assistDipBand]
        : [],
    [assistThicknessBand, assistDipBand],
  );
  const activeMethod =
    methods.find((method) => method.id === activeCandidateId) ?? null;
  const isEn = language === "en";
  const surface = darkMode
    ? "border-gray-700 bg-gray-800 text-gray-100"
    : "border-gray-200 bg-white text-gray-900";
  const muted = darkMode ? "text-gray-400" : "text-gray-600";
  const inputSurface = darkMode
    ? "border-gray-600 bg-gray-900 text-gray-100 placeholder:text-gray-500"
    : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400";
  const tableSubheader = darkMode
    ? "bg-gray-800 text-gray-300"
    : "bg-slate-50 text-slate-600";
  const border = darkMode ? "border-gray-700" : "border-gray-200";

  const updateBody = useCallback(
    (updater: (body: OreBody) => OreBody) => {
      if (!activeOreBodyId) return;
      setProject((current) => {
        if (!current) return current;
        return {
          ...current,
          oreBodies: current.oreBodies.map((body) =>
            body.id === activeOreBodyId ? updater(body) : body,
          ),
        };
      });
    },
    [activeOreBodyId, setProject],
  );

  const handleActiveMetrics = useCallback(
    (metrics: Record<string, { value: number | null; unit: string }>) => {
      if (!activeCandidateId) return;
      const next = pickMetrics(metrics);
      updateBody((body) => {
        let changed = false;
        const candidates = body.candidates.map((method) => {
          if (method.id !== activeCandidateId || metricsEqual(method, next)) return method;
          changed = true;
          return { ...method, ...next, calculated: true };
        });
        return changed ? { ...body, candidates } : body;
      });
    },
    [activeCandidateId, updateBody],
  );

  const updateAssistThickness = (raw: string) => {
    setAssistThickness(raw);
    const parsed = parseNumber(raw);
    const next = parsed == null ? null : classifyThickness(parsed);
    if (next) setAssistThicknessBand(next);
    setDialogError("");
  };

  const updateAssistDip = (raw: string) => {
    setAssistDip(raw);
    const parsed = parseNumber(raw);
    const next = parsed == null ? null : classifyDip(parsed);
    if (next) setAssistDipBand(next);
    setDialogError("");
  };

  const addEmptyMethod = () => {
    const method = newMethod({ methodName: "" });
    updateBody((body) => ({ ...body, candidates: [...body.candidates, method] }));
    setDraftMethodId(method.id);
    setStatus("");
  };

  const assignMethodName = (methodId: string, methodName: string) => {
    updateBody((body) => ({
      ...body,
      candidates: body.candidates.map((method) =>
        method.id === methodId
          ? {
              ...method,
              methodName,
              calculated: false,
              ...(methodName ? metricsForMethod(methodName) : EMPTY_METHOD_METRICS),
            }
          : method,
      ),
    }));
    if (methodName && draftMethodId === methodId) setDraftMethodId(null);
  };

  const assignRowName = (methodId: string, name: string) => {
    updateBody((body) => ({
      ...body,
      candidates: body.candidates.map((method) =>
        method.id === methodId ? { ...method, name } : method,
      ),
    }));
  };

  const adoptMethod = (methodId: string) => {
    updateBody((body) => ({ ...body, selectedCandidateId: methodId }));
  };

  const selectAssistRegion = (thickness: ThicknessBand, dip: DipBand) => {
    setAssistThickness("");
    setAssistDip("");
    setAssistThicknessBand(thickness);
    setAssistDipBand(dip);
    setDialogError("");
  };

  const openAssist = () => {
    const thickness = oreBody?.thickness;
    const dip = oreBody?.dipAngle;
    setAssistThickness(thickness == null ? "" : String(thickness));
    setAssistDip(dip == null ? "" : String(dip));
    setAssistThicknessBand(thickness == null ? null : classifyThickness(thickness));
    setAssistDipBand(dip == null ? null : classifyDip(dip));
    setDialogError("");
    setAssistOpen(true);
  };

  const closeAssist = () => {
    setAssistOpen(false);
    setDialogError("");
  };

  const openMethod = (methodId: string) => {
    if (!oreBody) return;
    const method = methods.find((item) => item.id === methodId);
    if (!method?.methodName) return;
    updateBody((body) => ({
      ...body,
      candidates: body.candidates.map((item) =>
        item.id === methodId ? { ...item, calculated: true } : item,
      ),
    }));
    openCandidate(oreBody.id, methodId);
  };

  const returnToProject = () => {
    closeCalculation();
    setDialogError("");
  };

  const submitAssist = () => {
    const thickness = parseNumber(assistThickness);
    const dip = parseNumber(assistDip);
    if (assistThickness.trim() && thickness == null) {
      setDialogError("请输入有效的厚度，数值不能为负。");
      return;
    }
    if (assistDip.trim() && dip == null) {
      setDialogError("请输入有效的倾角，数值不能为负。");
      return;
    }
    if (!assistThicknessBand || !assistDipBand || !selectedThickness || !selectedDip) {
      setDialogError("请先确定矿体厚度与倾角对应的规范分带。");
      return;
    }
    const recommended = HANDBOOK_METHODS[assistThicknessBand][assistDipBand];
    const added = recommended.map((methodName) =>
      newMethod({
        methodName,
        ...metricsForMethod(methodName),
      }),
    );
    updateBody((body) => ({ ...body, candidates: [...body.candidates, ...added] }));
    setAssistOpen(false);
    setStatus(
      `已按 ${selectedThickness.label} × ${selectedDip.label} 回填 ${added.length} 个规范推荐方法。`,
    );
  };

  const duplicateMethod = (method: MethodCandidate) => {
    const { id: _id, ...copy } = method;
    updateBody((body) => ({ ...body, candidates: [...body.candidates, newMethod(copy)] }));
  };

  const deleteMethod = (methodId: string) => {
    updateBody((body) => ({
      ...body,
      selectedCandidateId: body.selectedCandidateId === methodId ? null : body.selectedCandidateId,
      candidates: body.candidates.filter((method) => method.id !== methodId),
    }));
    if (draftMethodId === methodId) setDraftMethodId(null);
    if (activeCandidateId === methodId) closeCalculation();
  };

  const rangeError = (value: string, min: number, label: string) => {
    const parsed = parseNumber(value);
    return parsed != null && parsed < min ? `${label}不能小于 ${min}。` : "";
  };

  const pageShell = (content: React.ReactNode) => (
    <main
      className={`min-h-0 flex-1 overflow-y-auto ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}
      data-testid="cut-and-fill-guide-page"
    >
      <div className="flex min-h-full w-full max-w-[1880px] flex-col gap-4 px-4 py-5 text-left lg:px-8 lg:py-6">
        {content}
      </div>
    </main>
  );

  if (!oreBody) {
    return pageShell(
      <p className={muted}>请从产状分布进入某个矿体的采矿方法。</p>,
    );
  }

  if (activeCandidateId && activeMethod) {
    return pageShell(
      <div
        data-testid="method-calculation-page"
        className="flex flex-col gap-4"
      >
        <CutAndFillWorkspace
          methodName={activeMethod.methodName}
          workspaceKey={`${activeMethod.id}:${activeMethod.methodName}`}
          projectName={project?.name || "未命名采矿项目"}
          thickness={oreBody.thickness}
          dipAngle={oreBody.dipAngle}
          inheritedCommon={{
            oreDensity: project?.oreDensity ?? null,
            wasteDensity: project?.wasteDensity ?? null,
            dipAngle: oreBody.dipAngle,
            trueThickness: oreBody.thickness,
          }}
          embedded
          onBack={returnToProject}
          darkMode={darkMode}
          language={language}
          onMetricsChange={handleActiveMetrics}
        />
      </div>,
    );
  }

  return pageShell(
    <>
      <header
        className={`w-full border-b pb-5 text-left ${darkMode ? "border-gray-700" : "border-gray-200"}`}
        style={{ textAlign: "left" }}
      >
        <StageBreadcrumb darkMode={darkMode} crumb={isEn ? "Mining methods" : "采矿方法"} />
        <div className="w-full text-left">
          <p
            className={`mb-1 text-left text-base font-medium uppercase tracking-[0.12em] ${darkMode ? "text-gray-400" : "text-gray-500"}`}
          >
            CINF采矿工程计算软件
          </p>
          <h1
            className="w-full text-left text-3xl font-semibold tracking-tight lg:text-4xl"
            style={{ textAlign: "left" }}
          >
            {isEn ? "Mining methods" : "采矿方法"}
          </h1>
          <p className={`mt-3 text-left text-base leading-7 ${muted}`}>
            {isEn
              ? `${oreBodyDisplayName(oreBody, oreBodyIndex)}: compare candidate mining methods for this ore body, then adopt one. When finished, return to occurrence.`
              : `针对「${oreBodyDisplayName(oreBody, oreBodyIndex)}」开展采矿方法方案比选。可新建多个方案，也可按矿体产状条件加入规范推荐方法；计算后选定一个采用方法，该矿体即完成比选，并返回产状分布。`}
          </p>
        </div>
      </header>

      <section
        className={`border p-4 shadow-sm text-left ${surface}`}
        aria-labelledby="project-heading"
        style={{ textAlign: "left" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <h2
              id="project-heading"
              className="w-full text-left text-lg font-semibold"
              style={{ textAlign: "left" }}
            >
              {oreBodyDisplayName(oreBody, oreBodyIndex)}
            </h2>
            <p className={`mt-1 text-left text-base ${muted}`}>
              倾角 {oreBody.dipAngle ?? "—"}° · 厚度 {oreBody.thickness ?? "—"} m。选定采用方法后返回产状分布，全部矿体完成比选后可进入生产能力。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              data-testid="method-assist-trigger"
              onClick={openAssist}
              className={`text-base font-medium hover:underline ${darkMode ? "text-blue-300 hover:text-blue-200" : "text-blue-600 hover:text-blue-800"}`}
            >
              按矿体条件选择
            </button>
            <button
              type="button"
              onClick={addEmptyMethod}
              aria-label="新建方法"
              className={`text-base font-medium hover:underline ${darkMode ? "text-blue-300 hover:text-blue-200" : "text-blue-600 hover:text-blue-800"}`}
            >
              + 新建方法
            </button>
          </div>
        </div>
        <div
          className={`mt-4 border ${border}`}
          data-testid="cut-and-fill-point-list"
        >
          <table
            className="w-full table-fixed border-collapse text-center text-base"
            style={{ textAlign: "center" }}
          >
            <colgroup>
              <col className="w-10" />
              <col className="w-48" />
              <col
                style={{
                  width: `calc(${METHOD_COLUMN_CHARS}em + 2.5rem)`,
                  minWidth: `calc(${METHOD_COLUMN_CHARS}em + 2.5rem)`,
                }}
              />
              <col className="w-16" />
              <col className="w-[4.6em]" />
              <col className="w-[4.6em]" />
              <col className="w-[4.6em]" />
              <col className="w-[4.6em]" />
              <col className="w-[4.6em]" />
              <col className="w-[4.6em]" />
              <col className="w-[4.6em]" />
              <col className="w-[4.6em]" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className={tableSubheader}>
                <th
                  scope="col"
                  className={`border-b px-1 py-2 text-center text-sm font-semibold ${border}`}
                >
                  编号
                </th>
                <th
                  scope="col"
                  className={`border-b px-1 py-2 text-center text-sm font-semibold ${border}`}
                >
                  名称
                </th>
                <th
                  scope="col"
                  className={`border-b px-1 py-2 text-center text-sm font-semibold ${border}`}
                >
                  采矿方法
                </th>
                <th
                  scope="col"
                  className={`border-b px-1 py-2 text-center text-sm font-semibold ${border}`}
                >
                  采用
                </th>
                <ResultHeader label="采准比" borderClass={border} />
                <ResultHeader label="切割比" borderClass={border} />
                <ResultHeader label="采切比" borderClass={border} />
                <ResultHeader label="废石率" borderClass={border} />
                <ResultHeader
                  label="副产比"
                  title="副产矿石比例"
                  borderClass={border}
                />
                <ResultHeader label="回采率" borderClass={border} />
                <ResultHeader label="损失率" borderClass={border} />
                <ResultHeader label="贫化率" borderClass={border} />
                <th
                  scope="col"
                  className={`border-b px-1 py-2 text-center text-sm font-semibold ${border}`}
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {methods.length === 0 ? (
                <tr>
                  <td colSpan={13} className={`px-3 py-7 text-center ${muted}`}>
                    尚未建立方法。可新建方法指定采矿方法，或按矿体条件选择批量加入。选定其中一个作为采用方法后，该矿体完成。
                  </td>
                </tr>
              ) : (
                methods.map((method, index) => (
                  <tr key={method.id} className={`border-t ${border}`}>
                    <td className="px-1 py-2 text-center tabular-nums">
                      {index + 1}
                    </td>
                    <td className="px-1 py-2 text-center">
                      <input
                        value={method.name}
                        onChange={(event) =>
                          assignRowName(method.id, event.target.value)
                        }
                        aria-label={`名称 ${index + 1}`}
                        placeholder="请输入名称"
                        className={`h-9 w-full rounded-md border px-2.5 text-center text-base outline-none focus:border-blue-500 ${inputSurface}`}
                      />
                    </td>
                    <td className="px-1 py-2 text-center">
                      <MethodCombobox
                        value={method.methodName}
                        darkMode={darkMode}
                        inputSurface={inputSurface}
                        muted={muted}
                        autoFocus={draftMethodId === method.id}
                        onSelect={(methodName) =>
                          assignMethodName(method.id, methodName)
                        }
                      />
                    </td>
                    <td className="px-1 py-2 text-center">
                      <input
                        type="radio"
                        name={`adopted-${oreBody.id}`}
                        checked={oreBody.selectedCandidateId === method.id}
                        disabled={!method.methodName}
                        onChange={() => adoptMethod(method.id)}
                        aria-label={
                          method.methodName
                            ? `采用 ${method.methodName}`
                            : "采用方法"
                        }
                      />
                    </td>
                    <td className="px-0 py-2 text-center text-base tabular-nums">
                      {formatRatio(method.preparationRatio)}
                    </td>
                    <td className="px-0 py-2 text-center text-base tabular-nums">
                      {formatRatio(method.cuttingRatio)}
                    </td>
                    <td className="px-0 py-2 text-center text-base tabular-nums">
                      {formatRatio(method.cutAndFillRatio)}
                    </td>
                    <td className="px-0 py-2 text-center text-base tabular-nums">
                      {formatRatio(method.wasteRate)}
                    </td>
                    <td className="px-0 py-2 text-center text-base tabular-nums">
                      {formatRatio(method.byProductOreProportion)}
                    </td>
                    <td className="px-0 py-2 text-center text-base tabular-nums">
                      {formatRatio(method.recoveryRate)}
                    </td>
                    <td className="px-0 py-2 text-center text-base tabular-nums">
                      {formatRatio(method.lossRate)}
                    </td>
                    <td className="px-0 py-2 text-center text-base tabular-nums">
                      {formatRatio(method.dilutionRate)}
                    </td>
                    <td className="px-1 py-2 text-center">
                      <span className="inline-flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openMethod(method.id)}
                          disabled={!method.methodName}
                          className={`grid h-8 w-8 place-items-center rounded disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? "text-blue-200 hover:bg-blue-900/50" : "text-blue-700 hover:bg-blue-100"}`}
                          aria-label={
                            method.methodName
                              ? `打开方法 ${method.methodName}`
                              : "打开方法"
                          }
                          title="打开"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateMethod(method)}
                          className={`grid h-8 w-8 place-items-center rounded ${darkMode ? "hover:bg-gray-700" : "hover:bg-slate-100"}`}
                          aria-label={
                            method.methodName
                              ? `复制方法 ${method.methodName}`
                              : "复制方法"
                          }
                          title="复制"
                        >
                          <Copy className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMethod(method.id)}
                          className={`grid h-8 w-8 place-items-center rounded ${darkMode ? "text-red-300 hover:bg-red-950/40" : "text-red-600 hover:bg-red-50"}`}
                          aria-label={
                            method.methodName
                              ? `删除方法 ${method.methodName}`
                              : "删除方法"
                          }
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <StageNav darkMode={darkMode} completeHint="请为该矿体选定一个采用方法后再返回产状分布" />

      {status ? (
        <NoticeBanner tone="info" darkMode={darkMode}>
          {status}
        </NoticeBanner>
      ) : null}

      {assistOpen ? (
        <AppDialog
          title="按矿体条件选择采矿方法"
          darkMode={darkMode}
          size="wide"
          testId="method-assist-dialog"
          onClose={closeAssist}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2">
            <p className={`shrink-0 text-sm leading-5 ${muted}`}>
              本选择依据《采矿设计手册》（1987 年）按矿体真厚度与倾角划分的适用区间，给出相应产状条件下的采矿方法，供方案初选和技术经济比较。
            </p>
            <section
              className={`shrink-0 rounded-lg border p-2.5 text-left ${surface}`}
              aria-labelledby="standard-basis-heading"
            >
              <h3 id="standard-basis-heading" className="text-sm font-semibold">
                规范依据与判断准则
              </h3>
              <ul className={`mt-1.5 space-y-0.5 text-sm leading-5 ${muted}`}>
                <li>厚度：控制采幅、分层（或分段）高度及采准、切割工程布置。</li>
                <li>倾角：制约矿石运搬方式、矿柱与围岩稳定以及充填体受力。</li>
                <li>
                  说明：手册给出的是产状条件下的初选范围，最终方案尚需结合矿岩稳固性、地压显现、装备能力和安全条件复核。
                </li>
              </ul>
            </section>
            <section className={`shrink-0 rounded-lg border p-2.5 ${surface}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-left">
                  <h3 className="text-sm font-semibold">矿体条件</h3>
                  <p className={`mt-0.5 text-sm ${muted}`}>
                    矿体真厚度决定采幅与分层高度，倾角制约矿石运搬和采场稳定性，二者共同构成方法初选的产状条件。
                  </p>
                </div>
                <div
                  data-testid="selected-standard-range"
                  className={`rounded-md px-3 py-1.5 text-right text-sm ${darkMode ? "bg-blue-950/50 text-blue-200" : "bg-blue-50 text-blue-800"}`}
                >
                  {selectedThickness && selectedDip ? (
                    <>
                      <div>
                        {selectedThickness.label} · {selectedThickness.range}
                      </div>
                      <div>
                        {selectedDip.label} · {selectedDip.range}
                      </div>
                    </>
                  ) : (
                    <div>未选定产状区间</div>
                  )}
                </div>
              </div>
              <div
                data-testid="assist-inputs"
                className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                <div className="min-w-0 space-y-1 text-left">
                  <span className="block text-sm font-medium">厚度</span>
                  <span className="flex items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={assistThickness}
                      onChange={(event) =>
                        updateAssistThickness(event.target.value)
                      }
                      data-testid="standard-thickness-value"
                      aria-label="厚度"
                      placeholder="例如 3.0"
                      className={`h-9 min-w-0 flex-1 appearance-none rounded-l-md border px-2.5 text-sm outline-none focus:border-blue-500 ${inputSurface}`}
                    />
                    <span
                      className={`inline-flex h-9 items-center rounded-r-md border border-l-0 px-2 text-sm ${darkMode ? "border-gray-600 bg-gray-700 text-gray-300" : "border-gray-300 bg-gray-50 text-gray-500"}`}
                    >
                      m
                    </span>
                  </span>
                  {rangeError(assistThickness, 0, "厚度") ? (
                    <span className="text-sm text-red-500">
                      {rangeError(assistThickness, 0, "厚度")}
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-1 text-left">
                  <span className="block text-sm font-medium">倾角</span>
                  <span className="flex items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={assistDip}
                      onChange={(event) => updateAssistDip(event.target.value)}
                      data-testid="standard-dip-value"
                      aria-label="倾角"
                      placeholder="例如 35"
                      className={`h-9 min-w-0 flex-1 appearance-none rounded-l-md border px-2.5 text-sm outline-none focus:border-blue-500 ${inputSurface}`}
                    />
                    <span
                      className={`inline-flex h-9 items-center rounded-r-md border border-l-0 px-2 text-sm ${darkMode ? "border-gray-600 bg-gray-700 text-gray-300" : "border-gray-300 bg-gray-50 text-gray-500"}`}
                    >
                      °
                    </span>
                  </span>
                  {rangeError(assistDip, 0, "倾角") ? (
                    <span className="text-sm text-red-500">
                      {rangeError(assistDip, 0, "倾角")}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
            <section
              className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border ${surface}`}
            >
              <div
                className={`shrink-0 border-b px-3 py-1.5 text-left text-sm font-semibold ${tableSubheader} ${darkMode ? "border-gray-700" : "border-gray-200"}`}
              >
                规范推荐方法表
              </div>
              <HandbookMethodTable
                darkMode={darkMode}
                thicknessBand={assistThicknessBand}
                dipBand={assistDipBand}
                onSelectRegion={selectAssistRegion}
              />
            </section>
            <div
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-left text-sm ${darkMode ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-slate-50"}`}
              data-testid="standard-recommendations"
            >
              <span className="font-semibold">本区间将加入本矿体的方法：</span>
              <span>
                {assistRecommendations.length > 0
                  ? assistRecommendations.join("、")
                  : "无"}
              </span>
            </div>
            {dialogError ? (
              <NoticeBanner tone="error" darkMode={darkMode} role="alert" className="shrink-0">
                {dialogError}
              </NoticeBanner>
            ) : null}
            <div
              className={`flex shrink-0 items-center justify-end gap-2 border-t pt-2 ${darkMode ? "border-gray-600" : "border-gray-200"}`}
            >
              <button
                type="button"
                onClick={closeAssist}
                className={appOutlineButtonClass(darkMode)}
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitAssist}
                className={APP_PRIMARY_BUTTON_CLASS}
              >
                确认
              </button>
            </div>
          </div>
        </AppDialog>
      ) : null}
    </>,
  );
}
