import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import ms from "ms";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(configDirectory, "../..");
const repositoryDirectory = path.resolve(backendDirectory, "..");

if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE });
} else {
  dotenv.config({ path: path.join(repositoryDirectory, ".env") });
  dotenv.config({ path: path.join(backendDirectory, ".env") });
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function integer(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
  return value;
}

function validateJwtExpiresIn(value) {
  const duration = ms(value);
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(
      "JWT_EXPIRES_IN must be a positive supported duration such as 7d, 12h, or 30m",
    );
  }
  return value;
}

function validateClientUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CLIENT_URL must be a valid HTTP or HTTPS origin");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("CLIENT_URL must use HTTP or HTTPS");
  }
  if (
    url.pathname !== "/"
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    throw new Error("CLIENT_URL must be an origin without a path, query, hash, or credentials");
  }

  return url.origin;
}

const nodeEnv = process.env.NODE_ENV?.trim() || "development";
const port = integer("PORT", 5000);
const postgresPort = integer("POSTGRES_PORT", 5432);
const postgresHostPort = integer("POSTGRES_HOST_PORT", postgresPort);

if (port < 1 || port > 65535) {
  throw new Error("PORT must be between 1 and 65535");
}
if (postgresPort < 1 || postgresPort > 65535) {
  throw new Error("POSTGRES_PORT must be between 1 and 65535");
}
if (postgresHostPort < 1 || postgresHostPort > 65535) {
  throw new Error("POSTGRES_HOST_PORT must be between 1 and 65535");
}

const postgresPassword = required("POSTGRES_PASSWORD");
const jwtSecret = required("JWT_SECRET");
const professorSeedPassword = required("PROFESSOR_SEED_PASSWORD");
const jwtExpiresIn = validateJwtExpiresIn(
  process.env.JWT_EXPIRES_IN?.trim() || "7d",
);
const clientUrl = validateClientUrl(required("CLIENT_URL"));

if (postgresPassword === "change_me") {
  throw new Error("POSTGRES_PASSWORD must be changed from the placeholder");
}
if (jwtSecret === "change_me" || jwtSecret === "change_me_to_a_long_random_secret") {
  throw new Error("JWT_SECRET must be changed from the placeholder");
}
if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}
if (professorSeedPassword === "change_me" || professorSeedPassword.length < 8) {
  throw new Error("PROFESSOR_SEED_PASSWORD must be at least 8 characters and not the placeholder");
}

export const env = Object.freeze({
  nodeEnv,
  port,
  jwtSecret,
  jwtExpiresIn,
  clientUrl,
  postgres: Object.freeze({
    user: required("POSTGRES_USER"),
    password: postgresPassword,
    database: required("POSTGRES_DB"),
    host: required("POSTGRES_HOST"),
    port: postgresPort,
    hostPort: postgresHostPort,
  }),
  professorSeed: Object.freeze({
    email: required("PROFESSOR_SEED_EMAIL"),
    password: professorSeedPassword,
    name: required("PROFESSOR_SEED_NAME"),
  }),
});
