import { eq } from "drizzle-orm";
import { hashPassword, MINIMUM_PASSWORD_LENGTH } from "../src/auth/passwords.ts";
import { db, pool } from "../src/db/client.ts";
import { users, workspace, type Role } from "../src/db/schema.ts";

// Creates the demonstration accounts, covering every role. Running it again resets their passwords.
// The password comes from the environment, so it is never written in the repository:
//   SEED_PASSWORD=choose-a-long-password npm run db:seed --workspace apps/server

const people: { name: string; email: string; role: Role }[] = [
  { name: "Jonah Thomas", email: "jonah@meridianlogistics.example", role: "administrator" },
  { name: "Priya Raman", email: "priya@meridianlogistics.example", role: "workflow_builder" },
  { name: "Rahul Shah", email: "rahul@meridianlogistics.example", role: "workflow_builder" },
  { name: "Lena Costa", email: "lena@meridianlogistics.example", role: "business_user" },
];

const password = process.env.SEED_PASSWORD ?? "";
if (password.length < MINIMUM_PASSWORD_LENGTH) {
  console.error(`Set SEED_PASSWORD to at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}

await db.insert(workspace).values({ id: 1, name: "Meridian Logistics" }).onConflictDoNothing();

const passwordHash = await hashPassword(password);
for (const person of people) {
  await db
    .insert(users)
    .values({ ...person, passwordHash })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, role: person.role, isActive: true } });

  const [saved] = await db.select({ email: users.email, role: users.role }).from(users).where(eq(users.email, person.email));
  console.log(`Ready: ${saved.email} (${saved.role})`);
}

await pool.end();
