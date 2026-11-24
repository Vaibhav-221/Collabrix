import { pool } from "../config/db.js";

function completionPercentage(confirmed, total) {
  if (!total) {
    return 0;
  }
  return Number(((confirmed * 100) / total).toFixed(2));
}

export async function getAnalyticsOverview(req, res, next) {
  try {
    const result = await pool.query(
      `WITH applicable_pairs AS (
         SELECT a.id AS assignment_id,
                a.title,
                a.due_date,
                g.id AS group_id
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
         WHERE a.is_archived = false
       ),
       progress AS (
         SELECT p.assignment_id,
                p.title,
                p.due_date,
                p.group_id,
                s.status,
                s.confirmed_at
         FROM applicable_pairs p
         LEFT JOIN submissions s
           ON s.assignment_id = p.assignment_id
          AND s.group_id = p.group_id
       ),
       assignment_summary AS (
         SELECT a.id AS assignment_id,
                a.title,
                COUNT(p.group_id)::int AS total_groups,
                COUNT(*) FILTER (
                  WHERE p.group_id IS NOT NULL
                    AND s.status IS NULL
                )::int AS not_started,
                COUNT(*) FILTER (
                  WHERE s.status = 'step_1_acknowledged'
                )::int AS acknowledged,
                COUNT(*) FILTER (
                  WHERE s.status = 'confirmed'
                )::int AS confirmed,
                COUNT(*) FILTER (
                  WHERE s.status = 'confirmed'
                    AND s.confirmed_at > a.due_date
                )::int AS late
         FROM assignments a
         LEFT JOIN applicable_pairs p
           ON p.assignment_id = a.id
         LEFT JOIN submissions s
           ON s.assignment_id = a.id
          AND s.group_id = p.group_id
         WHERE a.is_archived = false
         GROUP BY a.id, a.title
       )
       SELECT
         (SELECT COUNT(*)::int FROM assignments WHERE is_archived = false) AS total_assignments,
         (SELECT COUNT(*)::int FROM groups) AS total_active_groups,
         (SELECT COUNT(*)::int FROM progress) AS total_expected_submissions,
         (SELECT COUNT(*)::int FROM progress WHERE status = 'confirmed') AS total_confirmed_submissions,
         (SELECT COUNT(*)::int FROM progress
          WHERE status = 'confirmed' AND confirmed_at <= due_date) AS on_time,
         (SELECT COUNT(*)::int FROM progress
          WHERE status = 'confirmed' AND confirmed_at > due_date) AS late,
         COALESCE(
           (SELECT json_agg(
             json_build_object(
               'assignmentId', assignment_id,
               'title', title,
               'totalGroups', total_groups,
               'notStarted', not_started,
               'acknowledged', acknowledged,
               'confirmed', confirmed,
               'late', late
             )
             ORDER BY title
           )
           FROM assignment_summary),
           '[]'::json
         ) AS assignment_progress`,
    );

    const row = result.rows[0];
    const totalExpected = row.total_expected_submissions ?? 0;
    const totalConfirmed = row.total_confirmed_submissions ?? 0;
    const notStarted =
      row.assignment_progress.reduce(
        (sum, assignment) => sum + assignment.notStarted,
        0,
      );
    const acknowledged =
      row.assignment_progress.reduce(
        (sum, assignment) => sum + assignment.acknowledged,
        0,
      );

    res.status(200).json({
      totalAssignments: row.total_assignments,
      totalActiveGroups: row.total_active_groups,
      totalExpectedSubmissions: totalExpected,
      notStarted,
      acknowledged,
      confirmed: totalConfirmed,
      totalConfirmedSubmissions: totalConfirmed,
      onTime: row.on_time,
      late: row.late,
      overallCompletionPercentage: completionPercentage(
        totalConfirmed,
        totalExpected,
      ),
      assignmentProgress: row.assignment_progress,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGroupPerformance(req, res, next) {
  try {
    const result = await pool.query(
      `WITH applicable_pairs AS (
         SELECT g.id AS group_id,
                g.name AS group_name,
                a.id AS assignment_id,
                a.due_date,
                s.status,
                s.confirmed_at
         FROM groups g
         LEFT JOIN assignments a
           ON a.is_archived = false
          AND (
            a.target_type = 'all'
            OR EXISTS (
              SELECT 1
              FROM assignment_targets at
              WHERE at.assignment_id = a.id
                AND at.group_id = g.id
            )
          )
         LEFT JOIN submissions s
           ON s.assignment_id = a.id
          AND s.group_id = g.id
       )
       SELECT group_id,
              group_name,
              COUNT(assignment_id)::int AS total_assignments,
              COUNT(*) FILTER (
                WHERE assignment_id IS NOT NULL
                  AND status IS NULL
              )::int AS not_started,
              COUNT(*) FILTER (WHERE status = 'step_1_acknowledged')::int AS acknowledged,
              COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
              COUNT(*) FILTER (
                WHERE status = 'confirmed'
                  AND confirmed_at > due_date
              )::int AS late,
              COUNT(*) FILTER (
                WHERE status = 'confirmed'
                  AND confirmed_at <= due_date
              )::int AS on_time
       FROM applicable_pairs
       GROUP BY group_id, group_name
       ORDER BY group_name ASC`,
    );

    res.status(200).json({
      groups: result.rows.map((row) => ({
        groupId: row.group_id,
        groupName: row.group_name,
        totalAssignments: row.total_assignments,
        notStarted: row.not_started,
        acknowledged: row.acknowledged,
        confirmed: row.confirmed,
        late: row.late,
        onTime: row.on_time,
        completionPercentage: completionPercentage(
          row.confirmed,
          row.total_assignments,
        ),
      })),
    });
  } catch (error) {
    next(error);
  }
}
