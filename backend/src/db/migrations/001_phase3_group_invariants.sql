CREATE UNIQUE INDEX IF NOT EXISTS uq_group_members_one_leader
ON group_members(group_id)
WHERE role_in_group = 'leader';

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_invitation_email
ON group_invitations(group_id, invitee_email)
WHERE status = 'pending' AND invitee_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_invitation_student_id
ON group_invitations(group_id, invitee_student_id)
WHERE status = 'pending' AND invitee_student_id IS NOT NULL;
