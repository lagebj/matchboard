import { describe, it, expect } from "vitest";
import { renderTemplate } from "../templates/index";

describe("notification templates", () => {
  describe("ORGANISATION_INVITATION", () => {
    it("renders with required fields", () => {
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
      expect(result.htmlBody).toContain("bob@example.com");
      expect(result.textBody).toContain("Test FC");
    });
  });

  describe("REVIEW_REQUESTED", () => {
    it("renders with required fields", () => {
      const result = renderTemplate("REVIEW_REQUESTED", {
        organisationName: "Test FC",
        requesterName: "Coach Alice",
        requesterEmail: "alice@testfc.com",
        reviewerName: "Coach Bob",
        reviewerEmail: "bob@testfc.com",
        targetType: "MATCH_LINEUP",
        targetId: "match-1",
        targetLabel: "match-1",
        requestMessage: "Please review this lineup",
        reviewUrl: "/assistant",
        organisationSlug: "test-fc",
      });

      expect(result.subject).toContain("Coach Alice");
      expect(result.subject).toContain("Test FC");
      expect(result.htmlBody).toContain("Review requested");
      expect(result.htmlBody).toContain("MATCH_LINEUP");
      expect(result.htmlBody).toContain("Please review this lineup");
      expect(result.textBody).toContain("Review requested");
    });

    it("renders without requestMessage", () => {
      const result = renderTemplate("REVIEW_REQUESTED", {
        organisationName: "Test FC",
        requesterName: "Coach Alice",
        requesterEmail: "alice@testfc.com",
        reviewerName: "Coach Bob",
        reviewerEmail: "bob@testfc.com",
        targetType: "EVENT_SQUAD",
        targetId: "squad-1",
        targetLabel: "squad-1",
        requestMessage: null,
        reviewUrl: "/assistant",
        organisationSlug: "test-fc",
      });

      expect(result.subject).toContain("review");
      expect(result.textBody).not.toContain("Message:");
    });
  });

  describe("REVIEW_CHANGES_REQUESTED", () => {
    it("renders with reviewer comment", () => {
      const result = renderTemplate("REVIEW_CHANGES_REQUESTED", {
        organisationName: "Test FC",
        reviewerName: "Coach Bob",
        reviewerEmail: "bob@testfc.com",
        requesterName: "Coach Alice",
        requesterEmail: "alice@testfc.com",
        targetType: "MATCH_LINEUP",
        targetId: "match-1",
        targetLabel: "match-1",
        reviewerComment: "Need more defenders",
        reviewUrl: "/assistant",
        organisationSlug: "test-fc",
      });

      expect(result.subject).toContain("Changes requested");
      expect(result.htmlBody).toContain("Need more defenders");
      expect(result.htmlBody).toContain("alice@testfc.com");
    });
  });

  describe("REVIEW_SUPERSEDED", () => {
    it("renders with required fields", () => {
      const result = renderTemplate("REVIEW_SUPERSEDED", {
        organisationName: "Test FC",
        requesterName: "Coach Alice",
        requesterEmail: "alice@testfc.com",
        targetType: "EVENT_SQUAD",
        targetId: "squad-1",
        targetLabel: "squad-1",
        reason: "Squad regenerated",
        reviewUrl: "/assistant",
        organisationSlug: "test-fc",
      });

      expect(result.subject).toContain("Review superseded");
      expect(result.subject).toContain("Test FC");
      expect(result.htmlBody).toContain("superseded");
      expect(result.htmlBody).toContain("Squad regenerated");
      expect(result.textBody).toContain("Test FC");
    });
  });

  describe("OWNERSHIP_ASSIGNED", () => {
    it("renders with required fields", () => {
      const result = renderTemplate("OWNERSHIP_ASSIGNED", {
        organisationName: "Test FC",
        assignerName: "Coach Alice",
        assignerEmail: "alice@testfc.com",
        assigneeName: "Coach Bob",
        assigneeEmail: "bob@testfc.com",
        targetType: "MATCH_LINEUP",
        targetId: "match-1",
        targetLabel: "match-1",
        ownershipUrl: "/assistant",
        organisationSlug: "test-fc",
      });

      expect(result.subject).toContain("ownership");
      expect(result.subject).toContain("Test FC");
      expect(result.htmlBody).toContain("assigned you ownership");
      expect(result.textBody).toContain("Test FC");
    });
  });

  describe("OWNERSHIP_HANDOVER_REQUESTED", () => {
    it("renders with required fields", () => {
      const result = renderTemplate("OWNERSHIP_HANDOVER_REQUESTED", {
        organisationName: "Test FC",
        assignerName: "Coach Alice",
        assignerEmail: "alice@testfc.com",
        assigneeName: "Coach Bob",
        assigneeEmail: "bob@testfc.com",
        targetType: "EVENT_SQUAD",
        targetId: "squad-1",
        targetLabel: "squad-1",
        ownershipUrl: "/assistant",
        organisationSlug: "test-fc",
      });

      expect(result.subject).toContain("handover");
      expect(result.subject).toContain("Test FC");
      expect(result.htmlBody).toContain("take over ownership");
      expect(result.textBody).toContain("Test FC");
    });
  });
});