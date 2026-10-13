import { expect, test } from "@playwright/test";

const DESIGN_HEADING = "責務を小さく。";

test("SSR is readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("表示は");
  await page.getByRole("link", { name: "Design", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
  await context.close();
});

test("hydrates from the embedded Flight; links and history keep client state", async ({
  page,
}) => {
  const flightRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.headers().accept === "text/x-component") flightRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Client count: 0" }).click();
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();
  expect(flightRequests).toHaveLength(0);

  await page.getByRole("link", { name: "Design", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();
  await expect(page.getByTestId("location")).toHaveText("/about");
  expect(flightRequests).toEqual(["http://127.0.0.1:4173/about"]);

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("表示は");
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();
  await expect(page.getByTestId("location")).toHaveText("/");
  expect(flightRequests).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("explicit POST followed by refresh() updates the RSC tree and keeps state", async ({
  page,
}) => {
  await page.goto("/notes");
  await page.getByRole("button", { name: "Client count: 0" }).click();
  await page.getByLabel("新しいメモ").fill("E2E で API 更新を検証");
  await page.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByRole("link", { name: "E2E で API 更新を検証" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();
  await expect(page.getByLabel("新しいメモ")).toHaveValue("");

  const added = page.getByRole("link", { name: "E2E で API 更新を検証" });
  const href = await added.getAttribute("href");
  await added.click();
  await expect(page.getByTestId("context")).toContainText(`${href} / id=${href?.split("/").pop()}`);
});

test("HTTP contract: content negotiation, HEAD, 404, and no page mutations", async ({
  request,
}) => {
  const html = await request.get("/");
  expect(html.headers()["content-type"]).toContain("text/html");
  expect(html.headers().vary).toContain("Accept");
  expect(html.headers()["cache-control"]).toBe("private, no-store");
  expect(await html.text()).toContain("<!DOCTYPE html>");

  const flight = await request.get("/", { headers: { Accept: "text/x-component" } });
  expect(flight.headers()["content-type"]).toContain("text/x-component");
  expect(await flight.text()).not.toContain("<!DOCTYPE");

  const head = await request.head("/");
  expect(head.status()).toBe(200);
  expect(head.headers()["content-type"]).toContain("text/html");

  const missing = await request.get("/missing");
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("404");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await request.fetch("/notes", {
      method,
      headers: { "Next-Action": "arbitrary" },
      data: "not-a-flight-payload",
    });
    expect(response.status(), method).toBe(405);
    expect(response.headers().allow).toBe("GET, HEAD");
  }
});

test("concurrent streaming requests keep their own URL and params", async ({ request }) => {
  const ids = ["a", "b", "c"];
  const bodies = await Promise.all(
    ids.map((id) =>
      request
        .get(`/slow/${id}?ms=30`, { headers: { Accept: "text/x-component" } })
        .then((response) => response.text()),
    ),
  );
  bodies.forEach((body, index) => {
    const id = ids[index];
    expect(body).toContain(`"/slow/${id}"," / id=","${id}"`);
    for (const other of ids.filter((candidate) => candidate !== id)) {
      expect(body).not.toContain(`/slow/${other}`);
    }
  });
});

test("a newer navigation wins over a delayed older response", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Client count: 0" }).click();
  await page.route("**/slow/old*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue().catch(() => {});
  });
  await page.evaluate(() => {
    void navigation.navigate("/slow/old?ms=200").finished.catch(() => {});
  });
  await page.waitForTimeout(30);
  await page.evaluate(() => {
    void navigation.navigate("/about").finished;
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
  await page.waitForTimeout(600);
  await expect(page.getByTestId("location")).toHaveText("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();
});

test("a redirect falls back to a document navigation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    void navigation.navigate("/old-about").finished.catch(() => {});
  });
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
});

test("an unknown URL renders the 404 page in place", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Client count: 0" }).click();
  await page.evaluate(() => {
    void navigation.navigate("/not-found").finished;
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();
});

test("links to /api and data-native links are not intercepted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Client count: 0" }).click();
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/about";
    link.dataset.native = "";
    link.textContent = "native link";
    document.body.append(link);
  });
  await page.getByRole("link", { name: "native link" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
  // A document load resets client state.
  await expect(page.getByRole("button", { name: "Client count: 0" })).toBeVisible();
});

test("static export serves HTML and Flight without the RSC server", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4174/");
  await page.getByRole("button", { name: "Client count: 0" }).click();
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();

  const flight = page.waitForResponse("**/about/index.rsc");
  await page.getByRole("link", { name: "Design", exact: true }).click();
  const response = await flight;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/x-component");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();
  await expect(page.getByTestId("location")).toHaveText("/about");
  expect(errors).toEqual([]);
});

test("without the Navigation API, links are ordinary document navigations", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "navigation", { value: undefined }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Client count: 0" }).click();
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();
  await page.getByRole("link", { name: "Design", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
  await expect(page.getByRole("button", { name: "Client count: 0" })).toBeVisible();
});

test("a failed Flight fetch shows a recovery link at the destination URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Client count: 0" }).click();
  await expect(page.getByRole("button", { name: "Client count: 1" })).toBeVisible();

  await page.route("**/about", (route) => route.abort());
  await page.getByRole("link", { name: "Design", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "This page could not be displayed",
  );
  await expect(page).toHaveURL(/\/about$/);

  await page.unroute("**/about");
  await page.getByRole("link", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DESIGN_HEADING);
});
