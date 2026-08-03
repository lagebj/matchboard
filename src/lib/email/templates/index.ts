export { renderTemplate, getRegisteredTemplates, type TemplateKey, type TemplateData, type TemplatePayload, type TemplateRenderer } from "./registry";

// Import templates to trigger registration
import "./organisation-invitation";
import "./review-requested";
import "./review-changes-requested";
import "./ownership-assigned";
import "./ownership-handover-requested";