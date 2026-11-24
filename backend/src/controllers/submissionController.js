import { pool } from "../config/db.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuid(value, fieldName) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw httpError(400, `${fieldName} must be a valid UUID`);
  }
}

function safeSubmission(row) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    groupId: row.group_id,
    status: row.status,
    stepOneAcknowledgedAt: row.step_one_acknowledged_at,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    isLate:
      row.status === "confirmed"
      && row.confirmed_at
      && row.due_date
      && new Date(row.confirmed_at) > new Date(row.due_date),
    notes: row.notes,
  };
}

async function requireStudentAndGroup(client, userId) {
  const user = await client.query(
    "SELECT id, role FROM users WHERE id = $1 FOR UPDATE",
    [userId],
  );
  if (user.rows.length === 0 || user.rows[0].role !== "student") {
    throw httpError(403, "Only students can use submission actions");
  }

  const membership = await client.query(
    `SELECT group_id
     FROM group_members
     WHERE user_id = $1
     FOR UPDATE`,
    [userId],
  );
  if (membership.rows.length === 0) {
    throw httpError(409, "Student does not belong to an active group");
  }

  return membership.rows[0].group_id;
}

async function requireAccessibleAssignment(client, assignmentId, groupId) {
  const assignment = await client.query(
    `SELECT id, title, due_date, target_type, is_archived
     FROM assignments
     WHERE id = $1
     FOR UPDATE`,
    [assignmentId],
  );
  if (assignment.rows.length === 0) {
    throw httpError(404, "Assignment not found");
  }

  const row = assignment.rows[0];
  if (row.is_archived) {
    throw httpError(404, "Assignment not found");
  }

  let accessible = row.target_type === "all";
  if (!accessible) {
    const target = await client.query(
      `SELECT 1
       FROM assignment_targets
       WHERE assignment_id = $1 AND group_id = $2`,
      [assignmentId, groupId],
    );
    accessible = target.rows.length > 0;
  }

  if (!accessible) {
    throw httpError(403, "Assignment is not assigned to your group");
  }

  return row;
}

export async function acknowledgeSubmission(req, res, next) {
  validateUuid(req.params.id, "Assignment ID");

  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    const groupId = await requireStudentAndGroup(client, req.user.id);
    const assignment = await requireAccessibleAssignment(
      client,
      req.params.id,
      groupId,
    );

    await client.query(
      `INSERT INTO submissions (
         assignment_id,
         group_id,
         status,
         step_one_acknowledged_at,
         confirmed_at,
         confirmed_by,
         is_late,
         notes
       )
       VALUES ($1, $2, 'step_1_acknowledged', NOW(), NULL, NULL, false, NULL)
       ON CONFLICT (assignment_id, group_id) DO NOTHING`,
      [assignment.id, groupId],
    );

    const submissionResult = await client.query(
      `SELECT s.*, a.due_date
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       WHERE s.assignment_id = $1 AND s.group_id = $2
       FOR UPDATE OF s`,
      [assignment.id, groupId],
    );
    const submission = submissionResult.rows[0];

    if (submission.status === "confirmed") {
      throw httpError(400, "Submission is already confirmed and locked");
    }

    await client.query("COMMIT");
    committed = true;
    res.status(200).json({
      submission: safeSubmission(submission),
    });
  } catch (error) {
    if (!committed) {
      await client.query("ROLLBACK").catch(() => {});
    }
    next(error);
  } finally {
    client.release();
  }
}

export async function confirmSubmission(req, res, next) {
  validateUuid(req.params.id, "Assignment ID");

  const notes =
    req.body?.notes === undefined || req.body.notes === null
      ? null
      : req.body.notes;
  if (typeof notes !== "string" || notes.length > 5000) {
    next(httpError(400, "Notes must be text and at most 5000 characters"));
    return;
  }

  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    const groupId = await requireStudentAndGroup(client, req.user.id);
    const assignment = await requireAccessibleAssignment(
      client,
      req.params.id,
      groupId,
    );

    const submissionResult = await client.query(
      `SELECT s.*
       FROM submissions s
       WHERE s.assignment_id = $1 AND s.group_id = $2
       FOR UPDATE`,
      [assignment.id, groupId],
    );
    if (submissionResult.rows.length === 0) {
      throw httpError(400, "Step 1 acknowledgment required prior to final confirmation");
    }

    const existing = submissionResult.rows[0];
    if (existing.status === "confirmed") {
      throw httpError(400, "Assignment already confirmed for this group");
    }

    const updateResult = await client.query(
      `UPDATE submissions
       SET status = 'confirmed',
           confirmed_at = NOW(),
           confirmed_by = $1,
           is_late = (NOW() > $2),
           notes = $3,
           updated_at = NOW()
       WHERE id = $4
         AND status = 'step_1_acknowledged'
       RETURNING *`,
      [req.user.id, assignment.due_date, notes, existing.id],
    );
    if (updateResult.rows.length === 0) {
      throw httpError(400, "Submission is no longer awaiting final confirmation");
    }

    const submission = {
      ...updateResult.rows[0],
      due_date: assignment.due_date,
    };
    await client.query("COMMIT");
    committed = true;
    res.status(200).json({
      submission: safeSubmission(submission),
    });
  } catch (error) {
    if (!committed) {
      await client.query("ROLLBACK").catch(() => {});
    }
    next(error);
  } finally {
    client.release();
  }
}

