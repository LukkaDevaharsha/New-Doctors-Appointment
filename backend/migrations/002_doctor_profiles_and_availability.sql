ALTER TABLE users
  ADD COLUMN qualifications VARCHAR(500) NULL,
  ADD COLUMN years_experience SMALLINT UNSIGNED NULL,
  ADD COLUMN registration_number VARCHAR(120) NULL,
  ADD COLUMN biography TEXT NULL,
  ADD COLUMN languages_json JSON NULL,
  ADD COLUMN expertise_json JSON NULL,
  ADD COLUMN consultation_fee DECIMAL(10,2) NULL,
  ADD COLUMN clinic_address VARCHAR(500) NULL,
  ADD COLUMN city VARCHAR(120) NULL,
  ADD COLUMN state_region VARCHAR(120) NULL,
  ADD COLUMN postal_code VARCHAR(24) NULL,
  ADD COLUMN consultation_modes_json JSON NULL;

ALTER TABLE appointments
  ADD COLUMN cancellation_reason VARCHAR(500) NULL,
  ADD COLUMN cancelled_by BIGINT UNSIGNED NULL,
  ADD CONSTRAINT appointments_cancelled_by_fk FOREIGN KEY (cancelled_by) REFERENCES users(id);

CREATE TABLE doctor_availability (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id BIGINT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY doctor_availability_window_unique (doctor_id, weekday, start_time, end_time),
  KEY doctor_availability_day_idx (doctor_id, weekday, start_time),
  CONSTRAINT doctor_availability_owner_fk FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT doctor_availability_weekday_check CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT doctor_availability_window_check CHECK (start_time < end_time),
  CONSTRAINT doctor_availability_slot_check CHECK (slot_minutes BETWEEN 15 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE doctor_time_blocks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NOT NULL,
  reason VARCHAR(240) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY doctor_blocks_window_idx (doctor_id, starts_at, ends_at),
  CONSTRAINT doctor_time_blocks_owner_fk FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT doctor_time_blocks_window_check CHECK (starts_at < ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE appointment_reschedule_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  actor_role ENUM('patient','doctor') NOT NULL,
  previous_at DATETIME(3) NOT NULL,
  rescheduled_at DATETIME(3) NOT NULL,
  reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY appointment_reschedule_history_idx (appointment_id, created_at),
  CONSTRAINT reschedule_history_appointment_fk FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT reschedule_history_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
