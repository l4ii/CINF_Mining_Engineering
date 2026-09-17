import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import AssistantPanel from "./AssistantPanel";
import {
  ASSISTANT_DISMISSED_KEY,
  AssistantProvider,
} from "../context/AssistantContext";

function renderPanel(pageKey = "overview") {
  return render(
    <AssistantProvider pageKey={pageKey}>
      <AssistantPanel
        darkMode={false}
        language="zh"
        onMethodSelect={() => {}}
      />
    </AssistantProvider>,
  );
}

describe("AssistantPanel", () => {
  beforeEach(() => {
    sessionStorage.removeItem(ASSISTANT_DISMISSED_KEY);
  });

  it("hides the dock after the close control is clicked", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "智能助手" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭智能助手" }));
    expect(
      screen.queryByRole("button", { name: "智能助手" }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem(ASSISTANT_DISMISSED_KEY)).toBe("1");
  });

  it("stays hidden when the same page re-renders", () => {
    const { rerender } = renderPanel("overview");
    fireEvent.click(screen.getByRole("button", { name: "关闭智能助手" }));

    rerender(
      <AssistantProvider pageKey="overview">
        <AssistantPanel
          darkMode={false}
          language="zh"
          onMethodSelect={() => {}}
        />
      </AssistantProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "智能助手" }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem(ASSISTANT_DISMISSED_KEY)).toBe("1");
  });

  it("restores the dock after switching pages", () => {
    const { rerender } = renderPanel("overview");
    fireEvent.click(screen.getByRole("button", { name: "关闭智能助手" }));

    rerender(
      <AssistantProvider pageKey="settings">
        <AssistantPanel
          darkMode={false}
          language="zh"
          onMethodSelect={() => {}}
        />
      </AssistantProvider>,
    );

    expect(screen.getByRole("button", { name: "智能助手" })).toBeInTheDocument();
    expect(sessionStorage.getItem(ASSISTANT_DISMISSED_KEY)).toBeNull();
  });
});
