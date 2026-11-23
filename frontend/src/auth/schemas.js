import { z } from 'zod';

// Mirrors backend/src/modules/auth/auth.validation.js
export const passwordSchema = z
  .string()
  .min(10, 'Mínimo 10 caracteres')
  .max(128)
  .regex(/[A-Za-z]/, 'Incluye al menos una letra')
  .regex(/\d/, 'Incluye al menos un número');

export const emailSchema = z.string().trim().toLowerCase().email('Correo inválido');
export const codeSchema = z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 dígitos');

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Escribe tu contraseña') });

export const registerSchema = z
  .object({
    name: z.string().trim().min(3, 'Escribe tu nombre completo').max(120),
    email: emailSchema,
    employeeNumber: z.string().trim().max(30).optional(),
    department: z.string().trim().max(100).optional(),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' });

export const resetSchema = z
  .object({ email: emailSchema, code: codeSchema, password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' });
