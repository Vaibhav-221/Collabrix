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

function validateOneDriveUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw httpError(400, "OneDrive URL is required");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw httpError(400, "OneDrive URL must be a valid URL");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw httpError(400, "OneDrive URL must use HTTPS and must not contain credentials");
  }
  return url.href;
}

function validateDueDate(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw httpError(400, "Due date is required");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw httpError(400, "Due date must be a valid ISO date/time");
  }
  if (!/T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)) {
    throw httpError(400, "Due date must include an ISO time and timezone");
  }
  if (parsed.getTime() <= Date.now()) {
    throw httpError(400, "Due date must be in the future");
  }
  return parsed.toISOString();
}

function validateTargeting(body) {
  const targetType = body.targetType;
  if (targetType !== "all" && targetType !== "specific_groups") {
    throw httpError(400, "targetType must be all or specific_groups");
  }

  if (targetType === "all") {
    if (Array.isArray(body.targetGroupIds) && body.targetGroupIds.length > 0) {
      throw httpError(400, "targetGroupIds must be omitted for all-groups assignments");
    }
    return { targetType, targetGroupIds: [] };
  }

  if (!Array.isArray(body.targetGroupIds) || body.targetGroupIds.length === 0) {
    throw httpError(400, "specific_groups assignments require at least one target group");
  }

  const uniqueIds = [...new Set(body.targetGroupIds)];
  for (const groupId of uniqueIds) {
    validateUuid(groupId, "targetGroupIds");
  }
  return { targetType, targetGroupIds: uniqueIds };
}

function validateAssignmentFields(body, { partial = false } = {}) {
  const fields = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, "title")) {
    if (typeof body.title !== "string" || body.title.trim().length < 2 || body.title.trim().length > 255) {
      throw httpError(400, "Title must be between 2 and 255 characters");
    }
    fields.title = body.title.trim();
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "description")) {
    if (body.description !== null && body.description !== undefined &&
        (typeof body.description !== "string" || body.description.length > 5000)) {
      throw httpError(400, "Description must be text and at most 5000 characters");
    }
    fields.description =
      body.description === undefined || body.description === null
        ? null
        : body.description.trim();
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "dueDate")) {
    fields.dueDate = validateDueDate(body.dueDate);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "onedriveUrl")) {
    fields.onedriveUrl = validateOneDriveUrl(body.onedriveUrl);
  }

  return fields;
}

