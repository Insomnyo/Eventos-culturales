// Crea (o promueve) la cuenta de administrador desde la terminal.
//   npm run create-admin
// Pide email, nombre y contraseña (la contraseña no se muestra ni queda en el historial de la consola).
import readline from 'node:readline';
import { pool, query } from '../src/lib/db.js';
import { newId } from '../src/utils/crypto.js';
import { hashPassword } from '../src/utils/passwords.js';
import { passwordRule } from '../src/validators/schemas.js';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = function writeMuted(text) {
      if (this.stdoutMuted) this.output.write('*'); else this.output.write(text);
    };
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()); });
    rl.stdoutMuted = hidden;
  });
}

try {
  const email = (await ask('Email del administrador: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email inválido.');

  const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    await query("UPDATE users SET role = 'admin', email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?", [new Date(), existing.id]);
    console.log(`✔ ${email} ya existía: ahora es administrador (y quedó con el email verificado).`);
  } else {
    const fullName = (await ask('Nombre completo: ')) || 'Administrador';
    const password = await ask('Contraseña (10+ caracteres, mayúscula, minúscula y número): ', { hidden: true });
    const check = passwordRule.safeParse(password);
    if (!check.success) throw new Error(check.error.issues[0].message);
    await query(
      "INSERT INTO users (id, email, password_hash, full_name, role, email_verified_at) VALUES (?, ?, ?, ?, 'admin', ?)",
      [newId(), email, await hashPassword(password), fullName.slice(0, 80), new Date()],
    );
    console.log(`✔ Administrador creado: ${email}. Ya podés ingresar en la app.`);
  }
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
