import { expect, test } from "bun:test";

// The element factories and event extensions are module functions, so a bundle keeps only the
// ones it imports: an entry with Div and OnClick carries no other factory's tag name.

const unusedTags = ["span", "p", "h1", "h2", "h3", "section", "button", "input", "ul", "li"];

const quoted = (word: string) => new RegExp(`["'\`]${word}["'\`]`);

test("a bundle using only Div and OnClick drops the other factories", async () => {
  const result = await Bun.build({
    entrypoints: [`${import.meta.dir}/tree-shaking/div-and-click.ts`],
    minify: true,
    conditions: ["bun"],
  });

  expect(result.success).toBe(true);

  const bundle = await result.outputs[0]!.text();

  expect(bundle).toMatch(quoted("div"));
  expect(bundle).toMatch(quoted("click"));
  expect(unusedTags.filter((tag) => quoted(tag).test(bundle))).toEqual([]);
});
