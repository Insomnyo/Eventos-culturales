// Hash de contraseñas con bcrypt (costo 12). bcryptjs es JavaScript puro: no necesita compilar
// nada en Windows. Nunca se guarda ni se registra la contraseña original.
import bcrypt from 'bcryptjs';

const COST = 12;
export const hashPassword = (plain) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Hash falso para comparar cuando el email no existe: el tiempo de respuesta es parecido
// exista o no la cuenta (evita enumerar usuarios midiendo tiempos).
export const DUMMY_HASH = bcrypt.hashSync('contraseña-que-nadie-usa', COST);
