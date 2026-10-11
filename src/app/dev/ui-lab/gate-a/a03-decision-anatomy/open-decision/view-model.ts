import { situationText, consequenceText, reasonText, PENDING_STARTER_NAME, UNFILLED_SLOT_LABEL } from "./fixtures";

export function buildDecisionCopy() {
  return {
    situation: situationText,
    actionLabel: `Assign ${PENDING_STARTER_NAME} to ${UNFILLED_SLOT_LABEL}`,
    consequence: consequenceText,
    reason: reasonText,
  };
}
