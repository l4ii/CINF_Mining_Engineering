import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Info } from "lucide-react";
import { calculateCutAndFill, createMethodInput } from "../../mining/cutAndFillCalc";
import {
  createBlankDevelopmentRow,
  hasCutAndFillMethodModule,
  insertPillarElement,
  isPanelElement,
  isStopeElement,
} from "../../mining/methodConfigs";
import { applyDevelopmentLink } from "../../mining/developmentLink";
import type {
  CommonParameters,
  CutAndFillResult,
  LossDilutionIndicator,
  MiningMethodInput,
  PillarShape,
} from "../../mining/types";
import { saveCutAndFillWorkbook } from "../../mining/cutAndFillExport";
import type { SaveFileResult } from "../../utils/saveFile";
import BackIconButton from "../BackIconButton";
import { NoticeBanner } from "../shell/AppDialog";
import OreBodyParametersPanel, {
  type OccurrenceParameterKey,
} from "./CommonParametersPanel";
import BlockElementsPanel, { type BlockDimensionField } from "./BlockElementsPanel";
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
  savedInput?: MiningMethodInput | null;
  onMetricsChange?: (metrics: CutAndFillResult["metrics"], input?: MiningMethodInput) => void;
}

type SectionCollapsedState = Record<EngineeringSection, boolean>;

const SECTION_KEYS: EngineeringSection[] = ["preparation", "cutting"];

function textActionClass(darkMode: boolean): string {
  return `shrink-0 text-base font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline ${
    darkMode ? "text-blue-300 hover:text-blue-200" : "text-blue-600 hover:text-blue-800"
  }`;
}

