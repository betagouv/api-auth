import { getDatabaseConnection } from '../connectors/postgres';

export const findByUserId = async user_id => {
  const connection = getDatabaseConnection();

  const { rows: results } = await connection.query(
    `
SELECT id, siret FROM organizations
INNER JOIN users_organizations ON users_organizations.organization_id = organizations.id
WHERE users_organizations.user_id = $1`,
    [user_id]
  );

  return results;
};

export const findBySiret = async siret => {
  const connection = getDatabaseConnection();

  const {
    rows: [result],
  } = await connection.query(`SELECT * FROM organizations WHERE siret = $1`, [
    siret,
  ]);

  return result;
};

export const create = async ({ siret, authorized_email_domains }) => {
  const connection = getDatabaseConnection();

  const {
    rows: [organization],
  } = await connection.query(
    `
INSERT INTO organizations (siret, authorized_email_domains)
VALUES ($1, $2) RETURNING *
`,
    [siret, authorized_email_domains]
  );

  return organization;
};

export const addUser = async ({ organization_id, user_id }) => {
  const connection = getDatabaseConnection();

  try {
    await connection.query('BEGIN');

    await connection.query(
      `INSERT INTO users_organizations (user_id, organization_id) VALUES ($1, $2)`,
      [user_id, organization_id]
    );

    await connection.query('COMMIT');

    return true;
  } catch (e) {
    await connection.query('ROLLBACK');
    throw e;
  }
};

export const getUsers = async organization_id => {
  const connection = getDatabaseConnection();

  const { rows: results } = await connection.query(
    `
SELECT * FROM users
INNER JOIN users_organizations AS uo ON uo.user_id = users.id
WHERE uo.organization_id = $1`,
    [organization_id]
  );

  return results;
};
