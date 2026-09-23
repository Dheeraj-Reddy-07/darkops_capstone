import { describe, it, expect } from "vitest";
import { analyzeComplaint } from "./nlp.service";

describe("NLP Classification Service", () => {
  it("A. Missing item", () => {
    const result = analyzeComplaint("Missing item", "My milk was missing from the order");
    expect(result.category).toBe("missing_item");
    expect(result.confidence).toBeGreaterThanOrEqual(80);
    expect(result.sentiment).not.toBe("positive");
  });

  it("B. Wrong item", () => {
    const result = analyzeComplaint("Wrong item delivered", "I ordered Pepsi but received Coke");
    expect(result.category).toBe("wrong_item");
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });

  it("C. Damaged item", () => {
    const result = analyzeComplaint("Damaged delivery", "The bottle arrived broken and leaking");
    expect(result.category).toBe("damaged_item");
    expect(result.confidence).toBeGreaterThanOrEqual(100); // 2 strong signals
  });

  it("D. Quality issue", () => {
    const result = analyzeComplaint("Bad quality", "The fruit was rotten");
    expect(result.category).toBe("quality_issue");
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });

  it("E. Late delivery", () => {
    const result = analyzeComplaint("Late", "My order arrived 45 minutes late");
    expect(result.category).toBe("late_delivery");
    expect(result.urgency_score).toBeGreaterThan(50); // Late delivery adds urgency boost
  });

  it("F. Payment/refund", () => {
    const result = analyzeComplaint("Payment issue", "I was charged twice for the same order");
    expect(result.category).toBe("payment_issue");
    expect(result.urgency_score).toBeGreaterThan(50); // Payment issues add urgency boost
  });

  it("G. High urgency", () => {
    const result = analyzeComplaint("Help!", "This is urgent, I need this resolved immediately");
    expect(result.urgency_score).toBeGreaterThan(90); // urgent + immediately
  });

  it("H. Low urgency", () => {
    const result = analyzeComplaint("Feedback", "No rush, please resolve it whenever possible");
    expect(result.urgency_score).toBeLessThan(50); // no rush + whenever
  });

  it("I. Ambiguous", () => {
    // A single weak/generic signal (wrong) creates low confidence due to lack of strong specifics
    const result = analyzeComplaint("Issue", "Something is wrong with my order");
    expect(result.confidence).toBeLessThanOrEqual(60);
  });

  it("J. Mixed evidence (Conflict penalty)", () => {
    const result = analyzeComplaint(
      "Messed up order",
      "The milk is missing and the replacement was also wrong",
    );
    // "missing" (3) vs "wrong" (3) + "replacement" (2)
    // There is a tight margin here, which should trigger a penalty.
    expect(result.confidence).toBeLessThan(100);
    // It shouldn't be a perfect 100 because of the competing 'missing_item' signal vs 'wrong_item' signal
  });

  it("K. Highly negative sentiment", () => {
    const result = analyzeComplaint(
      "Terrible service",
      "I am furious, this is the worst experience ever. Never again!",
    );
    expect(result.sentiment).toBe("highly_negative");
  });
});
