import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import AssistantPanel from "./AssistantPanel";
import {
  ASSISTANT_DISMISSED_KEY,
  AssistantProvider,
} from "../context/AssistantContext";

describe("AssistantPanel", () => {
  beforeEach(() => {
    sessionStorage.removeItem(ASSISTANT_DISMISSED_KEY);
  });

  it("hides the dock after the close control is clicked", () => {
    render(
      <AssistantProvider>
        <AssistantPanel
          darkMode={false}
          language="zh"
          onMethodSelect={() => {}}
        />
      </AssistantProvider>,
    );

    expect(screen.getByRole("button", { name: "智能助手" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭智能助手" }));
    expect(
      screen.queryByRole("button", { name: "智能助手" }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem(ASSISTANT_DISMISSED_KEY)).toBe("1");
  });
});
