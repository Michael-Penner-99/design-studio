// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello() { return <h1>hello</h1>; }

describe("jsdom smoke", () => {
  it("renders a component", () => {
    render(<Hello />);
    expect(screen.getByText("hello")).toBeTruthy();
  });
});
