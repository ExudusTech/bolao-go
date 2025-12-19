import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido").min(1, "Email obrigatório"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().email("Email inválido").min(1, "Email obrigatório"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const LOTTERY_TYPES = {
  megasena: {
    name: "Mega-Sena",
    minNumbers: 6,
    maxNumbers: 20,
    numberRange: 60,
    prices: {
      6: 6.00,
      7: 42.00,
      8: 168.00,
      9: 504.00,
      10: 1260.00,
      11: 2772.00,
      12: 5544.00,
      13: 10296.00,
      14: 18018.00,
      15: 30030.00,
      16: 48048.00,
      17: 74256.00,
      18: 111384.00,
      19: 162792.00,
      20: 232560.00,
    },
  },
} as const;

export type LotteryType = keyof typeof LOTTERY_TYPES;

export const createBolaoSchema = z.object({
  nome_do_bolao: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100, "Nome muito longo"),
  chave_pix: z.string().min(1, "Chave PIX obrigatória").max(100, "Chave PIX muito longa"),
  tipo_loteria: z.enum(["megasena"]).default("megasena"),
  valor_cota: z.number().min(1, "Valor mínimo é R$ 1,00").max(1000, "Valor máximo é R$ 1.000,00"),
  data_sorteio: z.string().optional(),
  numero_concurso: z.number().int().positive("Número do concurso inválido").optional(),
  observacoes: z.string().max(500, "Observações muito longas").optional(),
});

export const apostasSchema = z.object({
  apelido: z.string().min(2, "Apelido deve ter no mínimo 2 caracteres").max(50, "Apelido muito longo"),
  celular: z.string()
    .transform((val) => val.replace(/\D/g, '')) // Strip all non-digits
    .refine((val) => val.length >= 10 && val.length <= 11, "Celular deve ter 10 ou 11 dígitos")
    .refine((val) => /^[1-9]{2}9?\d{8}$/.test(val), "Formato de celular brasileiro inválido"),
  dezenas: z.array(z.number().min(1, "Número inválido").max(60, "Número deve ser entre 1 e 60"))
    .length(6, "Selecione exatamente 6 números")
    .refine((arr) => new Set(arr).size === 6, "Os números devem ser diferentes"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateBolaoInput = z.infer<typeof createBolaoSchema>;
export type ApostaInput = z.infer<typeof apostasSchema>;
