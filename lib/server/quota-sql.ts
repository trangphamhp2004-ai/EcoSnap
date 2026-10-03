// Admission is a single SQLite statement. D1 serializes these writes across tabs/users.
export const RESERVE_SQL=`INSERT INTO ai_requests(id,user_id,request_key,day,month,status,reserve_vnd,created_at,image_hash)
SELECT ?,?,?,?,?,'pending',MAX(s.reserve_vnd,?),?,? FROM settings s,users u
WHERE s.id='main' AND u.id=? AND u.cooldown_until<=?
AND NOT EXISTS(SELECT 1 FROM ai_requests WHERE user_id=u.id AND status='pending')
AND (SELECT COUNT(*) FROM ai_requests WHERE user_id=u.id AND day=? AND status IN ('pending','success'))<5
AND (SELECT COUNT(*) FROM ai_requests WHERE user_id=u.id AND month=? AND status IN ('pending','success'))<20
AND COALESCE((SELECT SUM(cost_vnd+CASE WHEN status='pending' THEN reserve_vnd ELSE 0 END) FROM ai_requests WHERE month=?),0)+MAX(s.reserve_vnd,?)<=MIN(s.budget_vnd,5000000)
ON CONFLICT DO NOTHING RETURNING *`;
// All trial checks are part of the same serialized admission write as the
// ordinary quota/budget reservation. Attempts include every terminal outcome.
export const TRIAL_RESERVE_SQL=RESERVE_SQL
 .replace('created_at,image_hash)', 'created_at,image_hash,trial_run_id)')
 .replace("MAX(s.reserve_vnd,?),?,? FROM", "MAX(s.reserve_vnd,?),?,?,? FROM")
 .replace('ON CONFLICT DO NOTHING', `AND u.role='admin' AND ?<?
AND (SELECT COUNT(*) FROM ai_requests WHERE trial_run_id=?)<?
AND COALESCE((SELECT SUM(cost_vnd+CASE WHEN status='pending' THEN reserve_vnd ELSE 0 END) FROM ai_requests WHERE trial_run_id=?),0)+MAX(s.reserve_vnd,?)<=?
ON CONFLICT DO NOTHING`);
export const FAILURE_SQL=`UPDATE users SET cooldown_until=CASE WHEN ?='unknown' AND failures>=2 THEN ?+600000 ELSE cooldown_until END, failures=CASE WHEN ?='unknown' THEN CASE WHEN failures>=2 THEN 0 ELSE failures+1 END WHEN ? IN ('success','no_guidance') THEN 0 ELSE failures END WHERE id=(SELECT user_id FROM ai_requests WHERE id=? AND status='pending')`;
export const SETTLE_SQL=`UPDATE ai_requests SET status=?,cost_vnd=?,model=?,input_tokens=?,output_tokens=?,completed_at=?,result_json=?,cost_estimated=?,provider_response_id=? WHERE id=? AND status='pending'`;