function makeInitialSectionState(): SectionCollapsedState {
  return { preparation: false, cutting: false };
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
  return { ...input, common };
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

function inheritedDirtyKeys(
  input: MiningMethodInput,
  inheritedCommon: InheritedCommon | undefined,
  thickness: number | null | undefined,
  dipAngle: number | null | undefined,
): Set<string> {
  const source: InheritedCommon = {
    ...inheritedCommon,
    ...(thickness != null ? { trueThickness: thickness } : {}),
    ...(dipAngle != null ? { dipAngle } : {}),
  };
  const dirty = new Set<string>();
  for (const key of INHERITED_COMMON_KEYS) {
    if (key in source && input.common[key] !== (source[key] ?? null)) dirty.add(key);
  }
  return dirty;
}

function seedFromSavedOrTemplate(
  methodName: string,
  savedInput: MiningMethodInput | null | undefined,
  thickness: number | null | undefined,
  dipAngle: number | null | undefined,
  inheritedCommon: InheritedCommon | undefined,
  dirtyKeys: Set<string>,
): MiningMethodInput {
  const base = savedInput ?? createMethodInput(methodName);
  if (savedInput) {
    for (const key of inheritedDirtyKeys(savedInput, inheritedCommon, thickness, dipAngle)) dirtyKeys.add(key);
  }
  return applyInheritedCommon(base, inheritedCommon, thickness, dipAngle, dirtyKeys);
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
  savedInput,
  onMetricsChange,
}: CutAndFillWorkspaceProps) {
  const storageKey = workspaceKey || methodName || "method";
  const dirtyInherited = useRef<Record<string, Set<string>>>({});
  const [inputsByKey, setInputsByKey] = useState<Record<string, MiningMethodInput>>(() => {
    if (!methodName) return {};
    const dirty = new Set<string>();
    dirtyInherited.current[storageKey] = dirty;
    return {
      [storageKey]: seedFromSavedOrTemplate(methodName, savedInput, thickness, dipAngle, inheritedCommon, dirty),
    };
  });
  const [occurrenceCollapsed, setOccurrenceCollapsed] = useState<Record<string, boolean>>({});
  const [blockCollapsed, setBlockCollapsed] = useState<Record<string, boolean>>({});
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, SectionCollapsedState>>({});
  const [exportState, setExportState] = useState<"idle" | "busy" | "success" | "cancelled" | "error">("idle");
  const [exportMessage, setExportMessage] = useState("");
  const [templateVersion, setTemplateVersion] = useState(0);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [locateInput, setLocateInput] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!locateInput) return;
    const element = Array.from(workspaceRef.current?.querySelectorAll<HTMLElement>('[data-testid]') ?? [])
      .find((item) => item.dataset.testid === locateInput.id);
    if (!element) return;
    element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    element.focus({ preventScroll: true });
    element.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
    return () => element.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
  }, [locateInput]);

  const handleLocateInput = (id: string) => {
    if (id.startsWith('common-')) setOccurrenceCollapsed((previous) => ({ ...previous, [storageKey]: false }));
    if (id.startsWith('block-')) setBlockCollapsed((previous) => ({ ...previous, [storageKey]: false }));
    for (const section of SECTION_KEYS) {
      if (id.startsWith(section)) setSectionsCollapsed((previous) => ({
        ...previous, [storageKey]: { ...(previous[storageKey] ?? makeInitialSectionState()), [section]: false },
      }));
    }
    setLocateInput({ id });
  };

  if (!dirtyInherited.current[storageKey]) dirtyInherited.current[storageKey] = new Set();

  useEffect(() => {
    if (!methodName) return;
    setInputsByKey((previous) => {
      const current = previous[storageKey];
      if (!current) {
        const dirty = new Set<string>();
        dirtyInherited.current[storageKey] = dirty;
        return {
          ...previous,
          [storageKey]: seedFromSavedOrTemplate(methodName, savedInput, thickness, dipAngle, inheritedCommon, dirty),
        };
      }
      const dirty = dirtyInherited.current[storageKey] ?? new Set();
      const next = applyInheritedCommon(current, inheritedCommon, thickness, dipAngle, dirty);
      if (inheritedValuesEqual(current, next, dirty)) return previous;
      return { ...previous, [storageKey]: next };
    });
    setOccurrenceCollapsed((previous) => storageKey in previous ? previous : { ...previous, [storageKey]: true });
    setBlockCollapsed((previous) => storageKey in previous ? previous : { ...previous, [storageKey]: false });
    setSectionsCollapsed((previous) =>
      storageKey in previous ? previous : { ...previous, [storageKey]: makeInitialSectionState() },
    );
  }, [storageKey, methodName, thickness, dipAngle, inheritedCommon, savedInput]);

  const activeInput = methodName
    ? (inputsByKey[storageKey] ?? seedMethodInput(methodName, thickness, dipAngle, inheritedCommon))
    : null;
  const result = useMemo<CutAndFillResult | null>(
    () => (activeInput ? calculateCutAndFill(activeInput) : null),
    [activeInput],
  );
  const sectionState = sectionsCollapsed[storageKey] ?? makeInitialSectionState();
  const hasMethodModule = hasCutAndFillMethodModule(methodName);
  const appTitle = language === "en" ? "Mining engineering calculation" : "采矿工程计算";

  useEffect(() => {
    if (result && activeInput && onMetricsChange) onMetricsChange(result.metrics, activeInput);
  }, [result, activeInput, onMetricsChange]);

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
      return { ...previous, [storageKey]: updater(current) };
    });
    setExportState("idle");
    setExportMessage("");
  };

  const handleCommonChange = (key: OccurrenceParameterKey, value: number | null) => {
    if (INHERITED_COMMON_KEYS.includes(key as OccurrenceParameterKey)) {
      dirtyInherited.current[storageKey]?.add(key);
    }
    updateInput((input) => ({
      ...input,
      common: { ...input.common, [key]: value },
    }));
  };

  const handleIndicatorChange = (
    key: "blockLossDilution" | "preparationLossDilution" | "cuttingLossDilution",
    field: keyof LossDilutionIndicator,
    value: number | null,
  ) => {
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
    field: BlockDimensionField,
    value: number | null,
  ) => {
    updateInput((input) => ({
      ...input,
      blockElements: input.blockElements.map((element) =>
        element.id === id ? { ...element, [field]: value } : element,
      ),
    }));
  };

  const handleBlockShapeChange = (id: string, shape: PillarShape) => {
    updateInput((input) => ({
      ...input,
      blockElements: input.blockElements.map((element) =>
        element.id === id ? { ...element, shape } : element,
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
      blockElements: insertPillarElement(input.blockElements),
    }));
  };

  const handleRemoveBlockElement = (id: string) => {
    updateInput((input) => ({
      ...input,
      blockElements: input.blockElements.filter((element) => {
        if (element.id !== id) return true
        return isPanelElement(element) || isStopeElement(element)
      }),
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
      [section]: [...input[section], createBlankDevelopmentRow(section)],
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
    if (!activeInput || !result || exportState === "busy") return;
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

  const clearButton = (
    <button
      type="button"
      onClick={resetCurrentMethod}
      className={textActionClass(darkMode)}
      title="清空当前方法已填内容"
      aria-label="清空当前方法已填内容"
      data-testid="clear-cut-and-fill"
    >
      清空
    </button>
  );

  const exportButton = (
    <button
      type="button"
      onClick={() => void handleExport()}
      disabled={exportState === "busy"}
      className={textActionClass(darkMode)}
      title="导出当前方法的 Excel 工作簿"
      aria-label="导出当前方法的 Excel 工作簿"
      data-testid="export-cut-and-fill"
    >
      导出 Excel
    </button>
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
            请从采矿方法打开一个方法，进入矿体参数、矿块结构参数与采切工程。
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
      className={`min-h-0 flex-1 ${embedded ? "" : "overflow-y-auto"} ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}
      data-testid="cut-and-fill-workspace"
    >
      <div ref={workspaceRef} className={`flex min-w-0 w-full flex-col gap-3 ${embedded ? "" : "mx-auto max-w-[1880px] px-3 py-3 lg:px-5 lg:py-4"}`}>
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
                  本方法与手册其他方法共用采切计算模板，按矿块结构参数、采准与切割分别填写。项目：{projectName}
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
          {clearButton}
        </header>

        <OreBodyParametersPanel
          key={`${storageKey}-common-${templateVersion}`}
          common={activeInput.common}
          issues={result.issues}
          occurrenceCollapsed={occurrenceCollapsed[storageKey] ?? true}
          darkMode={darkMode}
          onChange={handleCommonChange}
          onToggleOccurrence={() =>
            setOccurrenceCollapsed((previous) => ({ ...previous, [storageKey]: !previous[storageKey] }))
          }
        />

        {hasMethodModule ? (
          <>
            <BlockElementsPanel
              key={`${storageKey}-block-${templateVersion}`}
              elements={activeInput.blockElements}
              input={activeInput}
              issues={result.issues}
              collapsed={Boolean(blockCollapsed[storageKey])}
              darkMode={darkMode}
              onToggle={() =>
                setBlockCollapsed((previous) => ({ ...previous, [storageKey]: !previous[storageKey] }))
              }
              onChange={handleBlockChange}
              onShapeChange={handleBlockShapeChange}
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
                  indicator={
                    section === "preparation"
                      ? activeInput.common.preparationLossDilution
                      : activeInput.common.cuttingLossDilution
                  }
                  issues={result.issues}
                  collapsed={sectionState[section]}
                  darkMode={darkMode}
                  onToggle={() => toggleSection(section)}
                  onAddRow={() => handleAddRow(section)}
                  onRemoveRow={(rowId) => handleRemoveRow(section, rowId)}
                  onRowChange={(rowId, field, value) => handleRowChange(section, rowId, field, value)}
                  onIndicatorChange={(field, value) =>
                    handleIndicatorChange(
                      section === "preparation" ? "preparationLossDilution" : "cuttingLossDilution",
                      field,
                      value,
                    )
                  }
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

        <div className="min-w-0">
          <CutAndFillResultTable
            key={`${storageKey}-result-${templateVersion}`}
            input={activeInput}
            result={result}
            darkMode={darkMode}
            headerAction={exportButton}
            onLocateInput={handleLocateInput}
          />
        </div>
        <CutAndFillMetrics result={result} darkMode={darkMode} />
      </div>
    </Frame>
  );
}
