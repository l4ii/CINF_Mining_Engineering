import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Info, RefreshCw } from "lucide-react";
import {
  calculateCutAndFill,
  createMethodInput,
  deriveInclinedLength,
} from "../../mining/cutAndFillCalc";
import { createBlockElement, hasCutAndFillMethodModule } from "../../mining/methodConfigs";
import { applyDevelopmentLink } from "../../mining/developmentLink";
import type {
  CommonParameters,
  CutAndFillResult,
  DevelopmentRowInput,
  MiningMethodInput,
} from "../../mining/types";
import { saveCutAndFillWorkbook } from "../../mining/cutAndFillExport";
import type { SaveFileResult } from "../../utils/saveFile";
import BackIconButton from "../BackIconButton";
import { NoticeBanner } from "../shell/AppDialog";
import ReferenceIndicatorsPanel, {
  type BlockSizeKey,
  type IndicatorKey,
  type OccurrenceParameterKey,
} from "./CommonParametersPanel";
import BlockElementsPanel from "./BlockElementsPanel";
import EngineeringInputSection, {
  type EngineeringSection,
} from "./EngineeringInputSection";
import CutAndFillMetrics from "./CutAndFillMetrics";
import CutAndFillResultTable from "./CutAndFillResultTable";

const INHERITED_COMMON_KEYS: OccurrenceParameterKey[] = [
  "oreDensity",
  "wasteDensity",
  "dipAngle",
  "trueThickness",
];

export type InheritedCommon = Partial<
  Pick<CommonParameters, (typeof INHERITED_COMMON_KEYS)[number]>
>;

export interface CutAndFillWorkspaceProps {
  methodName: string | null;
  workspaceKey?: string;
  projectName?: string;
  thickness?: number | null;
  dipAngle?: number | null;
  inheritedCommon?: InheritedCommon;
  embedded?: boolean;
  onBack?: () => void;
  darkMode?: boolean;
  language?: "zh" | "en";
  onExport?: (
    input: MiningMethodInput,
    result: CutAndFillResult,
  ) => Promise<SaveFileResult> | SaveFileResult | void;
  onMetricsChange?: (metrics: CutAndFillResult["metrics"]) => void;
}

type SectionCollapsedState = Record<EngineeringSection, boolean>;

const SECTION_KEYS: EngineeringSection[] = ["preparation", "cutting"];

function makeInitialSectionState(): SectionCollapsedState {
  return { preparation: false, cutting: false };
}

function withDerivedIncline(input: MiningMethodInput): MiningMethodInput {
  return {
    ...input,
    common: {
      ...input.common,
      inclinedLength: deriveInclinedLength(input.common.dipAngle, input.common.levelHeight),
    },
  };
}

function applyInheritedCommon(
  input: MiningMethodInput,
  inheritedCommon: InheritedCommon | undefined,
  thickness: number | null | undefined,
  dipAngle: number | null | undefined,
  dirtyKeys: Set<string>,
): MiningMethodInput {
  const common = { ...input.common };
  const source: InheritedCommon = {
    ...inheritedCommon,
    ...(thickness != null ? { trueThickness: thickness } : {}),
    ...(dipAngle != null ? { dipAngle } : {}),
  };
  for (const key of INHERITED_COMMON_KEYS) {
    if (dirtyKeys.has(key)) continue;
    if (key in source) common[key] = source[key] ?? null;
  }
  return withDerivedIncline({ ...input, common });
}

function inheritedValuesEqual(left: MiningMethodInput, right: MiningMethodInput, dirtyKeys: Set<string>): boolean {
  return INHERITED_COMMON_KEYS.every((key) => dirtyKeys.has(key) || left.common[key] === right.common[key])
}

function seedMethodInput(
  methodName: string,
  thickness?: number | null,
  dipAngle?: number | null,
  inheritedCommon?: InheritedCommon,
): MiningMethodInput {
  return applyInheritedCommon(createMethodInput(methodName), inheritedCommon, thickness, dipAngle, new Set());
}

