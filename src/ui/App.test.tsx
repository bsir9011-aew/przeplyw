import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import App from "./App";

it("prowadzi od przewidywania przez wynik do zablokowanego edytora ACL", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html.indexOf('class="lab-panel"')).toBeLessThan(
    html.indexOf('class="result-panel"'),
  );
  expect(html.indexOf('class="result-panel"')).toBeLessThan(
    html.indexOf('class="rules-panel"'),
  );
  expect(html).toMatch(
    /<button[^>]*disabled=""[^>]*>⇅ Zamień kolejność<\/button>/,
  );
  expect(html).toContain(
    "Najpierw przewidź przebieg i uruchom pierwszą symulację.",
  );
  expect(html).toContain("do serwera. <br/>");
});
