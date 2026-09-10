import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CutAndFillGuidePage from "./CutAndFillGuidePage";
import { ProjectProvider } from "../../context/ProjectContext";
import { HANDBOOK_METHOD_NAMES } from "../../mining/cutAndFillStandards";
import { createEmptyProject, createOreBody } from "../../mining/project";

function readyProject(thickness = 3, dipAngle = 35) {
  const body = createOreBody({ name: "1号矿体", dipAngle, thickness });
  return {
    bodyId: body.id,
    project: {
      ...createEmptyProject("测试矿"),
      oreDensity: 2.7,
      wasteDensity: 2.6,
      oreBodies: [body],
    },
  };
}

function renderGuide(thickness = 3, dipAngle = 35) {
  const { project, bodyId } = readyProject(thickness, dipAngle);
  return render(
    <ProjectProvider initialProject={project} initialStage="methods" initialOreBodyId={bodyId}>
      <CutAndFillGuidePage />
    </ProjectProvider>,
  );
}

function addMethod(methodName: string) {
  fireEvent.click(screen.getByRole("button", { name: "新建方法" }));
  fireEvent.change(screen.getByLabelText("采矿方法"), {
    target: { value: methodName },
  });
}

describe("ore-body method summary", () => {
  it("keeps the ore-body summary free of method-selection standards and filters", () => {
    renderGuide();

    expect(screen.getByRole("heading", { name: /^采矿方法$/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "规范依据与判断准则" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("standard-method-table"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("quick-calc-trigger")).not.toBeInTheDocument();
    expect(screen.getByTestId("cut-and-fill-point-list")).not.toHaveTextContent(
      "状态",
    );
    expect(screen.getByTestId("cut-and-fill-point-list")).not.toHaveTextContent(
      "待开发",
    );
  });

  it("adds a searchable method row in the ore-body table and opens assisted selection", () => {
    renderGuide();

    fireEvent.click(screen.getByRole("button", { name: "新建方法" }));
    expect(
      screen.queryByRole("dialog", { name: "采矿方法选择" }),
    ).not.toBeInTheDocument();

    const methodSelect = screen.getByLabelText("采矿方法");
    expect(methodSelect).toHaveValue("");
    expect(methodSelect).toHaveAttribute("placeholder", "请选择或输入");
    fireEvent.focus(methodSelect);
    expect(methodSelect).toHaveClass("text-center");
    const methodList = screen.getByTestId("method-combobox-list");
    expect(methodList).toHaveStyle({ position: "fixed" });
    expect(methodList).toHaveClass("overflow-x-hidden");
    expect(screen.getByTestId("cut-and-fill-point-list")).not.toContainElement(
      methodList,
    );
    HANDBOOK_METHOD_NAMES.forEach((methodName) => {
      expect(methodList).toHaveTextContent(methodName);
    });
    fireEvent.change(methodSelect, { target: { value: "上向" } });
    expect(methodList).toHaveTextContent("上向进路充填法");
    expect(methodList).not.toHaveTextContent("全面法");
    expect(
      screen.getByRole("button", { name: "按矿体条件选择" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "按矿体条件选择" }));
    expect(screen.getByRole("heading", { name: /^采矿方法$/ })).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "按矿体条件选择采矿方法" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("method-assist-dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "规范依据与判断准则" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
    expect(
      screen
        .getByTestId("assist-inputs")
        .compareDocumentPosition(screen.getByTestId("standard-method-table")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByLabelText("厚度")).toHaveValue("3");
    expect(screen.getByLabelText("倾角")).toHaveValue("35");
    expect(screen.getByTestId("selected-standard-range")).toHaveTextContent(
      "薄矿体",
    );
    expect(screen.getByTestId("standard-cell-thin-inclined")).toHaveClass(
      "ring-2",
    );
    expect(screen.getByTestId("standard-recommendations")).toHaveTextContent(
      "爆力运矿采矿法、分层崩落法、上向进路充填法、下向分层充填法",
    );
  });

  it("prefills assisted selection from the current ore body each time it opens", () => {
    renderGuide();

    fireEvent.click(screen.getByRole("button", { name: "按矿体条件选择" }));
    fireEvent.click(
      screen.getByRole("button", { name: "选择厚矿体 × 急倾斜矿体" }),
    );
    expect(screen.getByLabelText("厚度")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    fireEvent.click(screen.getByRole("button", { name: "按矿体条件选择" }));

    expect(screen.getByLabelText("厚度")).toHaveValue("3");
    expect(screen.getByLabelText("倾角")).toHaveValue("35");
    expect(screen.getByTestId("selected-standard-range")).toHaveTextContent(
      "薄矿体",
    );
    expect(screen.getByTestId("standard-cell-thin-inclined")).toHaveClass(
      "ring-2",
    );
  });

  it("creates a specified handbook method without opening the calculation area", () => {
    renderGuide();

    addMethod("上向进路充填法");

    expect(screen.getByDisplayValue("上向进路充填法")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("请输入名称")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("名称 1"), {
      target: { value: "方案甲" },
    });
    expect(screen.getByDisplayValue("方案甲")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "名称" })).toBeInTheDocument();
    expect(
      screen.queryByTestId("method-calculation-page"),
    ).not.toBeInTheDocument();
  });

  it("adds every method from the selected handbook region through assisted selection", () => {
    renderGuide();

    fireEvent.click(screen.getByRole("button", { name: "按矿体条件选择" }));
    expect(screen.getByTestId("standard-recommendations")).toHaveTextContent(
      "爆力运矿采矿法、分层崩落法、上向进路充填法、下向分层充填法",
    );

    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    expect(screen.getByDisplayValue("上向进路充填法")).toBeInTheDocument();
    expect(screen.getByDisplayValue("爆力运矿采矿法")).toBeInTheDocument();
    expect(screen.getByDisplayValue("下向分层充填法")).toBeInTheDocument();
    expect(screen.getByTestId("cut-and-fill-point-list")).not.toHaveTextContent(
      "待开发",
    );
  });

  it("keeps numeric ore-body inputs and table picking mutually exclusive", () => {
    renderGuide();

    fireEvent.click(screen.getByRole("button", { name: "按矿体条件选择" }));
    expect(screen.getByLabelText("厚度")).toHaveValue("3");
    expect(screen.getByTestId("standard-cell-thin-inclined")).toHaveClass(
      "ring-2",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "选择厚矿体 × 急倾斜矿体" }),
    );
    expect(screen.getByLabelText("厚度")).toHaveValue("");
    expect(screen.getByLabelText("倾角")).toHaveValue("");
    expect(screen.getByTestId("standard-cell-thick-steep")).toHaveClass(
      "ring-2",
    );
    expect(screen.getByTestId("standard-cell-thin-inclined")).not.toHaveClass(
      "ring-2",
    );

    fireEvent.change(screen.getByLabelText("厚度"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("倾角"), {
      target: { value: "35" },
    });
    expect(screen.getByTestId("standard-cell-thin-inclined")).toHaveClass(
      "ring-2",
    );
    expect(screen.getByTestId("standard-cell-thick-steep")).not.toHaveClass(
      "ring-2",
    );
  });

  it("lets the handbook table fill the assist dialog width with compact row padding", () => {
    renderGuide();

    fireEvent.click(screen.getByRole("button", { name: "按矿体条件选择" }));

    expect(screen.getByTestId("standard-method-table")).toHaveClass(
      "h-full",
      "w-full",
      "text-base",
    );
    expect(
      screen.getByRole("button", { name: "选择薄矿体 × 倾斜矿体" }),
    ).toHaveClass("text-base");
  });

  it("opens a handbook method into the calculation area from the ore-body table", () => {
    renderGuide();

    addMethod("全面法");
    fireEvent.click(screen.getByRole("button", { name: "打开方法 全面法" }));

    expect(
      screen.queryByRole("heading", { name: /^采矿方法$/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("method-calculation-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "全面法" })).toBeInTheDocument();
    expect(screen.getByTestId("cut-and-fill-workspace")).toBeInTheDocument();
    expect(screen.getByText("参照指标")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /矿体参数/ }));
    expect(screen.getByLabelText("矿体密度")).toHaveValue("2.7");
    expect(screen.getByLabelText("矿体密度")).not.toBeDisabled();
    expect(screen.getByLabelText("矿体倾角")).not.toBeDisabled();
    expect(screen.getByTestId("method-page-back")).toBeInTheDocument();
  });

  it("opens the upward drift cut-and-fill module with inherited densities", () => {
    renderGuide();

    addMethod("上向进路充填法");
    fireEvent.click(screen.getByRole("button", { name: "打开方法 上向进路充填法" }));

    expect(screen.getByTestId("engineering-section-preparation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /矿体参数/ }));
    expect(screen.getByLabelText("矿体密度")).toHaveValue("2.7");
    const header = screen.getByTestId("method-workspace-header");
    expect(header).toContainElement(screen.getByTestId("clear-cut-and-fill"));
    expect(header).toContainElement(screen.getByTestId("export-cut-and-fill"));
  });

  it("adopts one method to complete the ore body", () => {
    renderGuide();
    addMethod("全面法");
    fireEvent.click(screen.getByRole("radio", { name: "采用 全面法" }));
    expect(screen.getByRole("radio", { name: "采用 全面法" })).toBeChecked();
  });

  it("uses an icon-only back control on the left of nested page breadcrumbs", () => {
    renderGuide();

    addMethod("全面法");
    fireEvent.click(screen.getByRole("button", { name: "打开方法 全面法" }));
    const back = screen.getByTestId("method-page-back");
    expect(back).toHaveAttribute("aria-label", "返回采矿方法");
    expect(back).not.toHaveTextContent("返回采矿方法");
    expect(back.parentElement).toHaveTextContent("方法计算区");
  });

  it("requires an explicit method choice before opening calculation", () => {
    renderGuide();

    fireEvent.click(screen.getByRole("button", { name: "新建方法" }));
    expect(screen.getByRole("button", { name: "打开方法" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "采用方法" })).toBeDisabled();
  });

  it("shows the key cut-and-fill results in the ore-body method area", () => {
    renderGuide();

    const points = screen.getByTestId("cut-and-fill-point-list");
    expect(points).toHaveTextContent("采用");
    expect(points).toHaveTextContent("采准比");
    expect(points).toHaveTextContent("切割比");
    expect(points).toHaveTextContent("采切比");
    expect(points).toHaveTextContent("废石率");
    expect(points).toHaveTextContent("副产比");
    expect(points).toHaveTextContent("回采率");
    expect(points).toHaveTextContent("损失率");
    expect(points).toHaveTextContent("贫化率");
    expect(points).not.toHaveTextContent("m/kt");
  });

  it("fills calculated ratios into a handbook method row", () => {
    renderGuide();

    addMethod("全面法");

    const points = screen.getByTestId("cut-and-fill-point-list");
    expect(points).toHaveTextContent("0.000");
  });
});