function makeRowId(section: EngineeringSection): string {
  return `${section}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankDevelopmentRow(section: EngineeringSection): DevelopmentRowInput {
  return {
    id: makeRowId(section),
    name: "",
    quantity: null,
    oreSingleLength: null,
    wasteSingleLength: null,
    oreTotalLength: null,
    wasteTotalLength: null,
    oreSectionArea: null,
    wasteSectionArea: null,
    note: "",
  };
}

export default function CutAndFillWorkspace({
  methodName,
  workspaceKey,
  projectName = "未命名采矿项目",
  thickness = null,
  dipAngle = null,
  inheritedCommon,
  embedded = false,
  onBack,
  darkMode = false,
  language = "zh",
  onExport,
  onMetricsChange,
}: CutAndFillWorkspaceProps) {
  const storageKey = workspaceKey || methodName || "method";
  const dirtyInherited = useRef<Record<string, Set<string>>>({});
  const [inputsByKey, setInputsByKey] = useState<Record<string, MiningMethodInput>>({});
  const [commonCollapsed, setCommonCollapsed] = useState<Record<string, boolean>>({});
  const [occurrenceCollapsed, setOccurrenceCollapsed] = useState<Record<string, boolean>>({});
  const [blockCollapsed, setBlockCollapsed] = useState<Record<string, boolean>>({});
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, SectionCollapsedState>>({});
  const [exportState, setExportState] = useState<"idle" | "busy" | "success" | "cancelled" | "error">("idle");
  const [exportMessage, setExportMessage] = useState("");
  const [templateVersion, setTemplateVersion] = useState(0);

  if (!dirtyInherited.current[storageKey]) dirtyInherited.current[storageKey] = new Set();

  useEffect(() => {
    if (!methodName) return;
    setInputsByKey((previous) => {
      const current = previous[storageKey];
      const dirty = dirtyInherited.current[storageKey] ?? new Set();
      const next = current
        ? applyInheritedCommon(current, inheritedCommon, thickness, dipAngle, dirty)
        : seedMethodInput(methodName, thickness, dipAngle, inheritedCommon);
      if (current && inheritedValuesEqual(current, next, dirty)) return previous;
      return { ...previous, [storageKey]: next };
    });
    setCommonCollapsed((previous) => storageKey in previous ? previous : { ...previous, [storageKey]: false });
    setOccurrenceCollapsed((previous) => storageKey in previous ? previous : { ...previous, [storageKey]: true });
    setBlockCollapsed((previous) => storageKey in previous ? previous : { ...previous, [storageKey]: false });
    setSectionsCollapsed((previous) =>
      storageKey in previous ? previous : { ...previous, [storageKey]: makeInitialSectionState() },
    );
  }, [storageKey, methodName, thickness, dipAngle, inheritedCommon]);

  const activeInput = methodName
    ? (inputsByKey[storageKey] ?? seedMethodInput(methodName, thickness, dipAngle, inheritedCommon))
    : null;
  const result = useMemo<CutAndFillResult | null>(
    () => (activeInput ? calculateCutAndFill(activeInput) : null),
    [activeInput],
  );
  const sectionState = sectionsCollapsed[storageKey] ?? makeInitialSectionState();
  const hasRows = Boolean(
    activeInput && SECTION_KEYS.some((section) => activeInput[section].length > 0),
  );
  const hasMethodModule = hasCutAndFillMethodModule(methodName);
  const appTitle = language === "en" ? "Mining engineering calculation" : "采矿工程计算";

  useEffect(() => {
    if (result && onMetricsChange) onMetricsChange(result.metrics);
  }, [result, onMetricsChange]);

  const resetCurrentMethod = () => {
    if (!methodName) return;
    dirtyInherited.current[storageKey] = new Set();
    setInputsByKey((previous) => ({
      ...previous,
      [storageKey]: seedMethodInput(methodName, thickness, dipAngle, inheritedCommon),
    }));
    setTemplateVersion((version) => version + 1);
    setExportState("idle");
    setExportMessage("");
  };

  const updateInput = (updater: (input: MiningMethodInput) => MiningMethodInput) => {
    if (!methodName) return;
    setInputsByKey((previous) => {
      const current = previous[storageKey] ?? seedMethodInput(methodName, thickness, dipAngle, inheritedCommon);
      return { ...previous, [storageKey]: withDerivedIncline(updater(current)) };
    });
    setExportState("idle");
    setExportMessage("");
  };

  const handleCommonChange = (key: OccurrenceParameterKey | BlockSizeKey, value: number | null) => {
    if (INHERITED_COMMON_KEYS.includes(key as OccurrenceParameterKey)) {
      dirtyInherited.current[storageKey]?.add(key);
    }
    updateInput((input) => ({
      ...input,
      common: { ...input.common, [key]: value },
    }));
  };

  const handleIndicatorChange = (key: IndicatorKey, field: "dilutionRate" | "lossRate", value: number | null) => {
    updateInput((input) => ({
      ...input,
      common: {
        ...input.common,
        [key]: { ...input.common[key], [field]: value },
      },
    }));
  };

  const handleBlockChange = (
    id: string,
    field: "sectionArea" | "height" | "quantity",
    value: number | null,
  ) => {
    updateInput((input) => ({
      ...input,
      blockElements: input.blockElements.map((element) =>
        element.id === id ? { ...element, [field]: value } : element,
      ),
    }));
  };

  const handleBlockNameChange = (id: string, name: string) => {
    updateInput((input) => ({
      ...input,
      blockElements: input.blockElements.map((element) =>
        element.id === id ? { ...element, name } : element,
      ),
    }));
  };

  const handleAddBlockElement = () => {
    updateInput((input) => ({
      ...input,
      blockElements: [...input.blockElements, createBlockElement()],
    }));
  };

  const handleRemoveBlockElement = (id: string) => {
    updateInput((input) => ({
      ...input,
      blockElements: input.blockElements.filter((element) => element.id !== id),
    }));
  };

  const handleRowChange = (
    section: EngineeringSection,
    rowId: string,
    field: string,
    value: string | number | null,
  ) => {
    updateInput((input) => ({
      ...input,
      [section]: input[section].map((row) =>
        row.id === rowId ? applyDevelopmentLink({ ...row, [field]: value }, field) : row,
      ),
    }));
  };

  const handleAddRow = (section: EngineeringSection) => {
    updateInput((input) => ({
      ...input,
      [section]: [...input[section], blankDevelopmentRow(section)],
    }));
  };

  const handleRemoveRow = (section: EngineeringSection, rowId: string) => {
    updateInput((input) => ({
      ...input,
      [section]: input[section].filter((row) => row.id !== rowId),
    }));
  };

  const toggleSection = (section: EngineeringSection) => {
    if (!methodName) return;
    setSectionsCollapsed((previous) => ({
      ...previous,
      [storageKey]: {
        ...(previous[storageKey] ?? makeInitialSectionState()),
        [section]: !(previous[storageKey] ?? makeInitialSectionState())[section],
      },
    }));
  };

  const handleExport = async () => {
    if (!activeInput || !result || !hasRows || exportState === "busy") return;
    setExportState("busy");
    setExportMessage("正在生成 Excel 工作簿…");
    try {
      const saveResult = onExport
        ? await onExport(activeInput, result)
        : await saveCutAndFillWorkbook(activeInput, result);
      if (saveResult?.cancelled) {
        setExportState("cancelled");
        setExportMessage("已取消导出。");
      } else if (saveResult?.ok ?? true) {
        setExportState("success");
        setExportMessage(
          saveResult?.filePath ? `已导出：${saveResult.filePath}` : "采切计算表已导出。",
        );
      } else {
        setExportState("error");
        setExportMessage(saveResult?.error ?? "导出失败，请稍后重试。");
      }
    } catch (error) {
      setExportState("error");
      setExportMessage(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const actionButtons = (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={resetCurrentMethod}
        className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition ${darkMode ? "border-gray-600 hover:bg-gray-800" : "border-gray-300 bg-white hover:bg-gray-100"}`}
        title="清空当前方法已填内容"
        aria-label="清空当前方法已填内容"
        data-testid="clear-cut-and-fill"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        清空
      </button>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={!hasRows || exportState === "busy"}
        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        title="导出当前方法的 Excel 工作簿"
        aria-label="导出当前方法的 Excel 工作簿"
        data-testid="export-cut-and-fill"
      >
        <Download className="h-4 w-4" aria-hidden />
        导出 Excel
      </button>
    </div>
  );

  const Frame = embedded ? "div" : "main";

  if (!methodName || !activeInput || !result) {
    return (
      <Frame
        className={`min-h-0 flex-1 overflow-y-auto ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}
        data-testid="cut-and-fill-workspace-empty"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col justify-center px-6 py-10 lg:px-10">
          <p className={`text-sm font-medium uppercase tracking-[0.12em] ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
            CINF采矿工程计算软件
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{appTitle}</h1>
          <p className={`mt-3 max-w-xl text-sm leading-6 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            请从采矿方法打开一个方法，进入参照指标、矿块构成与采切工程。
          </p>
          <div className={`mt-8 flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm ${darkMode ? "border-gray-700 text-gray-400" : "border-gray-300 text-gray-500"}`}>
            <Info className="h-4 w-4 shrink-0" aria-hidden />
            每个方法的输入数据单独保存于当前页面内存中。
          </div>
        </div>
      </Frame>
    );
  }

  return (
    <Frame
      className={`min-h-0 flex-1 overflow-y-auto ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}
      data-testid="cut-and-fill-workspace"
    >
      <div className={`flex w-full flex-col gap-3 ${embedded ? "" : "mx-auto max-w-[1880px] px-3 py-3 lg:px-5 lg:py-4"}`}>
        <header
          data-testid="method-workspace-header"
          className={`flex flex-wrap items-start justify-between gap-3 border-b ${embedded ? "pb-5" : "pb-3"} ${darkMode ? "border-gray-700" : "border-gray-200"}`}
        >
          <div className="min-w-0">
            {embedded ? (
              <>
                <div className={`relative mb-2 flex items-center gap-2 text-base ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                  {onBack ? (
                    <BackIconButton
                      label="返回采矿方法"
                      onClick={onBack}
                      darkMode={darkMode}
                      testId="method-page-back"
                      className={`absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 ${
                        darkMode ? "!text-blue-300 hover:!bg-blue-950/40" : "!text-blue-700 hover:!bg-blue-50"
                      }`}
                    />
                  ) : null}
                  <span>采矿工程计算</span>
                  <span aria-hidden>/</span>
                  <span>方法计算区</span>
                </div>
                <h1 className="truncate text-2xl font-semibold tracking-tight lg:text-3xl">{methodName}</h1>
                <p className={`mt-3 text-sm leading-6 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  项目：{projectName}
                  {thickness == null ? "" : ` · 厚度 ${thickness} m`}
                  {dipAngle == null ? "" : ` · 倾角 ${dipAngle}°`}
                </p>
              </>
            ) : (
              <>
                <div className={`mb-1 flex items-center gap-2 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  <span>采矿</span>
                  <span aria-hidden>/</span>
                  <span>采切计算</span>
                </div>
                <h1 className="truncate text-xl font-semibold tracking-tight lg:text-2xl">{methodName}</h1>
                <p className={`mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  项目名称：{projectName} · 当前方法独立输入 · 结果实时更新
                </p>
              </>
            )}
          </div>
          {actionButtons}
        </header>

        <ReferenceIndicatorsPanel
          key={`${storageKey}-common-${templateVersion}`}
          common={activeInput.common}
          issues={result.issues}
          collapsed={Boolean(commonCollapsed[storageKey])}
          occurrenceCollapsed={occurrenceCollapsed[storageKey] ?? true}
          darkMode={darkMode}
          onChange={handleCommonChange}
          onIndicatorChange={handleIndicatorChange}
          onToggle={() =>
            setCommonCollapsed((previous) => ({ ...previous, [storageKey]: !previous[storageKey] }))
          }
          onToggleOccurrence={() =>
            setOccurrenceCollapsed((previous) => ({ ...previous, [storageKey]: !previous[storageKey] }))
          }
        />

        {hasMethodModule ? (
          <>
            <BlockElementsPanel
              key={`${storageKey}-block-${templateVersion}`}
              elements={activeInput.blockElements}
              issues={result.issues}
              collapsed={Boolean(blockCollapsed[storageKey])}
              darkMode={darkMode}
              onToggle={() =>
                setBlockCollapsed((previous) => ({ ...previous, [storageKey]: !previous[storageKey] }))
              }
              onChange={handleBlockChange}
              onNameChange={handleBlockNameChange}
              onAdd={handleAddBlockElement}
              onRemove={handleRemoveBlockElement}
            />
            <section className="space-y-3" aria-label="工程输入区">
              {SECTION_KEYS.map((section) => (
                <EngineeringInputSection
                  key={`${storageKey}-${section}-${templateVersion}`}
                  section={section}
                  rows={activeInput[section]}
                  issues={result.issues}
                  collapsed={sectionState[section]}
                  darkMode={darkMode}
                  onToggle={() => toggleSection(section)}
                  onAddRow={() => handleAddRow(section)}
                  onRemoveRow={(rowId) => handleRemoveRow(section, rowId)}
                  onRowChange={(rowId, field, value) => handleRowChange(section, rowId, field, value)}
                />
              ))}
            </section>
          </>
        ) : null}

        {exportMessage ? (
          <NoticeBanner
            tone={exportState === "error" ? "error" : exportState === "success" ? "success" : "info"}
            darkMode={darkMode}
            icon={<FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />}
          >
            <span className="min-w-0 truncate">{exportMessage}</span>
          </NoticeBanner>
        ) : null}

        <div className="min-h-[300px] flex-1">
          <CutAndFillResultTable input={activeInput} result={result} darkMode={darkMode} />
        </div>
        <CutAndFillMetrics metrics={result.metrics} issues={result.issues} darkMode={darkMode} />
      </div>
    </Frame>
  );
}
