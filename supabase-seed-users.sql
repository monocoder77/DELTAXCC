-- DeltaX Seed Users
-- Run this in Supabase SQL Editor AFTER running supabase-schema.sql
-- All accounts use password: deltax123

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Counselor: Arsh Sinha ───
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'arsh@deltaxcc.com',
  crypt('deltax123', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}', 'authenticated', 'authenticated'
);
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'email', 'arsh@deltaxcc.com'),
  'email', 'a1000000-0000-0000-0000-000000000001', NOW(), NOW()
);
INSERT INTO profiles (id, role, full_name, email, avatar_initials)
VALUES ('a1000000-0000-0000-0000-000000000001', 'consultant', 'Arsh Sinha', 'arsh@deltaxcc.com', 'AS');

-- ─── Counselor: Timi Odumosu ───
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'a2000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'timi@deltaxcc.com',
  crypt('deltax123', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}', 'authenticated', 'authenticated'
);
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
VALUES (
  'a2000000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000002',
  jsonb_build_object('sub', 'a2000000-0000-0000-0000-000000000002', 'email', 'timi@deltaxcc.com'),
  'email', 'a2000000-0000-0000-0000-000000000002', NOW(), NOW()
);
INSERT INTO profiles (id, role, full_name, email, avatar_initials)
VALUES ('a2000000-0000-0000-0000-000000000002', 'consultant', 'Timi Odumosu', 'timi@deltaxcc.com', 'TO');

-- ─── Counselor: Arnav Kakarala ───
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'a3000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'arnav@deltaxcc.com',
  crypt('deltax123', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}', 'authenticated', 'authenticated'
);
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
VALUES (
  'a3000000-0000-0000-0000-000000000003',
  'a3000000-0000-0000-0000-000000000003',
  jsonb_build_object('sub', 'a3000000-0000-0000-0000-000000000003', 'email', 'arnav@deltaxcc.com'),
  'email', 'a3000000-0000-0000-0000-000000000003', NOW(), NOW()
);
INSERT INTO profiles (id, role, full_name, email, avatar_initials)
VALUES ('a3000000-0000-0000-0000-000000000003', 'consultant', 'Arnav Kakarala', 'arnav@deltaxcc.com', 'AK');

-- ─── Counselor: Aarav Agarwal ───
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'a4000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'aarav@deltaxcc.com',
  crypt('deltax123', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}', 'authenticated', 'authenticated'
);
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
VALUES (
  'a4000000-0000-0000-0000-000000000004',
  'a4000000-0000-0000-0000-000000000004',
  jsonb_build_object('sub', 'a4000000-0000-0000-0000-000000000004', 'email', 'aarav@deltaxcc.com'),
  'email', 'a4000000-0000-0000-0000-000000000004', NOW(), NOW()
);
INSERT INTO profiles (id, role, full_name, email, avatar_initials)
VALUES ('a4000000-0000-0000-0000-000000000004', 'consultant', 'Aarav Agarwal', 'aarav@deltaxcc.com', 'AA');

-- ─── Counselor: Akhil Sanapalavenkata ───
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'a5000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000000',
  'akhil@deltaxcc.com',
  crypt('deltax123', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}', 'authenticated', 'authenticated'
);
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
VALUES (
  'a5000000-0000-0000-0000-000000000005',
  'a5000000-0000-0000-0000-000000000005',
  jsonb_build_object('sub', 'a5000000-0000-0000-0000-000000000005', 'email', 'akhil@deltaxcc.com'),
  'email', 'a5000000-0000-0000-0000-000000000005', NOW(), NOW()
);
INSERT INTO profiles (id, role, full_name, email, avatar_initials)
VALUES ('a5000000-0000-0000-0000-000000000005', 'consultant', 'Akhil Sanapalavenkata', 'akhil@deltaxcc.com', 'AS');

-- ─── Test Student (assigned to Timi) ───
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'teststudent@deltaxcc.com',
  crypt('deltax123', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}', 'authenticated', 'authenticated'
);
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'b1000000-0000-0000-0000-000000000001', 'email', 'teststudent@deltaxcc.com'),
  'email', 'b1000000-0000-0000-0000-000000000001', NOW(), NOW()
);
INSERT INTO profiles (id, role, full_name, email, assigned_consultant_id, avatar_initials)
VALUES ('b1000000-0000-0000-0000-000000000001', 'student', 'Test Student', 'teststudent@deltaxcc.com', 'a2000000-0000-0000-0000-000000000002', 'TS');

-- ─── Create a conversation between Test Student and Timi ───
INSERT INTO conversations (id, student_id, consultant_id)
VALUES ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002');