export async function getSubmissionStatus(req, res, next) {
  validateUuid(req.params.id, "Assignment ID");

  try {
    const membership = await pool.query(
      "SELECT group_id FROM group_members WHERE user_id = $1",
      [req.user.id],
    );
    if (membership.rows.length === 0) {
      res.status(200).json({
        status: "not_started",
        submissionId: null,
        stepOneAcknowledgedAt: null,
        confirmedAt: null,
        confirmedBy: null,
        isLate: false,
      });
      return;
    }

    const groupId = membership.rows[0].group_id;
    const assignment = await pool.query(
      `SELECT a.id, a.due_date, a.target_type, a.is_archived
       FROM assignments a
       WHERE a.id = $1`,
      [req.params.id],
    );
    if (
      assignment.rows.length === 0
      || assignment.rows[0].is_archived
    ) {
      throw httpError(404, "Assignment not found");
    }

    const assignmentRow = assignment.rows[0];
    let accessible = assignmentRow.target_type === "all";
    if (!accessible) {
      const target = await pool.query(
        "SELECT 1 FROM assignment_targets WHERE assignment_id = $1 AND group_id = $2",
        [req.params.id, groupId],
      );
      accessible = target.rows.length > 0;
    }
    if (!accessible) {
      throw httpError(403, "Assignment is not assigned to your group");
    }

    const result = await pool.query(
      `SELECT s.*, a.due_date
       FROM assignments a
       LEFT JOIN submissions s
         ON s.assignment_id = a.id
        AND s.group_id = $2
       WHERE a.id = $1`,
      [req.params.id, groupId],
    );
    const row = result.rows[0];
    if (!row || !row.id) {
      res.status(200).json({
        status: "not_started",
        submissionId: null,
        stepOneAcknowledgedAt: null,
        confirmedAt: null,
        confirmedBy: null,
        isLate: false,
      });
      return;
    }

    res.status(200).json({
      status: row.status,
      submissionId: row.id,
      stepOneAcknowledgedAt: row.step_one_acknowledged_at,
      confirmedAt: row.confirmed_at,
      confirmedBy: row.confirmed_by,
      isLate:
        row.status === "confirmed"
        && row.confirmed_at
        && new Date(row.confirmed_at) > new Date(row.due_date),
      notes: row.notes,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProfessorSubmissions(req, res, next) {
  validateUuid(req.params.id, "Assignment ID");

  try {
    const assignmentResult = await pool.query(
      "SELECT id, title, due_date FROM assignments WHERE id = $1",
      [req.params.id],
    );
    if (assignmentResult.rows.length === 0) {
      throw httpError(404, "Assignment not found");
    }

    const result = await pool.query(
      `WITH assignment_groups AS (
         SELECT a.id AS assignment_id,
                a.title,
                a.due_date,
                g.id AS group_id,
                g.name AS group_name
         FROM assignments a
         JOIN groups g ON (
           a.target_type = 'all'
           OR EXISTS (
             SELECT 1
             FROM assignment_targets at
             WHERE at.assignment_id = a.id
               AND at.group_id = g.id
           )
         )
         WHERE a.id = $1
       )
       SELECT ag.assignment_id,
              ag.title,
              ag.due_date,
              ag.group_id,
              ag.group_name,
              s.id AS submission_id,
              s.status,
              s.step_one_acknowledged_at,
              s.confirmed_at,
              s.confirmed_by,
              s.notes,
              u.full_name AS confirmed_by_name,
              u.student_id AS confirmed_by_student_id
       FROM assignment_groups ag
       LEFT JOIN submissions s
         ON s.assignment_id = ag.assignment_id
        AND s.group_id = ag.group_id
       LEFT JOIN users u ON u.id = s.confirmed_by
       ORDER BY ag.group_name ASC`,
      [req.params.id],
    );

    res.status(200).json({
      assignment: {
        id: assignmentResult.rows[0].id,
        title: assignmentResult.rows[0].title,
        dueDate: assignmentResult.rows[0].due_date,
      },
      submissions: result.rows.map((row) => ({
        submissionId: row.submission_id,
        groupId: row.group_id,
        groupName: row.group_name,
        status: row.status ?? "not_started",
        stepOneAcknowledgedAt: row.step_one_acknowledged_at,
        confirmedAt: row.confirmed_at,
        confirmedBy: row.confirmed_by
          ? {
              id: row.confirmed_by,
              name: row.confirmed_by_name,
              studentId: row.confirmed_by_student_id,
            }
          : null,
        isLate:
          row.status === "confirmed"
          && row.confirmed_at
          && new Date(row.confirmed_at) > new Date(row.due_date),
      })),
    });
  } catch (error) {
    next(error);
  }
}
