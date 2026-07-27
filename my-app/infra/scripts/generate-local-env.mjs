import { createHash, createHmac, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const output = resolve(process.argv[2] ?? ".env.docker.local");
const projectName = process.argv[3] ?? "compliancetool-local";
const appEnvironment = projectName === "compliancetool-test" ? "test" : "local";
const composeEnvironmentPath = relative(
  resolve("infra/compose/local"),
  output,
).replaceAll("\\", "/");
const template = await readFile(
  resolve("infra/env/examples/local.env.example"),
  "utf8",
);

const jwtSecret = randomBytes(36).toString("base64");
const issuedAt = Math.floor(Date.now() / 1000);
const expiresAt = issuedAt + 5 * 365 * 24 * 60 * 60;
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateJwk = privateKey.export({ format: "jwk" });
const keyId = randomUUID();
const symmetricJwk = {
  kty: "oct",
  k: Buffer.from(jwtSecret).toString("base64url"),
  alg: "HS256",
};
const privateSigningJwk = {
  kty: "EC",
  kid: keyId,
  use: "sig",
  key_ops: ["sign", "verify"],
  alg: "ES256",
  ext: true,
  crv: privateJwk.crv,
  x: privateJwk.x,
  y: privateJwk.y,
  d: privateJwk.d,
};
const publicSigningJwk = {
  kty: "EC",
  kid: keyId,
  use: "sig",
  key_ops: ["verify"],
  alg: "ES256",
  ext: true,
  crv: privateJwk.crv,
  x: privateJwk.x,
  y: privateJwk.y,
};

const values = {
  POSTGRES_PASSWORD: randomHex(24),
  JWT_SECRET: jwtSecret,
  ANON_KEY: signHs256({ role: "anon", iss: "supabase", iat: issuedAt, exp: expiresAt }),
  SERVICE_ROLE_KEY: signHs256({
    role: "service_role",
    iss: "supabase",
    iat: issuedAt,
    exp: expiresAt,
  }),
  SUPABASE_PUBLISHABLE_KEY: opaqueKey("sb_publishable_"),
  SUPABASE_SECRET_KEY: opaqueKey("sb_secret_"),
  ANON_KEY_ASYMMETRIC: signEs256({
    role: "anon",
    iss: "supabase",
    iat: issuedAt,
    exp: expiresAt,
  }),
  SERVICE_ROLE_KEY_ASYMMETRIC: signEs256({
    role: "service_role",
    iss: "supabase",
    iat: issuedAt,
    exp: expiresAt,
  }),
  JWT_KEYS: JSON.stringify([privateSigningJwk, symmetricJwk]),
  JWT_JWKS: JSON.stringify({ keys: [publicSigningJwk, symmetricJwk] }),
  RUSTFS_ACCESS_KEY: `ct${randomHex(10)}`,
  RUSTFS_SECRET_KEY: randomHex(32),
  S3_PROTOCOL_ACCESS_KEY_ID: randomHex(16),
  S3_PROTOCOL_ACCESS_KEY_SECRET: randomHex(32),
  LITELLM_MASTER_KEY: `sk-${randomHex(32)}`,
  API_CURSOR_SECRET: randomHex(32),
  DASHBOARD_PASSWORD: randomHex(24),
  PG_META_CRYPTO_KEY: randomBytes(32).toString("base64url"),
};

let generated = template
  .replace(/^COMPOSE_PROJECT_NAME=.*$/m, `COMPOSE_PROJECT_NAME=${projectName}`)
  .replace(
    /^COMPLIANCE_ENV_FILE=.*$/m,
    `COMPLIANCE_ENV_FILE=${composeEnvironmentPath}`,
  )
  .replace(/^APP_ENV=.*$/m, `APP_ENV=${appEnvironment}`)
  .replace(
    /^WORKER_ID=.*$/m,
    `WORKER_ID=${appEnvironment}-${projectName}-1`,
  );
for (const [name, value] of Object.entries(values)) {
  generated = generated.replaceAll(`__GENERATED_${name}__`, value);
}
if (generated.includes("__GENERATED_")) {
  throw new Error("The environment template contains unresolved generated values");
}

await writeFile(output, generated, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.info(`Generated isolated environment file: ${output}`);

function signHs256(payload) {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson(payload);
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function signEs256(payload) {
  const header = encodeJson({ alg: "ES256", typ: "JWT", kid: keyId });
  const body = encodeJson(payload);
  const signature = sign("SHA256", Buffer.from(`${header}.${body}`), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${header}.${body}.${signature}`;
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function opaqueKey(prefix) {
  const intermediate = `${prefix}${randomBytes(17).toString("base64url").slice(0, 22)}`;
  const checksum = createHash("sha256")
    .update(`supabase-self-hosted|${intermediate}`)
    .digest("base64url")
    .slice(0, 8);
  return `${intermediate}_${checksum}`;
}

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}
