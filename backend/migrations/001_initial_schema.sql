CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role ENUM('patient','doctor','admin') NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  contact_number VARCHAR(40) NULL,
  age SMALLINT UNSIGNED NULL,
  gender VARCHAR(40) NULL,
  address VARCHAR(500) NULL,
  specialization VARCHAR(150) NULL,
  hospital_name VARCHAR(180) NULL,
  image_storage_id VARCHAR(80) NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token_hash CHAR(64) NULL,
  verification_expires_at DATETIME(3) NULL,
  verification_sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  UNIQUE KEY users_verification_token_unique (verification_token_hash),
  KEY users_role_idx (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  appointment_at DATETIME(3) NOT NULL,
  status ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  active_slot DATETIME(3) GENERATED ALWAYS AS (CASE WHEN status IN ('scheduled','completed') THEN appointment_at ELSE NULL END) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY appointment_doctor_slot_unique (doctor_id, active_slot),
  KEY appointments_patient_date_idx (patient_id, appointment_at),
  CONSTRAINT appointments_doctor_fk FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT appointments_patient_fk FOREIGN KEY (patient_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS patient_medical_history (
  patient_id BIGINT UNSIGNED NOT NULL,
  allergies JSON NOT NULL,
  conditions_json JSON NOT NULL,
  medications JSON NOT NULL,
  surgeries JSON NOT NULL,
  notes TEXT NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (patient_id),
  CONSTRAINT history_patient_fk FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT history_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT history_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS consultation_notes (
  appointment_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  summary TEXT NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (appointment_id),
  CONSTRAINT notes_appointment_fk FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT notes_patient_fk FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT notes_doctor_fk FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT notes_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT notes_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS medical_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  storage_id VARCHAR(80) NOT NULL,
  original_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  category VARCHAR(60) NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY documents_storage_id_unique (storage_id),
  KEY documents_patient_created_idx (patient_id, created_at),
  CONSTRAINT documents_patient_fk FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT documents_appointment_fk FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT documents_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS document_shares (
  document_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  shared_by BIGINT UNSIGNED NOT NULL,
  shared_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (document_id, doctor_id),
  CONSTRAINT shares_document_fk FOREIGN KEY (document_id) REFERENCES medical_documents(id),
  CONSTRAINT shares_doctor_fk FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT shares_actor_fk FOREIGN KEY (shared_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS document_access_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  actor_role ENUM('patient','doctor','admin') NOT NULL,
  action ENUM('uploaded','shared','revoked','accessed') NOT NULL,
  target_doctor_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY document_audit_idx (document_id, created_at),
  CONSTRAINT document_audit_document_fk FOREIGN KEY (document_id) REFERENCES medical_documents(id),
  CONSTRAINT document_audit_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id),
  CONSTRAINT document_audit_doctor_fk FOREIGN KEY (target_doctor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS doctor_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(2000) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY review_appointment_unique (appointment_id),
  CONSTRAINT review_appointment_fk FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT review_doctor_fk FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT review_patient_fk FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT review_rating_check CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
