import { Builder } from "metanui-ui/metanui/ui/building";

export function div(build: (obj: HTMLElement) => void): void {
  create("div", build);
}

export function span(build: (obj: HTMLElement) => void): void {
  create("span", build);
}

export function p(build: (obj: HTMLElement) => void): void {
  create("p", build);
}

export function h1(build: (obj: HTMLElement) => void): void {
  create("h1", build);
}

export function h2(build: (obj: HTMLElement) => void): void {
  create("h2", build);
}

export function h3(build: (obj: HTMLElement) => void): void {
  create("h3", build);
}

export function section(build: (obj: HTMLElement) => void): void {
  create("section", build);
}

export function button(build: (obj: HTMLButtonElement) => void): void {
  create("button", build);
}

export function input(build: (obj: HTMLInputElement) => void): void {
  create("input", build);
}

export function ul(build: (obj: HTMLElement) => void): void {
  create("ul", build);
}

export function li(build: (obj: HTMLElement) => void): void {
  create("li", build);
}

function create<TElement extends HTMLElement>(tagName: string, build: (obj: TElement) => void): void {
  Builder.create(document.createElement(tagName) as unknown as TElement, build);
}
