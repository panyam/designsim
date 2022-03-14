import NC from "../../../src/index";
const M = module as any;
declare const Handlebars: any;

export function initHandlebars() {
  if (Handlebars) {
    Handlebars.registerHelper("eachInMap", function (map: any, node: any) {
      let out = "";
      if (map) {
        Object.keys(map).map(function (prop) {
          out += node.fn({ key: prop, value: map[prop] });
        });
      }
      return out;
    });
    Handlebars.registerHelper("eitherVal", function (value: any, defaultValue: any) {
      const out = value || defaultValue;
      return new Handlebars.SafeString(out);
    });
  }
}

export function stripPrefixCodeSpaces(preTag: HTMLElement): void {
  const code = preTag.querySelector("code");
  if (code != null) {
    const lines = code.innerHTML.split("\n").filter((l, i) => {
      if (i == 0 && l.trim().length == 0) return false;
      return true;
    });
    const trimmed = lines.map((l) => (l as any).trimStart());
    const prefLens = lines.map((l, i) => (l.length == 0 ? 1024 : l.length - trimmed[i].length));
    const minPrefix = Math.min(...prefLens);
    const output = trimmed.map((l, i) => (l.length == 0 ? "" : " ".repeat(prefLens[i] - minPrefix) + l));
    code.innerHTML = output.join("\n");
  }
}

export function commonInit() {
  (window as any).NC = NC;
  initHandlebars();

  $(function () {
    const preTags = document.querySelectorAll("pre") || [];
    preTags.forEach(stripPrefixCodeSpaces);
  });
  if (M.hot) {
    M.hot.accept();
  }
}
