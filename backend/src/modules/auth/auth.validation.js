import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(128)
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

const email = z.string().trim().toLowerCase().email('Correo inválido').max(200);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');
const code = z.string().trim().regex(/^\d{6}$/, 'El código debe tener 6 dígitos');

export const registerBody = z.object({
  name: z.string().trim().min(3, 'Escribe tu nombre completo').max(120),
  email,
  password: passwordSchema,
  employeeNumber: z.string().trim().max(30).optional(),
  department: z.string().trim().max(100).optional(),
  jobTitle: z.string().trim().max(100).optional(),
});

export const loginBody = z.object({ email, password: z.string().min(1).max(128) });
export const verifyBody = z.object({ challengeId: objectId, code });
export const resendBody = z.object({ challengeId: objectId });
export const forgotBody = z.object({ email });
export const resetBody = z.object({ email, code, password: passwordSchema });
export const changePasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
