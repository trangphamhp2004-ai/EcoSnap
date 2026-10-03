// Deliberate release gate. Only change after the owner approves a real-image trial.
// No request, browser flag, admin setting, or environment variable can enable it.
export const LIVE_OPENAI_ENABLED: boolean = false;
// Owner approved 2026-10-03: one bounded admin-only trial. No runtime flag
// or user-supplied value can reopen it or reset the persistent attempt count.
export const ADMIN_TRIAL_ENABLED: boolean = false;
export const TRIAL_ID = 'owner-trial-2026-10-03-01';
export const TRIAL_EXPIRES_AT = Date.parse('2026-10-03T05:30:00Z');
export const TRIAL_CALL_LIMIT = 5;
export const TRIAL_BUDGET_VND = 20_000;
export const AI_MODEL = 'gpt-4.1-mini-2025-04-14';
export const DAILY_LIMIT = 5;
export const MONTHLY_LIMIT = 20;
export const BUDGET_CAP_VND = 5_000_000;
export const WARNING_VND = [3_500_000, 4_500_000] as const;
export const MAX_OUTPUT_TOKENS = 512;
export const PRODUCT_OUTPUT_TOKENS = 1500;
export const MODEL_CONTEXT_TOKENS = 1_047_576;
// Conservative internal conversion, not a live FX quote or invoice amount.
export const USD_TO_VND = 30_000;
export const INPUT_USD_PER_MILLION = 0.40;
export const OUTPUT_USD_PER_MILLION = 1.60;
// Reserve the entire model context plus capped output at uncached rates.
// This deliberately exceeds a normal image request; unused funds are released at settlement.
export const MIN_RESERVE_VND = Math.ceil((MODEL_CONTEXT_TOKENS * INPUT_USD_PER_MILLION + PRODUCT_OUTPUT_TOKENS * OUTPUT_USD_PER_MILLION) * USD_TO_VND / 1_000_000);
export const PROVIDER_TIMEOUT_MS = 25_000;
export const PENDING_TTL_MS = 120_000;
export const GROUPS = ['Nhựa','Giấy','Thủy tinh','Kim loại','Quần áo','Điện tử','Hữu cơ','Khác'] as const;
export const AI_DISABLED_MESSAGE = 'Nhận diện AI đang tắt, chờ chủ website duyệt thử nghiệm ảnh thật. Bạn vẫn có thể tra cứu thủ công.';
