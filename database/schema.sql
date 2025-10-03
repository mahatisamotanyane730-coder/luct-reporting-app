-- Create database (run this first in PGAdmin)
CREATE DATABASE luct_reporting;

-- Connect to luct_reporting database then run:

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'lecturer', 'prl', 'pl', 'fmg')),
    stream VARCHAR(10) CHECK (stream IN ('IT', 'IS', 'CS', 'SE')),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    stream VARCHAR(10) NOT NULL CHECK (stream IN ('IT', 'IS', 'CS', 'SE')),
    pl_id INTEGER REFERENCES users(id)
);

CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    course_id INTEGER REFERENCES courses(id),
    venue VARCHAR(100),
    scheduled_time TIME,
    lecturer_id INTEGER REFERENCES users(id),
    total_students INTEGER
);

-- Add missing columns to reports table
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS week_of_reporting VARCHAR(10),
ADD COLUMN IF NOT EXISTS date_of_lecture DATE,
ADD COLUMN IF NOT EXISTS course_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS course_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS lecturer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS actual_students_present INTEGER,
ADD COLUMN IF NOT EXISTS total_registered_students INTEGER,
ADD COLUMN IF NOT EXISTS venue VARCHAR(100),
ADD COLUMN IF NOT EXISTS scheduled_time TIME,
ADD COLUMN IF NOT EXISTS topic_taught TEXT,
ADD COLUMN IF NOT EXISTS learning_outcomes TEXT,
ADD COLUMN IF NOT EXISTS lecturer_recommendations TEXT,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS priority VARCHAR(20),
ADD COLUMN IF NOT EXISTS teaching_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS materials_used TEXT,
ADD COLUMN IF NOT EXISTS challenges TEXT,
ADD COLUMN IF NOT EXISTS faculty_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS class_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS type VARCHAR(50),
ADD COLUMN IF NOT EXISTS recipient_id INTEGER,
ADD COLUMN IF NOT EXISTS sender_id INTEGER,
ADD COLUMN IF NOT EXISTS stream VARCHAR(50),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'submitted',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS reviewed_by INTEGER,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES reports(id),
    sender_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,
    rater_id INTEGER REFERENCES users(id),
    ratee_id INTEGER REFERENCES users(id),
    score INTEGER CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    category VARCHAR(100) DEFAULT 'teaching',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);