-- Create indexes for performance

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_stores_city ON stores(city);
CREATE INDEX idx_stores_zone ON stores(zone);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_complaints_customer_id ON complaints(customer_id);
CREATE INDEX idx_complaints_order_id ON complaints(order_id);
CREATE INDEX idx_complaints_store_id ON complaints(store_id);
CREATE INDEX idx_complaints_assigned_agent ON complaints(assigned_agent_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_fraud_reviews_complaint_id ON fraud_reviews(complaint_id);
CREATE INDEX idx_fraud_reviews_decision ON fraud_reviews(decision);
CREATE INDEX idx_pulse_scores_store_id ON pulse_scores(store_id);
CREATE INDEX idx_work_orders_store_id ON work_orders(store_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
