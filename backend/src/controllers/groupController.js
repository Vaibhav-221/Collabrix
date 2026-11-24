import { pool } from "../config/db.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function safeUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    studentId: row.student_id,
  };
}

function safeInvitation(row) {
  return {
    id: row.id,
    group: {
      id: row.group_id,
      name: row.group_name,
    },
    inviter: {
      id: row.invited_by,
      fullName: row.inviter_name,
    },
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function createGroup(req, res, next) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 2 || name.length > 100) {
    next(httpError(400, "Group name must be between 2 and 100 characters"));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [req.user.id]);

    const membership = await client.query(
      "SELECT id FROM group_members WHERE user_id = $1",
      [req.user.id],
    );
    if (membership.rows.length > 0) {
      throw httpError(409, "Student already belongs to a group");
    }

    const groupResult = await client.query(
      `INSERT INTO groups (name, created_by)
       VALUES ($1, $2)
       RETURNING id, name, created_by, created_at, updated_at`,
      [name, req.user.id],
    );
    const group = groupResult.rows[0];

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role_in_group)
       VALUES ($1, $2, 'leader')`,
      [group.id, req.user.id],
    );

    await client.query("COMMIT");
    res.status(201).json({
      group: {
        id: group.id,
        name: group.name,
        createdBy: group.created_by,
        createdAt: group.created_at,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") {
      next(httpError(409, "Student already belongs to a group"));
      return;
    }
    next(error);
  } finally {
    client.release();
  }
}

export async function getMyGroup(req, res, next) {
  try {
    const membershipResult = await pool.query(
      `SELECT gm.role_in_group, g.id AS group_id, g.name, g.created_by,
              g.created_at, g.updated_at
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id = $1`,
      [req.user.id],
    );

    if (membershipResult.rows.length === 0) {
      res.status(200).json({ group: null });
      return;
    }

    const membership = membershipResult.rows[0];
    const membersResult = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.student_id,
              gm.role_in_group, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [membership.group_id],
    );

    res.status(200).json({
      group: {
        id: membership.group_id,
        name: membership.name,
        createdBy: membership.created_by,
        createdAt: membership.created_at,
        updatedAt: membership.updated_at,
        myRole: membership.role_in_group,
        members: membersResult.rows.map((row) => ({
          id: row.id,
          email: row.email,
          fullName: row.full_name,
          studentId: row.student_id,
          roleInGroup: row.role_in_group,
          joinedAt: row.joined_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function inviteStudent(req, res, next) {
  const inviteeEmail =
    typeof req.body?.inviteeEmail === "string"
      ? req.body.inviteeEmail.trim().toLowerCase()
      : null;
  const inviteeStudentId =
    typeof req.body?.inviteeStudentId === "string"
      ? req.body.inviteeStudentId.trim()
      : null;

  if (!inviteeEmail && !inviteeStudentId) {
    next(httpError(400, "Email or student ID is required"));
    return;
  }
  if (inviteeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
    next(httpError(400, "A valid email address is required"));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const leaderMembership = await client.query(
      `SELECT gm.group_id
       FROM group_members gm
       WHERE gm.user_id = $1 AND gm.role_in_group = 'leader'
       FOR UPDATE`,
      [req.user.id],
    );
    if (leaderMembership.rows.length === 0) {
      throw httpError(403, "Only the group leader can invite students");
    }

    const groupId = leaderMembership.rows[0].group_id;
    let targetResult;
    if (inviteeEmail && inviteeStudentId) {
      targetResult = await client.query(
        `SELECT id, email, full_name, student_id, role
         FROM users
         WHERE email = $1 AND student_id = $2
         FOR UPDATE`,
        [inviteeEmail, inviteeStudentId],
      );
    } else if (inviteeEmail) {
      targetResult = await client.query(
        `SELECT id, email, full_name, student_id, role
         FROM users
         WHERE email = $1
         FOR UPDATE`,
        [inviteeEmail],
      );
    } else {
      targetResult = await client.query(
        `SELECT id, email, full_name, student_id, role
         FROM users
         WHERE student_id = $1
         FOR UPDATE`,
        [inviteeStudentId],
      );
    }

    if (targetResult.rows.length === 0) {
      throw httpError(404, "Target student not found");
    }
    const target = targetResult.rows[0];
    if (target.role !== "student") {
      throw httpError(400, "Only students can be invited");
    }
    if (target.id === req.user.id) {
      throw httpError(400, "You cannot invite yourself");
    }

    const targetMembership = await client.query(
      "SELECT id FROM group_members WHERE user_id = $1",
      [target.id],
    );
    if (targetMembership.rows.length > 0) {
      throw httpError(409, "Target student already belongs to a group");
    }

    const duplicate = await client.query(
      `SELECT id
       FROM group_invitations
       WHERE group_id = $1
         AND status = 'pending'
         AND (
           (invitee_email IS NOT NULL AND invitee_email = $2)
           OR (invitee_student_id IS NOT NULL AND invitee_student_id = $3)
         )
       LIMIT 1
       FOR UPDATE`,
      [groupId, target.email, target.student_id],
    );
    if (duplicate.rows.length > 0) {
      throw httpError(409, "A pending invitation already exists");
    }

    const invitationResult = await client.query(
      `INSERT INTO group_invitations (
         group_id,
         invited_by,
         invitee_email,
         invitee_student_id,
         status
       )
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, group_id, invited_by, invitee_email,
                 invitee_student_id, status, created_at`,
      [groupId, req.user.id, target.email, target.student_id],
    );

    await client.query("COMMIT");
    res.status(201).json({
      invitation: {
        id: invitationResult.rows[0].id,
        groupId: invitationResult.rows[0].group_id,
        invitedBy: invitationResult.rows[0].invited_by,
        status: invitationResult.rows[0].status,
        createdAt: invitationResult.rows[0].created_at,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") {
      next(httpError(409, "A pending invitation already exists"));
      return;
    }
    next(error);
  } finally {
    client.release();
  }
}

export async function listInvitations(req, res, next) {
  try {
    const currentUser = await pool.query(
      "SELECT email, student_id FROM users WHERE id = $1",
      [req.user.id],
    );
    if (currentUser.rows.length === 0) {
      next(httpError(401, "Authentication required"));
      return;
    }

    const user = currentUser.rows[0];
    const result = await pool.query(
      `SELECT gi.id, gi.group_id, g.name AS group_name,
              gi.invited_by, u.full_name AS inviter_name,
              gi.status, gi.created_at
       FROM group_invitations gi
       JOIN groups g ON g.id = gi.group_id
       JOIN users u ON u.id = gi.invited_by
       WHERE gi.status = 'pending'
         AND (
           (gi.invitee_email IS NOT NULL AND gi.invitee_email = $1)
           OR (gi.invitee_student_id IS NOT NULL AND gi.invitee_student_id = $2)
         )
       ORDER BY gi.created_at DESC`,
      [user.email, user.student_id],
    );

    res.status(200).json({
      invitations: result.rows.map(safeInvitation),
    });
  } catch (error) {
    next(error);
  }
}

export async function respondToInvitation(req, res, next) {
  const action =
    typeof req.body?.action === "string"
      ? req.body.action.trim().toLowerCase()
      : "";
  if (!["accept", "reject"].includes(action)) {
    next(httpError(400, "Action must be accept or reject"));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const invitationResult = await client.query(
      `SELECT gi.id, gi.group_id, gi.invited_by,
              gi.invitee_email, gi.invitee_student_id, gi.status
       FROM group_invitations gi
       WHERE gi.id = $1
       FOR UPDATE`,
      [req.params.id],
    );
    if (invitationResult.rows.length === 0) {
      throw httpError(404, "Invitation not found");
    }

    const invitation = invitationResult.rows[0];
    if (invitation.status !== "pending") {
      throw httpError(409, "Invitation has already been processed");
    }

    const userResult = await client.query(
      `SELECT id, email, student_id, role
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [req.user.id],
    );
    if (userResult.rows.length === 0) {
      throw httpError(401, "Authentication required");
    }

    const user = userResult.rows[0];
    const isInvited =
      (invitation.invitee_email !== null &&
        invitation.invitee_email === user.email)
      || (invitation.invitee_student_id !== null &&
        invitation.invitee_student_id === user.student_id);
    if (!isInvited || user.role !== "student") {
      throw httpError(403, "This invitation is not addressed to you");
    }

    if (action === "reject") {
      await client.query(
        `UPDATE group_invitations
         SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [invitation.id],
      );
      await client.query("COMMIT");
      res.status(200).json({ invitation: { id: invitation.id, status: "rejected" } });
      return;
    }

    const membership = await client.query(
      "SELECT id FROM group_members WHERE user_id = $1",
      [user.id],
    );
    if (membership.rows.length > 0) {
      throw httpError(409, "Student already belongs to a group");
    }

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role_in_group)
       VALUES ($1, $2, 'member')`,
      [invitation.group_id, user.id],
    );
    await client.query(
      `UPDATE group_invitations
       SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [invitation.id],
    );

    await client.query("COMMIT");
    res.status(200).json({
      invitation: { id: invitation.id, status: "accepted" },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") {
      next(httpError(409, "Student already belongs to a group"));
      return;
    }
    next(error);
  } finally {
    client.release();
  }
}

export async function removeMember(req, res, next) {
  const targetUserId = req.params.userId;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentMembership = await client.query(
      `SELECT gm.id, gm.group_id, gm.role_in_group
       FROM group_members gm
       WHERE gm.user_id = $1
       FOR UPDATE`,
      [req.user.id],
    );

    if (targetUserId === req.user.id) {
      if (currentMembership.rows.length === 0) {
        throw httpError(404, "You are not a member of a group");
      }
      if (currentMembership.rows[0].role_in_group === "leader") {
        throw httpError(400, "The group leader cannot remove themselves");
      }

      await client.query(
        "DELETE FROM group_members WHERE id = $1",
        [currentMembership.rows[0].id],
      );
      await client.query("COMMIT");
      res.status(200).json({ message: "Left group" });
      return;
    }

    const leaderMembership = await client.query(
      `SELECT gm.group_id
       FROM group_members gm
       WHERE gm.user_id = $1 AND gm.role_in_group = 'leader'
       FOR UPDATE`,
      [req.user.id],
    );
    if (leaderMembership.rows.length === 0) {
      throw httpError(403, "Only the group leader can remove members");
    }
    if (targetUserId === req.user.id) {
      throw httpError(400, "The group leader cannot remove themselves");
    }

    const groupId = leaderMembership.rows[0].group_id;
    const targetMembership = await client.query(
      `SELECT id
       FROM group_members
       WHERE group_id = $1 AND user_id = $2
       FOR UPDATE`,
      [groupId, targetUserId],
    );
    if (targetMembership.rows.length === 0) {
      throw httpError(404, "Target user is not a member of this group");
    }

    await client.query(
      "DELETE FROM group_members WHERE id = $1",
      [targetMembership.rows[0].id],
    );
    await client.query("COMMIT");
    res.status(200).json({ message: "Member removed" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
}
