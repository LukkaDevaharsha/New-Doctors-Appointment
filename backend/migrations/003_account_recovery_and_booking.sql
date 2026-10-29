ALTER TABLE users
  ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN password_reset_token_hash CHAR(64) NULL,
  ADD COLUMN password_reset_expires_at DATETIME(3) NULL,
  ADD COLUMN password_reset_sent_at DATETIME(3) NULL,
  ADD UNIQUE KEY users_password_reset_token_unique (password_reset_token_hash);

ALTER TABLE appointments
  ADD COLUMN visit_reason VARCHAR(500) NULL,
  ADD COLUMN patient_contact_number VARCHAR(40) NULL,
  ADD COLUMN payment_method ENUM('pay_at_hospital') NOT NULL DEFAULT 'pay_at_hospital',
  ADD COLUMN payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending';
