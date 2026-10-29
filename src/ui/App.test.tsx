import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import App from "./App";
import ScenarioEditor from "./ScenarioEditor";
import { scenarioNetwork } from "../scenarios/labs";
it("pokazuje prosty wybór trzech laboratoriów", () => {
  const html = renderToStaticMarkup(<App />);
  for (const id of ["ACL", "GATEWAY", "VLAN"])
    expect(html).toContain(`Rozpocznij · ${id}`);
  expect(html).toContain("Wybór laboratorium");
  expect(html).not.toContain("lab-panel");
});
it("nie ujawnia formularza naprawy Gateway lub VLAN przed próbą", () => {
  for (const id of ["gateway", "vlan"] as const) {
    const html = renderToStaticMarkup(
      <ScenarioEditor
        id={id}
        network={scenarioNetwork(id)}
        enabled={false}
        undo={false}
        revision={0}
        onChange={() => {}}
        onUndo={() => {}}
      />,
    );
    expect(html).not.toContain("<input");
    expect(html).toContain("Najpierw przewidź");
  }
});
it("blokuje zmianę ACL przed próbą", () => {
  const html = renderToStaticMarkup(
    <ScenarioEditor
      id="acl"
      network={scenarioNetwork("acl")}
      enabled={false}
      undo={false}
      revision={0}
      onChange={() => {}}
      onUndo={() => {}}
    />,
  );
  expect(html).toMatch(
    /<button[^>]*disabled=""[^>]*>⇅ Zamień kolejność<\/button>/,
  );
});
