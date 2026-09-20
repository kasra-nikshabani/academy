import { expect, test, type APIRequestContext } from "@playwright/test";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";
import { createCoachWithSquad, createParentOfSquadPlayer } from "./support/db";

/** A real one-pixel PNG, so the signature check passes on its own terms. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n", "utf8");

async function personIdOfPlayer(
  request: APIRequestContext,
  playerId: string,
): Promise<string> {
  const response = await request.get(`/api/v1/players/${playerId}`);
  expect(response.status()).toBe(200);
  return (await response.json()).data.person.id as string;
}

test.describe("documents", () => {
  test("an administrator uploads a document and reads it back", async ({
    page,
  }) => {
    const coachMobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(coachMobile);
    await signInAs(page, ["ADMIN"]);

    const personId = await personIdOfPlayer(page.request, squadPlayerId);

    const upload = await page.request.post("/api/v1/documents", {
      multipart: {
        personId,
        type: "BIRTH_CERTIFICATE",
        file: {
          name: "birth.png",
          mimeType: "image/png",
          buffer: PNG,
        },
      },
    });
    expect(upload.status(), await upload.text()).toBe(201);
    const document = (await upload.json()).data;

    expect(document.contentType).toBe("image/png");
    // The key is the server's, and says nothing about the upload.
    expect(document.storageKey).toMatch(
      /^documents\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f-]{36}\.png$/,
    );

    const file = await page.request.get(`/api/v1/documents/${document.id}`);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toBe("image/png");
    // Never sniffed, and never cached anywhere shared.
    expect(file.headers()["x-content-type-options"]).toBe("nosniff");
    expect(file.headers()["cache-control"]).toContain("no-store");
    expect(Buffer.from(await file.body()).equals(PNG)).toBe(true);
  });

  /** A PDF viewer runs scripts of its own, so it is always a download. */
  test("a PDF comes back as an attachment", async ({ page }) => {
    const coachMobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(coachMobile);
    await signInAs(page, ["ADMIN"]);

    const personId = await personIdOfPlayer(page.request, squadPlayerId);

    const upload = await page.request.post("/api/v1/documents", {
      multipart: {
        personId,
        type: "CONTRACT",
        file: {
          name: "contract.pdf",
          mimeType: "application/pdf",
          buffer: PDF,
        },
      },
    });
    expect(upload.status()).toBe(201);

    const file = await page.request.get(
      `/api/v1/documents/${(await upload.json()).data.id}`,
    );
    expect(file.headers()["content-disposition"]).toContain("attachment");
  });

  /**
   * The check the whole storage module exists for: a file may announce
   * anything, and only its bytes are evidence.
   */
  test("a script wearing an image's name and type is refused", async ({
    page,
  }) => {
    const coachMobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(coachMobile);
    await signInAs(page, ["ADMIN"]);

    const personId = await personIdOfPlayer(page.request, squadPlayerId);

    const response = await page.request.post("/api/v1/documents", {
      multipart: {
        personId,
        type: "PHOTO",
        file: {
          name: "innocent.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "<html><script>alert(document.cookie)</script></html>",
            "utf8",
          ),
        },
      },
    });

    expect(response.status()).toBe(422);
  });

  test("an SVG is refused, image though it is", async ({ page }) => {
    const coachMobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(coachMobile);
    await signInAs(page, ["ADMIN"]);

    const personId = await personIdOfPlayer(page.request, squadPlayerId);

    const response = await page.request.post("/api/v1/documents", {
      multipart: {
        personId,
        type: "PHOTO",
        file: {
          name: "logo.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            "utf8",
          ),
        },
      },
    });

    expect(response.status()).toBe(422);
  });

  /** Paperwork is the office's job; a coach reads and does not write. */
  test("a coach cannot upload", async ({ page }) => {
    const mobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const person = await page.request.get(`/api/v1/players/${squadPlayerId}`);
    const personId = (await person.json()).data.person.id;

    const response = await page.request.post("/api/v1/documents", {
      multipart: {
        personId,
        type: "PHOTO",
        file: { name: "x.png", mimeType: "image/png", buffer: PNG },
      },
    });

    expect(response.status()).toBe(403);
  });

  /**
   * There is no public address. A document id belonging to someone else is
   * answered the same way as one that does not exist.
   */
  test("another family's document cannot be fetched", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAs(adminPage, ["ADMIN"]);

    const coachMobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(coachMobile);
    const personId = await personIdOfPlayer(adminPage.request, squadPlayerId);

    const upload = await adminPage.request.post("/api/v1/documents", {
      multipart: {
        personId,
        type: "ID_DOCUMENT",
        file: { name: "id.png", mimeType: "image/png", buffer: PNG },
      },
    });
    const documentId = (await upload.json()).data.id;

    const parentMobile = uniqueMobile();
    await createParentOfSquadPlayer(parentMobile);
    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    await signIn(parentPage, parentMobile);

    const stolen = await parentPage.request.get(
      `/api/v1/documents/${documentId}`,
    );
    expect([403, 404]).toContain(stolen.status());

    await adminContext.close();
    await parentContext.close();
  });

  test("a signed-out visitor gets nothing", async ({ page }) => {
    const response = await page.request.get(
      "/api/v1/documents/cmxxxxxxxxxxxxxxxxxxxxxxx",
    );
    expect(response.status()).toBe(401);
  });

  /** The upload form, driven the way a person uses it. */
  test("the form on a player's record attaches a file", async ({ page }) => {
    const coachMobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(coachMobile);
    await signInAs(page, ["ADMIN"]);

    await page.goto(`/dashboard/people/players/${squadPlayerId}`);
    await expect(page.getByRole("heading", { name: "مدارک" })).toBeVisible();

    await page
      .getByLabel("فایل")
      .setInputFiles({
        name: "consent.png",
        mimeType: "image/png",
        buffer: PNG,
      });
    await page.getByRole("button", { name: "بارگذاری سند" }).click();

    await expect(page.getByText("سند بارگذاری شد")).toBeVisible();
    await expect(page.getByRole("link", { name: "consent.png" })).toBeVisible();
  });
});
