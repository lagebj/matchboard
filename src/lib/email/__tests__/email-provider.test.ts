import { describe, it, expect } from "vitest";
import type { NotificationTemplate } from "@/generated/prisma/client";
import { FakeEmailProvider } from "../fake-provider";
import { renderTemplate } from "../templates/index";
import "../templates/organisation-invitation";

describe("FakeEmailProvider", () => {
  it("should record sent emails", async () => {
    const provider = new FakeEmailProvider();
    const result = await provider.send({
      to: [{ email: "test@example.com" }],
      subject: "Test",
      htmlBody: "<p>Test</p>",
      textBody: "Test",
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^fake-\d+$/);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toEqual(["test@example.com"]);
    expect(provider.sent[0].subject).toBe("Test");
  });

  it("should record tags when provided", async () => {
    const provider = new FakeEmailProvider();
    await provider.send({
      to: [{ email: "a@b.com" }],
      subject: "Tagged",
      htmlBody: "<p>Hi</p>",
      textBody: "Hi",
      tags: { template: "ORGANISATION_INVITATION" },
    });

    expect(provider.sent[0].tags).toEqual({ template: "ORGANISATION_INVITATION" });
  });

  it("should fail when configured", async () => {
    const provider = new FakeEmailProvider();
    provider.failNextN(1);

    const result = await provider.send({
      to: [{ email: "test@example.com" }],
      subject: "Fail",
      htmlBody: "<p>Fail</p>",
      textBody: "Fail",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("forced failure");
  });

  it("should recover after forced failures", async () => {
    const provider = new FakeEmailProvider();
    provider.failNextN(2);

    const fail1 = await provider.send({
      to: [{ email: "test@example.com" }],
      subject: "Fail",
      htmlBody: "<p>Fail</p>",
      textBody: "Fail",
    });
    expect(fail1.success).toBe(false);

    const fail2 = await provider.send({
      to: [{ email: "test@example.com" }],
      subject: "Fail",
      htmlBody: "<p>Fail</p>",
      textBody: "Fail",
    });
    expect(fail2.success).toBe(false);

    const success = await provider.send({
      to: [{ email: "test@example.com" }],
      subject: "Success",
      htmlBody: "<p>Success</p>",
      textBody: "Success",
    });
    expect(success.success).toBe(true);
  });
});

describe("renderTemplate", () => {
  it("should throw for unknown template", () => {
    expect(() =>
      renderTemplate("ORGANISATION_INVITATION" as NotificationTemplate, {} as Record<string, unknown>),
    ).not.toThrow();
  });

  it("should render organisation invitation template with valid data", () => {
    const result = renderTemplate("ORGANISATION_INVITATION", {
      organisationName: "Test FC",
      inviterName: "Coach Alice",
      inviterEmail: "alice@testfc.com",
      inviteeEmail: "bob@example.com",
      role: "COACH",
      acceptUrl: "/invite/abc123",
      organisationSlug: "test-fc",
    });

    expect(result.subject).toContain("Coach Alice");
    expect(result.subject).toContain("Test FC");
    expect(result.htmlBody).toContain("Test FC");
    expect(result.textBody).toContain("Test FC");
    expect(result.textBody).toContain("/invite/abc123");
    expect(result.textBody).toContain("bob@example.com");
  });

  it("should use full URL when acceptUrl is relative", () => {
    const result = renderTemplate("ORGANISATION_INVITATION", {
      organisationName: "Club",
      inviterName: "Coach",
      inviterEmail: "coach@club.com",
      inviteeEmail: "player@club.com",
      role: "COACH",
      acceptUrl: "/invite/abc",
      organisationSlug: "club",
    });

    expect(result.textBody).toContain("http");
    expect(result.textBody).toContain("/invite/abc");
  });

  it("should use acceptUrl directly when it is absolute", () => {
    const result = renderTemplate("ORGANISATION_INVITATION", {
      organisationName: "Club",
      inviterName: "Coach",
      inviterEmail: "coach@club.com",
      inviteeEmail: "player@club.com",
      role: "COACH",
      acceptUrl: "https://app.matchboard.football/invite/abc",
      organisationSlug: "club",
    });

    expect(result.textBody).toContain("https://app.matchboard.football/invite/abc");
  });

  it("should escape HTML in user-provided content", () => {
    const result = renderTemplate("ORGANISATION_INVITATION", {
      organisationName: "<script>alert('xss')</script>",
      inviterName: "Coach",
      inviterEmail: "coach@club.com",
      inviteeEmail: "player@club.com",
      role: "COACH",
      acceptUrl: "/invite/abc",
      organisationSlug: "club",
    });

    expect(result.htmlBody).not.toContain("<script>");
    expect(result.htmlBody).toContain("&lt;script&gt;");
  });
});

describe("provider helpers", () => {
  it("getEmailFromAddress defaults correctly", async () => {
    const { getEmailFromAddress } = await import("../provider");
    expect(getEmailFromAddress()).toBe("notifications@matchboard.football");
  });

  it("getEmailFromName defaults correctly", async () => {
    const { getEmailFromName } = await import("../provider");
    expect(getEmailFromName()).toBe("Matchboard");
  });
});