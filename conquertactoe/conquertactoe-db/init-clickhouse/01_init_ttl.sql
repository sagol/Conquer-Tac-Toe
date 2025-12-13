ALTER TABLE system.text_log MODIFY TTL event_time + INTERVAL 3 DAY;
ALTER TABLE system.query_log MODIFY TTL event_time + INTERVAL 3 DAY;
ALTER TABLE system.trace_log MODIFY TTL event_time + INTERVAL 3 DAY;
