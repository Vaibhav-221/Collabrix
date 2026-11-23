INSERT INTO users (
    email,
    password_hash,
    full_name,
    student_id,
    role
)
VALUES (
    $1,
    $2,
    $3,
    NULL,
    'professor'
)
ON CONFLICT (email) DO NOTHING;