function safeAssignment(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    onedriveUrl: row.onedrive_url,
    targetType: row.target_type,
    isArchived: row.is_archived,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireDatabaseProfessor(client, userId) {
  const result = await client.query(
    "SELECT id, role FROM users WHERE id = $1",
    [userId],
  );
  if (result.rows.length === 0 || result.rows[0].role !== "professor") {
    throw httpError(403, "Only professors can manage assignments");
  }
}

async function validateTargetGroups(client, targetGroupIds) {
  if (targetGroupIds.length === 0) {
    return;
  }

  const result = await client.query(
    "SELECT id FROM groups WHERE id = ANY($1::uuid[])",
    [targetGroupIds],
  );
  if (result.rows.length !== targetGroupIds.length) {
    throw httpError(400, "One or more target groups are invalid");
  }
}

async function getAssignmentTargets(client, assignmentId) {
  const result = await client.query(
    `SELECT g.id, g.name
     FROM assignment_targets at
     JOIN groups g ON g.id = at.group_id
     WHERE at.assignment_id = $1
     ORDER BY g.name ASC`,
    [assignmentId],
  );
  return result.rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function createAssignment(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await requireDatabaseProfessor(client, req.user.id);

    const fields = validateAssignmentFields(req.body ?? {});
    const targeting = validateTargeting(req.body ?? {});
    await validateTargetGroups(client, targeting.targetGroupIds);

    const assignmentResult = await client.query(
      `INSERT INTO assignments (
         title, description, due_date, onedrive_url,
         target_type, is_archived, created_by
       )
       VALUES ($1, $2, $3, $4, $5, false, $6)
       RETURNING id, title, description, due_date, onedrive_url,
                 target_type, is_archived, created_by, created_at, updated_at`,
      [
        fields.title,
        fields.description,
        fields.dueDate,
        fields.onedriveUrl,
        targeting.targetType,
        req.user.id,
      ],
    );
    const assignment = assignmentResult.rows[0];

    for (const groupId of targeting.targetGroupIds) {
      await client.query(
        `INSERT INTO assignment_targets (assignment_id, group_id)
         VALUES ($1, $2)`,
        [assignment.id, groupId],
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      assignment: {
        ...safeAssignment(assignment),
        targetGroups: await getAssignmentTargets(pool, assignment.id),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
}

export async function listAssignments(req, res, next) {
  try {
    if (req.user.role === "professor") {
      const result = await pool.query(
        `SELECT a.*, at.group_id, g.name AS target_group_name
         FROM assignments a
         LEFT JOIN assignment_targets at ON at.assignment_id = a.id
         LEFT JOIN groups g ON g.id = at.group_id
         ORDER BY a.due_date ASC`,
      );

      const assignments = new Map();
      for (const row of result.rows) {
        if (!assignments.has(row.id)) {
          assignments.set(row.id, {
            assignment: safeAssignment(row),
            targetGroups: [],
          });
        }
        if (row.group_id) {
          assignments.get(row.id).targetGroups.push({
            id: row.group_id,
            name: row.target_group_name,
          });
        }
      }

      res.status(200).json({
        assignments: [...assignments.values()].map(({ assignment, targetGroups }) => ({
          ...assignment,
          targetGroups,
        })),
      });
      return;
    }

    if (req.user.role !== "student") {
      throw httpError(403, "Forbidden");
    }

    const membership = await pool.query(
      "SELECT group_id FROM group_members WHERE user_id = $1",
      [req.user.id],
    );
    if (membership.rows.length === 0) {
      res.status(200).json({ assignments: [] });
      return;
    }

    const groupId = membership.rows[0].group_id;
    const result = await pool.query(
      `SELECT DISTINCT a.*
       FROM assignments a
       WHERE a.target_type = 'all'
          OR EXISTS (
            SELECT 1
            FROM assignment_targets at
            WHERE at.assignment_id = a.id
              AND at.group_id = $1
          )
       ORDER BY a.due_date ASC`,
      [groupId],
    );

    res.status(200).json({
      assignments: result.rows.map(safeAssignment),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAssignment(req, res, next) {
  try {
    validateUuid(req.params.id, "Assignment ID");

    if (req.user.role === "professor") {
      const result = await pool.query(
        `SELECT *
         FROM assignments
         WHERE id = $1`,
        [req.params.id],
      );
      if (result.rows.length === 0) {
        throw httpError(404, "Assignment not found");
      }

      const assignment = result.rows[0];
      const targets = await getAssignmentTargets(pool, assignment.id);
      res.status(200).json({
        assignment: {
          ...safeAssignment(assignment),
          targetGroups: targets,
        },
      });
      return;
    }

    if (req.user.role !== "student") {
      throw httpError(403, "Forbidden");
    }

    const result = await pool.query(
      `SELECT DISTINCT a.*
       FROM assignments a
       JOIN group_members gm ON gm.user_id = $1
       WHERE a.id = $2
         AND (
           a.target_type = 'all'
           OR EXISTS (
             SELECT 1
             FROM assignment_targets at
             WHERE at.assignment_id = a.id
               AND at.group_id = gm.group_id
           )
         )`,
      [req.user.id, req.params.id],
    );
    if (result.rows.length === 0) {
      throw httpError(404, "Assignment not found");
    }

    res.status(200).json({
      assignment: safeAssignment(result.rows[0]),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAssignment(req, res, next) {
  validateUuid(req.params.id, "Assignment ID");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await requireDatabaseProfessor(client, req.user.id);

    const assignmentResult = await client.query(
      "SELECT * FROM assignments WHERE id = $1 FOR UPDATE",
      [req.params.id],
    );
    if (assignmentResult.rows.length === 0) {
      throw httpError(404, "Assignment not found");
    }
    const existing = assignmentResult.rows[0];

    if (!req.body || Object.keys(req.body).length === 0) {
      throw httpError(400, "At least one assignment field is required");
    }

    const allowedFields = new Set([
      "title",
      "description",
      "dueDate",
      "onedriveUrl",
      "targetType",
      "targetGroupIds",
    ]);
    for (const key of Object.keys(req.body)) {
      if (!allowedFields.has(key)) {
        throw httpError(400, `Unsupported assignment field: ${key}`);
      }
    }

    const fields = validateAssignmentFields(req.body, { partial: true });
    let targeting = null;

    if (
      Object.prototype.hasOwnProperty.call(req.body, "targetType")
      || Object.prototype.hasOwnProperty.call(req.body, "targetGroupIds")
    ) {
      const targetType =
        req.body.targetType !== undefined
          ? req.body.targetType
          : existing.target_type;
      targeting = validateTargeting({
        targetType,
        targetGroupIds:
          req.body.targetGroupIds !== undefined
            ? req.body.targetGroupIds
            : existing.target_type === "specific_groups"
              ? (await getAssignmentTargets(client, existing.id)).map((group) => group.id)
              : [],
      });
      await validateTargetGroups(client, targeting.targetGroupIds);
    }

    await client.query(
      `UPDATE assignments
       SET title = $1,
           description = $2,
           due_date = $3,
           onedrive_url = $4,
           target_type = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        fields.title ?? existing.title,
        Object.prototype.hasOwnProperty.call(req.body, "description")
          ? fields.description
          : existing.description,
        fields.dueDate ?? existing.due_date,
        fields.onedriveUrl ?? existing.onedrive_url,
        targeting?.targetType ?? existing.target_type,
        existing.id,
      ],
    );

    if (targeting) {
      await client.query(
        "DELETE FROM assignment_targets WHERE assignment_id = $1",
        [existing.id],
      );
      for (const groupId of targeting.targetGroupIds) {
        await client.query(
          `INSERT INTO assignment_targets (assignment_id, group_id)
           VALUES ($1, $2)`,
          [existing.id, groupId],
        );
      }
    }

    const updated = await client.query(
      "SELECT * FROM assignments WHERE id = $1",
      [existing.id],
    );
    await client.query("COMMIT");

    res.status(200).json({
      assignment: {
        ...safeAssignment(updated.rows[0]),
        targetGroups: await getAssignmentTargets(pool, existing.id),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
}

export async function archiveAssignment(req, res, next) {
  validateUuid(req.params.id, "Assignment ID");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await requireDatabaseProfessor(client, req.user.id);

    const result = await client.query(
      `UPDATE assignments
       SET is_archived = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      throw httpError(404, "Assignment not found");
    }

    await client.query("COMMIT");
    res.status(200).json({
      assignment: safeAssignment(result.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
}
