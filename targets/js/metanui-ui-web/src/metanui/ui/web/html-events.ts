export function onClick(element: HTMLElement, handler: () => void): void {
  element.addEventListener("click", handler);
}

export function onInput(input: HTMLInputElement, handler: (obj: string) => void): void {
  input.addEventListener("input", () => handler(input.value));
}
